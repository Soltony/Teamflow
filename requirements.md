# NIB EPMO - Software Requirements Specification

## 1. Introduction

This document outlines the functional and non-functional requirements for the NIB Enterprise Project Management Office (EPMO) application. The system will serve as a centralized platform for managing, tracking, and reporting on all projects within the organization.

## 2. Functional Requirements

### 2.1. User Management
- **FR-001:** The system shall support user registration and login via an external authentication service.
- **FR-002:** The system shall have at least three default user roles: Admin, Project Manager, and Member.
- **FR-003:** Admins shall be able to create, edit, delete, and assign roles to users.
- **FR-004:** The system must support a flexible Role-Based Access Control (RBAC) system where permissions can be assigned to roles.

### 2.2. Project Management
- **FR-005:** Authorized users (e.g., Project Managers) shall be able to create new projects, providing details such as name, description, start/end dates, owning EPMO division, and responsible departments.
- **FR-006:** Users shall be able to view a list of all projects they have permission to see.
- **FR-007:** Authorized users shall be able to edit the details of existing projects.
- **FR-008:** The system shall support archiving of completed or handed-over projects. Archived projects should be viewable on a separate "Archive" page.
- **FR-009:** The system shall track the status of projects (e.g., Active, Pending, Completed). Admins shall be able to manage the list of available statuses.

### 2.3. Milestone and Task Management
- **FR-010:** Authorized users shall be able to define and manage milestones for each project. Each milestone must have a title, description, start/due date, and a weight (percentage).
- **FR-011:** The sum of all milestone weights for a single project must equal 100%.
- **FR-012:** Authorized users shall be able to create, edit, and delete tasks within a milestone.
- **FR-013:** Each task must have a title, start/end date, status (e.g., TODO, IN_PROGRESS, DONE), and assigned users.
- **FR-014:** Users assigned to a task shall be able to post progress updates and change the task's status.

### 2.4. Reporting and Dashboards
- **FR-015:** The main dashboard shall display key performance indicators (KPIs), such as On-Time Completion Rate, Number of Overdue Projects, and Active Blockers.
- **FR-016:** The dashboard shall include charts visualizing project distribution by status, owning division, and responsible department.
- **FR-017:** A "CEO Report" page shall provide a high-level portfolio overview, including KPI summaries and a list of at-risk projects.
- **FR-018:** The system shall provide a Gantt chart view to visualize project and milestone timelines.

### 2.5. Governance and Workflow
- **FR-019:** The system shall implement a workflow for project deadline changes.
  - **FR-019.1:** A user changing a project's deadline must provide a reason.
  - **FR-019.2:** The change request must be submitted for approval.
  - **FR-019.3:** Authorized approvers shall have a dedicated interface to view, approve, or reject timeline change requests.
  - **FR-019.4:** The project's deadline is only updated upon approval.
  - **FR-019.5:** All timeline change requests and their outcomes shall be logged and viewable.
- **FR-020:** The system shall track project costs and manage payment schedules.
  - **FR-020.1:** Users can define a total cost and payment schedule for a project.
  - **FR-020.2:** Payment requests shall go through an approval workflow.

### 2.6. Organizational Structure Management
- **FR-021:** Admins shall be able to create, edit, and delete EPMO Divisions.
- **FR-022:** Admins shall be able to create, edit, and delete Departments.
- **FR-023:** Admins shall be able to create and manage project-specific Teams, assigning a lead and members.

## 3. Non-Functional Requirements

### 3.1. Performance
- **NFR-001:** All pages must load within 3 seconds on a standard broadband connection.
- **NFR-002:** Server response time for API calls should be under 500ms for 95% of requests.

### 3.2. Usability
- **NFR-003:** The application must be responsive and fully functional on modern web browsers on desktop, tablet, and mobile devices.
- **NFR-004:** The user interface shall be intuitive and consistent across the application.
- **NFR-005:** The system shall provide clear feedback to users for actions (e.g., success messages, error notifications).

### 3.3. Security
- **NFR-006:** All communication between the client and server must be encrypted using HTTPS.
- **NFR-007:** The application must enforce role-based access control on both the frontend (hiding UI elements) and backend (protecting server actions).
- **NFR-008:** User sessions should time out after a period of inactivity (e.g., 15 minutes) to prevent unauthorized access.

### 3.4. Scalability
- **NFR-009:** The application architecture should be able to handle a 50% increase in users and projects over one year without significant performance degradation.

### 3.5. Maintainability
- **NFR-010:** The codebase must be well-documented, with clear comments for complex logic.
- **NFR-011:** The application shall follow a consistent coding style and structure.
