
// This hook is now a wrapper around the Context to maintain import compatibility
// and provide easy access to the global state.
import { useStrattonSystem as useContextHook } from '../context/StrattonContext';

export const useStrattonSystem = () => {
  return useContextHook();
};
