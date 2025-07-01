import { MyTasksManagement } from "@/components/tasks/my-tasks-management";
import { projects, users } from "@/lib/data";

export default function MyTasksPage() {
  // For demonstration, we'll hardcode the current user.
  // In a real application, this would come from an authentication context.
  const currentUser = users[0]; 

  return (
    <MyTasksManagement 
        allProjects={projects} 
        allUsers={users}
        currentUser={currentUser} 
    />
  );
}
