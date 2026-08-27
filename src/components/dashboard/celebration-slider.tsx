
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
  <Award key="award" className="h-12 w-12 text-warning" />,
  <Medal key="medal" className="h-12 w-12 text-warning-strong" />,
  <PartyPopper key="popper" className="h-12 w-12 text-accent" />,
];

export function CelebrationSlider({ completedProjects, teams }: { completedProjects: any[], teams: any[] }) {
  const { width, height } = useWindowSize();
  const autoplayPlugin = React.useRef(
    Autoplay({ delay: 5000, stopOnInteraction: true, playOnInit: true })
  );
  const [carouselApi, setCarouselApi] = React.useState<any>(null);

  React.useEffect(() => {
    if (!carouselApi) {
      return;
    }
    const handleMouseEnter = () => autoplayPlugin.current.stop();
    const handleMouseLeave = () => autoplayPlugin.current.play();

    const carouselEl = carouselApi.containerNode();
    carouselEl.addEventListener('mouseenter', handleMouseEnter);
    carouselEl.addEventListener('mouseleave', handleMouseLeave);

    return () => {
      carouselEl.removeEventListener('mouseenter', handleMouseEnter);
      carouselEl.removeEventListener('mouseleave', handleMouseLeave);
    };
  }, [carouselApi]);


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
        setApi={setCarouselApi}
        plugins={[autoplayPlugin.current]}
        opts={{
          align: 'start',
          loop: true,
        }}
        className="w-full"
      >
        <CarouselContent>
          {completedProjects.map((project, index) => {
            const team = getTeamForProject(project.id);
            const projectManagerName = project.projectManager?.name ?? 'N/A';
            const teamMembers = team ? team.members.map((m: any) => m.name).join(', ') : 'N/A';
            const icon = celebrationIcons[index % celebrationIcons.length];

            return (
              <CarouselItem key={project.id}>
                <div className="p-1">
                  <Card className="border-primary/40 bg-gradient-to-r from-primary-soft via-warning-soft to-primary-soft">
                    <CardContent className="flex flex-col items-center justify-center p-6 text-center space-y-4">
                      <div className="flex items-center gap-4">
                        {icon}
                        <div className="flex flex-col items-center">
                          <h3 className="text-2xl font-bold text-warning-strong">{project.name}</h3>
                          <p className="text-sm font-semibold text-warning-strong">Project Completed!</p>
                        </div>
                      </div>
                      <p className="text-warning-strong/80">
                        A huge congratulations to the team for their hard work and dedication.
                      </p>
                      <div className="text-sm text-warning-strong/90 space-y-1">
                        <p><span className="font-semibold">Project Manager (PM):</span> {projectManagerName}</p>
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
