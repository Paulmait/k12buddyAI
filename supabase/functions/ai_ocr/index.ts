import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { corsHeaders, handleCors } from '../_shared/cors.ts';
import { getSupabaseClient, getSupabaseServiceClient } from '../_shared/supabase.ts';
import { callVisionAPI } from '../_shared/ai-client.ts';

interface OCRRequest {
  student_id: string;
  image_path: string; // Storage path in student-uploads bucket
  textbook_id?: string;
}

const OCR_PROMPT = `You are an educational OCR assistant. Analyze this image of a student's schoolwork or textbook page.

Extract ALL visible text accurately, preserving:
1. Mathematical equations and expressions (use LaTeX notation)
2. Question numbers and labels
3. Diagrams descriptions (describe any figures or charts)
4. Handwritten text (if legible, note uncertainty)

Format your response as JSON:
{
  "extracted_text": "The full text content extracted from the image",
  "detected_questions": ["List of individual questions if found"],
  "math_expressions": ["Any mathematical expressions in LaTeX"],
  "diagrams": ["Descriptions of any diagrams or figures"],
  "page_number": null or number if visible,
  "confidence": 0.0-1.0 confidence score,
  "notes": "Any relevant notes about image quality or unclear areas"
}`;

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

    const body: OCRRequest = await req.json();
    const { student_id, image_path, textbook_id } = body;

    // Verify student belongs to user
    const { data: student, error: studentError } = await supabase
      .from('students')
      .select('id')
      .eq('id', student_id)
      .single();

    if (studentError || !student) {
      return new Response(
        JSON.stringify({ error: 'Student not found or unauthorized' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Download image from storage
    const { data: imageData, error: downloadError } = await serviceClient
      .storage
      .from('student-uploads')
      .download(image_path);

    if (downloadError || !imageData) {
      return new Response(
        JSON.stringify({ error: 'Failed to download image' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Convert to base64
    const arrayBuffer = await imageData.arrayBuffer();
    const base64 = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)));

    // Record AI run start
    const runStartTime = Date.now();
    const { data: aiRun } = await serviceClient
      .from('ai_runs')
      .insert({
        student_id,
        run_type: 'ocr',
        provider: 'openai',
        model: 'gpt-4o',
        status: 'running',
      })
      .select()
      .single();

    // Call Vision API (OpenAI for OCR)
    const result = await callVisionAPI(base64, OCR_PROMPT);
    const latencyMs = Date.now() - runStartTime;

    // Parse response
    let parsedResult;
    try {
      // Try to extract JSON from the response
      const jsonMatch = result.content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        parsedResult = JSON.parse(jsonMatch[0]);
      } else {
        parsedResult = {
          extracted_text: result.content,
          confidence: 0.7,
          notes: 'Response was not in expected JSON format',
        };
      }
    } catch {
      parsedResult = {
        extracted_text: result.content,
        confidence: 0.7,
        notes: 'Failed to parse response as JSON',
      };
    }

    // Update AI run record
    await serviceClient
      .from('ai_runs')
      .update({
        input_tokens: result.inputTokens,
        output_tokens: result.outputTokens,
        latency_ms: latencyMs,
        status: 'completed',
      })
      .eq('id', aiRun?.id);

    // Update student upload record as processed
    await serviceClient
      .from('student_uploads')
      .update({ processed: true })
      .eq('storage_path', image_path);

    // Save extracted artifact to storage
    const artifactPath = `${student_id}/ocr/${Date.now()}.json`;
    await serviceClient
      .storage
      .from('extracted-artifacts')
      .upload(artifactPath, JSON.stringify(parsedResult), {
        contentType: 'application/json',
      });

    return new Response(
      JSON.stringify({
        extracted_text: parsedResult.extracted_text,
        detected_questions: parsedResult.detected_questions || [],
        math_expressions: parsedResult.math_expressions || [],
        detected_page: parsedResult.page_number,
        confidence: parsedResult.confidence || 0.7,
        artifact_path: artifactPath,
        usage: {
          input_tokens: result.inputTokens,
          output_tokens: result.outputTokens,
          latency_ms: latencyMs,
        },
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('OCR error:', error);

    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
  }
});
