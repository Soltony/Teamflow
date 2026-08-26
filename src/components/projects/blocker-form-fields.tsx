"use client";

import type { UseFormReturn } from "react-hook-form";
import { format } from "date-fns";
import { CalendarIcon } from "lucide-react";

import {
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { BLOCKER_CATEGORIES, BLOCKER_SEVERITIES } from "@/lib/validation/blocker";

/**
 * The fields an issue carries, shared by the add and edit dialogs.
 *
 * Both dialogs previously held their own copy of a single textarea. Now that an
 * issue has seven fields, two copies would drift — and a form that captures
 * severity on creation but not on edit is worse than one that captures neither.
 */

const SEVERITY_HELP: Record<string, string> = {
  LOW: "Worth recording; not affecting the plan.",
  MEDIUM: "Slowing work down, no date at risk yet.",
  HIGH: "A milestone date is at risk.",
  CRITICAL: "The project cannot proceed.",
};

const CATEGORY_LABELS: Record<string, string> = {
  RESOURCE: "People or resources",
  TECHNICAL: "Technical",
  VENDOR: "Vendor or supplier",
  FINANCIAL: "Budget or payment",
  DEPENDENCY: "Waiting on another team",
  REGULATORY: "Regulatory or compliance",
  SCOPE: "Scope or requirements",
  OTHER: "Other",
};

export interface OwnerOption {
  id: string;
  name: string;
}

export function BlockerFormFields({
  form,
  owners,
}: {
  // The two dialogs infer slightly different value types from their schemas,
  // so this takes the form loosely rather than forcing them to converge.
  form: UseFormReturn<any>;
  owners: OwnerOption[];
}) {
  return (
    <>
      <FormField
        control={form.control}
        name="title"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Title</FormLabel>
            <FormControl>
              <Input placeholder="e.g. Vendor has not delivered licence keys" {...field} />
            </FormControl>
            <FormDescription>A short line that reads well in a report.</FormDescription>
            <FormMessage />
          </FormItem>
        )}
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <FormField
          control={form.control}
          name="severity"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Severity</FormLabel>
              <Select onValueChange={field.onChange} value={field.value}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="How serious is it?" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {BLOCKER_SEVERITIES.map((s) => (
                    <SelectItem key={s} value={s}>
                      <span className="font-medium">{s.charAt(0) + s.slice(1).toLowerCase()}</span>
                      <span className="text-muted-foreground"> — {SEVERITY_HELP[s]}</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="category"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Category</FormLabel>
              <Select onValueChange={field.onChange} value={field.value}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="What kind of issue?" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {BLOCKER_CATEGORIES.map((c) => (
                    <SelectItem key={c} value={c}>
                      {CATEGORY_LABELS[c]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />
      </div>

      <FormField
        control={form.control}
        name="description"
        render={({ field }) => (
          <FormItem>
            <FormLabel>What is the problem?</FormLabel>
            <FormControl>
              <Textarea
                placeholder="e.g. Awaiting security clearance for server access..."
                className="min-h-[100px]"
                {...field}
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />

      <FormField
        control={form.control}
        name="impact"
        render={({ field }) => (
          <FormItem>
            <FormLabel>What is it holding up? (optional)</FormLabel>
            <FormControl>
              <Textarea
                placeholder="e.g. Blocks UAT, which is due to start on the 14th."
                className="min-h-[70px]"
                {...field}
                value={field.value ?? ""}
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <FormField
          control={form.control}
          name="ownerId"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Owner</FormLabel>
              <Select onValueChange={field.onChange} value={field.value ?? ""}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Who will clear it?" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {owners.map((u) => (
                    <SelectItem key={u.id} value={u.id}>
                      {u.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormDescription>An issue nobody owns tends to stay open.</FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="dueDate"
          render={({ field }) => (
            <FormItem className="flex flex-col">
              <FormLabel>Clear by</FormLabel>
              <Popover>
                <PopoverTrigger asChild>
                  <FormControl>
                    <Button
                      variant="outline"
                      className={cn(
                        "pl-3 text-left font-normal",
                        !field.value && "text-muted-foreground",
                      )}
                    >
                      {field.value ? format(new Date(field.value), "PPP") : "No date agreed"}
                      <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                    </Button>
                  </FormControl>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={field.value ? new Date(field.value) : undefined}
                    onSelect={field.onChange}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
              <FormMessage />
            </FormItem>
          )}
        />
      </div>
    </>
  );
}
