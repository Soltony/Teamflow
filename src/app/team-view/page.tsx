import { TeamTasksManagement } from "@/components/tasks/team-tasks-management";
import { projects, users, teams } from "@/lib/data";

export default function TeamViewPage() {
  // For demonstration, we'll hardcode the current user.
  // In a real application, this would come from an authentication context.
  // We'll use a known team lead from the sample data. user-1 (Alice) is lead of one team, user-2 (Bob) of another.
  // Let's use Alice as the default lead for this view.
  const currentUser = users.find(u => u.id === 'user-1')!; 

  return (
    <TeamTasksManagement 
        allProjects={projects} 
        allUsers={users}
        allTeams={teams}
        currentUser={currentUser} 
    />
  );
}
