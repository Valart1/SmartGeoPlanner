/**
 * Notification Service
 * Configures and schedules local notifications using expo-notifications.
 *
 * IMPORTANT: expo-notifications' native module is unavailable inside Android
 * Expo Go (remote push was removed from Expo Go in SDK 53). Importing the
 * package eagerly makes the whole app crash with "[runtime not ready]" because
 * one of its submodules touches the missing native module at import time.
 * We therefore lazy-require the package and no-op safely when unsupported.
 */

import Constants from 'expo-constants';
import { Platform } from 'react-native';
import type { Notification, NotificationResponse } from 'expo-notifications';

// Type-only alias so importing this module never eagerly loads expo-notifications.
type NotificationsModule = typeof import('expo-notifications');

const REMINDER_CHANNEL_ID = 'reminders';
const MINIMUM_DELAY_MS = 10 * 1000;

// Metro provides require(); TypeScript doesn't always declare it.
declare const require: (path: string) => any;

/**
 * True when notifications cannot work at all in the current environment.
 * Android Expo Go removed the notifications native module (push + local) in
 * SDK 53. Development builds, production builds, and iOS Expo Go still work.
 */
function isNotificationsUnsupported(): boolean {
  return Platform.OS === 'android' && Constants.executionEnvironment === 'storeClient';
}

let cachedModule: NotificationsModule | null = null;
let loadAttempted = false;
// The Expo push token currently registered for this device (if any).
let currentPushToken: string | null = null;

/** Lazily load expo-notifications; returns null when unsupported/unavailable. */
function getNotifications(): NotificationsModule | null {
  if (isNotificationsUnsupported()) return null;
  if (loadAttempted) return cachedModule;
  loadAttempted = true;
  try {
    cachedModule = require('expo-notifications') as NotificationsModule;
  } catch (error) {
    console.warn('[notifications] expo-notifications failed to load:', error);
    cachedModule = null;
  }
  return cachedModule;
}

let handlerRegistered = false;
// True only when this device has a live Expo push token. When remote push is
// available, the backend announces shared events for us, so we must NOT also
// fire a local "new event" notification (or users get two).
let pushRegistered = false;

/** Register the foreground notification handler once, only when supported. */
function ensureHandlerRegistered(n: NotificationsModule): void {
  if (handlerRegistered) return;
  handlerRegistered = true;
  n.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });
}

async function ensureNotificationChannel(): Promise<boolean> {
  const n = getNotifications();
  if (!n) return false;
  if (Platform.OS !== 'android') return true;

  await n.setNotificationChannelAsync(REMINDER_CHANNEL_ID, {
    name: 'Reminders',
    importance: n.AndroidImportance.HIGH,
    vibrationPattern: [0, 250, 250, 250],
    lightColor: '#6C63FF',
    sound: 'default',
  });
  return true;
}

/** False when running where notifications are unavailable (Android Expo Go). */
export function areNotificationsSupported(): boolean {
  return getNotifications() !== null;
}

/**
 * Register foreground-received and tap listeners.
 * Returns an unsubscribe function; no-ops when notifications are unsupported.
 */
export function registerNotificationListeners(
  onReceived?: (notification: Notification) => void,
  onResponse?: (response: NotificationResponse) => void,
): () => void {
  const n = getNotifications();
  if (!n) return () => {};

  ensureHandlerRegistered(n);
  const receivedSub = onReceived ? n.addNotificationReceivedListener(onReceived) : null;
  const responseSub = onResponse ? n.addNotificationResponseReceivedListener(onResponse) : null;
  return () => {
    receivedSub?.remove();
    responseSub?.remove();
  };
}

export async function requestNotificationPermissions(): Promise<boolean> {
  const n = getNotifications();
  if (!n) return false;

  await ensureNotificationChannel();

  const { status: existing } = await n.getPermissionsAsync();
  if (existing === 'granted') return true;

  const { status } = await n.requestPermissionsAsync();
  return status === 'granted';
}

export async function scheduleNotification(
  title: string,
  body: string,
  trigger: Date,
): Promise<string | null> {
  const n = getNotifications();
  if (!n) return null;

  const granted = await requestNotificationPermissions();
  if (!granted) return null;

  if (trigger.getTime() <= Date.now()) return null;

  return n.scheduleNotificationAsync({
    content: {
      title,
      body,
      sound: 'default',
      data: { scheduledAt: new Date().toISOString() },
    },
    trigger: {
      type: n.SchedulableTriggerInputTypes.DATE,
      date: trigger,
      channelId: REMINDER_CHANNEL_ID,
    },
  });
}

export async function cancelNotification(notificationId: string): Promise<void> {
  const n = getNotifications();
  if (!n) return;
  await n.cancelScheduledNotificationAsync(notificationId);
}

export async function cancelAllNotifications(): Promise<void> {
  const n = getNotifications();
  if (!n) return;
  await n.cancelAllScheduledNotificationsAsync();
}

/**
 * Register this device for remote push notifications (Expo Push Service).
 * Returns the push token on success, or null when the platform/build doesn't
 * support it (e.g. Android Expo Go, which removed push in SDK 53).
 */
export async function registerForPushNotifications(): Promise<string | null> {
  const n = getNotifications();
  if (!n) return null;

  await ensureNotificationChannel();

  const granted = await requestNotificationPermissions();
  if (!granted) return null;

  const projectId = Constants.expoConfig?.extra?.eas?.projectId ?? null;

  try {
    const tokenData = await n.getExpoPushTokenAsync(projectId ? { projectId } : undefined);
    pushRegistered = true;
    currentPushToken = tokenData.data;
    return tokenData.data;
  } catch (error) {
    // Push requires a development/production build on Android — on Expo Go the
    // native module is absent. Swallow so the rest of the app keeps working.
    console.warn('[notifications] Unable to obtain a push token:', error);
    return null;
  }
}

/**
 * Whether this device should announce new shared events via a LOCAL
 * notification. True only when local notifications work AND remote push is
 * not registered here (Expo Go fallback). When a push token exists, the
 * backend does the announcement and the local one is skipped (no duplicates).
 */
export function shouldUseLocalEventAnnouncements(): boolean {
  return areNotificationsSupported() && !pushRegistered;
}

/** Called on logout: return the current push token so the caller can unregister it. */
export function getCurrentPushToken(): string | null {
  return currentPushToken;
}

/** Called on logout: drop all scheduled local reminders and forget the token. */
export function clearNotificationSchedules(): void {
  pushRegistered = false;
  const n = getNotifications();
  if (!n) return;
  n.cancelAllScheduledNotificationsAsync().catch(() => {});
}

function buildReminderTrigger(target: Date, leadMinutes: number): Date | null {
  if (Number.isNaN(target.getTime())) return null;
  if (target.getTime() <= Date.now()) return null;

  const reminder = new Date(target.getTime() - leadMinutes * 60 * 1000);
  if (reminder.getTime() > Date.now() + MINIMUM_DELAY_MS) {
    return reminder;
  }

  return new Date(Date.now() + MINIMUM_DELAY_MS);
}

export async function scheduleTaskReminder(
  taskTitle: string,
  dueDate: string,
  dueTime: string,
): Promise<string | null> {
  const [year, month, day] = dueDate.split('-').map(Number);
  const [hours, minutes] = dueTime.split(':').map(Number);
  const dueAt = new Date(year, month - 1, day, hours, minutes);
  const trigger = buildReminderTrigger(dueAt, 30);
  if (!trigger) return null;

  return scheduleNotification(
    'Task Due Soon',
    `"${taskTitle}" is due soon.`,
    trigger,
  );
}

export async function scheduleEventReminder(
  eventTitle: string,
  eventDate: string,
  startTime: string,
): Promise<string | null> {
  const [year, month, day] = eventDate.split('-').map(Number);
  const [hours, minutes] = startTime.split(':').map(Number);
  const startsAt = new Date(year, month - 1, day, hours, minutes);
  const trigger = buildReminderTrigger(startsAt, 15);
  if (!trigger) return null;

  return scheduleNotification(
    'Event Starting Soon',
    `"${eventTitle}" starts soon.`,
    trigger,
  );
}

export async function scheduleTestNotification(): Promise<string | null> {
  return scheduleNotification(
    'Smart Geo-Planner Test',
    'Notifications are ready.',
    new Date(Date.now() + MINIMUM_DELAY_MS),
  );
}

/**
 * Announces a newly created shared event from another user.
 * Fires a local notification ~10 s after scheduling.
 */
export async function scheduleNewEventNotification(
  eventTitle: string,
  whenLabel: string,
  creatorName: string,
): Promise<string | null> {
  return scheduleNotification(
    `New Event from ${creatorName}`,
    `"${eventTitle}" is scheduled for ${whenLabel}.`,
    new Date(Date.now() + MINIMUM_DELAY_MS),
  );
}
