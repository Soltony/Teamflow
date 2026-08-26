"use client";

import { useCallback, useEffect, useState } from "react";

import { Skeleton, LoadingRegion } from "@/components/ui/skeleton";
import { getSystemSettings } from "@/app/settings/system-settings-actions";
import { SystemSettingsForm } from "./system-settings-form";
import { useAuth } from "@/context/auth-context";

type Data = Extract<Awaited<ReturnType<typeof getSystemSettings>>, { success: true }>;

/**
 * Loads the settings registry and its current values.
 *
 * Kept apart from the form so the form stays a pure rendering of whatever the
 * registry declares, with no fetching of its own.
 */
export function SystemSettings({ onDataChange }: { onDataChange: () => void }) {
  const { hasPermission } = useAuth();
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const result = await getSystemSettings();
    if (result.success) {
      setData(result);
      setError(null);
    } else {
      setError(result.error);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  if (error) {
    return <p className="text-sm text-muted-foreground">{error}</p>;
  }

  if (!data) {
    return (
      <LoadingRegion label="Loading system settings">
        <div className="space-y-4">
          <Skeleton className="h-40 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      </LoadingRegion>
    );
  }

  return (
    <SystemSettingsForm
      definitions={data.definitions}
      values={data.values}
      lastChanged={data.lastChanged}
      canUpdate={hasPermission("settings:manage")}
      onSaved={() => {
        void load();
        onDataChange();
      }}
    />
  );
}
