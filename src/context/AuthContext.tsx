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
  ReactNode,
} from 'react';
import { User, AuthState, SignupPayload } from '../models/User';
import {
  accountExists,
  authenticateAccount,
  registerAccount,
} from '../services/authService';
import {
  deleteCurrentUser,
  removeToken,
} from '../services/apiService';

// ─── Types ────────────────────────────────────────────────────────────────────

type AuthAction =
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'LOGIN_SUCCESS'; payload: User }
  | { type: 'LOGOUT' }
  | { type: 'SET_ERROR'; payload: string | null }
  | { type: 'UPDATE_USER'; payload: Partial<User> };

interface AuthContextValue extends AuthState {
  login: (email: string, password: string) => Promise<boolean>;
  signup: (payload: SignupPayload) => Promise<boolean>;
  logout: () => Promise<void>;
  deleteAccount: () => Promise<void>;
  forgotPassword: (email: string) => Promise<boolean>;
  clearError: () => void;
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

  // Always start unauthenticated. Accounts and data live in the backend only.
  useEffect(() => {
    (async () => {
      await removeToken();
      dispatch({ type: 'SET_LOADING', payload: false });
    })();
  }, []);

  const login = async (email: string, password: string): Promise<boolean> => {
    dispatch({ type: 'SET_LOADING', payload: true });
    try {
      const user = await authenticateAccount(email, password);
      dispatch({ type: 'LOGIN_SUCCESS', payload: user });
      return true;
    } catch (error) {
      dispatch({
        type: 'SET_ERROR',
        payload: error instanceof Error ? error.message : 'Login failed. Please try again.',
      });
      return false;
    }
  };

  const signup = async (payload: SignupPayload): Promise<boolean> => {
    dispatch({ type: 'SET_LOADING', payload: true });
    try {
      const user = await registerAccount(payload);
      dispatch({ type: 'LOGIN_SUCCESS', payload: user });
      return true;
    } catch (error) {
      dispatch({
        type: 'SET_ERROR',
        payload: error instanceof Error ? error.message : 'Signup failed. Please try again.',
      });
      return false;
    }
  };

  const logout = async (): Promise<void> => {
    await removeToken();
    dispatch({ type: 'LOGOUT' });
  };

  const deleteAccount = async (): Promise<void> => {
    const currentUser = state.user;
    if (!currentUser) {
      throw new Error('No signed-in account to delete.');
    }

    await deleteCurrentUser();
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
      value={{ ...state, login, signup, logout, deleteAccount, forgotPassword, clearError }}
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
