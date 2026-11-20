import { ApiErrorCodeEnum, type CurrentUser } from '@cert-it/shared';
import {
  type ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { ApiRequestError } from '../app/api/errors/ApiRequestError';
import { useApiClient } from '../app/api/useApiClient';
import { PageLoader } from '../app/layout/PageLoader';
import { AuthContext, type AuthContextValue } from './AuthContext';

type AuthProviderProps = {
  children: ReactNode;
};

/** Loads the logged-in user at start and keeps it in sync with what the API answers. */
export function AuthProvider({ children }: AuthProviderProps) {
  const api = useApiClient();
  // undefined until the first answer arrives
  const [user, setUser] = useState<CurrentUser | null | undefined>(undefined);
  const [error, setError] = useState<unknown>(null);

  useEffect(() => {
    let cancelled = false;

    api
      .request((routes) => routes.auth.me.$get())
      .then((current) => {
        if (!cancelled) setUser(current);
      })
      .catch((caught: unknown) => {
        if (cancelled) return;
        if (ApiRequestError.matches(caught, ApiErrorCodeEnum.Unauthorized)) {
          setUser(null);
        } else {
          setError(caught);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [api]);

  // any request can find the session ended or a password change pending
  useEffect(
    () =>
      api.onError((caught) => {
        if (caught.code === ApiErrorCodeEnum.Unauthorized) setUser(null);
        if (caught.code === ApiErrorCodeEnum.PasswordChangeRequired) {
          setUser(
            (current) => current && { ...current, mustChangePassword: true },
          );
        }
      }),
    [api],
  );

  const logout = useCallback(async () => {
    try {
      await api.request((routes) => routes.auth.logout.$post());
    } catch {
      // logged out here anyway; the session expires on its own
    }
    setUser(null);
  }, [api]);

  const value = useMemo<AuthContextValue | null>(
    () => (user === undefined ? null : { user, setUser, logout }),
    [user, logout],
  );

  // shown by the route's error page, with a reload button
  if (error) throw error;
  if (!value) return <PageLoader />;
  return <AuthContext value={value}>{children}</AuthContext>;
}
