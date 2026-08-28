'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Eye, EyeOff, KeyRound } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';
import { changePasswordAction } from '@/app/auth/actions';
import { PASSWORD_POLICY_HINT, passwordSchema } from '@/lib/auth/password-schema';

const schema = z
  .object({
    currentPassword: z.string().min(1, 'Enter your current password'),
    newPassword: passwordSchema,
    confirmPassword: z.string().min(1, 'Confirm your new password'),
  })
  .refine((d) => d.newPassword === d.confirmPassword, {
    message: 'The two passwords do not match',
    path: ['confirmPassword'],
  })
  .refine((d) => d.newPassword !== d.currentPassword, {
    message: 'Choose a password different from your current one',
    path: ['newPassword'],
  });

type FormValues = z.infer<typeof schema>;

/**
 * The password change form, in its two situations.
 *
 * `mustChange` is the account being held at the door — a new account, or one
 * an administrator has reset — where ProtectedShell blocks every other route
 * until this is done, and there is deliberately nowhere else to go. Without it
 * somebody has chosen to change their password from the account menu, so the
 * copy stops claiming their password is temporary and the screen offers a way
 * back out. Getting this wrong strands the voluntary visitor on a page telling
 * them something untrue with no exit.
 */
export function ChangePasswordForm({ mustChange }: { mustChange: boolean }) {
  const router = useRouter();
  const { toast } = useToast();
  const [error, setError] = useState<string | null>(null);
  const [show, setShow] = useState(false);

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { currentPassword: '', newPassword: '', confirmPassword: '' },
  });

  const { isSubmitting } = form.formState;

  async function onSubmit(values: FormValues) {
    setError(null);
    const result = await changePasswordAction({
      currentPassword: values.currentPassword,
      newPassword: values.newPassword,
    });

    if (!result.success) {
      setError(result.error);
      return;
    }

    toast({
      title: 'Password changed',
      description: 'You have been signed out everywhere. Sign in with your new password.',
    });
    // The toast does not survive the navigation reliably; the flag gives the
    // sign-in screen its own notice, so the reason they are back here is on
    // the page they land on.
    router.replace('/login?passwordChanged=1');
    router.refresh();
  }

  return (
    <Card className="w-full max-w-md">
      <CardHeader className="text-center">
        <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-primary/15">
          <KeyRound className="h-6 w-6 text-primary-strong" />
        </div>
        <CardTitle>{mustChange ? 'Choose a new password' : 'Change your password'}</CardTitle>
        <CardDescription>
          {mustChange
            ? 'Your account is using a temporary password. Set your own before continuing.'
            : 'Changing your password signs you out on every device, including this one.'}
        </CardDescription>
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
              name="currentPassword"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Current password</FormLabel>
                  <FormControl>
                    <Input type="password" autoComplete="current-password" {...field} disabled={isSubmitting} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="newPassword"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>New password</FormLabel>
                  <div className="relative">
                    <FormControl>
                      <Input
                        type={show ? 'text' : 'password'}
                        className="pr-10"
                        autoComplete="new-password"
                        {...field}
                        disabled={isSubmitting}
                      />
                    </FormControl>
                    <button
                      type="button"
                      onClick={() => setShow(!show)}
                      className="absolute inset-y-0 right-0 flex items-center pr-3 text-muted-foreground"
                      aria-label={show ? 'Hide password' : 'Show password'}
                    >
                      {show ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                    </button>
                  </div>
                  <FormDescription>{PASSWORD_POLICY_HINT}</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="confirmPassword"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Confirm new password</FormLabel>
                  <FormControl>
                    <Input type="password" autoComplete="new-password" {...field} disabled={isSubmitting} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <Button type="submit" className="w-full" disabled={isSubmitting}>
              {isSubmitting
                ? 'Saving...'
                : mustChange
                  ? 'Set password and sign in again'
                  : 'Change password and sign in again'}
            </Button>
            {/*
              Only offered when the change is optional. While `mustChange` is
              set there is nothing to go back to — every other route redirects
              straight back here — so a cancel link would be a loop.
            */}
            {!mustChange && (
              <Button asChild variant="ghost" className="w-full">
                <Link href="/dashboard">Cancel</Link>
              </Button>
            )}
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
