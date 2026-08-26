'use client';

import { Info } from 'lucide-react';

import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { METRIC_DEFINITIONS, type MetricKey } from '@/lib/metrics/definitions';

/**
 * The "what does this number mean" affordance next to a KPI.
 *
 * Four screens used to show four different values for the same concept, and
 * nothing on any of them said how the figure was arrived at. Stating the rule
 * where the number is displayed is what lets someone check it rather than
 * quietly distrust it.
 */
export function MetricInfo({ metric, className }: { metric: MetricKey; className?: string }) {
  const { label, definition, note } = METRIC_DEFINITIONS[metric];

  return (
    <TooltipProvider delayDuration={150}>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            // Buttons inside a clickable card must not trigger the card's link.
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
            }}
            className={
              className ??
              'text-muted-foreground/70 hover:text-foreground transition-colors rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'
            }
            aria-label={`How ${label} is calculated`}
          >
            <Info className="h-3.5 w-3.5" />
          </button>
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-xs">
          <p className="font-medium">{label}</p>
          <p className="mt-1 text-xs">{definition}</p>
          {note && <p className="mt-1.5 text-xs text-muted-foreground">{note}</p>}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
