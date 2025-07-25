
'use client';

import { useState, useTransition, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useAuth } from '@/context/auth-context';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Eye, EyeOff, AlertTriangle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { changePassword } from './actions';
import { Alert, AlertDescription } from '@/components/ui/alert';

const changePasswordSchema = (isForcedChange: boolean) => z.object({
  currentPassword: z.string().optional(),
  newPassword: z.string().min(6, 'New password must be at least 6 characters.'),
  confirmPassword: z.string(),
}).refine(data => data.newPassword === data.confirmPassword, {
  message: "Passwords don't match.",
  path: ['confirmPassword'],
}).refine(data => {
    if (!isForcedChange) {
      return !!data.currentPassword && data.currentPassword.length > 0;
    }
    return true;
}, {
    message: 'Current password is required.',
    path: ['currentPassword']
});

type ChangePasswordFormValues = z.infer<ReturnType<typeof changePasswordSchema>>;

export default function ProfilePage() {
  const { localUser, accessToken, logout } = useAuth();
  const { toast } = useToast();
  const [isPending, startTransition] = useTransition();

  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  
  const [isForcedChange, setIsForcedChange] = useState(false);

  useEffect(() => {
    const forcedPhone = localStorage.getItem('forcePasswordChange');
    if (forcedPhone && localUser && forcedPhone === localUser.phoneNumber) {
        setIsForcedChange(true);
    }
  }, [localUser]);


  const form = useForm<ChangePasswordFormValues>({
    resolver: zodResolver(changePasswordSchema(isForcedChange)),
    defaultValues: {
      currentPassword: '',
      newPassword: '',
      confirmPassword: '',
    },
  });

  const onSubmit = (data: ChangePasswordFormValues) => {
    startTransition(async () => {
      if (!localUser || !localUser.phoneNumber || !accessToken) {
        toast({
          title: 'Authentication Error',
          description: 'Your user profile is incomplete or you are not logged in. Please log in again.',
          variant: 'destructive',
        });
        return;
      }

      const result = await changePassword({
        phoneNumber: localUser.phoneNumber,
        currentPassword: data.currentPassword,
        newPassword: data.newPassword,
        isForcedChange,
      }, accessToken);

      if (result.success) {
        if (isForcedChange) {
            localStorage.removeItem('forcePasswordChange');
        }
        toast({
          title: 'Password Changed Successfully',
          description: isForcedChange ? 'Your new password has been set. You can now access the application.' : 'Your password has been updated. Please log in again with your new password.',
        });
        logout();
      } else {
        toast({
          title: 'Error Changing Password',
          description: result.error,
          variant: 'destructive',
        });
      }
    });
  };

  return (
    <div className="p-4 sm:p-6">
      <Card className="max-w-2xl mx-auto">
        <CardHeader>
          <CardTitle>Change Password</CardTitle>
          <CardDescription>
             {isForcedChange 
                ? 'As a new user, you must change your temporary password before you can proceed.'
                : 'Enter your current password and a new password to update your account.'
             }
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isForcedChange && (
            <Alert variant="destructive" className="mb-6">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                   A password change is required for your account. Please set a new password below.
                </AlertDescription>
            </Alert>
          )}
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              {!isForcedChange && (
                <FormField
                    control={form.control}
                    name="currentPassword"
                    render={({ field }) => (
                    <FormItem>
                        <FormLabel>Current Password</FormLabel>
                        <div className="relative">
                        <FormControl>
                            <Input
                            type={showCurrentPassword ? 'text' : 'password'}
                            placeholder="••••••••"
                            {...field}
                            disabled={isPending}
                            />
                        </FormControl>
                        <button
                            type="button"
                            onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                            className="absolute inset-y-0 right-0 flex items-center pr-3 text-muted-foreground"
                        >
                            {showCurrentPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                        </button>
                        </div>
                        <FormMessage />
                    </FormItem>
                    )}
                />
              )}
              <FormField
                control={form.control}
                name="newPassword"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>New Password</FormLabel>
                    <div className="relative">
                      <FormControl>
                        <Input
                          type={showNewPassword ? 'text' : 'password'}
                          placeholder="••••••••"
                          {...field}
                          disabled={isPending}
                        />
                      </FormControl>
                      <button
                        type="button"
                        onClick={() => setShowNewPassword(!showNewPassword)}
                        className="absolute inset-y-0 right-0 flex items-center pr-3 text-muted-foreground"
                      >
                        {showNewPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                      </button>
                    </div>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="confirmPassword"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Confirm New Password</FormLabel>
                    <div className="relative">
                      <FormControl>
                        <Input
                          type={showConfirmPassword ? 'text' : 'password'}
                          placeholder="••••••••"
                          {...field}
                          disabled={isPending}
                        />
                      </FormControl>
                       <button
                        type="button"
                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                        className="absolute inset-y-0 right-0 flex items-center pr-3 text-muted-foreground"
                      >
                        {showConfirmPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                      </button>
                    </div>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="pt-2">
                 <Button type="submit" className="w-full" disabled={isPending}>
                    {isPending ? 'Changing Password...' : 'Change Password'}
                </Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
