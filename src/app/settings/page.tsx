
import { ProjectStatusManagement } from "@/components/settings/status-management";
import { ActiveYearManagement } from "@/components/settings/active-year-management";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import prisma from "@/lib/db";

export default async function SettingsPage() {
  const [projectStatuses, projects, activeYearSetting] = await Promise.all([
    prisma.projectStatus.findMany({
      orderBy: { name: 'asc' }
    }),
    prisma.project.findMany({
      select: { workingYear: true },
      distinct: ['workingYear'],
      orderBy: { workingYear: 'desc' }
    }),
    prisma.setting.findUnique({ where: { key: 'activeWorkingYear' } }),
  ]);

  const availableYears = projects.map(p => p.workingYear);
  const currentActiveYear = activeYearSetting?.value || "";

  return (
    <div className="p-4 sm:p-6 space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Application Settings</CardTitle>
          <CardDescription>
            Manage application-wide settings from this central hub.
          </CardDescription>
        </CardHeader>
      </Card>
      <Tabs defaultValue="statuses" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="statuses">Project Statuses</TabsTrigger>
          <TabsTrigger value="general">General</TabsTrigger>
        </TabsList>
        <TabsContent value="statuses" className="mt-6">
          <ProjectStatusManagement 
            initialStatuses={JSON.parse(JSON.stringify(projectStatuses))}
          />
        </TabsContent>
        <TabsContent value="general" className="mt-6">
          <ActiveYearManagement
            availableYears={availableYears}
            currentActiveYear={currentActiveYear}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
