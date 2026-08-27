







'use server';

import prisma from "@/lib/db";
import { notifyMany } from "@/lib/notifications/notify";
import { revalidatePath } from "next/cache";
import type { TaskStatus } from "@/lib/types";
import type { Prisma } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import { requirePermission, canSeeAllProjects } from "@/lib/auth/guard";
import { isArchivedStatus, isClosedStatus } from "@/lib/metrics";
import { auditAction } from "@/lib/auth/audit-context";
import { AUDIT_ACTIONS, diffFields } from "@/lib/audit-log";
import {
    blockerTransitionError,
    canTransitionBlocker,
    createBlockerSchema,
    escalateBlockerSchema,
    resolveBlockerSchema,
    updateBlockerSchema,
    type CreateBlockerInput,
    type EscalateBlockerInput,
    type UpdateBlockerInput,
} from "@/lib/validation/blocker";
import { GENERAL_TASKS_TITLE, ensureGeneralTasksMilestone } from "@/lib/services/milestones";
import { resolvePage } from "@/lib/pagination";

/**
 * Thrown inside the update transaction when a project cannot be closed.
 * Carries a message meant for the user, unlike the generic failure below it.
 */
class ProjectCompletionBlocked extends Error {}

import {
    createProjectSchema,
    formatValidationError,
    updateProjectSchema,
} from "@/lib/validation/project";
import { serialize } from '@/lib/serialize';
import { USER_DISPLAY_SELECT, USER_WITH_ROLES_SELECT } from '@/lib/queries/user-select';
import { OPEN_BLOCKER_STATUSES } from '@/lib/validation/blocker';
import { projectVisibilityClauses } from '@/lib/queries/project-visibility';

export async function getNewProjectData() {
    await requirePermission('projects:create');
    const [users, pmoDivisions, projectStatuses, departments] = await Promise.all([
        prisma.user.findMany({ select: USER_WITH_ROLES_SELECT }),
        prisma.pmoDivision.findMany(),
        prisma.projectStatus.findMany(),
        prisma.department.findMany(),
      ]);

      return {
        users: serialize(users),
        pmoDivisions: serialize(pmoDivisions),
        projectStatuses: serialize(projectStatuses),
        departments: serialize(departments),
      }
}


export async function createProject(data: unknown) {
    const actor = await requirePermission('projects:create');

    // Validated here, not just in the form. Server actions are HTTP endpoints,
    // so a rule that only runs in the browser is a suggestion.
    const parsed = createProjectSchema.safeParse(data);
    if (!parsed.success) {
        return { success: false, error: formatValidationError(parsed.error) };
    }
    const { milestones, responsibleDepartmentIds, hasCost, payments, hasMilestones, timelineChangeReason, ...projectData } = parsed.data;

    const newProject = await prisma.project.create({
        data: {
            // Fields are enumerated rather than spread from the request, so a
            // crafted payload cannot set columns the form never exposes.
            name: projectData.name,
            description: projectData.description,
            startDate: projectData.startDate,
            endDate: projectData.endDate,
            workingYear: projectData.workingYear,
            statusId: projectData.statusId,
            pmoDivisionId: projectData.pmoDivisionId,
            projectManagerId: projectData.projectManagerId,
            // Capture the original commitment at creation. Every schedule
            // metric is measured against this, so an approved extension moves
            // the plan without moving the yardstick.
            baselineStartDate: projectData.startDate,
            baselineEndDate: projectData.endDate,
            baselineSetAt: new Date(),
            totalCost: hasCost ? new Decimal(projectData.totalCost || 0) : null,
            currency: projectData.currency,
            responsibleDepartments: {
                connect: responsibleDepartmentIds.map((id: string) => ({ id }))
            },
            milestones: hasMilestones && milestones ? {
                create: milestones.map((m: any) => ({
                    title: m.title,
                    description: m.description,
                    startDate: m.startDate,
                    dueDate: m.dueDate,
                    weight: m.weight,
                }))
            } : undefined,
            payments: hasCost && payments ? {
                create: payments.map((p: any) => ({
                    title: p.title,
                    description: p.description,
                    amount: new Decimal(p.amount || 0),
                    paymentDate: p.paymentDate,
                    status: 'PENDING',
                }))
            } : undefined,
        },
        include: {
            milestones: true,
            payments: true,
        }
    });

    await auditAction(actor, {
        action: AUDIT_ACTIONS.PROJECT_CREATED,
        entity: 'Project',
        entityId: newProject.id,
        details: {
            name: newProject.name,
            startDate: newProject.startDate,
            endDate: newProject.endDate,
            statusId: newProject.statusId,
            pmoDivisionId: newProject.pmoDivisionId,
            projectManagerId: newProject.projectManagerId,
            totalCost: newProject.totalCost,
            milestoneCount: newProject.milestones.length,
            paymentCount: newProject.payments.length,
        },
    });

    revalidatePath('/dashboard');
    revalidatePath('/projects');
    revalidatePath('/gantt');
    revalidatePath('/payments');
    return { success: true, project: newProject };
}

export async function getProjectForEdit(projectId: string) {
    await requirePermission('projects:update');
    const [project, users, pmoDivisions, projectStatuses, departments] = await Promise.all([
        prisma.project.findUnique({
            where: { id: projectId },
            include: {
                milestones: {
                  include: {
                    tasks: true,
                  }
                },
                responsibleDepartments: {
                    select: { id: true }
                },
                payments: true,
            }
        }),
        prisma.user.findMany({ select: USER_WITH_ROLES_SELECT, orderBy: { name: 'asc' } }),
        prisma.pmoDivision.findMany({ orderBy: { name: 'asc' } }),
        prisma.projectStatus.findMany({ orderBy: { name: 'asc' } }),
        prisma.department.findMany({ orderBy: { name: 'asc' } }),
    ]);

    if (!project) return null;

    const userCreatedMilestones = project.milestones.filter(m => m.title !== GENERAL_TASKS_TITLE);
    
    // If there are no user-created milestones, ensure a "General Tasks" milestone exists with weight 100
    if (userCreatedMilestones.length === 0) {
        let generalMilestone = project.milestones.find(m => m.title === GENERAL_TASKS_TITLE);
        if (!generalMilestone) {
            generalMilestone = {
                id: `temp-${new Date().getTime()}`, // Temporary ID for the form
                projectId: project.id,
                title: GENERAL_TASKS_TITLE,
                description: 'A default collection of tasks for this project that are not assigned to a specific milestone.',
                startDate: project.startDate,
                dueDate: project.endDate,
                // This milestone has never been committed to — it is invented
                // here to hold loose tasks — so it has no baseline. Null says
                // that; copying the project's dates in would claim a
                // commitment that was never made.
                baselineStartDate: null,
                baselineDueDate: null,
                weight: 100,
                createdAt: new Date(),
                updatedAt: new Date(),
                tasks: [],
            };
            project.milestones.push(generalMilestone);
        } else if (generalMilestone.weight !== 100) {
            generalMilestone.weight = 100;
        }
    }


    const normalizedProject = {
        ...project,
        hasCost: project.totalCost !== null,
        hasMilestones: userCreatedMilestones.length > 0,
        responsibleDepartmentIds: project.responsibleDepartments.map(d => d.id),
    };

    return {
        project: serialize(normalizedProject),
        users: serialize(users),
        pmoDivisions: serialize(pmoDivisions),
        projectStatuses: serialize(projectStatuses),
        departments: serialize(departments),
    };
}


export async function updateProject(projectId: string, data: unknown) {
    await requirePermission('projects:update');

    const parsed = updateProjectSchema.safeParse(data);
    if (!parsed.success) {
        return { success: false, error: formatValidationError(parsed.error) };
    }
    const { milestones, responsibleDepartmentIds, hasCost, payments, timelineChangeReason, hasMilestones, ...projectData } = parsed.data;

    const existingProject = await prisma.project.findUnique({ where: { id: projectId } });
    if (!existingProject) {
        return { success: false, error: 'Project not found.' };
    }

    const endDateChanged = new Date(projectData.endDate).getTime() !== new Date(existingProject.endDate).getTime();

    if (endDateChanged && !timelineChangeReason?.trim()) {
        return { success: false, error: 'A reason for changing the project deadline is required.' };
    }
    // Narrowed for use inside the transaction closure, where the guard above is
    // no longer visible to the type checker.
    const changeReason = timelineChangeReason?.trim() ?? '';

    const existingMilestones = await prisma.milestone.findMany({
        where: { projectId: projectId },
        select: { id: true }
    });
    const existingMilestoneIds = existingMilestones.map(m => m.id);

    const incomingMilestoneIds = hasMilestones && milestones ? milestones.filter((m: any) => m.id).map((m: any) => m.id) : [];
    
    const existingPayments = await prisma.payment.findMany({
        where: { projectId: projectId },
        select: { id: true }
    });
    const existingPaymentIds = existingPayments.map(p => p.id);

    const incomingPaymentIds = payments ? payments.filter((p: any) => p.id).map((p: any) => p.id) : [];
    const paymentIdsToDelete = existingPaymentIds.filter((id: string) => !incomingPaymentIds.includes(id));

    try {
        // "Closing" is decided by the status's category, so a differently
        // named closed status still triggers the completion checks.
        const targetStatus = await prisma.projectStatus.findUnique({
            where: { id: projectData.statusId },
            select: { id: true, name: true, category: true }
        });
        const isCompletingProject = isClosedStatus(targetStatus);

        await prisma.$transaction(async (tx) => {
            // --- PAYMENT SYNC ---
            if (paymentIdsToDelete.length > 0) {
                await tx.payment.deleteMany({
                    where: { id: { in: paymentIdsToDelete } }
                });
            }
            
            // --- TIMELINE CHANGE REQUEST ---
            if (endDateChanged) {
                await tx.timelineChangeRequest.create({
                    data: {
                        projectId: projectId,
                        oldEndDate: existingProject.endDate,
                        newEndDate: projectData.endDate,
                        reason: changeReason,
                        requestedById: projectData.projectManagerId,
                        status: 'PENDING',
                    }
                });

                // Notify users with approval permissions
                const approvers = await tx.user.findMany({
                    where: { roles: { some: { permissions: { has: 'timeline:approve' } } } },
                    select: { id: true }
                });

                const message = `A timeline change has been requested for project "${existingProject.name}".`;
                const link = '/timeline-approvals';
                await notifyMany(
                    tx,
                    { message, link, senderId: projectData.projectManagerId },
                    approvers.map((a) => a.id),
                );
                revalidatePath('/notifications');
            }

            // --- PROJECT UPDATE ---
            await tx.project.update({
                where: { id: projectId },
                data: {
                  name: projectData.name,
                  description: projectData.description,
                  startDate: projectData.startDate,
                  endDate: endDateChanged ? existingProject.endDate : projectData.endDate,
                  // Backfill the baseline for projects created before it
                  // existed, using the dates they have now. Never overwrite an
                  // existing baseline — that is the whole point of it.
                  ...(existingProject.baselineEndDate
                    ? {}
                    : {
                        baselineStartDate: existingProject.startDate,
                        baselineEndDate: existingProject.endDate,
                        baselineSetAt: new Date(),
                      }),
                  statusId: projectData.statusId,
                  pmoDivisionId: projectData.pmoDivisionId,
                  projectManagerId: projectData.projectManagerId,
                  workingYear: projectData.workingYear,
                  currency: projectData.currency,
                  totalCost: hasCost ? new Decimal(projectData.totalCost || 0) : null,
                  responsibleDepartments: {
                    set: responsibleDepartmentIds.map((id: string) => ({ id }))
                  }
                }
            });

            if (hasMilestones && milestones) {
                 for (const milestone of milestones) {
                    const { id, ...milestoneData } = milestone;
                    
                    const dataForUpsert = {
                        title: milestoneData.title,
                        description: milestoneData.description,
                        startDate: milestoneData.startDate,
                        dueDate: milestoneData.dueDate,
                        weight: milestoneData.weight,
                    };

                    if (id && !id.startsWith('temp-')) {
                        await tx.milestone.update({
                            where: { id: id },
                            data: dataForUpsert
                        });
                    } else {
                        await tx.milestone.create({
                            data: {
                                ...dataForUpsert,
                                project: { connect: { id: projectId } },
                            }
                        });
                    }
                }
            } else if (!hasMilestones) {
                // If hasMilestones is false, delete user-created milestones, but preserve "General Tasks"
                const milestonesToDelete = await tx.milestone.findMany({
                    where: {
                        projectId,
                        title: { not: GENERAL_TASKS_TITLE }
                    },
                    select: { id: true },
                });
                const milestoneIdsToDelete = milestonesToDelete.map(m => m.id);

                if (milestoneIdsToDelete.length > 0) {
                    // Find all tasks related to these milestones
                    const tasksToDelete = await tx.task.findMany({
                        where: { milestoneId: { in: milestoneIdsToDelete } },
                        select: { id: true },
                    });
                    const taskIdsToDelete = tasksToDelete.map(t => t.id);

                    if (taskIdsToDelete.length > 0) {
                        // Delete task updates first
                        await tx.taskUpdate.deleteMany({
                            where: { taskId: { in: taskIdsToDelete } },
                        });
                        // Then delete tasks
                        await tx.task.deleteMany({
                            where: { id: { in: taskIdsToDelete } },
                        });
                    }
                    // Finally, delete the milestones
                    await tx.milestone.deleteMany({
                        where: { id: { in: milestoneIdsToDelete } },
                    });
                }
            }
            
            // --- PAYMENT UPSERT ---
            if (hasCost && payments) {
                for (const payment of payments) {
                    const { id, ...paymentData } = payment;
                    
                    const dataForPaymentUpsert = {
                        title: paymentData.title,
                        description: paymentData.description,
                        amount: new Decimal(paymentData.amount || 0),
                        paymentDate: paymentData.paymentDate,
                    };

                    if (id) {
                        await tx.payment.update({
                            where: { id: id },
                            data: dataForPaymentUpsert
                        });
                    } else {
                        await tx.payment.create({
                            data: {
                                ...dataForPaymentUpsert,
                                status: 'PENDING', // New payments default to pending
                                project: { connect: { id: projectId } },
                            }
                        });
                    }
                }
            } else if (!hasCost) { // if hasCost is false, delete all payments
                await tx.payment.deleteMany({
                    where: { projectId }
                });
            }


            // --- PROJECT COMPLETION ---
            //
            // Closing a project used to force every task to DONE / 100% with
            // today's date, overwriting the real completion dates. Because the
            // on-time metrics read completedAt, that corrupted the reporting at
            // exactly the moment a project finished — and marked work complete
            // that nobody had done.
            //
            // Closure now records what happened rather than rewriting it: the
            // transition is refused while work is outstanding, and the tasks
            // responsible are named so the user can finish or cancel them.
            if (isCompletingProject) {
                const outstanding = await tx.task.findMany({
                    where: {
                        milestone: { projectId },
                        NOT: { status: 'DONE' },
                    },
                    select: { id: true, title: true, status: true },
                    take: 20,
                });

                if (outstanding.length > 0) {
                    const names = outstanding.slice(0, 5).map(t => `"${t.title}"`).join(', ');
                    const more = outstanding.length > 5 ? ` and ${outstanding.length - 5} more` : '';
                    throw new ProjectCompletionBlocked(
                        `This project still has ${outstanding.length} unfinished task(s): ${names}${more}. ` +
                        `Complete or cancel them before closing the project.`,
                    );
                }
            }
        });

        revalidatePath('/projects');
        revalidatePath(`/projects/${projectId}`);
        revalidatePath(`/projects/${projectId}/edit`);
        revalidatePath('/dashboard');
        revalidatePath('/gantt');
        revalidatePath('/milestones');
        revalidatePath('/payments');
        revalidatePath('/timeline-approvals');
        return { success: true };
    } catch (e) {
        // A blocked closure is a business rule, not a fault: show the user why.
        if (e instanceof ProjectCompletionBlocked) {
            return { success: false, error: e.message };
        }
        console.error("Failed to update project", e);
        return { success: false, error: 'Failed to update project. Please ensure all data is correct.' };
    }
}


// ------------------------------------------------------------ issue register
//
// Blockers were a description and open/resolved. That records that something
// is wrong; it does not let anyone manage it. These actions add the parts that
// make it a register: who owns it, how serious it is, when it must clear, and
// what happened when it was escalated.

export async function addBlocker(projectId: string, input: CreateBlockerInput) {
    const actor = await requirePermission('projects:update');

    const parsed = createBlockerSchema.safeParse(input);
    if (!parsed.success) {
        return { success: false as const, error: formatValidationError(parsed.error) };
    }
    const data = parsed.data;

    const blocker = await prisma.blocker.create({
        data: {
            title: data.title,
            description: data.description,
            category: data.category,
            severity: data.severity,
            impact: data.impact || null,
            dueDate: data.dueDate ?? null,
            ownerId: data.ownerId || null,
            raisedById: actor.id,
            status: 'OPEN',
            projectId,
        },
    });

    await auditAction(actor, {
        action: AUDIT_ACTIONS.BLOCKER_RAISED,
        entity: 'Blocker',
        entityId: blocker.id,
        details: {
            projectId,
            title: blocker.title,
            severity: blocker.severity,
            category: blocker.category,
            ownerId: blocker.ownerId,
            dueDate: blocker.dueDate,
        },
    });

    // The owner did not choose to be given this, so tell them.
    if (blocker.ownerId) {
        await notifyMany(
            prisma,
            {
                message: `You were made owner of a ${blocker.severity.toLowerCase()} issue: "${blocker.title}".`,
                link: `/projects/${projectId}?tab=blockers`,
                senderId: actor.id,
            },
            [blocker.ownerId],
        );
    }

    revalidatePath(`/projects/${projectId}`);
    return { success: true as const, id: blocker.id };
}

export async function updateBlocker(blockerId: string, projectId: string, input: UpdateBlockerInput) {
    const actor = await requirePermission('projects:update');

    const parsed = updateBlockerSchema.safeParse(input);
    if (!parsed.success) {
        return { success: false as const, error: formatValidationError(parsed.error) };
    }
    const data = parsed.data;

    const existing = await prisma.blocker.findUnique({ where: { id: blockerId } });
    if (!existing) return { success: false as const, error: 'Issue not found.' };

    if (data.status && !canTransitionBlocker(existing.status, data.status)) {
        return {
            success: false as const,
            error: blockerTransitionError(existing.status, data.status),
        };
    }

    // Resolving is its own action, because it requires a resolution.
    if (data.status === 'RESOLVED') {
        return {
            success: false as const,
            error: 'Use the resolve action, which records how the issue was resolved.',
        };
    }

    const updated = await prisma.blocker.update({
        where: { id: blockerId },
        data: {
            title: data.title,
            description: data.description,
            category: data.category,
            severity: data.severity,
            impact: data.impact === '' ? null : data.impact,
            dueDate: data.dueDate ?? undefined,
            ownerId: data.ownerId === '' ? null : data.ownerId,
            status: data.status,
            // Reopening clears the resolution, so a stale one cannot sit on an
            // issue that is live again.
            ...(data.status === 'OPEN' && existing.status !== 'OPEN'
                ? { resolution: null, resolvedAt: null, resolvedById: null }
                : {}),
        },
    });

    await auditAction(actor, {
        action: AUDIT_ACTIONS.BLOCKER_UPDATED,
        entity: 'Blocker',
        entityId: blockerId,
        details: {
            projectId,
            changes: diffFields(existing, updated, [
                'title',
                'description',
                'category',
                'severity',
                'status',
                'ownerId',
                'dueDate',
                'impact',
            ]),
        },
    });

    if (updated.ownerId && updated.ownerId !== existing.ownerId) {
        await notifyMany(
            prisma,
            {
                message: `You were made owner of an issue: "${updated.title}".`,
                link: `/projects/${projectId}?tab=blockers`,
                senderId: actor.id,
            },
            [updated.ownerId],
        );
    }

    revalidatePath(`/projects/${projectId}`);
    return { success: true as const };
}

export async function escalateBlocker(blockerId: string, projectId: string, input: EscalateBlockerInput) {
    const actor = await requirePermission('projects:update');

    const parsed = escalateBlockerSchema.safeParse(input);
    if (!parsed.success) {
        return { success: false as const, error: formatValidationError(parsed.error) };
    }
    const { escalatedToId, escalationReason } = parsed.data;

    const existing = await prisma.blocker.findUnique({ where: { id: blockerId } });
    if (!existing) return { success: false as const, error: 'Issue not found.' };
    if (!canTransitionBlocker(existing.status, 'ESCALATED')) {
        return {
            success: false as const,
            error: blockerTransitionError(existing.status, 'ESCALATED'),
        };
    }

    const escalatedTo = await prisma.user.findUnique({
        where: { id: escalatedToId },
        select: { id: true, isActive: true },
    });
    if (!escalatedTo || !escalatedTo.isActive) {
        return { success: false as const, error: 'That person cannot receive escalations.' };
    }

    const updated = await prisma.blocker.update({
        where: { id: blockerId },
        data: {
            status: 'ESCALATED',
            escalatedToId,
            escalationReason,
            escalatedAt: new Date(),
        },
    });

    await auditAction(actor, {
        action: AUDIT_ACTIONS.BLOCKER_ESCALATED,
        entity: 'Blocker',
        entityId: blockerId,
        details: { projectId, title: updated.title, escalatedToId, escalationReason },
    });

    await notifyMany(
        prisma,
        {
            message: `A ${updated.severity.toLowerCase()} issue was escalated to you: "${updated.title}".`,
            link: `/projects/${projectId}?tab=blockers`,
            senderId: actor.id,
        },
        [escalatedToId, updated.ownerId].filter((id): id is string => Boolean(id)),
    );

    revalidatePath(`/projects/${projectId}`);
    return { success: true as const };
}

export async function resolveBlocker(blockerId: string, resolution: string, projectId: string) {
    const actor = await requirePermission('projects:update');

    const parsed = resolveBlockerSchema.safeParse({ resolution });
    if (!parsed.success) {
        return { success: false as const, error: formatValidationError(parsed.error) };
    }

    const existing = await prisma.blocker.findUnique({ where: { id: blockerId } });
    if (!existing) return { success: false as const, error: 'Issue not found.' };
    if (!canTransitionBlocker(existing.status, 'RESOLVED')) {
        return {
            success: false as const,
            error: blockerTransitionError(existing.status, 'RESOLVED'),
        };
    }

    await prisma.blocker.update({
        where: { id: blockerId },
        data: {
            status: 'RESOLVED',
            resolution: parsed.data.resolution,
            resolvedAt: new Date(),
            resolvedById: actor.id,
        },
    });

    await auditAction(actor, {
        action: AUDIT_ACTIONS.BLOCKER_RESOLVED,
        entity: 'Blocker',
        entityId: blockerId,
        details: { projectId, title: existing.title, resolution: parsed.data.resolution },
    });

    // Whoever raised it, and whoever it was escalated to, both need to know.
    await notifyMany(
        prisma,
        {
            message: `An issue was resolved: "${existing.title}".`,
            link: `/projects/${projectId}?tab=blockers`,
            senderId: actor.id,
        },
        [existing.raisedById, existing.escalatedToId, existing.ownerId].filter(
            (id): id is string => Boolean(id),
        ),
    );

    revalidatePath(`/projects/${projectId}`);
    return { success: true as const };
}

export async function deleteBlocker(blockerId: string, projectId: string) {
    const actor = await requirePermission('projects:update');

    const existing = await prisma.blocker.findUnique({ where: { id: blockerId } });
    if (!existing) return { success: false as const, error: 'Issue not found.' };

    await prisma.blocker.delete({ where: { id: blockerId } });

    await auditAction(actor, {
        action: AUDIT_ACTIONS.BLOCKER_DELETED,
        entity: 'Blocker',
        entityId: blockerId,
        details: {
            projectId,
            title: existing.title,
            severity: existing.severity,
            status: existing.status,
        },
    });

    revalidatePath(`/projects/${projectId}`);
    return { success: true as const };
}


export async function addMilestone(projectId: string, data: any) {
    await requirePermission('projects:update');
    const newMilestone = await prisma.milestone.create({
        data: {
            ...data,
            projectId,
        }
    });
    revalidatePath(`/projects`);
    revalidatePath(`/projects/${projectId}`);
    return { success: true, milestone: newMilestone };
}

export async function updateMilestone(milestoneId: string, projectId: string, data: any) {
    await requirePermission('projects:update');
    await prisma.milestone.update({
        where: { id: milestoneId },
        data
    });
    revalidatePath(`/projects`);
    revalidatePath(`/projects/${projectId}`);
}

export async function addTask(projectId: string, milestoneId: string | null | undefined, _authorId: string | undefined, data: any) {
    // The author is the session user, not whoever the browser named.
    const authorId = (await requirePermission('projects:update')).id;
    const { assignedUserIds, ...taskData } = data;
    let finalMilestoneId = milestoneId;
    
    // Project-level tasks are parked on the shared holding milestone, whose
    // weight the helper keeps consistent. The two call sites used to create it
    // themselves with different weights — 0 here and 100 in updateTask — so a
    // project's progress depended on which path had created it first.
    if (!finalMilestoneId || finalMilestoneId === 'project-level') {
        finalMilestoneId = await ensureGeneralTasksMilestone(prisma, projectId);
    }

    const newTask = await prisma.task.create({
        data: {
            ...taskData,
            status: 'TODO',
            milestoneId: finalMilestoneId,
            assignees: {
                connect: assignedUserIds.map((id:string) => ({ id }))
            }
        }
    });

    const message = `You have been assigned to a new task: "${newTask.title}"`;
    const link = `/tasks/${newTask.id}`;

    await notifyMany(prisma, { message, link, senderId: authorId }, assignedUserIds);

    revalidatePath(`/projects`);
    revalidatePath(`/projects/${projectId}`);
    revalidatePath('/my-tasks');
    revalidatePath('/notifications');
}

export async function updateTask(taskId: string, projectId: string, _authorId: string | undefined, data: any) {
    const authorId = (await requirePermission('projects:update')).id;
    const { assignedUserIds, milestoneId, ...taskData } = data;
    let finalMilestoneId = milestoneId;
    
    // Get original task to compare assignees
    const originalTask = await prisma.task.findUnique({
        where: { id: taskId },
        include: { assignees: { select: USER_DISPLAY_SELECT } }
    });
    const originalAssigneeIds = originalTask?.assignees.map(a => a.id) || [];

    // Handle the case where the task is moved to the project level (no milestone)
    if (finalMilestoneId === 'project-level') {
        const project = await prisma.project.findUnique({
            where: { id: projectId },
            include: { milestones: true }
        });
        if (!project) throw new Error("Project not found");
        
        finalMilestoneId = await ensureGeneralTasksMilestone(prisma, projectId);
    }

    const finalTaskData = { ...taskData };

    if (finalTaskData.status === 'DONE') {
        finalTaskData.progress = 100;
        finalTaskData.completedAt = new Date();
    } else if (finalTaskData.status === 'TODO') {
        finalTaskData.progress = 0;
        finalTaskData.completedAt = null;
    } else if (finalTaskData.status === 'IN_PROGRESS' && finalTaskData.progress === 100) {
        // If a user moves a task back to "In Progress" from "Done" or "Pending Review",
        // but the progress is still 100%, we might want to adjust it.
        // For now, let's assume the user will manage the progress slider separately.
        // Or we could reset it:
        // finalTaskData.progress = 95; // or some other value
    }
    
    // Prepare the update data
    const updateData: any = {
        ...finalTaskData,
        assignees: assignedUserIds ? {
            set: assignedUserIds.map((id:string) => ({ id }))
        } : undefined,
    };

    // Only update milestone if finalMilestoneId is defined
    if (finalMilestoneId) {
        updateData.milestone = {
            connect: { id: finalMilestoneId }
        };
    }
    
    const updatedTask = await prisma.task.update({
        where: { id: taskId },
        data: updateData
    });

    // Notify newly assigned users
    const newAssigneeIds = assignedUserIds.filter((id: string) => !originalAssigneeIds.includes(id));
    if (newAssigneeIds.length > 0) {
        const message = `You have been assigned to task: "${updatedTask.title}"`;
        const link = `/tasks/${updatedTask.id}`;
        await notifyMany(prisma, { message, link, senderId: authorId }, newAssigneeIds);
        revalidatePath('/notifications');
    }

    revalidatePath(`/projects`);
    revalidatePath(`/projects/${projectId}`);
}

export async function deleteTask(taskId: string, projectId: string) {
    await requirePermission('projects:update');
    try {
        await prisma.$transaction(async (tx) => {
            await tx.taskUpdate.deleteMany({
                where: { taskId: taskId }
            });
            await tx.task.delete({
                where: { id: taskId }
            });
        });
        
        revalidatePath(`/projects`);
        if (projectId) revalidatePath(`/projects/${projectId}`);
        revalidatePath('/my-tasks');
        revalidatePath('/dashboard');
        
        return { success: true };
    } catch (error) {
        console.error("Failed to delete task:", error);
        return { success: false, error: "Failed to delete task." };
    }
}

/** Identity comes from the session; `_userId` is ignored (see archive/actions.ts). */
export interface ProjectsPageFilters {
    status?: string | null;
    pmoDivisionId?: string | null;
    /** Matched against the project name and description, case-insensitively. */
    search?: string | null;
    /** 1-based. */
    page?: number | null;
    pageSize?: number | null;
    /** See PROJECT_LIST_ORDER. Anything unrecognised falls back to newest first. */
    sort?: string | null;
}

/**
 * How a paged project list may be ordered.
 *
 * Confined to what the database can order by, and deliberately so. Sorting by
 * risk or by progress would mean computing both for every project in the
 * portfolio and then paging the result — otherwise the sort applies to nine
 * rows that were themselves chosen by a different rule, and "most at risk"
 * silently means "most at risk out of an arbitrary nine". The Reports screen
 * offers those orderings instead, where the whole set is in hand.
 *
 * Not exported: this file carries 'use server', and such a module may only
 * export async functions. Exporting this table made every import of the module
 * fail at render — which is what took the whole Projects page down — and
 * TypeScript cannot see the rule, so `tsc` stayed clean. The client lists the
 * matching labels itself; the keys below are the contract between them.
 */
const PROJECT_LIST_ORDER: Record<string, Prisma.ProjectOrderByWithRelationInput> = {
    deadline: { endDate: 'asc' },
    'deadline-desc': { endDate: 'desc' },
    name: { name: 'asc' },
    recent: { updatedAt: 'desc' },
    created: { createdAt: 'desc' },
};


export async function getProjectsPageData(_userId: string | undefined, filters: ProjectsPageFilters) {
    const user = await requirePermission('projects:read');
    const userId = user.id;

    if (!user) {
        return {
            projects: [],
            statuses: [],
            users: [],
            pmoDivisions: [],
        };
    }
    
    const [statuses, users, pmoDivisions] = await Promise.all([
        prisma.projectStatus.findMany({ orderBy: { name: 'asc' } }),
        prisma.user.findMany({ select: USER_WITH_ROLES_SELECT }),
        prisma.pmoDivision.findMany({ orderBy: { name: 'asc' } }),
    ]);
    
    const archivedStatusIds = statuses.filter(s => isArchivedStatus(s)).map(s => s.id);

    // Check if user has admin-level permissions (can see all projects)
    // One explicit permission, checked in one place. See canSeeAllProjects().
    const hasAdminPermissions = canSeeAllProjects(user);

    // Composed with AND so a status filter cannot cancel the archive
    // exclusion. Spreading `statusId` a second time overwrote the `notIn`
    // clause entirely, which let archived projects surface in the active list.
    let whereClause: Prisma.ProjectWhereInput = {
        AND: [
            { statusId: { notIn: archivedStatusIds } },
            ...(filters.status ? [{ statusId: filters.status }] : []),
            ...(filters.pmoDivisionId ? [{ pmoDivisionId: filters.pmoDivisionId }] : []),
            // Searching in the database rather than filtering an array the
            // browser already holds: the point of paging is not to send the
            // rest in the first place.
            ...(filters.search?.trim()
                ? [
                      {
                          OR: [
                              { name: { contains: filters.search.trim(), mode: 'insensitive' as const } },
                              // Also the description: people search for what a
                              // project is about at least as often as for the
                              // words somebody happened to name it with.
                              {
                                  description: {
                                      contains: filters.search.trim(),
                                      mode: 'insensitive' as const,
                                  },
                              },
                          ],
                      },
                  ]
                : []),
        ],
    };

    if (!hasAdminPermissions) {
        whereClause.OR = projectVisibilityClauses(userId);
    }
    
    // Count and page in one round trip. Previously the whole result set was
    // loaded — every project with its milestones, tasks, assignees, teams and
    // blockers — and the browser then showed nine of them.
    const totalCount = await prisma.project.count({ where: whereClause });
    const { page, pageSize, skip, totalPages } = resolvePage(filters, totalCount);

    const projects = await prisma.project.findMany({
        where: whereClause,
        include: {
            status: true,
            milestones: {
                include: {
                    tasks: {
                        include: {
                            assignees: { select: USER_DISPLAY_SELECT },
                        }
                    }
                }
            },
            timelineChangeRequests: {
                where: {
                    status: 'PENDING'
                }
            },
            teamLinks: {
                include: {
                    team: {
                        include: {
                            members: { select: USER_DISPLAY_SELECT },
                            teamLead: { select: USER_DISPLAY_SELECT },
                            // Every project this team serves, so editing it
                            // from one project cannot silently drop the rest.
                            projects: { select: { projectId: true } },
                        },
                    },
                }
            },
            blockers: {
                where: {
                    status: { in: [...OPEN_BLOCKER_STATUSES] }
                }
            }
        },
        // Ordered in the database, so the sort and the paging agree. Sorting
        // the nine rows a page happened to contain would order an arbitrary
        // slice and present it as an ordering of the whole list.
        orderBy: PROJECT_LIST_ORDER[filters.sort ?? ''] ?? PROJECT_LIST_ORDER.created,
        skip,
        take: pageSize,
    });

    // Flattened here rather than in every component that reads it. Teams
    // reach a project through ProjectTeam now, and asking each card to walk
    // project.teamLinks[].team is both noisy and easy to miss — which is what
    // happened: the cards kept reading project.teams and silently showed none.
    const projectsWithTeams = projects.map((project) => ({
        ...project,
        teams: project.teamLinks.map((link) => ({
            ...link.team,
            projectIds: link.team.projects.map((p) => p.projectId),
        })),
    }));

    return {
        projects: serialize(projectsWithTeams),
        statuses: serialize(statuses.filter(s => !isArchivedStatus(s))),
        users: serialize(users),
        pmoDivisions: serialize(pmoDivisions),
        // The client needs the total to draw the pager; it no longer holds the
        // rows to count them itself.
        page,
        pageSize,
        totalCount,
        totalPages: Math.max(1, Math.ceil(totalCount / pageSize)),
    };
}


/** Identity comes from the session; `_userId` is ignored (see archive/actions.ts). */
export async function getProjectDetailsForUser(projectId: string, _userId?: string) {
    const user = await requirePermission('projects:read');
    const userId = user.id;

    if (!user) {
        return null; // User not found
    }

    const project = await prisma.project.findUnique({
        where: { id: projectId },
        include: {
            status: true,
            pmoDivision: true,
            projectManager: { select: USER_DISPLAY_SELECT },
            responsibleDepartments: true,
            blockers: {
                include: {
                    owner: { select: { id: true, name: true } },
                    raisedBy: { select: { id: true, name: true } },
                    escalatedTo: { select: { id: true, name: true } },
                },
                orderBy: { createdAt: 'desc' },
            },
            milestones: {
                include: {
                    tasks: {
                        include: {
                            assignees: { select: USER_DISPLAY_SELECT },
                            updates: true,
                            // Which work waits on which, for the schedule view's
                            // dependency arrows and its critical path.
                            dependsOn: { select: { predecessorId: true, type: true, lagDays: true } },
                        }
                    },
                }
            },
            // The budget tab: what was scheduled, what has been released.
            payments: { orderBy: { paymentDate: 'asc' } },
            // The team tab. Reached through ProjectTeam since a team may serve
            // several projects.
            teamLinks: {
                include: {
                    team: {
                        include: {
                            teamLead: { select: USER_DISPLAY_SELECT },
                            members: { select: USER_DISPLAY_SELECT },
                        },
                    },
                },
            },
            timelineChangeRequests: {
                include: {
                    requestedBy: { select: USER_DISPLAY_SELECT },
                    reviewedBy: { select: USER_DISPLAY_SELECT },
                },
                orderBy: {
                    createdAt: 'desc'
                }
            }
        }
    });

    if (!project) {
        return null; // Project not found
    }

    // Check if user has admin-level permissions (can see all projects)
    // One explicit permission, checked in one place. See canSeeAllProjects().
    const hasAdminPermissions = canSeeAllProjects(user);
    
    if (hasAdminPermissions) {
        return serialize(project);
    }

    // If not admin/manager, check for involvement
    const userInvolvement = await prisma.project.findFirst({
        where: {
            id: projectId,
            OR: projectVisibilityClauses(userId)
        }
    });

    if (!userInvolvement) {
        return null; // User is not involved in this project
    }

    return serialize(project);
}

/**
 * Who can be given an issue to own, or have one escalated to them.
 *
 * A separate call rather than more fields on the project payload: the list is
 * the same for every project and is only needed when a dialog opens, so
 * attaching it to the detail query would mean loading it on every page view.
 */
export async function getBlockerOwnerOptions() {
    await requirePermission('projects:read');
    const users = await prisma.user.findMany({
        where: { isActive: true },
        select: { id: true, name: true },
        orderBy: { name: 'asc' },
    });
    return serialize(users);
}

/**
 * The session decides who is asking; the project-level access check below then
 * decides whether they may see this particular project.
 */
export async function getProjectMilestonesForUser(projectId: string, _userId?: string) {
    const user = await requirePermission('projects:read');
    const userId = user.id;

    if (!user) return null;

    // Check if user has admin-level permissions (can see all projects)
    // One explicit permission, checked in one place. See canSeeAllProjects().
    const hasAdminPermissions = canSeeAllProjects(user);
    
    let whereClause: Prisma.ProjectWhereUniqueInput = { id: projectId };
    
    if (!hasAdminPermissions) {
        const projectAccess = await prisma.project.findFirst({
            where: {
                id: projectId,
                OR: projectVisibilityClauses(userId)
            },
            select: { id: true }
        });

        if (!projectAccess) return null; // No access
    }
    
    // If access is confirmed, fetch the required data
    const project = await prisma.project.findUnique({
        where: whereClause,
        include: {
            milestones: {
                orderBy: {
                    createdAt: 'desc'
                },
                include: {
                    tasks: {
                        orderBy: { createdAt: 'desc' },
                        include: {
                            assignees: { select: USER_DISPLAY_SELECT },
                        }
                    }
                }
            },
        }
    });

    if (!project) return null;

    const [users, departments] = await Promise.all([
        prisma.user.findMany({ select: USER_WITH_ROLES_SELECT }),
        prisma.department.findMany()
    ]);

    return {
        project: serialize(project),
        users: serialize(users),
        departments: serialize(departments)
    };
}


export async function deleteProject(projectId: string) {
    const actor = await requirePermission('projects:delete');
    const doomed = await prisma.project.findUnique({
        where: { id: projectId },
        select: { name: true, statusId: true, projectManagerId: true, workingYear: true },
    });
    try {
        await prisma.$transaction(async (tx) => {
            const milestones = await tx.milestone.findMany({
                where: { projectId },
                select: { id: true }
            });
            const milestoneIds = milestones.map(m => m.id);

            if (milestoneIds.length > 0) {
                 const tasks = await tx.task.findMany({
                    where: { milestoneId: { in: milestoneIds } },
                    select: { id: true }
                });
                const taskIds = tasks.map(t => t.id);
                
                if (taskIds.length > 0) {
                    // Delete task updates
                    await tx.taskUpdate.deleteMany({
                        where: { taskId: { in: taskIds } }
                    });
                     // Delete tasks
                    await tx.task.deleteMany({
                        where: { id: { in: taskIds } }
                    });
                }
                // Delete milestones
                await tx.milestone.deleteMany({
                    where: { id: { in: milestoneIds } }
                });
            }

            // Delete blockers
            await tx.blocker.deleteMany({
                where: { projectId: projectId }
            });

            // Unlink the teams. They are standing teams now, so deleting a
            // project must not delete the people who worked on it — which is
            // what the old `team.deleteMany({ where: { projectId } })` did.
            await tx.projectTeam.deleteMany({
                where: { projectId: projectId }
            });
            await tx.projectAssignment.deleteMany({
                where: { projectId: projectId }
            });
            
            // Delete payments
            await tx.payment.deleteMany({
                where: { projectId: projectId }
            });
            
            // Delete timeline change requests
            await tx.timelineChangeRequest.deleteMany({
                where: { projectId: projectId }
            });
            
            // Finally, delete the project itself
            await tx.project.delete({
                where: { id: projectId }
            });
        });

        await auditAction(actor, {
            action: AUDIT_ACTIONS.PROJECT_DELETED,
            entity: 'Project',
            entityId: projectId,
            details: doomed ?? { note: 'project row already gone' },
        });

        revalidatePath('/projects');
        revalidatePath('/dashboard');
        revalidatePath('/gantt');
        revalidatePath('/milestones');
        return { success: true };
    } catch (error) {
        console.error("Failed to delete project:", error);
        return { success: false, error: "Failed to delete project. Please ensure all related items are handled." };
    }
}
