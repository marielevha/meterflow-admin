import { fetchAgentJson } from '@/lib/api/agent-client';

export type AgentMissionFilter = 'ALL' | 'TODAY' | 'OVERDUE' | 'IN_PROGRESS' | 'DONE';
export type AgentMissionResolutionCode =
  | 'READING_CONFIRMED'
  | 'READING_IMPOSSIBLE'
  | 'METER_INACCESSIBLE'
  | 'METER_DAMAGED_OR_MISSING'
  | 'SUSPECTED_FRAUD'
  | 'CUSTOMER_ABSENT'
  | 'ESCALATION_REQUIRED';

export type AgentMissionSummary = {
  allCount: number;
  todayCount: number;
  overdueCount: number;
  inProgressCount: number;
  doneCount: number;
};

export type AgentMission = {
  id: string;
  type: string;
  status: string;
  priority: string;
  resolutionCode: AgentMissionResolutionCode | null;
  title: string;
  description: string | null;
  dueAt: string | null;
  startedAt: string | null;
  closedAt: string | null;
  createdAt: string;
  updatedAt: string;
  isToday: boolean;
  isOverdue: boolean;
  hasFieldReport: boolean;
  customer: {
    id: string | null;
    name: string;
    phone: string | null;
  };
  meter: {
    id: string | null;
    type: string | null;
    serialNumber: string;
    meterReference: string | null;
    city: string | null;
    zone: string | null;
    addressLabel: string;
  };
  reading: {
    id: string;
    status: string;
    readingAt: string | null;
  } | null;
};

export type AgentMissionDetail = {
  id: string;
  type: string;
  status: string;
  priority: string;
  resolutionCode: AgentMissionResolutionCode | null;
  title: string;
  description: string | null;
  resolutionComment: string | null;
  dueAt: string | null;
  startedAt: string | null;
  fieldSubmittedAt: string | null;
  closedAt: string | null;
  createdAt: string;
  updatedAt: string;
  client: {
    id: string | null;
    name: string;
    phone: string | null;
  };
  meter: {
    id: string | null;
    type: string | null;
    serialNumber: string;
    meterReference: string | null;
    city: string | null;
    zone: string | null;
    addressLabel: string;
  };
  reading: {
    id: string;
    status: string;
    readingAt: string | null;
    primaryIndex: number | null;
    secondaryIndex: number | null;
  } | null;
  reportedReading: {
    id: string;
    status: string;
    readingAt: string | null;
    primaryIndex: number | null;
    secondaryIndex: number | null;
  } | null;
  fieldReport: {
    resolutionCode: AgentMissionResolutionCode | null;
    comment: string | null;
    submittedAt: string | null;
    startedAt: string | null;
    startedByName: string;
    primaryIndex: number | null;
    secondaryIndex: number | null;
    imageUrl: string | null;
    imageMimeType: string | null;
    imageSizeBytes: number | null;
    gpsLatitude: number | null;
    gpsLongitude: number | null;
    gpsAccuracyMeters: number | null;
  } | null;
  assignedTo: {
    id: string | null;
    name: string;
  };
  createdBy: {
    id: string | null;
    name: string;
  };
  closedBy: {
    id: string | null;
    name: string;
  };
  startedBy: {
    id: string | null;
    name: string;
  };
  items: Array<{
    id: string;
    title: string;
    details: string | null;
    status: string;
    sortOrder: number;
    completedAt: string | null;
    createdAt: string;
    updatedAt: string;
    completedBy: {
      id: string;
      firstName: string | null;
      lastName: string | null;
      username: string | null;
      role: string;
    } | null;
  }>;
  comments: Array<{
    id: string;
    comment: string;
    isInternal: boolean;
    createdAt: string;
    updatedAt: string;
    user: {
      id: string;
      firstName: string | null;
      lastName: string | null;
      username: string | null;
      role: string;
    };
  }>;
  attachments: Array<{
    id: string;
    fileUrl: string;
    fileName: string;
    mimeType: string | null;
    fileHash: string | null;
    fileSizeBytes: number | null;
    createdAt: string;
    uploadedBy: {
      id: string;
      firstName: string | null;
      lastName: string | null;
      username: string | null;
      role: string;
    };
  }>;
  timeline: Array<{
    id: string;
    at: string;
    type: string;
    label: string;
  }>;
};

export type SubmitAgentMissionResultPayload = {
  resolutionCode: AgentMissionResolutionCode;
  comment?: string;
  readingAt: string;
  primaryIndex?: number;
  secondaryIndex?: number;
  imageUrl: string;
  imageHash?: string;
  imageMimeType: string;
  imageSizeBytes: number;
  gpsLatitude: number;
  gpsLongitude: number;
  gpsAccuracyMeters?: number;
};

export async function listAgentTasks(options?: {
  filter?: AgentMissionFilter;
  page?: number;
  pageSize?: number;
}) {
  const searchParams = new URLSearchParams();

  if (options?.filter && options.filter !== 'ALL') {
    searchParams.set('filter', options.filter);
  }
  if (options?.page) {
    searchParams.set('page', String(options.page));
  }
  if (options?.pageSize) {
    searchParams.set('pageSize', String(options.pageSize));
  }

  const query = searchParams.toString();
  return fetchAgentJson<{
    filter: AgentMissionFilter;
    summary: AgentMissionSummary;
    missions: AgentMission[];
    pagination: {
      page: number;
      pageSize: number;
      total: number;
      totalPages: number;
    };
  }>({
    path: `/api/v1/agent-mobile/tasks${query ? `?${query}` : ''}`,
  });
}

export async function getAgentTaskDetail(taskId: string) {
  return fetchAgentJson<{
    mission: AgentMissionDetail;
  }>({
    path: `/api/v1/agent-mobile/tasks/${taskId}`,
  });
}

export async function startAgentTask(taskId: string) {
  return fetchAgentJson<{
    message: string;
    task: {
      id: string;
      status: string;
      startedAt: string | null;
      updatedAt: string;
    };
  }>({
    path: `/api/v1/agent-mobile/tasks/${taskId}/start`,
    method: 'POST',
    body: {},
  });
}

export async function transitionAgentTask(taskId: string, status: 'IN_PROGRESS' | 'BLOCKED' | 'DONE') {
  return fetchAgentJson<{
    message: string;
    task: {
      id: string;
      status: string;
      startedAt: string | null;
      closedAt: string | null;
      updatedAt: string;
    };
  }>({
    path: `/api/v1/agent-mobile/tasks/${taskId}/transition`,
    method: 'POST',
    body: { status },
  });
}

export async function submitAgentTaskResult(taskId: string, payload: SubmitAgentMissionResultPayload) {
  return fetchAgentJson<{
    message: string;
    task: {
      id: string;
      status: string;
      resolutionCode: AgentMissionResolutionCode | null;
      fieldSubmittedAt: string | null;
      reportedReadingId: string | null;
    };
  }>({
    path: `/api/v1/agent-mobile/tasks/${taskId}/result`,
    method: 'POST',
    body: payload,
  });
}
