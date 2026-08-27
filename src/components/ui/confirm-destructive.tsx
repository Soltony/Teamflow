'use client';

import * as React from 'react';
import { AlertTriangle } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';

/**
 * Confirming something that cannot be undone.
 *
 * "Are you absolutely sure?" over a Cancel and a Delete is the standard
 * pattern, and it protects nobody: it asks a question the reader answers by
 * reflex, and it never says what is actually about to be lost. Deleting a
 * project here removes its milestones, its tasks, its issue register and its
 * documents, and the old dialog mentioned none of that.
 *
 * Two changes, both deliberate:
 *
 *  - **the consequences are itemised**, so the reader sees the size of the
 *    thing before they agree to it;
 *  - **the name has to be typed** for the worst of them. That is not friction
 *    for its own sake — it is the difference between a reflex and a decision,
 *    and it makes deleting the wrong project by muscle memory essentially
 *    impossible.
 *
 * Typing is reserved for genuinely irreversible, high-blast-radius actions. A
 * dialog that demands it every time trains people to copy-paste without
 * reading, which is worse than not asking.
 */

export interface ConfirmDestructiveProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** "Delete this project?" — name the thing and the verb. */
  title: string;
  /** One sentence on what this does. */
  description: React.ReactNode;
  /**
   * Exactly what is destroyed, itemised. Counts beat adjectives: "4 milestones,
   * 27 tasks, 3 issues" is a decision, "all associated data" is a shrug.
   */
  consequences?: string[];
  /**
   * When given, the reader must type this exactly before the button enables.
   * Use the record's own name.
   */
  confirmText?: string;
  /** What the reader is typing, so the label can say "the project name". */
  confirmLabel?: string;
  confirmButtonLabel?: string;
  isPending?: boolean;
  onConfirm: () => void;
}

export function ConfirmDestructive({
  open,
  onOpenChange,
  title,
  description,
  consequences = [],
  confirmText,
  confirmLabel = 'name',
  confirmButtonLabel = 'Delete',
  isPending = false,
  onConfirm,
}: ConfirmDestructiveProps) {
  const [typed, setTyped] = React.useState('');
  const inputId = React.useId();

  // Cleared when the dialog opens rather than when it closes, so a value typed
  // for one record can never be carried into the next.
  React.useEffect(() => {
    if (open) setTyped('');
  }, [open]);

  const requiresTyping = Boolean(confirmText);
  // Trimmed, because a trailing space pasted from a table cell is not a
  // different project — but case still has to match.
  const matches = !requiresTyping || typed.trim() === confirmText;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-start gap-2">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-destructive" aria-hidden="true" />
            <span>{title}</span>
          </DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        {consequences.length > 0 && (
          <div className="rounded-md border border-destructive/40 bg-destructive/5 p-3">
            <p className="mb-2 text-sm font-medium">This permanently removes:</p>
            <ul className="space-y-1 text-sm text-muted-foreground">
              {consequences.map((line) => (
                <li key={line} className="flex items-start gap-2">
                  <span aria-hidden="true">•</span>
                  <span>{line}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {requiresTyping && (
          <div className="space-y-2">
            <Label htmlFor={inputId}>
              Type the {confirmLabel} to confirm:{' '}
              <span className="font-semibold text-foreground">{confirmText}</span>
            </Label>
            <Input
              id={inputId}
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              placeholder={confirmText}
              autoComplete="off"
              // The dialog opens focused here, so a reader who opened it by
              // mistake can dismiss with Escape without tabbing anywhere.
              aria-describedby={`${inputId}-hint`}
            />
            <p id={`${inputId}-hint`} className="text-xs text-muted-foreground">
              {typed.trim().length === 0
                ? 'The button below stays disabled until this matches.'
                : matches
                  ? 'That matches — the action is now enabled.'
                  : 'That does not match yet.'}
            </p>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isPending}>
            Keep it
          </Button>
          <Button
            variant="destructive"
            onClick={onConfirm}
            disabled={!matches || isPending}
            className={cn(!matches && 'cursor-not-allowed')}
          >
            {isPending ? 'Working…' : confirmButtonLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
