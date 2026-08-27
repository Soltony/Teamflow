'use client';

import * as React from 'react';
import { Columns3 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

/**
 * Which columns a reader wants to see.
 *
 * A finance reviewer and a delivery manager want different things from the
 * same project table, and neither should have to hide the other's columns
 * every time they open the page. Required columns cannot be turned off,
 * because a row with no name is not a shorter row, it is a broken one.
 */

export interface ColumnOption<T extends string> {
  id: T;
  label: string;
  required?: boolean;
}

export function ColumnPicker<T extends string>({
  columns,
  selected,
  onChange,
  className,
}: {
  columns: ColumnOption<T>[];
  selected: T[];
  onChange: (next: T[]) => void;
  className?: string;
}) {
  const optional = columns.filter((c) => !c.required);
  const hidden = optional.filter((c) => !selected.includes(c.id)).length;

  const toggle = (id: T, on: boolean) => {
    // Order is taken from the column definitions rather than from click order,
    // so turning a column off and on again puts it back where it was.
    const next = columns
      .filter((c) => (c.id === id ? on : selected.includes(c.id)))
      .map((c) => c.id);
    onChange(next);
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className={className}>
          <Columns3 className="h-4 w-4" aria-hidden="true" />
          Columns
          {hidden > 0 && (
            <span className="ml-1 text-xs text-muted-foreground tabular-nums">
              ({selected.length}/{columns.length})
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel>Show columns</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {columns.map((column) => (
          <DropdownMenuCheckboxItem
            key={column.id}
            checked={selected.includes(column.id)}
            disabled={column.required}
            onCheckedChange={(checked) => toggle(column.id, checked === true)}
            // Radix closes the menu on select by default, which makes choosing
            // three columns three round trips through the trigger.
            onSelect={(e) => e.preventDefault()}
          >
            {column.label}
            {column.required && (
              <span className="ml-auto text-xs text-muted-foreground">Always</span>
            )}
          </DropdownMenuCheckboxItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
