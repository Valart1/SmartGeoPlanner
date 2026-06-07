/**
 * User Model
 * Defines the data structures and TypeScript interfaces for authentication.
 */

export interface User {
  id: string;
  email: string;
  username: string;
  displayName?: string;
  avatarUrl?: string;
  isEmailVerified: boolean;
  createdAt: string; // ISO 8601
}

export interface StoredUserAccount {
  user: User;
  emailKey: string;
  usernameKey: string;
  passwordHash: string;
}

export interface AuthCredentials {
  email: string;
  password: string;
}

export interface SignupPayload {
  email: string;
  username: string;
  password: string;
  confirmPassword: string;
}

export interface AuthState {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  error: string | null;
}
