'use client';

import { Suspense, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useRouter, useSearchParams } from 'next/navigation';
import { Eye, EyeOff } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';
import { NibLogo } from '@/components/logo';
import { loginAction } from '@/app/auth/actions';
import { isKnownAppPath } from '@/lib/permissions';

const loginSchema = z.object({
  phoneNumber: z.string().min(1, 'Phone number is required'),
  password: z.string().min(1, 'Password is required'),
});

type LoginFormValues = z.infer<typeof loginSchema>;

/**
 * Wrapped in Suspense below: useSearchParams (for the ?from= return path)
 * opts the component out of static prerendering unless it sits behind a
 * boundary.
 */
function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const form = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { phoneNumber: '', password: '' },
  });

  const { isSubmitting } = form.formState;

  async function onSubmit(data: LoginFormValues) {
    setError(null);

    const result = await loginAction({
      phoneNumber: data.phoneNumber,
      password: data.password,
    });

    if (!result.success) {
      setError(result.error);
      form.setValue('password', '');
      return;
    }

    toast({
      title: 'Signed in',
      description: 'Welcome back.',
    });

    if (result.mustChangePassword) {
      router.replace('/change-password');
    } else {
      const from = searchParams.get('from');
      // Follow ?from= only when it is a same-site path (so it cannot bounce
      // someone to another origin) *and* a route this application serves (so a
      // stale link or a probe like /admin/login cannot strand them on a 404).
      const sameSite = Boolean(from && from.startsWith('/') && !from.startsWith('//'));
      const target =
        sameSite && isKnownAppPath(from!.split('?')[0]) ? from! : '/dashboard';
      router.replace(target);
    }
    router.refresh();
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xl">Sign in</CardTitle>
        <CardDescription>Enter your credentials to access your account.</CardDescription>
      </CardHeader>
      <CardContent>
        {error && (
          <Alert variant="destructive" className="mb-4">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="phoneNumber"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Phone Number</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="0912345678"
                      autoComplete="username"
                      inputMode="tel"
                      {...field}
                      disabled={isSubmitting}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="password"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Password</FormLabel>
                  <div className="relative">
                    <FormControl>
                      <Input
                        type={showPassword ? 'text' : 'password'}
                        placeholder="••••••••"
                        className="pr-10"
                        autoComplete="current-password"
                        {...field}
                        disabled={isSubmitting}
                      />
                    </FormControl>
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute inset-y-0 right-0 flex items-center pr-3 text-muted-foreground"
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                    >
                      {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                    </button>
                  </div>
                  <FormMessage />
                </FormItem>
              )}
            />
            <Button type="submit" className="w-full" disabled={isSubmitting}>
              {isSubmitting ? 'Signing In...' : 'Sign In'}
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}

/**
 * The wordmark, set above the card rather than inside it.
 *
 * It is the identity of the whole screen, not a heading for the form, and
 * lifting it out lets the card open with the one thing the reader came to do.
 */
function LoginMasthead() {
  return (
    <div className="mb-6 text-center">
      <span className="inline-flex items-center gap-2.5">
        <NibLogo className="h-10 w-10" />
        <span className="text-2xl font-semibold tracking-tight">NIB EPMO</span>
      </span>
      <p className="mt-2 text-sm text-muted-foreground">
        Enterprise project management office
      </p>
    </div>
  );
}

export default function LoginPage() {
  return (
    <div className="w-full max-w-sm">
      <LoginMasthead />
      <Suspense
        fallback={
          <Card>
            <CardHeader>
              <CardTitle className="text-xl">Sign in</CardTitle>
              <CardDescription>Loading…</CardDescription>
            </CardHeader>
          </Card>
        }
      >
        <LoginForm />
      </Suspense>
      <p className="mt-6 text-center text-xs text-muted-foreground">
        Forgotten your password? Contact your EPMO administrator to have it reset.
      </p>
    </div>
  );
}
