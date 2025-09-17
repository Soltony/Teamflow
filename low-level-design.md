# Low-Level Design (LLD) for NIB EPMO

## Feature: Project Timeline Change Workflow

This document details the low-level design for the feature that allows project managers to request changes to a project's deadline, which must then be approved or rejected by an authorized user.

### 1. Database Schema

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
```

Two new relations are added to the `User` model to link users to the requests they've made or reviewed:
```prisma
model User {
  // ... existing fields
  timelineChangeRequestsMade    TimelineChangeRequest[] @relation("RequestedChanges")
  timelineChangeRequestsReviewed TimelineChangeRequest[] @relation("ReviewedChanges")
}
```
And a new relation is added to the `Project` model:
```prisma
model Project {
  // ... existing fields
  timelineChangeRequests TimelineChangeRequest[]
}
```

### 2. Component Breakdown

#### 2.1. Project Form (`src/components/projects/project-form.tsx`)

- **State Management:**
  - `originalEndDate`: A `useState` hook stores the project's end date when the form is first loaded in "edit" mode.
  - `isTimelineChangeDialogOpen`: A `useState` hook to control the visibility of the "Reason for Change" dialog.

- **Logic Flow:**
  1. The main `handleFormSubmit` function is triggered on form submission.
  2. It checks three conditions:
     - Is the form in "edit" mode?
     - Does the user have the `timeline:request` permission?
     - Has the `endDate` in the form changed from the `originalEndDate`?
  3. If all conditions are true, it prevents the default form submission and instead opens the "Reason for Change" dialog (`setIsTimelineChangeDialogOpen(true)`).
  4. If the conditions are not met, it proceeds with the standard `onSubmit` function.

#### 2.2. Timeline Change Dialog (`AlertDialog` in `project-form.tsx`)

- This is an `AlertDialog` component that contains another form field for `timelineChangeReason`.
- When its "Submit for Approval" button is clicked, it calls `handleTimelineChangeSubmit`.
- `handleTimelineChangeSubmit` validates the reason, then calls the main `onSubmit` prop with the complete form data, including the reason. The dialog is then closed.

#### 2.3. Timeline Approvals Page (`src/app/timeline-approvals/page.tsx`)

- **Data Fetching:** On page load, `getPendingTimelineChanges` from `actions.ts` is called to retrieve all requests with "PENDING" status.
- **UI:** The `TimelineApprovalManagement` component (`src/components/timeline-approvals/timeline-approvals-management.tsx`) renders the pending requests in a `Table`.
- **Actions:**
  - Each row has "Approve" and "Reject" buttons.
  - Clicking "Approve" directly calls the `approveTimelineChange` server action.
  - Clicking "Reject" opens a dialog (`Rejection Dialog`) asking for rejection notes. Submitting this dialog calls the `rejectTimelineChange` server action.

### 3. Server Actions

#### 3.1. `updateProject` (`src/app/projects/actions.ts`)

- This action is modified to be aware of the timeline change workflow.
- It compares the submitted `endDate` with the existing project's `endDate`.
- **If the date has changed:**
  - It creates a new `TimelineChangeRequest` record with the status "PENDING".
  - It **does not** update the `endDate` on the `Project` model itself. The original deadline remains in effect.
- **If the date has not changed:**
  - It proceeds to update other project fields as normal.

#### 3.2. `approveTimelineChange` (`src/app/timeline-approvals/actions.ts`)

- **Input:** `requestId`, `reviewerId`.
- **Logic:**
  1. Finds the `TimelineChangeRequest` record by its ID.
  2. Executes a Prisma transaction (`prisma.$transaction`):
     - Updates the `TimelineChangeRequest` status to "APPROVED" and records the `reviewerId`.
     - Updates the corresponding `Project` record's `endDate` to the `newEndDate` from the request.
  3. Revalidates relevant Next.js cache paths to ensure UI updates.

#### 3.3. `rejectTimelineChange` (`src/app/timeline-approvals/actions.ts`)

- **Input:** `requestId`, `reviewerId`, `notes`.
- **Logic:**
  1. Updates the `TimelineChangeRequest` record's status to "REJECTED".
  2. Records the `reviewerId` and the rejection `reviewNotes`.
  3. The project's original deadline remains unchanged.
  4. Revalidates relevant Next.js cache paths.

### 4. UI/UX Flow

1.  A Project Manager edits a project and changes the "End Date".
2.  Upon clicking "Save Changes", a dialog appears asking for a reason.
3.  The PM enters a reason and clicks "Submit for Approval".
4.  The project page now shows a "Pending Approval" badge. The end date has not yet changed.
5.  An Admin navigates to the "Timeline Approvals" page from the sidebar.
6.  The Admin sees the new request in the table, showing the project name, old date, new date, and reason.
7.  The Admin clicks "Approve".
8.  The project's end date is officially updated in the database.
9.  The "Pending Approval" badge disappears from the project card.
10. The approval is logged in the project's "Timeline History" tab.
