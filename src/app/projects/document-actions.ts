'use server';

import { revalidatePath } from 'next/cache';
import type { DocumentCategory } from '@prisma/client';

import prisma from '@/lib/db';
import { getNumber } from '@/lib/settings';
import { requirePermission, canSeeAllProjects } from '@/lib/auth/guard';
import { auditAction } from '@/lib/auth/audit-context';
import { createAuditLog } from '@/lib/audit-log';
import { consumeRateLimit } from '@/lib/rate-limit';
import { localStorage, scanForMalware } from '@/lib/documents/storage';
import { MAX_FILE_BYTES, validateUpload } from '@/lib/documents/validation';
import { userCanAccessProject } from '@/lib/documents/access';
import { serialize } from '@/lib/serialize';

/**
 * Project documents.
 *
 * Access is inherited from the project: whoever may read a project may read its
 * documents, and nobody else. That check happens on every action here and again
 * in the download route, because a document URL is exactly the kind of thing
 * that gets forwarded.
 */

type Result<T extends object = Record<never, never>> =
  | ({ success: true } & T)
  | { success: false; error: string };

const AUDIT = {
  UPLOADED: 'DOCUMENT_UPLOADED',
  VERSION_ADDED: 'DOCUMENT_VERSION_ADDED',
  DELETED: 'DOCUMENT_DELETED',
  DOWNLOADED: 'DOCUMENT_DOWNLOADED',
} as const;

/** Lists a project's documents with their latest version. */
export async function getProjectDocuments(projectId: string) {
  const user = await requirePermission('projects:read');

  if (!(await userCanAccessProject(user, projectId))) {
    return { success: false as const, error: 'You do not have access to this project.' };
  }

  const documents = await prisma.document.findMany({
    where: { projectId, deletedAt: null },
    include: {
      uploadedBy: { select: { id: true, name: true } },
      versions: {
        orderBy: { versionNumber: 'desc' },
        include: { uploadedBy: { select: { id: true, name: true } } },
      },
    },
    orderBy: [{ category: 'asc' }, { createdAt: 'desc' }],
  });

  return { success: true as const, documents: serialize(documents) };
}

export interface UploadInput {
  projectId: string;
  title: string;
  description?: string;
  category: DocumentCategory;
  /** Adds a version to an existing document instead of creating a new one. */
  documentId?: string;
  notes?: string;
}

/**
 * Stores an uploaded file against a project.
 *
 * Takes a FormData because the file has to arrive as binary; everything else
 * is read from named fields rather than spread, so a crafted request cannot
 * set columns the form never exposes.
 */
export async function uploadProjectDocument(formData: FormData): Promise<Result<{ documentId: string }>> {
  const user = await requirePermission('projects:update');

  // Uploads are expensive and write to disk, so they get their own window.
  const limit = consumeRateLimit('credentialIssue', `upload:${user.id}`);
  if (!limit.ok) {
    return {
      success: false,
      error: `Too many uploads. Try again in ${Math.ceil(limit.retryAfterSeconds / 60)} minute(s).`,
    };
  }

  const projectId = String(formData.get('projectId') ?? '');
  const title = String(formData.get('title') ?? '').trim();
  const description = String(formData.get('description') ?? '').trim();
  const category = String(formData.get('category') ?? 'OTHER') as DocumentCategory;
  const documentId = String(formData.get('documentId') ?? '') || undefined;
  const notes = String(formData.get('notes') ?? '').trim();
  const file = formData.get('file');

  if (!projectId) return { success: false, error: 'No project was specified.' };
  if (!(file instanceof File)) return { success: false, error: 'No file was attached.' };
  if (!documentId && !title) return { success: false, error: 'Give the document a title.' };

  if (!(await userCanAccessProject(user, projectId))) {
    return { success: false, error: 'You do not have access to this project.' };
  }

  // Read the size before the bytes, so an oversized upload is refused without
  // being buffered in full.
  const maxBytes = (await getNumber('documents.maxUploadMb')) * 1024 * 1024;
  if (file.size > maxBytes) {
    return {
      success: false,
      error: `Files must be ${Math.round(maxBytes / (1024 * 1024))} MB or smaller.`,
    };
  }

  const data = Buffer.from(await file.arrayBuffer());

  const validation = validateUpload({
    maxBytes,
    fileName: file.name,
    sizeBytes: data.byteLength,
    declaredType: file.type,
    head: new Uint8Array(data.subarray(0, 512)),
  });
  if (!validation.ok) return { success: false, error: validation.error };

  const scan = await scanForMalware(data);
  if (!scan.clean) {
    return { success: false, error: scan.reason ?? 'The file was rejected by malware scanning.' };
  }

  const stored = await localStorage.save(data);

  try {
    const result = await prisma.$transaction(async (tx) => {
      const document = documentId
        ? await tx.document.findFirst({ where: { id: documentId, projectId, deletedAt: null } })
        : await tx.document.create({
            data: {
              projectId,
              title,
              description: description || null,
              category,
              uploadedById: user.id,
            },
          });

      if (!document) throw new Error('DOCUMENT_NOT_FOUND');

      const latest = await tx.documentVersion.findFirst({
        where: { documentId: document.id },
        orderBy: { versionNumber: 'desc' },
        select: { versionNumber: true },
      });

      await tx.documentVersion.create({
        data: {
          documentId: document.id,
          versionNumber: (latest?.versionNumber ?? 0) + 1,
          fileName: validation.fileName,
          contentType: validation.contentType,
          sizeBytes: stored.sizeBytes,
          storageKey: stored.storageKey,
          checksum: stored.checksum,
          uploadedById: user.id,
          notes: notes || null,
        },
      });

      return { documentId: document.id, isNew: !documentId };
    });

    await auditAction(user, {
      action: result.isNew ? AUDIT.UPLOADED : AUDIT.VERSION_ADDED,
      entity: 'Document',
      entityId: result.documentId,
      details: {
        projectId,
        title: title || undefined,
        category,
        fileName: validation.fileName,
        contentType: validation.contentType,
        sizeBytes: stored.sizeBytes,
        checksum: stored.checksum,
      },
    });

    revalidatePath(`/projects/${projectId}`);
    return { success: true, documentId: result.documentId };
  } catch (error) {
    // The row did not land, so the bytes on disk are orphaned. Remove them
    // rather than leaving a file nothing points at.
    await localStorage.delete(stored.storageKey).catch(() => undefined);

    if (error instanceof Error && error.message === 'DOCUMENT_NOT_FOUND') {
      return { success: false, error: 'That document no longer exists.' };
    }
    console.error('Failed to store document:', error);
    return { success: false, error: 'The file could not be saved.' };
  }
}

/**
 * Removes a document from the project.
 *
 * Soft delete: the row and its versions stay, so the audit trail still shows
 * that the document existed and who removed it. The bytes are kept too — a
 * contract deleted by mistake is worse than a little disk.
 */
export async function deleteProjectDocument(documentId: string, reason?: string): Promise<Result> {
  const user = await requirePermission('projects:update');

  const document = await prisma.document.findUnique({
    where: { id: documentId },
    select: { id: true, projectId: true, title: true, deletedAt: true },
  });
  if (!document || document.deletedAt) {
    return { success: false, error: 'Document not found.' };
  }
  if (!(await userCanAccessProject(user, document.projectId))) {
    return { success: false, error: 'You do not have access to this project.' };
  }

  await prisma.document.update({
    where: { id: documentId },
    data: { deletedAt: new Date(), deletedById: user.id },
  });

  await auditAction(user, {
    action: AUDIT.DELETED,
    entity: 'Document',
    entityId: documentId,
    details: { projectId: document.projectId, title: document.title, reason },
  });

  revalidatePath(`/projects/${document.projectId}`);
  return { success: true };
}

/**
 * Records that a document was downloaded.
 *
 * Called from the download route. Who read a contract is exactly the sort of
 * thing an internal audit asks about, and it cannot be reconstructed later.
 */
export async function recordDocumentDownload(input: {
  actorId: string;
  actorName: string | null;
  versionId: string;
  documentId: string;
  projectId: string;
  fileName: string;
  ipAddress: string | null;
  userAgent: string | null;
}): Promise<void> {
  await createAuditLog({
    actorId: input.actorId,
    actorName: input.actorName,
    action: AUDIT.DOWNLOADED,
    entity: 'DocumentVersion',
    entityId: input.versionId,
    details: {
      documentId: input.documentId,
      projectId: input.projectId,
      fileName: input.fileName,
    },
    ipAddress: input.ipAddress,
    userAgent: input.userAgent,
  });
}
