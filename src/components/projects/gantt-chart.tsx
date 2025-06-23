"use client";

import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { differenceInDays, parseISO } from 'date-fns';
import type { Project } from '@/lib/types';

type GanttChartProps = {
  project: Project;
};

export function GanttChart({ project }: GanttChartProps) {
  const projectStartDate = parseISO(project.startDate);

  const data = project.tasks.map(task => {
    const taskStartDate = parseISO(task.startDate);
    const taskEndDate = parseISO(task.endDate);
    
    const startDay = differenceInDays(taskStartDate, projectStartDate);
    const duration = differenceInDays(taskEndDate, taskStartDate) + 1; // inclusive of end date

    return {
      name: task.title,
      range: [startDay, startDay + duration],
      startOffset: startDay,
      duration: duration
    };
  });

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const taskData = payload[0].payload;
      const startDate = new Date(project.startDate);
      startDate.setDate(startDate.getDate() + taskData.startOffset);
      
      const endDate = new Date(startDate);
      endDate.setDate(endDate.getDate() + taskData.duration - 1);

      return (
        <div className="p-2 bg-card border rounded-md shadow-lg">
          <p className="font-bold">{label}</p>
          <p className="text-sm text-muted-foreground">Start: {startDate.toLocaleDateString()}</p>
          <p className="text-sm text-muted-foreground">End: {endDate.toLocaleDateString()}</p>
          <p className="text-sm text-muted-foreground">Duration: {taskData.duration} days</p>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="w-full h-[500px]">
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
          <XAxis type="number" domain={['dataMin', 'dataMax']} unit=" days" />
          <YAxis dataKey="name" type="category" width={150} tick={{ fontSize: 12 }} />
          <Tooltip content={<CustomTooltip />} cursor={{fill: 'rgba(var(--card), 0.5)'}}/>
          <Bar dataKey="duration" name="Duration" stackId="a" fill="hsl(var(--primary))" radius={[4, 4, 4, 4]} />
          <Bar dataKey="startOffset" name="Start Offset" stackId="a" fill="transparent" />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
