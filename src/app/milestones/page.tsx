
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import Link from 'next/link';
import { Badge } from "@/components/ui/badge";
import { format, parseISO } from 'date-fns';
import prisma from "@/lib/db";

export default async function AllMilestonesPage() {
  const projects = await prisma.project.findMany({
    include: {
        milestones: {
            include: {
                responsibleDepartments: true
            },
            orderBy: {
                dueDate: 'asc'
            }
        }
    },
    orderBy: {
        name: 'asc'
    }
  });

  return (
    <div className="p-4 sm:p-6 space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>All Project Milestones</CardTitle>
          <CardDescription>A complete overview of all milestones across all active projects.</CardDescription>
        </CardHeader>
        <CardContent>
          <Accordion type="multiple" className="w-full">
            {projects.map(project => (
              <AccordionItem value={project.id} key={project.id}>
                <AccordionTrigger>
                  <Link href={`/projects/${project.id}`} className="font-semibold hover:underline">
                    {project.name}
                  </Link>
                </AccordionTrigger>
                <AccordionContent>
                  <div className="space-y-4 pl-4 border-l-2 ml-2">
                    {project.milestones.map(milestone => {
                      return (
                        <div key={milestone.id} className="p-4 border rounded-md">
                          <h4 className="font-semibold">{milestone.title}</h4>
                          <p className="text-sm text-muted-foreground mt-1">{milestone.description}</p>
                          <div className="flex flex-wrap items-center gap-2 mt-2">
                              <Badge variant="outline">
                                  Weight: {milestone.weight}%
                              </Badge>
                              <Badge variant="outline">
                                  Due: {format(parseISO(milestone.dueDate.toISOString()), 'MMM dd, yyyy')}
                              </Badge>
                              {milestone.responsibleDepartments.map(dept => (
                                  <Badge key={dept.id} variant="secondary">{dept.name}</Badge>
                              ))}
                          </div>
                           <Link href={`/projects/${project.id}/milestones`} className="text-sm text-primary hover:underline mt-2 inline-block">
                              View Tasks &rarr;
                           </Link>
                        </div>
                      )
                    })}
                     {project.milestones.length === 0 && <p className="text-sm text-muted-foreground">No milestones for this project.</p>}
                  </div>
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </CardContent>
      </Card>
    </div>
  );
}
