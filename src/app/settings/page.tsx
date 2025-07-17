
'use client';

import { useEffect, useState, useCallback } from 'react';
import { useAuth } from "@/context/auth-context";
import { useRouter } from 'next/navigation';
import { SettingsTabs } from "@/components/settings/settings-tabs";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from '@/components/ui/skeleton';
import { getSettingsPageData } from './actions';
import type { ProjectStatus, Project, Setting } from '@prisma/client';

type SettingsData = {
  projectStatuses: ProjectStatus[];
  projects: { workingYear: string }[];
  activeYearSetting: Setting | null;
}

function LoadingSkeleton() {
    return (
        <div className="p-4 sm:p-6 space-y-6">
            <Card>
                <CardHeader>
                  <Skeleton className="h-8 w-64" />
                  <Skeleton className="h-4 w-96 mt-2" />
                </CardHeader>
            </Card>
            <div className="space-y-4">
                <Skeleton className="h-10 w-1/2" />
                <Skeleton className="h-64 w-full" />
            </div>
        </div>
    );
}

export default function SettingsPage() {
  const { hasPermission, loading: authLoading } = useAuth();
  const router = useRouter();
  const [data, setData] = useState<SettingsData | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchSettingsData = useCallback(async () => {
    setIsLoading(true);
    try {
        const fetchedData = await getSettingsPageData();
        setData(fetchedData);
    } catch (error) {
        console.error("Failed to fetch settings", error);
        setData(null);
    } finally {
        setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!authLoading) {
      if (!hasPermission('settings:manage')) {
        router.replace('/dashboard');
      } else {
        fetchSettingsData();
      }
    }
  }, [authLoading, hasPermission, router, fetchSettingsData]);

  if (isLoading || authLoading || !data) {
    return <LoadingSkeleton />;
  }

  const availableYears = Array.from(new Set(data.projects.map(p => p.workingYear)));
  const currentActiveYear = data.activeYearSetting?.value || "";

  return (
    <div className="p-4 sm:p-6 space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Application Settings</CardTitle>
          <CardDescription>
            Manage application-wide settings from this central hub.
          </CardDescription>
        </CardHeader>
      </Card>
      <SettingsTabs 
        projectStatuses={data.projectStatuses}
        availableYears={availableYears}
        currentActiveYear={currentActiveYear}
        onDataChange={fetchSettingsData}
      />
    </div>
  );
}
