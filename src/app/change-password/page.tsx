import { redirect } from 'next/navigation';

import { getCurrentUser } from '@/lib/auth/session';
import { ChangePasswordForm } from './change-password-form';

/**
 * Reached two ways: forced, when an account is flagged `mustChangePassword`
 * and ProtectedShell redirects here from every other route, or chosen, from
 * the account menu in the top bar. The flag is resolved on the server and
 * handed to the form, which is what decides the wording and whether there is
 * a way back.
 */
export default async function ChangePasswordPage() {
  const user = await getCurrentUser();

  // The layout guards this too; repeated here because this component reads the
  // user itself and must not render a form for nobody.
  if (!user) redirect('/login');

  return <ChangePasswordForm mustChange={user.mustChangePassword} />;
}
