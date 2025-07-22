
'use client';

import * as React from 'react';
import Autoplay from 'embla-carousel-autoplay';
import { Card, CardContent } from '@/components/ui/card';
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from '@/components/ui/carousel';
import { Award, Medal, PartyPopper } from 'lucide-react';
import { format } from 'date-fns';
import Confetti from 'react-confetti';
import useWindowSize from 'react-use/lib/useWindowSize';

const celebrationIcons = [
  <Award key="award" className="h-12 w-12 text-yellow-500" />,
  <Medal key="medal" className="h-12 w-12 text-orange-500" />,
  <PartyPopper key="popper" className="h-12 w-12 text-pink-500" />,
];

export function CelebrationSlider({ completedProjects, teams }: { completedProjects: any[], teams: any[] }) {
  const { width, height } = useWindowSize();
  const autoplayPlugin = React.useRef(
    Autoplay({ delay: 5000, stopOnInteraction: true })
  );

  if (!completedProjects || completedProjects.length === 0) {
    return null;
  }

  const getTeamForProject = (projectId: string) => {
    return teams.find(team => team.projectId === projectId);
  };

  return (
    <div className="relative">
      <Confetti width={width} height={height} recycle={false} numberOfPieces={400} />
      <Carousel
        plugins={[autoplayPlugin.current]}
        opts={{
          align: 'start',
          loop: true,
        }}
        className="w-full"
        onMouseEnter={() => autoplayPlugin.current.stop()}
        onMouseLeave={() => autoplayPlugin.current.play()}
      >
        <CarouselContent>
          {completedProjects.map((project, index) => {
            const team = getTeamForProject(project.id);
            const teamMembers = team ? team.members.map((m: any) => m.name).join(', ') : 'N/A';
            const icon = celebrationIcons[index % celebrationIcons.length];

            return (
              <CarouselItem key={project.id}>
                <div className="p-1">
                  <Card className="bg-gradient-to-r from-yellow-100 via-amber-50 to-yellow-100 border-yellow-300">
                    <CardContent className="flex flex-col items-center justify-center p-6 text-center space-y-4">
                      <div className="flex items-center gap-4">
                        {icon}
                        <div className="flex flex-col items-center">
                          <h3 className="text-2xl font-bold text-yellow-800">{project.name}</h3>
                          <p className="text-sm font-semibold text-yellow-700">Project Completed!</p>
                        </div>
                      </div>
                      <p className="text-muted-foreground text-yellow-800/80">
                        A huge congratulations to the team for their hard work and dedication.
                      </p>
                      <div className="text-sm text-yellow-700/90 space-y-1">
                        <p><span className="font-semibold">Team:</span> {teamMembers}</p>
                        <p><span className="font-semibold">Completed on:</span> {format(new Date(project.endDate), 'MMMM dd, yyyy')}</p>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </CarouselItem>
            );
          })}
        </CarouselContent>
        <CarouselPrevious />
        <CarouselNext />
      </Carousel>
    </div>
  );
}
