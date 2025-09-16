
'use client';

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/auth-context";
import { PaymentsManagement } from "@/components/payments/payments-management";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { getPaymentsPageData } from "./actions";
import type { Project } from '@prisma/client';

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

export default function PaymentsPage() {
    const { hasPermission, loading: authLoading } = useAuth();
    const router = useRouter();
    const [projects, setProjects] = useState<Project[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    const fetchData = useCallback(async () => {
        setIsLoading(true);
        try {
            const data = await getPaymentsPageData();
            setProjects(data);
        } catch (error) {
            console.error("Failed to fetch payments data", error);
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        if (!authLoading) {
            if (!hasPermission('payments:view')) {
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
              <CardTitle>Project Payments</CardTitle>
              <CardDescription>
                Record and track payments made against projects.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <PaymentsManagement 
                initialProjects={projects} 
                onDataChange={fetchData}
              />
            </CardContent>
          </Card>
        </div>
    );
}
