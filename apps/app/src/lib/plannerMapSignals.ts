import type { Project, Task } from "../types";
import {
  getEndOfLocalDay,
  getStartOfLocalDay,
  isPlannerTaskActive
} from "./planner";
import {
  getPlannerTaskOccurrencesForRange,
  type PlannerTaskOccurrence
} from "./plannerRecurrence";

export type PlannerProjectTemporalHealth = "calm" | "active" | "attention" | "critical";
export type PlannerProjectOverdueSeverity = "none" | "low" | "medium" | "high";

export interface PlannerProjectTemporalSignal {
  projectId: string;
  todayCount: number;
  overdueCount: number;
  upcomingCount: number;
  focusCount: number;
  activeCount: number;
  nearestDueAt: number | null;
  overdueNearestAt: number | null;
  overdueSeverity: PlannerProjectOverdueSeverity;
  milestoneTaskId: string | null;
  milestoneTitle: string | null;
  milestoneAt: number | null;
  health: PlannerProjectTemporalHealth;
}

export interface PlannerMapSignalsModel {
  byProjectId: Map<string, PlannerProjectTemporalSignal>;
  totalToday: number;
  totalOverdue: number;
  totalMilestones: number;
}

const UPCOMING_WINDOW_DAYS = 7;
const OVERDUE_LOOKBACK_DAYS = 365;

const EMPTY_SIGNAL: Omit<PlannerProjectTemporalSignal, "projectId"> = {
  todayCount: 0,
  overdueCount: 0,
  upcomingCount: 0,
  focusCount: 0,
  activeCount: 0,
  nearestDueAt: null,
  overdueNearestAt: null,
  overdueSeverity: "none",
  milestoneTaskId: null,
  milestoneTitle: null,
  milestoneAt: null,
  health: "calm"
};

function isMilestoneCandidate(task: Task) {
  return task.kind === "milestone" || task.priority === "urgent" || task.priority === "high";
}

function createSignal(projectId: string): PlannerProjectTemporalSignal {
  return {
    projectId,
    ...EMPTY_SIGNAL
  };
}

function isOccurrenceToday(occurrence: PlannerTaskOccurrence, startOfToday: number, endOfToday: number) {
  return occurrence.startAt <= endOfToday && occurrence.endAt >= startOfToday;
}

function isOccurrenceOverdue(occurrence: PlannerTaskOccurrence, startOfToday: number) {
  return occurrence.endAt < startOfToday;
}

function getOccurrenceAnchor(occurrence: PlannerTaskOccurrence) {
  return occurrence.dueAt ?? occurrence.scheduledStartAt ?? occurrence.startAt;
}

function updateNearest(signal: PlannerProjectTemporalSignal, occurrence: PlannerTaskOccurrence, upcomingEndAt: number) {
  const anchor = getOccurrenceAnchor(occurrence);

  if (anchor > upcomingEndAt) {
    return;
  }

  signal.nearestDueAt =
    signal.nearestDueAt === null ? anchor : Math.min(signal.nearestDueAt, anchor);
}

function updateMilestone(signal: PlannerProjectTemporalSignal, task: Task, occurrence: PlannerTaskOccurrence, startOfToday: number) {
  if (!isMilestoneCandidate(task) || occurrence.startAt < startOfToday) {
    return;
  }

  const milestoneAt = getOccurrenceAnchor(occurrence);
  const betterMilestone =
    signal.milestoneAt === null ||
    milestoneAt < signal.milestoneAt ||
    (milestoneAt === signal.milestoneAt && task.priority === "urgent");

  if (!betterMilestone) {
    return;
  }

  signal.milestoneTaskId = task.id;
  signal.milestoneTitle = task.title;
  signal.milestoneAt = milestoneAt;
}

function resolveOverdueSeverity(overdueCount: number): PlannerProjectOverdueSeverity {
  if (overdueCount >= 5) {
    return "high";
  }

  if (overdueCount >= 2) {
    return "medium";
  }

  if (overdueCount > 0) {
    return "low";
  }

  return "none";
}

function resolveHealth(signal: PlannerProjectTemporalSignal): PlannerProjectTemporalHealth {
  if (signal.overdueSeverity === "high" || (signal.overdueCount > 0 && signal.focusCount > 0)) {
    return "critical";
  }

  if (signal.overdueCount > 0) {
    return "attention";
  }

  if (signal.todayCount > 0 || signal.focusCount > 0 || signal.milestoneTaskId) {
    return "active";
  }

  return "calm";
}

export function buildPlannerMapSignals(input: {
  projects: Project[];
  tasks: Task[];
  now?: number;
}): PlannerMapSignalsModel {
  const now = input.now ?? Date.now();
  const startOfToday = getStartOfLocalDay(now);
  const endOfToday = getEndOfLocalDay(now);
  const upcomingEndAt = getEndOfLocalDay(
    startOfToday + UPCOMING_WINDOW_DAYS * 24 * 60 * 60 * 1000
  );
  const occurrenceRangeStartAt = getStartOfLocalDay(
    startOfToday - OVERDUE_LOOKBACK_DAYS * 24 * 60 * 60 * 1000
  );
  const projectIds = new Set(input.projects.map((project) => project.id));
  const byProjectId = new Map<string, PlannerProjectTemporalSignal>();

  const ensureSignal = (projectId: string) => {
    const existing = byProjectId.get(projectId);

    if (existing) {
      return existing;
    }

    const signal = createSignal(projectId);
    byProjectId.set(projectId, signal);
    return signal;
  };

  input.tasks.forEach((task) => {
    if (!isPlannerTaskActive(task) || !task.projectId || !projectIds.has(task.projectId)) {
      return;
    }

    const signal = ensureSignal(task.projectId);
    signal.activeCount += 1;

    if (task.status === "inProgress") {
      signal.focusCount += 1;
    }

    const occurrences = getPlannerTaskOccurrencesForRange(task, occurrenceRangeStartAt, upcomingEndAt);
    occurrences.forEach((occurrence) => {
      if (occurrence.completed || occurrence.skipped) {
        return;
      }

      updateNearest(signal, occurrence, upcomingEndAt);
      updateMilestone(signal, task, occurrence, startOfToday);

      if (isOccurrenceOverdue(occurrence, startOfToday)) {
        const overdueAt = getOccurrenceAnchor(occurrence);
        signal.overdueCount += 1;
        signal.overdueNearestAt =
          signal.overdueNearestAt === null ? overdueAt : Math.min(signal.overdueNearestAt, overdueAt);
        return;
      }

      if (isOccurrenceToday(occurrence, startOfToday, endOfToday)) {
        signal.todayCount += 1;
        return;
      }

      if (occurrence.startAt > endOfToday && occurrence.startAt <= upcomingEndAt) {
        signal.upcomingCount += 1;
      }
    });
  });

  byProjectId.forEach((signal) => {
    signal.overdueSeverity = resolveOverdueSeverity(signal.overdueCount);
    signal.health = resolveHealth(signal);
  });

  return {
    byProjectId,
    totalToday: Array.from(byProjectId.values()).reduce((sum, signal) => sum + signal.todayCount, 0),
    totalOverdue: Array.from(byProjectId.values()).reduce((sum, signal) => sum + signal.overdueCount, 0),
    totalMilestones: Array.from(byProjectId.values()).filter((signal) => signal.milestoneTaskId).length
  };
}
