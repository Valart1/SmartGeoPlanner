/**
 * useTaskViewModel Unit Tests
 *
 * Tests business logic in isolation using Jest + @testing-library/react-native.
 * All external dependencies (AsyncStorage, notifications) are mocked.
 */

import { renderHook, act } from '@testing-library/react-native';
import { useTaskViewModel } from '../src/viewmodels/useTaskViewModel';
import { CreateTaskPayload } from '../src/models/Task';

// ─── Mocks ────────────────────────────────────────────────────────────────────

// Mock AsyncStorage with an in-memory store per test
const mockStore: Record<string, string> = {};

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(async (key: string) => mockStore[key] ?? null),
  setItem: jest.fn(async (key: string, value: string) => {
    mockStore[key] = value;
  }),
  removeItem: jest.fn(async (key: string) => {
    delete mockStore[key];
  }),
  clear: jest.fn(async () => {
    Object.keys(mockStore).forEach(k => delete mockStore[k]);
  }),
}));

// Mock notification service so no real OS calls are made during tests
jest.mock('../src/services/notificationService', () => ({
  scheduleTaskReminder: jest.fn().mockResolvedValue('mock-notification-id'),
  cancelNotification: jest.fn().mockResolvedValue(undefined),
}));

// ─── Helpers ──────────────────────────────────────────────────────────────────

const USER_ID = 'test-user-001';

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

// Clear the in-memory store before each test to prevent cross-test pollution
beforeEach(() => {
  Object.keys(mockStore).forEach(k => delete mockStore[k]);
  jest.clearAllMocks();
});

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('useTaskViewModel', () => {
  // ── Initialization ──────────────────────────────────────────────────────────

  it('initialises with an empty task list and isLoading=false', async () => {
    const { result } = renderHook(() => useTaskViewModel(USER_ID));

    // Wait for the async load to finish
    await act(async () => {});

    expect(result.current.tasks).toHaveLength(0);
    expect(result.current.isLoading).toBe(false);
    expect(result.current.error).toBeNull();
  });

  // ── Create ──────────────────────────────────────────────────────────────────

  it('createTask adds a task with correct shape and userId', async () => {
    const { result } = renderHook(() => useTaskViewModel(USER_ID));
    await act(async () => {});

    await act(async () => {
      await result.current.createTask(basePayload);
    });

    expect(result.current.tasks).toHaveLength(1);
    const task = result.current.tasks[0];
    expect(task.title).toBe('Buy groceries');
    expect(task.userId).toBe(USER_ID);
    expect(task.id).toMatch(/^task_/);
    expect(task.isCompleted).toBe(false);
    expect(task.status).toBe('pending');
    expect(task.createdAt).toBeTruthy();
    expect(task.updatedAt).toBeTruthy();
  });

  it('assigns unique IDs when multiple tasks are created', async () => {
    const { result } = renderHook(() => useTaskViewModel(USER_ID));
    await act(async () => {});

    // Each createTask must be in its own act() to avoid stale-closure state
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

    // Each createTask in its own act() so the hook sees updated state
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
});
