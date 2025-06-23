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
import { projects, departments } from "@/lib/data";

const departmentMap = new Map(departments.map((d) => [d.id, d.name]));

const projectsByDept = projects.reduce((acc, project) => {
  const deptName = departmentMap.get(project.departmentId) || "Unknown Department";
  acc[deptName] = (acc[deptName] || 0) + 1;
  return acc;
}, {} as Record<string, number>);

const chartData = Object.entries(projectsByDept).map(([name, value]) => ({
  name,
  projects: value,
}));

const chartConfig = {} as ChartConfig;
chartData.forEach((item, index) => {
  chartConfig[item.name] = {
    label: item.name,
    color: `hsl(var(--chart-${(index % 5) + 1}))`,
  };
});

export function DepartmentProjectsChart() {
  if (chartData.length === 0) {
    return (
      <div className="flex h-[300px] w-full items-center justify-center rounded-lg border border-dashed text-muted-foreground">
        No project data available to display chart.
      </div>
    );
  }

  return (
    <ChartContainer
      config={chartConfig}
      className="mx-auto aspect-square max-h-[300px]"
    >
      <PieChart>
        <ChartTooltip
          cursor={false}
          content={<ChartTooltipContent indicator="dot" hideLabel />}
        />
        <Pie
          data={chartData}
          dataKey="projects"
          nameKey="name"
          innerRadius="60%"
          strokeWidth={2}
          labelLine={false}
          label={({
            value,
            percent,
            cx,
            cy,
            midAngle,
            innerRadius,
            outerRadius,
          }) => {
            // Don't render label for small slices
            if (percent < 0.05) {
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
              key={`cell-${index}`}
              fill={`hsl(var(--chart-${(index % 5) + 1}))`}
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
