import React, { useEffect, useRef } from 'react';
import {
  View,
  StyleSheet,
  Animated,
  ViewStyle,
  DimensionValue,
} from 'react-native';
import { useAccessibility } from '../contexts/AccessibilityContext';

interface SkeletonProps {
  width?: DimensionValue;
  height?: DimensionValue;
  borderRadius?: number;
  style?: ViewStyle;
}

/**
 * Basic skeleton loading placeholder
 */
export function Skeleton({
  width = '100%',
  height = 20,
  borderRadius = 4,
  style,
}: SkeletonProps) {
  const { prefs } = useAccessibility();
  const animatedValue = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Don't animate if reduce motion is enabled
    if (prefs.reduceMotion) {
      animatedValue.setValue(0.5);
      return;
    }

    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(animatedValue, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
        }),
        Animated.timing(animatedValue, {
          toValue: 0,
          duration: 1000,
          useNativeDriver: true,
        }),
      ])
    );

    animation.start();

    return () => animation.stop();
  }, [prefs.reduceMotion, animatedValue]);

  const opacity = animatedValue.interpolate({
    inputRange: [0, 1],
    outputRange: [0.3, 0.7],
  });

  return (
    <Animated.View
      style={[
        styles.skeleton,
        { width, height, borderRadius, opacity },
        style,
      ]}
      accessible={true}
      accessibilityLabel="Loading"
      accessibilityRole="progressbar"
    />
  );
}

/**
 * Skeleton for text content
 */
export function SkeletonText({
  lines = 1,
  lineHeight = 16,
  spacing = 8,
  lastLineWidth = '60%',
}: {
  lines?: number;
  lineHeight?: number;
  spacing?: number;
  lastLineWidth?: DimensionValue;
}) {
  return (
    <View>
      {Array.from({ length: lines }).map((_, index) => (
        <Skeleton
          key={index}
          height={lineHeight}
          width={index === lines - 1 && lines > 1 ? lastLineWidth : '100%'}
          style={{ marginBottom: index < lines - 1 ? spacing : 0 }}
        />
      ))}
    </View>
  );
}

/**
 * Skeleton for circular avatars
 */
export function SkeletonAvatar({
  size = 40,
}: {
  size?: number;
}) {
  return (
    <Skeleton
      width={size}
      height={size}
      borderRadius={size / 2}
    />
  );
}

/**
 * Skeleton for message bubbles in chat
 */
export function SkeletonMessage({
  isUser = false,
}: {
  isUser?: boolean;
}) {
  return (
    <View
      style={[
        styles.messageSkeleton,
        isUser ? styles.userMessage : styles.assistantMessage,
      ]}
    >
      <Skeleton width="80%" height={16} style={{ marginBottom: 8 }} />
      <Skeleton width="60%" height={16} />
    </View>
  );
}

/**
 * Skeleton for the chat screen
 */
export function ChatSkeleton() {
  return (
    <View style={styles.chatContainer}>
      {/* Mode selector skeleton */}
      <View style={styles.modeSelector}>
        {[1, 2, 3, 4].map(i => (
          <Skeleton key={i} width={60} height={40} borderRadius={8} />
        ))}
      </View>

      {/* Messages skeleton */}
      <View style={styles.messagesContainer}>
        <SkeletonMessage isUser={false} />
        <SkeletonMessage isUser={true} />
        <SkeletonMessage isUser={false} />
      </View>

      {/* Input skeleton */}
      <View style={styles.inputSkeleton}>
        <Skeleton height={44} borderRadius={22} style={{ flex: 1 }} />
        <Skeleton width={60} height={44} borderRadius={22} style={{ marginLeft: 8 }} />
      </View>
    </View>
  );
}

/**
 * Skeleton for the home screen
 */
export function HomeSkeleton() {
  return (
    <View style={styles.homeContainer}>
      {/* XP bar skeleton */}
      <View style={styles.xpBarSkeleton}>
        <Skeleton height={48} borderRadius={12} />
      </View>

      {/* Stats cards skeleton */}
      <View style={styles.statsGrid}>
        {[1, 2].map(i => (
          <Skeleton key={i} width="48%" height={100} borderRadius={12} />
        ))}
      </View>

      {/* Quick actions skeleton */}
      <View style={styles.quickActions}>
        <Skeleton height={24} width={120} style={{ marginBottom: 12 }} />
        <View style={styles.actionButtons}>
          {[1, 2].map(i => (
            <Skeleton key={i} width="48%" height={80} borderRadius={12} />
          ))}
        </View>
      </View>

      {/* Challenges skeleton */}
      <View style={styles.challenges}>
        <Skeleton height={24} width={150} style={{ marginBottom: 12 }} />
        <Skeleton height={80} borderRadius={12} style={{ marginBottom: 8 }} />
        <Skeleton height={80} borderRadius={12} />
      </View>
    </View>
  );
}

/**
 * Skeleton for profile screen
 */
export function ProfileSkeleton() {
  return (
    <View style={styles.profileContainer}>
      {/* Header skeleton */}
      <View style={styles.profileHeader}>
        <SkeletonAvatar size={80} />
        <Skeleton width={150} height={24} style={{ marginTop: 16 }} />
        <Skeleton width={100} height={16} style={{ marginTop: 8 }} />
      </View>

      {/* Stats skeleton */}
      <View style={styles.profileStats}>
        {[1, 2, 3].map(i => (
          <View key={i} style={styles.statItem}>
            <Skeleton width={40} height={24} />
            <Skeleton width={60} height={14} style={{ marginTop: 4 }} />
          </View>
        ))}
      </View>

      {/* Badges skeleton */}
      <View style={styles.badgesSkeleton}>
        <Skeleton height={24} width={100} style={{ marginBottom: 12 }} />
        <View style={styles.badgesGrid}>
          {[1, 2, 3, 4, 5, 6].map(i => (
            <Skeleton key={i} width={60} height={60} borderRadius={30} />
          ))}
        </View>
      </View>
    </View>
  );
}

/**
 * Generic card skeleton
 */
export function CardSkeleton({
  showAvatar = false,
  lines = 2,
}: {
  showAvatar?: boolean;
  lines?: number;
}) {
  return (
    <View style={styles.card}>
      {showAvatar && (
        <View style={styles.cardHeader}>
          <SkeletonAvatar size={40} />
          <View style={styles.cardHeaderText}>
            <Skeleton width={120} height={16} style={{ marginBottom: 4 }} />
            <Skeleton width={80} height={12} />
          </View>
        </View>
      )}
      <SkeletonText lines={lines} />
    </View>
  );
}

const styles = StyleSheet.create({
  skeleton: {
    backgroundColor: '#E5E7EB',
  },
  messageSkeleton: {
    maxWidth: '80%',
    padding: 12,
    borderRadius: 16,
    marginBottom: 8,
    backgroundColor: '#F3F4F6',
  },
  userMessage: {
    alignSelf: 'flex-end',
    backgroundColor: '#E0E7FF',
  },
  assistantMessage: {
    alignSelf: 'flex-start',
  },
  chatContainer: {
    flex: 1,
    padding: 16,
  },
  modeSelector: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 16,
  },
  messagesContainer: {
    flex: 1,
    paddingTop: 16,
  },
  inputSkeleton: {
    flexDirection: 'row',
    paddingTop: 16,
  },
  homeContainer: {
    flex: 1,
    padding: 16,
  },
  xpBarSkeleton: {
    marginBottom: 16,
  },
  statsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 24,
  },
  quickActions: {
    marginBottom: 24,
  },
  actionButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  challenges: {
    marginBottom: 16,
  },
  profileContainer: {
    flex: 1,
    padding: 16,
  },
  profileHeader: {
    alignItems: 'center',
    marginBottom: 24,
  },
  profileStats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 24,
    padding: 16,
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
  },
  statItem: {
    alignItems: 'center',
  },
  badgesSkeleton: {
    marginBottom: 16,
  },
  badgesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
    justifyContent: 'center',
  },
  card: {
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
  },
  cardHeader: {
    flexDirection: 'row',
    marginBottom: 12,
  },
  cardHeaderText: {
    marginLeft: 12,
    flex: 1,
  },
});

export default Skeleton;
