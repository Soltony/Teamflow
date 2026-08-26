import { ProtectedShell } from '@/components/protected-shell';
import { titleForRoute } from '@/lib/auth/route-permissions';

export default function ProfileLayout({ children }: { children: React.ReactNode }) {
  // Any signed-in user may view their own profile; no extra permission.
  return (
    <ProtectedShell>
      {children}
    </ProtectedShell>
  );
}

// Fills the "%s | NIB EPMO" template declared in the root layout, so this
// route's browser tab is distinguishable from every other one.
export const metadata = { title: titleForRoute('/profile') };
