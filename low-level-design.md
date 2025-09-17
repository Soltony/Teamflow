# Low-Level Design (LLD) for NIB EPMO

This document provides a detailed, technical breakdown of specific features and components within the NIB EPMO application.

## 1. Feature: Project Timeline Change Workflow

This section details the low-level design for the feature that allows project managers to request changes to a project's deadline, which must then be approved or rejected by an authorized user.

### 1.1. Database Schema

A new model, `TimelineChangeRequest`, is introduced to the Prisma schema (`prisma/schema.prisma`) to track each request.

```prisma
model TimelineChangeRequest {
  id           String   @id @default(cuid())
  project      Project  @relation(fields: [projectId], references: [id])
  projectId    String
  oldEndDate   DateTime
  newEndDate   DateTime
  reason       String
  status       String   @default("PENDING") // PENDING, APPROVED, REJECTED
  reviewNotes  String?

  requestedBy  User     @relation("RequestedChanges", fields: [requestedById], references: [id])
  requestedById String
  reviewedBy   User?    @relation("ReviewedChanges", fields: [reviewedById], references: [id])
  reviewedById String?

  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt
}

// Relations added to User model
model User {
  // ...
  timelineChangeRequestsMade    TimelineChangeRequest[] @relation("RequestedChanges")
  timelineChangeRequestsReviewed TimelineChangeRequest[] @relation("ReviewedChanges")
}

// Relation added to Project model
model Project {
  // ...
  timelineChangeRequests TimelineChangeRequest[]
}
```

### 1.2. Component & UI Flow

1.  **`src/components/projects/project-form.tsx`**:
    *   **State:** The form maintains the `originalEndDate` of the project when loaded in "edit" mode.
    *   **Logic:** On submission (`handleFormSubmit`), it checks if the `endDate` has been modified by the user.
    *   If the date has changed and the user has the `timeline:request` permission, it prevents the default submission and opens an `AlertDialog` (`isTimelineChangeDialogOpen`).
    *   This dialog contains a `textarea` for the `timelineChangeReason`.
    *   When the dialog's "Submit for Approval" button is clicked (`handleTimelineChangeSubmit`), it validates the reason and then calls the main `onSubmit` function with the complete form data, now including the reason.

2.  **`src/app/timeline-approvals/page.tsx` & `.../timeline-approvals-management.tsx`**:
    *   **Data Fetching:** The page calls the `getPendingTimelineChanges` server action to retrieve all requests with "PENDING" status.
    *   **UI:** The `TimelineApprovalManagement` component renders the pending requests in a `Table`, showing the project, old/new dates, and the reason.
    *   **Actions:**
        *   Each row has "Approve" and "Reject" buttons.
        *   "Approve" directly calls the `approveTimelineChange` server action.
        *   "Reject" opens a dialog to collect `reviewNotes`, which then calls the `rejectTimelineChange` server action.

3.  **`src/components/projects/project-card.tsx`**:
    *   The card component checks if a project has any associated `timelineChangeRequests` with a `PENDING` status.
    *   If a pending request exists, it displays a "Pending Approval" badge in the card's footer, providing clear visual feedback.

### 1.3. Server Actions

1.  **`updateProject` (`src/app/projects/actions.ts`)**:
    *   This action is modified to be aware of the timeline change workflow.
    *   It compares the submitted `endDate` with the existing project's `endDate`.
    *   **If the date has changed:** It creates a new `TimelineChangeRequest` record with status "PENDING". It **does not** update the `endDate` on the `Project` model itself. The original deadline remains in effect.
    *   **If the date has not changed:** It proceeds to update other project fields as normal.

2.  **`approveTimelineChange` (`src/app/timeline-approvals/actions.ts`)**:
    *   **Input:** `requestId`, `reviewerId`.
    *   **Logic:** Executes a Prisma transaction (`prisma.$transaction`) to:
        1.  Update the `TimelineChangeRequest` status to "APPROVED".
        2.  Update the corresponding `Project` record's `endDate` to the `newEndDate` from the request.
    *   Revalidates Next.js cache paths (`revalidatePath`) to ensure the UI updates across the app.

3.  **`rejectTimelineChange` (`src/app/timeline-approvals/actions.ts`)**:
    *   **Input:** `requestId`, `reviewerId`, `notes`.
    *   **Logic:** Updates the `TimelineChangeRequest` record's status to "REJECTED" and saves the `reviewNotes`. The project's original deadline is not changed.

## 2. Feature: "My Tasks" Page & Task Updates

This section details the design of the "My Tasks" page, which serves as a personal dashboard for users to manage their assigned work and report progress.

### 2.1. Component Breakdown

1.  **`src/app/my-tasks/page.tsx` (Main Page Component)**:
    *   **Responsibility:** Acts as the entry point and data fetcher for the "My Tasks" view.
    *   **Data Fetching:** On load, it calls the `getMyTasks(userId)` server action to get all tasks assigned to the current user.
    *   **State Management:** Uses `useState` to hold the `userTasks` and a list of `allUsers` (for displaying avatars and names).
    *   **Logic:** It categorizes tasks into "Overdue", "Active", and "Accomplished This Week" based on their `endDate` and `status`. It then passes these categorized lists and handler functions down to the `MyTasksManagement` component.

2.  **`src/components/tasks/my-tasks-management.tsx` (Layout & Stats)**:
    *   **Responsibility:** Renders the overall layout, including the KPI cards (Overdue Tasks, Active Tasks, etc.) and the main task sections.
    *   **UI:** Uses `Card` components for the stats and `TaskSection` components to render the lists of tasks.
    *   **Props:** Receives categorized task lists and action handlers (`handleStatusChange`, `handleUpdateSubmit`) from the parent page.

3.  **`TaskItem` (within `my-tasks-management.tsx`)**:
    *   **Responsibility:** Renders a single, interactive task item within an `Accordion`.
    *   **Form:** Each `TaskItem` has its own independent `react-hook-form` instance for handling new task updates. The form schema (`taskUpdateSchema`) dynamically validates that the new progress percentage is not less than the current progress.
    *   **UI:** Displays task details, progress bar, existing updates, and the form for adding a new update.
    *   **Actions:**
        *   The status `Select` dropdown calls the `onStatusChange` handler.
        *   The "Post Update" form calls the `onUpdateSubmit` handler.

### 2.2. Server Actions (`src/app/my-tasks/actions.ts`)

1.  **`getMyTasks(userId)`**:
    *   Fetches all tasks from the database where the `assignees` relation includes the `userId`.
    *   It `includes` related data like the project, milestone, and existing task updates with their authors.
    *   Returns a structured `UserTask[]` object.

2.  **`updateTaskStatusAction(taskId, newStatus)`**:
    *   Updates the `status` of a specific task.
    *   Contains logic to automatically set `progress` to 100 and `completedAt` to the current time if the new status is `DONE`.

3.  **`addTaskUpdateAction(taskId, text, authorId, progressPercentage)`**:
    *   This action runs within a Prisma transaction (`prisma.$transaction`) to ensure atomicity.
    *   **Step 1:** Creates a new `TaskUpdate` record with the provided text, author, and progress.
    *   **Step 2:** Updates the parent `Task` record's `progress` to the new `progressPercentage`.
    *   **Step 3:** Contains logic to automatically advance the task's `status`:
        *   If progress becomes 100%, the status is set to `PENDING_REVIEW`.
        *   If progress moves from 0 to greater than 0, the status is set from `TODO` to `IN_PROGRESS`.
    *   Revalidates the cache for `/my-tasks` and `/team-view` to reflect changes immediately.

### 2.3. UI/UX Flow

1.  A user navigates to the "My Tasks" page.
2.  The page fetches all tasks assigned to them.
3.  The user sees their tasks grouped into "Overdue", "Active", and recently "Accomplished".
4.  The user clicks on a task to expand its details.
5.  Inside, they can see a history of all previous updates.
6.  They type a new update into the `Textarea` and adjust the `Slider` to indicate their new progress percentage.
7.  Upon clicking "Post Update", the `addTaskUpdateAction` is called. The backend updates the progress, adds the comment, and potentially changes the task's status (e.g., to `PENDING_REVIEW` if progress is 100%).
8.  The page re-fetches its data, and the new update appears at the top of the list. The progress bar and task status update automatically.
