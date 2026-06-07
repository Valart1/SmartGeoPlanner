/**
 * AuthContext
 * Provides global authentication state via React Context + useReducer.
 * Wraps the entire app to expose auth state and actions everywhere.
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
  accountExists,
  authenticateAccount,
  registerAccount,
} from '../services/authService';

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

  // Rehydrate user session on app start
  useEffect(() => {
    (async () => {
      const stored = await getItem<User>(STORAGE_KEYS.USER);
      if (stored && await accountExists(stored.email)) {
        dispatch({ type: 'LOGIN_SUCCESS', payload: stored });
      } else {
        if (stored) await removeItem(STORAGE_KEYS.USER);
        dispatch({ type: 'SET_LOADING', payload: false });
      }
    })();
  }, []);

  const login = async (email: string, password: string): Promise<boolean> => {
    dispatch({ type: 'SET_LOADING', payload: true });
    try {
      await new Promise(r => setTimeout(r, 400));
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
      await new Promise(r => setTimeout(r, 400));
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
    await removeItem(STORAGE_KEYS.USER);
    dispatch({ type: 'LOGOUT' });
  };

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
