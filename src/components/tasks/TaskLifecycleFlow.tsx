"use client";

import { useMemo, useState } from "react";
import { Background, Controls, Edge, MarkerType, Node, ReactFlow } from "@xyflow/react";
import { TaskStatus } from "@prisma/client";
import { useRouter } from "next/navigation";

type TaskLifecycleFlowProps = {
  taskId: string;
  currentStatus: TaskStatus;
  canCancel: boolean;
};

type TransitionMap = Record<TaskStatus, TaskStatus[]>;

const BASE_TRANSITIONS: TransitionMap = {
  [TaskStatus.OPEN]: [TaskStatus.IN_PROGRESS, TaskStatus.BLOCKED, TaskStatus.DONE],
  [TaskStatus.IN_PROGRESS]: [TaskStatus.BLOCKED, TaskStatus.DONE, TaskStatus.OPEN],
  [TaskStatus.BLOCKED]: [TaskStatus.IN_PROGRESS, TaskStatus.DONE, TaskStatus.OPEN],
  [TaskStatus.DONE]: [TaskStatus.IN_PROGRESS],
  [TaskStatus.CANCELED]: [TaskStatus.OPEN],
};

function transitionsForRole(canCancel: boolean): TransitionMap {
  if (!canCancel) return BASE_TRANSITIONS;
  return {
    ...BASE_TRANSITIONS,
    [TaskStatus.OPEN]: [...BASE_TRANSITIONS[TaskStatus.OPEN], TaskStatus.CANCELED],
    [TaskStatus.IN_PROGRESS]: [...BASE_TRANSITIONS[TaskStatus.IN_PROGRESS], TaskStatus.CANCELED],
    [TaskStatus.BLOCKED]: [...BASE_TRANSITIONS[TaskStatus.BLOCKED], TaskStatus.CANCELED],
  };
}

const POSITIONS: Record<TaskStatus, { x: number; y: number }> = {
  [TaskStatus.OPEN]: { x: 30, y: 130 },
  [TaskStatus.IN_PROGRESS]: { x: 300, y: 30 },
  [TaskStatus.BLOCKED]: { x: 300, y: 230 },
  [TaskStatus.DONE]: { x: 570, y: 30 },
  [TaskStatus.CANCELED]: { x: 570, y: 230 },
};

function labelForStatus(status: TaskStatus) {
  if (status === TaskStatus.IN_PROGRESS) return "IN PROGRESS";
  return status;
}

export default function TaskLifecycleFlow({ taskId, currentStatus, canCancel }: TaskLifecycleFlowProps) {
  const router = useRouter();
  const [busyTarget, setBusyTarget] = useState<TaskStatus | null>(null);
  const [error, setError] = useState<string>("");

  const transitions = useMemo(() => transitionsForRole(canCancel), [canCancel]);
  const allowedTargets = useMemo(() => new Set(transitions[currentStatus] || []), [transitions, currentStatus]);

  const nodes = useMemo<Node[]>(() => {
    const statuses = Object.values(TaskStatus);
    return statuses.map((status) => {
      const isCurrent = status === currentStatus;
      const canTransition = allowedTargets.has(status);
      const isBusy = busyTarget === status;

      return {
        id: status,
        position: POSITIONS[status],
        data: { label: labelForStatus(status) },
        style: {
          width: 180,
          borderRadius: 12,
          border: isCurrent
            ? "2px solid #465fff"
            : canTransition
            ? "1px solid #22c55e"
            : "1px solid #334155",
          background: isCurrent ? "#1e3a8a" : "#0f172a",
          color: "#e5e7eb",
          fontSize: 12,
          fontWeight: 700,
          textAlign: "center",
          padding: "12px 8px",
          boxShadow: isCurrent ? "0 0 0 3px rgba(70,95,255,0.25)" : undefined,
          opacity: isBusy ? 0.5 : 1,
          cursor: canTransition ? "pointer" : "default",
        },
      };
    });
  }, [allowedTargets, busyTarget, currentStatus]);

  const edges = useMemo<Edge[]>(() => {
    const list: Edge[] = [];
    (Object.keys(transitions) as TaskStatus[]).forEach((from) => {
      transitions[from].forEach((to) => {
        const isActive = from === currentStatus;
        list.push({
          id: `${from}-${to}`,
          source: from,
          target: to,
          markerEnd: { type: MarkerType.ArrowClosed, width: 16, height: 16 },
          animated: isActive,
          style: {
            stroke: isActive ? "#22c55e" : "#475569",
            strokeWidth: isActive ? 2.5 : 1.2,
          },
        });
      });
    });
    return list;
  }, [currentStatus, transitions]);

  const onTransition = async (nextStatus: TaskStatus) => {
    if (busyTarget || nextStatus === currentStatus || !allowedTargets.has(nextStatus)) return;
    setError("");
    setBusyTarget(nextStatus);

    try {
      const response = await fetch(`/api/v1/tasks/${taskId}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ status: nextStatus }),
      });

      const data = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) {
        throw new Error(data.error || "status_update_failed");
      }

      router.replace(`/admin/tasks/${taskId}?status_updated=1`, { scroll: false });
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "status_update_failed");
    } finally {
      setBusyTarget(null);
    }
  };

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
        <span className="inline-flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-full bg-brand-500" /> Current</span>
        <span className="inline-flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-full bg-success-500" /> Available transition</span>
        <span>Click a green step to move task status.</span>
      </div>

      {error ? (
        <div className="mb-3 rounded-lg border border-error-200 bg-error-50 px-3 py-2 text-xs text-error-700 dark:border-error-500/30 dark:bg-error-500/10 dark:text-error-300">
          {error}
        </div>
      ) : null}

      <div className="h-[360px] overflow-hidden rounded-xl border border-gray-200 dark:border-gray-700">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          fitView
          fitViewOptions={{ padding: 0.2 }}
          onNodeClick={(_, node) => onTransition(node.id as TaskStatus)}
          nodesDraggable={false}
          nodesConnectable={false}
          elementsSelectable={false}
          panOnDrag={false}
          zoomOnScroll={false}
          zoomOnPinch={false}
          zoomOnDoubleClick={false}
          proOptions={{ hideAttribution: true }}
        >
          <Background color="#334155" gap={24} size={1} />
          <Controls showInteractive={false} position="bottom-right" />
        </ReactFlow>
      </div>
    </div>
  );
}
