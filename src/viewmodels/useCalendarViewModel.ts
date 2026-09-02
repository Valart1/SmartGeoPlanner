/**
 * useCalendarViewModel
 * MVVM ViewModel for the Event Calendar module.
 * Manages calendar events: CRUD, date selection, markedDates, and notifications.
 * Events are SHARED across users — the backend returns every user's events, so
 * the calendar, map, and dashboard show everyone's events. While the app is
 * open, the viewmodel polls for newly created events from other users and
 * announces them with a local notification.
 * Data is persisted via the PostgreSQL backend (apiService).
 */

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { CalendarEvent, CreateEventPayload, UpdateEventPayload, MarkedDates } from '../models/Event';
import {
  getEvents as apiGetEvents,
  createEvent as apiCreateEvent,
  updateEvent as apiUpdateEvent,
  deleteEvent as apiDeleteEvent,
} from '../services/apiService';
import {
  scheduleEventReminder,
  cancelNotification,
  scheduleNewEventNotification,
} from '../services/notificationService';
import { todayString, toLocalDateString } from '../utils/dateUtils';

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

function normalizeDate(value: unknown): string {
  const normalized = toLocalDateString(value as Date | string | null | undefined);
  return normalized ?? String(value ?? '').split('T')[0];
}

function normalizeEvent(event: CalendarEvent): CalendarEvent {
  return {
    ...event,
    date: normalizeDate(event.date),
  };
}

function hasEventEnded(event: CalendarEvent): boolean {
  const today = todayString();
  if (event.date < today) return true;
  if (event.date > today || event.isAllDay) return false;
  return isPastTime(event.endTime);
}

function visibleEventsOnly(events: CalendarEvent[]): CalendarEvent[] {
  return events.map(normalizeEvent).filter(event => !hasEventEnded(event));
}

function mergeEvent(events: CalendarEvent[], event: CalendarEvent): CalendarEvent[] {
  const normalized = normalizeEvent(event);
  const exists = events.some(item => item.id === normalized.id);
  const merged = exists
    ? events.map(item => (item.id === normalized.id ? normalized : item))
    : [...events, normalized];

  return visibleEventsOnly(merged);
}

export function useCalendarViewModel(userId: string): CalendarViewModel {
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [allEvents, setAllEvents] = useState<CalendarEvent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState<string>(todayString());

  // Shared-calendar notifications: remember which event ids this device has
  // already seen so a newly discovered event from ANOTHER user can trigger a
  // local notification. null = initial sync: adopt everything silently so
  // users are not spammed about pre-existing events on app start.
  const seenEventIdsRef = useRef<Set<string> | null>(null);
  const userIdRef = useRef(userId);
  userIdRef.current = userId;

  const ingestLoadedEvents = useCallback(
    (loaded: CalendarEvent[]): CalendarEvent[] => {
      const seen = seenEventIdsRef.current;
      if (seen === null) {
        seenEventIdsRef.current = new Set(loaded.map(event => event.id));
        return loaded;
      }

      const nextSeen = new Set(seen);
      for (const event of loaded) {
        if (nextSeen.has(event.id)) continue;
        nextSeen.add(event.id);
        if (event.userId === userIdRef.current) continue; // own event — never self-announce
        try {
          scheduleNewEventNotification(
            event.title,
            event.isAllDay ? event.date : `${event.date} at ${event.startTime}`,
            event.creatorUsername ?? 'another user',
          ).catch(() => {
            // Notification failures must never break event loading.
          });
        } catch {
          // Keep loading even if the notification module misbehaves.
        }
      }
      seenEventIdsRef.current = nextSeen;
      return loaded;
    },
    [],
  );

  const fetchEvents = useCallback(
    async (options: { silent?: boolean } = {}) => {
      const { silent = false } = options;
      try {
        if (!silent) setIsLoading(true);
        const loadedEvents = ingestLoadedEvents(visibleEventsOnly(await apiGetEvents()));
        setAllEvents(loadedEvents);
        setEvents(loadedEvents);
        setError(null);
      } catch (e) {
        if (silent) return; // keep current data when a background poll fails
        setAllEvents([]);
        setEvents([]);
        setError(e instanceof Error ? e.message : 'Failed to load events.');
      } finally {
        if (!silent) setIsLoading(false);
      }
    },
    [ingestLoadedEvents],
  );

  const reload = useCallback(() => fetchEvents(), [fetchEvents]);

  useEffect(() => {
    reload();
  }, [reload]);

  // Poll for events created by other users while the app is open.
  useEffect(() => {
    const intervalId = setInterval(() => {
      fetchEvents({ silent: true });
    }, 60 * 1000);
    return () => clearInterval(intervalId);
  }, [fetchEvents]);

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

      const created = normalizeEvent(await apiCreateEvent(payload));
      seenEventIdsRef.current?.add(created.id);
      let eventWithNotification = created;

      setAllEvents(prev => mergeEvent(prev, eventWithNotification));
      setEvents(prev => mergeEvent(prev, eventWithNotification));

      if (!payload.isAllDay) {
        try {
          const notificationId = await scheduleEventReminder(
            payload.title,
            payload.date,
            payload.startTime,
          );
          if (notificationId) {
            eventWithNotification = { ...eventWithNotification, notificationId };
            await apiUpdateEvent(created.id, { notificationId });
            setAllEvents(prev => mergeEvent(prev, eventWithNotification));
            setEvents(prev => mergeEvent(prev, eventWithNotification));
          }
        } catch {
          // Notification setup should never hide a successfully saved event.
        }
      }

      return eventWithNotification;
    },
    [],
  );

  const updateEvent = useCallback(
    async (id: string, payload: UpdateEventPayload): Promise<void> => {
      const event = events.find(e => e.id === id);
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

      const isAllDayChanged = payload.isAllDay !== undefined && payload.isAllDay !== event.isAllDay;

      // Cancel any existing reminder whenever all-day status or time changes.
      if ((isAllDayChanged || payload.date !== undefined || payload.startTime !== undefined)
          && event.notificationId) {
        await cancelNotification(event.notificationId);
      }

      let notificationId: string | null = event.notificationId;
      if (newIsAllDay) {
        // All-day events have no reminder.
        notificationId = null;
      } else {
        const newDate = payload.date ?? event.date;
        const newStartTime = payload.startTime ?? event.startTime;
        notificationId = await scheduleEventReminder(
          payload.title ?? event.title,
          newDate,
          newStartTime,
        );
      }

      await apiUpdateEvent(id, { ...payload, notificationId });

      const updated = {
        ...event,
        ...payload,
        notificationId,
        updatedAt: new Date().toISOString(),
      };

      setAllEvents(prev => visibleEventsOnly(prev.map(e => (e.id === id ? updated : e))));
      setEvents(prev => visibleEventsOnly(prev.map(e => (e.id === id ? updated : e))));
    },
    [events],
  );

  const deleteEvent = useCallback(
    async (id: string) => {
      const target = events.find(e => e.id === id);
      if (target?.notificationId) {
        await cancelNotification(target.notificationId);
      }
      await apiDeleteEvent(id);
      setAllEvents(prev => prev.filter(e => e.id !== id));
      setEvents(prev => prev.filter(e => e.id !== id));
    },
    [events],
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
