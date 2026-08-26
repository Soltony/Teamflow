'use client';

import { useCallback, useEffect, useRef, useState, useTransition } from 'react';
import { Download, FileText, Loader2, Trash2, Upload } from 'lucide-react';
import { format } from 'date-fns';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/context/auth-context';
import {
  deleteProjectDocument,
  getProjectDocuments,
  uploadProjectDocument,
} from '@/app/projects/document-actions';
import { ACCEPT_ATTRIBUTE, MAX_FILE_BYTES } from '@/lib/documents/validation';

const CATEGORIES = [
  { value: 'CHARTER', label: 'Charter' },
  { value: 'BUSINESS_CASE', label: 'Business case' },
  { value: 'CONTRACT', label: 'Contract' },
  { value: 'SPECIFICATION', label: 'Specification' },
  { value: 'MINUTES', label: 'Minutes' },
  { value: 'REPORT', label: 'Report' },
  { value: 'SIGN_OFF', label: 'Sign-off' },
  { value: 'OTHER', label: 'Other' },
] as const;

const categoryLabel = (value: string) =>
  CATEGORIES.find((c) => c.value === value)?.label ?? 'Other';

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

interface DocumentVersion {
  id: string;
  versionNumber: number;
  fileName: string;
  sizeBytes: number;
  uploadedAt: string;
  notes: string | null;
  uploadedBy: { id: string; name: string };
}

interface ProjectDocument {
  id: string;
  title: string;
  description: string | null;
  category: string;
  createdAt: string;
  uploadedBy: { id: string; name: string };
  versions: DocumentVersion[];
}

export function ProjectDocuments({ projectId }: { projectId: string }) {
  const { hasPermission } = useAuth();
  const { toast } = useToast();
  const [isPending, startTransition] = useTransition();

  const [documents, setDocuments] = useState<ProjectDocument[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [addVersionTo, setAddVersionTo] = useState<ProjectDocument | null>(null);
  const [toDelete, setToDelete] = useState<ProjectDocument | null>(null);
  const [error, setError] = useState<string | null>(null);
  const formRef = useRef<HTMLFormElement>(null);

  const canEdit = hasPermission('projects:update');

  const load = useCallback(async () => {
    setIsLoading(true);
    const result = await getProjectDocuments(projectId);
    if (result.success) setDocuments(result.documents);
    setIsLoading(false);
  }, [projectId]);

  useEffect(() => {
    void load();
  }, [load]);

  const submit = (formData: FormData) => {
    setError(null);
    startTransition(async () => {
      const result = await uploadProjectDocument(formData);
      if (result.success) {
        toast({ title: 'Document uploaded' });
        setUploadOpen(false);
        setAddVersionTo(null);
        formRef.current?.reset();
        await load();
      } else {
        setError(result.error);
      }
    });
  };

  const confirmDelete = () => {
    if (!toDelete) return;
    startTransition(async () => {
      const result = await deleteProjectDocument(toDelete.id);
      if (result.success) {
        toast({ title: 'Document removed', description: 'It stays in the audit trail.' });
        await load();
      } else {
        toast({ title: 'Could not remove', description: result.error, variant: 'destructive' });
      }
      setToDelete(null);
    });
  };

  const uploadDialog = (
    <Dialog
      open={uploadOpen || addVersionTo !== null}
      onOpenChange={(open) => {
        if (!open) {
          setUploadOpen(false);
          setAddVersionTo(null);
          setError(null);
        }
      }}
    >
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {addVersionTo ? `New version of “${addVersionTo.title}”` : 'Upload a document'}
          </DialogTitle>
          <DialogDescription>
            {addVersionTo
              ? 'The previous version is kept, so the history of this document stays intact.'
              : `Up to ${Math.round(MAX_FILE_BYTES / (1024 * 1024))} MB. PDF, Word, Excel, PowerPoint, images, text and CSV.`}
          </DialogDescription>
        </DialogHeader>

        <form ref={formRef} action={submit} className="space-y-4">
          <input type="hidden" name="projectId" value={projectId} />
          {addVersionTo && <input type="hidden" name="documentId" value={addVersionTo.id} />}

          {!addVersionTo && (
            <>
              <div className="space-y-1.5">
                <Label htmlFor="doc-title">Title</Label>
                <Input id="doc-title" name="title" required maxLength={200} disabled={isPending} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="doc-category">Category</Label>
                <Select name="category" defaultValue="OTHER">
                  <SelectTrigger id="doc-category">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map((c) => (
                      <SelectItem key={c.value} value={c.value}>
                        {c.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="doc-description">Description (optional)</Label>
                <Textarea id="doc-description" name="description" rows={2} disabled={isPending} />
              </div>
            </>
          )}

          {addVersionTo && (
            <div className="space-y-1.5">
              <Label htmlFor="doc-notes">What changed? (optional)</Label>
              <Input id="doc-notes" name="notes" maxLength={200} disabled={isPending} />
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="doc-file">File</Label>
            <Input
              id="doc-file"
              name="file"
              type="file"
              required
              accept={ACCEPT_ATTRIBUTE}
              disabled={isPending}
            />
          </div>

          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <DialogFooter>
            <Button type="submit" disabled={isPending}>
              {isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Uploading…
                </>
              ) : (
                <>
                  <Upload className="mr-2 h-4 w-4" /> Upload
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-4">
        <div>
          <CardTitle>Documents</CardTitle>
          <CardDescription>
            Charters, contracts, specifications, minutes and sign-offs for this project.
          </CardDescription>
        </div>
        {canEdit && (
          <Button onClick={() => setUploadOpen(true)}>
            <Upload className="mr-2 h-4 w-4" /> Upload
          </Button>
        )}
      </CardHeader>

      <CardContent>
        {isLoading ? (
          <p className="py-8 text-center text-sm text-muted-foreground">Loading documents…</p>
        ) : documents.length === 0 ? (
          <div className="rounded-md border-2 border-dashed py-12 text-center">
            <FileText className="mx-auto h-8 w-8 text-muted-foreground/50" />
            <p className="mt-3 text-sm text-muted-foreground">
              No documents yet.
              {canEdit && ' Upload the charter, contract or minutes to keep the project record complete.'}
            </p>
          </div>
        ) : (
          <Accordion type="multiple" className="space-y-2">
            {documents.map((doc) => {
              const latest = doc.versions[0];
              return (
                <AccordionItem key={doc.id} value={doc.id} className="rounded-md border px-4">
                  <AccordionTrigger className="hover:no-underline">
                    <div className="flex w-full flex-col gap-2 pr-4 text-left md:flex-row md:items-center md:justify-between">
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-medium">{doc.title}</p>
                        <p className="text-xs text-muted-foreground">
                          {latest?.fileName} · {latest ? formatSize(latest.sizeBytes) : '—'} ·
                          {' '}v{latest?.versionNumber ?? 1}
                        </p>
                      </div>
                      <Badge variant="secondary" className="w-fit shrink-0">
                        {categoryLabel(doc.category)}
                      </Badge>
                    </div>
                  </AccordionTrigger>

                  <AccordionContent className="space-y-3 pb-4">
                    {doc.description && (
                      <p className="text-sm text-muted-foreground">{doc.description}</p>
                    )}

                    <div className="space-y-1.5">
                      {doc.versions.map((version) => (
                        <div
                          key={version.id}
                          className="flex flex-wrap items-center justify-between gap-2 rounded border bg-muted/40 px-3 py-2 text-sm"
                        >
                          <div className="min-w-0">
                            <span className="font-medium">v{version.versionNumber}</span>
                            <span className="text-muted-foreground">
                              {' '}· {version.uploadedBy.name} ·{' '}
                              {format(new Date(version.uploadedAt), 'd MMM yyyy')}
                              {version.notes ? ` · ${version.notes}` : ''}
                            </span>
                          </div>
                          <Button asChild variant="outline" size="sm">
                            {/*
                              A normal link, not a blob: the file is fetched
                              through an authenticated route that re-checks
                              project access on every request.
                            */}
                            <a href={`/api/documents/${version.id}`} download>
                              <Download className="mr-2 h-3.5 w-3.5" /> Download
                            </a>
                          </Button>
                        </div>
                      ))}
                    </div>

                    {canEdit && (
                      <div className="flex gap-2 pt-1">
                        <Button variant="outline" size="sm" onClick={() => setAddVersionTo(doc)}>
                          <Upload className="mr-2 h-3.5 w-3.5" /> New version
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => setToDelete(doc)}>
                          <Trash2 className="mr-2 h-3.5 w-3.5" /> Remove
                        </Button>
                      </div>
                    )}
                  </AccordionContent>
                </AccordionItem>
              );
            })}
          </Accordion>
        )}
      </CardContent>

      {uploadDialog}

      <AlertDialog open={toDelete !== null} onOpenChange={(open) => !open && setToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove “{toDelete?.title}”?</AlertDialogTitle>
            <AlertDialogDescription>
              It will no longer appear on the project. The document and its versions are kept in the
              audit trail, along with a record that you removed it.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} disabled={isPending}>
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
