
import { ProjectForm } from "@/components/projects/project-form";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import prisma from "@/lib/db";

export default async function NewProjectPage() {
  const [users, departments, projectStatuses, activeYearSetting] = await Promise.all([
    prisma.user.findMany(),
    prisma.department.findMany(),
    prisma.projectStatus.findMany(),
    prisma.setting.findUnique({ where: { key: 'activeWorkingYear' } }),
  ]);
  
  const activeYear = activeYearSetting?.value || "";

  return (
    <div className="p-4 sm:p-6">
      <Card className="max-w-4xl mx-auto">
        <CardHeader>
            <CardTitle className="text-2xl">Create a New Project</CardTitle>
            <CardDescription>
                Fill in the project details, assign it to a department, and define the major milestones.
            </CardDescription>
        </CardHeader>
        <CardContent>
            <ProjectForm 
              users={JSON.parse(JSON.stringify(users))}
              departments={JSON.parse(JSON.stringify(departments))}
              projectStatuses={JSON.parse(JSON.stringify(projectStatuses))}
              activeYear={activeYear}
            />
        </CardContent>
      </Card>
    </div>
  );
}
