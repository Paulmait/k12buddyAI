import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { corsHeaders, handleCors } from '../_shared/cors.ts';
import { getSupabaseClient, getSupabaseServiceClient } from '../_shared/supabase.ts';

interface TrackEventRequest {
  student_id: string;
  event_name: string;
  event_properties?: Record<string, unknown>;
  session_id?: string;
  app_version?: string;
}

// List of allowed event names (for validation)
const ALLOWED_EVENTS = new Set([
  'app_opened',
  'app_backgrounded',
  'question_asked',
  'scan_completed',
  'badge_earned',
  'streak_updated',
  'level_up',
  'challenge_started',
  'challenge_completed',
  'textbook_selected',
  'session_started',
  'session_ended',
  'error_occurred',
]);

// List of PII fields to strip from properties
const PII_FIELDS = new Set([
  'email',
  'name',
  'phone',
  'address',
  'ssn',
  'password',
  'token',
  'content',
  'message',
  'question',
]);

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

    const url = new URL(req.url);
    const path = url.pathname.split('/').pop();

    switch (path) {
      case 'track':
        return await handleTrackEvent(req, serviceClient);
      case 'aggregate':
        return await handleAggregate(req, serviceClient);
      case 'dashboard':
        return await handleDashboard(req, serviceClient);
      default:
        return new Response(
          JSON.stringify({ error: 'Unknown endpoint' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    }
  } catch (error) {
    console.error('Analytics error:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

// Track an analytics event
async function handleTrackEvent(
  req: Request,
  serviceClient: ReturnType<typeof getSupabaseServiceClient>
): Promise<Response> {
  const body: TrackEventRequest = await req.json();
  const { student_id, event_name, event_properties, session_id, app_version } = body;

  // Validate event name
  if (!ALLOWED_EVENTS.has(event_name)) {
    return new Response(
      JSON.stringify({ error: 'Invalid event name' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // Strip PII from properties
  const sanitizedProperties = sanitizeProperties(event_properties || {});

  // Insert event
  const { error } = await serviceClient
    .from('analytics_events')
    .insert({
      student_id,
      event_name,
      event_properties: sanitizedProperties,
      session_id,
      app_version,
    });

  if (error) {
    console.error('Error tracking event:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to track event' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  return new Response(
    JSON.stringify({ success: true }),
    { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}

// Aggregate analytics data (typically run via cron)
async function handleAggregate(
  req: Request,
  serviceClient: ReturnType<typeof getSupabaseServiceClient>
): Promise<Response> {
  const today = new Date();
  const periodStart = new Date(today);
  periodStart.setHours(0, 0, 0, 0);
  const periodEnd = new Date(today);
  periodEnd.setHours(23, 59, 59, 999);

  const periodStartStr = periodStart.toISOString().split('T')[0];
  const periodEndStr = periodEnd.toISOString().split('T')[0];

  // Get today's events
  const { data: events } = await serviceClient
    .from('analytics_events')
    .select('event_name, event_properties, student_id')
    .gte('created_at', periodStart.toISOString())
    .lte('created_at', periodEnd.toISOString());

  if (!events || events.length === 0) {
    return new Response(
      JSON.stringify({ success: true, message: 'No events to aggregate' }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // Aggregate by event name
  const eventCounts: Record<string, number> = {};
  const uniqueUsers = new Set<string>();

  for (const event of events) {
    eventCounts[event.event_name] = (eventCounts[event.event_name] || 0) + 1;
    if (event.student_id) {
      uniqueUsers.add(event.student_id);
    }
  }

  // Store aggregates
  const aggregates = [
    // Total events
    {
      metric_name: 'total_events',
      dimension: null,
      dimension_value: null,
      period_start: periodStartStr,
      period_end: periodEndStr,
      value_sum: events.length,
      value_count: events.length,
      value_avg: events.length,
    },
    // Unique users
    {
      metric_name: 'unique_users',
      dimension: null,
      dimension_value: null,
      period_start: periodStartStr,
      period_end: periodEndStr,
      value_sum: uniqueUsers.size,
      value_count: uniqueUsers.size,
      value_avg: uniqueUsers.size,
    },
    // Events by type
    ...Object.entries(eventCounts).map(([eventName, count]) => ({
      metric_name: 'event_count',
      dimension: 'event_name',
      dimension_value: eventName,
      period_start: periodStartStr,
      period_end: periodEndStr,
      value_sum: count,
      value_count: count,
      value_avg: count,
    })),
  ];

  // Upsert aggregates
  for (const agg of aggregates) {
    await serviceClient
      .from('analytics_aggregates')
      .upsert(agg, {
        onConflict: 'metric_name,dimension,dimension_value,period_start,period_end',
      });
  }

  return new Response(
    JSON.stringify({
      success: true,
      aggregated: {
        total_events: events.length,
        unique_users: uniqueUsers.size,
        event_types: Object.keys(eventCounts).length,
      },
    }),
    { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}

// Get dashboard data (admin only in production)
async function handleDashboard(
  req: Request,
  serviceClient: ReturnType<typeof getSupabaseServiceClient>
): Promise<Response> {
  const url = new URL(req.url);
  const days = parseInt(url.searchParams.get('days') || '7', 10);

  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);
  const startDateStr = startDate.toISOString().split('T')[0];

  // Get aggregates for the period
  const { data: aggregates } = await serviceClient
    .from('analytics_aggregates')
    .select('*')
    .gte('period_start', startDateStr)
    .order('period_start', { ascending: false });

  // Calculate summary
  const summary = {
    total_events: 0,
    unique_users_per_day: 0,
    top_events: [] as Array<{ event: string; count: number }>,
  };

  const eventTotals: Record<string, number> = {};
  const dailyUsers: number[] = [];

  for (const agg of aggregates || []) {
    if (agg.metric_name === 'total_events') {
      summary.total_events += agg.value_sum;
    }
    if (agg.metric_name === 'unique_users') {
      dailyUsers.push(agg.value_sum);
    }
    if (agg.metric_name === 'event_count' && agg.dimension_value) {
      eventTotals[agg.dimension_value] = (eventTotals[agg.dimension_value] || 0) + agg.value_sum;
    }
  }

  summary.unique_users_per_day = dailyUsers.length > 0
    ? Math.round(dailyUsers.reduce((a, b) => a + b, 0) / dailyUsers.length)
    : 0;

  summary.top_events = Object.entries(eventTotals)
    .map(([event, count]) => ({ event, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  return new Response(
    JSON.stringify({
      period: {
        start: startDateStr,
        end: new Date().toISOString().split('T')[0],
        days,
      },
      summary,
      daily_aggregates: aggregates,
    }),
    { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}

// Sanitize properties to remove PII
function sanitizeProperties(props: Record<string, unknown>): Record<string, unknown> {
  const sanitized: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(props)) {
    // Skip PII fields
    if (PII_FIELDS.has(key.toLowerCase())) {
      continue;
    }

    // Recursively sanitize nested objects
    if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      sanitized[key] = sanitizeProperties(value as Record<string, unknown>);
    } else {
      sanitized[key] = value;
    }
  }

  return sanitized;
}
