import { TeamsManagement } from "@/components/teams/teams-management";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function TeamsPage() {
  return (
    <div className="p-4 sm:p-6">
       <Card>
        <CardHeader>
          <CardTitle>Team Management</CardTitle>
          <CardDescription>Create and manage project-specific teams, assign leads, and add members.</CardDescription>
        </CardHeader>
        <CardContent>
          <TeamsManagement />
        </CardContent>
      </Card>
    </div>
  );
}
