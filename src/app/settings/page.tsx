import { ProjectStatusManagement } from "@/components/settings/status-management";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ActiveYearManagement } from "@/components/settings/active-year-management";
import prisma from "@/lib/db";

export default async function SettingsPage() {
  const projects = await prisma.project.findMany({
      select: { workingYear: true },
      distinct: ['workingYear']
  });
  const availableYears = projects.map(p => p.workingYear).sort((a,b) => b.localeCompare(a));
  
  const projectStatuses = await prisma.projectStatus.findMany({
    orderBy: { name: 'asc' }
  });

  const activeYearSetting = await prisma.setting.findUnique({
      where: { key: 'activeWorkingYear' },
  });
  const currentActiveYear = activeYearSetting?.value || "";

  return (
    <div className="p-4 sm:p-6 space-y-6">
       <Card>
        <CardHeader>
          <CardTitle>Project Statuses</CardTitle>
          <CardDescription>Manage the available statuses that can be assigned to a project.</CardDescription>
        </CardHeader>
        <CardContent>
          <ProjectStatusManagement initialStatuses={JSON.parse(JSON.stringify(projectStatuses))} />
        </CardContent>
      </Card>
      <ActiveYearManagement 
        availableYears={availableYears} 
        currentActiveYear={currentActiveYear}
      />
    </div>
  );
}
