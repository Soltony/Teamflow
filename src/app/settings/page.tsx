
import { ProjectStatusManagement } from "@/components/settings/status-management";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ActiveYearManagement } from "@/components/settings/active-year-management";

export default function SettingsPage() {
  return (
    <div className="p-4 sm:p-6 space-y-6">
       <Card>
        <CardHeader>
          <CardTitle>Project Statuses</CardTitle>
          <CardDescription>Manage the available statuses that can be assigned to a project.</CardDescription>
        </CardHeader>
        <CardContent>
          <ProjectStatusManagement />
        </CardContent>
      </Card>
      <ActiveYearManagement />
    </div>
  );
}
