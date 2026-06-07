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

/**
 * Returns true if a task is past its due date and not completed.
 */
function isOverdue(task: Task): boolean {
  if (!task.dueDate || task.isCompleted) return false;
  const due = new Date(task.dueDate);
  due.setHours(23, 59, 59);
  return due < new Date();
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
      const userTasks = (stored ?? []).filter(t => t.userId === userId);
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

  // ── Persist helper ─────────────────────────────────────────────────────────
  const persist = async (updated: Task[]) => {
    // Merge with other users' tasks before saving
    const all = await getItem<Task[]>(STORAGE_KEYS.TASKS) ?? [];
    const others = all.filter(t => t.userId !== userId);
    await setItem(STORAGE_KEYS.TASKS, [...others, ...updated]);
    setTasks(updated);
  };

  // ── CRUD ───────────────────────────────────────────────────────────────────

  const createTask = useCallback(
    async (payload: CreateTaskPayload): Promise<Task> => {
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

      const updated = [...tasks, task];
      await persist(updated);
      return task;
    },
    [tasks, userId],
  );

  const updateTask = useCallback(
    async (id: string, payload: UpdateTaskPayload): Promise<void> => {
      const updated = await Promise.all(
        tasks.map(async t => {
          if (t.id !== id) return t;

          // Reschedule notification if due date/time changed
          if (
            (payload.dueDate !== undefined || payload.dueTime !== undefined) &&
            t.notificationId
          ) {
            await cancelNotification(t.notificationId);
          }

          const newDueDate = payload.dueDate ?? t.dueDate;
          const newDueTime = payload.dueTime ?? t.dueTime;
          let notificationId = t.notificationId;

          if (newDueDate && newDueTime) {
            notificationId = await scheduleTaskReminder(
              payload.title ?? t.title,
              newDueDate,
              newDueTime,
            );
          }

          return {
            ...t,
            ...payload,
            notificationId,
            updatedAt: new Date().toISOString(),
          };
        }),
      );
      await persist(updated);
    },
    [tasks],
  );

  const deleteTask = useCallback(
    async (id: string): Promise<void> => {
      const task = tasks.find(t => t.id === id);
      if (task?.notificationId) {
        await cancelNotification(task.notificationId);
      }
      const updated = tasks.filter(t => t.id !== id);
      await persist(updated);
    },
    [tasks],
  );

  const toggleComplete = useCallback(
    async (id: string): Promise<void> => {
      const updated = tasks.map(t =>
        t.id === id
          ? {
              ...t,
              isCompleted: !t.isCompleted,
              status: (!t.isCompleted ? 'completed' : 'pending') as Task['status'],
              updatedAt: new Date().toISOString(),
            }
          : t,
      );
      await persist(updated);
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
