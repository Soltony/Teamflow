import { MyTasksManagement } from "@/components/tasks/my-tasks-management";
import { users } from "@/lib/data";

export default function MyTasksPage() {
  // For demonstration, we'll hardcode the current user.
  // In a real application, this would come from an authentication context.
  const currentUser = users[0]; 

  return (
    <MyTasksManagement 
        allUsers={users}
        currentUser={currentUser} 
    />
  );
}
