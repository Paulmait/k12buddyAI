import { useState, useEffect, useRef } from 'react';
import { Platform, Alert } from 'react-native';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import { supabase } from '../lib/supabase';

// Configure notification handling
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

interface PushNotificationState {
  expoPushToken: string | null;
  notification: Notifications.Notification | null;
  permissionStatus: Notifications.PermissionStatus | null;
}

export function usePushNotifications(userId: string | null) {
  const [state, setState] = useState<PushNotificationState>({
    expoPushToken: null,
    notification: null,
    permissionStatus: null,
  });

  const notificationListener = useRef<Notifications.Subscription>();
  const responseListener = useRef<Notifications.Subscription>();

  useEffect(() => {
    // Register for push notifications
    registerForPushNotifications().then(token => {
      if (token) {
        setState(prev => ({ ...prev, expoPushToken: token }));
        // Save token to backend
        if (userId) {
          savePushToken(userId, token);
        }
      }
    });

    // Listen for incoming notifications while app is foregrounded
    notificationListener.current = Notifications.addNotificationReceivedListener(notification => {
      setState(prev => ({ ...prev, notification }));
    });

    // Listen for notification responses (taps)
    responseListener.current = Notifications.addNotificationResponseReceivedListener(response => {
      const data = response.notification.request.content.data;
      handleNotificationResponse(data);
    });

    return () => {
      if (notificationListener.current) {
        Notifications.removeNotificationSubscription(notificationListener.current);
      }
      if (responseListener.current) {
        Notifications.removeNotificationSubscription(responseListener.current);
      }
    };
  }, [userId]);

  return state;
}

async function registerForPushNotifications(): Promise<string | null> {
  let token: string | null = null;

  // Check if we're on a physical device
  if (!Device.isDevice) {
    console.log('Push notifications require a physical device');
    return null;
  }

  // Check Android notification channel
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'Default',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#4F46E5',
    });

    // Create streak reminder channel
    await Notifications.setNotificationChannelAsync('streak-reminders', {
      name: 'Streak Reminders',
      description: 'Reminders to maintain your study streak',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#F59E0B',
    });

    // Create badge earned channel
    await Notifications.setNotificationChannelAsync('badges', {
      name: 'Badge Notifications',
      description: 'Notifications when you earn new badges',
      importance: Notifications.AndroidImportance.HIGH,
      sound: 'default',
    });
  }

  // Check and request permissions
  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== 'granted') {
    console.log('Permission not granted for push notifications');
    return null;
  }

  // Get the Expo push token
  try {
    const projectId = Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;

    if (projectId) {
      const pushToken = await Notifications.getExpoPushTokenAsync({
        projectId,
      });
      token = pushToken.data;
    }
  } catch (error) {
    console.error('Error getting push token:', error);
  }

  return token;
}

async function savePushToken(userId: string, token: string) {
  try {
    const platform = Platform.OS;

    // Upsert the token
    const { error } = await supabase
      .from('push_tokens')
      .upsert(
        {
          user_id: userId,
          token,
          platform,
          active: true,
        },
        {
          onConflict: 'user_id,token',
        }
      );

    if (error) {
      console.error('Error saving push token:', error);
    }
  } catch (error) {
    console.error('Error saving push token:', error);
  }
}

function handleNotificationResponse(data: Record<string, unknown>) {
  // Handle different notification types
  const type = data?.type as string;

  switch (type) {
    case 'streak_reminder':
      // Navigate to home/chat screen
      console.log('Streak reminder tapped');
      break;
    case 'badge_earned':
      // Navigate to profile/badges
      console.log('Badge notification tapped:', data.badge_code);
      break;
    case 'challenge_complete':
      // Navigate to challenges
      console.log('Challenge notification tapped');
      break;
    default:
      console.log('Notification tapped:', data);
  }
}

// Utility to schedule a local notification
export async function scheduleStreakReminder(hour: number = 19, minute: number = 0) {
  await Notifications.cancelAllScheduledNotificationsAsync();

  await Notifications.scheduleNotificationAsync({
    content: {
      title: "Don't break your streak! 🔥",
      body: "You haven't studied today. Keep your streak going!",
      data: { type: 'streak_reminder' },
      sound: 'default',
    },
    trigger: {
      hour,
      minute,
      repeats: true,
    },
  });
}

// Utility to send a badge earned notification
export async function sendBadgeNotification(badgeName: string, badgeIcon: string) {
  await Notifications.scheduleNotificationAsync({
    content: {
      title: 'New Badge Earned! 🏆',
      body: `You earned the "${badgeName}" badge! ${badgeIcon}`,
      data: { type: 'badge_earned', badge_name: badgeName },
      sound: 'default',
    },
    trigger: null, // Send immediately
  });
}

// Utility to cancel streak reminders
export async function cancelStreakReminders() {
  const scheduled = await Notifications.getAllScheduledNotificationsAsync();
  for (const notification of scheduled) {
    if (notification.content.data?.type === 'streak_reminder') {
      await Notifications.cancelScheduledNotificationAsync(notification.identifier);
    }
  }
}

export default usePushNotifications;
