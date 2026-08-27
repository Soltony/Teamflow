"use client";

import { ChevronDown, Edit, PlusCircle, Pencil, Trash2, Users } from 'lucide-react';

import { Badge } from '../ui/badge';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '../ui/avatar';
import { ScrollArea } from '../ui/scroll-area';
import { cn } from '@/lib/utils';
import type { Team } from '@/lib/types';

/**
 * The expandable teams panel on a project card.
 *
 * Lifted out of project-card.tsx along with the tasks panel. The three click
 * handlers came with it — they only stop propagation and call back up, so
 * they belong beside the buttons that use them.
 */
export function ProjectCardTeams({
  project,
  isTeamsExpanded,
  onExpandToggle,
  canManageTeams,
  onAddTeam,
  onEditTeam,
  onDeleteTeam,
}: {
  project: any;
  isTeamsExpanded: boolean;
  onExpandToggle: (projectId: string, section: 'tasks' | 'teams') => void;
  canManageTeams: { create: boolean; update: boolean; delete: boolean };
  onAddTeam: (project: any) => void;
  onEditTeam: (team: Team, project: any) => void;
  onDeleteTeam: (team: Team) => void;
}) {
  const handleAddTeamClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onAddTeam(project);
  };

  const handleEditTeamClick = (e: React.MouseEvent, team: Team) => {
    e.stopPropagation();
    onEditTeam(team, project);
  };

  const handleDeleteTeamClick = (e: React.MouseEvent, team: Team) => {
    e.stopPropagation();
    onDeleteTeam(team);
  };

  return (
          <div className="space-y-3">
            <div 
                className="flex justify-between items-center cursor-pointer p-2 rounded-md hover:bg-muted/50 transition-colors"
                onClick={(e) => {
                    e.stopPropagation();
                    onExpandToggle(project.id, 'teams');
                }}
            >
                <div className="flex items-center gap-2">
                  <Users className="h-4 w-4 text-info" />
                  <h4 className="font-semibold text-info-strong">Teams ({project.teams?.length || 0})</h4>
                </div>
                <div className="flex items-center gap-2">
                    {canManageTeams.create && (
                        <Button variant="secondary" size="sm" onClick={handleAddTeamClick}>
                            <PlusCircle className="mr-2 h-4 w-4" />
                            Add Team
                        </Button>
                    )}
                    <div className="cursor-pointer p-1">
                        <ChevronDown className={cn("h-5 w-5 transition-transform text-info", isTeamsExpanded && "rotate-180")} />
                    </div>
                </div>
            </div>

            {isTeamsExpanded && (
              <div className="ml-6 space-y-3 border-l-2 border-info/30 pl-4">
                {(project.teams && project.teams.length > 0) ? (
                    <div className="space-y-3">
                        {project.teams.map((team: any) => {
                            const teamLead = team.teamLead;
                            const teamMembers = team.members.filter((m: any) => m.id !== team.teamLeadId);

                            return (
                                <div key={team.id} className="text-sm p-3 rounded-md bg-info-soft border border-info/30 group">
                                    <div className="flex justify-between items-start">
                                        <h5 className="font-semibold text-info-strong">{team.name}</h5>
                                        <div className="flex items-center opacity-0 group-hover:opacity-100 transition-opacity">
                                            {canManageTeams.update && (
                                                <Button variant="ghost" size="icon" className="h-6 w-6" onClick={(e) => handleEditTeamClick(e, team)}>
                                                    <Edit className="h-3 w-3" />
                                                </Button>
                                            )}
                                            {canManageTeams.delete && (
                                                <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive hover:text-destructive" onClick={(e) => handleDeleteTeamClick(e, team)}>
                                                    <Trash2 className="h-3 w-3" />
                                                </Button>
                                            )}
                                        </div>
                                    </div>
                                    <div className="text-info mt-1 space-y-1">
                                        {teamLead && <p><span className="font-semibold">Lead:</span> {teamLead.name}</p>}
                                        {teamMembers.length > 0 && <p><span className="font-semibold">Members:</span> {teamMembers.map((m: any) => m.name).join(', ')}</p>}
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                ) : (
                    <p className="text-sm text-info mt-2">No teams assigned.</p>
                )}
              </div>
            )}
          </div>
  );
}
