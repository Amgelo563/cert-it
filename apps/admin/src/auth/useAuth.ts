import { useContext } from 'react';
import { AuthContext, type AuthContextValue } from './AuthContext';

/** Returns the logged-in user and what changes them. */
export function useAuth(): AuthContextValue {
  const auth = useContext(AuthContext);
  if (!auth) throw new Error('useAuth needs an AuthProvider');
  return auth;
}
