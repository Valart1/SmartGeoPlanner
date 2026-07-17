/**
 * AuthContext
 * Provides global authentication state via React Context + useReducer.
 * Wraps the entire app to expose auth state and actions everywhere.
 *
 * Auth flows entirely through the PostgreSQL backend (apiService):
 * login/signup persist a JWT; rehydration validates that JWT via /auth/me.
 */

import React, {
  createContext,
  useContext,
  useReducer,
  useEffect,
  ReactNode,
} from 'react';
import { User, AuthState, SignupPayload } from '../models/User';
import { getItem, setItem, removeItem, STORAGE_KEYS } from '../services/storageService';
import {
  authenticateAccount,
  registerAccount,
} from '../services/authService';
import {
  getCurrentUser,
  getToken,
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

  // Rehydrate session on app start: validate the stored JWT via /auth/me.
  useEffect(() => {
    (async () => {
      const token = await getToken();
      if (!token) {
        dispatch({ type: 'SET_LOADING', payload: false });
        return;
      }

      try {
        const user = await getCurrentUser();
        await setItem(STORAGE_KEYS.USER, user);
        dispatch({ type: 'LOGIN_SUCCESS', payload: user });
      } catch {
        // Token is invalid/expired — discard it and the cached user.
        await removeToken();
        await removeItem(STORAGE_KEYS.USER);
        dispatch({ type: 'SET_LOADING', payload: false });
      }
    })();
  }, []);

  const login = async (email: string, password: string): Promise<boolean> => {
    dispatch({ type: 'SET_LOADING', payload: true });
    try {
      const user = await authenticateAccount(email, password);
      await setItem(STORAGE_KEYS.USER, user);
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
      await setItem(STORAGE_KEYS.USER, user);
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
    await removeItem(STORAGE_KEYS.USER);
    dispatch({ type: 'LOGOUT' });
  };

  // Password reset is not yet backed by an endpoint. Don't gate on a local
  // account check (that path is gone) — accept the request and let the UI
  // proceed. Wire a real endpoint here when one exists.
  const forgotPassword = async (_email: string): Promise<boolean> => {
    dispatch({ type: 'SET_LOADING', payload: true });
    await new Promise(r => setTimeout(r, 400));
    dispatch({ type: 'SET_LOADING', payload: false });
    return true;
  };

  const clearError = () => dispatch({ type: 'SET_ERROR', payload: null });

  return (
    <AuthContext.Provider
      value={{ ...state, login, signup, logout, forgotPassword, clearError }}
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
