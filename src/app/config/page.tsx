
import prisma from "@/lib/db";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { UserManagement } from "@/components/config/user-management";
import { RoleManagement } from "@/components/config/role-management";

export default async function ConfigPage() {
  const [users, roles] = await Promise.all([
    prisma.user.findMany({
      include: {
        roles: true,
      },
      orderBy: { name: 'asc' }
    }),
    prisma.role.findMany({
      orderBy: { name: 'asc' }
    }),
  ]);

  return (
    <div className="p-4 sm:p-6 space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Configuration</CardTitle>
          <CardDescription>Manage user roles and system permissions.</CardDescription>
        </CardHeader>
      </Card>
      <Tabs defaultValue="user-management" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="user-management">User Management</TabsTrigger>
          <TabsTrigger value="role-management">Role Management</TabsTrigger>
        </TabsList>
        <TabsContent value="user-management">
          <Card>
            <CardHeader>
              <CardTitle>Users</CardTitle>
              <CardDescription>Assign roles to users in the system.</CardDescription>
            </CardHeader>
            <CardContent>
              <UserManagement 
                initialUsers={JSON.parse(JSON.stringify(users))}
                allRoles={JSON.parse(JSON.stringify(roles))}
              />
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="role-management">
          <Card>
            <CardHeader>
              <CardTitle>Roles</CardTitle>
              <CardDescription>Define roles and their permissions within the application.</CardDescription>
            </CardHeader>
            <CardContent>
              <RoleManagement initialRoles={JSON.parse(JSON.stringify(roles))} />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
