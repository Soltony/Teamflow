import { TeamsManagement } from "@/components/teams/teams-management";
import prisma from "@/lib/db";

export default async function TeamsPage() {
    const [teams, projects, users] = await Promise.all([
    prisma.team.findMany({
        include: {
        members: true,
        teamLead: true,
        project: true,
        },
        orderBy: {
        name: 'asc'
        }
    }),
    prisma.project.findMany({
        orderBy: {
        name: 'asc'
        }
    }),
    prisma.user.findMany({
        orderBy: {
        name: 'asc'
        }
    }),
    ]);

    const normalizedTeams = teams.map(team => ({
    ...team,
    memberIds: team.members.map(member => member.id),
    }));

    return (
    <div className="p-4 sm:p-6">
        <TeamsManagement
        initialTeams={JSON.parse(JSON.stringify(normalizedTeams))}
        allProjects={JSON.parse(JSON.stringify(projects))}
        allUsers={JSON.parse(JSON.stringify(users))}
        />
    </div>
    );
}
