/**
 * useTaskViewModel
 * MVVM ViewModel for Task/To-Do management.
 * Handles CRUD operations, filtering, and notification scheduling.
 * Data is persisted via the PostgreSQL backend (apiService); the backend scopes
 * tasks to the authenticated user via the JWT, so userId is used only for
 * notification ownership, not for client-side filtering.
 */

import { useState, useEffect, useCallback } from 'react';
import { Task, CreateTaskPayload, UpdateTaskPayload } from '../models/Task';
import {
  getTasks as apiGetTasks,
  createTask as apiCreateTask,
  updateTask as apiUpdateTask,
  deleteTask as apiDeleteTask,
} from '../services/apiService';
import {
  scheduleTaskReminder,
  cancelNotification,
} from '../services/notificationService';

export interface TaskViewModel {
  tasks: Task[];
  isLoading: boolean;
  error: string | null;
  pendingTasks: Task[];
  completedTasks: Task[];
  overdueTasks: Task[];
  createTask: (payload: CreateTaskPayload) => Promise<Task>;
  updateTask: (id: string, payload: UpdateTaskPayload) => Promise<void>;
  deleteTask: (id: string) => Promise<void>;
  toggleComplete: (id: string) => Promise<void>;
  getTaskById: (id: string) => Task | undefined;
  clearError: () => void;
  reload: () => Promise<void>;
}

function todayString(): string {
  return new Date().toISOString().split('T')[0];
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
 * Returns true if a task is past its due date and not completed.
 */
function isOverdue(task: Task): boolean {
  if (!task.dueDate || task.isCompleted) return false;
  const due = new Date(task.dueDate);
  due.setHours(23, 59, 59);
  return due < new Date();
}

export function useTaskViewModel(_userId: string): TaskViewModel {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // ── Load tasks from the backend on mount ─────────────────────────────────────
  const reload = useCallback(async () => {
    try {
      setIsLoading(true);
      const loadedTasks = await apiGetTasks();
      setTasks(loadedTasks);
    } catch (e) {
      setError('Failed to load tasks.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  // ── CRUD ────────────────────────────────────────────────────────────────────

  const createTask = useCallback(
    async (payload: CreateTaskPayload): Promise<Task> => {
      // Prevent creating tasks for past dates
      if (payload.dueDate && payload.dueDate < todayString()) {
        throw new Error('Cannot create tasks for past dates.');
      }

      // Prevent creating tasks with past time for today
      if (payload.dueDate && payload.dueDate === todayString() && payload.dueTime && isPastTime(payload.dueTime)) {
        throw new Error('Cannot create tasks with a time that has already passed today.');
      }

      let notificationId: string | null = null;

      if (payload.dueDate && payload.dueTime) {
        notificationId = await scheduleTaskReminder(
          payload.title,
          payload.dueDate,
          payload.dueTime,
        );
      }

      const created = await apiCreateTask({
        ...payload,
        notificationId,
      });

      setTasks(prev => [created, ...prev]);
      return created;
    },
    [],
  );

  const updateTask = useCallback(
    async (id: string, payload: UpdateTaskPayload): Promise<void> => {
      const task = tasks.find(t => t.id === id);
      if (!task) return;

      // Check if the new due date (if provided) is in the past
      if (payload.dueDate !== undefined && payload.dueDate !== null && payload.dueDate < todayString()) {
        throw new Error('Cannot update task to a past date.');
      }

      // Check if the new due time (if provided) is in the past for today
      const targetDate = payload.dueDate !== undefined && payload.dueDate !== null ? payload.dueDate : task.dueDate;
      const targetTime = payload.dueTime !== undefined && payload.dueTime !== null ? payload.dueTime : task.dueTime;
      if (targetDate && targetDate === todayString() && targetTime && isPastTime(targetTime)) {
        throw new Error('Cannot update task to a time that has already passed today.');
      }

      const newDueDate = payload.dueDate !== undefined ? payload.dueDate : task.dueDate;
      const newDueTime = payload.dueTime !== undefined ? payload.dueTime : task.dueTime;
      const dueChanged = payload.dueDate !== undefined || payload.dueTime !== undefined;

      // Reschedule notification whenever the due pair changes.
      if (dueChanged && task.notificationId) {
        await cancelNotification(task.notificationId);
      }

      let notificationId = task.notificationId;
      if (newDueDate && newDueTime) {
        notificationId = await scheduleTaskReminder(
          payload.title ?? task.title,
          newDueDate,
          newDueTime,
        );
      } else if (dueChanged) {
        // The task lost its due date/time — clear the reminder.
        notificationId = null;
      }

      await apiUpdateTask(id, { ...payload, notificationId });

      setTasks(prev =>
        prev.map(t =>
          t.id === id
            ? { ...t, ...payload, notificationId, updatedAt: new Date().toISOString() }
            : t,
        ),
      );
    },
    [tasks],
  );

  const deleteTask = useCallback(
    async (id: string) => {
      const target = tasks.find(t => t.id === id);
      if (target?.notificationId) {
        await cancelNotification(target.notificationId);
      }
      await apiDeleteTask(id);
      setTasks(prev => prev.filter(t => t.id !== id));
    },
    [tasks],
  );

  const toggleComplete = useCallback(
    async (id: string) => {
      const task = tasks.find(t => t.id === id);
      if (!task) return;

      const isCompleted = !task.isCompleted;
      const status = isCompleted ? 'completed' : 'pending';

      await apiUpdateTask(id, { isCompleted, status });

      setTasks(prev =>
        prev.map(t =>
          t.id === id
            ? {
                ...t,
                isCompleted,
                status: status as Task['status'],
                updatedAt: new Date().toISOString(),
              }
            : t,
        ),
      );
    },
    [tasks],
  );

  const getTaskById = (id: string) => tasks.find(t => t.id === id);
  const clearError = () => setError(null);

  // ── Derived lists ──────────────────────────────────────────────────────────
  const pendingTasks = tasks.filter(t => !t.isCompleted && !isOverdue(t));
  const completedTasks = tasks.filter(t => t.isCompleted);
  const overdueTasks = tasks.filter(t => isOverdue(t));

  return {
    tasks,
    isLoading,
    error,
    pendingTasks,
    completedTasks,
    overdueTasks,
    createTask,
    updateTask,
    deleteTask,
    toggleComplete,
    getTaskById,
    clearError,
    reload,
  };
}
