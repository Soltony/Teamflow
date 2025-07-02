
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import prisma from "@/lib/db";
import { UserManagement } from "@/components/config/user-management";
import { RoleManagement } from "@/components/config/role-management";

export default async function ConfigPage() {
  const [users, roles] = await Promise.all([
    prisma.user.findMany({
      include: {
        roles: true,
      },
      orderBy: { name: 'asc' },
    }),
    prisma.role.findMany({
      orderBy: { name: 'asc' },
    }),
  ]);

  return (
    <div className="p-4 sm:p-6 space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Configuration</CardTitle>
          <CardDescription>
            Manage application-wide settings, users, and roles from this central hub.
          </CardDescription>
        </CardHeader>
      </Card>
      <Tabs defaultValue="users">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="users">User Management</TabsTrigger>
          <TabsTrigger value="roles">Role Management</TabsTrigger>
        </TabsList>
        <TabsContent value="users" className="mt-6">
          <UserManagement 
            initialUsers={JSON.parse(JSON.stringify(users))} 
            initialRoles={JSON.parse(JSON.stringify(roles))} 
          />
        </TabsContent>
        <TabsContent value="roles" className="mt-6">
          <RoleManagement 
            initialRoles={JSON.parse(JSON.stringify(roles))} 
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
