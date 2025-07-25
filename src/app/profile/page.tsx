
'use client';

import { useState, useTransition } from 'react';
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
import { Eye, EyeOff } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { changePassword, updateUserProfile } from './actions';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

const profileSchema = z.object({
    email: z.string().email('A valid email is required.'),
    phoneNumber: z.string().min(1, 'Phone number is required.'),
});

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required.'),
  newPassword: z.string().min(6, 'New password must be at least 6 characters.'),
  confirmPassword: z.string(),
}).refine(data => data.newPassword === data.confirmPassword, {
  message: "Passwords don't match.",
  path: ['confirmPassword'],
});

type ProfileFormValues = z.infer<typeof profileSchema>;
type ChangePasswordFormValues = z.infer<typeof changePasswordSchema>;

export default function ProfilePage() {
  const { localUser, accessToken, logout } = useAuth();
  const { toast } = useToast();
  const [isProfilePending, startProfileTransition] = useTransition();
  const [isPasswordPending, startPasswordTransition] = useTransition();

  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const profileForm = useForm<ProfileFormValues>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      email: localUser?.email || '',
      phoneNumber: localUser?.phoneNumber || '',
    },
  });

  const passwordForm = useForm<ChangePasswordFormValues>({
    resolver: zodResolver(changePasswordSchema),
    defaultValues: {
      currentPassword: '',
      newPassword: '',
      confirmPassword: '',
    },
  });

  const onProfileSubmit = (data: ProfileFormValues) => {
    startProfileTransition(async () => {
        if (!localUser || !accessToken) return;
        const result = await updateUserProfile(localUser.id, data, accessToken);
        if (result.success) {
            toast({
                title: 'Profile Updated',
                description: 'Your profile information has been successfully updated.',
            });
            // Optionally, refresh auth context data if it's stale
        } else {
            toast({
                title: 'Error Updating Profile',
                description: result.error,
                variant: 'destructive',
            });
        }
    });
  };

  const onPasswordSubmit = (data: ChangePasswordFormValues) => {
    startPasswordTransition(async () => {
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
      }, accessToken);

      if (result.success) {
        toast({
          title: 'Password Changed Successfully',
          description: 'Your password has been updated. Please log in again with your new password.',
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
        <Tabs defaultValue="profile" className="max-w-2xl mx-auto">
            <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="profile">Profile</TabsTrigger>
                <TabsTrigger value="password">Password</TabsTrigger>
            </TabsList>
            <TabsContent value="profile">
                <Card>
                    <CardHeader>
                        <CardTitle>Profile</CardTitle>
                        <CardDescription>
                            This is how others will see you on the site.
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <Form {...profileForm}>
                            <form onSubmit={profileForm.handleSubmit(onProfileSubmit)} className="space-y-4">
                                <div className="grid grid-cols-2 gap-4">
                                    <FormItem>
                                        <FormLabel>First Name</FormLabel>
                                        <FormControl>
                                            <Input value={localUser?.firstName || ''} disabled />
                                        </FormControl>
                                    </FormItem>
                                    <FormItem>
                                        <FormLabel>Last Name</FormLabel>
                                        <FormControl>
                                            <Input value={localUser?.lastName || ''} disabled />
                                        </FormControl>
                                    </FormItem>
                                </div>
                                <FormField control={profileForm.control} name="email" render={({ field }) => (
                                    <FormItem><FormLabel>Email</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                                )} />
                                <FormField control={profileForm.control} name="phoneNumber" render={({ field }) => (
                                    <FormItem><FormLabel>Phone Number</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                                )} />
                                <div className="pt-2 flex justify-end">
                                    <Button type="submit" disabled={isProfilePending}>
                                        {isProfilePending ? 'Saving...' : 'Save Changes'}
                                    </Button>
                                </div>
                            </form>
                        </Form>
                    </CardContent>
                </Card>
            </TabsContent>
            <TabsContent value="password">
                <Card>
                    <CardHeader>
                        <CardTitle>Password</CardTitle>
                        <CardDescription>
                            Change your password here. After saving, you'll be logged out.
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                         <Form {...passwordForm}>
                            <form onSubmit={passwordForm.handleSubmit(onPasswordSubmit)} className="space-y-4">
                            <FormField
                                control={passwordForm.control}
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
                                        disabled={isPasswordPending}
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
                            <FormField
                                control={passwordForm.control}
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
                                        disabled={isPasswordPending}
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
                                control={passwordForm.control}
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
                                        disabled={isPasswordPending}
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
                            <div className="pt-2 flex justify-end">
                                <Button type="submit" disabled={isPasswordPending}>
                                    {isPasswordPending ? 'Changing Password...' : 'Change Password'}
                                </Button>
                            </div>
                            </form>
                        </Form>
                    </CardContent>
                </Card>
            </TabsContent>
        </Tabs>
    </div>
  );
}
