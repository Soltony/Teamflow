
"use client";

import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import {
  Card,
  CardContent,
  CardDescription,
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
import { Pencil, PlusCircle, Trash2, ChevronDown } from "lucide-react";
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
import { Checkbox } from "../ui/checkbox";
import type { Role, User } from "@prisma/client";
import { assignRolesToUser, createUser, deleteUser } from "@/app/config/actions";
import { Badge } from "../ui/badge";
import {
    DropdownMenu,
    DropdownMenuCheckboxItem,
    DropdownMenuContent,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

type UserWithRoles = User & { roles: Role[] };

type UserManagementProps = {
  initialUsers: UserWithRoles[];
  initialRoles: Role[];
};

const assignRolesSchema = z.object({
    roleIds: z.array(z.string()).refine((value) => value.some((item) => item), {
        message: "You have to select at least one role.",
    }),
});
type AssignRolesFormValues = z.infer<typeof assignRolesSchema>;

const addUserSchema = z.object({
  firstName: z.string().min(1, "First name is required."),
  lastName: z.string().min(1, "Last name is required."),
  email: z.string().email("Invalid email address."),
  phoneNumber: z.string().min(1, "Phone number is required."),
  roleIds: z.array(z.string()).optional(),
});
type AddUserFormValues = z.infer<typeof addUserSchema>;

export function UserManagement({ initialUsers, initialRoles }: UserManagementProps) {
  const { toast } = useToast();
  const [isPending, startTransition] = useTransition();

  const [editingUser, setEditingUser] = useState<UserWithRoles | null>(null);
  const [userToDelete, setUserToDelete] = useState<UserWithRoles | null>(null);
  const [isAddUserDialogOpen, setIsAddUserDialogOpen] = useState(false);

  const assignRolesForm = useForm<AssignRolesFormValues>({
    resolver: zodResolver(assignRolesSchema),
    defaultValues: { roleIds: [] },
  });

  const addUserForm = useForm<AddUserFormValues>({
    resolver: zodResolver(addUserSchema),
    defaultValues: {
      firstName: "",
      lastName: "",
      email: "",
      phoneNumber: "",
      roleIds: [],
    },
  });

  const handleEdit = (user: UserWithRoles) => {
    setEditingUser(user);
    assignRolesForm.reset({
      roleIds: user.roles.map(role => role.id),
    });
  };

  const handleCloseEditDialog = () => {
    setEditingUser(null);
    assignRolesForm.reset({ roleIds: [] });
  };
  
  const handleOpenAddUserDialog = () => {
    addUserForm.reset();
    setIsAddUserDialogOpen(true);
  };
  
  const handleCloseAddUserDialog = () => {
    setIsAddUserDialogOpen(false);
  };

  function onAssignRolesSubmit(data: AssignRolesFormValues) {
    if (!editingUser) return;
    startTransition(async () => {
        const result = await assignRolesToUser(editingUser.id, data.roleIds);
        if (result.success) {
            toast({
                title: "Roles Updated",
                description: `Successfully updated roles for ${editingUser.name}.`,
            });
            handleCloseEditDialog();
        } else {
            toast({ title: "Error", description: result.error, variant: "destructive" });
        }
    });
  }

  const onAddUserSubmit = (data: AddUserFormValues) => {
    startTransition(async () => {
        const result = await createUser({ ...data, roleIds: data.roleIds || [] });
        if (result.success) {
            toast({ title: "User Created", description: `User ${data.firstName} ${data.lastName} has been created.` });
            handleCloseAddUserDialog();
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
      } else {
        toast({ title: "Error", description: result.error, variant: "destructive" });
      }
      setUserToDelete(null);
    });
  };

  const selectedRolesForNewUser = initialRoles.filter(role => addUserForm.watch('roleIds')?.includes(role.id));

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
            <Button onClick={handleOpenAddUserDialog}>
              <PlusCircle className="mr-2 h-4 w-4" /> Add User
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Roles</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {initialUsers.map((user) => (
                <TableRow key={user.id}>
                  <TableCell className="font-medium">{user.name}</TableCell>
                  <TableCell>{user.email}</TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                        {user.roles.map(role => (
                            <Badge key={role.id} variant="secondary">{role.name}</Badge>
                        ))}
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                        <Button variant="ghost" size="icon" onClick={() => handleEdit(user)}>
                          <Pencil className="h-4 w-4" />
                          <span className="sr-only">Edit Roles</span>
                        </Button>
                         <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive" onClick={() => setUserToDelete(user)}>
                          <Trash2 className="h-4 w-4" />
                          <span className="sr-only">Delete User</span>
                        </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={!!editingUser} onOpenChange={(open) => !open && handleCloseEditDialog()}>
        <DialogContent>
            <DialogHeader>
                <DialogTitle>Edit Roles for {editingUser?.name}</DialogTitle>
                <DialogDescription>Select the roles to be assigned to this user.</DialogDescription>
            </DialogHeader>
            <Form {...assignRolesForm}>
                <form id="assign-roles-form" onSubmit={assignRolesForm.handleSubmit(onAssignRolesSubmit)} className="space-y-8 py-4">
                    <FormField
                        control={assignRolesForm.control}
                        name="roleIds"
                        render={() => (
                            <FormItem>
                            {initialRoles.map((role) => (
                                <FormField
                                key={role.id}
                                control={assignRolesForm.control}
                                name="roleIds"
                                render={({ field }) => (
                                    <FormItem
                                        key={role.id}
                                        className="flex flex-row items-start space-x-3 space-y-0"
                                    >
                                        <FormControl>
                                        <Checkbox
                                            checked={field.value?.includes(role.id)}
                                            onCheckedChange={(checked) => {
                                            return checked
                                                ? field.onChange([...(field.value || []), role.id])
                                                : field.onChange(field.value?.filter((value) => value !== role.id));
                                            }}
                                        />
                                        </FormControl>
                                        <FormLabel className="font-normal">{role.name}</FormLabel>
                                    </FormItem>
                                    )}
                                />
                            ))}
                            <FormMessage />
                            </FormItem>
                        )}
                        />
                </form>
            </Form>
            <DialogFooter>
                <Button type="button" variant="outline" onClick={handleCloseEditDialog} disabled={isPending}>Cancel</Button>
                <Button type="submit" form="assign-roles-form" disabled={isPending}>
                    {isPending ? "Saving..." : "Save Roles"}
                </Button>
            </DialogFooter>
        </DialogContent>
      </Dialog>
      
      <Dialog open={isAddUserDialogOpen} onOpenChange={setIsAddUserDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add New User</DialogTitle>
            <DialogDescription>Create a new user account and assign initial roles.</DialogDescription>
          </DialogHeader>
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
                <FormField control={addUserForm.control} name="email" render={({ field }) => (
                    <FormItem><FormLabel>Email</FormLabel><FormControl><Input placeholder="john.doe@example.com" {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={addUserForm.control} name="phoneNumber" render={({ field }) => (
                    <FormItem><FormLabel>Phone Number</FormLabel><FormControl><Input placeholder="123-456-7890" {...field} /></FormControl><FormMessage /></FormItem>
                )} />
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
          <DialogFooter>
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

    