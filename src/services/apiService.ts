/**
 * API Service
 * Connects the React Native app to the PostgreSQL backend.
 */

import { Task, CreateTaskPayload, UpdateTaskPayload } from '../models/Task';
import { CalendarEvent, CreateEventPayload, UpdateEventPayload } from '../models/Event';
import { User } from '../models/User';
import { toLocalDateString } from '../utils/dateUtils';

// Prefer an explicit Expo public API URL when provided. Otherwise try the LAN
// backend first for Expo Go on a phone, then localhost for web/emulators.
const API_BASE_URLS = [
  process.env.EXPO_PUBLIC_API_URL,
  'http://192.168.1.64:3000/api',
  'http://localhost:3000/api',
].filter(Boolean) as string[];
const API_REQUEST_TIMEOUT_MS = 5000;
let authToken: string | null = null;

function normalizeDate(value: unknown): string | null {
  if (value === null || value === undefined || value === '') return null;
  if (value instanceof Date) return toLocalDateString(value);
  // String input: keep the date portion (YYYY-MM-DD) untouched so we never
  // shift a YYYY-MM-DD string into a different day due to UTC conversion.
  return String(value).split('T')[0];
}

function normalizeTask<T extends Task>(task: T): T {
  return {
    ...task,
    dueDate: normalizeDate(task.dueDate),
  };
}

function normalizeEvent<T extends CalendarEvent>(event: T): T {
  return {
    ...event,
    date: normalizeDate(event.date) ?? event.date,
  };
}

// Get stored token
export async function getToken(): Promise<string | null> {
  return authToken;
}

// Store token
export async function setToken(token: string): Promise<void> {
  authToken = token;
}

// Remove token
export async function removeToken(): Promise<void> {
  authToken = null;
}

async function apiRequest<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const token = await getToken();
  const headers = new Headers(options.headers);
  
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }
  headers.set('Content-Type', 'application/json');

  let lastError: Error | null = null;
  
  // Try each API URL
  for (let i = 0; i < API_BASE_URLS.length; i++) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), API_REQUEST_TIMEOUT_MS);

    try {
      const response = await fetch(`${API_BASE_URLS[i]}${endpoint}`, {
        ...options,
        headers,
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error((await response.json()).error || 'API request failed');
      }

      return response.json();
    } catch (error) {
      lastError = error as Error;
    } finally {
      clearTimeout(timeoutId);
    }
  }
  throw lastError || new Error('API request failed');
}

// Auth API
export async function register(email: string, username: string, password: string): Promise<{ user: User; token: string }> {
  const data = await apiRequest<{ user: User; token: string }>('/auth/register', {
    method: 'POST',
    body: JSON.stringify({ email, username, password }),
  });
  await setToken(data.token);
  return data;
}

export async function login(identifier: string, password: string): Promise<{ user: User; token: string }> {
  const data = await apiRequest<{ user: User; token: string }>('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ identifier, password }),
  });
  await setToken(data.token);
  return data;
}

export async function logout(): Promise<void> {
  await removeToken();
}

export async function requestPasswordReset(identifier: string): Promise<{ exists: boolean }> {
  return apiRequest<{ exists: boolean }>('/auth/forgot-password', {
    method: 'POST',
    body: JSON.stringify({ identifier }),
  });
}

export async function getCurrentUser(): Promise<User> {
  const data = await apiRequest<{ user: User }>('/auth/me');
  return data.user;
}

export async function deleteCurrentUser(): Promise<void> {
  await apiRequest('/auth/me', {
    method: 'DELETE',
  });
  await removeToken();
}

// Tasks API
export async function getTasks(): Promise<Task[]> {
  const data = await apiRequest<{ tasks: Task[] }>('/tasks');
  return data.tasks.map(normalizeTask);
}

export async function createTask(payload: CreateTaskPayload): Promise<Task> {
  const data = await apiRequest<{ task: Task }>('/tasks', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  return normalizeTask(data.task);
}

export async function updateTask(id: string, payload: UpdateTaskPayload): Promise<void> {
  await apiRequest(`/tasks/${id}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  });
}

export async function deleteTask(id: string): Promise<void> {
  await apiRequest(`/tasks/${id}`, {
    method: 'DELETE',
  });
}

// Events API
export async function getEvents(): Promise<CalendarEvent[]> {
  const data = await apiRequest<{ events: CalendarEvent[] }>('/events');
  return data.events.map(normalizeEvent);
}

export async function createEvent(payload: CreateEventPayload): Promise<CalendarEvent> {
  const data = await apiRequest<{ event: CalendarEvent }>('/events', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  return normalizeEvent(data.event);
}

export async function updateEvent(id: string, payload: UpdateEventPayload): Promise<void> {
  await apiRequest(`/events/${id}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  });
}

export async function deleteEvent(id: string): Promise<void> {
  await apiRequest(`/events/${id}`, {
    method: 'DELETE',
  });
}

// Admin API
export interface AdminStats {
  totalUsers: number;
  totalTasks: number;
  totalEvents: number;
  completedTasks: number;
}

export async function getAdminStats(): Promise<AdminStats> {
  const data = await apiRequest<{ stats: AdminStats }>('/admin/stats');
  return data.stats;
}

export async function getAllUsers(): Promise<Array<User & { is_admin: boolean }>> {
  const data = await apiRequest<{ users: Array<User & { is_admin: boolean }> }>('/admin/users');
  return data.users;
}

export async function getAllTasks(): Promise<Array<Task & { user_email: string; user_username: string }>> {
  const data = await apiRequest<{ tasks: Array<Task & { user_email: string; user_username: string }> }>('/admin/tasks');
  return data.tasks.map(normalizeTask);
}

export async function getAllEvents(): Promise<Array<CalendarEvent & { user_email: string; user_username: string }>> {
  const data = await apiRequest<{ events: Array<CalendarEvent & { user_email: string; user_username: string }> }>('/admin/events');
  return data.events.map(normalizeEvent);
}
