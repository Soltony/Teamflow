
'use client';

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/auth-context";
import { PaymentApprovalManagement } from "@/components/payment-approvals/payment-approvals-management";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { getPendingPayments } from "./actions";
import type { MilestonePayment } from '@prisma/client';

type PendingPaymentWithRelations = MilestonePayment & { 
    milestone: { 
        title: string;
        project: {
            id: string;
            name: string;
        } 
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

export default function PaymentApprovalsPage() {
    const { hasPermission, loading: authLoading } = useAuth();
    const router = useRouter();
    const [pendingPayments, setPendingPayments] = useState<PendingPaymentWithRelations[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        if (!authLoading) {
            if (!hasPermission('payment-approvals:view')) {
                router.replace('/dashboard');
            } else {
                getPendingPayments().then(data => {
                    setPendingPayments(data as PendingPaymentWithRelations[]);
                    setIsLoading(false);
                });
            }
        }
    }, [authLoading, hasPermission, router]);

    if (isLoading || authLoading) {
        return <LoadingSkeleton />;
    }

    return (
        <div className="p-4 sm:p-6">
           <Card>
            <CardHeader>
              <CardTitle>Payment Approvals</CardTitle>
              <CardDescription>
                Review and approve or reject pending milestone payments.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <PaymentApprovalManagement initialPayments={pendingPayments} />
            </CardContent>
          </Card>
        </div>
    );
}
