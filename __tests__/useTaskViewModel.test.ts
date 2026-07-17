/**
 * useTaskViewModel Unit Tests
 *
 * Tests business logic in isolation using Jest + @testing-library/react-native.
 * All external dependencies (apiService, notifications) are mocked. The viewmodel
 * now persists via the PostgreSQL backend (apiService), so we mock apiService
 * with an in-memory store instead of AsyncStorage.
 */

import { renderHook, act } from '@testing-library/react-native';
import { useTaskViewModel } from '../src/viewmodels/useTaskViewModel';
import { Task, CreateTaskPayload } from '../src/models/Task';

// ─── In-memory API mock ─────────────────────────────────────────────────────

const USER_ID = 'test-user-001';

let taskStore: Map<string, Task>;
let nextId = 0;

function makeId(): string {
  nextId += 1;
  return `task-${nextId}`;
}

const apiMock = {
  getTasks: jest.fn(async (): Promise<Task[]> => Array.from(taskStore.values())),
  createTask: jest.fn(async (payload: CreateTaskPayload): Promise<Task> => {
    const now = new Date().toISOString();
    const task: Task = {
      ...payload,
      id: makeId(),
      userId: USER_ID,
      notificationId: payload.notificationId ?? null,
      createdAt: now,
      updatedAt: now,
    };
    taskStore.set(task.id, task);
    return task;
  }),
  updateTask: jest.fn(async (id: string, updates: Partial<Task>): Promise<void> => {
    const existing = taskStore.get(id);
    if (!existing) return;
    const updated = { ...existing, ...updates, updatedAt: new Date().toISOString() };
    taskStore.set(id, updated);
  }),
  deleteTask: jest.fn(async (id: string): Promise<void> => {
    taskStore.delete(id);
  }),
};

jest.mock('../src/services/apiService', () => apiMock);

// Mock notification service so no real OS calls are made during tests
jest.mock('../src/services/notificationService', () => ({
  scheduleTaskReminder: jest.fn().mockResolvedValue('mock-notification-id'),
  cancelNotification: jest.fn().mockResolvedValue(undefined),
}));

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Base payload reused across tests */
const basePayload: CreateTaskPayload = {
  title: 'Buy groceries',
  description: 'Milk, eggs, bread',
  priority: 'medium',
  status: 'pending',
  isCompleted: false,
  dueDate: null,
  dueTime: null,
  location: null,
};

/** A payload whose due date is in the past → should appear as overdue */
const overduePayload: CreateTaskPayload = {
  ...basePayload,
  title: 'Overdue task',
  dueDate: '2020-01-01',
  dueTime: '09:00',
};

// Reset the in-memory store + mock call history before each test
beforeEach(() => {
  taskStore = new Map();
  nextId = 0;
  jest.clearAllMocks();
});

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('useTaskViewModel', () => {
  // ── Initialization ──────────────────────────────────────────────────────────

  it('initialises with an empty task list and isLoading=false', async () => {
    const { result } = renderHook(() => useTaskViewModel(USER_ID));

    await act(async () => {});

    expect(result.current.tasks).toHaveLength(0);
    expect(result.current.isLoading).toBe(false);
    expect(result.current.error).toBeNull();
  });

  // ── Create ──────────────────────────────────────────────────────────────────

  it('createTask adds a task with correct shape', async () => {
    const { result } = renderHook(() => useTaskViewModel(USER_ID));
    await act(async () => {});

    await act(async () => {
      await result.current.createTask(basePayload);
    });

    expect(result.current.tasks).toHaveLength(1);
    const task = result.current.tasks[0];
    expect(task.title).toBe('Buy groceries');
    expect(task.userId).toBe(USER_ID);
    expect(task.id).toMatch(/^task-/);
    expect(task.isCompleted).toBe(false);
    expect(task.status).toBe('pending');
    expect(task.createdAt).toBeTruthy();
    expect(task.updatedAt).toBeTruthy();
  });

  it('assigns unique IDs when multiple tasks are created', async () => {
    const { result } = renderHook(() => useTaskViewModel(USER_ID));
    await act(async () => {});

    await act(async () => { await result.current.createTask(basePayload); });
    await act(async () => { await result.current.createTask({ ...basePayload, title: 'Task 2' }); });
    await act(async () => { await result.current.createTask({ ...basePayload, title: 'Task 3' }); });

    expect(result.current.tasks).toHaveLength(3);
    const ids = result.current.tasks.map(t => t.id);
    expect(new Set(ids).size).toBe(3);
  });

  // ── Toggle complete ─────────────────────────────────────────────────────────

  it('toggleComplete flips isCompleted and status correctly', async () => {
    const { result } = renderHook(() => useTaskViewModel(USER_ID));
    await act(async () => {});

    let taskId: string;
    await act(async () => {
      const task = await result.current.createTask(basePayload);
      taskId = task.id;
    });

    // Mark complete
    await act(async () => { await result.current.toggleComplete(taskId!); });
    expect(result.current.tasks[0].isCompleted).toBe(true);
    expect(result.current.tasks[0].status).toBe('completed');

    // Unmark complete
    await act(async () => { await result.current.toggleComplete(taskId!); });
    expect(result.current.tasks[0].isCompleted).toBe(false);
    expect(result.current.tasks[0].status).toBe('pending');
  });

  // ── Update ──────────────────────────────────────────────────────────────────

  it('updateTask changes title and priority without touching other fields', async () => {
    const { result } = renderHook(() => useTaskViewModel(USER_ID));
    await act(async () => {});

    let taskId: string;
    await act(async () => {
      const task = await result.current.createTask(basePayload);
      taskId = task.id;
    });

    await act(async () => {
      await result.current.updateTask(taskId!, { title: 'Updated title', priority: 'high' });
    });

    const updated = result.current.tasks.find(t => t.id === taskId);
    expect(updated).toBeDefined();
    expect(updated!.title).toBe('Updated title');
    expect(updated!.priority).toBe('high');
    expect(updated!.description).toBe('Milk, eggs, bread'); // unchanged
  });

  // ── Delete ──────────────────────────────────────────────────────────────────

  it('deleteTask removes the task from the list', async () => {
    const { result } = renderHook(() => useTaskViewModel(USER_ID));
    await act(async () => {});

    let taskId: string;
    await act(async () => {
      const task = await result.current.createTask(basePayload);
      taskId = task.id;
    });

    expect(result.current.tasks).toHaveLength(1);

    await act(async () => { await result.current.deleteTask(taskId!); });

    expect(result.current.tasks).toHaveLength(0);
  });

  // ── Derived lists ───────────────────────────────────────────────────────────

  it('overdueTasks correctly identifies past-due incomplete tasks', async () => {
    const { result } = renderHook(() => useTaskViewModel(USER_ID));
    await act(async () => {});

    await act(async () => { await result.current.createTask(basePayload); });    // no due date → pending
    await act(async () => { await result.current.createTask(overduePayload); }); // past due → overdue

    expect(result.current.tasks).toHaveLength(2);
    expect(result.current.pendingTasks).toHaveLength(1);
    expect(result.current.overdueTasks).toHaveLength(1);
    expect(result.current.completedTasks).toHaveLength(0);
    expect(result.current.overdueTasks[0].title).toBe('Overdue task');
  });

  it('completedTasks are excluded from pendingTasks and overdueTasks', async () => {
    const { result } = renderHook(() => useTaskViewModel(USER_ID));
    await act(async () => {});

    let taskId: string;
    await act(async () => {
      const t = await result.current.createTask(basePayload);
      taskId = t.id;
    });

    await act(async () => { await result.current.toggleComplete(taskId!); });

    expect(result.current.completedTasks).toHaveLength(1);
    expect(result.current.pendingTasks).toHaveLength(0);
    expect(result.current.overdueTasks).toHaveLength(0);
  });

  // ── Lookup ──────────────────────────────────────────────────────────────────

  it('getTaskById returns the correct task or undefined', async () => {
    const { result } = renderHook(() => useTaskViewModel(USER_ID));
    await act(async () => {});

    let taskId: string;
    await act(async () => {
      const task = await result.current.createTask(basePayload);
      taskId = task.id;
    });

    const found = result.current.getTaskById(taskId!);
    expect(found).toBeDefined();
    expect(found!.title).toBe('Buy groceries');

    const missing = result.current.getTaskById('non-existent-id');
    expect(missing).toBeUndefined();
  });

  // ── Regression: back-to-back updates ────────────────────────────────────────

  it('applies back-to-back updates without losing intermediate state', async () => {
    const { result } = renderHook(() => useTaskViewModel(USER_ID));
    await act(async () => {});

    let taskId: string;
    await act(async () => {
      const task = await result.current.createTask(basePayload);
      taskId = task.id;
    });

    await act(async () => {
      await result.current.updateTask(taskId!, { title: 'First update' });
      await result.current.updateTask(taskId!, { priority: 'high' });
    });

    const after = result.current.tasks.find(t => t.id === taskId);
    expect(after).toBeDefined();
    expect(after!.title).toBe('First update');
    expect(after!.priority).toBe('high');
  });

  // Clearing the due date must also clear the scheduled notification id,
  // otherwise the reminder would still fire after the task becomes dateless.

  it('clears the notification id when a task loses its due date', async () => {
    const { result } = renderHook(() => useTaskViewModel(USER_ID));
    await act(async () => {});

    let taskId: string;
    await act(async () => {
      const task = await result.current.createTask({
        ...basePayload,
        dueDate: '2099-01-01',
        dueTime: '09:00',
      });
      taskId = task.id;
    });

    expect(result.current.tasks[0].notificationId).toBe('mock-notification-id');

    await act(async () => {
      await result.current.updateTask(taskId!, { dueDate: null, dueTime: null });
    });

    expect(result.current.tasks[0].notificationId).toBeNull();
  });
});
