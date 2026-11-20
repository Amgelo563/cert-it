import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router';
import { AdminPathEnum } from '../../app/router/AdminPathEnum';
import { useAuth } from '../useAuth';

type RequireAuthProps = {
  children: ReactNode;
  /** Whether a user who must change their password can see it, as on the change password page. */
  allowPendingPasswordChange?: boolean;
};

/** Shows its children to logged-in users, sending others to login and pending password changes to the change password page. */
export function RequireAuth({
  children,
  allowPendingPasswordChange = false,
}: RequireAuthProps) {
  const { user } = useAuth();
  const location = useLocation();

  if (!user) {
    return (
      <Navigate
        to={AdminPathEnum.Login}
        replace
        state={{ from: `${location.pathname}${location.search}` }}
      />
    );
  }
  if (user.mustChangePassword && !allowPendingPasswordChange) {
    return <Navigate to={AdminPathEnum.ChangePassword} replace />;
  }

  return children;
}
