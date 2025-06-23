
"use client";

import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Text } from 'recharts';
import { differenceInDays, parseISO, min as dateMin, format } from 'date-fns';
import { projects } from '@/lib/data';
import Link from 'next/link';

// Custom Y-axis tick to make project names clickable and handle text wrapping
const CustomYAxisTick = (props: any) => {
    const { x, y, payload, width } = props;
    const project = projects.find(p => p.name === payload.value);

    return (
      <g transform={`translate(${x},${y})`}>
          <Link href={`/projects/${project?.id}`}>
            <Text
                x={0}
                y={0}
                dx={-10}
                dy={4}
                width={width - 10}
                textAnchor="end"
                verticalAnchor="middle"
                className="text-sm fill-muted-foreground hover:underline hover:fill-primary transition-colors cursor-pointer"
            >
                {payload.value}
            </Text>
        </Link>
      </g>
    );
};

export function ProjectsGanttChart() {
  if (!projects || projects.length === 0) {
    return (
      <div className="flex h-[400px] w-full items-center justify-center rounded-lg border border-dashed text-muted-foreground">
        No projects to display in the Gantt chart.
      </div>
    );
  }

  const allStartDates = projects.map(p => parseISO(p.startDate));
  const chartStartDate = dateMin(allStartDates);

  const data = projects.map(project => {
    const projectStartDate = parseISO(project.startDate);
    const projectEndDate = parseISO(project.endDate);
    
    const startDay = differenceInDays(projectStartDate, chartStartDate);
    const duration = differenceInDays(projectEndDate, projectStartDate) + 1;

    return {
      id: project.id,
      name: project.name,
      startOffset: startDay,
      duration: duration
    };
  }).sort((a, b) => a.startOffset - b.startOffset); // Sort projects by start date

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const projectData = payload[0].payload;
      const project = projects.find(p => p.id === projectData.id);
      if (!project) return null;

      return (
        <div className="p-2 bg-card border rounded-md shadow-lg">
          <p className="font-bold">{label}</p>
          <p className="text-sm text-muted-foreground">Start: {format(parseISO(project.startDate), 'MMM dd, yyyy')}</p>
          <p className="text-sm text-muted-foreground">End: {format(parseISO(project.endDate), 'MMM dd, yyyy')}</p>
          <p className="text-sm text-muted-foreground">Duration: {projectData.duration} days</p>
        </div>
      );
    }
    return null;
  };

  const chartHeight = projects.length * 60 + 80; // Dynamically calculate height

  return (
    <div style={{ width: '100%', height: chartHeight }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={data}
          layout="vertical"
          margin={{
            top: 20,
            right: 30,
            left: 20,
            bottom: 20,
          }}
          barCategoryGap="40%"
        >
          <CartesianGrid strokeDasharray="3 3" horizontal={false} />
          <XAxis type="number" domain={['dataMin', 'dataMax']} label={{ value: `Days from ${format(chartStartDate, 'MMM dd, yyyy')}`, position: 'insideBottom', offset: 0 }} height={50} />
          <YAxis dataKey="name" type="category" width={200} tick={<CustomYAxisTick />} interval={0} />
          <Tooltip content={<CustomTooltip />} cursor={{fill: 'hsl(var(--card))'}}/>
          <Bar dataKey="startOffset" stackId="a" fill="transparent" />
          <Bar dataKey="duration" stackId="a" fill="hsl(var(--primary))" radius={[4, 4, 4, 4]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
