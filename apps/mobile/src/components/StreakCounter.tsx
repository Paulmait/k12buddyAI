import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
} from 'react-native';

interface StreakCounterProps {
  currentStreak: number;
  longestStreak: number;
  lastActivityDate?: string;
  compact?: boolean;
}

export function StreakCounter({
  currentStreak,
  longestStreak,
  lastActivityDate,
  compact = false,
}: StreakCounterProps) {
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const glowAnim = useRef(new Animated.Value(0)).current;

  // Check if streak is active (activity within last day)
  const isActive = (() => {
    if (!lastActivityDate) return false;
    const last = new Date(lastActivityDate);
    const today = new Date();
    const diffDays = Math.floor((today.getTime() - last.getTime()) / (1000 * 60 * 60 * 24));
    return diffDays <= 1;
  })();

  useEffect(() => {
    if (currentStreak > 0 && isActive) {
      // Pulsing animation for active streak
      Animated.loop(
        Animated.sequence([
          Animated.timing(scaleAnim, {
            toValue: 1.1,
            duration: 500,
            useNativeDriver: true,
          }),
          Animated.timing(scaleAnim, {
            toValue: 1,
            duration: 500,
            useNativeDriver: true,
          }),
        ])
      ).start();

      // Glow animation
      Animated.loop(
        Animated.sequence([
          Animated.timing(glowAnim, {
            toValue: 1,
            duration: 1000,
            useNativeDriver: false,
          }),
          Animated.timing(glowAnim, {
            toValue: 0,
            duration: 1000,
            useNativeDriver: false,
          }),
        ])
      ).start();
    }
  }, [currentStreak, isActive]);

  const getStreakEmoji = () => {
    if (currentStreak >= 100) return '👑';
    if (currentStreak >= 30) return '🌟';
    if (currentStreak >= 14) return '💪';
    if (currentStreak >= 7) return '⚡';
    if (currentStreak >= 3) return '🔥';
    if (currentStreak > 0) return '✨';
    return '💤';
  };

  const getStreakColor = () => {
    if (!isActive || currentStreak === 0) return '#9CA3AF';
    if (currentStreak >= 30) return '#F59E0B';
    if (currentStreak >= 7) return '#EF4444';
    return '#F97316';
  };

  const glowColor = glowAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['rgba(249, 115, 22, 0)', 'rgba(249, 115, 22, 0.3)'],
  });

  if (compact) {
    return (
      <View style={[styles.compactContainer, !isActive && styles.inactive]}>
        <Text style={styles.compactEmoji}>{getStreakEmoji()}</Text>
        <Text style={[styles.compactCount, { color: getStreakColor() }]}>
          {currentStreak}
        </Text>
        <Text style={styles.compactLabel}>day{currentStreak !== 1 ? 's' : ''}</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Animated.View
        style={[
          styles.emojiContainer,
          { transform: [{ scale: scaleAnim }] },
        ]}
      >
        <Animated.View
          style={[
            styles.glow,
            { backgroundColor: glowColor },
          ]}
        />
        <Text style={styles.emoji}>{getStreakEmoji()}</Text>
      </Animated.View>

      <View style={styles.info}>
        <View style={styles.countRow}>
          <Text style={[styles.count, { color: getStreakColor() }]}>
            {currentStreak}
          </Text>
          <Text style={styles.label}>
            day{currentStreak !== 1 ? 's' : ''} streak
          </Text>
        </View>

        {!isActive && currentStreak === 0 && (
          <Text style={styles.motivational}>Start studying to begin!</Text>
        )}

        {!isActive && currentStreak > 0 && (
          <Text style={styles.warning}>Study today to keep it going!</Text>
        )}

        {isActive && currentStreak > 0 && (
          <Text style={styles.success}>Keep it up!</Text>
        )}
      </View>

      <View style={styles.bestContainer}>
        <Text style={styles.bestLabel}>Best</Text>
        <Text style={styles.bestCount}>{longestStreak}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  emojiContainer: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#FEF3C7',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
    overflow: 'hidden',
  },
  glow: {
    position: 'absolute',
    width: '100%',
    height: '100%',
    borderRadius: 28,
  },
  emoji: {
    fontSize: 28,
  },
  info: {
    flex: 1,
  },
  countRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  count: {
    fontSize: 28,
    fontWeight: '700',
    marginRight: 6,
  },
  label: {
    fontSize: 16,
    color: '#6B7280',
  },
  motivational: {
    fontSize: 12,
    color: '#9CA3AF',
    marginTop: 2,
  },
  warning: {
    fontSize: 12,
    color: '#F59E0B',
    marginTop: 2,
  },
  success: {
    fontSize: 12,
    color: '#10B981',
    marginTop: 2,
  },
  bestContainer: {
    alignItems: 'center',
    paddingLeft: 12,
    borderLeftWidth: 1,
    borderLeftColor: '#E5E7EB',
  },
  bestLabel: {
    fontSize: 11,
    color: '#9CA3AF',
    textTransform: 'uppercase',
  },
  bestCount: {
    fontSize: 20,
    fontWeight: '700',
    color: '#4F46E5',
  },
  // Compact styles
  compactContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF3C7',
    borderRadius: 12,
    paddingVertical: 6,
    paddingHorizontal: 10,
  },
  inactive: {
    backgroundColor: '#F3F4F6',
  },
  compactEmoji: {
    fontSize: 18,
    marginRight: 4,
  },
  compactCount: {
    fontSize: 16,
    fontWeight: '700',
    marginRight: 2,
  },
  compactLabel: {
    fontSize: 12,
    color: '#6B7280',
  },
});

export default StreakCounter;
