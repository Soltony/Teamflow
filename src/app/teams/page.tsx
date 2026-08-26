
'use client';

import { useEffect, useState, useCallback } from "react";
import { useAuth } from "@/context/auth-context";
import { TeamsManagement } from "@/components/teams/teams-management";
import { getTeamsPageData } from "./actions";
import { Skeleton, LoadingRegion } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { useRouter } from "next/navigation";
import { useFirstLoad } from "@/hooks/use-first-load";

// Derived from the action rather than restated. Three files each declared
// their own TeamWithRelations, which is why adding the project links broke
// them in three different ways.
type TeamsPageData = Awaited<ReturnType<typeof getTeamsPageData>>;

function LoadingSkeleton() {
    return (
        <LoadingRegion label="Loading teams">
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
        </LoadingRegion>
    );
}

export default function TeamsPage() {
    const { localUser, loading: authLoading, hasPermission } = useAuth();
    const router = useRouter();
    const [data, setData] = useState<TeamsPageData | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    const fetchData = useCallback(async () => {
        if (!localUser?.id) return;
        setIsLoading(true);
        try {
            const fetchedData = await getTeamsPageData(localUser.id);
            setData(fetchedData as any);
        } catch (error) {
            console.error("Failed to fetch teams data", error);
            setData({ teams: [], projects: [], users: [] });
        } finally {
            setIsLoading(false);
        }
    }, [localUser?.id]);

    useEffect(() => {
        if (!authLoading) {
            if (!hasPermission('teams:read')) {
                router.replace('/dashboard');
                return;
            }

            if (localUser?.id) {
                fetchData();
            } else {
                setIsLoading(false);
            }
        }
    }, [localUser, authLoading, hasPermission, router, fetchData]);
    // Only on the very first load. Rendering the skeleton on every refresh
    // unmounted the page body, destroying any dialog that was open.
    const showSkeleton = useFirstLoad(isLoading);

    if (showSkeleton || authLoading) {
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
                onDataChange={fetchData}
            />
        </div>
    );
}
