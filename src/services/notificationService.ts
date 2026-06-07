/**
 * Notification Service
 * Configures and schedules local notifications using expo-notifications.
 */

import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

const REMINDER_CHANNEL_ID = 'reminders';
const MINIMUM_DELAY_MS = 10 * 1000;

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

async function ensureNotificationChannel(): Promise<void> {
  if (Platform.OS !== 'android') return;

  await Notifications.setNotificationChannelAsync(REMINDER_CHANNEL_ID, {
    name: 'Reminders',
    importance: Notifications.AndroidImportance.HIGH,
    vibrationPattern: [0, 250, 250, 250],
    lightColor: '#6C63FF',
    sound: 'default',
  });
}

export async function requestNotificationPermissions(): Promise<boolean> {
  await ensureNotificationChannel();

  const { status: existing } = await Notifications.getPermissionsAsync();
  if (existing === 'granted') return true;

  const { status } = await Notifications.requestPermissionsAsync();
  return status === 'granted';
}

export async function scheduleNotification(
  title: string,
  body: string,
  trigger: Date,
): Promise<string | null> {
  const granted = await requestNotificationPermissions();
  if (!granted) return null;

  if (trigger.getTime() <= Date.now()) return null;

  return Notifications.scheduleNotificationAsync({
    content: {
      title,
      body,
      sound: 'default',
      data: { scheduledAt: new Date().toISOString() },
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DATE,
      date: trigger,
      channelId: REMINDER_CHANNEL_ID,
    },
  });
}

export async function cancelNotification(notificationId: string): Promise<void> {
  await Notifications.cancelScheduledNotificationAsync(notificationId);
}

export async function cancelAllNotifications(): Promise<void> {
  await Notifications.cancelAllScheduledNotificationsAsync();
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
