
'use client';

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/auth-context";
import { PaymentApprovalManagement } from "@/components/payment-approvals/payment-approvals-management";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { getPendingPayments } from "./actions";
import type { Payment } from '@prisma/client';

type PendingPaymentWithRelations = Payment & { 
    project: {
        id: string;
        name: string;
        currency: 'ETB' | 'USD';
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

    const fetchData = useCallback(async () => {
        setIsLoading(true);
        try {
            const data = await getPendingPayments();
            setPendingPayments(data as PendingPaymentWithRelations[]);
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

    if (isLoading || authLoading) {
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
