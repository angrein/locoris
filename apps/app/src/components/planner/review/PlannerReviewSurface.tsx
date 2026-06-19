import { useMemo, useState, type CSSProperties, type ReactNode } from "react";
import { createPortal } from "react-dom";

import type { AppLanguage, Habit, HabitLog, Project, Task, TimeBlock } from "../../../types";
import { buildPlannerReview, type PlannerReviewMode, type PlannerReviewProjectSignal } from "../../../lib/plannerReview";
import { formatPlannerDate, getPlannerPriorityLabel } from "../../../lib/planner";
import type { PlannerHabitSummary } from "../../../lib/plannerHabits";
import "./PlannerReviewSurface.css";

interface PlannerReviewSurfaceProps {
  tasks: Task[];
  habits: Habit[];
  habitLogs: HabitLog[];
  projects: Project[];
  timeBlocks: TimeBlock[];
  language: AppLanguage;
  isMobile: boolean;
  onToggleTaskDone: (taskId: string, done: boolean) => Promise<void> | void;
  onToggleHabitLog: (habitId: string, dayAt?: number) => Promise<HabitLog | null>;
}

type ReviewSurfaceMode = "review" | "analytics";
type ReviewAnalyticsMode = "tasks" | "habits";
type ReviewDecisionFilter = "all" | "overdue" | "inbox" | "moved" | "projects" | "habits";
type ReviewTone = "neutral" | "success" | "danger" | "attention" | "habit" | "project";

interface ReviewDecisionItem {
  id: string;
  filter: Exclude<ReviewDecisionFilter, "all">;
  tone: ReviewTone;
  title: string;
  kicker: string;
  description: string;
  meta: string;
  task?: Task;
  habit?: PlannerHabitSummary;
  projectSignal?: PlannerReviewProjectSignal;
}

const DECISION_FILTERS: ReviewDecisionFilter[] = ["all", "overdue", "inbox", "moved", "projects", "habits"];

function getRangeLabel(startAt: number, endAt: number, language: AppLanguage) {
  const locale = language === "ru" ? "ru-RU" : "en-US";
  const formatter = new Intl.DateTimeFormat(locale, {
    day: "numeric",
    month: "short"
  });

  if (formatPlannerDate(startAt, language) === formatPlannerDate(endAt, language)) {
    return formatter.format(startAt);
  }

  return `${formatter.format(startAt)} - ${formatter.format(endAt)}`;
}

function formatHabitRate(value: number | null, language: AppLanguage) {
  if (value === null) {
    return language === "ru" ? "нет данных" : "no data";
  }

  return `${Math.round(value * 100)}%`;
}

function getProjectLabel(project: Project | null, language: AppLanguage) {
  return project?.name ?? (language === "ru" ? "Inbox" : "Inbox");
}

function getTaskProject(task: Task, projectMap: Map<string, Project>) {
  return task.projectId ? projectMap.get(task.projectId) ?? null : null;
}

function getTaskMeta(task: Task, projectMap: Map<string, Project>, language: AppLanguage) {
  const project = getTaskProject(task, projectMap);
  const parts = [
    getProjectLabel(project, language),
    task.dueAt || task.scheduledStartAt ? formatPlannerDate(task.dueAt ?? task.scheduledStartAt, language) : language === "ru" ? "без даты" : "no date"
  ];

  if (task.priority !== "none") {
    parts.push(getPlannerPriorityLabel(task.priority, language));
  }

  if (task.recurrenceRule) {
    parts.push(language === "ru" ? "повтор" : "repeat");
  }

  return parts.join(" · ");
}

function getDecisionFilterLabel(filter: ReviewDecisionFilter, language: AppLanguage) {
  if (language === "ru") {
    return {
      all: "Все",
      overdue: "Просрочено",
      inbox: "Inbox",
      moved: "Перенесено",
      projects: "Проекты",
      habits: "Привычки"
    }[filter];
  }

  return {
    all: "All",
    overdue: "Overdue",
    inbox: "Inbox",
    moved: "Moved",
    projects: "Projects",
    habits: "Habits"
  }[filter];
}

function getHabitHealthLabel(summary: PlannerHabitSummary, language: AppLanguage) {
  if (language === "ru") {
    return {
      new: "Новая",
      steady: "Стабильно",
      watch: "Внимание",
      risk: "Риск",
      paused: "Пауза"
    }[summary.health];
  }

  return {
    new: "New",
    steady: "Steady",
    watch: "Watch",
    risk: "At risk",
    paused: "Paused"
  }[summary.health];
}

function getDecisionBadge(item: ReviewDecisionItem, language: AppLanguage) {
  if (language === "ru") {
    return {
      overdue: { mark: "!", label: "Срок" },
      inbox: { mark: "+", label: "Inbox" },
      moved: { mark: "↷", label: "Перен." },
      projects: { mark: "•", label: "Проект" },
      habits: { mark: "✓", label: "Ритм" }
    }[item.filter];
  }

  return {
    overdue: { mark: "!", label: "Due" },
    inbox: { mark: "+", label: "Inbox" },
    moved: { mark: "↷", label: "Moved" },
    projects: { mark: "•", label: "Project" },
    habits: { mark: "✓", label: "Habit" }
  }[item.filter];
}

function ReviewDecisionBadge({ item, language }: { item: ReviewDecisionItem; language: AppLanguage }) {
  const badge = getDecisionBadge(item, language);

  return (
    <div className="planner-review-decision-badge" aria-hidden="true">
      <strong>{badge.mark}</strong>
      <span>{badge.label}</span>
    </div>
  );
}

function ReviewSegmentedButton({
  active,
  children,
  onClick
}: {
  active: boolean;
  children: ReactNode;
  onClick: () => void;
}) {
  return (
    <button type="button" className={active ? "is-active" : ""} onClick={onClick}>
      {children}
    </button>
  );
}

function ReviewSnapshot({
  items,
  language
}: {
  items: Array<{ id: string; label: string; value: string | number; detail: string; tone: ReviewTone }>;
  language: AppLanguage;
}) {
  return (
    <section className="planner-review-snapshot" aria-label={language === "ru" ? "Сводка Review" : "Review snapshot"}>
      {items.map((item) => (
        <article key={item.id} className={`planner-review-snapshot-card is-${item.tone}`}>
          <span>{item.label}</span>
          <strong>{item.value}</strong>
          <em>{item.detail}</em>
        </article>
      ))}
    </section>
  );
}

function ReviewTaskCheck({
  task,
  language,
  onToggleTaskDone
}: {
  task: Task;
  language: AppLanguage;
  onToggleTaskDone: (taskId: string, done: boolean) => Promise<void> | void;
}) {
  return (
    <button
      type="button"
      className="planner-review-row-check"
      aria-label={language === "ru" ? "Отметить готовым" : "Mark done"}
      onClick={() => void onToggleTaskDone(task.id, true)}
    >
      <span />
    </button>
  );
}

function ReviewDecisionRow({
  item,
  language,
  onToggleTaskDone,
  onToggleHabitLog
}: {
  item: ReviewDecisionItem;
  language: AppLanguage;
  onToggleTaskDone: (taskId: string, done: boolean) => Promise<void> | void;
  onToggleHabitLog: (habitId: string, dayAt?: number) => Promise<HabitLog | null>;
}) {
  return (
    <article className={`planner-review-decision-row is-${item.tone}`}>
      <ReviewDecisionBadge item={item} language={language} />
      <div className="planner-review-decision-main">
        <div className="planner-review-decision-title">
          <span>{item.kicker}</span>
          <strong>{item.title}</strong>
        </div>
        <p>{item.description}</p>
        <em>{item.meta}</em>
      </div>
      {item.task ? <ReviewTaskCheck task={item.task} language={language} onToggleTaskDone={onToggleTaskDone} /> : null}
      {item.habit?.dueToday ? (
        <button
          type="button"
          className="planner-review-row-action"
          onClick={() => void onToggleHabitLog(item.habit?.habit.id ?? "")}
        >
          {item.habit.completedToday ? (language === "ru" ? "Убрать" : "Undo") : language === "ru" ? "Отметить" : "Check"}
        </button>
      ) : null}
    </article>
  );
}

function ReviewProgressBar({
  label,
  value,
  max,
  meta,
  tone = "neutral"
}: {
  label: string;
  value: number;
  max: number;
  meta: string;
  tone?: ReviewTone;
}) {
  const width = max > 0 ? Math.max(4, Math.round((value / max) * 100)) : 0;

  return (
    <article className={`planner-review-bar-row is-${tone}`} style={{ "--planner-review-bar": `${width}%` } as CSSProperties}>
      <div>
        <strong>{label}</strong>
        <span>{meta}</span>
      </div>
      <em>{value}</em>
      <i aria-hidden="true" />
    </article>
  );
}

function ReviewMiniHabitHeatmap({ summary }: { summary: PlannerHabitSummary }) {
  return (
    <div className="planner-review-mini-heatmap" aria-hidden="true">
      {summary.historyDays.slice(-28).map((day) => (
        <span
          key={day.dayAt}
          className={`${day.due ? "is-due" : ""} ${day.completed ? "is-complete" : ""} ${day.missed ? "is-missed" : ""} ${
            day.paused ? "is-paused" : ""
          } ${day.today ? "is-today" : ""}`}
        />
      ))}
    </div>
  );
}

function ReviewHabitRow({ summary, language }: { summary: PlannerHabitSummary; language: AppLanguage }) {
  return (
    <article className={`planner-review-habit-row is-${summary.health}`} style={{ "--planner-review-habit-color": summary.habit.color } as CSSProperties}>
      <span aria-hidden="true" />
      <div>
        <strong>{summary.habit.title}</strong>
        <em>
          {getHabitHealthLabel(summary, language)} · {formatHabitRate(summary.last30CompletionRate, language)}
          {summary.last30MissedCount > 0 ? ` · ${language === "ru" ? `${summary.last30MissedCount} проп.` : `${summary.last30MissedCount} missed`}` : ""}
        </em>
      </div>
      <ReviewMiniHabitHeatmap summary={summary} />
    </article>
  );
}

function ReviewLogbookRow({
  task,
  language,
  projectMap,
  onToggleTaskDone
}: {
  task: Task;
  language: AppLanguage;
  projectMap: Map<string, Project>;
  onToggleTaskDone: (taskId: string, done: boolean) => Promise<void> | void;
}) {
  return (
    <article className="planner-review-logbook-row">
      <button
        type="button"
        aria-label={language === "ru" ? "Вернуть задачу в работу" : "Return task to active"}
        onClick={() => void onToggleTaskDone(task.id, false)}
      >
        <span />
      </button>
      <div>
        <strong>{task.title}</strong>
        <em>{getTaskMeta(task, projectMap, language)}</em>
      </div>
    </article>
  );
}

export default function PlannerReviewSurface({
  tasks,
  habits,
  habitLogs,
  projects,
  timeBlocks,
  language,
  isMobile,
  onToggleTaskDone,
  onToggleHabitLog
}: PlannerReviewSurfaceProps) {
  const [mode, setMode] = useState<PlannerReviewMode>("day");
  const [surfaceMode, setSurfaceMode] = useState<ReviewSurfaceMode>("review");
  const [analyticsMode, setAnalyticsMode] = useState<ReviewAnalyticsMode>("tasks");
  const [decisionFilter, setDecisionFilter] = useState<ReviewDecisionFilter>("all");
  const [expanded, setExpanded] = useState(false);
  const review = useMemo(
    () =>
      buildPlannerReview({
        tasks,
        habits,
        habitLogs,
        projects,
        timeBlocks,
        mode
      }),
    [habitLogs, habits, mode, projects, tasks, timeBlocks]
  );
  const projectMap = useMemo(() => new Map(projects.map((project) => [project.id, project])), [projects]);
  const rangeLabel = getRangeLabel(review.rangeStartAt, review.rangeEndAt, language);
  const isFullscreenAvailable = typeof document !== "undefined";
  const snapshotItems = [
    {
      id: "completed",
      label: language === "ru" ? "Готово" : "Done",
      value: review.stats.completed,
      detail: language === "ru" ? "за период" : "in range",
      tone: "success" as const
    },
    {
      id: "overdue",
      label: language === "ru" ? "Просрочено" : "Overdue",
      value: review.stats.overdue,
      detail: language === "ru" ? "требует решения" : "needs decision",
      tone: review.stats.overdue > 0 ? ("danger" as const) : ("neutral" as const)
    },
    {
      id: "inbox",
      label: "Inbox",
      value: review.stats.inbox,
      detail: language === "ru" ? "без ясного места" : "needs context",
      tone: review.stats.inbox > 0 ? ("attention" as const) : ("neutral" as const)
    },
    {
      id: "moved",
      label: language === "ru" ? "Переносы" : "Moved",
      value: review.stats.moved,
      detail: language === "ru" ? "за период" : "in range",
      tone: review.stats.moved > 0 ? ("attention" as const) : ("neutral" as const)
    },
    {
      id: "habits",
      label: language === "ru" ? "Ритм" : "Rhythm",
      value: formatHabitRate(review.stats.habitCompletionRate30, language),
      detail: language === "ru" ? "30 дней" : "30 days",
      tone: review.stats.habitsAtRisk > 0 ? ("habit" as const) : ("success" as const)
    },
    {
      id: "projects",
      label: language === "ru" ? "Проекты" : "Projects",
      value: review.stats.staleProjects,
      detail: language === "ru" ? "без движения" : "quiet",
      tone: review.stats.staleProjects > 0 ? ("project" as const) : ("neutral" as const)
    }
  ];
  const decisionItems = useMemo(() => {
    const items: ReviewDecisionItem[] = [];
    const usedTaskIds = new Set<string>();
    const pushTask = (task: Task, filter: ReviewDecisionItem["filter"], tone: ReviewTone, kicker: string, description: string) => {
      if (usedTaskIds.has(task.id)) {
        return;
      }

      usedTaskIds.add(task.id);
      items.push({
        id: `${filter}-${task.id}`,
        filter,
        tone,
        title: task.title,
        kicker,
        description: task.description || description,
        meta: getTaskMeta(task, projectMap, language),
        task
      });
    };

    for (const task of review.overdueTasks) {
      pushTask(
        task,
        "overdue",
        "danger",
        language === "ru" ? "Просрочено" : "Overdue",
        language === "ru" ? "Закрой, перенеси или честно отмени этот долг." : "Complete, reschedule, or cancel this debt."
      );
    }

    for (const task of review.inboxTasks) {
      pushTask(
        task,
        "inbox",
        "neutral",
        "Inbox",
        language === "ru" ? "Нужны дата, проект или ясное решение." : "Needs a date, project, or a clear decision."
      );
    }

    for (const task of review.movedTasks) {
      pushTask(
        task,
        "moved",
        "attention",
        language === "ru" ? "Перенесено" : "Moved",
        language === "ru" ? "Проверь, это осознанный перенос или накопление долга." : "Check whether this move was intentional."
      );
    }

    for (const signal of review.staleProjects) {
      items.push({
        id: `project-${signal.project.id}`,
        filter: "projects",
        tone: "project",
        title: signal.project.name,
        kicker: language === "ru" ? "Проект без движения" : "Quiet project",
        description:
          language === "ru"
            ? "Есть активные задачи, но за период не было движения."
            : "There are active tasks, but no recent movement in the range.",
        meta:
          language === "ru"
            ? `${signal.activeTaskCount} активн. задач`
            : `${signal.activeTaskCount} active tasks`,
        projectSignal: signal
      });
    }

    for (const summary of review.habitInsights.atRisk) {
      items.push({
        id: `habit-${summary.habit.id}`,
        filter: "habits",
        tone: summary.health === "risk" ? "danger" : "habit",
        title: summary.habit.title,
        kicker: language === "ru" ? "Ритм требует внимания" : "Rhythm needs attention",
        description:
          summary.health === "risk"
            ? language === "ru"
              ? "За последние 30 дней накопились пропуски."
              : "Misses are piling up over the last 30 days."
            : language === "ru"
              ? "Сегодня привычка ждет отметки или ритм стал нестабильным."
              : "Today's check-in is open or the rhythm is becoming unstable.",
        meta: `${getHabitHealthLabel(summary, language)} · ${formatHabitRate(summary.last30CompletionRate, language)}`,
        habit: summary
      });
    }

    return items;
  }, [language, projectMap, review.habitInsights.atRisk, review.inboxTasks, review.movedTasks, review.overdueTasks, review.staleProjects]);
  const decisionCounts = DECISION_FILTERS.reduce<Record<ReviewDecisionFilter, number>>(
    (acc, filter) => {
      acc[filter] = filter === "all" ? decisionItems.length : decisionItems.filter((item) => item.filter === filter).length;
      return acc;
    },
    {
      all: 0,
      overdue: 0,
      inbox: 0,
      moved: 0,
      projects: 0,
      habits: 0
    }
  );
  const filteredDecisionItems =
    decisionFilter === "all" ? decisionItems : decisionItems.filter((item) => item.filter === decisionFilter);
  const maxPriorityValue = Math.max(1, ...review.taskAnalytics.prioritySignals.map((signal) => signal.activeTaskCount + signal.completedTaskCount));
  const maxProjectValue = Math.max(1, ...review.taskAnalytics.projectSignals.map((signal) => signal.activeTaskCount + signal.completedTaskCount));
  const sortedHabitSummaries = [...review.habitSummaries].sort(
    (left, right) =>
      right.last30MissedCount - left.last30MissedCount ||
      (right.last30CompletionRate ?? 0) - (left.last30CompletionRate ?? 0)
  );

  const renderReviewMode = () => (
    <>
      <ReviewSnapshot items={snapshotItems} language={language} />
      <div className="planner-review-cockpit">
        <main className="planner-review-main-column">
          <section className="planner-review-section is-decision">
            <div className="planner-review-section-head">
              <div>
                <span>{language === "ru" ? "Фокус разбора" : "Review focus"}</span>
                <h3>{language === "ru" ? "Что требует решения" : "What needs a decision"}</h3>
              </div>
              <strong>{decisionItems.length}</strong>
            </div>
            <nav className="planner-review-filter-row" aria-label={language === "ru" ? "Фильтры решений" : "Decision filters"}>
              {DECISION_FILTERS.map((filter) => (
                <button
                  key={filter}
                  type="button"
                  className={decisionFilter === filter ? "is-active" : ""}
                  onClick={() => setDecisionFilter(filter)}
                >
                  {getDecisionFilterLabel(filter, language)}
                  <span>{decisionCounts[filter]}</span>
                </button>
              ))}
            </nav>
            <div className="planner-review-decision-list">
              {filteredDecisionItems.length > 0 ? (
                filteredDecisionItems.map((item) => (
                  <ReviewDecisionRow
                    key={item.id}
                    item={item}
                    language={language}
                    onToggleTaskDone={onToggleTaskDone}
                    onToggleHabitLog={onToggleHabitLog}
                  />
                ))
              ) : (
                <div className="planner-review-calm-state">
                  <strong>{language === "ru" ? "Здесь спокойно" : "All calm here"}</strong>
                  <span>{language === "ru" ? "В этом фильтре нет решений, которые требуют внимания." : "No decisions need attention in this filter."}</span>
                </div>
              )}
            </div>
          </section>

          <section className="planner-review-section is-logbook">
            <div className="planner-review-section-head">
              <div>
                <span>{language === "ru" ? "Итоги" : "Logbook"}</span>
                <h3>{language === "ru" ? "Выполнено за период" : "Completed in range"}</h3>
              </div>
              <strong>{review.completedTasks.length}</strong>
            </div>
            <div className="planner-review-logbook-list">
              {review.completedTasks.length > 0 ? (
                review.completedTasks
                  .slice(0, 10)
                  .map((task) => (
                    <ReviewLogbookRow key={task.id} task={task} language={language} projectMap={projectMap} onToggleTaskDone={onToggleTaskDone} />
                  ))
              ) : (
                <p className="planner-review-empty">
                  {language === "ru" ? "Пока нечего подводить, но период еще живой." : "Nothing completed yet; the range is still open."}
                </p>
              )}
            </div>
          </section>
        </main>

        <aside className="planner-review-side-column">
          <section className="planner-review-section is-rhythm">
            <div className="planner-review-section-head">
              <div>
                <span>{language === "ru" ? "Ритм" : "Rhythm"}</span>
                <h3>{language === "ru" ? "Привычки" : "Habits"}</h3>
              </div>
              <strong>
                {review.stats.habitsDoneToday}/{review.stats.habitsDueToday}
              </strong>
            </div>
            <div className="planner-review-rhythm-hero">
              <span>{formatHabitRate(review.stats.habitCompletionRate30, language)}</span>
              <em>{language === "ru" ? "за последние 30 дней" : "over the last 30 days"}</em>
            </div>
            <div className="planner-review-rhythm-list">
              {review.habitInsights.atRisk.slice(0, 3).map((summary) => (
                <ReviewHabitRow key={summary.habit.id} summary={summary} language={language} />
              ))}
              {review.habitInsights.atRisk.length === 0 ? (
                <p className="planner-review-empty">{language === "ru" ? "Ритм держится, явных рисков нет." : "Rhythm is holding; no obvious risks."}</p>
              ) : null}
            </div>
          </section>

          <section className="planner-review-section is-project-health">
            <div className="planner-review-section-head">
              <div>
                <span>{language === "ru" ? "Проекты" : "Projects"}</span>
                <h3>{language === "ru" ? "Без движения" : "Quiet projects"}</h3>
              </div>
              <strong>{review.staleProjects.length}</strong>
            </div>
            <div className="planner-review-project-stack">
              {review.staleProjects.length > 0 ? (
                review.staleProjects.slice(0, 6).map((signal) => (
                  <article key={signal.project.id} className="planner-review-project-row" style={{ "--planner-review-project-color": signal.project.color } as CSSProperties}>
                    <span />
                    <div>
                      <strong>{signal.project.name}</strong>
                      <em>
                        {language === "ru"
                          ? `${signal.activeTaskCount} активн. задач`
                          : `${signal.activeTaskCount} active tasks`}
                      </em>
                    </div>
                  </article>
                ))
              ) : (
                <p className="planner-review-empty">
                  {language === "ru" ? "Все активные проекты шевелились в периоде." : "All active projects moved in this range."}
                </p>
              )}
            </div>
          </section>
        </aside>
      </div>
    </>
  );

  const renderTaskAnalytics = () => (
    <div className="planner-review-analytics">
      <ReviewSnapshot
        language={language}
        items={[
          {
            id: "created",
            label: language === "ru" ? "Создано" : "Created",
            value: review.taskAnalytics.created,
            detail: language === "ru" ? "за период" : "in range",
            tone: "neutral"
          },
          {
            id: "completed",
            label: language === "ru" ? "Закрыто" : "Completed",
            value: review.stats.completed,
            detail: language === "ru" ? "за период" : "in range",
            tone: "success"
          },
          {
            id: "no-date",
            label: language === "ru" ? "Без даты" : "No date",
            value: review.taskAnalytics.noDate,
            detail: language === "ru" ? "активные" : "active",
            tone: "attention"
          },
          {
            id: "linked",
            label: language === "ru" ? "Со связями" : "Linked",
            value: review.taskAnalytics.linked,
            detail: language === "ru" ? "к контексту" : "to context",
            tone: "project"
          }
        ]}
      />
      <div className="planner-review-analytics-grid">
        <section className="planner-review-section">
          <div className="planner-review-section-head">
            <div>
              <span>{language === "ru" ? "Поток" : "Flow"}</span>
              <h3>{language === "ru" ? "Создано vs закрыто" : "Created vs completed"}</h3>
            </div>
          </div>
          <div className="planner-review-bar-stack">
            <ReviewProgressBar
              label={language === "ru" ? "Создано" : "Created"}
              value={review.taskAnalytics.created}
              max={Math.max(review.taskAnalytics.created, review.stats.completed, 1)}
              meta={language === "ru" ? "новая нагрузка" : "new load"}
              tone="neutral"
            />
            <ReviewProgressBar
              label={language === "ru" ? "Закрыто" : "Completed"}
              value={review.stats.completed}
              max={Math.max(review.taskAnalytics.created, review.stats.completed, 1)}
              meta={language === "ru" ? "закрытый хвост" : "closed work"}
              tone="success"
            />
            <ReviewProgressBar
              label={language === "ru" ? "Просрочено" : "Overdue"}
              value={review.stats.overdue}
              max={Math.max(review.taskAnalytics.active, review.stats.overdue, 1)}
              meta={language === "ru" ? "долг" : "debt"}
              tone="danger"
            />
          </div>
        </section>

        <section className="planner-review-section">
          <div className="planner-review-section-head">
            <div>
              <span>{language === "ru" ? "Приоритеты" : "Priority"}</span>
              <h3>{language === "ru" ? "Активные и закрытые" : "Active and done"}</h3>
            </div>
          </div>
          <div className="planner-review-bar-stack">
            {review.taskAnalytics.prioritySignals.length > 0 ? (
              review.taskAnalytics.prioritySignals.map((signal) => (
                <ReviewProgressBar
                  key={signal.priority}
                  label={getPlannerPriorityLabel(signal.priority, language)}
                  value={signal.activeTaskCount + signal.completedTaskCount}
                  max={maxPriorityValue}
                  meta={
                    language === "ru"
                      ? `${signal.activeTaskCount} активн. · ${signal.completedTaskCount} готово`
                      : `${signal.activeTaskCount} active · ${signal.completedTaskCount} done`
                  }
                  tone={signal.priority === "urgent" || signal.priority === "high" ? "danger" : "neutral"}
                />
              ))
            ) : (
              <p className="planner-review-empty">{language === "ru" ? "Приоритетов пока нет." : "No priority data yet."}</p>
            )}
          </div>
        </section>

        <section className="planner-review-section">
          <div className="planner-review-section-head">
            <div>
              <span>{language === "ru" ? "Проекты" : "Projects"}</span>
              <h3>{language === "ru" ? "Нагрузка по проектам" : "Project load"}</h3>
            </div>
          </div>
          <div className="planner-review-bar-stack">
            {review.taskAnalytics.projectSignals.length > 0 ? (
              review.taskAnalytics.projectSignals.slice(0, 10).map((signal) => (
                <ReviewProgressBar
                  key={signal.project?.id ?? "inbox"}
                  label={getProjectLabel(signal.project, language)}
                  value={signal.activeTaskCount + signal.completedTaskCount}
                  max={maxProjectValue}
                  meta={
                    language === "ru"
                      ? `${signal.activeTaskCount} активн. · ${signal.completedTaskCount} готово`
                      : `${signal.activeTaskCount} active · ${signal.completedTaskCount} done`
                  }
                  tone={signal.overdueTaskCount > 0 ? "danger" : signal.project ? "project" : "neutral"}
                />
              ))
            ) : (
              <p className="planner-review-empty">{language === "ru" ? "Нет проектной нагрузки." : "No project load yet."}</p>
            )}
          </div>
        </section>

        <section className="planner-review-section">
          <div className="planner-review-section-head">
            <div>
              <span>{language === "ru" ? "Logbook" : "Logbook"}</span>
              <h3>{language === "ru" ? "Закрыто по проектам" : "Completed by project"}</h3>
            </div>
          </div>
          <div className="planner-review-project-stack">
            {review.taskAnalytics.completedByProject.length > 0 ? (
              review.taskAnalytics.completedByProject.slice(0, 8).map((group) => (
                <article
                  key={group.project?.id ?? "inbox"}
                  className="planner-review-project-row"
                  style={{ "--planner-review-project-color": group.project?.color ?? "var(--planner-accent)" } as CSSProperties}
                >
                  <span />
                  <div>
                    <strong>{getProjectLabel(group.project, language)}</strong>
                    <em>{language === "ru" ? `${group.tasks.length} закрыто` : `${group.tasks.length} completed`}</em>
                  </div>
                </article>
              ))
            ) : (
              <p className="planner-review-empty">{language === "ru" ? "За период задач не закрывали." : "No completed tasks in range."}</p>
            )}
          </div>
        </section>
      </div>
    </div>
  );

  const renderHabitAnalytics = () => (
    <div className="planner-review-analytics">
      <ReviewSnapshot
        language={language}
        items={[
          {
            id: "rate",
            label: language === "ru" ? "30 дней" : "30 days",
            value: formatHabitRate(review.stats.habitCompletionRate30, language),
            detail: language === "ru" ? "средний ритм" : "average rhythm",
            tone: review.stats.habitsAtRisk > 0 ? "habit" : "success"
          },
          {
            id: "steady",
            label: language === "ru" ? "Стабильные" : "Steady",
            value: review.stats.habitsSteady,
            detail: language === "ru" ? "держатся" : "holding",
            tone: "success"
          },
          {
            id: "risk",
            label: language === "ru" ? "Внимание" : "Watch",
            value: review.stats.habitsAtRisk,
            detail: language === "ru" ? "требуют решения" : "need care",
            tone: review.stats.habitsAtRisk > 0 ? "danger" : "neutral"
          },
          {
            id: "today",
            label: language === "ru" ? "Сегодня" : "Today",
            value: `${review.stats.habitsDoneToday}/${review.stats.habitsDueToday}`,
            detail: language === "ru" ? "отмечено" : "checked",
            tone: "habit"
          }
        ]}
      />
      <div className="planner-review-habit-analytics">
        <section className="planner-review-section">
          <div className="planner-review-section-head">
            <div>
              <span>{language === "ru" ? "Риск" : "Risk"}</span>
              <h3>{language === "ru" ? "Нужны решения" : "Needs attention"}</h3>
            </div>
            <strong>{review.habitInsights.atRisk.length}</strong>
          </div>
          <div className="planner-review-habit-stack">
            {review.habitInsights.atRisk.length > 0 ? (
              review.habitInsights.atRisk.map((summary) => <ReviewHabitRow key={summary.habit.id} summary={summary} language={language} />)
            ) : (
              <p className="planner-review-empty">{language === "ru" ? "Явных рисков нет." : "No obvious risks."}</p>
            )}
          </div>
        </section>

        <section className="planner-review-section">
          <div className="planner-review-section-head">
            <div>
              <span>{language === "ru" ? "Стабильность" : "Stability"}</span>
              <h3>{language === "ru" ? "Держатся" : "Holding steady"}</h3>
            </div>
            <strong>{review.habitInsights.steady.length}</strong>
          </div>
          <div className="planner-review-habit-stack">
            {review.habitInsights.steady.length > 0 ? (
              review.habitInsights.steady.map((summary) => <ReviewHabitRow key={summary.habit.id} summary={summary} language={language} />)
            ) : (
              <p className="planner-review-empty">{language === "ru" ? "Стабильных привычек пока нет." : "No steady habits yet."}</p>
            )}
          </div>
        </section>

        <section className="planner-review-section is-wide">
          <div className="planner-review-section-head">
            <div>
              <span>{language === "ru" ? "История" : "History"}</span>
              <h3>{language === "ru" ? "Все привычки" : "All habits"}</h3>
            </div>
            <strong>{review.habitSummaries.length}</strong>
          </div>
          <div className="planner-review-habit-table">
            {sortedHabitSummaries.length > 0 ? (
              sortedHabitSummaries.map((summary) => <ReviewHabitRow key={summary.habit.id} summary={summary} language={language} />)
            ) : (
              <p className="planner-review-empty">{language === "ru" ? "Привычек пока нет." : "No habits yet."}</p>
            )}
          </div>
        </section>
      </div>
    </div>
  );

  const renderAnalyticsMode = () => (
    <>
      <div className="planner-review-submode-row" aria-label={language === "ru" ? "Раздел аналитики" : "Analytics section"}>
        <ReviewSegmentedButton active={analyticsMode === "tasks"} onClick={() => setAnalyticsMode("tasks")}>
          {language === "ru" ? "Задачи" : "Tasks"}
        </ReviewSegmentedButton>
        <ReviewSegmentedButton active={analyticsMode === "habits"} onClick={() => setAnalyticsMode("habits")}>
          {language === "ru" ? "Привычки" : "Habits"}
        </ReviewSegmentedButton>
      </div>
      {analyticsMode === "tasks" ? renderTaskAnalytics() : renderHabitAnalytics()}
    </>
  );

  const renderReviewContent = (fullscreen: boolean) => (
    <div className="planner-review-shell">
      <header className="planner-review-head">
        <div className="planner-review-title-block">
          <span className="planner-kicker">{surfaceMode === "review" ? "Review" : language === "ru" ? "Аналитика" : "Analytics"}</span>
          <h2>
            {surfaceMode === "review"
              ? mode === "day"
                ? language === "ru"
                  ? "Разбор дня"
                  : "Daily review"
                : language === "ru"
                  ? "Разбор недели"
                  : "Weekly review"
              : analyticsMode === "tasks"
                ? language === "ru"
                  ? "Аналитика задач"
                  : "Task analytics"
                : language === "ru"
                  ? "Аналитика привычек"
                  : "Habit analytics"}
          </h2>
          <p>{rangeLabel}</p>
        </div>
        <div className="planner-review-actions">
          <div className="planner-review-surface-switch" aria-label={language === "ru" ? "Режим Review" : "Review mode"}>
            <ReviewSegmentedButton active={surfaceMode === "review"} onClick={() => setSurfaceMode("review")}>
              {language === "ru" ? "Разбор" : "Review"}
            </ReviewSegmentedButton>
            <ReviewSegmentedButton active={surfaceMode === "analytics"} onClick={() => setSurfaceMode("analytics")}>
              {language === "ru" ? "Аналитика" : "Analytics"}
            </ReviewSegmentedButton>
          </div>
          <div className="planner-review-period-switch" aria-label={language === "ru" ? "Период ревью" : "Review range"}>
            <ReviewSegmentedButton active={mode === "day"} onClick={() => setMode("day")}>
              {language === "ru" ? "День" : "Day"}
            </ReviewSegmentedButton>
            <ReviewSegmentedButton active={mode === "week"} onClick={() => setMode("week")}>
              {language === "ru" ? "Неделя" : "Week"}
            </ReviewSegmentedButton>
          </div>
          {isFullscreenAvailable ? (
            <button type="button" className="planner-review-expand" onClick={() => setExpanded(!fullscreen)}>
              {fullscreen ? (language === "ru" ? "Свернуть" : "Collapse") : language === "ru" ? "Развернуть" : "Expand"}
            </button>
          ) : null}
        </div>
      </header>
      <div className="planner-review-body">{surfaceMode === "review" ? renderReviewMode() : renderAnalyticsMode()}</div>
    </div>
  );

  return (
    <>
      <section className={`planner-review-surface ${isMobile ? "is-mobile" : "is-desktop"}`}>
        {renderReviewContent(false)}
      </section>
      {expanded && isFullscreenAvailable
        ? createPortal(
            <section
              className={`planner-review-layer ${isMobile ? "is-mobile" : "is-desktop"}`}
              role="dialog"
              aria-modal="true"
              aria-label={language === "ru" ? "Review" : "Review"}
            >
              {renderReviewContent(true)}
            </section>,
            document.body
          )
        : null}
    </>
  );
}
