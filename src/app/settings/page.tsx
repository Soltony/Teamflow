import { ProjectStatusManagement } from "@/components/settings/status-management";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function SettingsPage() {
  return (
    <div className="p-4 sm:p-6">
       <Card>
        <CardHeader>
          <CardTitle>Settings</CardTitle>
          <CardDescription>Manage your application settings, like dynamic project statuses.</CardDescription>
        </CardHeader>
        <CardContent>
          <ProjectStatusManagement />
        </CardContent>
      </Card>
    </div>
  );
}
