import { useContext } from 'react';
import {
  OnboardingContext,
  type OnboardingContextValue,
} from './OnboardingContext';

/** Returns the getting started guide's state and controls. */
export function useOnboarding(): OnboardingContextValue {
  const value = useContext(OnboardingContext);
  if (!value) throw new Error('useOnboarding needs an OnboardingProvider');
  return value;
}
