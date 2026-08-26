import { NextResponse, type NextRequest } from 'next/server';
import { Readable } from 'stream';

import prisma from '@/lib/db';
import { getCurrentUser } from '@/lib/auth/session';
import { userHasPermission } from '@/lib/auth/access';
import { userCanAccessProject } from '@/lib/documents/access';
import { localStorage } from '@/lib/documents/storage';
import { contentDisposition } from '@/lib/documents/validation';
import { recordDocumentDownload } from '@/app/projects/document-actions';
import { clientAddress, userAgent } from '@/lib/request-context';

/**
 * Serving a stored document.
 *
 * This route exists precisely so that files are *not* static assets. Anything
 * under `public/` is served without an authorization check, which for a
 * contract or a signed minute is unacceptable — so uploads live outside the web
 * root and come back only through here, after the session and the project's own
 * access rule have both been checked.
 *
 * Node runtime: the file is streamed from disk.
 */
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ versionId: string }> },
) {
  const { versionId } = await params;

  const user = await getCurrentUser();
  if (!user) {
    return new NextResponse('Not signed in', { status: 401 });
  }
  if (!userHasPermission(user, 'projects:read')) {
    return new NextResponse('Forbidden', { status: 403 });
  }

  const version = await prisma.documentVersion.findUnique({
    where: { id: versionId },
    include: {
      document: { select: { id: true, projectId: true, deletedAt: true, title: true } },
    },
  });

  // One response for "no such document" and for "not yours", so the endpoint
  // cannot be used to discover which document ids exist.
  const notFound = () => new NextResponse('Not found', { status: 404 });

  if (!version || version.document.deletedAt) return notFound();
  if (!(await userCanAccessProject(user, version.document.projectId))) return notFound();
  if (!(await localStorage.exists(version.storageKey))) return notFound();

  await recordDocumentDownload({
    actorId: user.id,
    actorName: user.name,
    versionId: version.id,
    documentId: version.document.id,
    projectId: version.document.projectId,
    fileName: version.fileName,
    ipAddress: clientAddress(request.headers),
    userAgent: userAgent(request.headers),
  });

  const stream = Readable.toWeb(
    localStorage.createReadStream(version.storageKey) as Readable,
  ) as ReadableStream;

  return new NextResponse(stream, {
    headers: {
      // The type resolved from the file's own bytes at upload, never the one
      // the uploader claimed.
      'Content-Type': version.contentType,
      'Content-Length': String(version.sizeBytes),
      // Always an attachment. Rendering a user-supplied file inline is how a
      // stored cross-site scripting hole gets built.
      'Content-Disposition': contentDisposition(version.fileName),
      'X-Content-Type-Options': 'nosniff',
      // A document is per-user by definition; no shared cache should hold it.
      'Cache-Control': 'private, no-store',
      'Content-Security-Policy': "default-src 'none'; sandbox",
    },
  });
}
