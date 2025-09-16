
"use client";

import * as React from "react";
import { useState, useTransition } from "react";
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
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { useToast } from "@/hooks/use-toast";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { CalendarIcon, Clock, CheckCircle, XCircle, ChevronDown, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { Badge } from "../ui/badge";

type Payment = any;
type ProjectWithRelations = any;

type PaymentsManagementProps = {
  initialProjects: ProjectWithRelations[];
  onDataChange: () => void;
};

export function PaymentsManagement({ initialProjects, onDataChange }: PaymentsManagementProps) {
  const { toast } = useToast();
  
  const getStatusBadge = (status: string) => {
    switch (status) {
        case 'PENDING':
            return <Badge variant="secondary" className="bg-amber-500/80 text-white"><Clock className="mr-1 h-3 w-3"/>Pending</Badge>;
        case 'APPROVED':
            return <Badge variant="secondary" className="bg-green-600 text-white"><CheckCircle className="mr-1 h-3 w-3"/>Approved</Badge>;
        case 'REJECTED':
            return <Badge variant="destructive"><XCircle className="mr-1 h-3 w-3"/>Rejected</Badge>;
        default:
            return <Badge variant="outline">Unknown</Badge>;
    }
  }

  return (
    <>
      <Accordion type="multiple" className="w-full space-y-4" defaultValue={initialProjects.map((p: any) => p.id)}>
        {initialProjects.map((project: ProjectWithRelations) => {
          const approvedPayments = project.payments.filter((p: any) => p.status === 'APPROVED');
          const totalPaid = approvedPayments.reduce((sum: number, p: any) => sum + parseFloat(p.amount.toString()), 0);
          const projectCost = parseFloat(project.totalCost?.toString() || '0');
          const balance = projectCost - totalPaid;
          const progress = projectCost > 0 ? (totalPaid / projectCost) * 100 : 0;
          const currencySymbol = project.currency === 'USD' ? '$' : 'ETB';
          
          return (
          <AccordionItem value={project.id} key={project.id} className="border rounded-lg bg-background">
            <AccordionTrigger className="p-4 font-semibold text-lg hover:no-underline">
              <div className="flex flex-col md:flex-row w-full items-start md:items-center justify-between gap-2">
                  <span className="text-left flex-1">{project.name}</span>
                  <div className="flex items-center gap-4 w-full md:w-auto">
                    <div className="flex flex-col items-end w-48">
                        <span className="text-xs text-muted-foreground">{currencySymbol} {totalPaid.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} / {currencySymbol} {projectCost.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                    </div>
                  </div>
              </div>
            </AccordionTrigger>
            <AccordionContent className="p-4 pt-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Payment</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {project.payments.length > 0 ? project.payments.map((payment: Payment) => (
                      <TableRow key={payment.id}>
                        <TableCell className="font-medium">{payment.title}</TableCell>
                        <TableCell>{format(new Date(payment.paymentDate), 'MMM dd, yyyy')}</TableCell>
                        <TableCell>{getStatusBadge(payment.status)}</TableCell>
                        <TableCell className="text-right">{currencySymbol} {parseFloat(payment.amount.toString()).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</TableCell>
                      </TableRow>
                  )) : (
                    <TableRow>
                        <TableCell colSpan={4} className="h-24 text-center">
                            No payment schedule defined for this project.
                        </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </AccordionContent>
          </AccordionItem>
        )})}
      </Accordion>
    </>
  );
}
