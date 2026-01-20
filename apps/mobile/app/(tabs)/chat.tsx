import { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { sendChatMessage, createChatSession, getChatHistory } from '../../src/lib/api';
import { getCurrentUser, getStudentProfile } from '../../src/lib/supabase';
import { useGamification } from '../../src/contexts/GamificationContext';
import { useOffline } from '../../src/contexts/OfflineContext';
import { Analytics } from '../../src/lib/analytics';
import {
  addToMessageQueue,
  cacheSessionMessages,
  getCachedSessionMessages,
  appendCachedMessage,
} from '../../src/lib/offlineStorage';
import type { ChatMessage, ResponseStyle, Student, Subject, Difficulty } from '../../src/types';

type Mode = ResponseStyle;

interface Citation {
  chunk_id: string;
  page_number: number;
  relevance_score: number;
}

interface MessageWithCitations extends ChatMessage {
  citations?: Citation[];
}

const MODES: { key: Mode; label: string; icon: string }[] = [
  { key: 'explain', label: 'Explain', icon: '📖' },
  { key: 'hint', label: 'Hint', icon: '💡' },
  { key: 'practice', label: 'Practice', icon: '✏️' },
  { key: 'review', label: 'Review', icon: '📝' },
];

export default function ChatScreen() {
  const [messages, setMessages] = useState<MessageWithCitations[]>([]);
  const [input, setInput] = useState('');
  const [mode, setMode] = useState<Mode>('explain');
  const [loading, setLoading] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [student, setStudent] = useState<Student | null>(null);
  const flatListRef = useRef<FlatList>(null);

  // Gamification hooks
  const { recordChatMessage } = useGamification();

  // Offline support
  const { isOnline, pendingMessageCount } = useOffline();

  useEffect(() => {
    initializeChat();
  }, []);

  async function initializeChat() {
    try {
      const user = await getCurrentUser();
      if (user) {
        const profile = await getStudentProfile(user.id);
        setStudent(profile);

        // Create a new session
        const session = await createChatSession(profile.id);
        setSessionId(session.id);

        // Try to load messages - from server if online, from cache if offline
        if (isOnline) {
          const history = await getChatHistory(session.id);
          setMessages(history || []);

          // Cache the loaded messages for offline access
          if (history && history.length > 0) {
            await cacheSessionMessages(session.id, history);
          }
        } else {
          // Load from cache when offline
          const cachedMessages = await getCachedSessionMessages(session.id);
          if (cachedMessages) {
            setMessages(cachedMessages as MessageWithCitations[]);
          }
        }
      }
    } catch (error) {
      console.error('Error initializing chat:', error);

      // If offline and error, try to load cached messages
      if (!isOnline && sessionId) {
        const cachedMessages = await getCachedSessionMessages(sessionId);
        if (cachedMessages) {
          setMessages(cachedMessages as MessageWithCitations[]);
        }
      }
    }
  }

  async function handleSend() {
    if (!input.trim() || !sessionId || !student) return;

    const userMessage = input.trim();
    setInput('');
    setLoading(true);

    const messageContext = {
      student_id: student.id,
      grade: student.grade,
      state: student.state,
      county: student.county || '',
      subject: 'math' as Subject, // TODO: Make this configurable
      response_style: mode,
      difficulty: 'average' as Difficulty, // TODO: Make this configurable
    };

    // Create user message object
    const tempUserMessage: MessageWithCitations = {
      id: `temp-${Date.now()}`,
      session_id: sessionId,
      role: 'user',
      content: userMessage,
      verified: false,
      created_at: new Date().toISOString(),
    };

    // Add user message to UI immediately
    setMessages(prev => [...prev, tempUserMessage]);

    // If offline, queue the message for later
    if (!isOnline) {
      try {
        await addToMessageQueue({
          sessionId,
          content: userMessage,
          context: messageContext,
        });

        // Cache the message locally
        await appendCachedMessage(sessionId, tempUserMessage);

        // Mark as queued (keep in messages list)
        setMessages(prev =>
          prev.map(m =>
            m.id === tempUserMessage.id
              ? { ...m, id: `queued-${Date.now()}` }
              : m
          )
        );
      } catch (error) {
        console.error('Error queuing message:', error);
      } finally {
        setLoading(false);
      }
      return;
    }

    // Online - send normally
    try {
      const response = await sendChatMessage(sessionId, userMessage, messageContext);

      // Replace temp message with real one and add assistant response with citations
      const assistantMessage: MessageWithCitations = {
        ...response.message,
        citations: response.citations,
      };
      setMessages(prev => [
        ...prev.filter(m => m.id !== tempUserMessage.id),
        assistantMessage,
      ]);

      // Cache the new messages
      await appendCachedMessage(sessionId, assistantMessage);

      // Award XP for sending a message
      await recordChatMessage();

      // Track analytics event (no PII - just metadata)
      Analytics.questionAsked(student.id, 'math', student.grade, mode);
    } catch (error) {
      console.error('Error sending message:', error);

      // If network error, try to queue for later
      if (!isOnline) {
        try {
          await addToMessageQueue({
            sessionId,
            content: userMessage,
            context: messageContext,
          });

          // Mark as queued instead of removing
          setMessages(prev =>
            prev.map(m =>
              m.id === tempUserMessage.id
                ? { ...m, id: `queued-${Date.now()}` }
                : m
            )
          );
        } catch (queueError) {
          console.error('Error queuing message:', queueError);
          // Remove temp message on complete failure
          setMessages(prev => prev.filter(m => m.id !== tempUserMessage.id));
        }
      } else {
        // Remove temp message on error when online
        setMessages(prev => prev.filter(m => m.id !== tempUserMessage.id));
      }
    } finally {
      setLoading(false);
    }
  }

  function renderCitations(citations: Citation[]) {
    if (!citations || citations.length === 0) return null;

    // Get unique page numbers
    const pageNumbers = [...new Set(citations.map(c => c.page_number))].sort((a, b) => a - b);

    return (
      <View style={styles.citationsContainer}>
        <Text style={styles.citationsLabel}>Sources:</Text>
        <View style={styles.citationsList}>
          {pageNumbers.map((page, index) => (
            <View key={index} style={styles.citationBadge}>
              <Text style={styles.citationText}>p. {page}</Text>
            </View>
          ))}
        </View>
      </View>
    );
  }

  function renderMessage({ item }: { item: MessageWithCitations }) {
    const isUser = item.role === 'user';
    const isQueued = item.id.startsWith('queued-');
    const isPending = item.id.startsWith('temp-');

    return (
      <View
        style={[
          styles.messageBubble,
          isUser ? styles.userBubble : styles.assistantBubble,
          isQueued && styles.queuedBubble,
        ]}
      >
        <Text
          style={[
            styles.messageText,
            isUser ? styles.userText : styles.assistantText,
          ]}
        >
          {item.content}
        </Text>
        {!isUser && item.citations && renderCitations(item.citations)}
        {isQueued && (
          <View style={styles.queuedIndicator}>
            <Text style={styles.queuedText}>📤 Queued - will send when online</Text>
          </View>
        )}
        {isPending && (
          <View style={styles.queuedIndicator}>
            <Text style={styles.queuedText}>Sending...</Text>
          </View>
        )}
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={90}
      >
        {/* Mode Selector */}
        <View style={styles.modeSelector}>
          {MODES.map(m => (
            <TouchableOpacity
              key={m.key}
              style={[
                styles.modeButton,
                mode === m.key && styles.modeButtonActive,
              ]}
              onPress={() => setMode(m.key)}
            >
              <Text style={styles.modeIcon}>{m.icon}</Text>
              <Text
                style={[
                  styles.modeLabel,
                  mode === m.key && styles.modeLabelActive,
                ]}
              >
                {m.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Messages */}
        <FlatList
          ref={flatListRef}
          data={messages}
          renderItem={renderMessage}
          keyExtractor={item => item.id}
          contentContainerStyle={styles.messagesList}
          onContentSizeChange={() =>
            flatListRef.current?.scrollToEnd({ animated: true })
          }
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Text style={styles.emptyIcon}>🎓</Text>
              <Text style={styles.emptyTitle}>Ready to help!</Text>
              <Text style={styles.emptyText}>
                Ask me anything about your homework or lessons.
                {'\n'}I&apos;ll guide you step by step.
              </Text>
            </View>
          }
        />

        {/* Loading indicator */}
        {loading && (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="small" color="#4F46E5" />
            <Text style={styles.loadingText}>Thinking...</Text>
          </View>
        )}

        {/* Input */}
        <View style={styles.inputContainer}>
          <TextInput
            style={styles.input}
            value={input}
            onChangeText={setInput}
            placeholder="Type your question..."
            placeholderTextColor="#9CA3AF"
            multiline
            maxLength={2000}
            editable={!loading}
          />
          <TouchableOpacity
            style={[styles.sendButton, !input.trim() && styles.sendButtonDisabled]}
            onPress={handleSend}
            disabled={!input.trim() || loading}
          >
            <Text style={styles.sendButtonText}>Send</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  modeSelector: {
    flexDirection: 'row',
    padding: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  modeButton: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 8,
    borderRadius: 8,
    marginHorizontal: 4,
  },
  modeButtonActive: {
    backgroundColor: '#EEF2FF',
  },
  modeIcon: {
    fontSize: 20,
    marginBottom: 2,
  },
  modeLabel: {
    fontSize: 12,
    color: '#6B7280',
  },
  modeLabelActive: {
    color: '#4F46E5',
    fontWeight: '600',
  },
  messagesList: {
    padding: 16,
    flexGrow: 1,
  },
  messageBubble: {
    maxWidth: '80%',
    padding: 12,
    borderRadius: 16,
    marginBottom: 8,
  },
  userBubble: {
    alignSelf: 'flex-end',
    backgroundColor: '#4F46E5',
    borderBottomRightRadius: 4,
  },
  queuedBubble: {
    backgroundColor: '#6366F1',
    opacity: 0.85,
  },
  queuedIndicator: {
    marginTop: 6,
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.3)',
  },
  queuedText: {
    fontSize: 11,
    color: 'rgba(255, 255, 255, 0.8)',
    fontStyle: 'italic',
  },
  assistantBubble: {
    alignSelf: 'flex-start',
    backgroundColor: '#fff',
    borderBottomLeftRadius: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 1,
  },
  messageText: {
    fontSize: 16,
    lineHeight: 22,
  },
  userText: {
    color: '#fff',
  },
  assistantText: {
    color: '#1F2937',
  },
  citationsContainer: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  citationsLabel: {
    fontSize: 11,
    color: '#6B7280',
    marginBottom: 4,
  },
  citationsList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
  },
  citationBadge: {
    backgroundColor: '#EEF2FF',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
  },
  citationText: {
    fontSize: 11,
    color: '#4F46E5',
    fontWeight: '500',
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 20,
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 8,
  },
  loadingText: {
    marginLeft: 8,
    color: '#6B7280',
    fontSize: 14,
  },
  inputContainer: {
    flexDirection: 'row',
    padding: 12,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    alignItems: 'flex-end',
  },
  input: {
    flex: 1,
    backgroundColor: '#F3F4F6',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 16,
    maxHeight: 100,
    color: '#1F2937',
  },
  sendButton: {
    backgroundColor: '#4F46E5',
    borderRadius: 20,
    paddingHorizontal: 20,
    paddingVertical: 10,
    marginLeft: 8,
  },
  sendButtonDisabled: {
    backgroundColor: '#C7D2FE',
  },
  sendButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 16,
  },
});
