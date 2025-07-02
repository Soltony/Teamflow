
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ProjectStatusManagement } from "@/components/settings/status-management";
import { ActiveYearManagement } from "@/components/settings/active-year-management";
import { UserManagement } from "@/components/settings/user-management";
import { RoleManagement } from "@/components/settings/role-management";
import prisma from "@/lib/db";

export default async function SettingsPage() {
  const [
    projects, 
    projectStatuses, 
    activeYearSetting,
    users,
    roles
  ] = await Promise.all([
    prisma.project.findMany({
      select: { workingYear: true },
      distinct: ['workingYear']
    }),
    prisma.projectStatus.findMany({
      orderBy: { name: 'asc' }
    }),
    prisma.setting.findUnique({
      where: { key: 'activeWorkingYear' },
    }),
    prisma.user.findMany({
      include: {
        roles: true
      },
      orderBy: { name: 'asc' }
    }),
    prisma.role.findMany({
      orderBy: { name: 'asc' }
    }),
  ]);

  const availableYears = projects.map(p => p.workingYear).sort((a,b) => b.localeCompare(a));
  const currentActiveYear = activeYearSetting?.value || "";

  return (
    <div className="p-4 sm:p-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl">Application Settings</CardTitle>
          <CardDescription>Manage global settings for the entire application.</CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="general" className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="general">General</TabsTrigger>
              <TabsTrigger value="users">User Management</TabsTrigger>
              <TabsTrigger value="roles">Role Management</TabsTrigger>
            </TabsList>
            <TabsContent value="general" className="pt-6">
              <div className="space-y-6">
                <ProjectStatusManagement initialStatuses={JSON.parse(JSON.stringify(projectStatuses))} />
                <ActiveYearManagement 
                  availableYears={availableYears} 
                  currentActiveYear={currentActiveYear}
                />
              </div>
            </TabsContent>
            <TabsContent value="users" className="pt-6">
               <UserManagement 
                initialUsers={JSON.parse(JSON.stringify(users))} 
                allRoles={JSON.parse(JSON.stringify(roles))} 
              />
            </TabsContent>
            <TabsContent value="roles" className="pt-6">
              <RoleManagement initialRoles={JSON.parse(JSON.stringify(roles))} />
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
