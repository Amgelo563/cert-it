import type { CurrentUser } from '@cert-it/shared';
import { createContext } from 'react';

/** The logged-in user and what changes them, read with useAuth. */
export type AuthContextValue = {
  /** The logged-in user, or null when logged out. */
  user: CurrentUser | null;
  /** Replaces the user, such as after logging in or changing the password. */
  setUser: (user: CurrentUser | null) => void;
  /** Ends the session, on the server too if it can be reached. */
  logout: () => Promise<void>;
};

/** The panel's login state, provided by AuthProvider. */
export const AuthContext = createContext<AuthContextValue | null>(null);
