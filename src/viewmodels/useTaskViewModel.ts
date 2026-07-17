/**
 * useTaskViewModel
 * MVVM ViewModel for Task/To-Do management.
 * Handles CRUD operations, filtering, local persistence, and notification scheduling.
 */

import { useState, useEffect, useCallback } from 'react';
import { Task, CreateTaskPayload, UpdateTaskPayload } from '../models/Task';
import { getItem, setItem, STORAGE_KEYS } from '../services/storageService';
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

/**
 * Generates a unique ID using timestamp + random suffix.
 */
function generateId(): string {
  return `task_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
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

/**
 * Checks if a task has expired (passed its due time by more than 1 week).
 * Expired tasks are automatically removed.
 */
function isTaskExpired(task: Task): boolean {
  if (task.isCompleted) return false;
  if (!task.dueDate) return false;

  const now = new Date();
  const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  if (task.dueTime) {
    // For timed tasks, check if the due time is more than 1 week ago
    const [year, month, day] = task.dueDate.split('-').map(Number);
    const [hours, minutes] = task.dueTime.split(':').map(Number);
    const dueTime = new Date(year, month - 1, day, hours, minutes);
    return dueTime < oneWeekAgo;
  }

  // For date-only tasks, check if the date is more than 1 week ago
  const dueDate = new Date(task.dueDate);
  dueDate.setHours(23, 59, 59);
  return dueDate < oneWeekAgo;
}

export function useTaskViewModel(userId: string): TaskViewModel {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // ── Load persisted tasks on mount ──────────────────────────────────────────
  const reload = useCallback(async () => {
    try {
      setIsLoading(true);
      const stored = await getItem<Task[]>(STORAGE_KEYS.TASKS);
      const loadedTasks = stored ?? [];

      // Clean up expired tasks (older than 1 week)
      const activeTasks = loadedTasks.filter(t => !isTaskExpired(t));
      if (activeTasks.length !== loadedTasks.length) {
        // Cancel notifications for expired tasks
        for (const expired of loadedTasks.filter(t => isTaskExpired(t))) {
          if (expired.notificationId) {
            await cancelNotification(expired.notificationId);
          }
        }
        await setItem(STORAGE_KEYS.TASKS, activeTasks);
      }

      const userTasks = activeTasks.filter(t => t.userId === userId);
      setTasks(userTasks);
    } catch (e) {
      setError('Failed to load tasks.');
    } finally {
      setIsLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    reload();
  }, [reload]);

  // ── CRUD ───────────────────────────────────────────────────────────────────
  // All write paths read from storage before writing so a burst of updates
  // issued before React re-renders can't drop writes by reading a stale list.

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

      const now = new Date().toISOString();
      let notificationId: string | null = null;

      if (payload.dueDate && payload.dueTime) {
        notificationId = await scheduleTaskReminder(
          payload.title,
          payload.dueDate,
          payload.dueTime,
        );
      }

      const task: Task = {
        ...payload,
        id: generateId(),
        userId,
        notificationId,
        createdAt: now,
        updatedAt: now,
      };

      // Read storage to derive the merged list atomically — guards against
      // a concurrent write from another user between the previous and this call.
      const all = (await getItem<Task[]>(STORAGE_KEYS.TASKS)) ?? [];
      const others = all.filter(t => t.userId !== userId);
      const next = [...others, ...all.filter(t => t.userId === userId), task];
      await setItem(STORAGE_KEYS.TASKS, next);
      setTasks(next.filter(t => t.userId === userId));
      return task;
    },
    [userId],
  );

  const updateTask = useCallback(
    async (id: string, payload: UpdateTaskPayload): Promise<void> => {
      // Read the current user-scoped list from storage to avoid a stale closure.
      const all = (await getItem<Task[]>(STORAGE_KEYS.TASKS)) ?? [];
      const userTasks = all.filter(t => t.userId === userId);

      // Find the task to get its current due date/time for validation
      const task = userTasks.find(t => t.id === id);
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

      const updated = await Promise.all(
        userTasks.map(async t => {
          if (t.id !== id) return t;

          const newDueDate = payload.dueDate !== undefined ? payload.dueDate : t.dueDate;
          const newDueTime = payload.dueTime !== undefined ? payload.dueTime : t.dueTime;
          const dueChanged =
            payload.dueDate !== undefined || payload.dueTime !== undefined;

          // Reschedule notification whenever the due pair changes.
          if (dueChanged && t.notificationId) {
            await cancelNotification(t.notificationId);
          }

          let notificationId = t.notificationId;
          if (newDueDate && newDueTime) {
            notificationId = await scheduleTaskReminder(
              payload.title ?? t.title,
              newDueDate,
              newDueTime,
            );
          } else if (dueChanged) {
            // The task lost its due date/time — clear the reminder.
            notificationId = null;
          }

          return {
            ...t,
            ...payload,
            notificationId,
            updatedAt: new Date().toISOString(),
          };
        }),
      );

      const others = all.filter(t => t.userId !== userId);
      await setItem(STORAGE_KEYS.TASKS, [...others, ...updated]);
      setTasks(updated);
    },
    [userId],
  );

  const deleteTask = useCallback(
    async (id: string) => {
      const all = (await getItem<Task[]>(STORAGE_KEYS.TASKS)) ?? [];
      const userTasks = all.filter(t => t.userId === userId);
      const target = userTasks.find(t => t.id === id);
      if (target?.notificationId) {
        await cancelNotification(target.notificationId);
      }
      const remaining = userTasks.filter(t => t.id !== id);
      const others = all.filter(t => t.userId !== userId);
      await setItem(STORAGE_KEYS.TASKS, [...others, ...remaining]);
      setTasks(remaining);
    },
    [userId],
  );

  const toggleComplete = useCallback(
    async (id: string) => {
      const all = (await getItem<Task[]>(STORAGE_KEYS.TASKS)) ?? [];
      const userTasks = all.filter(t => t.userId === userId);
      const updated = userTasks.map(t =>
        t.id === id
          ? {
              ...t,
              isCompleted: !t.isCompleted,
              status: (!t.isCompleted ? 'completed' : 'pending') as Task['status'],
              updatedAt: new Date().toISOString(),
            }
          : t,
      );
      const others = all.filter(t => t.userId !== userId);
      await setItem(STORAGE_KEYS.TASKS, [...others, ...updated]);
      setTasks(updated);
    },
    [userId],
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
