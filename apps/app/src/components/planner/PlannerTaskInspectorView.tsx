import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";

import type { AppLanguage, Folder, Note, PlannerTaskPriority, Project, Reminder, Tag, Task } from "../../types";
import { getDisplayNoteTitle } from "../../lib/displayNames";
import {
  formatPlannerFullDateTime,
  getPlannerPriorityLabel,
  getPlannerStatusLabel
} from "../../lib/planner";
import {
  buildRescheduleOccurrencePatch,
  buildRescheduleRecurringSeriesPatch,
  getPlannerTaskPrimaryOccurrence,
  isRecurringPlannerRule
} from "../../lib/plannerRecurrence";
import {
  buildPlannerTaskSchedulePatch,
  getPlannerTaskDateDraft,
  getPlannerTaskScheduleSummary,
  type PlannerTaskDateDraft
} from "../../lib/plannerTaskSchedule";
import TagInputField from "../TagInputField";
import PlannerDateDialog from "./PlannerDateDialog";
import "./PlannerTaskInspector.css";

interface PlannerTaskInspectorViewProps {
  task: Task | null;
  projects: Project[];
  folders: Folder[];
  notes: Note[];
  tags: Tag[];
  language: AppLanguage;
  isMobile?: boolean;
  onUpdate: (taskId: string, patch: Partial<Task>) => Promise<void> | void;
  onToggleDone: (taskId: string, done: boolean, occurrenceStartAt?: number) => Promise<void> | void;
  onDelete: (taskId: string) => Promise<void> | void;
  onOpenNote?: (noteId: string) => void;
  onOpenProjectMap?: (projectId: string) => void;
  onCreateTag?: (name: string) => Promise<Tag>;
  onClose?: () => void;
}

type PlannerBacklink = {
  key: string;
  kind: "project" | "folder" | "note" | "canvas" | "block" | "canvasElement" | "url";
  title: string;
  subtitle: string;
  projectId?: string | null;
  noteId?: string | null;
  url?: string | null;
};

const PRIORITIES: PlannerTaskPriority[] = ["none", "low", "medium", "high", "urgent"];
const STATUSES: Task["status"][] = ["inbox", "todo", "scheduled", "inProgress", "waiting", "done", "canceled"];
const REMINDER_PRESETS = ["none", "0", "15", "60", "1440"] as const;

type PlannerReminderPreset = (typeof REMINDER_PRESETS)[number];
type PlannerTaskDateScope = "this" | "future" | "all";
type PlannerTaskScopedDateAction = {
  originalStartAt: number;
  currentStartAt: number;
  nextStartAt: number;
  nextEndAt: number | null;
};

function getBacklinkKindLabel(kind: PlannerBacklink["kind"], language: AppLanguage) {
  const labels =
    language === "ru"
      ? {
          project: "Проект",
          folder: "Папка",
          note: "Заметка",
          canvas: "Холст",
          block: "Блок",
          canvasElement: "Элемент",
          url: "Ссылка"
        }
      : {
          project: "Project",
          folder: "Folder",
          note: "Note",
          canvas: "Canvas",
          block: "Block",
          canvasElement: "Element",
          url: "Link"
        };

  return labels[kind];
}

function getShortId(value: string | null | undefined) {
  return value ? value.slice(0, 8) : "";
}

function shiftLocalDay(value: number, days: number) {
  const date = new Date(value);
  date.setDate(date.getDate() + days);
  return date.getTime();
}

function getBacklinkCanonicalKey(input: {
  kind: PlannerBacklink["kind"];
  projectId?: string | null;
  folderId?: string | null;
  noteId?: string | null;
  canvasId?: string | null;
  sourceBlockId?: string | null;
  canvasElementId?: string | null;
  url?: string | null;
  fallbackId?: string | null;
}) {
  if (input.kind === "project" && input.projectId) {
    return `project:${input.projectId}`;
  }

  if (input.kind === "folder" && input.folderId) {
    return `folder:${input.folderId}`;
  }

  if (input.kind === "note" && input.noteId) {
    return `note:${input.noteId}`;
  }

  if (input.kind === "canvas" && input.canvasId) {
    return `canvas:${input.canvasId}`;
  }

  if (input.kind === "block" && input.sourceBlockId) {
    return `block:${input.sourceBlockId}`;
  }

  if (input.kind === "canvasElement" && input.canvasElementId) {
    return `canvasElement:${input.canvasElementId}`;
  }

  if (input.kind === "url" && input.url) {
    return `url:${input.url}`;
  }

  return `${input.kind}:${input.fallbackId ?? ""}`;
}

function buildPlannerBacklinks(input: {
  task: Task;
  projects: Project[];
  folders: Folder[];
  notes: Note[];
  language: AppLanguage;
}) {
  const { task, projects, folders, notes, language } = input;
  const projectMap = new Map(projects.map((project) => [project.id, project]));
  const folderMap = new Map(folders.map((folder) => [folder.id, folder]));
  const noteMap = new Map(notes.map((note) => [note.id, note]));
  const backlinks: PlannerBacklink[] = [];
  const seenKeys = new Set<string>();
  const addBacklink = (backlink: PlannerBacklink) => {
    if (seenKeys.has(backlink.key)) {
      return;
    }

    seenKeys.add(backlink.key);
    backlinks.push(backlink);
  };

  if (task.projectId) {
    const project = projectMap.get(task.projectId);
    addBacklink({
      key: `project:${task.projectId}`,
      kind: "project",
      title: project?.name ?? (language === "ru" ? "Проект" : "Project"),
      subtitle: getBacklinkKindLabel("project", language),
      projectId: task.projectId
    });
  }

  if (task.folderId) {
    const folder = folderMap.get(task.folderId);
    addBacklink({
      key: `folder:${task.folderId}`,
      kind: "folder",
      title: folder?.name ?? (language === "ru" ? "Папка" : "Folder"),
      subtitle: getBacklinkKindLabel("folder", language)
    });
  }

  if (task.noteId) {
    const note = noteMap.get(task.noteId);
    addBacklink({
      key: `note:${task.noteId}`,
      kind: "note",
      title: note ? getDisplayNoteTitle(note, language) : language === "ru" ? "Заметка" : "Note",
      subtitle: getBacklinkKindLabel("note", language),
      noteId: task.noteId
    });
  }

  if (task.canvasId) {
    const canvas = noteMap.get(task.canvasId);
    addBacklink({
      key: `canvas:${task.canvasId}`,
      kind: "canvas",
      title: canvas ? getDisplayNoteTitle(canvas, language) : language === "ru" ? "Холст" : "Canvas",
      subtitle: getBacklinkKindLabel("canvas", language),
      noteId: task.canvasId
    });
  }

  if (task.sourceBlockId) {
    const sourceLink = (task.links ?? []).find((link) => link.kind === "block" && link.sourceBlockId === task.sourceBlockId);
    addBacklink({
      key: `block:${task.sourceBlockId}`,
      kind: "block",
      title: sourceLink?.label || (language === "ru" ? `Блок ${getShortId(task.sourceBlockId)}` : `Block ${getShortId(task.sourceBlockId)}`),
      subtitle: language === "ru" ? "Исходный блок заметки" : "Source note block",
      noteId: task.noteId
    });
  }

  if (task.canvasElementId) {
    const sourceLink = (task.links ?? []).find(
      (link) => link.kind === "canvasElement" && link.canvasElementId === task.canvasElementId
    );
    addBacklink({
      key: `canvasElement:${task.canvasElementId}`,
      kind: "canvasElement",
      title: sourceLink?.label || (language === "ru" ? `Элемент ${getShortId(task.canvasElementId)}` : `Element ${getShortId(task.canvasElementId)}`),
      subtitle: language === "ru" ? "Исходный объект холста" : "Source canvas object",
      noteId: task.canvasId
    });
  }

  (task.links ?? []).forEach((link) => {
    const key = getBacklinkCanonicalKey({
      kind: link.kind,
      projectId: link.projectId,
      folderId: link.folderId,
      noteId: link.noteId,
      canvasId: link.canvasId,
      sourceBlockId: link.sourceBlockId,
      canvasElementId: link.canvasElementId,
      url: link.url,
      fallbackId: link.id
    });

    addBacklink({
      key,
      kind: link.kind,
      title: link.label || getBacklinkKindLabel(link.kind, language),
      subtitle: getBacklinkKindLabel(link.kind, language),
      projectId: link.projectId,
      noteId: link.noteId ?? link.canvasId,
      url: link.url
    });
  });

  return backlinks;
}

function getReminderPreset(task: Task): PlannerReminderPreset {
  const enabledReminder = (task.reminders ?? []).find((reminder) => reminder.enabled);

  if (!enabledReminder) {
    return "none";
  }

  if (enabledReminder.offsetMinutes !== null) {
    const offset = String(enabledReminder.offsetMinutes);
    return REMINDER_PRESETS.includes(offset as PlannerReminderPreset) ? (offset as PlannerReminderPreset) : "15";
  }

  return "0";
}

function getReminderLabel(preset: PlannerReminderPreset, language: AppLanguage) {
  if (language === "ru") {
    return {
      none: "Нет",
      "0": "В момент",
      "15": "За 15 мин",
      "60": "За час",
      "1440": "За день"
    }[preset];
  }

  return {
    none: "None",
    "0": "At time",
    "15": "15 min",
    "60": "1 hour",
    "1440": "1 day"
  }[preset];
}

function buildReminder(task: Task, preset: PlannerReminderPreset, language: AppLanguage): Reminder[] {
  if (preset === "none") {
    return [];
  }

  const offsetMinutes = Number(preset);
  const baseAt = task.scheduledStartAt ?? (task.dueAt ? task.dueAt + 9 * 60 * 60_000 : null);

  if (!baseAt) {
    return task.reminders ?? [];
  }

  const timestamp = Date.now();

  return [
    {
      id: crypto.randomUUID(),
      title: language === "ru" ? "Напоминание" : "Reminder",
      remindAt: task.scheduledStartAt ? null : baseAt - offsetMinutes * 60_000,
      offsetMinutes,
      channel: "system",
      enabled: true,
      createdAt: timestamp,
      updatedAt: timestamp
    }
  ];
}

export default function PlannerTaskInspectorView({
  task,
  projects,
  folders,
  notes,
  tags,
  language,
  isMobile = false,
  onUpdate,
  onToggleDone,
  onDelete,
  onOpenNote,
  onOpenProjectMap,
  onCreateTag,
  onClose
}: PlannerTaskInspectorViewProps) {
  const [titleDraft, setTitleDraft] = useState(task?.title ?? "");
  const [descriptionDraft, setDescriptionDraft] = useState(task?.description ?? "");
  const [deleteArmed, setDeleteArmed] = useState(false);
  const [isDateSelectorOpen, setIsDateSelectorOpen] = useState(false);
  const [isReminderPickerOpen, setIsReminderPickerOpen] = useState(false);
  const [scopedDateAction, setScopedDateAction] = useState<PlannerTaskScopedDateAction | null>(null);

  useEffect(() => {
    setTitleDraft(task?.title ?? "");
    setDescriptionDraft(task?.description ?? "");
    setDeleteArmed(false);
    setIsDateSelectorOpen(false);
    setIsReminderPickerOpen(false);
    setScopedDateAction(null);
  }, [task?.description, task?.id, task?.title]);

  const projectMap = useMemo(() => new Map(projects.map((project) => [project.id, project])), [projects]);
  const selectedProject = task?.projectId ? projectMap.get(task.projectId) ?? null : null;
  const backlinks = useMemo(
    () => (task ? buildPlannerBacklinks({ task, projects, folders, notes, language }) : []),
    [folders, language, notes, projects, task]
  );

  if (!task) {
    return (
      <aside className={`planner-task-inspector planner-task-panel is-empty ${isMobile ? "is-mobile-sheet" : ""}`}>
        <div className="planner-task-panel-empty">
          <span className="planner-task-panel-kicker">{language === "ru" ? "Инспектор" : "Inspector"}</span>
          <h2>{language === "ru" ? "Выбери задачу" : "Select a task"}</h2>
          <p>
            {language === "ru"
              ? "Здесь появятся статус, дата, напоминания, теги и связи с контекстом."
              : "Status, date, reminders, tags, and linked context will appear here."}
          </p>
        </div>
      </aside>
    );
  }

  const done = task.status === "done" || Boolean(task.completedAt);
  const scheduleDraft = getPlannerTaskDateDraft(task);
  const scheduleSummary = getPlannerTaskScheduleSummary(task, language);
  const reminderPreset = getReminderPreset(task);
  const hasAnyDate = Boolean(task.scheduledStartAt || task.dueAt || task.recurrenceRule);
  const primaryOccurrence = getPlannerTaskPrimaryOccurrence(task);
  const createdAtLabel =
    task.createdAt > 0
      ? formatPlannerFullDateTime(task.createdAt, language)
      : language === "ru"
        ? "Неизвестно"
        : "Unknown";

  const commitTitle = () => {
    const nextTitle = titleDraft.trim();
    if (nextTitle && nextTitle !== task.title) {
      void onUpdate(task.id, { title: nextTitle });
    } else {
      setTitleDraft(task.title);
    }
  };

  const commitDescription = () => {
    const nextDescription = descriptionDraft.trim();
    if (nextDescription !== task.description) {
      void onUpdate(task.id, { description: nextDescription });
    }
  };

  const applyDateDraft = (draft: PlannerTaskDateDraft) => {
    const patch = buildPlannerTaskSchedulePatch(task, draft);
    setIsDateSelectorOpen(false);
    void onUpdate(task.id, patch);
  };

  const shiftDate = (days: number) => {
    if (isRecurringPlannerRule(task.recurrenceRule) && primaryOccurrence) {
      setScopedDateAction({
        originalStartAt: primaryOccurrence.originalStartAt,
        currentStartAt: primaryOccurrence.startAt,
        nextStartAt: shiftLocalDay(primaryOccurrence.startAt, days),
        nextEndAt: primaryOccurrence.scheduledStartAt ? shiftLocalDay(primaryOccurrence.endAt, days) : null
      });
      return;
    }

    const baseDraft = getPlannerTaskDateDraft(task);
    if (!baseDraft.startDateAt) {
      return;
    }

    applyDateDraft({
      ...baseDraft,
      startDateAt: shiftLocalDay(baseDraft.startDateAt, days),
      endDateAt: baseDraft.endDateAt ? shiftLocalDay(baseDraft.endDateAt, days) : null,
      repeatUntilAt: baseDraft.repeatUntilAt ? shiftLocalDay(baseDraft.repeatUntilAt, days) : null
    });
  };

  const applyScopedDateAction = (scope: PlannerTaskDateScope) => {
    if (!scopedDateAction) {
      return;
    }

    const patch =
      scope === "this"
        ? buildRescheduleOccurrencePatch(
            task,
            scopedDateAction.originalStartAt,
            scopedDateAction.nextStartAt,
            scopedDateAction.nextEndAt
          )
        : buildRescheduleRecurringSeriesPatch(
            task,
            scopedDateAction.originalStartAt,
            scopedDateAction.nextStartAt,
            scopedDateAction.nextEndAt,
            scope,
            scopedDateAction.currentStartAt
          );

    setScopedDateAction(null);
    void onUpdate(task.id, patch);
  };

  const updateReminder = (preset: PlannerReminderPreset) => {
    if (preset !== "none" && !hasAnyDate) {
      return;
    }

    setIsReminderPickerOpen(false);
    void onUpdate(task.id, { reminders: buildReminder(task, preset, language) });
  };

  return (
    <aside className={`planner-task-inspector planner-task-panel ${isMobile ? "is-mobile-sheet" : ""}`}>
      <header className="planner-task-inspector-head">
        <div
          className="planner-task-inspector-orb"
          style={{ "--planner-task-project-color": selectedProject?.color ?? "var(--planner-task-accent)" } as CSSProperties}
          aria-hidden="true"
        />
        <div className="planner-task-inspector-title">
          <span className="planner-task-panel-kicker">{language === "ru" ? "Задача" : "Task"}</span>
          <input
            type="text"
            value={titleDraft}
            onChange={(event) => setTitleDraft(event.target.value)}
            onBlur={commitTitle}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                event.currentTarget.blur();
              }
            }}
            placeholder={language === "ru" ? "Что нужно сделать?" : "What needs to happen?"}
          />
          <small>{scheduleSummary}</small>
        </div>
        {onClose ? (
          <button type="button" className="planner-task-panel-close" onClick={onClose} aria-label={language === "ru" ? "Закрыть" : "Close"}>
            ×
          </button>
        ) : null}
      </header>

      <div className="planner-task-action-row">
        <button
          type="button"
          className={done ? "is-done" : ""}
          onClick={() => void onToggleDone(task.id, !done, primaryOccurrence?.originalStartAt)}
        >
          <span className={`planner-task-action-icon ${done ? "is-return" : "is-check"}`} aria-hidden="true" />
          <span>{done ? (language === "ru" ? "Вернуть" : "Reopen") : language === "ru" ? "Готово" : "Done"}</span>
        </button>
        <button
          type="button"
          className="is-danger"
          onClick={() => {
            if (!deleteArmed) {
              setDeleteArmed(true);
              return;
            }
            void onDelete(task.id);
          }}
        >
          <span className={`planner-task-action-icon ${deleteArmed ? "is-confirm-delete" : "is-trash"}`} aria-hidden="true" />
          <span>{deleteArmed ? (language === "ru" ? "Подтвердить" : "Confirm") : language === "ru" ? "Удалить" : "Delete"}</span>
        </button>
      </div>

      <section className="planner-task-choice-section">
        <div className="planner-task-section-title">
          <span>{language === "ru" ? "Проект" : "Project"}</span>
        </div>
        <div className="planner-task-chip-row is-projects">
          <button
            type="button"
            className={!task.projectId ? "is-active" : ""}
            onClick={() => void onUpdate(task.id, { projectId: null })}
          >
            <span className="planner-task-project-dot" style={{ "--planner-task-project-color": "var(--planner-task-accent)" } as CSSProperties} />
            <strong>{language === "ru" ? "Без проекта" : "No project"}</strong>
          </button>
          {projects.map((project) => (
            <button
              key={project.id}
              type="button"
              className={project.id === task.projectId ? "is-active" : ""}
              onClick={() => void onUpdate(task.id, { projectId: project.id })}
            >
              <span className="planner-task-project-dot" style={{ "--planner-task-project-color": project.color } as CSSProperties} />
              <strong>{project.name}</strong>
            </button>
          ))}
        </div>
      </section>

      <section className="planner-task-choice-section">
        <div className="planner-task-section-title">
          <span>{language === "ru" ? "Статус" : "Status"}</span>
        </div>
        <div className="planner-task-chip-row is-status">
          {STATUSES.map((status) => (
            <button
              key={status}
              type="button"
              className={task.status === status ? "is-active" : ""}
              onClick={() => void onUpdate(task.id, { status })}
            >
              {getPlannerStatusLabel(status, language)}
            </button>
          ))}
        </div>
      </section>

      <section className="planner-task-choice-section">
        <div className="planner-task-section-title">
          <span>{language === "ru" ? "Приоритет" : "Priority"}</span>
        </div>
        <div className="planner-task-chip-row planner-task-priority-row">
          {PRIORITIES.map((priority) => (
            <button
              key={priority}
              type="button"
              className={`is-${priority} ${task.priority === priority ? "is-active" : ""}`}
              onClick={() => void onUpdate(task.id, { priority })}
            >
              <span />
              <strong>{getPlannerPriorityLabel(priority, language)}</strong>
            </button>
          ))}
        </div>
      </section>

      <section className="planner-task-date-card">
        <button type="button" className="planner-task-date-summary" onClick={() => setIsDateSelectorOpen((current) => !current)}>
          <span className="planner-task-date-icon" aria-hidden="true" />
          <span>
            <small>{language === "ru" ? "Дата" : "Date"}</small>
            <strong>{scheduleSummary}</strong>
          </span>
        </button>
        <div className="planner-task-date-stepper-row">
          <button type="button" onClick={() => shiftDate(-1)} disabled={!hasAnyDate}>
            {language === "ru" ? "− день" : "- day"}
          </button>
          <button type="button" onClick={() => shiftDate(1)} disabled={!hasAnyDate}>
            {language === "ru" ? "+ день" : "+ day"}
          </button>
        </div>
        <div className="planner-task-date-meta">
          <span>{language === "ru" ? "Создано" : "Created"}</span>
          <strong>{createdAtLabel}</strong>
        </div>
      </section>

      <section className="planner-task-choice-section">
        <div className="planner-task-section-title">
          <span>{language === "ru" ? "Напоминание" : "Reminder"}</span>
          {!hasAnyDate ? <small>{language === "ru" ? "Сначала дата" : "Choose date first"}</small> : null}
        </div>
        <button
          type="button"
          className="planner-task-reminder-card"
          onClick={() => setIsReminderPickerOpen((current) => !current)}
          disabled={!hasAnyDate && reminderPreset === "none"}
        >
          <span className="planner-task-reminder-icon" aria-hidden="true" />
          <span>
            <small>{reminderPreset === "none" ? (language === "ru" ? "Добавить" : "Add") : language === "ru" ? "Выбрано" : "Selected"}</small>
            <strong>{getReminderLabel(reminderPreset, language)}</strong>
          </span>
        </button>
        {isReminderPickerOpen ? (
          <div className="planner-task-chip-row planner-task-reminder-row">
            {REMINDER_PRESETS.map((preset) => (
              <button
                key={preset}
                type="button"
                className={reminderPreset === preset ? "is-active" : ""}
                disabled={preset !== "none" && !hasAnyDate}
                onClick={() => updateReminder(preset)}
              >
                {getReminderLabel(preset, language)}
              </button>
            ))}
          </div>
        ) : null}
      </section>

      <section className="planner-task-description-block">
        <div className="planner-task-section-title">
          <span>{language === "ru" ? "Описание" : "Description"}</span>
        </div>
        <textarea
          value={descriptionDraft}
          rows={descriptionDraft ? 4 : 2}
          onChange={(event) => setDescriptionDraft(event.target.value)}
          onBlur={commitDescription}
          placeholder={language === "ru" ? "Контекст, критерии готовности, ссылки..." : "Context, acceptance notes, links..."}
        />
      </section>

      <section className="planner-task-choice-section">
        <div className="planner-task-section-title">
          <span>{language === "ru" ? "Теги" : "Tags"}</span>
          <small>{task.tagIds.length}</small>
        </div>
        {onCreateTag ? (
          <TagInputField
            tags={tags}
            selectedTagIds={task.tagIds}
            language={language}
            onCreateTag={onCreateTag}
            dropdownWithinPortal
            variant="planner"
            onChangeTagIds={(tagIds) => onUpdate(task.id, { tagIds })}
          />
        ) : (
          <p className="planner-task-muted">{language === "ru" ? "Теги можно добавить в документах." : "Tags can be added in documents."}</p>
        )}
      </section>

      {backlinks.length > 0 ? (
        <section className="planner-task-links-section">
          <div className="planner-task-section-title">
            <span>{language === "ru" ? "Связи" : "Links"}</span>
            <small>{backlinks.length}</small>
          </div>
          <div className="planner-task-calendar-link-list">
            {backlinks.map((backlink) => {
              const canOpen =
                Boolean(backlink.noteId && onOpenNote) ||
                Boolean(backlink.projectId && onOpenProjectMap) ||
                Boolean(backlink.url);
              const linkedProject =
                backlink.kind === "project" && task.projectId ? projectMap.get(task.projectId) ?? selectedProject : null;
              const content = (
                <>
                  {linkedProject ? <i style={{ "--project-color": linkedProject.color } as CSSProperties} /> : null}
                  <span>
                    {backlink.subtitle} · {backlink.title}
                  </span>
                </>
              );

              if (!canOpen) {
                return <span key={backlink.key}>{content}</span>;
              }

              return (
                <button
                  key={backlink.key}
                  type="button"
                  className={`is-${backlink.kind}`}
                  onClick={() => {
                    if (backlink.noteId && onOpenNote) {
                      onOpenNote(backlink.noteId);
                      return;
                    }
                    if (backlink.projectId && onOpenProjectMap) {
                      onOpenProjectMap(backlink.projectId);
                      return;
                    }
                    if (backlink.url) {
                      window.open(backlink.url, "_blank", "noopener,noreferrer");
                    }
                  }}
                >
                  {content}
                </button>
              );
            })}
          </div>
        </section>
      ) : null}
      <PlannerDateDialog
        open={isDateSelectorOpen}
        value={scheduleDraft}
        language={language}
        isMobile={isMobile}
        onClose={() => setIsDateSelectorOpen(false)}
        onApply={applyDateDraft}
      />
      {scopedDateAction
        ? createPortal(
            <div className="planner-task-scope-layer" role="dialog" aria-modal="true">
              <button
                type="button"
                className="planner-task-scope-backdrop"
                onClick={() => setScopedDateAction(null)}
                aria-label={language === "ru" ? "Отмена" : "Cancel"}
              />
              <section className="planner-task-scope-dialog">
                <span className="planner-task-panel-kicker">{language === "ru" ? "Повторяющаяся задача" : "Recurring task"}</span>
                <h3>{language === "ru" ? "Перенести повтор?" : "Move repeating event?"}</h3>
                <p>
                  {language === "ru"
                    ? "Выбери, применить перенос только к ближайшему событию, к будущим повторам или ко всей серии."
                    : "Choose whether to move only the nearest event, future events, or the whole series."}
                </p>
                <div>
                  <button type="button" onClick={() => applyScopedDateAction("this")}>
                    <strong>{language === "ru" ? "Только это" : "Only this"}</strong>
                    <small>{language === "ru" ? "Аккуратный override выбранного повтора" : "A precise override for this occurrence"}</small>
                  </button>
                  <button type="button" onClick={() => applyScopedDateAction("future")}>
                    <strong>{language === "ru" ? "Это и будущие" : "This and future"}</strong>
                    <small>{language === "ru" ? "Остается одна задача без дублей" : "Keeps one task without duplicates"}</small>
                  </button>
                  <button type="button" onClick={() => applyScopedDateAction("all")}>
                    <strong>{language === "ru" ? "Вся серия" : "Whole series"}</strong>
                    <small>{language === "ru" ? "Перенести регулярность целиком" : "Move the recurrence as a whole"}</small>
                  </button>
                </div>
              </section>
            </div>,
            document.body
          )
        : null}
    </aside>
  );
}
