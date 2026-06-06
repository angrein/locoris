import { useEffect, useMemo, useRef, useState, type CSSProperties, type PointerEvent } from "react";

import type { AppRuntimeLayoutSnapshot } from "../../lib/runtime";
import type { AppLanguage, Folder, Habit, HabitLog, Note, PlannerTaskPriority, Project, Tag, Task, TimeBlock } from "../../types";
import {
  formatPlannerDate,
  getPlannerPriorityLabel,
  getPlannerProjectName,
  getPlannerStats,
  getPlannerTasksForView,
  getPlannerViewLabels,
  isPlannerTaskActive,
  isPlannerTaskDone,
  isPlannerTaskOverdue,
  type PlannerHabitCreateInput,
  type PlannerHabitUpdateInput,
  type PlannerTimeBlockCreateInput,
  type PlannerTimeBlockUpdateInput,
  type PlannerTaskCreateInput,
  type PlannerTaskUpdateInput,
  type PlannerViewId
} from "../../lib/planner";
import { normalizePlannerQuickAddTagName } from "../../lib/plannerQuickAdd";
import {
  buildPlannerTaskScheduleFields,
  createPlannerTaskDateDraft,
  getPlannerTaskDateDraftSummary,
  type PlannerTaskDateDraft
} from "../../lib/plannerTaskSchedule";
import { buildPlannerHabitSummaries } from "../../lib/plannerHabits";
import { buildPlannerReview } from "../../lib/plannerReview";
import PlannerRail from "./PlannerRail";
import PlannerCalendarSurface from "./PlannerCalendarSurface";
import PlannerDateDialog from "./PlannerDateDialog";
import PlannerTaskInspector from "./PlannerTaskInspector";
import PlannerHabitsSurface from "./habits/PlannerHabitsSurface";
import PlannerReviewSurface from "./review/PlannerReviewSurface";
import "./PlannerSurface.css";

interface PlannerSurfaceProps {
  tasks: Task[];
  habits: Habit[];
  habitLogs: HabitLog[];
  timeBlocks: TimeBlock[];
  projects: Project[];
  folders: Folder[];
  notes: Note[];
  tags: Tag[];
  language: AppLanguage;
  adaptiveLayout: AppRuntimeLayoutSnapshot;
  focusProjectId?: string | null;
  onCreateTask: (input: PlannerTaskCreateInput) => Promise<Task>;
  onUpdateTask: (taskId: string, patch: PlannerTaskUpdateInput) => Promise<Task | null>;
  onToggleTaskDone: (taskId: string, done: boolean) => Promise<Task | null>;
  onDeleteTask: (taskId: string) => Promise<void>;
  onCreateHabit: (input: PlannerHabitCreateInput) => Promise<Habit>;
  onUpdateHabit: (habitId: string, patch: PlannerHabitUpdateInput) => Promise<Habit | null>;
  onDeleteHabit: (habitId: string) => Promise<void>;
  onToggleHabitLog: (habitId: string, dayAt?: number) => Promise<HabitLog | null>;
  onCreateTimeBlock: (input: PlannerTimeBlockCreateInput) => Promise<TimeBlock>;
  onUpdateTimeBlock: (timeBlockId: string, patch: PlannerTimeBlockUpdateInput) => Promise<TimeBlock | null>;
  onDeleteTimeBlock: (timeBlockId: string) => Promise<void>;
  onCreateTag?: (name: string) => Promise<Tag>;
  onClearProjectFocus?: () => void;
  onOpenNote?: (noteId: string) => void;
}

interface TaskCardProps {
  task: Task;
  selected: boolean;
  projectName: string | null;
  tagNames: string[];
  language: AppLanguage;
  isMobile: boolean;
  onSelect: () => void;
  onOpenActions: () => void;
  onToggleDone: (done: boolean) => void;
}

const PRIORITIES: PlannerTaskPriority[] = ["none", "low", "medium", "high", "urgent"];
const COMPOSER_NO_PROJECT = "__none__";
const PROJECT_FILTER_ALL = "__all__";
const PROJECT_FILTER_NONE = "__none_project__";

type PlannerProjectFilterId = typeof PROJECT_FILTER_ALL | typeof PROJECT_FILTER_NONE | string;

function getDefaultDueAt(viewId: PlannerViewId) {
  if (viewId !== "today") {
    return null;
  }

  const today = new Date();
  today.setHours(12, 0, 0, 0);
  return today.getTime();
}

function getDefaultStatus(viewId: PlannerViewId): Task["status"] {
  return viewId === "inbox" ? "inbox" : "todo";
}

function getDefaultComposerDateDraft(viewId: PlannerViewId) {
  return createPlannerTaskDateDraft(getDefaultDueAt(viewId));
}

function shouldCaptureUndatedTaskInInbox(viewId: PlannerViewId) {
  return viewId !== "inbox" && viewId !== "projects";
}

function hasScheduleFields(scheduleFields: Partial<Pick<Task, "dueAt" | "scheduledStartAt" | "recurrenceRule">>) {
  return Boolean(scheduleFields.dueAt || scheduleFields.scheduledStartAt || scheduleFields.recurrenceRule);
}

function getUniqueTagNames(tagIds: string[], tagMap: Map<string, Tag>) {
  const namesByKey = new Map<string, string>();

  tagIds.forEach((tagId) => {
    const tagName = tagMap.get(tagId)?.name;

    if (!tagName) {
      return;
    }

    const normalizedKey = normalizePlannerQuickAddTagName(tagName).toLowerCase();

    if (!normalizedKey || namesByKey.has(normalizedKey)) {
      return;
    }

    namesByKey.set(normalizedKey, tagName);
  });

  return Array.from(namesByKey.values());
}

function TaskCard({
  task,
  selected,
  projectName,
  tagNames,
  language,
  isMobile,
  onSelect,
  onOpenActions,
  onToggleDone
}: TaskCardProps) {
  const longPressRef = useRef<number | null>(null);
  const startPointRef = useRef<{ x: number; y: number } | null>(null);
  const done = isPlannerTaskDone(task);
  const overdue = isPlannerTaskOverdue(task);

  const clearLongPress = () => {
    if (longPressRef.current !== null) {
      window.clearTimeout(longPressRef.current);
      longPressRef.current = null;
    }
    startPointRef.current = null;
  };

  const handlePointerDown = (event: PointerEvent<HTMLElement>) => {
    if (!isMobile || event.pointerType === "mouse") {
      return;
    }

    startPointRef.current = { x: event.clientX, y: event.clientY };
    longPressRef.current = window.setTimeout(() => {
      longPressRef.current = null;
      onSelect();
      onOpenActions();
    }, 520);
  };

  const handlePointerMove = (event: PointerEvent<HTMLElement>) => {
    const startPoint = startPointRef.current;

    if (!startPoint) {
      return;
    }

    if (Math.abs(event.clientX - startPoint.x) > 10 || Math.abs(event.clientY - startPoint.y) > 10) {
      clearLongPress();
    }
  };

  const visibleTagNames = tagNames.slice(0, isMobile ? 1 : 2);
  const hiddenTagCount = Math.max(0, tagNames.length - visibleTagNames.length);

  return (
    <article
      role="button"
      tabIndex={0}
      className={`planner-task-card ${task.description ? "has-description" : ""} ${
        selected ? "is-selected" : ""
      } ${done ? "is-done" : ""} ${overdue ? "is-overdue" : ""}`}
      onClick={onSelect}
      onKeyDown={(event) => {
        if (event.key !== "Enter" && event.key !== " ") {
          return;
        }

        event.preventDefault();
        onSelect();
      }}
      onContextMenu={(event) => {
        event.preventDefault();
        onSelect();
        onOpenActions();
      }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={clearLongPress}
      onPointerLeave={clearLongPress}
      onPointerCancel={clearLongPress}
    >
      <button
        type="button"
        className="planner-task-check"
        aria-pressed={done}
        aria-label={done ? "Отметить задачу невыполненной" : "Отметить задачу выполненной"}
        onClick={(event) => {
          event.stopPropagation();
          onToggleDone(!done);
        }}
      />
      <div className="planner-task-content">
        <div className="planner-task-topline">
          <strong className="planner-task-title">{task.title}</strong>
          {task.priority !== "none" ? (
            <span className={`planner-task-chip planner-priority-chip is-${task.priority}`}>
              {getPlannerPriorityLabel(task.priority, language)}
            </span>
          ) : null}
        </div>
        {task.description ? <p className="planner-task-description">{task.description}</p> : null}
        <div className="planner-task-meta">
          {task.dueAt ? (
            <span className={`planner-task-chip is-date ${overdue ? "is-overdue" : ""}`}>
              {formatPlannerDate(task.dueAt, language)}
            </span>
          ) : null}
          {projectName ? <span className="planner-task-chip is-project">{projectName}</span> : null}
          {visibleTagNames.map((tagName) => (
            <span key={tagName} className="planner-task-chip is-tag">#{tagName}</span>
          ))}
          {hiddenTagCount > 0 ? (
            <span className="planner-task-chip is-more">+{hiddenTagCount}</span>
          ) : null}
        </div>
      </div>
    </article>
  );
}

export default function PlannerSurface({
  tasks,
  habits,
  habitLogs,
  timeBlocks,
  projects,
  folders,
  notes,
  tags,
  language,
  adaptiveLayout,
  focusProjectId = null,
  onCreateTask,
  onUpdateTask,
  onToggleTaskDone,
  onDeleteTask,
  onCreateHabit,
  onUpdateHabit,
  onDeleteHabit,
  onToggleHabitLog,
  onCreateTimeBlock,
  onUpdateTimeBlock,
  onDeleteTimeBlock,
  onClearProjectFocus,
  onOpenNote
}: PlannerSurfaceProps) {
  const isMobile = adaptiveLayout.isMobileShell;
  const [activeViewId, setActiveViewId] = useState<PlannerViewId>("today");
  const [projectFilterId, setProjectFilterId] = useState<PlannerProjectFilterId>(PROJECT_FILTER_ALL);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [isComposerOpen, setIsComposerOpen] = useState(false);
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);
  const [titleDraft, setTitleDraft] = useState("");
  const [projectDraft, setProjectDraft] = useState("");
  const [dateDraft, setDateDraft] = useState<PlannerTaskDateDraft>(() => getDefaultComposerDateDraft("today"));
  const [priorityDraft, setPriorityDraft] = useState<PlannerTaskPriority>("none");
  const [isComposerDateOpen, setIsComposerDateOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const composerTitleInputRef = useRef<HTMLInputElement | null>(null);
  const composerRef = useRef<HTMLFormElement | null>(null);
  const isTaskView = activeViewId !== "habits" && activeViewId !== "review";

  const labels = getPlannerViewLabels(language);
  const projectMap = useMemo(() => new Map(projects.map((project) => [project.id, project])), [projects]);
  const tagMap = useMemo(() => new Map(tags.map((tag) => [tag.id, tag])), [tags]);
  const focusedProject = focusProjectId ? projectMap.get(focusProjectId) ?? null : null;
  const habitSummariesForStats = useMemo(
    () =>
      buildPlannerHabitSummaries({
        habits,
        habitLogs,
        projects
      }),
    [habitLogs, habits, projects]
  );
  const reviewForStats = useMemo(
    () =>
      buildPlannerReview({
        tasks,
        habits,
        habitLogs,
        projects,
        timeBlocks,
        mode: "day"
      }),
    [habitLogs, habits, projects, tasks, timeBlocks]
  );
  const stats = useMemo(
    () => ({
      ...getPlannerStats(tasks),
      habits: habitSummariesForStats.filter((summary) => summary.habit.status !== "archived" && summary.dueToday).length,
      review:
        reviewForStats.stats.overdue +
        reviewForStats.stats.inbox +
        reviewForStats.stats.staleProjects +
        habitSummariesForStats.filter((summary) => summary.missed).length
    }),
    [habitSummariesForStats, reviewForStats, tasks]
  );
  const projectFilterStats = useMemo(() => {
    const activeTasks = tasks.filter(isPlannerTaskActive);
    const byProject = new Map(projects.map((project) => [project.id, 0]));
    let withoutProject = 0;

    activeTasks.forEach((task) => {
      if (!task.projectId || !byProject.has(task.projectId)) {
        withoutProject += 1;
        return;
      }

      byProject.set(task.projectId, (byProject.get(task.projectId) ?? 0) + 1);
    });

    return {
      all: activeTasks.length,
      none: withoutProject,
      byProject
    };
  }, [projects, tasks]);
  const calendarCount = useMemo(
    () =>
      tasks.filter(
        (task) =>
          isPlannerTaskActive(task) &&
          Boolean(task.scheduledStartAt || task.dueAt || task.recurrenceRule)
      ).length,
    [tasks]
  );
  const visibleTasks = useMemo(
    () => {
      const tasksForView = getPlannerTasksForView({
        tasks,
        viewId: activeViewId,
        searchQuery,
        projects,
        tags
      });

      if (focusProjectId) {
        return tasksForView.filter((task) => task.projectId === focusProjectId);
      }

      if (activeViewId === "projects") {
        if (projectFilterId === PROJECT_FILTER_NONE) {
          return tasksForView.filter((task) => !task.projectId);
        }

        if (projectFilterId !== PROJECT_FILTER_ALL) {
          return tasksForView.filter((task) => task.projectId === projectFilterId);
        }
      }

      return tasksForView;
    },
    [activeViewId, focusProjectId, projectFilterId, projects, searchQuery, tags, tasks]
  );
  const selectedTask = useMemo(
    () => tasks.find((task) => task.id === selectedTaskId) ?? null,
    [selectedTaskId, tasks]
  );

  useEffect(() => {
    if (selectedTaskId && !tasks.some((task) => task.id === selectedTaskId)) {
      setSelectedTaskId(null);
    }
  }, [selectedTaskId, tasks]);

  useEffect(() => {
    if (!focusProjectId || !projectMap.has(focusProjectId)) {
      return;
    }

    setActiveViewId("projects");
    setSelectedTaskId(null);
  }, [focusProjectId, projectMap]);

  useEffect(() => {
    if (
      projectFilterId === PROJECT_FILTER_ALL ||
      projectFilterId === PROJECT_FILTER_NONE ||
      projectMap.has(projectFilterId)
    ) {
      return;
    }

    setProjectFilterId(PROJECT_FILTER_ALL);
  }, [projectFilterId, projectMap]);

  useEffect(() => {
    if (!isMobile || !selectedTask) {
      return;
    }

    setIsComposerOpen(false);
    setIsComposerDateOpen(false);
  }, [isMobile, selectedTask]);

  useEffect(() => {
    if (!isComposerOpen) {
      return;
    }

    const focusTimeout = window.setTimeout(() => {
      composerTitleInputRef.current?.focus();
    }, 0);

    return () => window.clearTimeout(focusTimeout);
  }, [isComposerOpen]);

  useEffect(() => {
    if (!isComposerOpen || isMobile) {
      return;
    }

    const handleOutsidePointerDown = (event: globalThis.PointerEvent) => {
      const target = event.target;

      if (!(target instanceof Node)) {
        return;
      }

      if (target instanceof Element && target.closest("[data-planner-composer-trigger='true']")) {
        return;
      }

      if (target instanceof Element && target.closest(".planner-date-dialog-layer")) {
        return;
      }

      if (!composerRef.current?.contains(target)) {
        setIsComposerOpen(false);
        setIsComposerDateOpen(false);
      }
    };

    window.addEventListener("pointerdown", handleOutsidePointerDown, true);
    return () => window.removeEventListener("pointerdown", handleOutsidePointerDown, true);
  }, [isComposerOpen, isMobile]);

  const resetComposer = () => {
    setTitleDraft("");
    setProjectDraft("");
    setDateDraft(getDefaultComposerDateDraft(activeViewId));
    setPriorityDraft("none");
    setIsComposerDateOpen(false);
  };

  const closeComposer = () => {
    setIsComposerOpen(false);
    setIsComposerDateOpen(false);
  };

  const handleViewChange = (viewId: PlannerViewId) => {
    setActiveViewId(viewId);
    setSelectedTaskId(null);
    closeComposer();
  };

  const openCalendar = () => {
    closeComposer();
    setIsCalendarOpen(true);
  };

  const openComposer = () => {
    setSelectedTaskId(null);

    if (isComposerOpen) {
      composerTitleInputRef.current?.focus();
      return;
    }

    setIsComposerOpen(true);
    setDateDraft(getDefaultComposerDateDraft(activeViewId));
  };

  const handleCreateTask = async () => {
    const normalizedTitle = titleDraft.trim();

    if (!normalizedTitle || isCreating) {
      return;
    }

    setIsCreating(true);
    try {
      const initialScheduleFields = buildPlannerTaskScheduleFields(dateDraft, getDefaultStatus(activeViewId));
      const shouldMoveToInbox =
        !hasScheduleFields(initialScheduleFields) && shouldCaptureUndatedTaskInInbox(activeViewId);
      const scheduleFields = shouldMoveToInbox
        ? buildPlannerTaskScheduleFields(dateDraft, "inbox")
        : initialScheduleFields;
      const defaultProjectId =
        focusedProject?.id ??
        (activeViewId === "projects" && projectFilterId !== PROJECT_FILTER_ALL && projectFilterId !== PROJECT_FILTER_NONE
          ? projectFilterId
          : null);
      const projectId =
        projectDraft === COMPOSER_NO_PROJECT ||
        (activeViewId === "projects" && projectFilterId === PROJECT_FILTER_NONE && projectDraft === "")
          ? null
          : projectDraft || defaultProjectId || null;
      const task = await onCreateTask({
        title: normalizedTitle,
        ...scheduleFields,
        projectId,
        tagIds: [],
        priority: priorityDraft
      });
      setSelectedTaskId(task.id);

      if (shouldMoveToInbox) {
        setActiveViewId("inbox");
      } else if (activeViewId === "projects" && !focusProjectId) {
        const createdTaskVisibleInCurrentFilter =
          projectFilterId === PROJECT_FILTER_ALL ||
          (projectFilterId === PROJECT_FILTER_NONE && !projectId) ||
          projectFilterId === projectId;

        if (!createdTaskVisibleInCurrentFilter) {
          setProjectFilterId(projectId ?? PROJECT_FILTER_NONE);
        }
      }

      resetComposer();
      closeComposer();
    } finally {
      setIsCreating(false);
    }
  };

  const renderComposer = (mode: "inline" | "sheet") => {
    const filterProject =
      activeViewId === "projects" && projectFilterId !== PROJECT_FILTER_ALL && projectFilterId !== PROJECT_FILTER_NONE
        ? projectMap.get(projectFilterId) ?? null
        : null;
    const contextProject = focusedProject ?? filterProject;
    const isNoProjectContext = !focusedProject && activeViewId === "projects" && projectFilterId === PROJECT_FILTER_NONE;
    const contextColor = contextProject?.color ?? (isNoProjectContext ? "var(--planner-accent-2)" : "var(--planner-accent)");
    const contextLabel = contextProject
      ? language === "ru"
        ? `Контекст: ${contextProject.name}`
        : `Context: ${contextProject.name}`
      : isNoProjectContext
        ? language === "ru"
          ? "Без проекта"
          : "No project"
        : "Inbox";

    return (
      <form
        ref={composerRef}
        className={`planner-composer is-${mode}`}
        onSubmit={(event) => {
          event.preventDefault();
          void handleCreateTask();
        }}
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            closeComposer();
          }
        }}
      >
        <div className="planner-composer-title-row">
          <div>
            <span className="planner-kicker">{language === "ru" ? "Новая задача" : "New task"}</span>
          </div>
          <button
            type="button"
            className="planner-icon-button"
            onClick={closeComposer}
            aria-label={language === "ru" ? "Закрыть" : "Close"}
          >
            ×
          </button>
        </div>
        <div className="planner-composer-capture">
          <label className="planner-composer-title-field">
            <span>{language === "ru" ? "Задача" : "Task"}</span>
            <input
              ref={composerTitleInputRef}
              value={titleDraft}
              onChange={(event) => setTitleDraft(event.target.value)}
              placeholder={
                language === "ru"
                  ? "Например: собрать план релиза завтра"
                  : "For example: prepare tomorrow's release plan"
              }
            />
          </label>
          <section className="planner-composer-date-card">
            <span>{language === "ru" ? "Дата" : "Date"}</span>
            <button type="button" onClick={() => setIsComposerDateOpen(true)}>
              <span className="planner-action-glyph is-calendar" aria-hidden="true" />
              <strong>{getPlannerTaskDateDraftSummary(dateDraft, language)}</strong>
            </button>
          </section>
          <section className="planner-composer-choice is-project">
            <span>{language === "ru" ? "Проект" : "Project"}</span>
            <div className="planner-composer-chip-row">
              <button
                type="button"
                className={projectDraft === "" ? "is-active" : ""}
                onClick={() => setProjectDraft("")}
                style={{ "--planner-composer-chip-color": contextColor } as CSSProperties}
              >
                <span />
                <strong>{contextLabel}</strong>
              </button>
              {contextProject || isNoProjectContext ? (
                <button
                  type="button"
                  className={projectDraft === COMPOSER_NO_PROJECT ? "is-active" : ""}
                  onClick={() => setProjectDraft(COMPOSER_NO_PROJECT)}
                  style={{ "--planner-composer-chip-color": "var(--planner-accent)" } as CSSProperties}
                >
                  <span />
                  <strong>{language === "ru" ? "Без проекта" : "No project"}</strong>
                </button>
              ) : null}
              {projects.map((project) => (
                <button
                  key={project.id}
                  type="button"
                  className={projectDraft === project.id ? "is-active" : ""}
                  onClick={() => setProjectDraft(project.id)}
                  style={{ "--planner-composer-chip-color": project.color } as CSSProperties}
                >
                  <span />
                  <strong>{project.name}</strong>
                </button>
              ))}
            </div>
          </section>
          <section className="planner-composer-choice is-priority">
            <span>{language === "ru" ? "Приоритет" : "Priority"}</span>
            <div className="planner-composer-priority-row">
              {PRIORITIES.map((priority) => (
                <button
                  key={priority}
                  type="button"
                  className={`is-${priority} ${priorityDraft === priority ? "is-active" : ""}`}
                  onClick={() => setPriorityDraft(priority)}
                >
                  <span />
                  <strong>{getPlannerPriorityLabel(priority, language)}</strong>
                </button>
              ))}
            </div>
          </section>
          <button
            type="submit"
            className="planner-primary-action is-create-task"
            disabled={!titleDraft.trim() || isCreating}
          >
            <span className="planner-action-glyph is-plus" aria-hidden="true" />
            <span>{language === "ru" ? "Создать" : "Create"}</span>
          </button>
        </div>
        <PlannerDateDialog
          open={isComposerDateOpen}
          value={dateDraft}
          language={language}
          isMobile={isMobile}
          onClose={() => setIsComposerDateOpen(false)}
          onApply={(nextDraft) => {
            setDateDraft(nextDraft);
            setIsComposerDateOpen(false);
          }}
        />
      </form>
    );
  };

  const renderProjectFilters = () => {
    if (activeViewId !== "projects" || focusedProject) {
      return null;
    }

    const allLabel = language === "ru" ? "Все" : "All";
    const noProjectLabel = language === "ru" ? "Без проекта" : "No project";

    return (
      <nav className="planner-project-filter-row" aria-label={language === "ru" ? "Фильтр проектов" : "Project filter"}>
        <button
          type="button"
          className={projectFilterId === PROJECT_FILTER_ALL ? "is-active" : ""}
          onClick={() => setProjectFilterId(PROJECT_FILTER_ALL)}
          style={{ "--planner-project-filter-color": "var(--planner-accent)" } as CSSProperties}
        >
          <span className="planner-project-filter-dot" />
          <strong>{allLabel}</strong>
          <em>{projectFilterStats.all}</em>
        </button>
        <button
          type="button"
          className={projectFilterId === PROJECT_FILTER_NONE ? "is-active" : ""}
          onClick={() => setProjectFilterId(PROJECT_FILTER_NONE)}
          style={{ "--planner-project-filter-color": "var(--planner-accent-2)" } as CSSProperties}
        >
          <span className="planner-project-filter-dot" />
          <strong>{noProjectLabel}</strong>
          <em>{projectFilterStats.none}</em>
        </button>
        {projects.map((project) => (
          <button
            key={project.id}
            type="button"
            className={projectFilterId === project.id ? "is-active" : ""}
            onClick={() => setProjectFilterId(project.id)}
            style={{ "--planner-project-filter-color": project.color } as CSSProperties}
          >
            <span className="planner-project-filter-dot" />
            <strong>{project.name}</strong>
            <em>{projectFilterStats.byProject.get(project.id) ?? 0}</em>
          </button>
        ))}
      </nav>
    );
  };

  return (
    <section className={`planner-surface ${isMobile ? "is-mobile" : "is-desktop"} ${!isTaskView ? "is-wide-mode" : ""}`}>
      {!isMobile ? (
        <PlannerRail
          activeViewId={activeViewId}
          stats={stats}
          language={language}
          onViewChange={handleViewChange}
        />
      ) : null}

      <main className="planner-main">
        {activeViewId !== "review" ? (
          <header className="planner-main-head">
            <div>
              <span className="planner-kicker">{language === "ru" ? "Planner" : "Planner"}</span>
              <h1>{labels[activeViewId]}</h1>
              <p>
                {activeViewId === "habits"
                  ? language === "ru"
                    ? "Отмечай ритмы дня, держи streak и ставь паузу без штрафа."
                    : "Check in daily rhythms, keep streaks, and pause without penalty."
                  : language === "ru"
                    ? "Собирай Inbox, расставляй даты и держи фокус по проектам."
                    : "Capture inbox items, set dates, and keep project focus clear."}
              </p>
            </div>
            {isTaskView ? (
              <div className="planner-main-actions">
                <button
                  type="button"
                  className="planner-secondary-action"
                  onClick={openCalendar}
                >
                  <span className="planner-action-glyph is-calendar" aria-hidden="true" />
                  <span>{language === "ru" ? "Календарь" : "Calendar"}</span>
                </button>
                <button
                  type="button"
                  className="planner-primary-action"
                  onClick={openComposer}
                  data-planner-composer-trigger="true"
                >
                  <span className="planner-action-glyph is-plus" aria-hidden="true" />
                  <span>{language === "ru" ? "Новая" : "New"}</span>
                </button>
              </div>
            ) : null}
          </header>
        ) : null}

        {focusedProject ? (
          <div className="planner-context-row" role="status">
            <span className="planner-context-chip">
              <span className="planner-context-dot" style={{ "--planner-project-color": focusedProject.color } as CSSProperties} />
              {language === "ru" ? "План проекта" : "Project plan"} · {focusedProject.name}
            </span>
            {onClearProjectFocus ? (
              <button
                type="button"
                className="planner-context-clear"
                onClick={() => {
                  setProjectFilterId(PROJECT_FILTER_ALL);
                  onClearProjectFocus();
                }}
              >
                {language === "ru" ? "Показать все" : "Show all"}
              </button>
            ) : null}
          </div>
        ) : null}

        {isMobile ? (
          <nav className="planner-mobile-view-tabs" aria-label={language === "ru" ? "Разделы плана" : "Plan views"}>
            {(Object.keys(labels) as PlannerViewId[]).map((viewId) => (
              <button
                key={viewId}
                type="button"
                className={activeViewId === viewId ? "is-active" : ""}
                onClick={() => handleViewChange(viewId)}
              >
                <span>{labels[viewId]}</span>
                <strong>{stats[viewId]}</strong>
              </button>
            ))}
            <button
              type="button"
              className="is-calendar-entry"
              onClick={openCalendar}
            >
              <span>{language === "ru" ? "Календарь" : "Calendar"}</span>
              <strong>{calendarCount}</strong>
            </button>
          </nav>
        ) : isTaskView && isComposerOpen ? (
          renderComposer("inline")
        ) : null}

        {activeViewId === "habits" ? (
          <PlannerHabitsSurface
            habits={habits}
            habitLogs={habitLogs}
            projects={projects}
            language={language}
            isMobile={isMobile}
            onCreateHabit={onCreateHabit}
            onUpdateHabit={onUpdateHabit}
            onDeleteHabit={onDeleteHabit}
            onToggleHabitLog={onToggleHabitLog}
          />
        ) : activeViewId === "review" ? (
          <PlannerReviewSurface
            tasks={tasks}
            habits={habits}
            habitLogs={habitLogs}
            projects={projects}
            timeBlocks={timeBlocks}
            language={language}
            isMobile={isMobile}
            onToggleTaskDone={onToggleTaskDone}
            onToggleHabitLog={onToggleHabitLog}
          />
        ) : (
          <>
            <div className="planner-search-row">
              <label className="planner-search">
                <span className="planner-search-glyph" aria-hidden="true" />
                <input
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  placeholder={language === "ru" ? "Поиск задач, проектов и тегов" : "Search tasks, projects, tags"}
                />
              </label>
            </div>

            {renderProjectFilters()}

            <section className="planner-task-list" aria-label={labels[activeViewId]}>
              {visibleTasks.length > 0 ? (
                visibleTasks.map((task) => {
                  const projectName = getPlannerProjectName(projects, task.projectId);
                  const tagNames = getUniqueTagNames(task.tagIds, tagMap);

                  return (
                    <TaskCard
                      key={task.id}
                      task={task}
                      selected={task.id === selectedTaskId}
                      projectName={projectName}
                      tagNames={tagNames}
                      language={language}
                      isMobile={isMobile}
                      onSelect={() => setSelectedTaskId(task.id)}
                      onOpenActions={() => setSelectedTaskId(task.id)}
                      onToggleDone={(done) => void onToggleTaskDone(task.id, done)}
                    />
                  );
                })
              ) : (
                <div className="planner-empty-state">
                  <span className="planner-empty-glyph" aria-hidden="true" />
                  <h2>{language === "ru" ? "Здесь спокойно" : "Nothing here yet"}</h2>
                  <p>
                    {language === "ru"
                      ? "Создай первую задачу или измени фильтр поиска."
                      : "Create the first task or change the search filter."}
                  </p>
                </div>
              )}
            </section>
          </>
        )}
      </main>

      {!isMobile && isTaskView ? (
        <PlannerTaskInspector
          task={selectedTask}
          projects={projects}
          folders={folders}
          notes={notes}
          tags={tags}
          language={language}
          onOpenNote={onOpenNote}
          onUpdate={(taskId, patch) => void onUpdateTask(taskId, patch)}
          onToggleDone={(taskId, done) => void onToggleTaskDone(taskId, done)}
          onDelete={async (taskId) => {
            await onDeleteTask(taskId);
            setSelectedTaskId(null);
          }}
        />
      ) : null}

      {isMobile && isTaskView ? (
        <button
          type="button"
          className="planner-mobile-create-fab"
          onClick={openComposer}
          data-planner-composer-trigger="true"
        >
          <span className="planner-action-glyph is-plus" aria-hidden="true" />
          <span>{language === "ru" ? "Задача" : "Task"}</span>
        </button>
      ) : null}

      {isMobile && isTaskView && isComposerOpen ? (
        <div className="planner-mobile-sheet-layer" role="dialog" aria-modal="true">
          <button
            type="button"
            className="planner-mobile-sheet-backdrop"
            onClick={closeComposer}
            aria-label={language === "ru" ? "Закрыть" : "Close"}
          />
          {renderComposer("sheet")}
        </div>
      ) : null}

      {isMobile && isTaskView && selectedTask && !isCalendarOpen ? (
        <div className="planner-mobile-sheet-layer" role="dialog" aria-modal="true">
          <button
            type="button"
            className="planner-mobile-sheet-backdrop"
            onClick={() => setSelectedTaskId(null)}
            aria-label={language === "ru" ? "Закрыть" : "Close"}
          />
          <PlannerTaskInspector
            task={selectedTask}
            projects={projects}
            folders={folders}
            notes={notes}
            tags={tags}
            language={language}
            isMobile
            onClose={() => setSelectedTaskId(null)}
            onOpenNote={onOpenNote}
            onUpdate={(taskId, patch) => void onUpdateTask(taskId, patch)}
            onToggleDone={(taskId, done) => void onToggleTaskDone(taskId, done)}
            onDelete={async (taskId) => {
              await onDeleteTask(taskId);
              setSelectedTaskId(null);
            }}
          />
        </div>
      ) : null}

      {isCalendarOpen ? (
        <PlannerCalendarSurface
          tasks={tasks}
          timeBlocks={timeBlocks}
          projects={projects}
          language={language}
          isMobile={isMobile}
          selectedTaskId={selectedTaskId}
          onClose={() => setIsCalendarOpen(false)}
          onSelectTask={setSelectedTaskId}
          onCreateTask={onCreateTask}
          onCreateTimeBlock={onCreateTimeBlock}
          onUpdateTimeBlock={onUpdateTimeBlock}
          onDeleteTimeBlock={onDeleteTimeBlock}
        />
      ) : null}
    </section>
  );
}
