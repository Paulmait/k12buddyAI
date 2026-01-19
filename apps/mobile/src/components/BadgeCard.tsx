import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
} from 'react-native';

type BadgeRarity = 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary';

interface Badge {
  id: string;
  code: string;
  name: string;
  description: string;
  icon: string;
  rarity: BadgeRarity;
  earned_at?: string;
}

interface BadgeCardProps {
  badge: Badge;
  earned?: boolean;
  size?: 'small' | 'medium' | 'large';
  onPress?: () => void;
}

const RARITY_COLORS: Record<BadgeRarity, { bg: string; border: string; text: string }> = {
  common: { bg: '#F3F4F6', border: '#D1D5DB', text: '#6B7280' },
  uncommon: { bg: '#ECFDF5', border: '#10B981', text: '#059669' },
  rare: { bg: '#EEF2FF', border: '#6366F1', text: '#4F46E5' },
  epic: { bg: '#FDF4FF', border: '#A855F7', text: '#9333EA' },
  legendary: { bg: '#FFFBEB', border: '#F59E0B', text: '#D97706' },
};

export function BadgeCard({
  badge,
  earned = true,
  size = 'medium',
  onPress,
}: BadgeCardProps) {
  const colors = RARITY_COLORS[badge.rarity];

  const containerStyles = [
    styles.container,
    size === 'small' && styles.containerSmall,
    size === 'large' && styles.containerLarge,
    {
      backgroundColor: earned ? colors.bg : '#F9FAFB',
      borderColor: earned ? colors.border : '#E5E7EB',
    },
    !earned && styles.locked,
  ];

  const Content = (
    <>
      <View style={[
        styles.iconContainer,
        size === 'small' && styles.iconContainerSmall,
        size === 'large' && styles.iconContainerLarge,
      ]}>
        <Text style={[
          styles.icon,
          size === 'small' && styles.iconSmall,
          size === 'large' && styles.iconLarge,
          !earned && styles.iconLocked,
        ]}>
          {earned ? badge.icon : '🔒'}
        </Text>
      </View>

      <Text
        style={[
          styles.name,
          size === 'small' && styles.nameSmall,
          size === 'large' && styles.nameLarge,
          { color: earned ? colors.text : '#9CA3AF' },
        ]}
        numberOfLines={size === 'small' ? 1 : 2}
      >
        {badge.name}
      </Text>

      {size !== 'small' && (
        <Text
          style={[
            styles.description,
            size === 'large' && styles.descriptionLarge,
            !earned && styles.descriptionLocked,
          ]}
          numberOfLines={2}
        >
          {badge.description}
        </Text>
      )}

      {size === 'large' && (
        <View style={[styles.rarityBadge, { backgroundColor: colors.border }]}>
          <Text style={styles.rarityText}>
            {badge.rarity.charAt(0).toUpperCase() + badge.rarity.slice(1)}
          </Text>
        </View>
      )}

      {earned && badge.earned_at && size !== 'small' && (
        <Text style={styles.earnedDate}>
          Earned {new Date(badge.earned_at).toLocaleDateString()}
        </Text>
      )}
    </>
  );

  if (onPress) {
    return (
      <TouchableOpacity style={containerStyles} onPress={onPress} activeOpacity={0.7}>
        {Content}
      </TouchableOpacity>
    );
  }

  return <View style={containerStyles}>{Content}</View>;
}

// Grid component for displaying multiple badges
interface BadgeGridProps {
  badges: Badge[];
  earnedBadgeIds?: Set<string>;
  onBadgePress?: (badge: Badge) => void;
  columns?: number;
}

export function BadgeGrid({
  badges,
  earnedBadgeIds = new Set(),
  onBadgePress,
  columns = 3,
}: BadgeGridProps) {
  return (
    <View style={[styles.grid, { gap: 12 }]}>
      {badges.map((badge) => (
        <View key={badge.id} style={{ width: `${100 / columns - 2}%` }}>
          <BadgeCard
            badge={badge}
            earned={earnedBadgeIds.has(badge.id)}
            size="small"
            onPress={onBadgePress ? () => onBadgePress(badge) : undefined}
          />
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: 12,
    borderWidth: 2,
    padding: 12,
    alignItems: 'center',
  },
  containerSmall: {
    padding: 8,
  },
  containerLarge: {
    padding: 20,
  },
  locked: {
    opacity: 0.6,
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(255, 255, 255, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  iconContainerSmall: {
    width: 36,
    height: 36,
    borderRadius: 18,
    marginBottom: 4,
  },
  iconContainerLarge: {
    width: 64,
    height: 64,
    borderRadius: 32,
    marginBottom: 12,
  },
  icon: {
    fontSize: 24,
  },
  iconSmall: {
    fontSize: 18,
  },
  iconLarge: {
    fontSize: 32,
  },
  iconLocked: {
    opacity: 0.5,
  },
  name: {
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 4,
  },
  nameSmall: {
    fontSize: 11,
    marginBottom: 0,
  },
  nameLarge: {
    fontSize: 18,
    marginBottom: 8,
  },
  description: {
    fontSize: 12,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 16,
  },
  descriptionLarge: {
    fontSize: 14,
    lineHeight: 20,
  },
  descriptionLocked: {
    color: '#9CA3AF',
  },
  rarityBadge: {
    marginTop: 12,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  rarityText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#fff',
    textTransform: 'uppercase',
  },
  earnedDate: {
    marginTop: 8,
    fontSize: 11,
    color: '#9CA3AF',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
});

export default BadgeCard;
