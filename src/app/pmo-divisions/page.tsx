
'use client';

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/auth-context";
import { PmoDivisionManagement } from "@/components/pmo-divisions/pmo-division-management";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { getPmoDivisionsData } from "./actions";
import type { PmoDivision } from '@prisma/client';

function LoadingSkeleton() {
    return (
        <div className="p-4 sm:p-6 space-y-6">
            <Card>
                <CardHeader>
                    <Skeleton className="h-8 w-64" />
                    <Skeleton className="h-4 w-96 mt-2" />
                </CardHeader>
                <CardContent className="space-y-4">
                     <div className="grid md:grid-cols-3 gap-6">
                        <div className="md:col-span-1">
                            <Skeleton className="h-64 w-full" />
                        </div>
                        <div className="md:col-span-2">
                             <Skeleton className="h-64 w-full" />
                        </div>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}

export default function PmoDivisionsPage() {
    const { hasPermission, loading: authLoading } = useAuth();
    const router = useRouter();
    const [pmoDivisions, setPmoDivisions] = useState<PmoDivision[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        if (!authLoading) {
            if (!hasPermission('pmo-divisions:view')) {
                router.replace('/dashboard');
            } else {
                getPmoDivisionsData().then(data => {
                    setPmoDivisions(data);
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
              <CardTitle>PMO Division Management</CardTitle>
              <CardDescription>
                Add, view, and manage the PMO divisions that are responsible for managing projects.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <PmoDivisionManagement initialPmoDivisions={pmoDivisions} />
            </CardContent>
          </Card>
        </div>
    );
}
