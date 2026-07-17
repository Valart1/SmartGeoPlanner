/**
 * useCalendarViewModel
 * MVVM ViewModel for the Event Calendar module.
 * Manages calendar events: CRUD, date selection, markedDates, and notifications.
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { CalendarEvent, CreateEventPayload, UpdateEventPayload, MarkedDates } from '../models/Event';
import { getItem, setItem, STORAGE_KEYS } from '../services/storageService';
import {
  scheduleEventReminder,
  cancelNotification,
} from '../services/notificationService';

export interface CalendarViewModel {
  events: CalendarEvent[];
  allEvents: CalendarEvent[];
  isLoading: boolean;
  error: string | null;
  selectedDate: string;
  eventsForSelectedDate: CalendarEvent[];
  markedDates: MarkedDates;
  setSelectedDate: (date: string) => void;
  createEvent: (payload: CreateEventPayload) => Promise<CalendarEvent>;
  updateEvent: (id: string, payload: UpdateEventPayload) => Promise<void>;
  deleteEvent: (id: string) => Promise<void>;
  getEventById: (id: string) => CalendarEvent | undefined;
  clearError: () => void;
  reload: () => Promise<void>;
}

function generateId(): string {
  return `event_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}

function todayString(): string {
  return new Date().toISOString().split('T')[0];
}

/**
 * Checks if a date string (YYYY-MM-DD) is in the past.
 */
function isPastDate(date: string): boolean {
  const today = todayString();
  return date < today;
}

/**
 * Checks if a time string (HH:MM) is in the past for today.
 */
function isPastTime(time: string): boolean {
  const now = new Date();
  const [hours, minutes] = time.split(':').map(Number);
  const eventTime = new Date(now.getFullYear(), now.getMonth(), now.getDate(), hours, minutes);
  return eventTime < now;
}

/**
 * Checks if a time is in the past for a given date.
 * For today, compares against current time. For future dates, always returns false.
 */
function isTimeInPast(date: string, time: string): boolean {
  if (date !== todayString()) return false;
  return isPastTime(time);
}

/**
 * Checks if an event has expired (passed its end time by more than 1 week).
 * For timed events, compares the exact end time. For all-day events, compares the date.
 */
function isEventExpired(event: CalendarEvent): boolean {
  const now = new Date();
  const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  if (event.isAllDay) {
    // For all-day events, check if the date is more than 1 week ago
    const eventDate = new Date(event.date);
    return eventDate < oneWeekAgo;
  }

  // For timed events, check if the end time is more than 1 week ago
  const [year, month, day] = event.date.split('-').map(Number);
  const [hours, minutes] = event.endTime.split(':').map(Number);
  const eventEndTime = new Date(year, month - 1, day, hours, minutes);
  return eventEndTime < oneWeekAgo;
}

export function useCalendarViewModel(userId: string): CalendarViewModel {
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [allEvents, setAllEvents] = useState<CalendarEvent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState<string>(todayString());

  const reload = useCallback(async () => {
    try {
      setIsLoading(true);
      const stored = await getItem<CalendarEvent[]>(STORAGE_KEYS.EVENTS);
      const loadedEvents = stored ?? [];

      // Clean up expired events (older than 1 week)
      const activeEvents = loadedEvents.filter(e => !isEventExpired(e));
      if (activeEvents.length !== loadedEvents.length) {
        // Cancel notifications for expired events
        for (const expired of loadedEvents.filter(e => isEventExpired(e))) {
          if (expired.notificationId) {
            await cancelNotification(expired.notificationId);
          }
        }
        await setItem(STORAGE_KEYS.EVENTS, activeEvents);
      }

      setAllEvents(activeEvents);
      setEvents(activeEvents.filter(e => e.userId === userId));
    } catch {
      setError('Failed to load events.');
    } finally {
      setIsLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    reload();
  }, [reload]);

  // ── MarkedDates computed for react-native-calendars ────────────────────────
  const markedDates: MarkedDates = useMemo(() => {
    const map: MarkedDates = {};
    for (const event of events) {
      if (!map[event.date]) {
        map[event.date] = { marked: true, dotColor: event.color, events: [] };
      }
      map[event.date].events.push(event);
    }
    // Highlight selected date
    if (map[selectedDate]) {
      map[selectedDate] = {
        ...map[selectedDate],
        // @ts-ignore – react-native-calendars extra props
        selected: true,
        selectedColor: '#6C63FF33',
      };
    } else {
      // @ts-ignore
      map[selectedDate] = { selected: true, selectedColor: '#6C63FF33' };
    }
    return map;
  }, [events, selectedDate]);

  const eventsForSelectedDate = useMemo(
    () =>
      events
        .filter(e => e.date === selectedDate)
        .sort((a, b) => a.startTime.localeCompare(b.startTime)),
    [events, selectedDate],
  );

  // ── CRUD ───────────────────────────────────────────────────────────────────
  // All write paths read from storage before writing so a burst of updates
  // issued before React re-renders can't drop writes by reading a stale list.

  const createEvent = useCallback(
    async (payload: CreateEventPayload): Promise<CalendarEvent> => {
      // Prevent creating events for past dates
      if (isPastDate(payload.date)) {
        throw new Error('Cannot create events for past dates.');
      }

      // Prevent creating events with past time for today
      if (!payload.isAllDay && isTimeInPast(payload.date, payload.startTime)) {
        throw new Error('Cannot create events with a time that has already passed today.');
      }

      // Prevent creating events where end time is before start time
      if (!payload.isAllDay && payload.endTime <= payload.startTime) {
        throw new Error('End time must be after start time.');
      }

      // Prevent creating events where end time is in the past for today
      if (!payload.isAllDay && isTimeInPast(payload.date, payload.endTime)) {
        throw new Error('End time must be in the future.');
      }

      const now = new Date().toISOString();
      let notificationId: string | null = null;

      if (!payload.isAllDay) {
        notificationId = await scheduleEventReminder(
          payload.title,
          payload.date,
          payload.startTime,
        );
      }

      const event: CalendarEvent = {
        ...payload,
        id: generateId(),
        userId,
        notificationId,
        createdAt: now,
        updatedAt: now,
      };

      // Read storage to derive the merged list atomically — guards against
      // a concurrent write from another user between the previous and this call.
      const all = (await getItem<CalendarEvent[]>(STORAGE_KEYS.EVENTS)) ?? [];
      const others = all.filter(e => e.userId !== userId);
      const nextAll = [...others, ...all.filter(e => e.userId === userId), event];
      await setItem(STORAGE_KEYS.EVENTS, nextAll);
      setAllEvents(nextAll);
      setEvents(nextAll.filter(e => e.userId === userId));
      return event;
    },
    [userId],
  );

  const updateEvent = useCallback(
    async (id: string, payload: UpdateEventPayload): Promise<void> => {
      // Read storage to avoid a stale closure on `events` / `allEvents`.
      const all = (await getItem<CalendarEvent[]>(STORAGE_KEYS.EVENTS)) ?? [];
      const userEvents = all.filter(e => e.userId === userId);

      // Find the event to get its current date for validation
      const event = userEvents.find(e => e.id === id);
      if (!event) return;

      // Check if the new date (if provided) is in the past
      if (payload.date !== undefined && isPastDate(payload.date)) {
        throw new Error('Cannot update event to a past date.');
      }

      // Get the target date and times for validation
      const targetDate = payload.date ?? event.date;
      const targetStartTime = payload.startTime ?? event.startTime;
      const targetEndTime = payload.endTime ?? event.endTime;
      const newIsAllDay = payload.isAllDay !== undefined ? payload.isAllDay : event.isAllDay;

      // Check if the new start time (if provided) is in the past for today
      if (!newIsAllDay && isTimeInPast(targetDate, targetStartTime)) {
        throw new Error('Cannot update event to a time that has already passed today.');
      }

      // Check if end time is after start time
      if (!newIsAllDay && targetEndTime <= targetStartTime) {
        throw new Error('End time must be after start time.');
      }

      // Check if end time is in the past for today
      if (!newIsAllDay && isTimeInPast(targetDate, targetEndTime)) {
        throw new Error('End time must be in the future.');
      }

      const updated = await Promise.all(
        userEvents.map(async e => {
          if (e.id !== id) return e;

          const isAllDayChanged = payload.isAllDay !== undefined && payload.isAllDay !== e.isAllDay;

          // Cancel any existing reminder whenever all-day status or time changes.
          if ((isAllDayChanged || payload.date !== undefined || payload.startTime !== undefined)
              && e.notificationId) {
            await cancelNotification(e.notificationId);
          }

          let notificationId: string | null = e.notificationId;
          if (newIsAllDay) {
            // All-day events have no reminder.
            notificationId = null;
          } else {
            const newDate = payload.date ?? e.date;
            const newStartTime = payload.startTime ?? e.startTime;
            notificationId = await scheduleEventReminder(
              payload.title ?? e.title,
              newDate,
              newStartTime,
            );
          }

          return {
            ...e,
            ...payload,
            notificationId,
            updatedAt: new Date().toISOString(),
          };
        }),
      );

      const others = all.filter(e => e.userId !== userId);
      await setItem(STORAGE_KEYS.EVENTS, [...others, ...updated]);
      setAllEvents([...others, ...updated]);
      setEvents(updated);
    },
    [userId],
  );

  const deleteEvent = useCallback(
    async (id: string) => {
      const all = (await getItem<CalendarEvent[]>(STORAGE_KEYS.EVENTS)) ?? [];
      const userEvents = all.filter(e => e.userId === userId);
      const target = userEvents.find(e => e.id === id);
      if (target?.notificationId) {
        await cancelNotification(target.notificationId);
      }
      const remaining = userEvents.filter(e => e.id !== id);
      const others = all.filter(e => e.userId !== userId);
      await setItem(STORAGE_KEYS.EVENTS, [...others, ...remaining]);
      setAllEvents([...others, ...remaining]);
      setEvents(remaining);
    },
    [userId],
  );

  const getEventById = (id: string) => events.find(e => e.id === id);
  const clearError = () => setError(null);

  return {
    events,
    allEvents,
    isLoading,
    error,
    selectedDate,
    eventsForSelectedDate,
    markedDates,
    setSelectedDate,
    createEvent,
    updateEvent,
    deleteEvent,
    getEventById,
    clearError,
    reload,
  };
}
