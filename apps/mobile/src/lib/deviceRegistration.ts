/**
 * Device Registration Service
 * Handles device registration, tracking, and management for K12Buddy
 */

import * as Device from 'expo-device';
import * as Application from 'expo-application';
import { Platform } from 'react-native';
import { supabase } from './supabase';
import { getDeviceId } from './securityUtils';

// Device info interface
export interface DeviceInfo {
  device_id: string;
  device_model: string | null;
  device_brand: string | null;
  os_name: string;
  os_version: string | null;
  app_version: string | null;
  is_physical_device: boolean;
}

// Full device record from database
export interface DeviceRecord extends DeviceInfo {
  id: string;
  user_id: string;
  last_ip_address: string | null;
  approximate_location: {
    city?: string;
    region?: string;
    country?: string;
    timezone?: string;
  } | null;
  location_consent: boolean;
  browser_info: {
    name?: string;
    version?: string;
    user_agent?: string;
  } | null;
  first_seen_at: string;
  last_seen_at: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

/**
 * Get current device information
 */
export async function getDeviceInfo(): Promise<DeviceInfo> {
  const deviceId = await getDeviceId();

  return {
    device_id: deviceId,
    device_model: Device.modelName,
    device_brand: Device.brand,
    os_name: Platform.OS,
    os_version: Device.osVersion,
    app_version: Application.nativeApplicationVersion,
    is_physical_device: Device.isDevice,
  };
}

/**
 * Register current device for a user
 */
export async function registerDevice(userId: string): Promise<{ success: boolean; deviceId?: string; error?: string }> {
  try {
    const deviceInfo = await getDeviceInfo();

    // Upsert device (insert or update if exists)
    const { data, error } = await supabase
      .from('user_devices')
      .upsert(
        {
          user_id: userId,
          ...deviceInfo,
          last_seen_at: new Date().toISOString(),
          is_active: true,
        },
        {
          onConflict: 'user_id,device_id',
          ignoreDuplicates: false,
        }
      )
      .select('id')
      .single();

    if (error) {
      console.error('Device registration error:', error);
      return { success: false, error: error.message };
    }

    return { success: true, deviceId: data?.id };
  } catch (error) {
    console.error('Device registration exception:', error);
    return { success: false, error: 'Failed to register device' };
  }
}

/**
 * Update device activity (call periodically or on app foreground)
 */
export async function updateDeviceActivity(): Promise<boolean> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return false;

    const deviceId = await getDeviceId();
    const appVersion = Application.nativeApplicationVersion;

    const { error } = await supabase
      .from('user_devices')
      .update({
        last_seen_at: new Date().toISOString(),
        app_version: appVersion,
        is_active: true,
      })
      .eq('user_id', user.id)
      .eq('device_id', deviceId);

    if (error) {
      console.error('Device activity update error:', error);
      return false;
    }

    return true;
  } catch (error) {
    console.error('Device activity update exception:', error);
    return false;
  }
}

/**
 * Get all devices for current user
 */
export async function getUserDevices(): Promise<DeviceRecord[]> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return [];

    const { data, error } = await supabase
      .from('user_devices')
      .select('*')
      .eq('user_id', user.id)
      .order('last_seen_at', { ascending: false });

    if (error) {
      console.error('Get user devices error:', error);
      return [];
    }

    return data || [];
  } catch (error) {
    console.error('Get user devices exception:', error);
    return [];
  }
}

/**
 * Check if current device is registered
 */
export async function isDeviceRegistered(): Promise<boolean> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return false;

    const deviceId = await getDeviceId();

    const { data, error } = await supabase
      .from('user_devices')
      .select('id')
      .eq('user_id', user.id)
      .eq('device_id', deviceId)
      .single();

    if (error) return false;
    return !!data;
  } catch {
    return false;
  }
}

/**
 * Deactivate a device (soft delete)
 */
export async function deactivateDevice(deviceRecordId: string): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('user_devices')
      .update({
        is_active: false,
        updated_at: new Date().toISOString(),
      })
      .eq('id', deviceRecordId);

    if (error) {
      console.error('Deactivate device error:', error);
      return false;
    }

    return true;
  } catch (error) {
    console.error('Deactivate device exception:', error);
    return false;
  }
}

/**
 * Remove a device completely
 */
export async function removeDevice(deviceRecordId: string): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('user_devices')
      .delete()
      .eq('id', deviceRecordId);

    if (error) {
      console.error('Remove device error:', error);
      return false;
    }

    return true;
  } catch (error) {
    console.error('Remove device exception:', error);
    return false;
  }
}

/**
 * Get current device's record ID
 */
export async function getCurrentDeviceRecordId(): Promise<string | null> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;

    const deviceId = await getDeviceId();

    const { data, error } = await supabase
      .from('user_devices')
      .select('id')
      .eq('user_id', user.id)
      .eq('device_id', deviceId)
      .single();

    if (error) return null;
    return data?.id || null;
  } catch {
    return null;
  }
}

/**
 * Update device location consent and location data
 */
export async function updateDeviceLocation(
  location: {
    city?: string;
    region?: string;
    country?: string;
    timezone?: string;
  } | null,
  consent: boolean
): Promise<boolean> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return false;

    const deviceId = await getDeviceId();

    const { error } = await supabase
      .from('user_devices')
      .update({
        approximate_location: location,
        location_consent: consent,
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', user.id)
      .eq('device_id', deviceId);

    if (error) {
      console.error('Update device location error:', error);
      return false;
    }

    return true;
  } catch (error) {
    console.error('Update device location exception:', error);
    return false;
  }
}

/**
 * Get device count for user
 */
export async function getDeviceCount(): Promise<number> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return 0;

    const { count, error } = await supabase
      .from('user_devices')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .eq('is_active', true);

    if (error) return 0;
    return count || 0;
  } catch {
    return 0;
  }
}

/**
 * Format device for display
 */
export function formatDeviceDisplay(device: DeviceRecord): {
  name: string;
  details: string;
  isCurrentDevice: boolean;
} {
  const name = device.device_model || device.device_brand || 'Unknown Device';
  const osInfo = device.os_version
    ? `${device.os_name} ${device.os_version}`
    : device.os_name;
  const appInfo = device.app_version ? `v${device.app_version}` : '';

  return {
    name,
    details: [osInfo, appInfo].filter(Boolean).join(' - '),
    isCurrentDevice: false, // Will be determined by caller
  };
}

export default {
  getDeviceInfo,
  registerDevice,
  updateDeviceActivity,
  getUserDevices,
  isDeviceRegistered,
  deactivateDevice,
  removeDevice,
  getCurrentDeviceRecordId,
  updateDeviceLocation,
  getDeviceCount,
  formatDeviceDisplay,
};
