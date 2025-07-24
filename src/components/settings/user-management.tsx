
"use client";

import { useState, useTransition } from "react";
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
import { Pencil, PlusCircle, Trash2, ChevronDown, Eye, EyeOff } from "lucide-react";
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
import type { Role, User, PmoDivision } from "@prisma/client";
import { updateUser, createUser, deleteUser } from "@/app/settings/actions";
import { Badge } from "../ui/badge";
import {
    DropdownMenu,
    DropdownMenuCheckboxItem,
    DropdownMenuContent,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { useAuth } from "@/context/auth-context";
import { Separator } from "../ui/separator";

type UserWithRoles = User & { roles: Role[] };

type UserManagementProps = {
  initialUsers: UserWithRoles[];
  initialRoles: Role[];
  initialPmoDivisions: PmoDivision[];
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
  newPassword: z.string().optional(),
});
type EditUserFormValues = z.infer<typeof editUserSchema>;

const addUserSchema = z.object({
  firstName: z.string().min(1, "First name is required."),
  lastName: z.string().min(1, "Last name is required."),
  email: z.string().email("A valid email is required."),
  phoneNumber: z.string().min(1, "Phone number is required."),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  pmoDivisionId: z.string().nonempty("Please select a PMO division."),
  roleIds: z.array(z.string()).optional(),
});
type AddUserFormValues = z.infer<typeof addUserSchema>;

export function UserManagement({ initialUsers, initialRoles, initialPmoDivisions, onDataChange }: UserManagementProps) {
  const { toast } = useToast();
  const [isPending, startTransition] = useTransition();
  const { accessToken, hasPermission } = useAuth();
  
  const canManageUsers = hasPermission('config:manage-users');

  const [editingUser, setEditingUser] = useState<UserWithRoles | null>(null);
  const [userToDelete, setUserToDelete] = useState<UserWithRoles | null>(null);
  const [isAddUserDialogOpen, setIsAddUserDialogOpen] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  const editUserForm = useForm<EditUserFormValues>({
    resolver: zodResolver(editUserSchema),
    defaultValues: {
      firstName: "",
      lastName: "",
      email: "",
      phoneNumber: "",
      pmoDivisionId: "",
      roleIds: [],
      newPassword: "",
    },
  });

  const addUserForm = useForm<AddUserFormValues>({
    resolver: zodResolver(addUserSchema),
    defaultValues: {
      firstName: "",
      lastName: "",
      email: "",
      phoneNumber: "",
      password: "",
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
      newPassword: "",
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

  function onEditUserSubmit(data: EditUserFormValues) {
    if (!editingUser || !accessToken) return;
    startTransition(async () => {
        const result = await updateUser(editingUser.id, data, accessToken);
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
        if (!accessToken) {
            toast({ title: "Authentication Error", description: "You are not authenticated. Please log in again.", variant: "destructive" });
            return;
        }
        const result = await createUser({ ...data, roleIds: data.roleIds || [] }, accessToken);
        if (result.success) {
            toast({ title: "User Created", description: `User ${data.firstName} ${data.lastName} has been created.` });
            handleCloseAddUserDialog();
            onDataChange();
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
  
  const totalPages = Math.ceil(initialUsers.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const currentUsers = initialUsers.slice(startIndex, endIndex);

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
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Users</CardTitle>
              <CardDescription>
                A list of all users in the system. Assign roles to manage their permissions.
              </CardDescription>
            </div>
            {canManageUsers && (
              <Button onClick={handleOpenAddUserDialog}>
                <PlusCircle className="mr-2 h-4 w-4" /> Add User
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <Table>
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
      </Card>

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
                              <FormLabel>PMO Division</FormLabel>
                              <Select onValueChange={field.onChange} value={field.value}>
                                  <FormControl>
                                      <SelectTrigger><SelectValue placeholder="Select a PMO division" /></SelectTrigger>
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
                  <Separator />
                   <FormField
                      control={editUserForm.control}
                      name="newPassword"
                      render={({ field }) => (
                          <FormItem>
                              <FormLabel>New Password (Optional)</FormLabel>
                               <div className="relative">
                                  <FormControl>
                                      <Input
                                          type={showPassword ? 'text' : 'password'}
                                          placeholder="Leave blank to keep current password"
                                          className="pr-10"
                                          {...field}
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
      
      <Dialog open={isAddUserDialogOpen} onOpenChange={setIsAddUserDialogOpen}>
        <DialogContent className="p-0 flex flex-col max-h-[90dvh]">
          <DialogHeader className="p-6 pb-4">
            <DialogTitle>Add New User</DialogTitle>
            <DialogDescription>Create a new user account and assign initial roles.</DialogDescription>
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
                  <FormField control={addUserForm.control} name="password" render={({ field }) => (
                      <FormItem>
                          <FormLabel>Set Password</FormLabel>
                          <div className="relative">
                            <FormControl>
                                <Input
                                    type={showPassword ? 'text' : 'password'}
                                    placeholder="••••••••"
                                    className="pr-10"
                                    {...field}
                                />
                            </FormControl>
                            <button
                                type="button"
                                onClick={() => setShowPassword(!showPassword)}
                                className="absolute inset-y-0 right-0 flex items-center pr-3 text-muted-foreground"
                                aria-label={showPassword ? 'Hide password' : 'Show password'}
                            >
                                {showPassword ? (
                                    <EyeOff className="h-5 w-5" />
                                ) : (
                                    <Eye className="h-5 w-5" />
                                )}
                            </button>
                          </div>
                          <FormMessage />
                      </FormItem>
                  )} />
                  <FormField
                      control={addUserForm.control}
                      name="pmoDivisionId"
                      render={({ field }) => (
                          <FormItem>
                              <FormLabel>PMO Division</FormLabel>
                              <Select onValueChange={field.onChange} value={field.value}>
                                  <FormControl>
                                      <SelectTrigger><SelectValue placeholder="Select a PMO division" /></SelectTrigger>
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
    </>
  );
}
