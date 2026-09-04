import { SignupPayload, User } from '../models/User';
import {
  login as apiLogin,
  register as apiRegister,
  requestPasswordReset,
  resendVerification,
} from './apiService';

function normalize(value: string): string {
  return value.trim().toLowerCase();
}

/** Thrown when login/register hits a gate because the email isn't verified yet. */
export class EmailNotVerifiedError extends Error {
  email: string;
  constructor(email: string) {
    super('Please verify your email before signing in.');
    this.name = 'EmailNotVerifiedError';
    this.email = email;
  }
}

export interface RegisterResult {
  user: User;
  requiresEmailVerification: boolean;
  /** Present only in dev mode (no SMTP configured) for testing. */
  devVerifyUrl?: string;
}

export async function registerAccount(payload: SignupPayload): Promise<RegisterResult> {
  const emailKey = normalize(payload.email);
  const username = payload.username.trim();

  if (!emailKey || !username || !payload.password) {
    throw new Error('Username, email, and password are required.');
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailKey)) {
    throw new Error('Enter a valid email address.');
  }

  if (payload.password !== payload.confirmPassword) {
    throw new Error('Passwords do not match.');
  }

  if (payload.password.length < 6) {
    throw new Error('Password must be at least 6 characters.');
  }

  const result = await apiRegister(emailKey, username, payload.password);
  return {
    user: result.user,
    requiresEmailVerification: result.requiresEmailVerification ?? false,
    devVerifyUrl: result.devVerifyUrl,
  };
}

export async function authenticateAccount(
  identifier: string,
  password: string,
): Promise<User> {
  const identifierKey = normalize(identifier);
  if (!identifierKey || !password) {
    throw new Error('Email/username and password are required.');
  }

  try {
    const result = await apiLogin(identifierKey, password);
    return result.user;
  } catch (error) {
    const apiError = error as { needsVerification?: boolean; email?: string };
    if (apiError.needsVerification) {
      throw new EmailNotVerifiedError(apiError.email || identifierKey);
    }
    throw error;
  }
}

export async function resendVerificationEmail(
  email: string,
): Promise<{ message: string; devVerifyUrl?: string }> {
  const emailKey = normalize(email);
  if (!emailKey) {
    throw new Error('Email is required.');
  }
  return resendVerification(emailKey);
}

export async function accountExists(identifier: string): Promise<boolean> {
  const identifierKey = normalize(identifier);
  if (!identifierKey) return false;

  const result = await requestPasswordReset(identifierKey);
  return result.exists;
}
