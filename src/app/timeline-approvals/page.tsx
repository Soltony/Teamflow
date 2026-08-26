
'use client';

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/auth-context";
import { TimelineApprovalManagement } from "@/components/timeline-approvals/timeline-approvals-management";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Skeleton, LoadingRegion } from "@/components/ui/skeleton";
import { getPendingTimelineChanges } from "./actions";
import type { TimelineChangeRequest } from '@prisma/client';
import { useFirstLoad } from "@/hooks/use-first-load";

// Derived from the action. The hand-written version restated the Prisma row,
// so its dates were Dates while the values arriving here are strings — which
// is why this needed a cast to compile at all.
type PendingRequestWithRelations = Awaited<ReturnType<typeof getPendingTimelineChanges>>[number];

function LoadingSkeleton() {
    return (
        <LoadingRegion label="Loading timeline approvals">
          <div className="p-4 sm:p-6 space-y-6">
              <Card>
                  <CardHeader>
                      <Skeleton className="h-8 w-64" />
                      <Skeleton className="h-4 w-96 mt-2" />
                  </CardHeader>
                  <CardContent className="space-y-4">
                      <Skeleton className="h-12 w-full" />
                      <Skeleton className="h-12 w-full" />
                      <Skeleton className="h-12 w-full" />
                  </CardContent>
              </Card>
          </div>
        </LoadingRegion>
    );
}

export default function TimelineApprovalsPage() {
    const { hasPermission, loading: authLoading } = useAuth();
    const router = useRouter();
    const [pendingRequests, setPendingRequests] = useState<PendingRequestWithRelations[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    const fetchData = useCallback(async () => {
        setIsLoading(true);
        try {
            const data = await getPendingTimelineChanges();
            setPendingRequests(data);
        } catch (error) {
            console.error("Failed to fetch pending timeline changes", error);
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        if (!authLoading) {
            if (!hasPermission('timeline:approve')) {
                router.replace('/dashboard');
            } else {
                fetchData();
            }
        }
    }, [authLoading, hasPermission, router, fetchData]);
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
              <CardTitle>Timeline Change Approvals</CardTitle>
              <CardDescription>
                Review and approve or reject pending project deadline change requests.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <TimelineApprovalManagement 
                initialRequests={pendingRequests} 
                onDataChange={fetchData}
              />
            </CardContent>
          </Card>
        </div>
    );
}
