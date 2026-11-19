import type { HttpEnv } from '../http/HttpEnv';
import type { User } from '../user/User';
import type { Session } from './session/Session';

/** The Hono environment of routes behind the admin login. */
export type AuthEnv = {
  Variables: HttpEnv['Variables'] & {
    /** Logged-in user, active. */
    user: User;
    session: Session;
  };
};
