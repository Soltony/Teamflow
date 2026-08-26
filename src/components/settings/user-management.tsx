

"use client";

import { useState, useTransition, useEffect, useMemo } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "../ui/button";
import { Pencil, PlusCircle, Trash2, ChevronDown, Eye, EyeOff, KeyRound, Search } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "../ui/form";
import { Input } from "../ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

// UserWithRoles and Role come from lib/types, which describes what the
// browser actually receives. Building them from the Prisma row instead
// declared a passwordHash on data the query deliberately never selects.
import type { Role, UserWithRoles } from "@/lib/types";

/** Only what the division dropdown renders. */
type PmoDivisionOption = { id: string; name: string };
import { updateUser, createUser, deleteUser, resetUserPassword } from "@/app/settings/actions";
import { Badge } from "../ui/badge";
import {
    DropdownMenu,
    DropdownMenuCheckboxItem,
    DropdownMenuContent,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { useAuth } from "@/context/auth-context";
import { Skeleton } from "../ui/skeleton";


type UserManagementProps = {
  initialUsers: UserWithRoles[];
  initialRoles: Role[];
  initialPmoDivisions: PmoDivisionOption[];
  onDataChange: () => void;
};

const editUserSchema = z.object({
  firstName: z.string().min(1, "First name is required."),
  lastName: z.string().min(1, "Last name is required."),
  email: z.string().email("A valid email is required."),
  phoneNumber: z.string().min(1, "Phone number is required."),
  pmoDivisionId: z.string().optional(),
  roleIds: z.array(z.string()).refine((value) => value.some((item) => item), {
      message: "You have to select at least one role.",
  }),
});
type EditUserFormValues = z.infer<typeof editUserSchema>;

const addUserSchema = z.object({
  firstName: z.string().min(1, "First name is required."),
  lastName: z.string().min(1, "Last name is required."),
  email: z.string().email("A valid email is required."),
  phoneNumber: z.string().min(1, "Phone number is required."),
  pmoDivisionId: z.string().nonempty("Please select an EPMO division."),
  roleIds: z.array(z.string()).optional(),
});
type AddUserFormValues = z.infer<typeof addUserSchema>;

export function UserManagement({ initialUsers, initialRoles, initialPmoDivisions, onDataChange }: UserManagementProps) {
  const { toast } = useToast();
  const [isPending, startTransition] = useTransition();
  const { hasPermission } = useAuth();

  const canManageUsers = hasPermission('config:manage-users');

  const [editingUser, setEditingUser] = useState<UserWithRoles | null>(null);
  const [userToDelete, setUserToDelete] = useState<UserWithRoles | null>(null);
  const [isAddUserDialogOpen, setIsAddUserDialogOpen] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  /**
   * A password reset produces a one-time temporary password that is shown to
   * the administrator so they can pass it on. It is never emailed and cannot
   * be retrieved again — only its hash is stored.
   */
  const [passwordResetData, setPasswordResetData] = useState<{
    user: UserWithRoles;
    temporaryPassword: string | null;
    error: string | null;
    loading: boolean;
  }>({ user: {} as UserWithRoles, temporaryPassword: null, error: null, loading: false });

  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  const filteredUsers = useMemo(() => {
    if (!searchQuery) {
      return initialUsers;
    }
    return initialUsers.filter(user =>
      user.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      user.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (user.phoneNumber && user.phoneNumber.includes(searchQuery))
    );
  }, [initialUsers, searchQuery]);

  const editUserForm = useForm<EditUserFormValues>({
    resolver: zodResolver(editUserSchema),
    defaultValues: {
      firstName: "",
      lastName: "",
      email: "",
      phoneNumber: "",
      pmoDivisionId: "",
      roleIds: [],
    },
  });

  const addUserForm = useForm<AddUserFormValues>({
    resolver: zodResolver(addUserSchema),
    defaultValues: {
      firstName: "",
      lastName: "",
      email: "",
      phoneNumber: "",
      pmoDivisionId: "",
      roleIds: [],
    },
  });


  const handleEdit = (user: UserWithRoles) => {
    setEditingUser(user);
    editUserForm.reset({
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      phoneNumber: user.phoneNumber ?? '',
      pmoDivisionId: user.pmoDivisionId ?? '',
      roleIds: user.roles.map(role => role.id),
    });
  };

  const handleCloseEditDialog = () => {
    setEditingUser(null);
    editUserForm.reset();
  };
  
  const handleOpenAddUserDialog = () => {
    addUserForm.reset();
    setIsAddUserDialogOpen(true);
  };
  
  const handleCloseAddUserDialog = () => {
    setIsAddUserDialogOpen(false);
  };

  const handleOpenPasswordDialog = (user: UserWithRoles) => {
    setPasswordResetData({ user, temporaryPassword: null, error: null, loading: true });

    startTransition(async () => {
      const result = await resetUserPassword(user.id);
      if (result.success) {
        setPasswordResetData({
          user,
          temporaryPassword: result.temporaryPassword,
          error: null,
          loading: false,
        });
        onDataChange();
      } else {
        setPasswordResetData({
          user,
          temporaryPassword: null,
          error: result.error || 'Failed to reset the password.',
          loading: false,
        });
      }
    });
  };

  const handleClosePasswordDialog = () => {
    setPasswordResetData({ user: {} as UserWithRoles, temporaryPassword: null, error: null, loading: false });
  };

  function onEditUserSubmit(data: EditUserFormValues) {
    if (!editingUser) return;
    startTransition(async () => {
        const result = await updateUser(editingUser.id, data);
        if (result.success) {
            toast({
                title: "User Updated",
                description: `Successfully updated details for ${editingUser.name}.`,
            });
            handleCloseEditDialog();
            onDataChange();
        } else {
            toast({ title: "Error", description: result.error, variant: "destructive" });
        }
    });
  }

  const onAddUserSubmit = (data: AddUserFormValues) => {
    startTransition(async () => {
        const result = await createUser({ ...data, roleIds: data.roleIds || [] });
        if (result.success) {
            handleCloseAddUserDialog();
            onDataChange();
            // Show the generated password in the same dialog used for resets,
            // since it is the only time it will ever be visible.
            setPasswordResetData({
              user: { ...(data as unknown as UserWithRoles), name: `${data.firstName} ${data.lastName}` },
              temporaryPassword: result.temporaryPassword,
              error: null,
              loading: false,
            });
        } else {
            toast({ title: "Error", description: result.error, variant: "destructive" });
        }
    });
  };

  const handleDeleteConfirm = () => {
    if (!userToDelete) return;
    startTransition(async () => {
      const result = await deleteUser(userToDelete.id);
      if (result.success) {
        toast({ title: "User Deleted", description: `The user "${userToDelete.name}" has been removed.` });
        onDataChange();
      } else {
        toast({ title: "Error", description: result.error, variant: "destructive" });
      }
      setUserToDelete(null);
    });
  };

  const selectedRolesForEditUser = initialRoles.filter(role => editUserForm.watch('roleIds')?.includes(role.id));
  const selectedRolesForNewUser = initialRoles.filter(role => addUserForm.watch('roleIds')?.includes(role.id));
  
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery]);

  const totalPages = Math.ceil(filteredUsers.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const currentUsers = filteredUsers.slice(startIndex, endIndex);

  const handleNextPage = () => {
    if (currentPage < totalPages) {
      setCurrentPage(currentPage + 1);
    }
  };

  const handlePrevPage = () => {
    if (currentPage > 1) {
      setCurrentPage(currentPage - 1);
    }
  };

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <CardTitle>Users</CardTitle>
              <CardDescription>
                A list of all users in the system. Assign roles to manage their permissions.
              </CardDescription>
            </div>
            <div className="flex flex-col-reverse sm:flex-row items-center gap-2 w-full sm:w-auto">
                <div className="relative w-full sm:w-auto">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                        type="search"
                        placeholder="Search users..."
                        className="w-full rounded-lg bg-background pl-8 sm:w-[200px] lg:w-[250px]"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                    />
                </div>
                {canManageUsers && (
                    <Button onClick={handleOpenAddUserDialog} className="w-full sm:w-auto">
                        <PlusCircle className="mr-2 h-4 w-4" /> Add User
                    </Button>
                )}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Table scrollLabel="User accounts">
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Phone Number</TableHead>
                <TableHead>Roles</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {currentUsers.map((user) => (
                <TableRow key={user.id}>
                  <TableCell className="font-medium">{user.name}</TableCell>
                  <TableCell>{user.email ?? 'N/A'}</TableCell>
                  <TableCell>{user.phoneNumber ?? 'N/A'}</TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                        {user.roles.map(role => (
                            <Badge key={role.id} variant="secondary">{role.name}</Badge>
                        ))}
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    {canManageUsers && (
                      <div className="flex items-center justify-end gap-1">
                          <Button variant="ghost" size="icon" onClick={() => handleEdit(user)}>
                            <Pencil className="h-4 w-4" />
                            <span className="sr-only">Edit User</span>
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => handleOpenPasswordDialog(user)}>
                            <KeyRound className="h-4 w-4" />
                            <span className="sr-only">Change Password</span>
                          </Button>
                           <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive" onClick={() => setUserToDelete(user)}>
                            <Trash2 className="h-4 w-4" />
                            <span className="sr-only">Delete User</span>
                          </Button>
                      </div>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
        {totalPages > 1 && (
            <CardFooter>
            <div className="flex items-center justify-center w-full space-x-2">
                <span className="text-sm text-muted-foreground">
                    Page {currentPage} of {totalPages}
                </span>
                <Button
                    variant="outline"
                    size="sm"
                    onClick={handlePrevPage}
                    disabled={currentPage === 1}
                >
                    Previous
                </Button>
                <Button
                    variant="outline"
                    size="sm"
                    onClick={handleNextPage}
                    disabled={currentPage === totalPages}
                >
                    Next
                </Button>
            </div>
            </CardFooter>
        )}
      </Card>

      {/* Edit User Dialog */}
      <Dialog open={!!editingUser} onOpenChange={(open) => !open && handleCloseEditDialog()}>
        <DialogContent className="p-0 flex flex-col max-h-[90dvh]">
          <DialogHeader className="p-6 pb-4">
            <DialogTitle>Edit User: {editingUser?.name}</DialogTitle>
            <DialogDescription>Update the user's details and assigned roles.</DialogDescription>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto px-6">
            <Form {...editUserForm}>
              <form id="edit-user-form" onSubmit={editUserForm.handleSubmit(onEditUserSubmit)} className="space-y-4 py-4">
                  <div className="grid grid-cols-2 gap-4">
                       <FormField control={editUserForm.control} name="firstName" render={({ field }) => (
                          <FormItem><FormLabel>First Name</FormLabel><FormControl><Input placeholder="John" {...field} /></FormControl><FormMessage /></FormItem>
                      )} />
                      <FormField control={editUserForm.control} name="lastName" render={({ field }) => (
                          <FormItem><FormLabel>Last Name</FormLabel><FormControl><Input placeholder="Doe" {...field} /></FormControl><FormMessage /></FormItem>
                      )} />
                  </div>
                  <FormField control={editUserForm.control} name="phoneNumber" render={({ field }) => (
                      <FormItem><FormLabel>Phone Number</FormLabel><FormControl><Input placeholder="0912345678" {...field} /></FormControl><FormMessage /></FormItem>
                  )} />
                  <FormField control={editUserForm.control} name="email" render={({ field }) => (
                      <FormItem><FormLabel>Email</FormLabel><FormControl><Input placeholder="john.doe@example.com" {...field} /></FormControl><FormMessage /></FormItem>
                  )} />
                  <FormField
                      control={editUserForm.control}
                      name="pmoDivisionId"
                      render={({ field }) => (
                          <FormItem>
                              <FormLabel>EPMO Division</FormLabel>
                              <Select onValueChange={field.onChange} value={field.value}>
                                  <FormControl>
                                      <SelectTrigger><SelectValue placeholder="Select an EPMO division" /></SelectTrigger>
                                  </FormControl>
                                  <SelectContent>
                                      {initialPmoDivisions.map(div => <SelectItem key={div.id} value={div.id}>{div.name}</SelectItem>)}
                                  </SelectContent>
                              </Select>
                              <FormMessage />
                          </FormItem>
                      )}
                  />
                  <FormField
                      control={editUserForm.control}
                      name="roleIds"
                      render={({ field }) => (
                          <FormItem className="flex flex-col">
                              <FormLabel>Roles</FormLabel>
                              <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
                                      <FormControl>
                                      <Button variant="outline" className={cn("w-full justify-start", !field.value?.length && "text-muted-foreground")}>
                                          {selectedRolesForEditUser.length > 0 ? selectedRolesForEditUser.map(r => r.name).join(', ') : "Select roles..."}
                                          <ChevronDown className="ml-auto h-4 w-4" />
                                      </Button>
                                      </FormControl>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent className="w-[--radix-dropdown-menu-trigger-width]">
                                      {initialRoles.map((role) => (
                                      <DropdownMenuCheckboxItem
                                          key={role.id}
                                          checked={field.value?.includes(role.id)}
                                          onCheckedChange={(checked) => {
                                              const currentValues = field.value || [];
                                              const newValues = checked
                                                  ? [...currentValues, role.id]
                                                  : currentValues.filter(id => id !== role.id);
                                              field.onChange(newValues);
                                          }}
                                      >
                                          {role.name}
                                      </DropdownMenuCheckboxItem>
                                      ))}
                                  </DropdownMenuContent>
                              </DropdownMenu>
                              <FormMessage />
                          </FormItem>
                      )}
                  />
              </form>
            </Form>
          </div>
          <DialogFooter className="p-6 pt-4 border-t">
            <Button type="button" variant="outline" onClick={handleCloseEditDialog} disabled={isPending}>Cancel</Button>
            <Button type="submit" form="edit-user-form" disabled={isPending}>
                {isPending ? "Saving..." : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {/* Add User Dialog */}
      <Dialog open={isAddUserDialogOpen} onOpenChange={setIsAddUserDialogOpen}>
        <DialogContent className="p-0 flex flex-col max-h-[90dvh]">
          <DialogHeader className="p-6 pb-4">
            <DialogTitle>Add New User</DialogTitle>
            <DialogDescription>Create a new user account and assign initial roles. A one-time temporary password will be generated for you to hand over; the user must change it when they first sign in.</DialogDescription>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto px-6">
            <Form {...addUserForm}>
              <form id="add-user-form" onSubmit={addUserForm.handleSubmit(onAddUserSubmit)} className="space-y-4 py-4">
                  <div className="grid grid-cols-2 gap-4">
                       <FormField control={addUserForm.control} name="firstName" render={({ field }) => (
                          <FormItem><FormLabel>First Name</FormLabel><FormControl><Input placeholder="John" {...field} /></FormControl><FormMessage /></FormItem>
                      )} />
                      <FormField control={addUserForm.control} name="lastName" render={({ field }) => (
                          <FormItem><FormLabel>Last Name</FormLabel><FormControl><Input placeholder="Doe" {...field} /></FormControl><FormMessage /></FormItem>
                      )} />
                  </div>
                  <FormField control={addUserForm.control} name="phoneNumber" render={({ field }) => (
                      <FormItem><FormLabel>Phone Number</FormLabel><FormControl><Input placeholder="0912345678" {...field} /></FormControl><FormMessage /></FormItem>
                  )} />
                  <FormField control={addUserForm.control} name="email" render={({ field }) => (
                      <FormItem><FormLabel>Email</FormLabel><FormControl><Input placeholder="john.doe@example.com" {...field} /></FormControl><FormMessage /></FormItem>
                  )} />
                  <FormField
                      control={addUserForm.control}
                      name="pmoDivisionId"
                      render={({ field }) => (
                          <FormItem>
                              <FormLabel>EPMO Division</FormLabel>
                              <Select onValueChange={field.onChange} value={field.value}>
                                  <FormControl>
                                      <SelectTrigger><SelectValue placeholder="Select an EPMO division" /></SelectTrigger>
                                  </FormControl>
                                  <SelectContent>
                                      {initialPmoDivisions.map(div => <SelectItem key={div.id} value={div.id}>{div.name}</SelectItem>)}
                                  </SelectContent>
                              </Select>
                              <FormMessage />
                          </FormItem>
                      )}
                  />
                  <FormField
                      control={addUserForm.control}
                      name="roleIds"
                      render={({ field }) => (
                          <FormItem className="flex flex-col">
                              <FormLabel>Roles</FormLabel>
                              <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
                                      <FormControl>
                                      <Button variant="outline" className={cn("w-full justify-start", !field.value?.length && "text-muted-foreground")}>
                                          {selectedRolesForNewUser.length > 0 ? selectedRolesForNewUser.map(r => r.name).join(', ') : "Select initial roles..."}
                                          <ChevronDown className="ml-auto h-4 w-4" />
                                      </Button>
                                      </FormControl>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent className="w-[--radix-dropdown-menu-trigger-width]">
                                      {initialRoles.map((role) => (
                                      <DropdownMenuCheckboxItem
                                          key={role.id}
                                          checked={field.value?.includes(role.id)}
                                          onCheckedChange={(checked) => {
                                              const currentValues = field.value || [];
                                              const newValues = checked
                                                  ? [...currentValues, role.id]
                                                  : currentValues.filter(id => id !== role.id);
                                              field.onChange(newValues);
                                          }}
                                      >
                                          {role.name}
                                      </DropdownMenuCheckboxItem>
                                      ))}
                                  </DropdownMenuContent>
                              </DropdownMenu>
                              <FormMessage />
                          </FormItem>
                      )}
                  />
              </form>
            </Form>
          </div>
          <DialogFooter className="p-6 pt-4 border-t">
             <Button type="button" variant="outline" onClick={handleCloseAddUserDialog} disabled={isPending}>Cancel</Button>
             <Button type="submit" form="add-user-form" disabled={isPending}>
                 {isPending ? "Creating..." : "Create User"}
             </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {/* Delete User Dialog */}
      <AlertDialog open={!!userToDelete} onOpenChange={(open) => !open && setUserToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the user account for <span className="font-semibold">{userToDelete?.name}</span>.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setUserToDelete(null)} disabled={isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={handleDeleteConfirm}
              disabled={isPending}
            >
              {isPending ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Temporary password dialog — shown after a reset or a new account */}
      <Dialog
        open={passwordResetData.loading || !!passwordResetData.temporaryPassword || !!passwordResetData.error}
        onOpenChange={handleClosePasswordDialog}
      >
        <DialogContent>
            <DialogHeader>
                <DialogTitle>Temporary password for {passwordResetData.user?.name}</DialogTitle>
                <DialogDescription>
                    {passwordResetData.loading
                      ? 'Generating a temporary password...'
                      : passwordResetData.error
                        ? 'The password could not be reset.'
                        : 'Give this password to the user in person. It is shown once and cannot be retrieved again. They must change it when they sign in.'}
                </DialogDescription>
            </DialogHeader>

            {passwordResetData.loading && (
                <div className="py-4 space-y-4">
                    <Skeleton className="h-10 w-full" />
                </div>
            )}

            {passwordResetData.error && (
                <div className="py-4 text-center text-destructive">
                    <p>{passwordResetData.error}</p>
                </div>
            )}

            {passwordResetData.temporaryPassword && !passwordResetData.loading && (
                <div className="py-4 space-y-3">
                    <div className="rounded-md border bg-muted p-4 text-center">
                        <code className="select-all font-mono text-lg tracking-wider">
                            {passwordResetData.temporaryPassword}
                        </code>
                    </div>
                    <Button
                        type="button"
                        variant="outline"
                        className="w-full"
                        onClick={() => {
                            navigator.clipboard
                                ?.writeText(passwordResetData.temporaryPassword!)
                                .then(() => toast({ title: 'Copied to clipboard' }))
                                .catch(() => toast({
                                    title: 'Could not copy',
                                    description: 'Select the password and copy it manually.',
                                    variant: 'destructive',
                                }));
                        }}
                    >
                        Copy password
                    </Button>
                    <p className="text-xs text-muted-foreground">
                        Any sessions this user had open have been signed out.
                    </p>
                </div>
            )}

            <DialogFooter>
                <Button onClick={handleClosePasswordDialog} disabled={isPending}>Done</Button>
            </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
