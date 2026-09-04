/**
 * AuthContext
 * Provides global authentication state via React Context + useReducer.
 * Wraps the entire app to expose auth state and actions everywhere.
 *
 * Auth flows entirely through the PostgreSQL backend (apiService).
 * The JWT is kept in memory only for the current app session.
 */

import React, {
  createContext,
  useContext,
  useReducer,
  useEffect,
  useState,
  ReactNode,
} from 'react';
import { Platform } from 'react-native';
import { User, AuthState, SignupPayload } from '../models/User';
import {
  accountExists,
  authenticateAccount,
  EmailNotVerifiedError,
  registerAccount,
  resendVerificationEmail,
} from '../services/authService';
import {
  deleteCurrentUser,
  registerPushToken,
  unregisterPushToken,
  removeToken,
} from '../services/apiService';
import {
  registerForPushNotifications,
  getCurrentPushToken,
  clearNotificationSchedules,
} from '../services/notificationService';

// ─── Types ────────────────────────────────────────────────────────────────────

type AuthAction =
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'LOGIN_SUCCESS'; payload: User }
  | { type: 'LOGOUT' }
  | { type: 'SET_ERROR'; payload: string | null }
  | { type: 'UPDATE_USER'; payload: Partial<User> };

/** Result of a login attempt. 'unverified' means the email needs verification. */
export type LoginResult = 'success' | 'unverified' | 'failed';

interface AuthContextValue extends AuthState {
  login: (email: string, password: string) => Promise<LoginResult>;
  signup: (payload: SignupPayload) => Promise<boolean>;
  logout: () => Promise<void>;
  deleteAccount: () => Promise<void>;
  forgotPassword: (email: string) => Promise<boolean>;
  clearError: () => void;
  /** Email awaiting verification (set after signup or an unverified login). */
  pendingEmail: string | null;
  /** Dev-only: the verification link returned by the backend when SMTP is off. */
  pendingDevVerifyUrl: string | null;
  resendVerification: () => Promise<boolean>;
}

// ─── Reducer ──────────────────────────────────────────────────────────────────

const initialState: AuthState = {
  user: null,
  isLoading: true,
  isAuthenticated: false,
  error: null,
};

function authReducer(state: AuthState, action: AuthAction): AuthState {
  switch (action.type) {
    case 'SET_LOADING':
      return { ...state, isLoading: action.payload };
    case 'LOGIN_SUCCESS':
      return {
        ...state,
        user: action.payload,
        isAuthenticated: true,
        isLoading: false,
        error: null,
      };
    case 'LOGOUT':
      return { ...initialState, isLoading: false };
    case 'SET_ERROR':
      return { ...state, error: action.payload, isLoading: false };
    case 'UPDATE_USER':
      return {
        ...state,
        user: state.user ? { ...state.user, ...action.payload } : null,
      };
    default:
      return state;
  }
}

// ─── Context ──────────────────────────────────────────────────────────────────

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

// ─── Provider ─────────────────────────────────────────────────────────────────

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(authReducer, initialState);
  const [pendingEmail, setPendingEmail] = useState<string | null>(null);
  const [pendingDevVerifyUrl, setPendingDevVerifyUrl] = useState<string | null>(null);

  /**
   * Fire-and-forget: obtain the device's Expo push token and register it on the
   * backend so this user receives remote new-event notifications. Safe to fail
   * silently (e.g. Android Expo Go has no push).
   */
  const registerPush = () => {
    registerForPushNotifications()
      .then(token => {
        if (!token) return;
        return registerPushToken(token, Platform.OS);
      })
      .catch(() => {
        // Push registration is best-effort and must never affect auth flow.
      });
  };

  // Always start unauthenticated. Accounts and data live in the backend only.
  useEffect(() => {
    (async () => {
      await removeToken();
      dispatch({ type: 'SET_LOADING', payload: false });
    })();
  }, []);

  const login = async (email: string, password: string): Promise<LoginResult> => {
    dispatch({ type: 'SET_LOADING', payload: true });
    try {
      const user = await authenticateAccount(email, password);
      dispatch({ type: 'LOGIN_SUCCESS', payload: user });
      registerPush();
      return 'success';
    } catch (error) {
      if (error instanceof EmailNotVerifiedError) {
        setPendingEmail(error.email);
        setPendingDevVerifyUrl(null);
        dispatch({
          type: 'SET_ERROR',
          payload: 'This account has not verified its email yet. Check your inbox for the verification link.',
        });
        return 'unverified';
      }
      dispatch({
        type: 'SET_ERROR',
        payload: error instanceof Error ? error.message : 'Login failed. Please try again.',
      });
      return 'failed';
    }
  };

  const signup = async (payload: SignupPayload): Promise<boolean> => {
    dispatch({ type: 'SET_LOADING', payload: true });
    try {
      const result = await registerAccount(payload);
      if (result.requiresEmailVerification) {
        // Account created but needs email verification before sign-in.
        setPendingEmail(result.user.email);
        setPendingDevVerifyUrl(result.devVerifyUrl ?? null);
        dispatch({ type: 'SET_LOADING', payload: false });
        return true;
      }
      // Rare path: backend already considers this account verified → sign in directly.
      dispatch({ type: 'LOGIN_SUCCESS', payload: result.user });
      registerPush();
      return true;
    } catch (error) {
      dispatch({
        type: 'SET_ERROR',
        payload: error instanceof Error ? error.message : 'Signup failed. Please try again.',
      });
      return false;
    }
  };

  const resendVerification = async (): Promise<boolean> => {
    if (!pendingEmail) {
      dispatch({ type: 'SET_ERROR', payload: 'No email is awaiting verification.' });
      return false;
    }
    dispatch({ type: 'SET_LOADING', payload: true });
    try {
      const result = await resendVerificationEmail(pendingEmail);
      if (result.devVerifyUrl) setPendingDevVerifyUrl(result.devVerifyUrl);
      dispatch({ type: 'SET_LOADING', payload: false });
      dispatch({ type: 'SET_ERROR', payload: null });
      return true;
    } catch (error) {
      dispatch({
        type: 'SET_ERROR',
        payload: error instanceof Error ? error.message : 'Failed to resend the verification link.',
      });
      return false;
    }
  };

  const logout = async (): Promise<void> => {
    // Best-effort: tell the backend to forget this device's push token, and
    // drop all locally scheduled reminders so the signed-in session is clean.
    const token = getCurrentPushToken();
    if (token) {
      unregisterPushToken(token).catch(() => {
        // Cleanup is best-effort; the token will be pruned on the next failed push.
      });
    }
    clearNotificationSchedules();
    await removeToken();
    dispatch({ type: 'LOGOUT' });
  };

  const deleteAccount = async (): Promise<void> => {
    const currentUser = state.user;
    if (!currentUser) {
      throw new Error('No signed-in account to delete.');
    }

    await deleteCurrentUser();
    clearNotificationSchedules();
    dispatch({ type: 'LOGOUT' });
  };

  // Password reset currently checks backend account existence only; no local
  // account fallback exists.
  const forgotPassword = async (email: string): Promise<boolean> => {
    dispatch({ type: 'SET_LOADING', payload: true });
    await new Promise(r => setTimeout(r, 400));

    const exists = await accountExists(email);
    if (!exists) {
      dispatch({ type: 'SET_ERROR', payload: 'No account exists for that email or username.' });
      return false;
    }

    dispatch({ type: 'SET_LOADING', payload: false });
    return true;
  };

  const clearError = () => dispatch({ type: 'SET_ERROR', payload: null });

  return (
    <AuthContext.Provider
      value={{
        ...state,
        login,
        signup,
        logout,
        deleteAccount,
        forgotPassword,
        clearError,
        pendingEmail,
        pendingDevVerifyUrl,
        resendVerification,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within <AuthProvider>');
  return ctx;
}
