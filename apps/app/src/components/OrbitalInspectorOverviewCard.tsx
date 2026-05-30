import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent as ReactKeyboardEvent,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
  type Ref
} from "react";

import type { NoteContentType } from "../types";
import "./OrbitalInspectorOverviewCard.css";

export type OrbitalOverviewMode = "vault" | "project";
export type OrbitalOverviewRecentKind = "folder" | NoteContentType;

export interface OrbitalOverviewProjectItem {
  id: string;
  name: string;
  color: string;
  documentCount: number;
  folderCount: number;
  updatedAt: number;
  isActive: boolean;
}

export interface OrbitalOverviewRecentItem {
  id: string;
  entityId: string;
  kind: OrbitalOverviewRecentKind;
  title: string;
  color: string;
  meta: string;
  updatedAt: number;
}

export type OrbitalOverviewLinkIcon = "project" | "folder" | "note" | "tag" | "file" | "color";
export type OrbitalOverviewLinkId = "notes" | "folders" | "tags" | "files" | "pinned" | "colors";

export interface OrbitalOverviewLinkItem {
  id: OrbitalOverviewLinkId;
  label: string;
  count: number;
  icon: OrbitalOverviewLinkIcon;
  color: string;
}

interface OrbitalInspectorOverviewCardProps {
  mode: OrbitalOverviewMode;
  title: string;
  titleNode: ReactNode;
  kicker: string;
  accentColor: string;
  activeProjectId: string | null;
  activeProjectIndex: number;
  projectCount: number;
  canNavigateProjects: boolean;
  projects: OrbitalOverviewProjectItem[];
  links: OrbitalOverviewLinkItem[];
  recentItems: OrbitalOverviewRecentItem[];
  lastUpdatedLabel: string;
  updatedLabel: string;
  emptyLabel: string;
  labels: {
    addProject: string;
    addRootFolder: string;
    addNote: string;
    addCanvas: string;
    back: string;
    deleteSystem: string;
    create: string;
    project: string;
    folder: string;
    note: string;
    canvas: string;
    previousProject: string;
    nextProject: string;
    projectColor: string;
    projectsStat: string;
    overviewSections: string;
  };
  colorButtonRef?: Ref<HTMLButtonElement>;
  isColorPanelOpen: boolean;
  editingProjectId?: string | null;
  renderProjectRenameField?: (project: OrbitalOverviewProjectItem) => ReactNode;
  onAddProject: (name: string) => void | Promise<void>;
  onAddFolder: () => void;
  onAddNote: () => void;
  onAddCanvas: () => void;
  onBackToVault: () => void;
  onCycleProject: (direction: -1 | 1) => void;
  onDeleteProject: () => void;
  onOpenLink: (linkId: OrbitalOverviewLinkId) => void;
  onFocusProject: (projectId: string) => void;
  onOpenProject: (projectId: string) => void;
  onMoveProject: (draggedProjectId: string, targetProjectId: string, placement: "before" | "after") => void;
  onProjectContextMenu: (projectId: string, event: ReactMouseEvent<HTMLButtonElement>) => void;
  onSelectRecentItem: (item: OrbitalOverviewRecentItem) => void;
  onOpenRecentItem: (item: OrbitalOverviewRecentItem) => void;
  onRecentContextMenu: (item: OrbitalOverviewRecentItem, event: ReactMouseEvent<HTMLButtonElement>) => void;
  onRecentPointerEnter: (item: OrbitalOverviewRecentItem, event: ReactPointerEvent<HTMLButtonElement>) => void;
  onRecentPointerMove: (item: OrbitalOverviewRecentItem, event: ReactPointerEvent<HTMLButtonElement>) => void;
  onRecentPointerLeave: (item: OrbitalOverviewRecentItem) => void;
  onRecentPointerCancel: (item: OrbitalOverviewRecentItem) => void;
  isTouchLayout?: boolean;
  previewLabel?: string;
  onPreviewRecentItem?: (item: OrbitalOverviewRecentItem) => void;
  onToggleColorPanel: () => void;
}

function formatCompactCount(value: number) {
  if (value >= 1000) {
    return `${Math.floor(value / 100) / 10}k`;
  }

  return String(value);
}

function getItemKindLabel(kind: OrbitalOverviewRecentKind, labels: OrbitalInspectorOverviewCardProps["labels"]) {
  if (kind === "canvas") {
    return labels.canvas;
  }

  if (kind === "folder") {
    return labels.folder;
  }

  return labels.note;
}

function Icon({
  kind
}: {
  kind:
    | "project"
    | "folder"
    | "note"
    | "canvas"
    | "back"
    | "color"
    | "trash"
    | "chevron"
    | "tag"
    | "file";
}) {
  if (kind === "folder") {
    return (
      <svg viewBox="0 0 24 24" focusable="false" aria-hidden="true">
        <path d="M3.8 7.2c0-1 .8-1.8 1.8-1.8h4.3l1.6 1.9h6.9c1 0 1.8.8 1.8 1.8v7.7c0 1-.8 1.8-1.8 1.8H5.6c-1 0-1.8-.8-1.8-1.8V7.2Z" />
      </svg>
    );
  }

  if (kind === "note") {
    return (
      <svg viewBox="0 0 24 24" focusable="false" aria-hidden="true">
        <path d="M7 4.8h7.2L18 8.6v10.6H7V4.8Z" />
        <path d="M14.1 4.9v4h4" />
        <path d="M9.5 12h6M9.5 15h4.2" />
      </svg>
    );
  }

  if (kind === "canvas") {
    return (
      <svg viewBox="0 0 24 24" focusable="false" aria-hidden="true">
        <rect x="5" y="5" width="14" height="14" rx="3" />
        <path d="M8.4 14.5l2.4-2.8 2.1 2.2 1.4-1.5 1.9 2.1" />
      </svg>
    );
  }

  if (kind === "back") {
    return (
      <svg viewBox="0 0 24 24" focusable="false" aria-hidden="true">
        <path d="M14.6 6.2 8.8 12l5.8 5.8" />
        <path d="M9.4 12h9" />
      </svg>
    );
  }

  if (kind === "color") {
    return (
      <svg viewBox="0 0 24 24" focusable="false" aria-hidden="true">
        <path d="M12 4.2a7.8 7.8 0 1 0 0 15.6 1.8 1.8 0 0 0 1.2-3.1 1.4 1.4 0 0 1 1-2.4h1.6A4.2 4.2 0 0 0 20 10.1c0-3.2-3.4-5.9-8-5.9Z" />
        <circle cx="8.4" cy="10" r=".7" />
        <circle cx="11.2" cy="7.9" r=".7" />
        <circle cx="14.7" cy="8.8" r=".7" />
      </svg>
    );
  }

  if (kind === "tag") {
    return (
      <svg viewBox="0 0 24 24" focusable="false" aria-hidden="true">
        <path d="M4.8 10.6V5.4h5.2l9.1 9.1-5.2 5.2-9.1-9.1Z" />
        <circle cx="8.2" cy="8.4" r="1" />
      </svg>
    );
  }

  if (kind === "file") {
    return (
      <svg viewBox="0 0 24 24" focusable="false" aria-hidden="true">
        <path d="M7 4.6h6.6L18 9v10.4H7V4.6Z" />
        <path d="M13.5 4.8v4.4h4.3" />
      </svg>
    );
  }

  if (kind === "trash") {
    return (
      <svg viewBox="0 0 24 24" focusable="false" aria-hidden="true">
        <path d="M7.8 8.5v8.2M12 8.5v8.2M16.2 8.5v8.2" />
        <path d="M5 6.3h14M9.2 6.3v-1c0-.8.7-1.5 1.5-1.5h2.6c.8 0 1.5.7 1.5 1.5v1" />
        <path d="m6.6 6.3.7 11c.1 1 .9 1.8 1.9 1.8h5.6c1 0 1.8-.8 1.9-1.8l.7-11" />
      </svg>
    );
  }

  if (kind === "chevron") {
    return (
      <svg viewBox="0 0 24 24" focusable="false" aria-hidden="true">
        <path d="m9.6 6.8 5.2 5.2-5.2 5.2" />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 24 24" focusable="false" aria-hidden="true">
      <circle cx="10" cy="12" r="3.8" />
      <path d="M10 5.2a6.8 6.8 0 1 0 0 13.6" />
      <path d="M17.8 6.8v5M15.3 9.3h5" />
    </svg>
  );
}

function LinkGrid({
  links,
  title,
  onOpenLink
}: {
  links: OrbitalOverviewLinkItem[];
  title: string;
  onOpenLink: (linkId: OrbitalOverviewLinkId) => void;
}) {
  return (
    <div className="orbital-inspector-overview-link-grid">
      <div className="orbital-inspector-overview-sectionhead">
        <span className="orbital-inspector-overview-sectiontitle">{title}</span>
      </div>
      <div className="orbital-inspector-overview-link-list">
        {links.map((entry) => (
          <button
            key={entry.id}
            type="button"
            className="orbital-inspector-overview-link"
            style={{ "--overview-card-accent": entry.color } as CSSProperties}
            onClick={() => onOpenLink(entry.id)}
          >
            <span className="orbital-inspector-overview-link-icon">
              <Icon kind={entry.icon} />
            </span>
            <span className="orbital-inspector-overview-link-copy">
              <span className="orbital-inspector-overview-link-label">{entry.label}</span>
            </span>
            <strong className="orbital-inspector-overview-link-count">{formatCompactCount(entry.count)}</strong>
          </button>
        ))}
      </div>
    </div>
  );
}

function MiniGlyph({ accentColor, mode }: { accentColor: string; mode: OrbitalOverviewMode }) {
  return (
    <span
      className={`orbital-inspector-overview-glyph is-${mode}`}
      style={{ "--overview-card-accent": accentColor } as CSSProperties}
      aria-hidden="true"
    >
      <span className="orbital-inspector-overview-glyph-ring" />
      <span className="orbital-inspector-overview-glyph-ring is-inner" />
      <span className="orbital-inspector-overview-glyph-core" />
    </span>
  );
}

function ProjectRail({
  projects,
  labels,
  editingProjectId,
  renderProjectRenameField,
  onAddProject,
  onFocusProject,
  onOpenProject,
  onMoveProject,
  onProjectContextMenu
}: {
  projects: OrbitalOverviewProjectItem[];
  labels: OrbitalInspectorOverviewCardProps["labels"];
  editingProjectId?: string | null;
  renderProjectRenameField?: (project: OrbitalOverviewProjectItem) => ReactNode;
  onAddProject: (name: string) => void | Promise<void>;
  onFocusProject: (projectId: string) => void;
  onOpenProject: (projectId: string) => void;
  onMoveProject: (draggedProjectId: string, targetProjectId: string, placement: "before" | "after") => void;
  onProjectContextMenu: (projectId: string, event: ReactMouseEvent<HTMLButtonElement>) => void;
}) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isDraftOpen, setIsDraftOpen] = useState(false);
  const [draftName, setDraftName] = useState("");
  const [draggedProjectId, setDraggedProjectId] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<{
    projectId: string;
    placement: "before" | "after";
  } | null>(null);
  const draftInputRef = useRef<HTMLInputElement | null>(null);
  const projectItemRefs = useRef(new Map<string, HTMLButtonElement>());
  const projectPointerDragRef = useRef<{
    pointerId: number;
    projectId: string;
    startX: number;
    startY: number;
    active: boolean;
  } | null>(null);
  const suppressProjectClickRef = useRef(false);
  const isSubmittingDraftRef = useRef(false);
  const isCancellingDraftRef = useRef(false);

  useEffect(() => {
    if (!isDraftOpen) {
      return;
    }

    const frameId = window.requestAnimationFrame(() => {
      draftInputRef.current?.focus();
    });

    return () => window.cancelAnimationFrame(frameId);
  }, [isDraftOpen]);

  const visibleProjects = useMemo(() => {
    const collapsedSlots = 6;

    if (isExpanded || projects.length <= collapsedSlots) {
      return projects;
    }

    return projects.slice(0, collapsedSlots - 1);
  }, [isExpanded, projects]);
  const hiddenCount = Math.max(projects.length - visibleProjects.length, 0);

  const registerProjectItemRef = (projectId: string, node: HTMLButtonElement | null) => {
    if (node) {
      projectItemRefs.current.set(projectId, node);
      return;
    }

    projectItemRefs.current.delete(projectId);
  };

  const resolveDropPlacementFromRect = (
    rect: DOMRect,
    clientX: number,
    clientY: number
  ): "before" | "after" => {
    const horizontalRatio = rect.width > 0 ? (clientX - rect.left) / rect.width : 0.5;
    const verticalRatio = rect.height > 0 ? (clientY - rect.top) / rect.height : 0.5;
    const isHorizontalIntent = Math.abs(horizontalRatio - 0.5) > Math.abs(verticalRatio - 0.5);
    return (isHorizontalIntent ? horizontalRatio : verticalRatio) < 0.5 ? "before" : "after";
  };

  const resetDragState = () => {
    setDraggedProjectId(null);
    setDropTarget(null);
  };

  const getProjectDropCandidate = (clientX: number, clientY: number) => {
    if (typeof document === "undefined") {
      return null;
    }

    const element = document.elementFromPoint(clientX, clientY);
    const targetElement = element?.closest("[data-orbital-overview-project-id]") as
      | HTMLButtonElement
      | null;
    const projectId = targetElement?.dataset.orbitalOverviewProjectId;

    if (!projectId) {
      return null;
    }

    const node = projectItemRefs.current.get(projectId);

    if (!node) {
      return null;
    }

    return {
      projectId,
      element: node
    };
  };

  const updateProjectPointerDropTarget = (clientX: number, clientY: number) => {
    const dragState = projectPointerDragRef.current;
    const candidate = getProjectDropCandidate(clientX, clientY);

    if (!dragState || !candidate || candidate.projectId === dragState.projectId) {
      setDropTarget(null);
      return null;
    }

    const placement = resolveDropPlacementFromRect(
      candidate.element.getBoundingClientRect(),
      clientX,
      clientY
    );

    setDropTarget({
      projectId: candidate.projectId,
      placement
    });

    return {
      ...candidate,
      placement
    };
  };

  const clearProjectPointerDrag = () => {
    projectPointerDragRef.current = null;
    resetDragState();
  };

  const handleProjectPointerDown = (
    projectId: string,
    event: ReactPointerEvent<HTMLButtonElement>
  ) => {
    if (event.button !== 0 || event.pointerType === "touch") {
      return;
    }

    projectPointerDragRef.current = {
      pointerId: event.pointerId,
      projectId,
      startX: event.clientX,
      startY: event.clientY,
      active: false
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const handleProjectPointerMove = (event: ReactPointerEvent<HTMLButtonElement>) => {
    const dragState = projectPointerDragRef.current;

    if (!dragState || dragState.pointerId !== event.pointerId) {
      return;
    }

    const distance = Math.hypot(
      event.clientX - dragState.startX,
      event.clientY - dragState.startY
    );

    if (!dragState.active && distance < 5) {
      return;
    }

    if (!dragState.active) {
      dragState.active = true;
      suppressProjectClickRef.current = true;
      setDraggedProjectId(dragState.projectId);
    }

    event.preventDefault();
    updateProjectPointerDropTarget(event.clientX, event.clientY);
  };

  const handleProjectPointerUp = (event: ReactPointerEvent<HTMLButtonElement>) => {
    const dragState = projectPointerDragRef.current;

    if (!dragState || dragState.pointerId !== event.pointerId) {
      return;
    }

    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }

    if (!dragState.active) {
      clearProjectPointerDrag();
      return;
    }

    event.preventDefault();
    suppressProjectClickRef.current = true;
    const candidate = updateProjectPointerDropTarget(event.clientX, event.clientY);
    clearProjectPointerDrag();

    if (candidate) {
      onMoveProject(dragState.projectId, candidate.projectId, candidate.placement);
    }
  };

  const handleProjectPointerCancel = (event: ReactPointerEvent<HTMLButtonElement>) => {
    const dragState = projectPointerDragRef.current;

    if (dragState?.pointerId === event.pointerId) {
      if (event.currentTarget.hasPointerCapture(event.pointerId)) {
        event.currentTarget.releasePointerCapture(event.pointerId);
      }

      clearProjectPointerDrag();
    }
  };

  const beginDraft = () => {
    isCancellingDraftRef.current = false;
    setIsExpanded(true);
    setDraftName("");
    setIsDraftOpen(true);
  };

  const cancelDraft = () => {
    isCancellingDraftRef.current = true;
    isSubmittingDraftRef.current = false;
    setDraftName("");
    setIsDraftOpen(false);
  };

  const submitDraft = async () => {
    if (isSubmittingDraftRef.current) {
      return;
    }

    if (isCancellingDraftRef.current) {
      isCancellingDraftRef.current = false;
      return;
    }

    const normalizedName = draftName.trim();

    if (!normalizedName) {
      cancelDraft();
      return;
    }

    isSubmittingDraftRef.current = true;
    setIsDraftOpen(false);
    setDraftName("");

    try {
      await onAddProject(normalizedName);
    } finally {
      isSubmittingDraftRef.current = false;
    }
  };

  const handleDraftKeyDown = (event: ReactKeyboardEvent<HTMLInputElement>) => {
    event.stopPropagation();

    if (event.key === "Enter") {
      event.preventDefault();
      void submitDraft();
    }

    if (event.key === "Escape") {
      event.preventDefault();
      cancelDraft();
    }
  };

  return (
    <div className="orbital-inspector-overview-project-panel">
      <div className="orbital-inspector-overview-project-head">
        <span className="orbital-inspector-overview-sectiontitle">{labels.projectsStat}</span>
        <button
          type="button"
          className="orbital-inspector-overview-project-add"
          onClick={beginDraft}
        >
          <Icon kind="project" />
          <span>{labels.addProject}</span>
        </button>
      </div>
      <div className="orbital-inspector-overview-projects" aria-label={labels.projectsStat}>
        {visibleProjects.map((project) => {
          const projectDropTarget = dropTarget?.projectId === project.id ? dropTarget.placement : null;
          const isEditingProject = editingProjectId === project.id;

          return isEditingProject && renderProjectRenameField ? (
            <div
              key={project.id}
              className={`orbital-inspector-overview-project is-editing ${project.isActive ? "is-active" : ""}`}
              style={{ "--overview-card-accent": project.color } as CSSProperties}
            >
              <span className="orbital-inspector-overview-project-dot" aria-hidden="true" />
              <span className="orbital-inspector-overview-project-copy">
                {renderProjectRenameField(project)}
                <span className="orbital-inspector-overview-project-meta">
                  {formatCompactCount(project.documentCount)} / {formatCompactCount(project.folderCount)}
                </span>
              </span>
            </div>
          ) : (
              <button
                key={project.id}
                type="button"
                className={`orbital-inspector-overview-project is-draggable ${
                  project.isActive ? "is-active" : ""
                } ${draggedProjectId === project.id ? "is-dragging" : ""} ${
                  projectDropTarget ? `is-drop-${projectDropTarget}` : ""
                }`}
                data-orbital-overview-project-id={project.id}
                ref={(node) => registerProjectItemRef(project.id, node)}
                style={{ "--overview-card-accent": project.color } as CSSProperties}
                onClick={(event) => {
                  if (suppressProjectClickRef.current) {
                    suppressProjectClickRef.current = false;
                    event.preventDefault();
                    return;
                  }

                  onFocusProject(project.id);
                }}
                onDoubleClick={() => onOpenProject(project.id)}
                onContextMenu={(event) => onProjectContextMenu(project.id, event)}
                onPointerDown={(event) => handleProjectPointerDown(project.id, event)}
                onPointerMove={handleProjectPointerMove}
                onPointerUp={handleProjectPointerUp}
                onPointerCancel={handleProjectPointerCancel}
                title={project.name}
              >
              <span className="orbital-inspector-overview-project-dot" aria-hidden="true" />
              <span className="orbital-inspector-overview-project-copy">
                <span className="orbital-inspector-overview-project-name">{project.name}</span>
                <span className="orbital-inspector-overview-project-meta">
                  {formatCompactCount(project.documentCount)} / {formatCompactCount(project.folderCount)}
                </span>
              </span>
            </button>
          );
        })}
        {isDraftOpen ? (
          <div
            className="orbital-inspector-overview-project is-draft"
            style={{ "--overview-card-accent": "var(--accent-theme-primary, var(--gold))" } as CSSProperties}
          >
            <span className="orbital-inspector-overview-project-dot" aria-hidden="true" />
            <span className="orbital-inspector-overview-project-copy">
              <input
                ref={draftInputRef}
                value={draftName}
                onChange={(event) => setDraftName(event.target.value)}
                onBlur={() => {
                  void submitDraft();
                }}
                onKeyDown={handleDraftKeyDown}
                className="orbital-inspector-overview-project-input"
                placeholder={labels.project}
                aria-label={labels.addProject}
              />
              <span className="orbital-inspector-overview-project-meta">{labels.create}</span>
            </span>
          </div>
        ) : null}
        {hiddenCount > 0 ? (
          <button
            type="button"
            className="orbital-inspector-overview-project-more"
            onClick={() => setIsExpanded(true)}
            aria-label={`${labels.projectsStat}: +${hiddenCount}`}
            title={`${labels.projectsStat}: +${hiddenCount}`}
          >
            +{hiddenCount}
          </button>
        ) : null}
      </div>
    </div>
  );
}

export default function OrbitalInspectorOverviewCard({
  mode,
  title,
  titleNode,
  kicker,
  accentColor,
  activeProjectId,
  activeProjectIndex,
  projectCount,
  canNavigateProjects,
  projects,
  links,
  recentItems,
  lastUpdatedLabel,
  updatedLabel,
  emptyLabel,
  labels,
  colorButtonRef,
  isColorPanelOpen,
  editingProjectId,
  renderProjectRenameField,
  onAddProject,
  onAddFolder,
  onAddNote,
  onAddCanvas,
  onBackToVault,
  onCycleProject,
  onDeleteProject,
  onOpenLink,
  onFocusProject,
  onOpenProject,
  onMoveProject,
  onProjectContextMenu,
  onSelectRecentItem,
  onOpenRecentItem,
  onRecentContextMenu,
  onRecentPointerEnter,
  onRecentPointerMove,
  onRecentPointerLeave,
  onRecentPointerCancel,
  isTouchLayout = false,
  previewLabel,
  onPreviewRecentItem,
  onToggleColorPanel
}: OrbitalInspectorOverviewCardProps) {
  const [isRecentExpanded, setIsRecentExpanded] = useState(false);
  const isProjectMode = mode === "project";
  const projectPosition = activeProjectIndex >= 0 ? `${activeProjectIndex + 1}/${projectCount}` : `0/${projectCount}`;
  const visibleRecentItems = isRecentExpanded ? recentItems.slice(0, 4) : recentItems.slice(0, 2);

  return (
    <section
      key={`${mode}:${activeProjectId ?? "vault"}`}
      className={`orbital-inspector-overview-card is-${mode}`}
      style={{ "--overview-card-accent": accentColor } as CSSProperties}
    >
      <div className="orbital-inspector-overview-card-main">
        <div className="orbital-inspector-overview-card-head">
          {isProjectMode ? (
              <button
                type="button"
                className="orbital-inspector-overview-icon-action is-back"
              onClick={onBackToVault}
              aria-label={labels.back}
              title={labels.back}
            >
              <Icon kind="back" />
            </button>
          ) : null}
          <div className="orbital-inspector-overview-titleblock">
            <span className="orbital-inspector-overview-kicker">{kicker}</span>
            <div className="orbital-inspector-overview-title" title={title}>
              {titleNode}
            </div>
          </div>
          <div className="orbital-inspector-overview-card-actions">
            <MiniGlyph accentColor={accentColor} mode={mode} />
          </div>
        </div>

        {isProjectMode ? (
          <div className="orbital-inspector-overview-project-tools">
            <div className="orbital-inspector-overview-stepper" aria-label={labels.projectsStat}>
              <button
                type="button"
                className="orbital-inspector-overview-step"
                onClick={() => onCycleProject(-1)}
                disabled={!canNavigateProjects}
                aria-label={labels.previousProject}
                title={labels.previousProject}
              >
                <Icon kind="back" />
              </button>
              <span>{projectPosition}</span>
              <button
                type="button"
                className="orbital-inspector-overview-step"
                onClick={() => onCycleProject(1)}
                disabled={!canNavigateProjects}
                aria-label={labels.nextProject}
                title={labels.nextProject}
              >
                <Icon kind="chevron" />
              </button>
            </div>

            <div className="orbital-inspector-overview-quickrow">
              <button type="button" className="orbital-inspector-overview-tool" onClick={onAddFolder} title={labels.addRootFolder} aria-label={labels.addRootFolder}>
                <Icon kind="folder" />
              </button>
              <button type="button" className="orbital-inspector-overview-tool" onClick={onAddNote} title={labels.addNote} aria-label={labels.addNote}>
                <Icon kind="note" />
              </button>
              <button type="button" className="orbital-inspector-overview-tool" onClick={onAddCanvas} title={labels.addCanvas} aria-label={labels.addCanvas}>
                <Icon kind="canvas" />
              </button>
              <button
                ref={colorButtonRef}
                type="button"
                className={`orbital-inspector-overview-tool is-color ${isColorPanelOpen ? "is-active" : ""}`}
                onClick={onToggleColorPanel}
                title={labels.projectColor}
                aria-label={labels.projectColor}
              >
                <span className="orbital-inspector-overview-swatch" aria-hidden="true" />
              </button>
              <button type="button" className="orbital-inspector-overview-tool is-danger" onClick={onDeleteProject} title={labels.deleteSystem} aria-label={labels.deleteSystem}>
                <Icon kind="trash" />
              </button>
            </div>
          </div>
        ) : (
          <ProjectRail
            projects={projects}
            labels={labels}
            editingProjectId={editingProjectId}
            renderProjectRenameField={renderProjectRenameField}
            onAddProject={onAddProject}
            onFocusProject={onFocusProject}
            onOpenProject={onOpenProject}
            onMoveProject={onMoveProject}
            onProjectContextMenu={onProjectContextMenu}
          />
        )}
      </div>

      <LinkGrid links={links} title={labels.overviewSections} onOpenLink={onOpenLink} />

      <div className={`orbital-inspector-overview-recent ${isRecentExpanded ? "is-expanded" : ""}`}>
        <div className="orbital-inspector-overview-sectionhead">
          <button
            type="button"
            className="orbital-inspector-overview-sectionbutton"
            onClick={() => setIsRecentExpanded((current) => !current)}
            aria-expanded={isRecentExpanded}
          >
            <span>{lastUpdatedLabel}</span>
            <small>{updatedLabel}</small>
            <Icon kind="chevron" />
          </button>
        </div>
        {recentItems.length > 0 ? (
          <div className="orbital-inspector-overview-recent-list">
            {visibleRecentItems.map((item) => (
              <button
                key={item.entityId}
                type="button"
                className="orbital-inspector-overview-recent-item"
                style={{ "--overview-card-accent": item.color } as CSSProperties}
                onClick={(event) => {
                  const previewTarget = (event.target as HTMLElement | null)?.closest(
                    "[data-overview-preview-action]"
                  );

                  if (previewTarget && onPreviewRecentItem) {
                    event.preventDefault();
                    event.stopPropagation();
                    onPreviewRecentItem(item);
                    return;
                  }

                  onSelectRecentItem(item);
                }}
                onDoubleClick={() => onOpenRecentItem(item)}
                onContextMenu={(event) => onRecentContextMenu(item, event)}
                onPointerEnter={(event) => onRecentPointerEnter(item, event)}
                onPointerMove={(event) => onRecentPointerMove(item, event)}
                onPointerLeave={() => onRecentPointerLeave(item)}
                onPointerCancel={() => onRecentPointerCancel(item)}
                title={item.title}
              >
                <span className="orbital-inspector-overview-recent-icon">
                  <Icon kind={item.kind === "canvas" ? "canvas" : item.kind === "folder" ? "folder" : "note"} />
                </span>
                <span className="orbital-inspector-overview-recent-copy">
                  <span className="orbital-inspector-overview-recent-title">{item.title}</span>
                  <span className="orbital-inspector-overview-recent-meta">
                    {getItemKindLabel(item.kind, labels)} - {item.meta}
                  </span>
                </span>
                {isTouchLayout && item.kind !== "folder" && onPreviewRecentItem ? (
                  <span
                    className="orbital-menu-compact-preview-mark"
                    data-overview-preview-action="true"
                    aria-label={previewLabel}
                    title={previewLabel}
                  >
                    i
                  </span>
                ) : null}
              </button>
            ))}
          </div>
        ) : (
          <p className="orbital-inspector-overview-empty">{emptyLabel}</p>
        )}
      </div>
    </section>
  );
}
