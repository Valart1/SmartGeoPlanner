import { SignupPayload, User } from '../models/User';
import { login as apiLogin, register as apiRegister } from './apiService';

function normalize(value: string): string {
  return value.trim().toLowerCase();
}

/**
 * Register a new account against the PostgreSQL backend.
 * The token returned by the API is persisted to AsyncStorage by apiService.register.
 */
export async function registerAccount(payload: SignupPayload): Promise<User> {
  const emailKey = normalize(payload.email);
  const usernameKey = normalize(payload.username);

  if (!emailKey || !usernameKey || !payload.password) {
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

  // Let apiRegister throw with the server's error message (e.g. duplicate email/username).
  const result = await apiRegister(emailKey, payload.username.trim(), payload.password);
  return result.user;
}

/**
 * Authenticate against the PostgreSQL backend.
 * The token returned by the API is persisted to AsyncStorage by apiService.login.
 */
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
