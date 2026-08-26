
'use client';

import { useEffect, useState, useCallback } from 'react';
import { useAuth } from "@/context/auth-context";
import { useRouter } from 'next/navigation';
import { SettingsTabs } from "@/components/settings/settings-tabs";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton, LoadingRegion } from '@/components/ui/skeleton';
import { getSettingsPageData } from './actions';
import type { ProjectStatus, Project, Setting, User, Role, PmoDivision } from '@prisma/client';
import { useFirstLoad } from "@/hooks/use-first-load";

type UserWithRoles = User & { roles: Role[] };

type SettingsData = Awaited<ReturnType<typeof getSettingsPageData>>;

function generateWorkingYears() {
    const currentYear = new Date().getFullYear();
    const years = new Set<string>();
    // Add past, current, and future years
    //add
    for (let i = -2; i <= 2; i++) {
        const year = currentYear + i;
        years.add(`${year}/${year + 1}`);
    }
    return Array.from(years).sort((a,b) => a.localeCompare(b));
}

function LoadingSkeleton() {
    return (
        <LoadingRegion label="Loading settings">
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
        </LoadingRegion>
    );
}

export default function SettingsPage() {
  const { hasPermission, loading: authLoading } = useAuth();
  const router = useRouter();
  const [data, setData] = useState<SettingsData | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const canViewPage = hasPermission(['settings:manage', 'config:manage-users', 'config:manage-roles']);

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
      if (!canViewPage) {
        router.replace('/dashboard');
      } else {
        fetchSettingsData();
      }
    }
  }, [authLoading, canViewPage, router, fetchSettingsData]);
    // Only on the very first load. Rendering the skeleton on every refresh
    // unmounted the page body, destroying any dialog that was open.
    const showSkeleton = useFirstLoad(isLoading);

  if (showSkeleton || authLoading || !data) {
    return <LoadingSkeleton />;
  }
  
  const existingYears = new Set(data.projects.map(p => p.workingYear));
  const generatedYears = generateWorkingYears();
  const availableYears = Array.from(new Set([...generatedYears, ...existingYears])).sort((a,b) => a.localeCompare(b));

  const currentActiveYear = data.activeYearSetting?.value || "";

  return (
    <div className="p-4 sm:p-6 space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Settings & Configuration</CardTitle>
          <CardDescription>
            Manage application-wide settings, users, and roles from this central hub.
          </CardDescription>
        </CardHeader>
      </Card>
      <SettingsTabs 
        projectStatuses={data.projectStatuses}
        availableYears={availableYears}
        currentActiveYear={currentActiveYear}
        users={data.users}
        roles={data.roles}
        pmoDivisions={data.pmoDivisions}
        onDataChange={fetchSettingsData}
      />
    </div>
  );
}
