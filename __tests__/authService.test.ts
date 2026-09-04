import {
  accountExists,
  authenticateAccount,
  EmailNotVerifiedError,
  registerAccount,
  resendVerificationEmail,
} from '../src/services/authService';
import {
  login,
  register,
  requestPasswordReset,
  resendVerification,
} from '../src/services/apiService';
import { User } from '../src/models/User';

jest.mock('../src/services/apiService', () => ({
  register: jest.fn(),
  login: jest.fn(),
  requestPasswordReset: jest.fn(),
  resendVerification: jest.fn(),
}));

const mockRegister = register as jest.MockedFunction<typeof register>;
const mockLogin = login as jest.MockedFunction<typeof login>;
const mockRequestPasswordReset = requestPasswordReset as jest.MockedFunction<typeof requestPasswordReset>;
const mockResendVerification = resendVerification as jest.MockedFunction<typeof resendVerification>;

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
  it('registers accounts through the backend and reports email verification required', async () => {
    mockRegister.mockResolvedValue({
      user: backendUser,
      requiresEmailVerification: true,
      devVerifyUrl: 'http://localhost:3000/api/auth/verify-email?token=abc',
    });

    await expect(
      registerAccount({
        email: ' Student@Example.com ',
        username: 'student01',
        password: 'secret123',
        confirmPassword: 'secret123',
      }),
    ).resolves.toEqual({
      user: backendUser,
      requiresEmailVerification: true,
      devVerifyUrl: 'http://localhost:3000/api/auth/verify-email?token=abc',
    });

    expect(mockRegister).toHaveBeenCalledWith('student@example.com', 'student01', 'secret123');
  });

  it('authenticates through the backend only', async () => {
    mockLogin.mockResolvedValue({ user: backendUser, token: 'jwt-token' });

    await expect(authenticateAccount(' Student01 ', 'secret123')).resolves.toEqual(backendUser);
    expect(mockLogin).toHaveBeenCalledWith('student01', 'secret123');
  });

  it('throws EmailNotVerifiedError when the backend gate reports needsVerification', async () => {
    const err = new Error('Please verify your email before signing in.') as Error & {
      needsVerification?: boolean;
      email?: string;
    };
    err.needsVerification = true;
    err.email = 'student@example.com';
    mockLogin.mockRejectedValue(err);

    await expect(authenticateAccount('student01', 'secret123'))
      .rejects
      .toBeInstanceOf(EmailNotVerifiedError);
  });

  it('does not fall back to local accounts when the backend fails', async () => {
    mockLogin.mockRejectedValue(new Error('Network request failed'));

    await expect(authenticateAccount('student01', 'secret123'))
      .rejects
      .toThrow('Network request failed');
  });

  it('resends the verification link through the backend', async () => {
    mockResendVerification.mockResolvedValue({ message: 'sent', devVerifyUrl: undefined });

    await expect(resendVerificationEmail(' Student@Example.com ')).resolves.toEqual({
      message: 'sent',
      devVerifyUrl: undefined,
    });
    expect(mockResendVerification).toHaveBeenCalledWith('student@example.com');
  });

  it('checks account existence through the backend only', async () => {
    mockRequestPasswordReset.mockResolvedValue({ exists: true });

    await expect(accountExists('student@example.com')).resolves.toBe(true);
    expect(mockRequestPasswordReset).toHaveBeenCalledWith('student@example.com');
  });
});
