

"use client";

import { useFieldArray, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import {
  Form,
  FormControl,
  FormDescription,
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
import { CalendarIcon, ChevronDown, PlusCircle, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
    DropdownMenu,
    DropdownMenuCheckboxItem,
    DropdownMenuContent,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Card, CardContent } from "../ui/card";
import { Separator } from "../ui/separator";
import type { Department, ProjectStatus, PmoDivision } from "@prisma/client";
import type { UserWithRoles } from "@/lib/types";
import { useRouter } from "next/navigation";
import { useEffect, useState, useMemo } from "react";
import { Switch } from "../ui/switch";
import { useAuth } from "@/context/auth-context";
import { ProjectFormMilestones } from "./project-form-milestones";
import { ProjectFormCost } from "./project-form-cost";
import {
  projectSchema,
  type ProjectFormValues,
  type ProjectFormInitialValues,
} from "./project-form-schema";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "../ui/alert-dialog";
import type { Serialized } from '@/lib/serialize';


type ProjectFormProps = {
  mode: 'create' | 'edit';
  initialData?: ProjectFormInitialValues;
  users: UserWithRoles[];
  pmoDivisions: Serialized<PmoDivision>[];
  departments: Serialized<Department>[];
  projectStatuses: Serialized<ProjectStatus>[];
  onSubmit: (data: ProjectFormValues) => Promise<any>;
};

/**
 * The form itself: state, submission, and the three sections it composes.
 *
 * The schema and the two long sections were extracted because this file had
 * grown to nearly nine hundred lines. Nothing was shared between the
 * milestones markup and the payments markup, so keeping them together bought
 * nothing and made either one hard to find.
 */
export function ProjectForm({ mode, initialData, users, pmoDivisions, departments, projectStatuses, onSubmit }: ProjectFormProps) {
  const router = useRouter();
  const { hasPermission } = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isTimelineChangeDialogOpen, setIsTimelineChangeDialogOpen] = useState(false);
  const [originalEndDate, setOriginalEndDate] = useState<Date | undefined>(initialData?.endDate);

  const isEditMode = mode === 'edit';
  const canRequestTimelineChange = hasPermission('timeline:request');

  const nonAdminUsers = useMemo(() => {
    return users.filter(user => !user.roles.some(role => role.name === 'Admin'));
  }, [users]);

  const getCurrentWorkingYear = () => {
    const today = new Date();
    const year = today.getFullYear();
    const month = today.getMonth(); // 0-indexed (January is 0)
    if (month >= 6) {
      return `${year}/${year + 1}`;
    } else {
      return `${year - 1}/${year}`;
    }
  };
  
  const augmentedInitialData = isEditMode && initialData
  ? { ...initialData, hasMilestones: !!(initialData.milestones && initialData.milestones.length > 0) }
  : {
      name: "",
      description: "",
      workingYear: getCurrentWorkingYear(),
      statusId: "",
      pmoDivisionId: "",
      projectManagerId: "",
      responsibleDepartmentIds: [],
      hasMilestones: false,
      hasCost: false,
      currency: 'ETB',
      totalCost: 0,
      milestones: [],
      payments: [],
    };

  const form = useForm<ProjectFormValues>({
    resolver: zodResolver(projectSchema),
    defaultValues: augmentedInitialData,
  });

  const selectedPmoDivisionId = form.watch("pmoDivisionId");
  const hasMilestones = form.watch("hasMilestones");
  const hasCost = form.watch("hasCost");
  const currency = form.watch("currency");
  const currencySymbol = currency === 'USD' ? '$' : 'ETB';

  const projectManagers = useMemo(() => {
    const usersToFilter = nonAdminUsers;
    if (!selectedPmoDivisionId) {
      return usersToFilter;
    }
    return usersToFilter.filter(user => user.pmoDivisionId === selectedPmoDivisionId);
  }, [selectedPmoDivisionId, nonAdminUsers]);

  useEffect(() => {
    if (isEditMode && initialData) {
        const resetData = {
            ...initialData,
            hasMilestones: !!(initialData.milestones && initialData.milestones.length > 0)
        }
        form.reset(resetData);
        setOriginalEndDate(initialData.endDate);
    }
  }, [initialData, isEditMode, form]);

  // Passed whole to the section that owns each list, rather than destructured
  // here and threaded through as six separate props.
  const milestoneArray = useFieldArray({ control: form.control, name: "milestones" });
  const paymentArray = useFieldArray({ control: form.control, name: "payments" });

  const milestonesError = form.formState.errors.milestones?.root;

  async function handleFormSubmit(data: ProjectFormValues) {
    if (isEditMode && canRequestTimelineChange && originalEndDate && data.endDate.getTime() !== originalEndDate.getTime()) {
      setIsTimelineChangeDialogOpen(true);
      return;
    }
    
    setIsSubmitting(true);
    await onSubmit(data);
    setIsSubmitting(false);
  }
  
  async function handleTimelineChangeSubmit() {
    const reason = form.getValues("timelineChangeReason");
    if (!reason || reason.length < 10) {
        form.setError("timelineChangeReason", { type: "manual", message: "A reason of at least 10 characters is required." });
        return;
    }

    setIsTimelineChangeDialogOpen(false);
    setIsSubmitting(true);
    await onSubmit(form.getValues());
    setIsSubmitting(false);
  }

  return (
    <>
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleFormSubmit)} className="space-y-8">
        <div className="space-y-4">
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
             <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                    control={form.control}
                    name="pmoDivisionId"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>Owning EPMO Division</FormLabel>
                            <Select onValueChange={field.onChange} value={field.value}>
                                <FormControl>
                                    <SelectTrigger><SelectValue placeholder="Select an Owning EPMO Division" /></SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                    {pmoDivisions.map(div => <SelectItem key={div.id} value={div.id}>{div.name}</SelectItem>)}
                                </SelectContent>
                            </Select>
                            <FormMessage />
                        </FormItem>
                    )}
                    />
                <FormField
                    control={form.control}
                    name="projectManagerId"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>Project Manager</FormLabel>
                            <Select onValueChange={field.onChange} value={field.value}>
                                <FormControl>
                                    <SelectTrigger><SelectValue placeholder="Select a project manager" /></SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                    {projectManagers.map(user => <SelectItem key={user.id} value={user.id}>{user.name}</SelectItem>)}
                                </SelectContent>
                            </Select>
                            <FormMessage />
                        </FormItem>
                    )}
                />
                <FormField
                    control={form.control}
                    name="statusId"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>Project Status</FormLabel>
                            <Select onValueChange={field.onChange} value={field.value}>
                                <FormControl>
                                    <SelectTrigger><SelectValue placeholder="Select a status" /></SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                    {projectStatuses.map(status => <SelectItem key={status.id} value={status.id}>{status.name}</SelectItem>)}
                                </SelectContent>
                            </Select>
                            <FormMessage />
                        </FormItem>
                    )}
                />
                <FormField
                    control={form.control}
                    name="workingYear"
                    render={({ field }) => (
                        <FormItem>
                        <FormLabel>Working Year</FormLabel>
                        <FormControl>
                            <Input placeholder="Set active year in Settings" {...field} disabled />
                        </FormControl>
                        <FormDescription>
                            {isEditMode ? "The working year cannot be changed." : "The working year is automatically set based on the active year from Settings."}
                        </FormDescription>
                        <FormMessage />
                        </FormItem>
                    )}
                />
                <FormField
                  control={form.control}
                  name="responsibleDepartmentIds"
                  render={({ field }) => {
                      const selectedDepts = departments.filter(dept => field.value?.includes(dept.id));
                      return (
                      <FormItem className="flex flex-col md:col-span-2">
                          <FormLabel>Responsible Departments</FormLabel>
                          <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                              <FormControl>
                              <Button variant="outline" className={cn("w-full justify-start", !field.value?.length && "text-muted-foreground")}>
                                  {selectedDepts.length > 0
                                      ? selectedDepts.map(d => d.name).join(', ')
                                      : "Select departments..."}
                                  <ChevronDown className="ml-auto h-4 w-4" />
                              </Button>
                              </FormControl>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent className="w-[--radix-dropdown-menu-trigger-width]">
                              {departments.map((dept) => (
                              <DropdownMenuCheckboxItem
                                  key={dept.id}
                                  checked={field.value?.includes(dept.id)}
                                  onCheckedChange={(checked) => {
                                  const newValues = field.value ? [...field.value] : [];
                                  if (checked) {
                                      newValues.push(dept.id);
                                  } else {
                                      const idx = newValues.indexOf(dept.id);
                                      if (idx > -1) newValues.splice(idx, 1);
                                  }
                                  field.onChange(newValues);
                                  }}
                              >
                                  {dept.name}
                              </DropdownMenuCheckboxItem>
                              ))}
                          </DropdownMenuContent>
                          </DropdownMenu>
                          <FormMessage />
                      </FormItem>
                      )
                  }}
              />
             </div>
        </div>

        <Separator />

        <ProjectFormMilestones
          form={form}
          fieldArray={milestoneArray}
          enabled={hasMilestones}
          weightError={milestonesError}
        />

        <Separator />

        <ProjectFormCost
          form={form}
          fieldArray={paymentArray}
          enabled={hasCost}
          currencySymbol={currencySymbol}
        />
        <Separator />
        <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => router.back()} disabled={isSubmitting}>Cancel</Button>
            <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? (isEditMode ? 'Saving...' : 'Creating...') : (isEditMode ? 'Save Changes' : 'Create Project')}
            </Button>
        </div>
      </form>
    </Form>

    <AlertDialog open={isTimelineChangeDialogOpen} onOpenChange={setIsTimelineChangeDialogOpen}>
        <AlertDialogContent>
            <AlertDialogHeader>
                <AlertDialogTitle>Reason for Deadline Change</AlertDialogTitle>
                <AlertDialogDescription>
                    You have changed the project's end date. Please provide a clear reason for this change. This will be submitted for approval.
                </AlertDialogDescription>
            </AlertDialogHeader>
            <Form {...form}>
                <form id="timeline-change-form" onSubmit={(e) => { e.preventDefault(); handleTimelineChangeSubmit(); }}>
                     <FormField
                        control={form.control}
                        name="timelineChangeReason"
                        render={({ field }) => (
                            <FormItem>
                            <FormLabel>Reason</FormLabel>
                            <FormControl>
                                <Textarea placeholder="e.g., Unforeseen technical challenges in Phase 2 have caused a delay..." {...field} />
                            </FormControl>
                            <FormMessage />
                            </FormItem>
                        )}
                    />
                </form>
            </Form>
            <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction type="submit" form="timeline-change-form">Submit for Approval</AlertDialogAction>
            </AlertDialogFooter>
        </AlertDialogContent>
    </AlertDialog>
    </>
  );
}
