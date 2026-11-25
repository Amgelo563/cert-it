import type { OnboardingStep } from '@cert-it/shared';
import type { UserId } from '../../user/User';

/** An object that stores each user's progress through the getting started guide. */
export interface OnboardingRepository {
  /** Returns the steps the user finished, in no particular order. */
  findCompletedSteps(userId: UserId): OnboardingStep[];

  /** Returns whether the user stopped the guide from opening on its own. */
  isDismissed(userId: UserId): boolean;

  /** Marks a step as finished, keeping the first time it was. */
  completeStep(userId: UserId, step: OnboardingStep): void;

  /** Stops the guide from opening on its own for the user. */
  dismiss(userId: UserId): void;
}
