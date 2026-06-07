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
      setAllEvents(loadedEvents);
      setEvents(loadedEvents.filter(e => e.userId === userId));
    } catch {
      setError('Failed to load events.');
    } finally {
      setIsLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    reload();
  }, [reload]);

  const persist = async (updated: CalendarEvent[]) => {
    const all = await getItem<CalendarEvent[]>(STORAGE_KEYS.EVENTS) ?? [];
    const others = all.filter(e => e.userId !== userId);
    const nextAllEvents = [...others, ...updated];
    await setItem(STORAGE_KEYS.EVENTS, nextAllEvents);
    setAllEvents(nextAllEvents);
    setEvents(updated);
  };

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

      const updated = [...events, event];
      await persist(updated);
      return event;
    },
    [events, userId],
  );

  const updateEvent = useCallback(
    async (id: string, payload: UpdateEventPayload): Promise<void> => {
      const updated = await Promise.all(
        events.map(async e => {
          if (e.id !== id) return e;
          if (e.notificationId) await cancelNotification(e.notificationId);
          const newDate = payload.date ?? e.date;
          const newStartTime = payload.startTime ?? e.startTime;
          const notificationId = await scheduleEventReminder(
            payload.title ?? e.title,
            newDate,
            newStartTime,
          );
          return { ...e, ...payload, notificationId, updatedAt: new Date().toISOString() };
        }),
      );
      await persist(updated);
    },
    [events],
  );

  const deleteEvent = useCallback(
    async (id: string): Promise<void> => {
      const event = events.find(e => e.id === id);
      if (event?.notificationId) await cancelNotification(event.notificationId);
      await persist(events.filter(e => e.id !== id));
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
