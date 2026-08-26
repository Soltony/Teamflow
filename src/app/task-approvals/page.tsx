
'use client';

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/auth-context";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Skeleton, LoadingRegion } from "@/components/ui/skeleton";
import { getPendingReviewTasks } from "./actions";
import { TaskApprovalManagement } from "@/components/task-approvals/task-approvals-management";
import { useFirstLoad } from "@/hooks/use-first-load";

function LoadingSkeleton() {
    return (
        <LoadingRegion label="Loading task approvals">
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

export default function TaskApprovalsPage() {
    const { localUser, hasPermission, loading: authLoading } = useAuth();
    const router = useRouter();
    const [pendingTasks, setPendingTasks] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    const fetchData = useCallback(async () => {
        if (localUser?.id) {
            setIsLoading(true);
            try {
                const data = await getPendingReviewTasks(localUser.id);
                setPendingTasks(data);
            } catch (error) {
                console.error("Failed to fetch pending tasks", error);
            } finally {
                setIsLoading(false);
            }
        }
    }, [localUser?.id]);

    useEffect(() => {
        if (!authLoading) {
            if (!hasPermission('tasks:approve')) {
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
              <CardTitle>Task Approvals</CardTitle>
              <CardDescription>
                Review and approve or reject tasks that are pending review.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <TaskApprovalManagement 
                initialTasks={pendingTasks} 
                onDataChange={fetchData}
              />
            </CardContent>
          </Card>
        </div>
    );
}
