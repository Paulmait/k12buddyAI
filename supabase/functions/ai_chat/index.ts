import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { corsHeaders, handleCors } from '../_shared/cors.ts';
import { getSupabaseClient, getSupabaseServiceClient } from '../_shared/supabase.ts';
import { getAICompletion, AIMessage } from '../_shared/ai-client.ts';

interface ChatRequest {
  session_id: string;
  message: string;
  context: {
    student_id: string;
    grade: string;
    state: string;
    subject: string;
    textbook_id?: string;
    chapter?: string;
    lesson?: string;
    standards?: string[];
    response_style: 'explain' | 'hint' | 'practice' | 'review';
    difficulty: 'struggling' | 'average' | 'advanced';
  };
}

// ============ Chunk Retrieval Logic ============

interface RetrievableChunk {
  id: string;
  textbook_id: string;
  chapter_id: string;
  lesson_id: string | null;
  page_number: number;
  chunk_index: number;
  content: string;
}

interface ScoredChunk {
  chunk: RetrievableChunk;
  score: number;
  matched_terms: string[];
}

interface Citation {
  chunk_id: string;
  page_number: number;
  relevance_score: number;
}

// Stop words to filter from queries
const STOP_WORDS = new Set([
  'a', 'an', 'and', 'are', 'as', 'at', 'be', 'by', 'do', 'for',
  'from', 'has', 'have', 'he', 'her', 'his', 'how', 'i', 'if',
  'in', 'is', 'it', 'its', 'just', 'me', 'my', 'no', 'not', 'of',
  'on', 'or', 'our', 'out', 'so', 'that', 'the', 'them', 'then',
  'there', 'these', 'they', 'this', 'to', 'up', 'us', 'was', 'we',
  'what', 'when', 'which', 'who', 'why', 'will', 'with', 'would',
  'you', 'your', 'can', 'does', 'did', 'been', 'could', 'should',
]);

// Math terms that should be preserved
const MATH_TERMS = new Set([
  'add', 'addition', 'subtract', 'subtraction', 'multiply', 'multiplication',
  'divide', 'division', 'fraction', 'decimal', 'percent', 'equation',
  'variable', 'expression', 'exponent', 'power', 'root', 'square',
  'factor', 'prime', 'integer', 'ratio', 'proportion', 'solve',
  'simplify', 'graph', 'slope', 'intercept', 'linear', 'quadratic',
  'function', 'area', 'perimeter', 'volume', 'angle', 'triangle',
  'rectangle', 'circle', 'radius', 'diameter', 'mean', 'median', 'mode',
]);

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(term => term.length > 1)
    .filter(term => !STOP_WORDS.has(term) || MATH_TERMS.has(term));
}

function extractQueryTerms(query: string): string[] {
  const tokens = tokenize(query);
  const terms = new Set(tokens);

  // Add stemmed versions for common suffixes
  tokens.forEach(token => {
    if (token.endsWith('ing') && token.length > 5) {
      terms.add(token.slice(0, -3));
    } else if (token.endsWith('ed') && token.length > 4) {
      terms.add(token.slice(0, -2));
    } else if (token.endsWith('s') && token.length > 3 && !token.endsWith('ss')) {
      terms.add(token.slice(0, -1));
    }
  });

  return Array.from(terms);
}

function scoreChunk(chunk: RetrievableChunk, queryTerms: string[]): ScoredChunk {
  const contentTokens = tokenize(chunk.content);
  const matchedTerms: string[] = [];
  let score = 0;

  for (const term of queryTerms) {
    const count = contentTokens.filter(t => t === term || t.includes(term) || term.includes(t)).length;
    const tf = count / Math.max(contentTokens.length, 1);

    if (tf > 0) {
      // IDF approximation - longer/math terms get higher weight
      const lengthBoost = Math.min(term.length / 10, 1);
      const mathBoost = MATH_TERMS.has(term) ? 0.3 : 0;
      const idf = 0.5 + lengthBoost + mathBoost;

      score += tf * idf;
      matchedTerms.push(term);
    }
  }

  // Normalize by number of query terms
  if (queryTerms.length > 0) {
    score = score / queryTerms.length;
  }

  return {
    chunk,
    score: Math.min(score, 1),
    matched_terms: matchedTerms,
  };
}

async function retrieveRelevantChunks(
  serviceClient: ReturnType<typeof getSupabaseServiceClient>,
  textbookId: string,
  query: string,
  options: { topK?: number; minScore?: number; maxTokens?: number } = {}
): Promise<{ chunks: ScoredChunk[]; citations: Citation[] }> {
  const { topK = 5, minScore = 0.1, maxTokens = 2000 } = options;

  // Fetch chunks from database
  const { data: chunks, error } = await serviceClient
    .from('textbook_chunks')
    .select('id, textbook_id, chapter_id, page_number, chunk_index, content')
    .eq('textbook_id', textbookId)
    .limit(200); // Limit chunks to process

  if (error || !chunks || chunks.length === 0) {
    console.log('No chunks found for textbook:', textbookId);
    return { chunks: [], citations: [] };
  }

  // Score all chunks
  const queryTerms = extractQueryTerms(query);
  const scored = chunks
    .map(c => scoreChunk({ ...c, lesson_id: null }, queryTerms))
    .filter(s => s.score >= minScore)
    .sort((a, b) => b.score - a.score);

  // Select top-K while respecting token budget
  const selected: ScoredChunk[] = [];
  let tokenCount = 0;

  for (const item of scored) {
    if (selected.length >= topK) break;

    // Estimate tokens (rough approximation)
    const chunkTokens = Math.ceil(item.chunk.content.length / 4);

    if (tokenCount + chunkTokens <= maxTokens) {
      selected.push(item);
      tokenCount += chunkTokens;
    }
  }

  // Build citations
  const citations = selected.map(s => ({
    chunk_id: s.chunk.id,
    page_number: s.chunk.page_number,
    relevance_score: s.score,
  }));

  return { chunks: selected, citations };
}

function formatChunksForPrompt(scoredChunks: ScoredChunk[]): string {
  if (scoredChunks.length === 0) {
    return '';
  }

  const formatted = scoredChunks.map((item, index) => {
    const content = item.chunk.content.length > 1500
      ? item.chunk.content.slice(0, 1500) + '...'
      : item.chunk.content;

    return `--- Textbook Excerpt ${index + 1} [Page ${item.chunk.page_number}] ---\n${content}`;
  });

  return '\n\nRELEVANT TEXTBOOK CONTENT:\n' + formatted.join('\n\n');
}

// Build system prompt based on K-12 educational guidelines
function buildSystemPrompt(context: ChatRequest['context']): string {
  const gradeDescriptor = context.grade === 'K' ? 'Kindergarten' : `Grade ${context.grade}`;

  return `You are a K-12 Educational AI Assistant helping a ${gradeDescriptor} student in ${context.state}.

CRITICAL RULES - You MUST follow these:
1. NEVER answer beyond the provided textbook or mapped state standards
2. NEVER introduce college-level or unrelated material
3. NEVER provide full answers unless explicitly requested - guide the student to discover answers
4. ALWAYS explain reasoning step-by-step appropriate for ${gradeDescriptor}
5. ALWAYS adapt tone and vocabulary to ${gradeDescriptor} level
6. If context is missing, ask clarifying questions instead of guessing
7. ALWAYS end with a check-for-understanding question

CURRENT CONTEXT:
- Subject: ${context.subject}
- Grade: ${gradeDescriptor}
- State: ${context.state}
- Response Style: ${context.response_style}
- Student Level: ${context.difficulty}
${context.chapter ? `- Chapter: ${context.chapter}` : ''}
${context.lesson ? `- Lesson: ${context.lesson}` : ''}
${context.standards?.length ? `- Standards: ${context.standards.join(', ')}` : ''}

RESPONSE STYLE GUIDELINES:
${context.response_style === 'explain' ? '- Provide clear, grade-appropriate explanations with examples' : ''}
${context.response_style === 'hint' ? '- Give hints and guiding questions, NOT direct answers' : ''}
${context.response_style === 'practice' ? '- Provide practice problems similar to the topic' : ''}
${context.response_style === 'review' ? '- Summarize key concepts and check understanding' : ''}

DIFFICULTY ADAPTATION:
${context.difficulty === 'struggling' ? '- Use simpler vocabulary, more examples, smaller steps' : ''}
${context.difficulty === 'average' ? '- Use grade-appropriate vocabulary and standard explanations' : ''}
${context.difficulty === 'advanced' ? '- Can include enrichment content and deeper exploration' : ''}`;
}

serve(async (req: Request) => {
  // Handle CORS preflight
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  try {
    const supabase = getSupabaseClient(req);
    const serviceClient = getSupabaseServiceClient();

    // Verify authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const body: ChatRequest = await req.json();
    const { session_id, message, context } = body;

    // Validate session belongs to user
    const { data: session, error: sessionError } = await supabase
      .from('chat_sessions')
      .select('*, students!inner(user_id)')
      .eq('id', session_id)
      .single();

    if (sessionError || !session) {
      return new Response(
        JSON.stringify({ error: 'Session not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get chat history for context
    const { data: history } = await supabase
      .from('chat_messages')
      .select('role, content')
      .eq('session_id', session_id)
      .order('created_at', { ascending: true })
      .limit(20);

    // Save user message
    const { data: userMessage, error: saveError } = await serviceClient
      .from('chat_messages')
      .insert({
        session_id,
        role: 'user',
        content: message,
      })
      .select()
      .single();

    if (saveError) {
      throw new Error(`Failed to save user message: ${saveError.message}`);
    }

    // Retrieve relevant textbook chunks for context
    let retrievedChunks: ScoredChunk[] = [];
    let citations: Citation[] = [];

    if (context.textbook_id) {
      const retrieval = await retrieveRelevantChunks(
        serviceClient,
        context.textbook_id,
        message,
        { topK: 5, minScore: 0.1, maxTokens: 2000 }
      );
      retrievedChunks = retrieval.chunks;
      citations = retrieval.citations;
      console.log(`Retrieved ${retrievedChunks.length} chunks for query`);
    }

    // Build messages for AI with retrieved context
    const systemPrompt = buildSystemPrompt(context) + formatChunksForPrompt(retrievedChunks);
    const aiMessages: AIMessage[] = [
      { role: 'system', content: systemPrompt },
      ...(history || []).map(m => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
      })),
      { role: 'user', content: message },
    ];

    // Record AI run start
    const runStartTime = Date.now();
    const { data: aiRun } = await serviceClient
      .from('ai_runs')
      .insert({
        student_id: context.student_id,
        session_id,
        run_type: 'chat',
        provider: 'anthropic', // Will be updated after completion
        model: 'claude-3-5-sonnet-20241022',
        status: 'running',
      })
      .select()
      .single();

    // Call AI (Claude preferred for tutoring)
    const result = await getAICompletion(aiMessages, 'anthropic', {
      maxTokens: 2048,
      temperature: 0.7,
    });

    const latencyMs = Date.now() - runStartTime;

    // Update AI run record
    await serviceClient
      .from('ai_runs')
      .update({
        provider: result.provider,
        model: result.model,
        input_tokens: result.inputTokens,
        output_tokens: result.outputTokens,
        latency_ms: latencyMs,
        status: 'completed',
      })
      .eq('id', aiRun?.id);

    // Save assistant message
    const { data: assistantMessage } = await serviceClient
      .from('chat_messages')
      .insert({
        session_id,
        role: 'assistant',
        content: result.content,
      })
      .select()
      .single();

    // Save citations from retrieved chunks
    if (citations.length > 0 && assistantMessage) {
      const citationRecords = citations.map(c => ({
        message_id: assistantMessage.id,
        chunk_id: c.chunk_id,
        page_number: c.page_number,
        relevance_score: c.relevance_score,
      }));

      const { error: citationError } = await serviceClient
        .from('message_citations')
        .insert(citationRecords);

      if (citationError) {
        console.error('Failed to save citations:', citationError);
        // Don't fail the request, citations are non-critical
      }
    }

    // Format citations for response with page numbers
    const responseCitations = citations.map(c => ({
      chunk_id: c.chunk_id,
      page_number: c.page_number,
      relevance_score: Math.round(c.relevance_score * 100),
    }));

    return new Response(
      JSON.stringify({
        message: assistantMessage,
        citations: responseCitations,
        usage: {
          input_tokens: result.inputTokens,
          output_tokens: result.outputTokens,
          latency_ms: latencyMs,
        },
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Chat error:', error);

    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
