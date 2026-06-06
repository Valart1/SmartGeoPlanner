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
      if (stored) {
        dispatch({ type: 'LOGIN_SUCCESS', payload: stored });
      } else {
        dispatch({ type: 'SET_LOADING', payload: false });
      }
    })();
  }, []);

  /**
   * Simulated login – in production, replace with real API call.
   * Accepts any non-empty email/password for demo purposes.
   */
  const login = async (email: string, password: string): Promise<boolean> => {
    dispatch({ type: 'SET_LOADING', payload: true });
    try {
      await new Promise(r => setTimeout(r, 800)); // simulate network
      if (!email || !password) {
        dispatch({ type: 'SET_ERROR', payload: 'Email and password are required.' });
        return false;
      }
      const user: User = {
        id: `user_${Date.now()}`,
        email,
        username: email.split('@')[0],
        displayName: email.split('@')[0],
        isEmailVerified: true,
        createdAt: new Date().toISOString(),
      };
      await setItem(STORAGE_KEYS.USER, user);
      dispatch({ type: 'LOGIN_SUCCESS', payload: user });
      return true;
    } catch {
      dispatch({ type: 'SET_ERROR', payload: 'Login failed. Please try again.' });
      return false;
    }
  };

  /**
   * Simulated signup – validates inputs and creates a placeholder user.
   */
  const signup = async (payload: SignupPayload): Promise<boolean> => {
    dispatch({ type: 'SET_LOADING', payload: true });
    try {
      await new Promise(r => setTimeout(r, 800));
      if (payload.password !== payload.confirmPassword) {
        dispatch({ type: 'SET_ERROR', payload: 'Passwords do not match.' });
        return false;
      }
      if (payload.password.length < 6) {
        dispatch({ type: 'SET_ERROR', payload: 'Password must be at least 6 characters.' });
        return false;
      }
      const user: User = {
        id: `user_${Date.now()}`,
        email: payload.email,
        username: payload.username,
        displayName: payload.username,
        isEmailVerified: false,
        createdAt: new Date().toISOString(),
      };
      await setItem(STORAGE_KEYS.USER, user);
      dispatch({ type: 'LOGIN_SUCCESS', payload: user });
      return true;
    } catch {
      dispatch({ type: 'SET_ERROR', payload: 'Signup failed. Please try again.' });
      return false;
    }
  };

  const logout = async (): Promise<void> => {
    await removeItem(STORAGE_KEYS.USER);
    dispatch({ type: 'LOGOUT' });
  };

  /**
   * Simulated forgot-password flow.
   */
  const forgotPassword = async (email: string): Promise<boolean> => {
    dispatch({ type: 'SET_LOADING', payload: true });
    await new Promise(r => setTimeout(r, 800));
    dispatch({ type: 'SET_LOADING', payload: false });
    return !!email;
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
