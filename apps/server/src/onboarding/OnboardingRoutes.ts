import {
  ApiErrorCodeEnum,
  getOnboardingSteps,
  type OnboardingState,
  type OnboardingStep,
} from '@cert-it/shared';
import { type Context, Hono } from 'hono';
import type { AuthEnv } from '../auth/AuthEnv';
import type { AuthGuard } from '../auth/AuthGuard';
import type { DatabaseService } from '../database/DatabaseService';
import { AbstractApiRoutes } from '../http/api/AbstractApiRoutes';

type OnboardingRoutesOptions = {
  database: DatabaseService;
  guard: AuthGuard;
};

/** Serves the logged-in user's progress through the getting started guide. */
export class OnboardingRoutes extends AbstractApiRoutes {
  /** Path of the routes, relative to the base path. */
  public static readonly Path = '/api/onboarding';

  protected readonly database: DatabaseService;

  protected readonly guard: AuthGuard;

  protected readonly app: ReturnType<OnboardingRoutes['createApp']>;

  constructor(options: OnboardingRoutesOptions) {
    super();
    this.database = options.database;
    this.guard = options.guard;
    this.app = this.createApp();
  }

  public static create(options: OnboardingRoutesOptions): OnboardingRoutes {
    return new OnboardingRoutes(options);
  }

  /** Returns the routes, to mount at {@link OnboardingRoutes.Path}. */
  public getApp(): OnboardingRoutes['app'] {
    return this.app;
  }

  // chained, so hono/client can infer the routes' types
  protected createApp() {
    return (
      new Hono<AuthEnv>({ strict: false })
        // only the user's own progress, so it's harmless before a password change
        .use(this.guard.authenticate({ allowPendingPasswordChange: true }))
        .get('/', (c) => this.state(c))
        .put('/steps/:step', (c) => this.completeStep(c))
        .put('/dismissed', (c) => this.dismiss(c))
    );
  }

  protected state(c: Context<AuthEnv>) {
    return c.json<OnboardingState, 200>(this.read(c), 200);
  }

  // only steps of the user's own guide, so a role change can't leave strays
  protected completeStep(c: Context<AuthEnv>) {
    const { id, role } = c.get('user');
    const step = getOnboardingSteps(role).find(
      (known) => known === c.req.param('step'),
    );
    if (!step) {
      return OnboardingRoutes.apiError(c, 400, ApiErrorCodeEnum.InvalidRequest);
    }

    this.database.getRepositories().onboarding.completeStep(id, step);
    return c.json<OnboardingState, 200>(this.read(c), 200);
  }

  protected dismiss(c: Context<AuthEnv>) {
    this.database.getRepositories().onboarding.dismiss(c.get('user').id);
    return c.json<OnboardingState, 200>(this.read(c), 200);
  }

  // steps the role lost stay stored but aren't answered
  protected read(c: Context<AuthEnv>): OnboardingState {
    const { id, role } = c.get('user');
    const { onboarding } = this.database.getRepositories();
    const completed = new Set<OnboardingStep>(
      onboarding.findCompletedSteps(id),
    );

    return {
      dismissed: onboarding.isDismissed(id),
      completedSteps: getOnboardingSteps(role).filter((step) =>
        completed.has(step),
      ),
    };
  }
}
