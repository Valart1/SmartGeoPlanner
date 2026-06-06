/**
 * useAuthViewModel
 * Thin ViewModel adapter that exposes AuthContext to views
 * without views importing context directly.
 */

import { useAuth } from '../context/AuthContext';

export function useAuthViewModel() {
  return useAuth();
}
