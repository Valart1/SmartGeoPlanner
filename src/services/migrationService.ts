/**
 * Migration Service
 * Migrates local AsyncStorage data to the PostgreSQL backend
 */

import { getItem, removeItem, STORAGE_KEYS } from './storageService';
import { Task } from '../models/Task';
import { CalendarEvent } from '../models/Event';
import { createTask, createEvent } from './apiService';

/**
 * Migrates local tasks and events to the backend
 * This should be called after successful login when the user has no data on the backend
 */
export async function migrateLocalData(): Promise<void> {
  try {
    // Check if we have local tasks
    const localTasks = await getItem<Task[]>(STORAGE_KEYS.TASKS);
    if (localTasks && localTasks.length > 0) {
      console.log(`Migrating ${localTasks.length} local tasks...`);
      
      for (const task of localTasks) {
        const payload = {
          title: task.title,
          description: task.description,
          priority: task.priority,
          status: task.status,
          isCompleted: task.isCompleted,
          dueDate: task.dueDate,
          dueTime: task.dueTime,
          location: task.location,
        };
        
        try {
          await createTask(payload);
        } catch (error) {
          console.error('Failed to migrate task:', error);
        }
      }
      
      // Clear local tasks after successful migration
      await removeItem(STORAGE_KEYS.TASKS);
      console.log('Tasks migration completed');
    }

    // Check if we have local events
    const localEvents = await getItem<CalendarEvent[]>(STORAGE_KEYS.EVENTS);
    if (localEvents && localEvents.length > 0) {
      console.log(`Migrating ${localEvents.length} local events...`);
      
      for (const event of localEvents) {
        const payload = {
          title: event.title,
          description: event.description,
          date: event.date,
          startTime: event.startTime,
          endTime: event.endTime,
          color: event.color,
          location: event.location,
          isAllDay: event.isAllDay,
        };
        
        try {
          await createEvent(payload);
        } catch (error) {
          console.error('Failed to migrate event:', error);
        }
      }
      
      // Clear local events after successful migration
      await removeItem(STORAGE_KEYS.EVENTS);
      console.log('Events migration completed');
    }
  } catch (error) {
    console.error('Migration failed:', error);
  }
}