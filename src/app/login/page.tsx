import { Suspense } from 'react';

import { BrandPanel, ConsoleRibbon } from '@/components/login/brand-panel';
import { LoginForm } from './login-form';

/**
 * The sign-in screen.
 *
 * Two halves of one sheet: the brown brand panel and the white form share a
 * single rounded frame, and the round gold button sits on the seam between
 * them. They stack under lg, where there is no seam for it to sit on.
 */
export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ passwordChanged?: string }>;
}) {
  const params = await searchParams;

  const notice = params.passwordChanged
    ? 'Password updated. Sign in with your new password.'
    : null;

  return (
    <>
      <div className="gl-auth-backdrop pointer-events-none absolute inset-0" aria-hidden="true" />
      <ConsoleRibbon />

      <div className="relative w-full max-w-5xl">
        {/* The drop shadow is the ink brown, not a neutral grey: a card this
            large casts enough of it to tint the page, and a cool shadow under a
            warm card is what makes the two read as separate designs. */}
        <div className="grid overflow-hidden rounded-[28px] border border-border bg-card shadow-[0_1px_2px_hsl(26_42%_12%/0.07),0_44px_88px_-44px_hsl(26_42%_12%/0.48)] lg:grid-cols-2">
          <BrandPanel />
          {/*
            The form reads ?from= with useSearchParams, which opts the route out
            of prerendering unless it sits behind a boundary. The fallback is
            the same white half with the fields inert, so the card never
            collapses to a different shape while it resolves.
          */}
          <Suspense fallback={<div className="min-h-[26rem] bg-card lg:min-h-[33rem]" />}>
            <LoginForm notice={notice} />
          </Suspense>
        </div>

        <p className="mt-6 text-center text-xs text-muted-foreground">
          Access is logged. Unauthorised use is prohibited.
        </p>
      </div>
    </>
  );
}
