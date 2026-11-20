import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router';
import { AdminPathEnum } from '../../app/router/AdminPathEnum';
import { useAuth } from '../useAuth';

type RequireGuestProps = {
  children: ReactNode;
};

/** Shows its children to logged-out users, sending logged-in ones back to where they were going. */
export function RequireGuest({ children }: RequireGuestProps) {
  const { user } = useAuth();
  const location = useLocation();

  if (user) return <Navigate to={readFrom(location.state)} replace />;
  return children;
}

// only paths inside the panel, never another site
function readFrom(state: unknown): string {
  const from =
    typeof state === 'object' && state !== null && 'from' in state
      ? state.from
      : null;

  return typeof from === 'string'
    && from.startsWith('/')
    && !from.startsWith('//')
    ? from
    : AdminPathEnum.Home;
}
