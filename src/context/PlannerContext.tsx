import React, {
  createContext,
  ReactNode,
  useContext,
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

  // NOTE: The previous cross-user "notify about unseen events from other users"
  // effect was a local-storage artifact — the backend scopes events to the
  // authenticated user, so there are no other-user events to announce. Removed.

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
