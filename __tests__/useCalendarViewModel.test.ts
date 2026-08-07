import { act, renderHook } from '@testing-library/react-native';
import { useCalendarViewModel } from '../src/viewmodels/useCalendarViewModel';
import { CalendarEvent, CreateEventPayload } from '../src/models/Event';
import { todayString } from '../src/utils/dateUtils';

const USER_ID = 'test-user-001';

let mockEvents: CalendarEvent[];
let mockNextId = 0;

function mockMakeId(): string {
  mockNextId += 1;
  return `event-${mockNextId}`;
}

jest.mock('../src/services/apiService', () => ({
  getEvents: jest.fn(async (): Promise<CalendarEvent[]> => mockEvents),
  createEvent: jest.fn(async (payload: CreateEventPayload): Promise<CalendarEvent> => {
    const now = new Date().toISOString();
    const event: CalendarEvent = {
      ...payload,
      id: mockMakeId(),
      userId: USER_ID,
      notificationId: null,
      date: `${payload.date}T00:00:00.000Z`,
      createdAt: now,
      updatedAt: now,
    };
    mockEvents.push(event);
    return event;
  }),
  updateEvent: jest.fn(async (id: string, updates: Partial<CalendarEvent>): Promise<void> => {
    mockEvents = mockEvents.map(event => event.id === id ? { ...event, ...updates } : event);
  }),
  deleteEvent: jest.fn(async (id: string): Promise<void> => {
    mockEvents = mockEvents.filter(event => event.id !== id);
  }),
}));

jest.mock('../src/services/notificationService', () => ({
  scheduleEventReminder: jest.fn().mockResolvedValue('mock-event-notification-id'),
  cancelNotification: jest.fn().mockResolvedValue(undefined),
}));

function daysFromNow(days: number): string {
  // Use the same local-tz helper as production code so the test date matches
  // what the viewmodel considers "today".
  const [y, m, d] = todayString().split('-').map(Number);
  const date = new Date(y, m - 1, d);
  date.setDate(date.getDate() + days);
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

beforeEach(() => {
  mockEvents = [];
  mockNextId = 0;
  jest.clearAllMocks();
});

describe('useCalendarViewModel', () => {
  it('shows a created event on the selected day and keeps its map location', async () => {
    const eventDate = daysFromNow(1);
    const location = { latitude: 52.2297, longitude: 21.0122 };
    const { result } = renderHook(() => useCalendarViewModel(USER_ID));

    await act(async () => {});
    act(() => result.current.setSelectedDate(eventDate));

    await act(async () => {
      await result.current.createEvent({
        title: 'Site visit',
        description: 'Check planned location',
        date: eventDate,
        startTime: '10:00',
        endTime: '11:00',
        color: '#6C63FF',
        isAllDay: false,
        location,
      });
    });

    expect(result.current.eventsForSelectedDate).toHaveLength(1);
    expect(result.current.eventsForSelectedDate[0]).toMatchObject({
      title: 'Site visit',
      date: eventDate,
      location,
      notificationId: 'mock-event-notification-id',
    });
    expect(result.current.allEvents.filter(event => event.location)).toHaveLength(1);
  });

  it('still shows a backend-saved event when notification scheduling fails', async () => {
    const { scheduleEventReminder } = require('../src/services/notificationService');
    scheduleEventReminder.mockRejectedValueOnce(new Error('Notifications unavailable'));

    const eventDate = daysFromNow(1);
    const { result } = renderHook(() => useCalendarViewModel(USER_ID));

    await act(async () => {});
    act(() => result.current.setSelectedDate(eventDate));

    await act(async () => {
      await result.current.createEvent({
        title: 'Backend event',
        description: '',
        date: eventDate,
        startTime: '12:00',
        endTime: '13:00',
        color: '#43C6AC',
        isAllDay: false,
        location: { latitude: 50, longitude: 20 },
      });
    });

    expect(result.current.eventsForSelectedDate).toHaveLength(1);
    expect(result.current.eventsForSelectedDate[0].title).toBe('Backend event');
    expect(result.current.eventsForSelectedDate[0].notificationId).toBeNull();
  });
});
