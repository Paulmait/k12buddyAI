import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { corsHeaders, handleCors } from '../_shared/cors.ts';
import { getSupabaseClient, getSupabaseServiceClient } from '../_shared/supabase.ts';
import { getAICompletion, AIMessage } from '../_shared/ai-client.ts';

interface VerifyRequest {
  message_id: string;
  response_content: string;
  context: {
    student_id: string;
    grade: string;
    state: string;
    subject: string;
    textbook_id?: string;
    standards?: string[];
  };
}

function buildVerificationPrompt(context: VerifyRequest['context']): string {
  const gradeDescriptor = context.grade === 'K' ? 'Kindergarten' : `Grade ${context.grade}`;

  return `You are a K-12 Educational Content Verifier. Your job is to ensure AI-generated educational responses are safe and appropriate.

VERIFICATION CRITERIA:
1. GRADE APPROPRIATENESS: Content must be suitable for ${gradeDescriptor} in ${context.state}
2. CURRICULUM ALIGNMENT: Content must align with ${context.subject} curriculum
3. NO COLLEGE-LEVEL CONTENT: Flag any concepts beyond high school level
4. FACTUAL ACCURACY: Identify any factually incorrect statements
5. SAFETY: No inappropriate content for minors
6. PEDAGOGICAL SOUNDNESS: Follows good teaching practices

${context.standards?.length ? `RELEVANT STANDARDS: ${context.standards.join(', ')}` : ''}

Analyze the provided response and output JSON:
{
  "is_valid": true/false,
  "issues": ["List of specific issues found, if any"],
  "severity": "none" | "minor" | "major" | "critical",
  "corrected_content": "If issues found, provide corrected version, otherwise null",
  "explanation": "Brief explanation of your assessment"
}`;
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

    const body: VerifyRequest = await req.json();
    const { message_id, response_content, context } = body;

    // Record AI run start
    const runStartTime = Date.now();
    const { data: aiRun } = await serviceClient
      .from('ai_runs')
      .insert({
        student_id: context.student_id,
        run_type: 'verify',
        provider: 'anthropic', // Preferred for verification
        model: 'claude-3-5-sonnet-20241022',
        status: 'running',
      })
      .select()
      .single();

    // Build verification request
    const verificationPrompt = buildVerificationPrompt(context);
    const aiMessages: AIMessage[] = [
      { role: 'system', content: verificationPrompt },
      {
        role: 'user',
        content: `Please verify this educational response:\n\n${response_content}`,
      },
    ];

    // Call AI (Claude preferred, with OpenAI fallback)
    const result = await getAICompletion(aiMessages, 'anthropic', {
      maxTokens: 1024,
      temperature: 0.3, // Lower temperature for consistent verification
    });

    const latencyMs = Date.now() - runStartTime;

    // Parse response
    let parsedResult;
    try {
      const jsonMatch = result.content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        parsedResult = JSON.parse(jsonMatch[0]);
      } else {
        parsedResult = {
          is_valid: true,
          issues: [],
          severity: 'none',
          corrected_content: null,
          explanation: 'Could not parse verification response',
        };
      }
    } catch {
      parsedResult = {
        is_valid: true,
        issues: [],
        severity: 'none',
        corrected_content: null,
        explanation: 'Failed to parse verification response as JSON',
      };
    }

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

    // If critical issues found, update the original message
    if (parsedResult.severity === 'critical' && parsedResult.corrected_content) {
      await serviceClient
        .from('chat_messages')
        .update({ content: parsedResult.corrected_content })
        .eq('id', message_id);
    }

    return new Response(
      JSON.stringify({
        is_valid: parsedResult.is_valid,
        issues: parsedResult.issues || [],
        severity: parsedResult.severity || 'none',
        corrected_content: parsedResult.corrected_content,
        explanation: parsedResult.explanation,
        usage: {
          input_tokens: result.inputTokens,
          output_tokens: result.outputTokens,
          latency_ms: latencyMs,
        },
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Verification error:', error);

    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
