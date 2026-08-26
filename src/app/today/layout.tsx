import { protectedLayout } from '@/components/protected-shell';
import { titleForRoute } from '@/lib/auth/route-permissions';

// Who may open this route is declared in src/lib/auth/route-permissions.ts.
export default protectedLayout('/today');

// Fills the "%s | NIB EPMO" template declared in the root layout, so this
// route's browser tab is distinguishable from every other one.
export const metadata = { title: titleForRoute('/today') };
