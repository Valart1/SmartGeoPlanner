/**
 * Storage Service
 * Async local persistence using @react-native-async-storage/async-storage.
 * Generic typed wrappers for JSON serialization.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

export async function getItem<T>(key: string): Promise<T | null> {
  try {
    const raw = await AsyncStorage.getItem(key);
    if (!raw) return null;
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export async function setItem<T>(key: string, value: T): Promise<void> {
  await AsyncStorage.setItem(key, JSON.stringify(value));
}

export async function removeItem(key: string): Promise<void> {
  await AsyncStorage.removeItem(key);
}

export async function clearAll(): Promise<void> {
  await AsyncStorage.clear();
}

// Storage keys
export const STORAGE_KEYS = {
  USER: '@sgp:user',
  USERS: '@sgp:users',
  TASKS: '@sgp:tasks',
  EVENTS: '@sgp:events',
  WEATHER_CACHE: '@sgp:weather',
} as const;
