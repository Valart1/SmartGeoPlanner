/**
 * Push notification service.
 *
 * Sends push notifications through Expo's Push Service to the Expo push tokens
 * stored for each user. A single event creation fans out one push to every
 * OTHER user (so everyone — new and existing — is notified of shared events,
 * even when the app is closed).
 */

import { Expo } from 'expo-server-sdk';

const expo = new Expo({ accessToken: process.env.EXPO_ACCESS_TOKEN || undefined });

export interface PushMessage {
  title: string;
  body: string;
  data?: Record<string, unknown>;
}

/**
 * Fan out a push to many tokens (chunked to Expo's 100-message limit).
 * Returns the set of tokens that are no longer valid (should be removed).
 */
export async function sendPushToMany(
  tokens: string[],
  message: PushMessage,
): Promise<{ delivered: number; invalidTokens: string[] }> {
  const validTokens = tokens.filter(Expo.isExpoPushToken);
  const invalidTokens = tokens.filter(t => !Expo.isExpoPushToken);
  const messages = validTokens.map(to => ({
    to,
    sound: 'default' as const,
    title: message.title,
    body: message.body,
    data: message.data ?? {},
  }));

  let delivered = 0;

  for (let i = 0; i < messages.length; i += 100) {
    const chunk = messages.slice(i, i + 100);
    try {
      const chunkTickets = await expo.sendPushNotificationsAsync(chunk);
      chunkTickets.forEach((ticket, j) => {
        if (ticket.status === 'ok') {
          delivered += 1;
        } else if (ticket.status === 'error') {
          const code = ticket.details?.error;
          if (code === 'DeviceNotRegistered') {
            invalidTokens.push(chunk[j].to);
          }
        }
      });
    } catch (error) {
      console.error('[push] chunk send error:', error);
    }
  }

  return { delivered, invalidTokens };
}