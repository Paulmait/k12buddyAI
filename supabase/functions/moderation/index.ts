/**
 * Content Moderation Edge Function
 * Handles content safety and audit logging
 */

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Profanity and inappropriate content patterns
const PROFANITY_PATTERNS = [
  /\b(damn|hell|crap)\b/gi,
  // Add more patterns as needed - keeping list minimal for K-12
];

const SEVERE_PATTERNS = [
  /\b(kill|death|suicide|harm)\b/gi,
  /\b(drugs?|alcohol|smoking)\b/gi,
  // Violence and substance-related content
];

// PII patterns
const PII_PATTERNS = {
  email: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g,
  phone: /(\+?1?[-.\s]?)?\(?[0-9]{3}\)?[-.\s]?[0-9]{3}[-.\s]?[0-9]{4}/g,
  ssn: /\b\d{3}[-]?\d{2}[-]?\d{4}\b/g,
  address: /\d+\s+[\w\s]+(?:street|st|avenue|ave|road|rd|boulevard|blvd|lane|ln|drive|dr|court|ct|way|place|pl)[\s,]*(?:apt|apartment|suite|unit|#)?\s*\d*/gi,
};

type ModerationResult = {
  isAllowed: boolean;
  filteredContent: string;
  flags: string[];
  severity: 'none' | 'low' | 'medium' | 'high';
  piiDetected: string[];
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    );

    // Service key for admin operations
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { data: { user } } = await supabaseClient.auth.getUser();

    const url = new URL(req.url);
    const path = url.pathname.split('/').pop();

    switch (path) {
      case 'check':
        return await handleCheckContent(req, supabaseClient, supabaseAdmin, user?.id);
      case 'report':
        return await handleReportContent(req, supabaseClient, user?.id);
      case 'audit':
        return await handleAuditLog(req, supabaseAdmin, user?.id);
      case 'admin-reports':
        return await handleAdminReports(req, supabaseAdmin, user?.id);
      case 'admin-action':
        return await handleAdminAction(req, supabaseAdmin, user?.id);
      default:
        return new Response(
          JSON.stringify({ error: 'Not found' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    }
  } catch (error) {
    console.error('Moderation error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

// Check and filter content
async function handleCheckContent(
  req: Request,
  supabase: ReturnType<typeof createClient>,
  supabaseAdmin: ReturnType<typeof createClient>,
  userId?: string
): Promise<Response> {
  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ error: 'Method not allowed' }),
      { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  const { content, context } = await req.json();

  if (!content || typeof content !== 'string') {
    return new Response(
      JSON.stringify({ error: 'Content required' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // Get custom blocked patterns
  const { data: blockedPatterns } = await supabaseAdmin
    .from('blocked_patterns')
    .select('pattern, replacement, severity')
    .eq('is_active', true);

  const result = moderateContent(content, blockedPatterns || []);

  // Log if flagged
  if (result.flags.length > 0 && userId) {
    await supabaseAdmin.from('audit_logs').insert({
      user_id: userId,
      action: 'content_flagged',
      resource_type: context || 'message',
      details: {
        flags: result.flags,
        severity: result.severity,
        piiDetected: result.piiDetected,
      },
    });
  }

  return new Response(
    JSON.stringify(result),
    { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}

// User reports inappropriate content
async function handleReportContent(
  req: Request,
  supabase: ReturnType<typeof createClient>,
  userId?: string
): Promise<Response> {
  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ error: 'Method not allowed' }),
      { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  if (!userId) {
    return new Response(
      JSON.stringify({ error: 'Unauthorized' }),
      { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  const { contentType, contentId, reason, description } = await req.json();

  if (!contentType || !contentId || !reason) {
    return new Response(
      JSON.stringify({ error: 'Missing required fields' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  const { error } = await supabase.from('content_reports').insert({
    reporter_id: userId,
    content_type: contentType,
    content_id: contentId,
    reason,
    description: description || '',
    status: 'pending',
  });

  if (error) {
    return new Response(
      JSON.stringify({ error: 'Failed to submit report' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  return new Response(
    JSON.stringify({ success: true, message: 'Report submitted' }),
    { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}

// Log audit event
async function handleAuditLog(
  req: Request,
  supabaseAdmin: ReturnType<typeof createClient>,
  userId?: string
): Promise<Response> {
  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ error: 'Method not allowed' }),
      { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  const { action, resourceType, resourceId, details, ipAddress } = await req.json();

  if (!action || !resourceType) {
    return new Response(
      JSON.stringify({ error: 'Missing required fields' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  const { error } = await supabaseAdmin.from('audit_logs').insert({
    user_id: userId || null,
    action,
    resource_type: resourceType,
    resource_id: resourceId || null,
    details: details || {},
    ip_address: ipAddress || null,
  });

  if (error) {
    console.error('Audit log error:', error);
    // Don't fail the request if audit logging fails
  }

  return new Response(
    JSON.stringify({ success: true }),
    { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}

// Admin: Get content reports
async function handleAdminReports(
  req: Request,
  supabaseAdmin: ReturnType<typeof createClient>,
  userId?: string
): Promise<Response> {
  if (req.method !== 'GET') {
    return new Response(
      JSON.stringify({ error: 'Method not allowed' }),
      { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // Check if user is admin
  if (!userId) {
    return new Response(
      JSON.stringify({ error: 'Unauthorized' }),
      { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  const { data: profile } = await supabaseAdmin
    .from('profiles')
    .select('role')
    .eq('id', userId)
    .single();

  if (profile?.role !== 'admin' && profile?.role !== 'moderator') {
    return new Response(
      JSON.stringify({ error: 'Forbidden' }),
      { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  const url = new URL(req.url);
  const status = url.searchParams.get('status') || 'pending';
  const limit = parseInt(url.searchParams.get('limit') || '50');

  const { data: reports, error } = await supabaseAdmin
    .from('content_reports')
    .select(`
      *,
      reporter:profiles!reporter_id(display_name)
    `)
    .eq('status', status)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    return new Response(
      JSON.stringify({ error: 'Failed to fetch reports' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  return new Response(
    JSON.stringify({ reports }),
    { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}

// Admin: Take action on a report
async function handleAdminAction(
  req: Request,
  supabaseAdmin: ReturnType<typeof createClient>,
  userId?: string
): Promise<Response> {
  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ error: 'Method not allowed' }),
      { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  if (!userId) {
    return new Response(
      JSON.stringify({ error: 'Unauthorized' }),
      { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // Check admin status
  const { data: profile } = await supabaseAdmin
    .from('profiles')
    .select('role')
    .eq('id', userId)
    .single();

  if (profile?.role !== 'admin' && profile?.role !== 'moderator') {
    return new Response(
      JSON.stringify({ error: 'Forbidden' }),
      { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  const { reportId, action, resolution } = await req.json();

  if (!reportId || !action) {
    return new Response(
      JSON.stringify({ error: 'Missing required fields' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // Update report status
  const { error: updateError } = await supabaseAdmin
    .from('content_reports')
    .update({
      status: action === 'dismiss' ? 'dismissed' : 'resolved',
      reviewed_by: userId,
      reviewed_at: new Date().toISOString(),
      resolution: resolution || null,
    })
    .eq('id', reportId);

  if (updateError) {
    return new Response(
      JSON.stringify({ error: 'Failed to update report' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // Log the action
  await supabaseAdmin.from('audit_logs').insert({
    user_id: userId,
    action: `report_${action}`,
    resource_type: 'content_report',
    resource_id: reportId,
    details: { resolution },
  });

  return new Response(
    JSON.stringify({ success: true }),
    { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}

// Content moderation logic
function moderateContent(
  content: string,
  customPatterns: Array<{ pattern: string; replacement: string; severity: string }>
): ModerationResult {
  let filteredContent = content;
  const flags: string[] = [];
  const piiDetected: string[] = [];
  let severity: 'none' | 'low' | 'medium' | 'high' = 'none';

  // Check for PII
  for (const [type, pattern] of Object.entries(PII_PATTERNS)) {
    if (pattern.test(content)) {
      piiDetected.push(type);
      filteredContent = filteredContent.replace(pattern, `[${type.toUpperCase()} REMOVED]`);
    }
  }

  if (piiDetected.length > 0) {
    flags.push('pii_detected');
    severity = 'medium';
  }

  // Check severe patterns
  for (const pattern of SEVERE_PATTERNS) {
    if (pattern.test(content)) {
      flags.push('severe_content');
      severity = 'high';
      break;
    }
  }

  // Check profanity
  for (const pattern of PROFANITY_PATTERNS) {
    if (pattern.test(content)) {
      filteredContent = filteredContent.replace(pattern, '****');
      flags.push('profanity');
      if (severity === 'none') severity = 'low';
    }
  }

  // Check custom patterns
  for (const { pattern, replacement, severity: patternSeverity } of customPatterns) {
    try {
      const regex = new RegExp(pattern, 'gi');
      if (regex.test(content)) {
        filteredContent = filteredContent.replace(regex, replacement || '****');
        flags.push('custom_pattern');
        if (patternSeverity === 'high') severity = 'high';
        else if (patternSeverity === 'medium' && severity !== 'high') severity = 'medium';
        else if (severity === 'none') severity = 'low';
      }
    } catch {
      // Invalid regex, skip
    }
  }

  return {
    isAllowed: severity !== 'high',
    filteredContent,
    flags: [...new Set(flags)],
    severity,
    piiDetected,
  };
}
