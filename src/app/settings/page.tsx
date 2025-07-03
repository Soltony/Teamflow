
import { SettingsTabs } from "@/components/settings/settings-tabs";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
      <SettingsTabs 
        projectStatuses={JSON.parse(JSON.stringify(projectStatuses))}
        availableYears={availableYears}
        currentActiveYear={currentActiveYear}
      />
    </div>
  );
}
