"use client";

import { useEffect, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { updateActiveWorkingYear } from "@/app/settings/actions";

const activeYearSchema = z.object({
  activeYear: z.string().nonempty("Please select an active year."),
});

type ActiveYearFormValues = z.infer<typeof activeYearSchema>;

type ActiveYearManagementProps = {
  availableYears: string[];
  currentActiveYear: string;
};

export function ActiveYearManagement({ availableYears, currentActiveYear }: ActiveYearManagementProps) {
  const { toast } = useToast();
  const [isPending, startTransition] = useTransition();

  const form = useForm<ActiveYearFormValues>({
    resolver: zodResolver(activeYearSchema),
    defaultValues: {
      activeYear: currentActiveYear,
    },
  });

  useEffect(() => {
    form.setValue("activeYear", currentActiveYear);
  }, [currentActiveYear, form]);

  function onSubmit(data: ActiveYearFormValues) {
    startTransition(async () => {
      const result = await updateActiveWorkingYear(data.activeYear);
      if (result.success) {
        toast({
          title: "Active Year Updated!",
          description: `The default active working year has been set to ${data.activeYear}.`,
        });
        // This is kept for client-side components that might need immediate feedback without a full page reload.
        localStorage.setItem("activeWorkingYear", data.activeYear);
      } else {
        toast({
          title: "Error",
          description: result.error,
          variant: "destructive",
        });
      }
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Active Working Year</CardTitle>
        <CardDescription>
          Set the default working year that will be displayed on the dashboard when the app loads. This setting is shared across all users.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="activeYear"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Default Active Year</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value || ""}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select a year to be the default" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {availableYears.map(year => (
                        <SelectItem key={year} value={year}>
                          {year}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <Button type="submit" disabled={isPending}>
              {isPending ? "Saving..." : "Save Default Year"}
            </Button>
          </form>
        </Form>
        {currentActiveYear && (
            <p className="text-sm text-muted-foreground mt-4">
                Current active year is set to: <span className="font-semibold">{currentActiveYear}</span>
            </p>
        )}
      </CardContent>
    </Card>
  );
}
