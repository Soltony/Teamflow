"use client";

import { useState, useEffect } from "react";
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

const activeYearSchema = z.object({
  activeYear: z.string().nonempty("Please select an active year."),
});

type ActiveYearFormValues = z.infer<typeof activeYearSchema>;

export function ActiveYearManagement({ availableYears }: { availableYears: string[] }) {
  const { toast } = useToast();
  const [currentActiveYear, setCurrentActiveYear] = useState<string>("");
  
  const form = useForm<ActiveYearFormValues>({
    resolver: zodResolver(activeYearSchema),
    defaultValues: {
      activeYear: "",
    },
  });
  
  useEffect(() => {
    const storedYear = localStorage.getItem("activeWorkingYear") || "";
    setCurrentActiveYear(storedYear);
    form.setValue("activeYear", storedYear);
  }, [form]);


  function onSubmit(data: ActiveYearFormValues) {
    localStorage.setItem("activeWorkingYear", data.activeYear);
    setCurrentActiveYear(data.activeYear);
    toast({
      title: "Active Year Updated!",
      description: `The default active working year has been set to ${data.activeYear}.`,
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Active Working Year</CardTitle>
        <CardDescription>
          Set the default working year that will be displayed on the dashboard when the app loads.
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
                  <Select onValueChange={field.onChange} value={field.value}>
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
            <Button type="submit">Save Default Year</Button>
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
