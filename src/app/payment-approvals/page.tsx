'use client';

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";

import { useAuth } from "@/context/auth-context";
import { PaymentApprovalManagement } from "@/components/payment-approvals/payment-approvals-management";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton, LoadingRegion } from "@/components/ui/skeleton";
import { ApprovalQueueIntro } from "@/components/ui/action-required";
import { ErrorState } from "@/components/ui/error-state";
import { PageHeader, PageShell } from "@/components/ui/page-header";
import { getPendingPayments } from "./actions";
import { useFirstLoad } from "@/hooks/use-first-load";

// Derived from the action, for the same reason as above: the restated type
// disagreed with the value on every date field and needed a cast to hide it.
type PendingPaymentWithRelations = Awaited<ReturnType<typeof getPendingPayments>>[number];

function LoadingSkeleton() {
    return (
        <LoadingRegion label="Loading payments awaiting approval">
          <PageShell>
            <div className="space-y-2">
              <Skeleton className="h-9 w-64" />
              <Skeleton className="h-4 w-96" />
            </div>
            <Skeleton className="h-24 w-full" />
            <Card>
              <CardContent className="space-y-3 pt-6">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-12 w-full" />
              </CardContent>
            </Card>
          </PageShell>
        </LoadingRegion>
    );
}

export default function PaymentApprovalsPage() {
    const { hasPermission, loading: authLoading } = useAuth();
    const router = useRouter();
    const [pendingPayments, setPendingPayments] = useState<PendingPaymentWithRelations[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [loadError, setLoadError] = useState<string | null>(null);

    const fetchData = useCallback(async () => {
        setIsLoading(true);
        setLoadError(null);
        try {
            setPendingPayments(await getPendingPayments());
        } catch (error) {
            setLoadError(error instanceof Error ? error.message : 'The request did not complete.');
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
        <PageShell>
          <PageHeader
            title="Payment approvals"
            description="Scheduled project payments waiting to be released."
          />

          {loadError ? (
            <ErrorState
              variant="load"
              title="We could not load the payment queue"
              description="Nothing has been approved or refused — the list simply did not arrive."
              detail={loadError}
              onRetry={fetchData}
            />
          ) : (
            <>
              <ApprovalQueueIntro
                count={pendingPayments.length}
                noun="payment"
                whatApprovalDoes="Approving releases the payment for processing and records it against the project's budget."
                whatRejectionDoes="Refusing releases nothing. The payment stays on the project's schedule and your reason goes back to whoever raised it."
              />

              <Card>
                <CardContent className="pt-6">
                  <PaymentApprovalManagement
                    initialPayments={pendingPayments}
                    onDataChange={fetchData}
                  />
                </CardContent>
              </Card>
            </>
          )}
        </PageShell>
    );
}
