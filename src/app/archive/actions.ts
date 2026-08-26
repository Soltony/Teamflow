
'use server';

import prisma from "@/lib/db";
import type { Prisma } from '@prisma/client';
import { requirePermission, canSeeAllProjects } from "@/lib/auth/guard";
import { isArchivedStatus } from "@/lib/metrics";
import { resolvePage, type PageRequest } from "@/lib/pagination";
import { serialize } from '@/lib/serialize';
import { projectVisibilityClauses } from '@/lib/queries/project-visibility';

/**
 * The acting user is resolved from the session. The `_userId` parameter is
 * ignored — it used to be supplied by the browser, which meant anyone could
 * read another user's projects by passing their id. Call sites still pass it,
 * so the signature is kept.
 */
export interface ArchiveFilters extends PageRequest {
    /** Matched against the project name, case-insensitively. */
    search?: string | null;
    /** Restrict to one archived status; otherwise all archived statuses. */
    status?: string | null;
}

export async function getArchivedProjects(_userId?: string, filters: ArchiveFilters = {}) {
    const user = await requirePermission('projects:read');
    const userId = user.id;

    if (!user) {
        return {
            projects: [],
            statuses: []
        };
    }

    const statuses = await prisma.projectStatus.findMany({
        orderBy: {
            name: 'asc'
        }
    });

    // Category, not name: statuses are renameable, categories are not.
    const archivedStatusIds = statuses.filter(s => isArchivedStatus(s)).map(s => s.id);

    // Check if user has admin-level permissions (can see all projects)
    // One explicit permission, checked in one place. See canSeeAllProjects().
    const hasAdminPermissions = canSeeAllProjects(user);

    let whereClause: Prisma.ProjectWhereInput = {
        statusId: {
            in: archivedStatusIds,
        }
    };

    if (!hasAdminPermissions) {
        whereClause.OR = projectVisibilityClauses(userId);
    }

    // Searching and status filtering happen in the database, not over rows the
    // browser already holds.
    const scoped: Prisma.ProjectWhereInput = {
        AND: [
            whereClause,
            ...(filters.status ? [{ statusId: filters.status }] : []),
            ...(filters.search?.trim()
                ? [{ name: { contains: filters.search.trim(), mode: 'insensitive' as const } }]
                : []),
        ],
    };

    const totalCount = await prisma.project.count({ where: scoped });
    const { page, pageSize, skip, totalPages } = resolvePage(filters, totalCount);

    const projects = await prisma.project.findMany({
        where: scoped,
        skip,
        take: pageSize,
        include: {
            status: true,
            milestones: {
                include: {
                    tasks: true,
                },
            },
        },
        orderBy: {
            endDate: 'desc'
        }
    });

    return {
        projects: serialize(projects),
        statuses: serialize(statuses.filter(s => isArchivedStatus(s))),
        page,
        pageSize,
        totalCount,
        totalPages,
    };
}

    