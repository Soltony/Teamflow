import { DepartmentsManagement } from "@/components/departments/departments-management";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import prisma from "@/lib/db";

export default async function DepartmentsPage() {
  const departments = await prisma.department.findMany({
    orderBy: { name: 'asc' }
  });

  return (
    <div className="p-4 sm:p-6">
       <Card>
        <CardHeader>
          <CardTitle>Department Management</CardTitle>
          <CardDescription>Add, view, and manage departments within your organization.</CardDescription>
        </CardHeader>
        <CardContent>
          <DepartmentsManagement initialDepartments={JSON.parse(JSON.stringify(departments))} />
        </CardContent>
      </Card>
    </div>
  );
}
