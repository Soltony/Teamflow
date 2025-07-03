'use client';

import { useEffect, useState } from "react";
import { useAuth } from "@/context/auth-context";
import { TeamsManagement } from "@/components/teams/teams-management";
import { getTeamsPageData } from "./actions";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import type { Project as PrismaProject, Team as PrismaTeam, User as PrismaUser } from '@prisma/client';

type TeamWithRelations = PrismaTeam & {
    project: PrismaProject;
    teamLead: PrismaUser;
    members: PrismaUser[];
    memberIds: string[];
};

type TeamsPageData = {
    teams: TeamWithRelations[];
    projects: PrismaProject[];
    users: PrismaUser[];
}

function LoadingSkeleton() {
    return (
        <div className="p-4 sm:p-6">
            <Card>
                <CardHeader className="flex-row items-center justify-between">
                    <div>
                        <Skeleton className="h-8 w-48" />
                        <Skeleton className="h-4 w-96 mt-2" />
                    </div>
                    <Skeleton className="h-10 w-36" />
                </CardHeader>
                <CardContent className="space-y-4">
                    <Skeleton className="h-12 w-full" />
                    <Skeleton className="h-24 w-full" />
                    <Skeleton className="h-12 w-full" />
                    <Skeleton className="h-24 w-full" />
                </CardContent>
            </Card>
        </div>
    );
}

export default function TeamsPage() {
    const { localUser, loading: authLoading } = useAuth();
    const [data, setData] = useState<TeamsPageData | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        if (localUser?.id) {
            setIsLoading(true);
            getTeamsPageData(localUser.id).then(fetchedData => {
                setData(fetchedData);
                setIsLoading(false);
            });
        } else if (!authLoading) {
            setIsLoading(false);
        }
    }, [localUser, authLoading]);

    if (isLoading || authLoading) {
        return <LoadingSkeleton />;
    }

    if (!localUser || !data) {
        return (
            <div className="p-4 sm:p-6">
                <p>Could not load teams. Please try logging in again.</p>
            </div>
        );
    }

    return (
        <div className="p-4 sm:p-6">
            <TeamsManagement
                initialTeams={data.teams}
                allProjects={data.projects}
                allUsers={data.users}
            />
        </div>
    );
}
