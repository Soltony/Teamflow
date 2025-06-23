"use client";

import { useFieldArray, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { CalendarIcon, PlusCircle, Trash2, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { teams, users } from "@/lib/data";
import { TaskSuggestion } from "./task-suggestion";
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { Separator } from "../ui/separator";
import { useToast } from "@/hooks/use-toast";


const taskSchema = z.object({
  title: z.string().min(3, "Title must be at least 3 characters."),
  description: z.string().min(10, "Description must be at least 10 characters."),
  startDate: z.date(),
  endDate: z.date(),
  weight: z.coerce.number().min(1, "Weight must be at least 1.").max(100, "Weight cannot exceed 100."),
  teamId: z.string().nonempty("Please select a team."),
  teamLeadId: z.string().nonempty("Please select a team lead."),
});

const projectSchema = z.object({
  name: z.string().min(3, "Project name must be at least 3 characters."),
  description: z.string().min(10, "Description must be at least 10 characters."),
  startDate: z.date({ required_error: "A start date is required."}),
  endDate: z.date({ required_error: "An end date is required."}),
  tasks: z.array(taskSchema),
}).refine(data => data.endDate > data.startDate, {
    message: "End date must be after start date.",
    path: ["endDate"],
});

type ProjectFormValues = z.infer<typeof projectSchema>;

export function ProjectForm() {
  const { toast } = useToast();
  const [suggestionTaskIndex, setSuggestionTaskIndex] = useState<number | null>(null);

  const form = useForm<ProjectFormValues>({
    resolver: zodResolver(projectSchema),
    defaultValues: {
      name: "",
      description: "",
      tasks: [],
    },
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "tasks",
  });

  function onSubmit(data: ProjectFormValues) {
    console.log(data);
    toast({
        title: "Project Created!",
        description: `Project "${data.name}" has been successfully created.`,
      });
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
        <Card>
            <CardHeader>
                <CardTitle>Project Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
                <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                    <FormItem>
                    <FormLabel>Project Name</FormLabel>
                    <FormControl>
                        <Input placeholder="e.g., E-commerce Platform Relaunch" {...field} />
                    </FormControl>
                    <FormMessage />
                    </FormItem>
                )}
                />
                <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                    <FormItem>
                    <FormLabel>Project Description</FormLabel>
                    <FormControl>
                        <Textarea placeholder="Describe the project goals and objectives." {...field} />
                    </FormControl>
                    <FormMessage />
                    </FormItem>
                )}
                />
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField
                        control={form.control}
                        name="startDate"
                        render={({ field }) => (
                        <FormItem className="flex flex-col">
                            <FormLabel>Start Date</FormLabel>
                            <Popover>
                            <PopoverTrigger asChild>
                                <FormControl>
                                <Button
                                    variant={"outline"}
                                    className={cn(
                                    "w-full pl-3 text-left font-normal",
                                    !field.value && "text-muted-foreground"
                                    )}
                                >
                                    {field.value ? (
                                    format(field.value, "PPP")
                                    ) : (
                                    <span>Pick a date</span>
                                    )}
                                    <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                                </Button>
                                </FormControl>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0" align="start">
                                <Calendar
                                mode="single"
                                selected={field.value}
                                onSelect={field.onChange}
                                disabled={(date) => date < new Date("1900-01-01")}
                                initialFocus
                                />
                            </PopoverContent>
                            </Popover>
                            <FormMessage />
                        </FormItem>
                        )}
                    />
                    <FormField
                        control={form.control}
                        name="endDate"
                        render={({ field }) => (
                        <FormItem className="flex flex-col">
                            <FormLabel>End Date</FormLabel>
                            <Popover>
                            <PopoverTrigger asChild>
                                <FormControl>
                                <Button
                                    variant={"outline"}
                                    className={cn(
                                    "w-full pl-3 text-left font-normal",
                                    !field.value && "text-muted-foreground"
                                    )}
                                >
                                    {field.value ? (
                                    format(field.value, "PPP")
                                    ) : (
                                    <span>Pick a date</span>
                                    )}
                                    <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                                </Button>
                                </FormControl>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0" align="start">
                                <Calendar
                                mode="single"
                                selected={field.value}
                                onSelect={field.onChange}
                                disabled={(date) =>
                                    date < (form.getValues("startDate") || new Date("1900-01-01"))
                                }
                                initialFocus
                                />
                            </PopoverContent>
                            </Popover>
                            <FormMessage />
                        </FormItem>
                        )}
                    />
                </div>
            </CardContent>
        </Card>
        
        <div className="space-y-4">
            <h3 className="text-lg font-medium">Tasks</h3>
            {fields.map((field, index) => (
              <Card key={field.id} className="relative">
                <Button variant="ghost" size="icon" className="absolute top-2 right-2" onClick={() => remove(index)}>
                    <X className="h-4 w-4" />
                </Button>
                <CardContent className="p-6 space-y-4">
                    <FormField
                        control={form.control}
                        name={`tasks.${index}.title`}
                        render={({ field }) => (
                            <FormItem>
                            <FormLabel>Task Title</FormLabel>
                            <FormControl>
                                <Input placeholder="e.g., Design Wireframes" {...field} />
                            </FormControl>
                            <FormMessage />
                            </FormItem>
                        )}
                    />
                    
                    <FormField
                        control={form.control}
                        name={`tasks.${index}.description`}
                        render={({ field }) => (
                            <FormItem>
                            <FormLabel>Task Description</FormLabel>
                            <FormControl>
                                <Textarea placeholder="Describe the task requirements and deliverables." {...field} />
                            </FormControl>
                            <FormMessage />
                            </FormItem>
                        )}
                    />
                     <Button type="button" variant="link" size="sm" onClick={() => setSuggestionTaskIndex(suggestionTaskIndex === index ? null : index)}>
                        {suggestionTaskIndex === index ? 'Hide AI Suggestions' : 'Get AI Suggestions for Description'}
                    </Button>

                    {suggestionTaskIndex === index && (
                        <TaskSuggestion
                            taskTitle={form.watch(`tasks.${index}.title`)}
                            onSelectSuggestion={(description) => {
                                form.setValue(`tasks.${index}.description`, description);
                                setSuggestionTaskIndex(null);
                            }}
                        />
                    )}

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <FormField
                            control={form.control}
                            name={`tasks.${index}.startDate`}
                            render={({ field: dateField }) => (
                            <FormItem className="flex flex-col">
                                <FormLabel>Task Start Date</FormLabel>
                                <Popover>
                                <PopoverTrigger asChild>
                                    <FormControl>
                                    <Button
                                        variant={"outline"}
                                        className={cn("w-full pl-3 text-left font-normal", !dateField.value && "text-muted-foreground")}
                                    >
                                        {dateField.value ? format(dateField.value, "PPP") : <span>Pick a date</span>}
                                        <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                                    </Button>
                                    </FormControl>
                                </PopoverTrigger>
                                <PopoverContent className="w-auto p-0" align="start">
                                    <Calendar mode="single" selected={dateField.value} onSelect={dateField.onChange} initialFocus />
                                </PopoverContent>
                                </Popover>
                                <FormMessage />
                            </FormItem>
                            )}
                        />
                        <FormField
                            control={form.control}
                            name={`tasks.${index}.endDate`}
                            render={({ field: dateField }) => (
                            <FormItem className="flex flex-col">
                                <FormLabel>Task End Date</FormLabel>
                                <Popover>
                                <PopoverTrigger asChild>
                                    <FormControl>
                                    <Button
                                        variant={"outline"}
                                        className={cn("w-full pl-3 text-left font-normal", !dateField.value && "text-muted-foreground")}
                                    >
                                        {dateField.value ? format(dateField.value, "PPP") : <span>Pick a date</span>}
                                        <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                                    </Button>
                                    </FormControl>
                                </PopoverTrigger>
                                <PopoverContent className="w-auto p-0" align="start">
                                    <Calendar mode="single" selected={dateField.value} onSelect={dateField.onChange} initialFocus />
                                </PopoverContent>
                                </Popover>
                                <FormMessage />
                            </FormItem>
                            )}
                        />
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <FormField
                        control={form.control}
                        name={`tasks.${index}.teamId`}
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>Team</FormLabel>
                                <Select onValueChange={field.onChange} defaultValue={field.value}>
                                    <FormControl>
                                        <SelectTrigger><SelectValue placeholder="Select a team" /></SelectTrigger>
                                    </FormControl>
                                    <SelectContent>
                                        {teams.map(team => <SelectItem key={team.id} value={team.id}>{team.name}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                                <FormMessage />
                            </FormItem>
                        )}
                        />
                        <FormField
                        control={form.control}
                        name={`tasks.${index}.teamLeadId`}
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>Team Lead</FormLabel>
                                <Select onValueChange={field.onChange} defaultValue={field.value}>
                                    <FormControl>
                                        <SelectTrigger><SelectValue placeholder="Select a team lead" /></SelectTrigger>
                                    </FormControl>
                                    <SelectContent>
                                        {users.map(user => <SelectItem key={user.id} value={user.id}>{user.name}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                                <FormMessage />
                            </FormItem>
                        )}
                        />
                         <FormField
                            control={form.control}
                            name={`tasks.${index}.weight`}
                            render={({ field }) => (
                                <FormItem>
                                <FormLabel>Weight (%)</FormLabel>
                                <FormControl>
                                    <Input type="number" placeholder="e.g., 20" {...field} />
                                </FormControl>
                                <FormMessage />
                                </FormItem>
                            )}
                        />
                    </div>
                </CardContent>
              </Card>
            ))}

            <Button
                type="button"
                variant="outline"
                className="w-full"
                onClick={() => append({ title: '', description: '', startDate: new Date(), endDate: new Date(), weight: 10, teamId: '', teamLeadId: '' })}
            >
                <PlusCircle className="w-4 h-4 mr-2" />
                Add Task
            </Button>
        </div>
        <Separator />
        <div className="flex justify-end gap-2">
            <Button type="button" variant="outline">Cancel</Button>
            <Button type="submit">Create Project</Button>
        </div>
      </form>
    </Form>
  );
}
