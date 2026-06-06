import { useMemo, useState } from "react";
import { createPortal } from "react-dom";

import type { AppLanguage, Habit, HabitLog, Project, Task, TimeBlock } from "../../../types";
import { buildPlannerReview, type PlannerReviewMode } from "../../../lib/plannerReview";
import { formatPlannerDate, getPlannerPriorityLabel } from "../../../lib/planner";
import "./PlannerReviewSurface.css";

interface PlannerReviewSurfaceProps {
  tasks: Task[];
  habits: Habit[];
  habitLogs: HabitLog[];
  projects: Project[];
  timeBlocks: TimeBlock[];
  language: AppLanguage;
  isMobile: boolean;
  onToggleTaskDone: (taskId: string, done: boolean) => Promise<Task | null>;
  onToggleHabitLog: (habitId: string, dayAt?: number) => Promise<HabitLog | null>;
}

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

function ReviewTaskRow({
  task,
  language,
  tone = "neutral",
  actionLabel,
  onToggleDone
}: {
  task: Task;
  language: AppLanguage;
  tone?: "neutral" | "danger" | "success" | "attention";
  actionLabel?: string;
  onToggleDone: () => void;
}) {
  return (
    <article className={`planner-review-row is-${tone}`}>
      <button type="button" aria-label={actionLabel ?? (language === "ru" ? "Готово" : "Done")} onClick={onToggleDone}>
        <span />
      </button>
      <div>
        <strong>{task.title}</strong>
        <span>
          {task.dueAt ? formatPlannerDate(task.dueAt, language) : language === "ru" ? "без даты" : "no date"}
          {task.priority !== "none" ? ` · ${getPlannerPriorityLabel(task.priority, language)}` : ""}
        </span>
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
  const rangeLabel = getRangeLabel(review.rangeStartAt, review.rangeEndAt, language);
  const isFullscreenAvailable = typeof document !== "undefined";
  const focusGroups = [
    {
      id: "overdue",
      title: language === "ru" ? "Просрочено" : "Overdue",
      summary:
        review.overdueTasks.length > 0
          ? language === "ru"
            ? "Сначала закрываем долги, которые уже тянут фокус назад."
            : "Start with the debt that is already pulling focus backward."
          : language === "ru"
            ? "Просроченных задач нет."
            : "No overdue tasks.",
      tasks: review.overdueTasks,
      tone: "danger" as const,
      empty: language === "ru" ? "Нет долгов по срокам." : "No overdue debt.",
      doneValue: true
    },
    {
      id: "moved",
      title: language === "ru" ? "Перенесено" : "Moved forward",
      summary:
        review.movedTasks.length > 0
          ? language === "ru"
            ? "Проверь, что переносы были осознанными, а не тихим накоплением долга."
            : "Check that reschedules were intentional, not quiet debt."
          : language === "ru"
            ? "Свежих переносов нет."
            : "No recent reschedules.",
      tasks: review.movedTasks,
      tone: "attention" as const,
      empty: language === "ru" ? "Нет свежих переносов." : "No recent reschedules.",
      doneValue: true
    },
    {
      id: "inbox",
      title: language === "ru" ? "Inbox" : "Inbox",
      summary:
        review.inboxTasks.length > 0
          ? language === "ru"
            ? "Разбери входящие: дай дату, проект или честно удали лишнее."
            : "Process inbox: assign date, project, or remove what no longer matters."
          : language === "ru"
            ? "Inbox чистый."
            : "Inbox is clear.",
      tasks: review.inboxTasks,
      tone: "neutral" as const,
      empty: language === "ru" ? "Входящих задач нет." : "No inbox tasks.",
      doneValue: true
    }
  ];

  const renderReviewContent = (fullscreen: boolean) => (
    <div className="planner-review-shell">
      <header className="planner-review-head">
        <div className="planner-review-title-block">
          <span className="planner-kicker">{language === "ru" ? "Review" : "Review"}</span>
          <h2>
            {mode === "day"
              ? language === "ru"
                ? "Разбор дня"
                : "Daily review"
              : language === "ru"
                ? "Разбор недели"
                : "Weekly review"}
          </h2>
          <p>{rangeLabel}</p>
        </div>
        <div className="planner-review-actions">
          <div className="planner-review-mode-switch" aria-label={language === "ru" ? "Период ревью" : "Review range"}>
            <button type="button" className={mode === "day" ? "is-active" : ""} onClick={() => setMode("day")}>
              {language === "ru" ? "День" : "Day"}
            </button>
            <button type="button" className={mode === "week" ? "is-active" : ""} onClick={() => setMode("week")}>
              {language === "ru" ? "Неделя" : "Week"}
            </button>
          </div>
          {isFullscreenAvailable ? (
            <button type="button" className="planner-review-expand" onClick={() => setExpanded(!fullscreen)}>
              {fullscreen ? (language === "ru" ? "Свернуть" : "Collapse") : language === "ru" ? "Развернуть" : "Expand"}
            </button>
          ) : null}
        </div>
      </header>

      <div className="planner-review-body">
        <div className="planner-review-stats" aria-label={language === "ru" ? "Сводка ревью" : "Review summary"}>
          <div>
            <span>{language === "ru" ? "Готово" : "Done"}</span>
            <strong>{review.stats.completed}</strong>
          </div>
          <div>
            <span>{language === "ru" ? "Просрочено" : "Overdue"}</span>
            <strong>{review.stats.overdue}</strong>
          </div>
          <div>
            <span>{language === "ru" ? "Inbox" : "Inbox"}</span>
            <strong>{review.stats.inbox}</strong>
          </div>
          <div>
            <span>{language === "ru" ? "Привычки" : "Habits"}</span>
            <strong>
              {review.stats.habitsDoneToday}/{review.stats.habitsDueToday}
            </strong>
          </div>
        </div>

        <div className="planner-review-workspace">
          <div className="planner-review-feed">
            <section className="planner-review-panel is-primary">
              <div className="planner-review-panel-head">
                <div>
                  <span>{language === "ru" ? "Фокус разбора" : "Review focus"}</span>
                  <h3>{language === "ru" ? "Что требует решения" : "What needs a decision"}</h3>
                </div>
                <strong>{review.stats.overdue + review.stats.moved + review.stats.inbox}</strong>
              </div>

              <div className="planner-review-decision-list">
                {focusGroups.map((group) => (
                  <section key={group.id} className={`planner-review-decision-group is-${group.tone}`}>
                    <div className="planner-review-group-head">
                      <div>
                        <h4>{group.title}</h4>
                        <p>{group.summary}</p>
                      </div>
                      <span>{group.tasks.length}</span>
                    </div>
                    <div className="planner-review-list">
                      {group.tasks.length > 0 ? (
                        group.tasks.slice(0, 12).map((task) => (
                          <ReviewTaskRow
                            key={task.id}
                            task={task}
                            language={language}
                            tone={group.tone}
                            onToggleDone={() => void onToggleTaskDone(task.id, group.doneValue)}
                          />
                        ))
                      ) : (
                        <p className="planner-review-empty">{group.empty}</p>
                      )}
                    </div>
                  </section>
                ))}
              </div>
            </section>

            <section className="planner-review-panel">
              <div className="planner-review-panel-head">
                <div>
                  <span>{language === "ru" ? "Итоги" : "Done work"}</span>
                  <h3>{language === "ru" ? "Выполнено за период" : "Completed in range"}</h3>
                </div>
                <strong>{review.completedTasks.length}</strong>
              </div>
              <div className="planner-review-list">
                {review.completedTasks.length > 0 ? (
                  review.completedTasks.slice(0, 14).map((task) => (
                    <ReviewTaskRow
                      key={task.id}
                      task={task}
                      language={language}
                      tone="success"
                      actionLabel={language === "ru" ? "Вернуть в работу" : "Mark active"}
                      onToggleDone={() => void onToggleTaskDone(task.id, false)}
                    />
                  ))
                ) : (
                  <p className="planner-review-empty">
                    {language === "ru" ? "Пока нечего праздновать, но период еще живой." : "Nothing completed yet; the range is still open."}
                  </p>
                )}
              </div>
            </section>
          </div>

          <aside className="planner-review-side">
            <section className="planner-review-panel">
              <div className="planner-review-panel-head">
                <div>
                  <span>{language === "ru" ? "Ритм" : "Rhythm"}</span>
                  <h3>{language === "ru" ? "Привычки" : "Habits"}</h3>
                </div>
                <strong>
                  {review.stats.habitsDoneToday}/{review.stats.habitsDueToday}
                </strong>
              </div>
              <div className="planner-review-habit-list">
                {review.habitSummaries.length > 0 ? (
                  review.habitSummaries.slice(0, 12).map((summary) => (
                    <button
                      key={summary.habit.id}
                      type="button"
                      className={summary.completedToday ? "is-complete" : ""}
                      onClick={() => void onToggleHabitLog(summary.habit.id)}
                    >
                      <span className="planner-review-habit-mark" />
                      <div>
                        <strong>{summary.habit.title}</strong>
                        <em>
                          {language === "ru"
                            ? `${summary.weekCompletedCount}/${summary.weekDueCount} за неделю`
                            : `${summary.weekCompletedCount}/${summary.weekDueCount} this week`}
                        </em>
                      </div>
                    </button>
                  ))
                ) : (
                  <p className="planner-review-empty">{language === "ru" ? "Привычек пока нет." : "No habits yet."}</p>
                )}
              </div>
            </section>

            <section className="planner-review-panel">
              <div className="planner-review-panel-head">
                <div>
                  <span>{language === "ru" ? "Проекты" : "Projects"}</span>
                  <h3>{language === "ru" ? "Без движения" : "Quiet projects"}</h3>
                </div>
                <strong>{review.staleProjects.length}</strong>
              </div>
              <div className="planner-review-project-list">
                {review.staleProjects.length > 0 ? (
                  review.staleProjects.slice(0, 12).map((signal) => (
                    <article key={signal.project.id} className="planner-review-project-row">
                      <span style={{ background: signal.project.color }} />
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
      </div>
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
