import {
  accountExists,
  authenticateAccount,
  registerAccount,
} from '../src/services/authService';
import {
  login,
  register,
  requestPasswordReset,
} from '../src/services/apiService';
import { User } from '../src/models/User';

jest.mock('../src/services/apiService', () => ({
  register: jest.fn(),
  login: jest.fn(),
  requestPasswordReset: jest.fn(),
}));

const mockRegister = register as jest.MockedFunction<typeof register>;
const mockLogin = login as jest.MockedFunction<typeof login>;
const mockRequestPasswordReset = requestPasswordReset as jest.MockedFunction<typeof requestPasswordReset>;

const backendUser: User = {
  id: 'backend-user-001',
  email: 'student@example.com',
  username: 'student01',
  displayName: 'student01',
  isEmailVerified: false,
  createdAt: '2026-07-21T10:00:00.000Z',
};

beforeEach(() => {
  jest.clearAllMocks();
});

describe('authService', () => {
  it('registers accounts through the backend only', async () => {
    mockRegister.mockResolvedValue({ user: backendUser, token: 'jwt-token' });

    await expect(registerAccount({
      email: ' Student@Example.com ',
      username: 'student01',
      password: 'secret123',
      confirmPassword: 'secret123',
    })).resolves.toEqual(backendUser);

    expect(mockRegister).toHaveBeenCalledWith('student@example.com', 'student01', 'secret123');
  });

  it('authenticates through the backend only', async () => {
    mockLogin.mockResolvedValue({ user: backendUser, token: 'jwt-token' });

    await expect(authenticateAccount(' Student01 ', 'secret123')).resolves.toEqual(backendUser);
    expect(mockLogin).toHaveBeenCalledWith('student01', 'secret123');
  });

  it('does not fall back to local accounts when the backend fails', async () => {
    mockLogin.mockRejectedValue(new Error('Network request failed'));

    await expect(authenticateAccount('student01', 'secret123'))
      .rejects
      .toThrow('Network request failed');
  });

  it('checks account existence through the backend only', async () => {
    mockRequestPasswordReset.mockResolvedValue({ exists: true });

    await expect(accountExists('student@example.com')).resolves.toBe(true);
    expect(mockRequestPasswordReset).toHaveBeenCalledWith('student@example.com');
  });
});
