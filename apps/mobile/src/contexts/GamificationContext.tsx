import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { getStudentProfile, getCurrentUser } from '../lib/supabase';
import {
  getGamificationStats,
  awardXP,
  updateStreak,
  checkBadges,
  type GamificationStats,
  type AwardXPResult,
} from '../lib/api';

interface Badge {
  id: string;
  code: string;
  name: string;
  description: string;
  icon: string;
  rarity: 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary';
  earned_at: string;
}

interface Challenge {
  id: string;
  title: string;
  description: string;
  type: 'daily' | 'weekly' | 'special';
  criteria: { action: string; count: number };
  xp_reward: number;
  progress: number;
  completed: boolean;
}

interface LevelUpEvent {
  newLevel: number;
  title: string;
  icon: string;
  xpBonus: number;
}

interface GamificationContextType {
  // State
  isLoading: boolean;
  studentId: string | null;
  xp: {
    total: number;
    level: number;
    xpToNextLevel: number;
    levelTitle: string;
    levelIcon: string;
  };
  streak: {
    current: number;
    longest: number;
    lastActivity: string | null;
  };
  badges: Badge[];
  challenges: Challenge[];
  recentXP: Array<{ xp_amount: number; source: string; description: string; created_at: string }>;

  // Level up modal state
  levelUpEvent: LevelUpEvent | null;
  dismissLevelUp: () => void;

  // Actions
  refreshStats: () => Promise<void>;
  recordChatMessage: () => Promise<AwardXPResult | null>;
  recordScan: () => Promise<AwardXPResult | null>;
}

const GamificationContext = createContext<GamificationContextType | undefined>(undefined);

export function GamificationProvider({ children }: { children: React.ReactNode }) {
  const [isLoading, setIsLoading] = useState(true);
  const [studentId, setStudentId] = useState<string | null>(null);
  const [stats, setStats] = useState<GamificationStats | null>(null);
  const [levelUpEvent, setLevelUpEvent] = useState<LevelUpEvent | null>(null);

  // Initialize and load stats
  useEffect(() => {
    loadInitialStats();
  }, []);

  async function loadInitialStats() {
    try {
      setIsLoading(true);
      const user = await getCurrentUser();
      if (!user) return;

      const profile = await getStudentProfile(user.id);
      setStudentId(profile.id);

      const gamificationStats = await getGamificationStats(profile.id);
      setStats(gamificationStats);

      // Update streak on app open
      await updateStreak(profile.id);
    } catch (error) {
      console.error('Error loading gamification stats:', error);
    } finally {
      setIsLoading(false);
    }
  }

  const refreshStats = useCallback(async () => {
    if (!studentId) return;

    try {
      const gamificationStats = await getGamificationStats(studentId);
      setStats(gamificationStats);
    } catch (error) {
      console.error('Error refreshing stats:', error);
    }
  }, [studentId]);

  const handleXPResult = useCallback(async (result: AwardXPResult) => {
    // Check for level up
    if (result.leveled_up && result.new_level) {
      // Get level info for the modal
      const newStats = await getGamificationStats(studentId!);
      setStats(newStats);

      setLevelUpEvent({
        newLevel: result.new_level,
        title: newStats.xp.level_title,
        icon: newStats.xp.level_icon,
        xpBonus: 50,
      });
    } else {
      // Just update XP stats
      setStats(prev => prev ? {
        ...prev,
        xp: {
          ...prev.xp,
          total: result.total_xp,
          level: result.current_level,
          xp_to_next_level: result.xp_to_next_level,
        },
      } : null);
    }

    // Check for new badges
    if (studentId) {
      const badgeResult = await checkBadges(studentId);
      if (badgeResult.badges_earned > 0) {
        // Refresh full stats to get new badges
        await refreshStats();
      }
    }
  }, [studentId, refreshStats]);

  const recordChatMessage = useCallback(async () => {
    if (!studentId) return null;

    try {
      const result = await awardXP(studentId, 'chat');
      await handleXPResult(result);
      return result;
    } catch (error) {
      console.error('Error recording chat message:', error);
      return null;
    }
  }, [studentId, handleXPResult]);

  const recordScan = useCallback(async () => {
    if (!studentId) return null;

    try {
      const result = await awardXP(studentId, 'scan');
      await handleXPResult(result);
      return result;
    } catch (error) {
      console.error('Error recording scan:', error);
      return null;
    }
  }, [studentId, handleXPResult]);

  const dismissLevelUp = useCallback(() => {
    setLevelUpEvent(null);
  }, []);

  const value: GamificationContextType = {
    isLoading,
    studentId,
    xp: {
      total: stats?.xp.total ?? 0,
      level: stats?.xp.level ?? 1,
      xpToNextLevel: stats?.xp.xp_to_next_level ?? 100,
      levelTitle: stats?.xp.level_title ?? 'Curious Learner',
      levelIcon: stats?.xp.level_icon ?? '🌱',
    },
    streak: {
      current: stats?.streak.current ?? 0,
      longest: stats?.streak.longest ?? 0,
      lastActivity: stats?.streak.last_activity ?? null,
    },
    badges: stats?.badges ?? [],
    challenges: stats?.challenges ?? [],
    recentXP: stats?.recent_xp ?? [],
    levelUpEvent,
    dismissLevelUp,
    refreshStats,
    recordChatMessage,
    recordScan,
  };

  return (
    <GamificationContext.Provider value={value}>
      {children}
    </GamificationContext.Provider>
  );
}

export function useGamification() {
  const context = useContext(GamificationContext);
  if (context === undefined) {
    throw new Error('useGamification must be used within a GamificationProvider');
  }
  return context;
}

export default GamificationContext;
