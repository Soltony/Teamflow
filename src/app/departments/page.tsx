import { DepartmentsManagement } from "@/components/departments/departments-management";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function DepartmentsPage() {
  return (
    <div className="p-4 sm:p-6">
       <Card>
        <CardHeader>
          <CardTitle>Department Management</CardTitle>
          <CardDescription>Add, view, and manage departments within your organization.</CardDescription>
        </CardHeader>
        <CardContent>
          <DepartmentsManagement />
        </CardContent>
      </Card>
    </div>
  );
}
