import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
} from 'react-native';

interface XPBarProps {
  currentXP: number;
  xpToNextLevel: number;
  level: number;
  levelTitle: string;
  levelIcon: string;
  compact?: boolean;
}

export function XPBar({
  currentXP,
  xpToNextLevel,
  level,
  levelTitle,
  levelIcon,
  compact = false,
}: XPBarProps) {
  const animatedWidth = useRef(new Animated.Value(0)).current;

  // Calculate progress percentage
  const totalForLevel = currentXP + xpToNextLevel;
  const progress = totalForLevel > 0 ? (currentXP / totalForLevel) * 100 : 0;

  useEffect(() => {
    Animated.timing(animatedWidth, {
      toValue: progress,
      duration: 800,
      useNativeDriver: false,
    }).start();
  }, [progress]);

  const width = animatedWidth.interpolate({
    inputRange: [0, 100],
    outputRange: ['0%', '100%'],
  });

  if (compact) {
    return (
      <View style={styles.compactContainer}>
        <View style={styles.compactHeader}>
          <Text style={styles.compactIcon}>{levelIcon}</Text>
          <Text style={styles.compactLevel}>Lv. {level}</Text>
        </View>
        <View style={styles.compactBarContainer}>
          <Animated.View style={[styles.compactBar, { width }]} />
        </View>
        <Text style={styles.compactXP}>{currentXP} XP</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.levelInfo}>
          <Text style={styles.levelIcon}>{levelIcon}</Text>
          <View>
            <Text style={styles.levelTitle}>{levelTitle}</Text>
            <Text style={styles.levelNumber}>Level {level}</Text>
          </View>
        </View>
        <View style={styles.xpInfo}>
          <Text style={styles.xpText}>{currentXP.toLocaleString()} XP</Text>
          <Text style={styles.xpToNext}>{xpToNextLevel.toLocaleString()} to next</Text>
        </View>
      </View>

      <View style={styles.barContainer}>
        <Animated.View style={[styles.bar, { width }]} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  levelInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  levelIcon: {
    fontSize: 32,
    marginRight: 12,
  },
  levelTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
  },
  levelNumber: {
    fontSize: 13,
    color: '#6B7280',
  },
  xpInfo: {
    alignItems: 'flex-end',
  },
  xpText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#4F46E5',
  },
  xpToNext: {
    fontSize: 12,
    color: '#9CA3AF',
  },
  barContainer: {
    height: 12,
    backgroundColor: '#E5E7EB',
    borderRadius: 6,
    overflow: 'hidden',
  },
  bar: {
    height: '100%',
    backgroundColor: '#4F46E5',
    borderRadius: 6,
  },
  // Compact styles
  compactContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 12,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  compactHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 8,
  },
  compactIcon: {
    fontSize: 20,
    marginRight: 4,
  },
  compactLevel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1F2937',
  },
  compactBarContainer: {
    flex: 1,
    height: 8,
    backgroundColor: '#E5E7EB',
    borderRadius: 4,
    overflow: 'hidden',
    marginRight: 8,
  },
  compactBar: {
    height: '100%',
    backgroundColor: '#4F46E5',
    borderRadius: 4,
  },
  compactXP: {
    fontSize: 12,
    fontWeight: '600',
    color: '#4F46E5',
    minWidth: 50,
    textAlign: 'right',
  },
});

export default XPBar;
