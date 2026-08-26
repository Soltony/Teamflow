
'use client';

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/auth-context";
import { PaymentApprovalManagement } from "@/components/payment-approvals/payment-approvals-management";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Skeleton, LoadingRegion } from "@/components/ui/skeleton";
import { getPendingPayments } from "./actions";
import type { Payment } from '@prisma/client';
import { useFirstLoad } from "@/hooks/use-first-load";

// Derived from the action, for the same reason as above: the restated type
// disagreed with the value on every date field and needed a cast to hide it.
type PendingPaymentWithRelations = Awaited<ReturnType<typeof getPendingPayments>>[number];

function LoadingSkeleton() {
    return (
        <LoadingRegion label="Loading payment approvals">
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

export default function PaymentApprovalsPage() {
    const { hasPermission, loading: authLoading } = useAuth();
    const router = useRouter();
    const [pendingPayments, setPendingPayments] = useState<PendingPaymentWithRelations[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    const fetchData = useCallback(async () => {
        setIsLoading(true);
        try {
            const data = await getPendingPayments();
            setPendingPayments(data);
        } catch (error) {
            console.error("Failed to fetch pending payments", error);
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        if (!authLoading) {
            if (!hasPermission('payment-approvals:view')) {
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
              <CardTitle>Payment Approvals</CardTitle>
              <CardDescription>
                Review and approve or reject pending project payments.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <PaymentApprovalManagement 
                initialPayments={pendingPayments} 
                onDataChange={fetchData}
              />
            </CardContent>
          </Card>
        </div>
    );
}
