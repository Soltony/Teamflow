'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import {
  AlertCircle,
  ArrowRight,
  Check,
  CheckCircle2,
  Eye,
  EyeOff,
  Loader2,
  Lock,
  Phone,
  ShieldCheck,
} from 'lucide-react';

import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { loginAction } from '@/app/auth/actions';
import { isKnownAppPath } from '@/lib/permissions';
import { cn } from '@/lib/utils';

const loginSchema = z.object({
  phoneNumber: z.string().min(1, 'Phone number is required'),
  password: z.string().min(1, 'Password is required'),
});

type LoginFormValues = z.infer<typeof loginSchema>;

/**
 * Filled fields rather than outlined ones: this half of the card is already a
 * plain white surface, so the input's own tint is what tells you where to type.
 */
const FIELD =
  'h-12 rounded-xl border-transparent bg-secondary pl-11 text-[15px] transition-colors focus-visible:border-primary/40 focus-visible:bg-card';

/**
 * Sign-in has four visible states, not two. Collapsing them into a boolean is
 * what makes most login buttons feel dead: the arrow leaves, a ring tracks the
 * request, a tick lands, a refusal shakes — each has to read at a glance.
 */
type Status = 'idle' | 'submitting' | 'success' | 'error';

/** Long enough for the shake to finish before the arrow comes back. */
const SHAKE_MS = 520;
/** Long enough to read the tick, short enough not to feel like latency. */
const HANDOFF_MS = 560;

/**
 * The white half of the sign-in card.
 *
 * Uses useSearchParams for the ?from= return path, so the page keeps it behind
 * a Suspense boundary — without one it opts the route out of prerendering.
 */
export function LoginForm({ notice }: { notice?: string | null }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<Status>('idle');

  const form = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { phoneNumber: '', password: '' },
  });

  // The machine hands off to the router on a timer, and a component that has
  // gone away must not still be scheduling navigations.
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  useEffect(() => {
    const pending = timers.current;
    return () => pending.forEach(clearTimeout);
  }, []);
  const later = (run: () => void, ms: number) => {
    timers.current.push(setTimeout(run, ms));
  };

  // Deliberately not formState.isSubmitting: that goes false the moment the
  // action resolves, and the button has to stay in `success` across the
  // handoff so it never flickers back to the arrow.
  const busy = status === 'submitting' || status === 'success';

  async function onSubmit(values: LoginFormValues) {
    if (busy) return;

    setStatus('submitting');
    setError(null);

    const fail = (message: string) => {
      setError(message);
      setStatus('error');
      // Back to idle once the shake has played, so the button is live again.
      later(() => setStatus('idle'), SHAKE_MS);
      // Whatever was wrong, the password is what gets retyped. Put the cursor
      // there rather than leaving it on the button they just pressed.
      form.setValue('password', '');
      form.setFocus('password');
    };

    let result: Awaited<ReturnType<typeof loginAction>>;
    try {
      result = await loginAction({
        phoneNumber: values.phoneNumber,
        password: values.password,
      });
    } catch {
      fail('Network error. Please try again.');
      return;
    }

    if (!result.success) {
      fail(result.error);
      return;
    }

    setStatus('success');

    const from = searchParams.get('from');
    // Follow ?from= only when it is a same-site path (so it cannot bounce
    // someone to another origin) *and* a route this application serves (so a
    // stale link or a probe like /admin/login cannot strand them on a 404).
    const sameSite = Boolean(from && from.startsWith('/') && !from.startsWith('//'));
    const target = sameSite && isKnownAppPath(from!.split('?')[0]) ? from! : '/dashboard';

    later(() => {
      router.replace(result.mustChangePassword ? '/change-password' : target);
      router.refresh();
    }, HANDOFF_MS);
  }

  return (
    // Positioned: the round button below hangs off this panel's left edge,
    // which is the seam between the two halves of the card.
    <div className="relative flex flex-col justify-center bg-card px-7 py-10 sm:px-11 lg:px-14 lg:py-12">
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="mx-auto w-full max-w-[22rem]">
          {/* The seam button and the full-width one below are the same control.
              Only one of them should reach assistive tech, and the labelled one
              in the flow of the form is the better of the two.

              It sits on the join between the two halves of the card, which is
              where the eye lands first — so it carries the whole sequence: the
              arrow launches out, a ring tracks the request, a tick lands, and a
              refusal shakes it. */}
          <button
            type="submit"
            disabled={busy}
            tabIndex={-1}
            aria-hidden="true"
            className="group absolute left-0 top-1/2 hidden h-[68px] w-[68px] -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full lg:flex"
          >
            {/* Idle only. Once the request is out, ambient motion competes with
                the ring that is actually reporting something. */}
            {status === 'idle' && (
              <span
                className="gl-spin-slow pointer-events-none absolute -inset-[18px] rounded-full"
                style={{ animationDuration: '11s' }}
              >
                <span className="absolute left-1/2 top-0 h-[7px] w-[7px] -translate-x-1/2 rounded-full bg-primary shadow-[0_0_0_3px_hsl(var(--primary)/0.2)]" />
              </span>
            )}

            {/* The gold face is its own layer so the halo can stack over it —
                the rings have to cross the white ring, not disappear behind. */}
            <span
              className={cn(
                'gl-gold relative flex h-full w-full items-center justify-center rounded-full ring-[10px] ring-card transition-transform duration-300',
                status === 'submitting' && 'scale-95',
                status === 'success' && 'scale-105',
                // The shake goes here, not on the button: the button is holding
                // a centring translate that its own transform would overwrite.
                status === 'error' && 'gl-shake',
              )}
            >
              {/* Kept mounted in every state, so it has something to travel from. */}
              <ArrowRight
                className={cn(
                  'absolute h-6 w-6 transition-all duration-300',
                  busy ? 'translate-x-9 opacity-0' : 'group-hover:translate-x-0.5',
                )}
                strokeWidth={2.5}
              />

              {/* An arc running the rim rather than a spinner dropped in the
                  middle — the button itself becomes the progress indicator. */}
              {status === 'submitting' && (
                <svg
                  viewBox="0 0 68 68"
                  className="absolute inset-0 h-full w-full animate-spin text-[hsl(var(--primary-foreground)/0.72)]"
                >
                  <circle
                    cx="34"
                    cy="34"
                    r="27"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="3"
                    strokeLinecap="round"
                    strokeDasharray="44 126"
                  />
                </svg>
              )}

              {status === 'success' && <Check className="gl-pop absolute h-8 w-8" strokeWidth={3} />}
            </span>

            {/* Last child, so both rings paint above the face and the ring alike.
                As ::before and ::after of one element they stay half a cycle
                apart for free. */}
            {status === 'idle' && (
              <span className="gl-halo pointer-events-none absolute inset-0 rounded-full" />
            )}

            {/* The payoff: a single ring leaving the button as the tick lands. */}
            {status === 'success' && (
              <span className="gl-burst pointer-events-none absolute inset-0 rounded-full border-2 border-primary" />
            )}
          </button>

          <div className="text-center">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-secondary px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              <ShieldCheck className="h-3.5 w-3.5" />
              Secure sign-in
            </span>
            <h1 className="mt-4 text-[28px] font-extrabold tracking-tight">Welcome back</h1>
            <p className="mt-1.5 text-sm text-muted-foreground">
              Sign in to your account to continue
            </p>
          </div>

          <div className="mt-7 space-y-4">
            {error && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            {!error && notice && (
              <Alert>
                <CheckCircle2 className="h-4 w-4" />
                <AlertDescription>{notice}</AlertDescription>
              </Alert>
            )}

            <FormField
              control={form.control}
              name="phoneNumber"
              render={({ field }) => (
                <FormItem className="space-y-1.5">
                  <FormLabel className="text-[13px]">Phone number</FormLabel>
                  <div className="relative">
                    <Phone className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <FormControl>
                      <Input
                        placeholder="0912345678"
                        autoComplete="username"
                        inputMode="tel"
                        autoFocus
                        className={FIELD}
                        {...field}
                        disabled={busy}
                      />
                    </FormControl>
                  </div>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="password"
              render={({ field }) => (
                <FormItem className="space-y-1.5">
                  <FormLabel className="text-[13px]">Password</FormLabel>
                  <div className="relative">
                    <Lock className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <FormControl>
                      <Input
                        type={showPassword ? 'text' : 'password'}
                        placeholder="••••••••"
                        autoComplete="current-password"
                        className={cn(FIELD, 'pr-11')}
                        {...field}
                        disabled={busy}
                      />
                    </FormControl>
                    <button
                      type="button"
                      onClick={() => setShowPassword((visible) => !visible)}
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                      className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg p-2 text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          {/* Below lg the seam button is not rendered at all, so this one
              carries the same states on its own. */}
          <button
            type="submit"
            disabled={busy}
            className={cn(
              'gl-gold mt-7 flex h-12 w-full items-center justify-center gap-2 rounded-xl text-sm font-bold disabled:cursor-not-allowed',
              status === 'error' && 'gl-shake',
            )}
          >
            {status === 'submitting' && <Loader2 className="h-4 w-4 animate-spin" />}
            {status === 'success' && <Check className="gl-pop h-4 w-4" strokeWidth={3} />}
            {status === 'submitting' ? 'Signing in' : status === 'success' ? 'Signed in' : 'Sign in'}
          </button>

          <p className="mt-6 border-t border-border pt-5 text-center text-xs leading-relaxed text-muted-foreground">
            Locked out or forgotten your password? Contact your EPMO administrator.
          </p>
        </form>
      </Form>
    </div>
  );
}
