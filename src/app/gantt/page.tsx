'use client';

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/auth-context";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { ProjectsGanttChart } from "@/components/gantt/projects-gantt-chart";
import { Skeleton, LoadingRegion } from "@/components/ui/skeleton";
import { getGanttPageData } from "./actions";
import type { Project } from "@prisma/client";
import type { Serialized } from '@/lib/serialize';
import { useFirstLoad } from "@/hooks/use-first-load";

function LoadingSkeleton() {
    return (
        <LoadingRegion label="Loading timeline">
          <div className="p-4 sm:p-6">
              <Card>
                  <CardHeader>
                      <Skeleton className="h-8 w-64" />
                      <Skeleton className="h-4 w-96 mt-2" />
                  </CardHeader>
                  <CardContent>
                      <Skeleton className="h-96 w-full" />
                  </CardContent>
              </Card>
          </div>
        </LoadingRegion>
    );
}


export default function GanttPage() {
    const { localUser, hasPermission, loading: authLoading } = useAuth();
    const router = useRouter();
    const [projects, setProjects] = useState<Serialized<Project>[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        if (!authLoading) {
            if (!hasPermission('gantt:view')) {
                router.replace('/dashboard');
                return;
            }
            if (localUser?.id) {
                setIsLoading(true);
                getGanttPageData(localUser.id).then(data => {
                    setProjects(data);
                    setIsLoading(false);
                });
            } else {
                setIsLoading(false);
            }
        }
    }, [localUser, authLoading, hasPermission, router]);
    // Only on the very first load. Rendering the skeleton on every refresh
    // unmounted the page body, destroying any dialog that was open.
    const showSkeleton = useFirstLoad(isLoading);

    if (showSkeleton || authLoading) {
        return <LoadingSkeleton />;
    }

    return (
        <div className="p-4 sm:p-6">
            <Card>
                <CardHeader>
                    <CardTitle>Projects Gantt Chart</CardTitle>
                    <CardDescription>A timeline view of all project milestones. Click on a milestone to view its project details.</CardDescription>
                </CardHeader>
                <CardContent>
                    <ProjectsGanttChart projects={projects} />
                </CardContent>
            </Card>
        </div>
    );
}
