import { Audio } from 'expo-av';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const SOUNDS_ENABLED_KEY = 'k12buddy_sounds_enabled';
const SOUNDS_VOLUME_KEY = 'k12buddy_sounds_volume';

let soundsEnabled = true;
let soundsVolume = 0.7; // 0.0 to 1.0

// Sound cache to avoid reloading
const soundCache: Map<string, Audio.Sound> = new Map();

// Sound types available in the app
export type SoundType =
  | 'tap'
  | 'success'
  | 'error'
  | 'notification'
  | 'levelUp'
  | 'badgeEarned'
  | 'messageSent'
  | 'messageReceived'
  | 'xpEarned'
  | 'streak';

// Sound file paths (you'll need to add actual sound files)
// For now, we'll use placeholder logic that can be implemented when sound files are available
const soundFiles: Record<SoundType, number | null> = {
  tap: null, // require('../assets/sounds/tap.mp3'),
  success: null, // require('../assets/sounds/success.mp3'),
  error: null, // require('../assets/sounds/error.mp3'),
  notification: null, // require('../assets/sounds/notification.mp3'),
  levelUp: null, // require('../assets/sounds/level-up.mp3'),
  badgeEarned: null, // require('../assets/sounds/badge.mp3'),
  messageSent: null, // require('../assets/sounds/sent.mp3'),
  messageReceived: null, // require('../assets/sounds/received.mp3'),
  xpEarned: null, // require('../assets/sounds/xp.mp3'),
  streak: null, // require('../assets/sounds/streak.mp3'),
};

// Initialize audio settings
export async function initSounds(): Promise<void> {
  try {
    // Load preferences
    const enabledStored = await AsyncStorage.getItem(SOUNDS_ENABLED_KEY);
    soundsEnabled = enabledStored !== 'false';

    const volumeStored = await AsyncStorage.getItem(SOUNDS_VOLUME_KEY);
    if (volumeStored) {
      soundsVolume = parseFloat(volumeStored);
    }

    // Configure audio mode for background audio to not interrupt
    await Audio.setAudioModeAsync({
      playsInSilentModeIOS: false,
      staysActiveInBackground: false,
      shouldDuckAndroid: true,
    });
  } catch (error) {
    console.error('Error initializing sounds:', error);
  }
}

// Check if sounds are enabled
export function isSoundsEnabled(): boolean {
  return soundsEnabled;
}

// Toggle sounds
export async function setSoundsEnabled(enabled: boolean): Promise<void> {
  soundsEnabled = enabled;
  try {
    await AsyncStorage.setItem(SOUNDS_ENABLED_KEY, String(enabled));
  } catch (error) {
    console.error('Error saving sounds preference:', error);
  }
}

// Get current volume
export function getSoundsVolume(): number {
  return soundsVolume;
}

// Set volume (0.0 to 1.0)
export async function setSoundsVolume(volume: number): Promise<void> {
  soundsVolume = Math.max(0, Math.min(1, volume));
  try {
    await AsyncStorage.setItem(SOUNDS_VOLUME_KEY, String(soundsVolume));
  } catch (error) {
    console.error('Error saving sounds volume:', error);
  }
}

// Play a sound
export async function playSound(type: SoundType): Promise<void> {
  if (!soundsEnabled || Platform.OS === 'web') return;

  const soundFile = soundFiles[type];
  if (!soundFile) {
    // Sound file not available yet - this is expected during development
    console.debug(`Sound file for '${type}' not available`);
    return;
  }

  try {
    // Check cache first
    let sound = soundCache.get(type);

    if (!sound) {
      // Load the sound
      const { sound: loadedSound } = await Audio.Sound.createAsync(soundFile);
      sound = loadedSound;
      soundCache.set(type, sound);
    }

    // Set volume and play
    await sound.setVolumeAsync(soundsVolume);
    await sound.setPositionAsync(0);
    await sound.playAsync();
  } catch (error) {
    console.error(`Error playing sound '${type}':`, error);
  }
}

// Unload all cached sounds (call on app cleanup)
export async function unloadSounds(): Promise<void> {
  for (const [, sound] of soundCache) {
    try {
      await sound.unloadAsync();
    } catch (error) {
      // Ignore unload errors
    }
  }
  soundCache.clear();
}

// Semantic sound effects for app actions
export const AppSounds = {
  // UI interactions
  tap: () => playSound('tap'),

  // Learning actions
  messageSent: () => playSound('messageSent'),
  messageReceived: () => playSound('messageReceived'),
  correctAnswer: () => playSound('success'),
  incorrectAnswer: () => playSound('error'),

  // Achievements
  xpEarned: () => playSound('xpEarned'),
  badgeEarned: () => playSound('badgeEarned'),
  levelUp: () => playSound('levelUp'),
  streakContinued: () => playSound('streak'),

  // Notifications
  notification: () => playSound('notification'),

  // General feedback
  success: () => playSound('success'),
  error: () => playSound('error'),
};

export default AppSounds;
