import type { CSSProperties } from "react";

import type { PlannerProjectTemporalSignal } from "../../lib/plannerMapSignals";
import "./TemporalMapLayer.css";

export interface TemporalMapProjectNode {
  projectId: string;
  x: number;
  y: number;
  radius: number;
  color: string;
  isSelected: boolean;
  isPrimary: boolean;
}

interface TemporalMapLayerProps {
  nodes: TemporalMapProjectNode[];
  signals: Map<string, PlannerProjectTemporalSignal>;
  compact?: boolean;
}

function hasVisibleSignal(signal: PlannerProjectTemporalSignal) {
  return (
    signal.todayCount > 0 ||
    signal.overdueCount > 0 ||
    signal.focusCount > 0 ||
    Boolean(signal.milestoneTaskId)
  );
}

function TemporalBadge({
  kind,
  x,
  y,
  label,
  compact
}: {
  kind: "today" | "overdue";
  x: number;
  y: number;
  label: string;
  compact: boolean;
}) {
  const width = compact ? 34 : Math.max(42, label.length * 8 + 28);
  const height = compact ? 22 : 24;
  const iconX = -width / 2 + (compact ? 11 : 12);
  const textX = compact ? 8 : 9;

  return (
    <g className={`orbital-temporal-badge is-${kind}`} transform={`translate(${x} ${y})`}>
      <rect x={-width / 2} y={-height / 2} width={width} height={height} rx={height / 2} />
      {kind === "overdue" ? (
        <g className="orbital-temporal-badge-icon is-overdue" transform={`translate(${iconX} 0)`}>
          <circle r="5.2" />
          <path d="M 0 -2.4 V 0.8 M 0 3.4 V 3.6" />
        </g>
      ) : (
        <g className="orbital-temporal-badge-icon is-today" transform={`translate(${iconX} 0)`}>
          <circle r="4.2" />
          <path d="M -1.9 0.2 L -0.4 1.8 L 2.3 -2" />
        </g>
      )}
      <text x={textX} y="4" textAnchor="middle">
        {label}
      </text>
    </g>
  );
}

function formatTemporalCount(value: number, compact: boolean) {
  if (compact && value > 9) {
    return "9+";
  }

  if (value > 99) {
    return "99+";
  }

  return String(value);
}

export default function TemporalMapLayer({
  nodes,
  signals,
  compact = false
}: TemporalMapLayerProps) {
  const visibleNodes = nodes
    .map((node) => ({
      node,
      signal: signals.get(node.projectId) ?? null
    }))
    .filter((entry): entry is { node: TemporalMapProjectNode; signal: PlannerProjectTemporalSignal } =>
      Boolean(entry.signal && hasVisibleSignal(entry.signal))
    );

  if (visibleNodes.length === 0) {
    return null;
  }

  return (
    <g className={`orbital-temporal-layer ${compact ? "is-compact" : ""}`} aria-hidden="true">
      {visibleNodes.map(({ node, signal }) => {
        const ringRadius = node.radius * (compact ? 1.92 : 2.08);
        const glowRadius = node.radius * (compact ? 2.42 : 2.62);
        const badgeOffsetX = node.radius + (compact ? 18 : 24);
        const badgeOffsetY = -node.radius - (compact ? 18 : 24);
        const overdueLabel = formatTemporalCount(signal.overdueCount, compact);
        const todayLabel = formatTemporalCount(signal.todayCount, compact);
        const hasOverdue = signal.overdueCount > 0;
        const hasToday = signal.todayCount > 0;
        const style = {
          "--temporal-color": node.color
        } as CSSProperties;

        return (
          <g
            key={node.projectId}
            className={`orbital-temporal-signal is-health-${signal.health} ${
              node.isSelected ? "is-selected" : ""
            } ${node.isPrimary ? "is-primary" : ""}`}
            style={style}
            transform={`translate(${node.x} ${node.y})`}
          >
            <circle r={glowRadius} className="orbital-temporal-health-glow" />
            {hasToday || hasOverdue || signal.milestoneTaskId ? (
              <circle r={ringRadius} className="orbital-temporal-deadline-ring" />
            ) : null}
            {signal.focusCount > 0 ? (
              <g className="orbital-temporal-focus" transform={`translate(${-node.radius - 15} ${-node.radius - 14})`}>
                <circle r="8" />
                <path d="M -4 0 H 4 M 0 -4 V 4" />
              </g>
            ) : null}
            {signal.milestoneTaskId ? (
              <g className="orbital-temporal-milestone" transform={`translate(${node.radius + 12} ${node.radius + 12})`}>
                <path d="M 0 -8 L 8 0 L 0 8 L -8 0 Z" />
                <circle r="2.4" />
              </g>
            ) : null}
            {hasToday ? (
              <TemporalBadge
                kind="today"
                x={hasOverdue ? badgeOffsetX - 4 : badgeOffsetX}
                y={badgeOffsetY}
                label={todayLabel}
                compact={compact}
              />
            ) : null}
            {hasOverdue ? (
              <TemporalBadge
                kind="overdue"
                x={hasToday ? badgeOffsetX + (compact ? 25 : 46) : badgeOffsetX}
                y={badgeOffsetY}
                label={overdueLabel}
                compact={compact}
              />
            ) : null}
          </g>
        );
      })}
    </g>
  );
}
