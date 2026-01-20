import {
  getMessageQueue,
  removeFromMessageQueue,
  updateQueuedMessageRetry,
  setLastSyncTime,
} from './offlineStorage';
import { sendChatMessage } from './api';

const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 1000;

interface SyncResult {
  success: boolean;
  synced: number;
  failed: number;
  errors: string[];
}

// Process all queued messages
export async function syncQueuedMessages(): Promise<SyncResult> {
  const result: SyncResult = {
    success: true,
    synced: 0,
    failed: 0,
    errors: [],
  };

  try {
    const queue = await getMessageQueue();

    if (queue.length === 0) {
      return result;
    }

    console.log(`Syncing ${queue.length} queued messages...`);

    for (const message of queue) {
      try {
        // Skip if too many retries
        if (message.retryCount >= MAX_RETRIES) {
          console.log(`Message ${message.id} exceeded max retries, removing`);
          await removeFromMessageQueue(message.id);
          result.failed++;
          result.errors.push(`Message exceeded max retries: ${message.id}`);
          continue;
        }

        // Try to send the message
        await sendChatMessage(
          message.sessionId,
          message.content,
          message.context as unknown as Parameters<typeof sendChatMessage>[2]
        );

        // Success - remove from queue
        await removeFromMessageQueue(message.id);
        result.synced++;

        // Small delay between messages to avoid rate limiting
        await delay(RETRY_DELAY_MS);
      } catch (error) {
        console.error(`Failed to sync message ${message.id}:`, error);
        await updateQueuedMessageRetry(message.id);
        result.failed++;
        result.errors.push(`Failed to sync: ${message.id}`);
      }
    }

    await setLastSyncTime();
    result.success = result.failed === 0;
  } catch (error) {
    console.error('Sync failed:', error);
    result.success = false;
    result.errors.push('Sync process failed');
  }

  return result;
}

// Check if we have pending messages
export async function hasPendingMessages(): Promise<boolean> {
  const queue = await getMessageQueue();
  return queue.length > 0;
}

// Get pending message count
export async function getPendingMessageCount(): Promise<number> {
  const queue = await getMessageQueue();
  return queue.length;
}

// Clear failed messages (those that exceeded retries)
export async function clearFailedMessages(): Promise<number> {
  const queue = await getMessageQueue();
  let cleared = 0;

  for (const message of queue) {
    if (message.retryCount >= MAX_RETRIES) {
      await removeFromMessageQueue(message.id);
      cleared++;
    }
  }

  return cleared;
}

// Helper function for delay
function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export default {
  syncQueuedMessages,
  hasPendingMessages,
  getPendingMessageCount,
  clearFailedMessages,
};
