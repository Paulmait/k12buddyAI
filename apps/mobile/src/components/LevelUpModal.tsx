import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  Animated,
  TouchableOpacity,
  Dimensions,
} from 'react-native';

interface LevelUpModalProps {
  visible: boolean;
  level: number;
  title: string;
  icon: string;
  xpBonus?: number;
  onClose: () => void;
}

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export function LevelUpModal({
  visible,
  level,
  title,
  icon,
  xpBonus = 50,
  onClose,
}: LevelUpModalProps) {
  const scaleAnim = useRef(new Animated.Value(0)).current;
  const rotateAnim = useRef(new Animated.Value(0)).current;
  const starAnim = useRef(new Animated.Value(0)).current;
  const confettiAnims = useRef(
    Array.from({ length: 12 }, () => ({
      x: new Animated.Value(0),
      y: new Animated.Value(0),
      opacity: new Animated.Value(1),
    }))
  ).current;

  useEffect(() => {
    if (visible) {
      // Reset animations
      scaleAnim.setValue(0);
      rotateAnim.setValue(0);
      starAnim.setValue(0);

      // Main card animation
      Animated.spring(scaleAnim, {
        toValue: 1,
        tension: 50,
        friction: 7,
        useNativeDriver: true,
      }).start();

      // Icon rotation
      Animated.loop(
        Animated.timing(rotateAnim, {
          toValue: 1,
          duration: 3000,
          useNativeDriver: true,
        })
      ).start();

      // Star burst
      Animated.timing(starAnim, {
        toValue: 1,
        duration: 500,
        useNativeDriver: true,
      }).start();

      // Confetti animation
      confettiAnims.forEach((anim, index) => {
        const angle = (index / 12) * Math.PI * 2;
        const distance = 150 + Math.random() * 100;

        Animated.parallel([
          Animated.timing(anim.x, {
            toValue: Math.cos(angle) * distance,
            duration: 1000,
            useNativeDriver: true,
          }),
          Animated.timing(anim.y, {
            toValue: Math.sin(angle) * distance + 100,
            duration: 1000,
            useNativeDriver: true,
          }),
          Animated.sequence([
            Animated.delay(500),
            Animated.timing(anim.opacity, {
              toValue: 0,
              duration: 500,
              useNativeDriver: true,
            }),
          ]),
        ]).start();
      });
    }
  }, [visible]);

  const rotate = rotateAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  const starScale = starAnim.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [0, 1.2, 1],
  });

  const confettiColors = ['#4F46E5', '#10B981', '#F59E0B', '#EF4444', '#EC4899', '#8B5CF6'];

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        {/* Confetti particles */}
        {confettiAnims.map((anim, index) => (
          <Animated.View
            key={index}
            style={[
              styles.confetti,
              {
                backgroundColor: confettiColors[index % confettiColors.length],
                transform: [
                  { translateX: anim.x },
                  { translateY: anim.y },
                ],
                opacity: anim.opacity,
              },
            ]}
          />
        ))}

        <Animated.View
          style={[
            styles.card,
            {
              transform: [{ scale: scaleAnim }],
            },
          ]}
        >
          {/* Star burst behind icon */}
          <Animated.View
            style={[
              styles.starBurst,
              {
                transform: [
                  { scale: starScale },
                  { rotate },
                ],
              },
            ]}
          >
            {[...Array(8)].map((_, i) => (
              <View
                key={i}
                style={[
                  styles.ray,
                  { transform: [{ rotate: `${i * 45}deg` }] },
                ]}
              />
            ))}
          </Animated.View>

          <View style={styles.iconContainer}>
            <Text style={styles.icon}>{icon}</Text>
          </View>

          <Text style={styles.levelUp}>LEVEL UP!</Text>
          <Text style={styles.level}>Level {level}</Text>
          <Text style={styles.title}>{title}</Text>

          <View style={styles.bonusContainer}>
            <Text style={styles.bonusLabel}>Bonus XP</Text>
            <Text style={styles.bonusAmount}>+{xpBonus} XP</Text>
          </View>

          <TouchableOpacity style={styles.button} onPress={onClose}>
            <Text style={styles.buttonText}>Awesome!</Text>
          </TouchableOpacity>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  card: {
    width: SCREEN_WIDTH * 0.85,
    backgroundColor: '#fff',
    borderRadius: 24,
    padding: 32,
    alignItems: 'center',
    overflow: 'hidden',
  },
  starBurst: {
    position: 'absolute',
    top: 40,
    width: 200,
    height: 200,
    justifyContent: 'center',
    alignItems: 'center',
  },
  ray: {
    position: 'absolute',
    width: 4,
    height: 80,
    backgroundColor: '#FEF3C7',
    borderRadius: 2,
  },
  iconContainer: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: '#FEF3C7',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
    shadowColor: '#F59E0B',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
    zIndex: 1,
  },
  icon: {
    fontSize: 48,
  },
  levelUp: {
    fontSize: 14,
    fontWeight: '700',
    color: '#F59E0B',
    letterSpacing: 2,
    marginBottom: 8,
  },
  level: {
    fontSize: 36,
    fontWeight: '800',
    color: '#1F2937',
    marginBottom: 4,
  },
  title: {
    fontSize: 20,
    fontWeight: '600',
    color: '#4F46E5',
    marginBottom: 24,
  },
  bonusContainer: {
    backgroundColor: '#F0FDF4',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 24,
    marginBottom: 24,
    alignItems: 'center',
  },
  bonusLabel: {
    fontSize: 12,
    color: '#6B7280',
    marginBottom: 4,
  },
  bonusAmount: {
    fontSize: 24,
    fontWeight: '700',
    color: '#10B981',
  },
  button: {
    backgroundColor: '#4F46E5',
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 48,
    shadowColor: '#4F46E5',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  buttonText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#fff',
  },
  confetti: {
    position: 'absolute',
    width: 12,
    height: 12,
    borderRadius: 3,
    top: '50%',
    left: '50%',
  },
});

export default LevelUpModal;
