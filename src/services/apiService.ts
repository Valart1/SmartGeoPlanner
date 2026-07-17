/**
 * API Service
 * Connects the React Native app to the PostgreSQL backend
 */

import { Task, CreateTaskPayload, UpdateTaskPayload } from '../models/Task';
import { CalendarEvent, CreateEventPayload, UpdateEventPayload } from '../models/Event';
import { User } from '../models/User';

const API_BASE_URL = 'http://localhost:3000/api';

// Get stored token
async function getToken(): Promise<string | null> {
  const AsyncStorage = require('@react-native-async-storage/async-storage').default;
  return AsyncStorage.getItem('auth_token');
}

// Store token
async function setToken(token: string): Promise<void> {
  const AsyncStorage = require('@react-native-async-storage/async-storage').default;
  return AsyncStorage.setItem('auth_token', token);
}

// Remove token
async function removeToken(): Promise<void> {
  const AsyncStorage = require('@react-native-async-storage/async-storage').default;
  return AsyncStorage.removeItem('auth_token');
}

// API request helper
async function apiRequest<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const token = await getToken();
  const headers = new Headers(options.headers);
  
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }
  headers.set('Content-Type', 'application/json');

  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...options,
    headers,
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'API request failed');
  }

  return response.json();
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

export async function getCurrentUser(): Promise<User> {
  const data = await apiRequest<{ user: User }>('/auth/me');
  return data.user;
}

// Tasks API
export async function getTasks(): Promise<Task[]> {
  const data = await apiRequest<{ tasks: Task[] }>('/tasks');
  return data.tasks;
}

export async function createTask(payload: CreateTaskPayload): Promise<Task> {
  const data = await apiRequest<{ task: Task }>('/tasks', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  return data.task;
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
  return data.events;
}

export async function createEvent(payload: CreateEventPayload): Promise<CalendarEvent> {
  const data = await apiRequest<{ event: CalendarEvent }>('/events', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  return data.event;
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
  return data.tasks;
}

export async function getAllEvents(): Promise<Array<CalendarEvent & { user_email: string; user_username: string }>> {
  const data = await apiRequest<{ events: Array<CalendarEvent & { user_email: string; user_username: string }> }>('/admin/events');
  return data.events;
}
