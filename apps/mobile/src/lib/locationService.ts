/**
 * Location Service
 * COPPA-compliant approximate location for K12Buddy
 * Only captures city-level location, no precise GPS coordinates
 */

import * as Location from 'expo-location';
import { Alert, Linking, Platform } from 'react-native';
import { supabase } from './supabase';
import { updateDeviceLocation } from './deviceRegistration';

// Approximate location interface (city-level only)
export interface ApproximateLocation {
  city?: string;
  region?: string; // State/Province
  country?: string;
  timezone?: string;
}

// Location consent status
export type LocationConsentStatus = 'granted' | 'denied' | 'undetermined';

/**
 * Check current location permission status
 */
export async function getLocationPermissionStatus(): Promise<LocationConsentStatus> {
  try {
    const { status } = await Location.getForegroundPermissionsAsync();

    switch (status) {
      case Location.PermissionStatus.GRANTED:
        return 'granted';
      case Location.PermissionStatus.DENIED:
        return 'denied';
      default:
        return 'undetermined';
    }
  } catch {
    return 'undetermined';
  }
}

/**
 * Request location permission with explanation
 */
export async function requestLocationConsent(): Promise<boolean> {
  try {
    // Check current status first
    const currentStatus = await getLocationPermissionStatus();

    if (currentStatus === 'granted') {
      return true;
    }

    if (currentStatus === 'denied') {
      // Permission was previously denied, need to open settings
      Alert.alert(
        'Location Permission',
        'Location access was previously denied. To enable it, please go to Settings and allow location access for K12Buddy.',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Open Settings',
            onPress: () => {
              if (Platform.OS === 'ios') {
                Linking.openURL('app-settings:');
              } else {
                Linking.openSettings();
              }
            }
          },
        ]
      );
      return false;
    }

    // Request permission
    const { status } = await Location.requestForegroundPermissionsAsync();
    return status === Location.PermissionStatus.GRANTED;
  } catch (error) {
    console.error('Location consent request error:', error);
    return false;
  }
}

/**
 * Get approximate location (city-level only)
 * Does NOT return precise coordinates - COPPA compliant
 */
export async function getApproximateLocation(): Promise<ApproximateLocation | null> {
  try {
    const hasPermission = await requestLocationConsent();
    if (!hasPermission) {
      return null;
    }

    // Get coarse location (low accuracy is intentional for privacy)
    const location = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.Low, // City-level accuracy
    });

    // Reverse geocode to get city/region
    const [geocode] = await Location.reverseGeocodeAsync({
      latitude: location.coords.latitude,
      longitude: location.coords.longitude,
    });

    if (!geocode) {
      return null;
    }

    // Get timezone
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

    // Return only city-level info, NO coordinates
    return {
      city: geocode.city || geocode.subregion || undefined,
      region: geocode.region || undefined,
      country: geocode.country || undefined,
      timezone,
    };
  } catch (error) {
    console.error('Get approximate location error:', error);
    return null;
  }
}

/**
 * Save location consent to user profile
 */
export async function saveLocationConsent(consent: boolean): Promise<boolean> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return false;

    const { error } = await supabase
      .from('profiles')
      .update({
        location_consent: consent,
        updated_at: new Date().toISOString(),
      })
      .eq('id', user.id);

    if (error) {
      console.error('Save location consent error:', error);
      return false;
    }

    return true;
  } catch (error) {
    console.error('Save location consent exception:', error);
    return false;
  }
}

/**
 * Update user's device with approximate location
 */
export async function updateUserLocation(): Promise<boolean> {
  try {
    const location = await getApproximateLocation();

    if (!location) {
      // Clear location if permission denied
      await updateDeviceLocation(null, false);
      return false;
    }

    // Update device with location
    await updateDeviceLocation(location, true);

    // Also save consent to profile
    await saveLocationConsent(true);

    return true;
  } catch (error) {
    console.error('Update user location error:', error);
    return false;
  }
}

/**
 * Revoke location consent and clear stored location
 */
export async function revokeLocationConsent(): Promise<boolean> {
  try {
    // Clear device location
    await updateDeviceLocation(null, false);

    // Update profile consent
    await saveLocationConsent(false);

    return true;
  } catch (error) {
    console.error('Revoke location consent error:', error);
    return false;
  }
}

/**
 * Get user's stored location consent status from profile
 */
export async function getStoredLocationConsent(): Promise<boolean> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return false;

    const { data, error } = await supabase
      .from('profiles')
      .select('location_consent')
      .eq('id', user.id)
      .single();

    if (error) return false;
    return data?.location_consent ?? false;
  } catch {
    return false;
  }
}

/**
 * Check if we should ask for location consent
 * (only ask if not previously denied and profile doesn't have consent recorded)
 */
export async function shouldAskForLocationConsent(): Promise<boolean> {
  try {
    const permissionStatus = await getLocationPermissionStatus();
    const storedConsent = await getStoredLocationConsent();

    // Don't ask if already granted and stored
    if (permissionStatus === 'granted' && storedConsent) {
      return false;
    }

    // Don't ask if previously denied (user made a choice)
    if (permissionStatus === 'denied') {
      return false;
    }

    // Ask if undetermined or granted but not stored
    return permissionStatus === 'undetermined';
  } catch {
    return false;
  }
}

/**
 * Get timezone without location permission
 * This is always available and doesn't require permission
 */
export function getTimezone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone;
}

/**
 * Format location for display
 */
export function formatLocationDisplay(location: ApproximateLocation | null): string {
  if (!location) {
    return 'Location not available';
  }

  const parts: string[] = [];

  if (location.city) parts.push(location.city);
  if (location.region) parts.push(location.region);
  if (location.country && parts.length === 0) parts.push(location.country);

  return parts.length > 0 ? parts.join(', ') : 'Unknown location';
}

export default {
  getLocationPermissionStatus,
  requestLocationConsent,
  getApproximateLocation,
  saveLocationConsent,
  updateUserLocation,
  revokeLocationConsent,
  getStoredLocationConsent,
  shouldAskForLocationConsent,
  getTimezone,
  formatLocationDisplay,
};
