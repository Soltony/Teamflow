'use client';

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { useRouter } from 'next/navigation';
import { useIdle } from 'react-use';

import { useToast } from '@/hooks/use-toast';
import {
  getCurrentUserAction,
  logoutAction,
  type CurrentUserPayload,
} from '@/app/auth/actions';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

/**
 * Client-side view of the signed-in user.
 *
 * The session itself lives in an httpOnly cookie that this code cannot read —
 * everything here is a convenience copy handed down by the server for
 * rendering. Hiding a button via `hasPermission` is presentation only; the
 * server re-checks the same permission in the route guard and in every action.
 *
 * The shape of this context is unchanged from the previous external-auth
 * version (`localUser`, `hasPermission`, `isAdmin`, `logout`, `loading`) so the
 * 60+ components that consume it needed no edits.
 */

type LocalUser = CurrentUserPayload;

interface AuthContextType {
  localUser: LocalUser | null;
  /** Retained for compatibility with components that checked for a session. */
  user: LocalUser | null;
  loading: boolean;
  isAdmin: boolean;
  permissions: Set<string>;
  logout: () => Promise<void>;
  hasPermission: (permission: string | string[]) => boolean;
  isUserAdmin: () => boolean;
  refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

/**
 * How long before the warning appears, when the server has not said.
 *
 * The idle timeout is a setting now, so the server passes its real value
 * down and the warning lands a minute before it. Hard-coding fourteen would
 * mean an administrator who shortened the timeout to five minutes signed
 * people out with no warning at all.
 */
const DEFAULT_IDLE_WARNING_MS = 14 * 60 * 1000;

function InactivityWarningDialog({
  open,
  onStay,
  onTimeout,
}: {
  open: boolean;
  onStay: () => void;
  onTimeout: () => void;
}) {
  const [countdown, setCountdown] = useState(60);

  useEffect(() => {
    if (open) setCountdown(60);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    if (countdown <= 0) {
      onTimeout();
      return;
    }
    const timer = setTimeout(() => setCountdown((c) => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [open, countdown, onTimeout]);

  return (
    <AlertDialog open={open}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Are you still there?</AlertDialogTitle>
          <AlertDialogDescription>
            You have been inactive for a while. For security you will be signed out in {countdown}{' '}
            second{countdown === 1 ? '' : 's'}.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogAction onClick={onStay}>Stay signed in</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

export function AuthProvider({
  children,
  initialUser = null,
  idleWarningMs = DEFAULT_IDLE_WARNING_MS,
}: {
  children: ReactNode;
  /** Resolved on the server so the first paint already knows who is signed in. */
  initialUser?: LocalUser | null;
  /** Derived from the session idle setting; a minute before the server gives up. */
  idleWarningMs?: number;
}) {
  const [localUser, setLocalUser] = useState<LocalUser | null>(initialUser);
  const [loading, setLoading] = useState(false);
  const [showIdleWarning, setShowIdleWarning] = useState(false);
  const router = useRouter();
  const { toast } = useToast();

  const isIdle = useIdle(idleWarningMs, false);

  useEffect(() => {
    setLocalUser(initialUser);
  }, [initialUser]);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      setLocalUser(await getCurrentUserAction());
    } finally {
      setLoading(false);
    }
  }, []);

  const logout = useCallback(async () => {
    await logoutAction();
    setLocalUser(null);
    router.replace('/login');
    router.refresh();
  }, [router]);

  useEffect(() => {
    if (isIdle && localUser) setShowIdleWarning(true);
  }, [isIdle, localUser]);

  const handleStay = useCallback(() => {
    setShowIdleWarning(false);
    // Touches the session server-side so its idle clock resets too.
    void refresh();
  }, [refresh]);

  const handleIdleTimeout = useCallback(async () => {
    setShowIdleWarning(false);
    await logout();
    toast({
      title: 'Session timed out',
      description: 'You were signed out because of inactivity. Sign in again to continue.',
      variant: 'destructive',
    });
  }, [logout, toast]);

  const permissions = useMemo(
    () => new Set(localUser?.permissions ?? []),
    [localUser],
  );

  const isUserAdmin = useCallback(() => localUser?.isAdmin ?? false, [localUser]);

  const hasPermission = useCallback(
    (permission: string | string[]) => {
      if (localUser?.isAdmin) return true;
      return Array.isArray(permission)
        ? permission.some((p) => permissions.has(p))
        : permissions.has(permission);
    },
    [localUser, permissions],
  );

  const value: AuthContextType = {
    localUser,
    user: localUser,
    loading,
    isAdmin: localUser?.isAdmin ?? false,
    permissions,
    logout,
    hasPermission,
    isUserAdmin,
    refresh,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
      <InactivityWarningDialog
        open={showIdleWarning}
        onStay={handleStay}
        onTimeout={handleIdleTimeout}
      />
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
