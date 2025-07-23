
"use client";

import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Text } from 'recharts';
import { differenceInDays, parseISO, min as dateMin, format } from 'date-fns';
import Link from 'next/link';

const CustomYAxisTick = (props: any) => {
    const { x, y, payload, width } = props;
    const item = payload.payload; // The full data object for this tick

    if (!item) return null;

    // Use foreignObject to allow standard HTML/Next.js components inside SVG
    return (
      <g transform={`translate(${x - width}, ${y - 10})`}>
        <foreignObject x={0} y={0} width={width} height={40}>
          <div style={{ width: `${width}px`, textAlign: 'right', paddingRight: '10px' }}>
              <Link href={`/projects/${item.projectId}`} className="text-sm fill-muted-foreground hover:underline hover:fill-primary transition-colors cursor-pointer text-right block truncate" title={`${item.projectName}: ${item.milestoneTitle}`}>
                {item.name}
              </Link>
          </div>
        </foreignObject>
      </g>
    );
};


export function ProjectsGanttChart({ projects }: { projects: any[] }) {
  if (!projects || projects.length === 0) {
    return (
      <div className="flex h-[400px] w-full items-center justify-center rounded-lg border border-dashed text-muted-foreground">
        No projects to display in the Gantt chart.
      </div>
    );
  }

  const allMilestones = projects.flatMap(p => 
      (p.milestones || []).map((m: any) => ({
          ...m,
          projectId: p.id,
          projectName: p.name,
          milestoneTitle: m.title
      }))
  ).filter(m => m.startDate && m.dueDate); // Filter for milestones with valid dates

  if (allMilestones.length === 0) {
      return (
        <div className="flex h-[400px] w-full items-center justify-center rounded-lg border border-dashed text-muted-foreground">
          No milestones with valid date ranges found across all projects.
        </div>
      );
  }

  const allStartDates = allMilestones.map(m => parseISO(m.startDate.toString()));
  const chartStartDate = dateMin(allStartDates);

  const data = allMilestones.map(milestone => {
    const milestoneStartDate = parseISO(milestone.startDate.toString());
    const milestoneDueDate = parseISO(milestone.dueDate.toString());
    
    const startDay = differenceInDays(milestoneStartDate, chartStartDate);
    const duration = differenceInDays(milestoneDueDate, milestoneStartDate) + 1;

    return {
      projectId: milestone.projectId,
      projectName: milestone.projectName,
      milestoneTitle: milestone.milestoneTitle,
      name: `${milestone.projectName}: ${milestone.milestoneTitle}`,
      startOffset: startDay,
      duration: duration,
      startDate: milestone.startDate,
      dueDate: milestone.dueDate,
    };
  }).sort((a, b) => {
      if (a.projectName !== b.projectName) {
          return a.projectName.localeCompare(b.projectName);
      }
      return a.startOffset - b.startOffset;
  });

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const itemData = payload[0].payload;
      return (
        <div className="p-2 bg-card border rounded-md shadow-lg">
          <p className="font-bold">{itemData.projectName}</p>
          <p className="text-sm font-semibold">{itemData.milestoneTitle}</p>
          <p className="text-sm text-muted-foreground">Start: {format(parseISO(itemData.startDate.toString()), 'MMM dd, yyyy')}</p>
          <p className="text-sm text-muted-foreground">Due: {format(parseISO(itemData.dueDate.toString()), 'MMM dd, yyyy')}</p>
          <p className="text-sm text-muted-foreground">Duration: {itemData.duration} days</p>
        </div>
      );
    }
    return null;
  };

  const chartHeight = data.length * 60 + 80;

  return (
    <div className="w-full overflow-x-auto">
      <div style={{ width: '100%', minWidth: '800px', height: chartHeight }}>
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
            <YAxis dataKey="name" type="category" width={250} tick={<CustomYAxisTick />} interval={0} />
            <Tooltip content={<CustomTooltip />} cursor={{fill: 'hsl(var(--card))'}}/>
            <Bar dataKey="startOffset" stackId="a" fill="transparent" />
            <Bar dataKey="duration" stackId="a" fill="hsl(var(--primary))" radius={[4, 4, 4, 4]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
