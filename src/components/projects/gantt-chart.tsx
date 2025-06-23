
"use client";

import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { differenceInDays, parseISO, format, addDays } from 'date-fns';
import type { Project } from '@/lib/types';

type GanttChartProps = {
  project: Project;
};

export function GanttChart({ project }: GanttChartProps) {
  const projectStartDate = parseISO(project.startDate);
  const tasks = project.milestones.flatMap(m => m.tasks);

  if (tasks.length === 0) {
    return (
      <div className="flex h-[400px] w-full items-center justify-center rounded-lg border border-dashed text-muted-foreground">
        No tasks have been added to this project yet.
      </div>
    );
  }

  const data = tasks.map(task => {
    const taskStartDate = parseISO(task.startDate);
    const taskEndDate = parseISO(task.endDate);
    
    const startDay = differenceInDays(taskStartDate, projectStartDate);
    const duration = differenceInDays(taskEndDate, taskStartDate) + 1; // inclusive of end date

    return {
      name: task.title,
      startOffset: startDay < 0 ? 0 : startDay, // handle tasks starting before project
      duration: duration
    };
  });

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const taskData = payload[0].payload;
      const startDate = addDays(projectStartDate, taskData.startOffset);
      const endDate = addDays(startDate, taskData.duration - 1);

      return (
        <div className="p-2 bg-card border rounded-md shadow-lg">
          <p className="font-bold">{label}</p>
          <p className="text-sm text-muted-foreground">Start: {format(startDate, 'MMM dd, yyyy')}</p>
          <p className="text-sm text-muted-foreground">End: {format(endDate, 'MMM dd, yyyy')}</p>
          <p className="text-sm text-muted-foreground">Duration: {taskData.duration} days</p>
        </div>
      );
    }
    return null;
  };

  const chartHeight = data.length * 50 + 80;

  return (
    <div style={{ width: '100%', height: chartHeight }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={data}
          layout="vertical"
          margin={{
            top: 20,
            right: 30,
            left: 50,
            bottom: 5,
          }}
          barCategoryGap="30%"
        >
          <CartesianGrid strokeDasharray="3 3" horizontal={false} />
          <XAxis type="number" domain={['dataMin', 'dataMax']} unit=" days" label={{ value: 'Days from project start', position: 'insideBottom', offset: -5 }} />
          <YAxis dataKey="name" type="category" width={150} tick={{ fontSize: 12 }} interval={0} />
          <Tooltip content={<CustomTooltip />} cursor={{fill: 'hsl(var(--card))'}}/>
          <Bar dataKey="startOffset" stackId="a" fill="transparent" />
          <Bar dataKey="duration" stackId="a" fill="hsl(var(--primary))" radius={[4, 4, 4, 4]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
