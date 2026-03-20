import { ReadingStatus, TaskStatus, UserRole } from "@prisma/client";

const TASK_TRANSITIONS_MANAGER: Record<TaskStatus, TaskStatus[]> = {
  [TaskStatus.OPEN]: [TaskStatus.IN_PROGRESS, TaskStatus.BLOCKED, TaskStatus.DONE, TaskStatus.CANCELED],
  [TaskStatus.IN_PROGRESS]: [TaskStatus.BLOCKED, TaskStatus.DONE, TaskStatus.OPEN, TaskStatus.CANCELED],
  [TaskStatus.BLOCKED]: [TaskStatus.IN_PROGRESS, TaskStatus.DONE, TaskStatus.OPEN, TaskStatus.CANCELED],
  [TaskStatus.DONE]: [TaskStatus.OPEN, TaskStatus.IN_PROGRESS],
  [TaskStatus.CANCELED]: [TaskStatus.OPEN],
};

const TASK_TRANSITIONS_AGENT: Record<TaskStatus, TaskStatus[]> = {
  [TaskStatus.OPEN]: [TaskStatus.IN_PROGRESS, TaskStatus.BLOCKED, TaskStatus.DONE],
  [TaskStatus.IN_PROGRESS]: [TaskStatus.BLOCKED, TaskStatus.DONE],
  [TaskStatus.BLOCKED]: [TaskStatus.IN_PROGRESS, TaskStatus.DONE],
  [TaskStatus.DONE]: [],
  [TaskStatus.CANCELED]: [],
};

const READING_TRANSITIONS_BASE: Record<ReadingStatus, ReadingStatus[]> = {
  [ReadingStatus.DRAFT]: [ReadingStatus.PENDING],
  [ReadingStatus.PENDING]: [ReadingStatus.VALIDATED, ReadingStatus.FLAGGED, ReadingStatus.REJECTED, ReadingStatus.RESUBMISSION_REQUESTED],
  [ReadingStatus.FLAGGED]: [ReadingStatus.VALIDATED, ReadingStatus.REJECTED, ReadingStatus.RESUBMISSION_REQUESTED, ReadingStatus.PENDING],
  [ReadingStatus.REJECTED]: [ReadingStatus.RESUBMISSION_REQUESTED, ReadingStatus.PENDING],
  [ReadingStatus.VALIDATED]: [],
  [ReadingStatus.RESUBMISSION_REQUESTED]: [ReadingStatus.PENDING, ReadingStatus.FLAGGED, ReadingStatus.REJECTED, ReadingStatus.VALIDATED],
  [ReadingStatus.CLOSED]: [],
};

function isManager(role: UserRole) {
  return role === UserRole.ADMIN || role === UserRole.SUPERVISOR;
}

export function isTaskTransitionAllowed(
  role: UserRole,
  from: TaskStatus,
  to: TaskStatus,
) {
  if (from === to) return true;
  const matrix = isManager(role) ? TASK_TRANSITIONS_MANAGER : TASK_TRANSITIONS_AGENT;
  return matrix[from].includes(to);
}

export function isReadingTransitionAllowed(
  role: UserRole,
  from: ReadingStatus,
  to: ReadingStatus,
) {
  if (from === to) return true;
  if (role === UserRole.ADMIN) {
    if (from === ReadingStatus.CLOSED) return false;
    return true;
  }
  return READING_TRANSITIONS_BASE[from].includes(to);
}

