/**
 * useTaskViewModel
 * MVVM ViewModel for Task/To-Do management.
 * Handles CRUD operations, filtering, and notification scheduling.
 * Data is persisted via the PostgreSQL backend (apiService); the backend scopes
 * tasks to the authenticated user via the JWT, so userId is used only for
 * notification ownership, not for client-side filtering.
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
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
import { todayString } from '../utils/dateUtils';

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
  // Compare the YYYY-MM-DD strings directly: a due date equal to today is not
  // overdue (regardless of timezone), and anything earlier than today is.
  return task.dueDate < todayString();
}

const COMPLETED_TASK_VISIBLE_MS = 30 * 60 * 1000;

function mergeTask(tasks: Task[], task: Task): Task[] {
  const exists = tasks.some(item => item.id === task.id);
  return exists
    ? tasks.map(item => (item.id === task.id ? task : item))
    : [task, ...tasks];
}

function isCompletedTaskExpired(task: Task, nowMs: number): boolean {
  if (!task.isCompleted) return false;
  const completedAtMs = new Date(task.updatedAt).getTime();
  if (Number.isNaN(completedAtMs)) return false;
  return nowMs - completedAtMs >= COMPLETED_TASK_VISIBLE_MS;
}

export function useTaskViewModel(_userId: string): TaskViewModel {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [nowMs, setNowMs] = useState(() => Date.now());
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

  useEffect(() => {
    const intervalId = setInterval(() => setNowMs(Date.now()), 60 * 1000);
    return () => clearInterval(intervalId);
  }, []);

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

      const created = await apiCreateTask(payload);
      let taskWithNotification = created;

      setTasks(prev => mergeTask(prev, taskWithNotification));

      if (payload.dueDate && payload.dueTime) {
        try {
          const notificationId = await scheduleTaskReminder(
            payload.title,
            payload.dueDate,
            payload.dueTime,
          );
          if (notificationId) {
            taskWithNotification = { ...taskWithNotification, notificationId };
            await apiUpdateTask(created.id, { notificationId });
            setTasks(prev => mergeTask(prev, taskWithNotification));
          }
        } catch {
          // Notification setup should never hide a successfully saved task.
        }
      }

      return taskWithNotification;
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

  const visibleTasks = useMemo(
    () => tasks.filter(task => !isCompletedTaskExpired(task, nowMs)),
    [tasks, nowMs],
  );

  const getTaskById = (id: string) => visibleTasks.find(t => t.id === id);
  const clearError = () => setError(null);

  // ── Derived lists ──────────────────────────────────────────────────────────
  const pendingTasks = visibleTasks.filter(t => !t.isCompleted && !isOverdue(t));
  const completedTasks = visibleTasks.filter(t => t.isCompleted);
  const overdueTasks = visibleTasks.filter(t => isOverdue(t));

  return {
    tasks: visibleTasks,
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
