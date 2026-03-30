
import { useState, useEffect } from 'react';

export function usePersistedState<T>(key: string, initialValue: T) {
  // 1. Initialize state from localStorage or fallback to initialValue
  const [state, setState] = useState<T>(() => {
    if (typeof window === 'undefined') return initialValue;
    try {
      const item = window.localStorage.getItem(key);
      if (item === null) return initialValue;
      
      const parsed = JSON.parse(item);
      // Extra safety: if parsed value is explicitly null/undefined but we expect an object/array, verify
      // For now, if parsed is null, we assume it's invalid state and return initialValue
      return parsed === null ? initialValue : parsed;
    } catch (error) {
      console.warn(`Error reading localStorage key "${key}":`, error);
      return initialValue;
    }
  });

  // 2. Sync updates to localStorage
  useEffect(() => {
    try {
      window.localStorage.setItem(key, JSON.stringify(state));
    } catch (error) {
      console.warn(`Error writing localStorage key "${key}":`, error);
    }
  }, [key, state]);

  return [state, setState] as const;
}
