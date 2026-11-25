import type { OnboardingStep } from '../../onboarding/OnboardingStepEnum';

/** The logged-in user's progress through the getting started guide. */
export type OnboardingState = {
  /** Whether the guide stops opening on its own. */
  readonly dismissed: boolean;
  /** Steps finished at least once, among the ones the user's role can take. */
  readonly completedSteps: readonly OnboardingStep[];
};
