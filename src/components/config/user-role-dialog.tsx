
"use client";

import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import type { User, Role } from "@prisma/client";
import { assignRoleToUser, removeRoleFromUser } from "@/app/config/actions";
import { useToast } from "@/hooks/use-toast";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
    Form,
    FormControl,
    FormField,
    FormItem,
    FormLabel,
} from "@/components/ui/form";
import { Separator } from "../ui/separator";

type UserWithRoles = User & {
    roles: Role[];
};

type UserRoleDialogProps = {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  user: UserWithRoles;
  allRoles: Role[];
};

const FormSchema = z.object({
  roleIds: z.array(z.string()),
});

export function UserRoleDialog({ isOpen, onOpenChange, user, allRoles }: UserRoleDialogProps) {
    const { toast } = useToast();
    const [isPending, startTransition] = useTransition();

    const form = useForm<z.infer<typeof FormSchema>>({
        resolver: zodResolver(FormSchema),
        defaultValues: {
          roleIds: user.roles.map(role => role.id),
        },
    });

    async function onSubmit(data: z.infer<typeof FormSchema>) {
        const currentRoleIds = user.roles.map(role => role.id);
        const newRoleIds = data.roleIds;

        const rolesToAdd = newRoleIds.filter(id => !currentRoleIds.includes(id));
        const rolesToRemove = currentRoleIds.filter(id => !newRoleIds.includes(id));

        startTransition(async () => {
            let success = true;
            for (const roleId of rolesToAdd) {
                const result = await assignRoleToUser(user.id, roleId);
                if (!result.success) success = false;
            }
            for (const roleId of rolesToRemove) {
                const result = await removeRoleFromUser(user.id, roleId);
                 if (!result.success) success = false;
            }

            if (success) {
                toast({ title: "Roles Updated", description: `Roles for ${user.name} have been successfully updated.` });
                onOpenChange(false);
            } else {
                toast({ title: "Error", description: "One or more roles could not be updated.", variant: "destructive" });
            }
        });
    }

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Manage Roles for {user.name}</DialogTitle>
          <DialogDescription>Select the roles to be assigned to this user.</DialogDescription>
        </DialogHeader>
        <Separator />
        <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                <FormField
                    control={form.control}
                    name="roleIds"
                    render={() => (
                        <FormItem>
                            <div className="space-y-2">
                                {allRoles.map((role) => (
                                    <FormField
                                        key={role.id}
                                        control={form.control}
                                        name="roleIds"
                                        render={({ field }) => {
                                            return (
                                                <FormItem className="flex flex-row items-center space-x-3 space-y-0 p-3 border rounded-md">
                                                    <FormControl>
                                                        <Checkbox
                                                            checked={field.value?.includes(role.id)}
                                                            onCheckedChange={(checked) => {
                                                                return checked
                                                                    ? field.onChange([...field.value, role.id])
                                                                    : field.onChange(field.value?.filter((value) => value !== role.id));
                                                            }}
                                                        />
                                                    </FormControl>
                                                    <div className="space-y-1 leading-none">
                                                        <FormLabel>{role.name}</FormLabel>
                                                        <p className="text-xs text-muted-foreground">{role.description}</p>
                                                    </div>
                                                </FormItem>
                                            )
                                        }}
                                    />
                                ))}
                            </div>
                        </FormItem>
                    )}
                />

                <DialogFooter>
                    <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
                    <Button type="submit" disabled={isPending}>
                        {isPending ? "Saving..." : "Save Changes"}
                    </Button>
                </DialogFooter>
            </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
