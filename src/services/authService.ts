import { SignupPayload, User } from '../models/User';
import {
  login as apiLogin,
  register as apiRegister,
  requestPasswordReset,
} from './apiService';

function normalize(value: string): string {
  return value.trim().toLowerCase();
}

export async function registerAccount(payload: SignupPayload): Promise<User> {
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
  return result.user;
}

export async function authenticateAccount(
  identifier: string,
  password: string,
): Promise<User> {
  const identifierKey = normalize(identifier);
  if (!identifierKey || !password) {
    throw new Error('Email/username and password are required.');
  }

  const result = await apiLogin(identifierKey, password);
  return result.user;
}

export async function accountExists(identifier: string): Promise<boolean> {
  const identifierKey = normalize(identifier);
  if (!identifierKey) return false;

  const result = await requestPasswordReset(identifierKey);
  return result.exists;
}
