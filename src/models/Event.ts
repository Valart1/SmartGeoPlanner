/**
 * Event Model
 * Defines data structures for the Event Calendar module.
 */

import { GeoLocation } from './Location';

export type EventColor =
  | '#6C63FF'
  | '#FF6584'
  | '#43C6AC'
  | '#F7971E'
  | '#56CCF2';

export interface CalendarEvent {
  id: string;
  userId: string;
  title: string;
  description: string;
  date: string;       // YYYY-MM-DD
  startTime: string;  // HH:MM
  endTime: string;    // HH:MM
  color: EventColor;
  location: GeoLocation | null;
  notificationId: string | null;
  isAllDay: boolean;
  createdAt: string;
  updatedAt: string;
  /** Username of the account that created the event (shared calendar). */
  creatorUsername?: string;
  /** Email of the creator (shared calendar). */
  creatorEmail?: string;
}

export type CreateEventPayload = Omit<
  CalendarEvent,
  'id' | 'userId' | 'createdAt' | 'updatedAt' | 'notificationId'
>;

export type UpdateEventPayload = Partial<
  Omit<CalendarEvent, 'id' | 'userId' | 'createdAt' | 'updatedAt'>
>;

/** Shape used by react-native-calendars MarkedDates */
export interface MarkedDateEntry {
  marked: boolean;
  dotColor: string;
  events: CalendarEvent[];
}

export type MarkedDates = Record<string, MarkedDateEntry>;
