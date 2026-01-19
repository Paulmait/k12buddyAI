/**
 * Audit Logging Service
 * Tracks important actions for compliance, safety, and reporting
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from './supabase';

const AUDIT_LOG_KEY = 'k12buddy_audit_log';
const MAX_LOCAL_LOGS = 100;

// Audit event types
export type AuditEventType =
  // Authentication events
  | 'auth_login'
  | 'auth_logout'
  | 'auth_failed'
  // Content events
  | 'content_blocked'
  | 'content_flagged'
  | 'content_reported'
  // Learning events
  | 'session_start'
  | 'session_end'
  | 'message_sent'
  | 'message_received'
  // Safety events
  | 'personal_info_detected'
  | 'inappropriate_content'
  | 'suspicious_activity'
  // Admin events
  | 'settings_changed'
  | 'data_export_requested'
  | 'data_deletion_requested';

// Audit log entry
export interface AuditLogEntry {
  id: string;
  timestamp: string;
  eventType: AuditEventType;
  userId: string | null;
  sessionId: string | null;
  metadata: Record<string, unknown>;
  severity: 'info' | 'warning' | 'critical';
  synced: boolean;
}

// Severity mapping for event types
const EVENT_SEVERITY: Record<AuditEventType, 'info' | 'warning' | 'critical'> = {
  auth_login: 'info',
  auth_logout: 'info',
  auth_failed: 'warning',
  content_blocked: 'warning',
  content_flagged: 'warning',
  content_reported: 'critical',
  session_start: 'info',
  session_end: 'info',
  message_sent: 'info',
  message_received: 'info',
  personal_info_detected: 'critical',
  inappropriate_content: 'critical',
  suspicious_activity: 'critical',
  settings_changed: 'info',
  data_export_requested: 'warning',
  data_deletion_requested: 'critical',
};

/**
 * Log an audit event
 */
export async function logAuditEvent(
  eventType: AuditEventType,
  metadata: Record<string, unknown> = {},
  userId: string | null = null,
  sessionId: string | null = null
): Promise<void> {
  const entry: AuditLogEntry = {
    id: `audit_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    timestamp: new Date().toISOString(),
    eventType,
    userId,
    sessionId,
    metadata: sanitizeMetadata(metadata),
    severity: EVENT_SEVERITY[eventType] || 'info',
    synced: false,
  };

  try {
    // Store locally
    await storeLocalLog(entry);

    // Attempt to sync critical events immediately
    if (entry.severity === 'critical') {
      await syncAuditLog(entry);
    }
  } catch (error) {
    console.error('Error logging audit event:', error);
  }
}

/**
 * Sanitize metadata to remove any PII
 */
function sanitizeMetadata(metadata: Record<string, unknown>): Record<string, unknown> {
  const sensitiveFields = ['email', 'phone', 'password', 'address', 'ssn', 'name'];
  const sanitized: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(metadata)) {
    const lowerKey = key.toLowerCase();

    // Skip sensitive fields
    if (sensitiveFields.some(field => lowerKey.includes(field))) {
      sanitized[key] = '[REDACTED]';
      continue;
    }

    // Truncate long string values
    if (typeof value === 'string' && value.length > 200) {
      sanitized[key] = value.substring(0, 200) + '...';
    } else {
      sanitized[key] = value;
    }
  }

  return sanitized;
}

/**
 * Store audit log entry locally
 */
async function storeLocalLog(entry: AuditLogEntry): Promise<void> {
  try {
    const existingData = await AsyncStorage.getItem(AUDIT_LOG_KEY);
    const logs: AuditLogEntry[] = existingData ? JSON.parse(existingData) : [];

    logs.push(entry);

    // Keep only recent logs
    const trimmedLogs = logs.slice(-MAX_LOCAL_LOGS);

    await AsyncStorage.setItem(AUDIT_LOG_KEY, JSON.stringify(trimmedLogs));
  } catch (error) {
    console.error('Error storing local audit log:', error);
  }
}

/**
 * Sync audit log to server
 */
async function syncAuditLog(entry: AuditLogEntry): Promise<boolean> {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return false;

    // Insert into audit_logs table (would need to be created in Supabase)
    const { error } = await supabase
      .from('audit_logs')
      .insert({
        id: entry.id,
        event_type: entry.eventType,
        user_id: entry.userId,
        session_id: entry.sessionId,
        metadata: entry.metadata,
        severity: entry.severity,
        created_at: entry.timestamp,
      });

    if (error) {
      console.error('Error syncing audit log:', error);
      return false;
    }

    // Mark as synced locally
    entry.synced = true;
    return true;
  } catch (error) {
    console.error('Error syncing audit log:', error);
    return false;
  }
}

/**
 * Sync all unsynced local logs
 */
export async function syncAllAuditLogs(): Promise<number> {
  try {
    const existingData = await AsyncStorage.getItem(AUDIT_LOG_KEY);
    if (!existingData) return 0;

    const logs: AuditLogEntry[] = JSON.parse(existingData);
    const unsyncedLogs = logs.filter(log => !log.synced);

    let syncedCount = 0;

    for (const log of unsyncedLogs) {
      const success = await syncAuditLog(log);
      if (success) syncedCount++;
    }

    // Update local storage with sync status
    await AsyncStorage.setItem(AUDIT_LOG_KEY, JSON.stringify(logs));

    return syncedCount;
  } catch (error) {
    console.error('Error syncing all audit logs:', error);
    return 0;
  }
}

/**
 * Get local audit logs
 */
export async function getLocalAuditLogs(): Promise<AuditLogEntry[]> {
  try {
    const data = await AsyncStorage.getItem(AUDIT_LOG_KEY);
    return data ? JSON.parse(data) : [];
  } catch (error) {
    console.error('Error getting local audit logs:', error);
    return [];
  }
}

/**
 * Export audit logs for a user (for data export requests)
 */
export async function exportAuditLogs(
  userId: string,
  startDate?: Date,
  endDate?: Date
): Promise<AuditLogEntry[]> {
  try {
    // Log the export request
    await logAuditEvent('data_export_requested', {
      startDate: startDate?.toISOString(),
      endDate: endDate?.toISOString(),
    }, userId);

    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return [];

    let query = supabase
      .from('audit_logs')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (startDate) {
      query = query.gte('created_at', startDate.toISOString());
    }

    if (endDate) {
      query = query.lte('created_at', endDate.toISOString());
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error exporting audit logs:', error);
      return [];
    }

    return data as AuditLogEntry[];
  } catch (error) {
    console.error('Error exporting audit logs:', error);
    return [];
  }
}

/**
 * Flag content for review
 */
export async function flagContent(
  userId: string,
  sessionId: string,
  contentId: string,
  reason: string,
  contentPreview: string
): Promise<void> {
  await logAuditEvent(
    'content_reported',
    {
      contentId,
      reason,
      contentPreview: contentPreview.substring(0, 100), // Limit preview
    },
    userId,
    sessionId
  );
}

/**
 * Clear local audit logs (for testing or after sync)
 */
export async function clearLocalAuditLogs(): Promise<void> {
  try {
    await AsyncStorage.removeItem(AUDIT_LOG_KEY);
  } catch (error) {
    console.error('Error clearing local audit logs:', error);
  }
}

// Convenience methods for common audit events
export const AuditLog = {
  // Auth events
  login: (userId: string) =>
    logAuditEvent('auth_login', {}, userId),

  logout: (userId: string) =>
    logAuditEvent('auth_logout', {}, userId),

  authFailed: (reason: string) =>
    logAuditEvent('auth_failed', { reason }),

  // Content events
  contentBlocked: (userId: string, sessionId: string, reason: string) =>
    logAuditEvent('content_blocked', { reason }, userId, sessionId),

  contentFlagged: (userId: string, sessionId: string, categories: string[]) =>
    logAuditEvent('content_flagged', { categories }, userId, sessionId),

  // Session events
  sessionStart: (userId: string, sessionId: string) =>
    logAuditEvent('session_start', {}, userId, sessionId),

  sessionEnd: (userId: string, sessionId: string, duration: number) =>
    logAuditEvent('session_end', { durationSeconds: duration }, userId, sessionId),

  // Safety events
  personalInfoDetected: (userId: string, sessionId: string) =>
    logAuditEvent('personal_info_detected', {}, userId, sessionId),

  inappropriateContent: (userId: string, sessionId: string, category: string) =>
    logAuditEvent('inappropriate_content', { category }, userId, sessionId),

  // Admin events
  settingsChanged: (userId: string, setting: string) =>
    logAuditEvent('settings_changed', { setting }, userId),

  dataExportRequested: (userId: string) =>
    logAuditEvent('data_export_requested', {}, userId),

  dataDeletionRequested: (userId: string) =>
    logAuditEvent('data_deletion_requested', {}, userId),
};

export default AuditLog;
