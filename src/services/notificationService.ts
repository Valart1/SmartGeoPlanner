/**
 * Notification Service
 * Configures and schedules local push notifications using expo-notifications.
 * Used for task due-date reminders and calendar event alerts.
 */

import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

// Configure how notifications are displayed when the app is in the foreground
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

/**
 * Request notification permissions from the OS.
 * Returns true if granted.
 */
export async function requestNotificationPermissions(): Promise<boolean> {
  const { status: existing } = await Notifications.getPermissionsAsync();
  if (existing === 'granted') return true;

  const { status } = await Notifications.requestPermissionsAsync();

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('reminders', {
      name: 'Reminders',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#6C63FF',
    });
  }

  return status === 'granted';
}

/**
 * Schedule a local notification at a specific date/time.
 * @param title  Notification title
 * @param body   Notification body text
 * @param trigger Date object for when to fire
 * @returns Notification identifier (store this to cancel later)
 */
export async function scheduleNotification(
  title: string,
  body: string,
  trigger: Date,
): Promise<string | null> {
  const granted = await requestNotificationPermissions();
  if (!granted) return null;

  // Don't schedule past notifications
  if (trigger.getTime() <= Date.now()) return null;

  const id = await Notifications.scheduleNotificationAsync({
    content: {
      title,
      body,
      sound: 'default',
      data: { scheduledAt: new Date().toISOString() },
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DATE,
      date: trigger,
    },
  });

  return id;
}

/**
 * Cancel a previously scheduled notification.
 * @param notificationId The ID returned by scheduleNotification
 */
export async function cancelNotification(notificationId: string): Promise<void> {
  await Notifications.cancelScheduledNotificationAsync(notificationId);
}

/**
 * Cancel all scheduled notifications.
 */
export async function cancelAllNotifications(): Promise<void> {
  await Notifications.cancelAllScheduledNotificationsAsync();
}

/**
 * Schedule a task reminder 30 minutes before its due date/time.
 */
export async function scheduleTaskReminder(
  taskTitle: string,
  dueDate: string,
  dueTime: string,
): Promise<string | null> {
  const [year, month, day] = dueDate.split('-').map(Number);
  const [hours, minutes] = dueTime.split(':').map(Number);
  const trigger = new Date(year, month - 1, day, hours, minutes - 30);

  return scheduleNotification(
    '⏰ Task Due Soon',
    `"${taskTitle}" is due in 30 minutes`,
    trigger,
  );
}

/**
 * Schedule an event reminder 15 minutes before its start time.
 */
export async function scheduleEventReminder(
  eventTitle: string,
  eventDate: string,
  startTime: string,
): Promise<string | null> {
  const [year, month, day] = eventDate.split('-').map(Number);
  const [hours, minutes] = startTime.split(':').map(Number);
  const trigger = new Date(year, month - 1, day, hours, minutes - 15);

  return scheduleNotification(
    '📅 Event Starting Soon',
    `"${eventTitle}" starts in 15 minutes`,
    trigger,
  );
}
