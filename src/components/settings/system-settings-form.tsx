"use client";

import { useMemo, useState, useTransition } from "react";
import { AlertTriangle, RotateCcw, ShieldAlert } from "lucide-react";
import { formatDistanceToNow, parseISO } from "date-fns";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import {
  CATEGORY_DESCRIPTIONS,
  CATEGORY_LABELS,
  SETTING_CATEGORIES,
  type SettingCategory,
  type SettingDefinition,
} from "@/lib/settings/definitions";
import { resetSystemSetting, updateSystemSettings } from "@/app/settings/system-settings-actions";

/**
 * The settings screen, rendered from the registry rather than hand-built.
 *
 * Adding a setting is one entry in definitions.ts — no field to write here, no
 * reader to remember. The form's job is to present what the registry declares
 * and to hand back only what changed.
 */

interface Props {
  definitions: SettingDefinition[];
  values: Record<string, string | number | boolean>;
  lastChanged: Record<string, { at: string; by: string | null }>;
  canUpdate: boolean;
  onSaved: () => void;
}

export function SystemSettingsForm({
  definitions,
  values,
  lastChanged,
  canUpdate,
  onSaved,
}: Props) {
  const { toast } = useToast();
  const [isPending, startTransition] = useTransition();

  // Only what the person has touched. Sending the whole set back would mean two
  // people editing different categories overwrite each other.
  const [edits, setEdits] = useState<Record<string, string>>({});

  const current = (key: string) => edits[key] ?? String(values[key] ?? "");
  const isDirty = Object.keys(edits).length > 0;

  const byCategory = useMemo(() => {
    const out = new Map<SettingCategory, SettingDefinition[]>();
    for (const d of definitions) {
      if (!out.has(d.category)) out.set(d.category, []);
      out.get(d.category)!.push(d);
    }
    return out;
  }, [definitions]);

  const changedSensitive = useMemo(
    () =>
      Object.keys(edits).filter((k) => definitions.find((d) => d.key === k)?.sensitive),
    [edits, definitions],
  );

  const save = () => {
    startTransition(async () => {
      const result = await updateSystemSettings(edits);
      if (result.success) {
        toast({ title: "Settings saved" });
        setEdits({});
        onSaved();
      } else {
        toast({ variant: "destructive", title: "Not saved", description: result.error });
      }
    });
  };

  const reset = (key: string) => {
    startTransition(async () => {
      const result = await resetSystemSetting(key);
      if (result.success) {
        toast({ title: "Put back to its default" });
        setEdits((e) => {
          const next = { ...e };
          delete next[key];
          return next;
        });
        onSaved();
      } else {
        toast({ variant: "destructive", title: "Not reset", description: result.error });
      }
    });
  };

  return (
    <div className="space-y-6">
      {SETTING_CATEGORIES.filter((c) => byCategory.has(c)).map((category) => (
        <Card key={category}>
          <CardHeader>
            <CardTitle>{CATEGORY_LABELS[category]}</CardTitle>
            <CardDescription>{CATEGORY_DESCRIPTIONS[category]}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {byCategory.get(category)!.map((definition, index) => {
              const changed = definition.key in edits;
              const history = lastChanged[definition.key];
              return (
                <div key={definition.key}>
                  {index > 0 && <Separator className="mb-6" />}
                  <div className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-start">
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <Label htmlFor={definition.key} className="text-base font-medium">
                          {definition.label}
                        </Label>
                        {definition.sensitive && (
                          <Badge variant="outline" className="gap-1 border-warning text-warning-strong">
                            <ShieldAlert className="h-3 w-3" />
                            Security control
                          </Badge>
                        )}
                        {changed && <Badge variant="secondary">Unsaved</Badge>}
                      </div>
                      <p className="max-w-2xl text-sm text-muted-foreground">
                        {definition.description}
                      </p>
                      {history && (
                        <p className="text-xs text-muted-foreground">
                          Changed {formatDistanceToNow(parseISO(history.at), { addSuffix: true })}
                          {history.by ? ` by ${history.by}` : ""}
                        </p>
                      )}
                    </div>

                    <div className="flex items-center gap-2 sm:justify-end">
                      <SettingField
                        definition={definition}
                        value={current(definition.key)}
                        disabled={!canUpdate || isPending}
                        onChange={(v) =>
                          setEdits((e) => ({ ...e, [definition.key]: v }))
                        }
                      />
                      {canUpdate && history && (
                        <Button
                          variant="ghost"
                          size="icon"
                          title={`Put back to ${definition.default}`}
                          onClick={() => reset(definition.key)}
                          disabled={isPending}
                        >
                          <RotateCcw className="h-4 w-4" />
                          <span className="sr-only">
                            Put {definition.label} back to its default
                          </span>
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>
      ))}

      {canUpdate && (
        <div
          className={cn(
            "sticky bottom-0 flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-background p-4 shadow-lg",
            !isDirty && "hidden",
          )}
        >
          <div className="text-sm">
            {changedSensitive.length > 0 ? (
              <span className="flex items-center gap-2 font-medium text-warning-strong">
                <AlertTriangle className="h-4 w-4" />
                {changedSensitive.length} security control
                {changedSensitive.length === 1 ? "" : "s"} changed. This is recorded against your
                name.
              </span>
            ) : (
              <span className="text-muted-foreground">
                {Object.keys(edits).length} change
                {Object.keys(edits).length === 1 ? "" : "s"} not yet saved.
              </span>
            )}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setEdits({})} disabled={isPending}>
              Discard
            </Button>
            <Button onClick={save} disabled={isPending}>
              {isPending ? "Saving..." : "Save changes"}
            </Button>
          </div>
        </div>
      )}

      {!canUpdate && (
        <p className="text-sm text-muted-foreground">
          You can see these values but not change them.
        </p>
      )}
    </div>
  );
}

/** One control, chosen by the definition's declared type. */
function SettingField({
  definition,
  value,
  disabled,
  onChange,
}: {
  definition: SettingDefinition;
  value: string;
  disabled: boolean;
  onChange: (value: string) => void;
}) {
  if (definition.type === "boolean") {
    return (
      <Switch
        id={definition.key}
        checked={value === "true"}
        disabled={disabled}
        onCheckedChange={(checked) => onChange(String(checked))}
      />
    );
  }

  if (definition.type === "select") {
    return (
      <Select value={value} onValueChange={onChange} disabled={disabled}>
        <SelectTrigger id={definition.key} className="w-[220px]">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {(definition.options ?? []).map((o) => (
            <SelectItem key={o.value} value={o.value}>
              {o.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    );
  }

  if (definition.type === "number") {
    return (
      <div className="flex items-center gap-2">
        <Input
          id={definition.key}
          type="number"
          className="w-28"
          value={value}
          min={definition.min}
          max={definition.max}
          step={definition.step}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value)}
          // The bounds are enforced on the server and again when the value is
          // read; this only saves a round trip.
          aria-describedby={`${definition.key}-bounds`}
        />
        <span id={`${definition.key}-bounds`} className="text-xs text-muted-foreground">
          {definition.unit}
          {definition.min !== undefined && definition.max !== undefined && (
            <> ({definition.min}–{definition.max})</>
          )}
        </span>
      </div>
    );
  }

  return (
    <Input
      id={definition.key}
      className="w-[260px]"
      value={value}
      disabled={disabled}
      onChange={(e) => onChange(e.target.value)}
    />
  );
}
