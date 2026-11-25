import type { OnboardingState, OnboardingStep } from '@cert-it/shared';
import { createContext } from 'react';

/** The getting started guide's state and controls, read with useOnboarding. */
export type OnboardingContextValue = {
  /** The user's progress, or null until it loads. */
  state: OnboardingState | null;
  /** The steps of the user's role, in order. */
  steps: readonly OnboardingStep[];
  /** Whether the panel is showing practice data. */
  practicing: boolean;
  openHub: () => void;
  /** Leaves practice, going back to real data. */
  exitPractice: () => void;
};

/** The getting started guide, provided by OnboardingProvider. */
export const OnboardingContext = createContext<OnboardingContextValue | null>(
  null,
);
