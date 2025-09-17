
'use client';

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/auth-context";
import { TimelineApprovalManagement } from "@/components/timeline-approvals/timeline-approvals-management";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { getPendingTimelineChanges } from "./actions";
import type { TimelineChangeRequest } from '@prisma/client';

type PendingRequestWithRelations = TimelineChangeRequest & { 
    project: {
        id: string;
        name: string;
    };
    requestedBy: {
        id: string;
        name: string;
    }
};

function LoadingSkeleton() {
    return (
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
            setPendingRequests(data as PendingRequestWithRelations[]);
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

    if (isLoading || authLoading) {
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
