import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Lightbulb } from "lucide-react";

export default function TeamViewPage() {
  return (
    <div className="p-4 sm:p-6">
       <Card>
        <CardHeader>
          <CardTitle>Team Task View</CardTitle>
          <CardDescription>Review and manage tasks assigned to your team members.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center text-center gap-4 p-12 border-2 border-dashed rounded-lg">
            <Lightbulb className="w-12 h-12 text-muted-foreground" />
            <h3 className="text-xl font-semibold">Coming Soon!</h3>
            <p className="text-muted-foreground max-w-md">
              This page will allow team leads to see all tasks assigned to their team, review work submitted by members, and approve or decline tasks to keep projects on track.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
