import AsyncStorage from '@react-native-async-storage/async-storage';

// Storage keys
const KEYS = {
  CACHED_MESSAGES: 'k12buddy_cached_messages',
  MESSAGE_QUEUE: 'k12buddy_message_queue',
  CACHED_SESSIONS: 'k12buddy_cached_sessions',
  CACHED_GAMIFICATION: 'k12buddy_cached_gamification',
  LAST_SYNC: 'k12buddy_last_sync',
};

// Types
interface QueuedMessage {
  id: string;
  sessionId: string;
  content: string;
  context: Record<string, unknown>;
  createdAt: string;
  retryCount: number;
}

interface CachedMessage {
  id: string;
  session_id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  created_at: string;
  citations?: Array<{ chunk_id: string; page_number: number }>;
}

interface CachedSession {
  id: string;
  student_id: string;
  messages: CachedMessage[];
  lastUpdated: string;
}

// ============ Message Queue (for offline sends) ============

export async function addToMessageQueue(message: Omit<QueuedMessage, 'id' | 'createdAt' | 'retryCount'>): Promise<void> {
  try {
    const queue = await getMessageQueue();
    const newMessage: QueuedMessage = {
      ...message,
      id: `queued_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      createdAt: new Date().toISOString(),
      retryCount: 0,
    };
    queue.push(newMessage);
    await AsyncStorage.setItem(KEYS.MESSAGE_QUEUE, JSON.stringify(queue));
  } catch (error) {
    console.error('Failed to add message to queue:', error);
  }
}

export async function getMessageQueue(): Promise<QueuedMessage[]> {
  try {
    const data = await AsyncStorage.getItem(KEYS.MESSAGE_QUEUE);
    return data ? JSON.parse(data) : [];
  } catch (error) {
    console.error('Failed to get message queue:', error);
    return [];
  }
}

export async function removeFromMessageQueue(messageId: string): Promise<void> {
  try {
    const queue = await getMessageQueue();
    const filtered = queue.filter(m => m.id !== messageId);
    await AsyncStorage.setItem(KEYS.MESSAGE_QUEUE, JSON.stringify(filtered));
  } catch (error) {
    console.error('Failed to remove message from queue:', error);
  }
}

export async function updateQueuedMessageRetry(messageId: string): Promise<void> {
  try {
    const queue = await getMessageQueue();
    const updated = queue.map(m =>
      m.id === messageId ? { ...m, retryCount: m.retryCount + 1 } : m
    );
    await AsyncStorage.setItem(KEYS.MESSAGE_QUEUE, JSON.stringify(updated));
  } catch (error) {
    console.error('Failed to update queued message retry:', error);
  }
}

export async function clearMessageQueue(): Promise<void> {
  try {
    await AsyncStorage.removeItem(KEYS.MESSAGE_QUEUE);
  } catch (error) {
    console.error('Failed to clear message queue:', error);
  }
}

// ============ Cached Messages ============

export async function cacheSessionMessages(sessionId: string, messages: CachedMessage[]): Promise<void> {
  try {
    const sessions = await getCachedSessions();
    const existingIndex = sessions.findIndex(s => s.id === sessionId);

    const sessionData: CachedSession = {
      id: sessionId,
      student_id: '', // Will be set from context
      messages,
      lastUpdated: new Date().toISOString(),
    };

    if (existingIndex >= 0) {
      sessions[existingIndex] = { ...sessions[existingIndex], ...sessionData };
    } else {
      sessions.push(sessionData);
    }

    // Keep only last 10 sessions to limit storage
    const trimmed = sessions.slice(-10);
    await AsyncStorage.setItem(KEYS.CACHED_SESSIONS, JSON.stringify(trimmed));
  } catch (error) {
    console.error('Failed to cache session messages:', error);
  }
}

export async function getCachedSessions(): Promise<CachedSession[]> {
  try {
    const data = await AsyncStorage.getItem(KEYS.CACHED_SESSIONS);
    return data ? JSON.parse(data) : [];
  } catch (error) {
    console.error('Failed to get cached sessions:', error);
    return [];
  }
}

export async function getCachedSessionMessages(sessionId: string): Promise<CachedMessage[] | null> {
  try {
    const sessions = await getCachedSessions();
    const session = sessions.find(s => s.id === sessionId);
    return session?.messages || null;
  } catch (error) {
    console.error('Failed to get cached session messages:', error);
    return null;
  }
}

export async function appendCachedMessage(sessionId: string, message: CachedMessage): Promise<void> {
  try {
    const sessions = await getCachedSessions();
    const sessionIndex = sessions.findIndex(s => s.id === sessionId);

    if (sessionIndex >= 0) {
      sessions[sessionIndex].messages.push(message);
      sessions[sessionIndex].lastUpdated = new Date().toISOString();
      await AsyncStorage.setItem(KEYS.CACHED_SESSIONS, JSON.stringify(sessions));
    }
  } catch (error) {
    console.error('Failed to append cached message:', error);
  }
}

// ============ Gamification Cache ============

export async function cacheGamificationStats(stats: Record<string, unknown>): Promise<void> {
  try {
    await AsyncStorage.setItem(KEYS.CACHED_GAMIFICATION, JSON.stringify({
      data: stats,
      cachedAt: new Date().toISOString(),
    }));
  } catch (error) {
    console.error('Failed to cache gamification stats:', error);
  }
}

export async function getCachedGamificationStats(): Promise<{ data: Record<string, unknown>; cachedAt: string } | null> {
  try {
    const data = await AsyncStorage.getItem(KEYS.CACHED_GAMIFICATION);
    return data ? JSON.parse(data) : null;
  } catch (error) {
    console.error('Failed to get cached gamification stats:', error);
    return null;
  }
}

// ============ Sync Tracking ============

export async function setLastSyncTime(): Promise<void> {
  try {
    await AsyncStorage.setItem(KEYS.LAST_SYNC, new Date().toISOString());
  } catch (error) {
    console.error('Failed to set last sync time:', error);
  }
}

export async function getLastSyncTime(): Promise<string | null> {
  try {
    return await AsyncStorage.getItem(KEYS.LAST_SYNC);
  } catch (error) {
    console.error('Failed to get last sync time:', error);
    return null;
  }
}

// ============ Clear All Cache ============

export async function clearAllCache(): Promise<void> {
  try {
    await AsyncStorage.multiRemove([
      KEYS.CACHED_MESSAGES,
      KEYS.MESSAGE_QUEUE,
      KEYS.CACHED_SESSIONS,
      KEYS.CACHED_GAMIFICATION,
      KEYS.LAST_SYNC,
    ]);
  } catch (error) {
    console.error('Failed to clear all cache:', error);
  }
}

export default {
  addToMessageQueue,
  getMessageQueue,
  removeFromMessageQueue,
  updateQueuedMessageRetry,
  clearMessageQueue,
  cacheSessionMessages,
  getCachedSessions,
  getCachedSessionMessages,
  appendCachedMessage,
  cacheGamificationStats,
  getCachedGamificationStats,
  setLastSyncTime,
  getLastSyncTime,
  clearAllCache,
};
