"use client";

import * as React from "react";
import { Pie, PieChart, Cell } from "recharts";

import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartLegend,
  ChartLegendContent,
  type ChartConfig,
} from "@/components/ui/chart";
import {
  UNASSIGNED_INITIATIVE,
  UNASSIGNED_INITIATIVE_LABEL,
  groupByInitiative,
} from "@/lib/queries/initiative-scope";
import type { Initiative } from "@/lib/types";

/**
 * How the portfolio splits across the strategic initiatives.
 *
 * A pie is honest here in a way it is not for departments: a project has at
 * most one initiative, so the slices are a true partition of the selection and
 * the percentages add to a hundred. The department chart beside it counts a
 * project once per department, so its slices deliberately over-total — same
 * shape, different arithmetic.
 *
 * The work under no initiative gets a slice of its own, in a deliberately
 * muted colour. Dropping it would leave a chart that looked like full coverage
 * while a third of delivery answered to nothing.
 */
export function InitiativeProjectsChart({
  projects,
  initiatives,
}: {
  projects: any[];
  initiatives: Initiative[];
}) {
  if (!projects || !initiatives) {
    return (
      <div className="flex h-[300px] w-full items-center justify-center rounded-lg border border-dashed text-muted-foreground">
        Loading chart data...
      </div>
    );
  }

  // Empty initiatives are dropped here — a slice of zero is not a slice —
  // though they are still listed on the reports breakdown, where a row of zero
  // says something a missing slice cannot.
  const chartData = groupByInitiative(projects, initiatives)
    .filter((group) => group.projects.length > 0)
    .map((group) => ({
      key: group.id,
      name: group.unassigned ? UNASSIGNED_INITIATIVE_LABEL : group.name,
      projects: group.projects.length,
    }));

  const colorFor = (key: string, index: number) =>
    key === UNASSIGNED_INITIATIVE
      ? "hsl(var(--muted-foreground))"
      : `hsl(var(--chart-${(index % 5) + 1}))`;

  const chartConfig = {} as ChartConfig;
  chartData.forEach((item, index) => {
    chartConfig[item.name] = {
      label: item.name,
      color: colorFor(item.key, index),
    };
  });

  if (chartData.length === 0) {
    return (
      <div className="flex h-[300px] w-full items-center justify-center rounded-lg border border-dashed text-center text-muted-foreground">
        {initiatives.length === 0
          ? "No initiatives have been set up yet."
          : "No project data available to display chart."}
      </div>
    );
  }

  return (
    <ChartContainer config={chartConfig} className="mx-auto aspect-square max-h-[300px]">
      <PieChart>
        <ChartTooltip cursor={false} content={<ChartTooltipContent indicator="dot" hideLabel />} />
        <Pie
          data={chartData}
          dataKey="projects"
          nameKey="name"
          innerRadius="60%"
          strokeWidth={2}
          labelLine={false}
          label={({ value, percent, cx, cy, midAngle, innerRadius, outerRadius }) => {
            // Small slices go unlabelled rather than overlapping their
            // neighbours into illegibility; the tooltip and legend still carry
            // the figure.
            if (percent < 0.05 && chartData.length > 1) {
              return null;
            }

            const RADIAN = Math.PI / 180;
            const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
            const x = cx + radius * Math.cos(-midAngle * RADIAN);
            const y = cy + radius * Math.sin(-midAngle * RADIAN);

            return (
              <text
                x={x}
                y={y}
                fill="hsl(var(--card-foreground))"
                textAnchor="middle"
                dominantBaseline="central"
                className="text-base font-bold"
              >
                {value}
              </text>
            );
          }}
        >
          {chartData.map((entry, index) => (
            <Cell
              key={`cell-${entry.key}`}
              fill={colorFor(entry.key, index)}
              className="stroke-background"
            />
          ))}
        </Pie>
        <ChartLegend
          content={<ChartLegendContent nameKey="name" />}
          className="-translate-y-4 flex-wrap gap-2 [&>*]:basis-1/3 [&>*]:justify-center"
        />
      </PieChart>
    </ChartContainer>
  );
}
