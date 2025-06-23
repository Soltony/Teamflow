import { ProjectForm } from "@/components/projects/project-form";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function NewProjectPage() {
  return (
    <div className="p-4 sm:p-6">
      <Card className="max-w-4xl mx-auto">
        <CardHeader>
            <CardTitle className="text-2xl">Create a New Project</CardTitle>
            <CardDescription>
                Fill in the details below to register a new project. You can add multiple tasks with their timelines and weight percentages.
            </CardDescription>
        </CardHeader>
        <CardContent>
            <ProjectForm />
        </CardContent>
      </Card>
    </div>
  );
}
