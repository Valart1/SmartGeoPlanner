import {
  authenticateAccount,
  registerAccount,
} from '../src/services/authService';

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
    Object.keys(mockStore).forEach(key => delete mockStore[key]);
  }),
}));

beforeEach(() => {
  Object.keys(mockStore).forEach(key => delete mockStore[key]);
  jest.clearAllMocks();
});

describe('authService', () => {
  it('authenticates only registered accounts with matching passwords', async () => {
    const user = await registerAccount({
      email: 'student@example.com',
      username: 'student01',
      password: 'secret123',
      confirmPassword: 'secret123',
    });

    await expect(authenticateAccount('student@example.com', 'wrong-password'))
      .rejects
      .toThrow('Invalid email/username or password.');

    await expect(authenticateAccount('unknown@example.com', 'secret123'))
      .rejects
      .toThrow('Invalid email/username or password.');

    await expect(authenticateAccount('student01', 'secret123'))
      .resolves
      .toEqual(user);
  });

  it('rejects duplicate email addresses and usernames', async () => {
    await registerAccount({
      email: 'student@example.com',
      username: 'student01',
      password: 'secret123',
      confirmPassword: 'secret123',
    });

    await expect(registerAccount({
      email: 'student@example.com',
      username: 'student02',
      password: 'secret123',
      confirmPassword: 'secret123',
    })).rejects.toThrow('An account with this email already exists.');

    await expect(registerAccount({
      email: 'other@example.com',
      username: 'student01',
      password: 'secret123',
      confirmPassword: 'secret123',
    })).rejects.toThrow('This username is already taken.');
  });
});
