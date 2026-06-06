/**
 * Task Model
 * Defines data structures for the Task/To-Do Management module.
 */

import { GeoLocation } from './Location';

export type TaskPriority = 'low' | 'medium' | 'high';
export type TaskStatus = 'pending' | 'in_progress' | 'completed';

export interface Task {
  id: string;
  userId: string;
  title: string;
  description: string;
  priority: TaskPriority;
  status: TaskStatus;
  isCompleted: boolean;
  dueDate: string | null;   // ISO 8601
  dueTime: string | null;   // HH:MM
  location: GeoLocation | null;
  notificationId: string | null; // expo-notifications identifier
  createdAt: string;
  updatedAt: string;
}

export type CreateTaskPayload = Omit<
  Task,
  'id' | 'userId' | 'createdAt' | 'updatedAt' | 'notificationId'
>;

export type UpdateTaskPayload = Partial<
  Omit<Task, 'id' | 'userId' | 'createdAt' | 'updatedAt'>
>;
