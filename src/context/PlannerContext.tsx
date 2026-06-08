import React, {
  createContext,
  ReactNode,
  useContext,
  useEffect,
  useRef,
} from 'react';
import { useAuth } from './AuthContext';
import {
  TaskViewModel,
  useTaskViewModel,
} from '../viewmodels/useTaskViewModel';
import {
  CalendarViewModel,
  useCalendarViewModel,
} from '../viewmodels/useCalendarViewModel';
import { getItem, setItem, STORAGE_KEYS } from '../services/storageService';
import { scheduleNewEventNotification } from '../services/notificationService';

interface PlannerContextValue {
  taskVM: TaskViewModel;
  calendarVM: CalendarViewModel;
}

const PlannerContext = createContext<PlannerContextValue | undefined>(undefined);

export function PlannerProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const userId = user?.id ?? '';
  const taskVM = useTaskViewModel(userId);
  const calendarVM = useCalendarViewModel(userId);
  const hasCheckedNewEvents = useRef(false);

  useEffect(() => {
    if (!userId || calendarVM.isLoading || hasCheckedNewEvents.current) return;

    hasCheckedNewEvents.current = true;

    const notifyAboutUnseenEvents = async () => {
      const seenByUser = await getItem<Record<string, string[]>>(
        STORAGE_KEYS.SEEN_EVENT_NOTIFICATIONS,
      );
      const seenEventIds = new Set(seenByUser?.[userId] ?? []);
      const otherUserEvents = calendarVM.allEvents.filter(event => event.userId !== userId);
      const unseenEvents = otherUserEvents.filter(event => !seenEventIds.has(event.id));

      if (unseenEvents.length === 0) return;

      const newestEvent = unseenEvents
        .slice()
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];

      await scheduleNewEventNotification(
        newestEvent.title,
        newestEvent.date,
        newestEvent.isAllDay ? '' : newestEvent.startTime,
      );

      const nextSeenByUser = {
        ...(seenByUser ?? {}),
        [userId]: [
          ...seenEventIds,
          ...unseenEvents.map(event => event.id),
        ],
      };

      await setItem(STORAGE_KEYS.SEEN_EVENT_NOTIFICATIONS, nextSeenByUser);
    };

    notifyAboutUnseenEvents();
  }, [calendarVM.allEvents, calendarVM.isLoading, userId]);

  return (
    <PlannerContext.Provider value={{ taskVM, calendarVM }}>
      {children}
    </PlannerContext.Provider>
  );
}

export function usePlanner(): PlannerContextValue {
  const context = useContext(PlannerContext);
  if (!context) throw new Error('usePlanner must be used within <PlannerProvider>');
  return context;
}
