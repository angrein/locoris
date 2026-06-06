import type {
  Asset,
  Folder,
  Goal,
  Habit,
  HabitLog,
  Note,
  Project,
  SyncDirtyEntry,
  SyncEntityKind,
  SyncShadow,
  SyncTombstone,
  Tag,
  Task,
  TimeBlock
} from "../types";

interface SyncPendingEntity {
  entityType: SyncEntityKind;
  entityId: string;
  updatedAt: number;
}

export interface SyncPendingSummary {
  total: number;
  projects: number;
  folders: number;
  tags: number;
  notes: number;
  assets: number;
  tasks: number;
  habits: number;
  habitLogs: number;
  goals: number;
  timeBlocks: number;
  deletions: number;
  lastPendingAt: number | null;
}

function getSyncEntityKey(entityType: SyncEntityKind, entityId: string) {
  return `${entityType}:${entityId}`;
}

function isEntityPending(
  entityType: SyncEntityKind,
  entityId: string,
  updatedAt: number,
  shadowsByKey: Map<string, SyncShadow>
) {
  const shadow = shadowsByKey.get(getSyncEntityKey(entityType, entityId));

  return !shadow || shadow.deleted || updatedAt > shadow.syncedAt;
}

function isTombstonePending(tombstone: SyncTombstone, shadowsByKey: Map<string, SyncShadow>) {
  const shadow = shadowsByKey.get(tombstone.key);

  return !shadow || !shadow.deleted || tombstone.deletedAt > shadow.syncedAt;
}

function addPendingEntity(
  summary: SyncPendingSummary,
  entityType: SyncEntityKind,
  updatedAt: number
) {
  summary.total += 1;
  summary.lastPendingAt = Math.max(summary.lastPendingAt ?? 0, updatedAt);

  switch (entityType) {
    case "project":
      summary.projects += 1;
      break;
    case "folder":
      summary.folders += 1;
      break;
    case "tag":
      summary.tags += 1;
      break;
    case "note":
      summary.notes += 1;
      break;
    case "asset":
      summary.assets += 1;
      break;
    case "task":
      summary.tasks += 1;
      break;
    case "habit":
      summary.habits += 1;
      break;
    case "habitLog":
      summary.habitLogs += 1;
      break;
    case "goal":
      summary.goals += 1;
      break;
    case "timeBlock":
      summary.timeBlocks += 1;
      break;
  }
}

function createEntityList(input: {
  projects: Project[];
  folders: Folder[];
  tags: Tag[];
  notes: Note[];
  assets: Asset[];
  tasks?: Task[];
  habits?: Habit[];
  habitLogs?: HabitLog[];
  goals?: Goal[];
  timeBlocks?: TimeBlock[];
}) {
  const entities: SyncPendingEntity[] = [];

  input.projects.forEach((project) => {
    entities.push({
      entityType: "project",
      entityId: project.id,
      updatedAt: project.updatedAt
    });
  });

  input.folders.forEach((folder) => {
    entities.push({
      entityType: "folder",
      entityId: folder.id,
      updatedAt: folder.updatedAt
    });
  });

  input.tags.forEach((tag) => {
    entities.push({
      entityType: "tag",
      entityId: tag.id,
      updatedAt: tag.updatedAt
    });
  });

  input.notes.forEach((note) => {
    entities.push({
      entityType: "note",
      entityId: note.id,
      updatedAt: note.updatedAt
    });
  });

  input.assets.forEach((asset) => {
    entities.push({
      entityType: "asset",
      entityId: asset.id,
      updatedAt: asset.updatedAt
    });
  });

  (input.tasks ?? []).forEach((task) => {
    entities.push({
      entityType: "task",
      entityId: task.id,
      updatedAt: task.updatedAt
    });
  });

  (input.habits ?? []).forEach((habit) => {
    entities.push({
      entityType: "habit",
      entityId: habit.id,
      updatedAt: habit.updatedAt
    });
  });

  (input.habitLogs ?? []).forEach((habitLog) => {
    entities.push({
      entityType: "habitLog",
      entityId: habitLog.id,
      updatedAt: habitLog.updatedAt
    });
  });

  (input.goals ?? []).forEach((goal) => {
    entities.push({
      entityType: "goal",
      entityId: goal.id,
      updatedAt: goal.updatedAt
    });
  });

  (input.timeBlocks ?? []).forEach((timeBlock) => {
    entities.push({
      entityType: "timeBlock",
      entityId: timeBlock.id,
      updatedAt: timeBlock.updatedAt
    });
  });

  return entities;
}

export function computePendingSyncSummary(input: {
  projects: Project[];
  folders: Folder[];
  tags: Tag[];
  notes: Note[];
  assets: Asset[];
  tasks?: Task[];
  habits?: Habit[];
  habitLogs?: HabitLog[];
  goals?: Goal[];
  timeBlocks?: TimeBlock[];
  shadows: SyncShadow[];
  tombstones: SyncTombstone[];
}): SyncPendingSummary {
  const summary: SyncPendingSummary = {
    total: 0,
    projects: 0,
    folders: 0,
    tags: 0,
    notes: 0,
    assets: 0,
    tasks: 0,
    habits: 0,
    habitLogs: 0,
    goals: 0,
    timeBlocks: 0,
    deletions: 0,
    lastPendingAt: null
  };
  const shadowsByKey = new Map(input.shadows.map((shadow) => [shadow.key, shadow]));

  createEntityList(input).forEach((entity) => {
    if (!isEntityPending(entity.entityType, entity.entityId, entity.updatedAt, shadowsByKey)) {
      return;
    }

    addPendingEntity(summary, entity.entityType, entity.updatedAt);
  });

  input.tombstones.forEach((tombstone) => {
    if (!isTombstonePending(tombstone, shadowsByKey)) {
      return;
    }

    summary.total += 1;
    summary.deletions += 1;
    summary.lastPendingAt = Math.max(summary.lastPendingAt ?? 0, tombstone.deletedAt);
  });

  return summary;
}

export function computePendingSyncSummaryFromDirtyEntries(
  dirtyEntries: readonly SyncDirtyEntry[]
): SyncPendingSummary {
  const summary: SyncPendingSummary = {
    total: 0,
    projects: 0,
    folders: 0,
    tags: 0,
    notes: 0,
    assets: 0,
    tasks: 0,
    habits: 0,
    habitLogs: 0,
    goals: 0,
    timeBlocks: 0,
    deletions: 0,
    lastPendingAt: null
  };

  dirtyEntries.forEach((entry) => {
    if (entry.deleted) {
      summary.total += 1;
      summary.deletions += 1;
      summary.lastPendingAt = Math.max(summary.lastPendingAt ?? 0, entry.updatedAt);
      return;
    }

    addPendingEntity(summary, entry.entityType, entry.updatedAt);
  });

  return summary;
}
