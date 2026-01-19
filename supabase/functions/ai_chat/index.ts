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

    // TODO: Retrieve relevant textbook chunks for context (Step 5)
    // const chunks = await getRelevantChunks(context.textbook_id, message);

    // Build messages for AI
    const systemPrompt = buildSystemPrompt(context);
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

    // TODO: Save citations from retrieved chunks (Step 5)

    return new Response(
      JSON.stringify({
        message: assistantMessage,
        citations: [], // TODO: Add after retrieval pipeline
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
