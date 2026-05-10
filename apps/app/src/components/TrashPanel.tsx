import type { AppLanguage, Note } from "../types";
import { getDisplayNotePreview, getDisplayNoteTitle } from "../lib/displayNames";
import { formatTimestamp } from "../lib/notes";
import "./TrashPanel.css";

interface TrashPanelProps {
  notes: Note[];
  folderPathMap: Map<string, string>;
  language: AppLanguage;
  labels: {
    title: string;
    deletedAt: string;
    folder: string;
    restore: string;
    deletePermanently: string;
    clearTrash: string;
    emptyTitle: string;
    emptyDescription: string;
    noteCount: string;
    allNotes: string;
    noteType: string;
    canvasType: string;
  };
  onRestore: (noteId: string) => void;
  onDelete: (noteId: string) => void;
  onClear: () => void;
}

export default function TrashPanel({
  notes,
  folderPathMap,
  language,
  labels,
  onRestore,
  onDelete,
  onClear
}: TrashPanelProps) {
  return (
    <section className="trash-panel-shell">
      <header className="trash-panel-header">
        <div className="trash-panel-heading">
          <h2 className="panel-title trash-panel-title">{labels.title}</h2>
          {notes.length === 0 ? <p className="trash-panel-caption">{labels.emptyDescription}</p> : null}
        </div>
        <div className="trash-panel-tools">
          <span className="trash-panel-chip">
            {notes.length} {labels.noteCount}
          </span>
          <button
            type="button"
            className="trash-panel-clear"
            onClick={onClear}
            disabled={notes.length === 0}
          >
            {labels.clearTrash}
          </button>
        </div>
      </header>

      {notes.length === 0 ? (
        <div className="trash-empty-card">
          <div className="trash-empty-card-copy">
            <strong>{labels.emptyTitle}</strong>
            <p>{labels.emptyDescription}</p>
          </div>
        </div>
      ) : (
        <div className="trash-list-scroll">
          <div className="trash-list">
            {notes.map((note) => {
              const deletedAt = formatTimestamp(note.trashedAt ?? note.updatedAt, language);
              const folderLabel = note.folderId
                ? folderPathMap.get(note.folderId) ?? labels.allNotes
                : labels.allNotes;
              const preview = getDisplayNotePreview(note, language);

              return (
                <article
                  className={`trash-card ${note.contentType === "canvas" ? "is-canvas" : "is-note"}`}
                  key={note.id}
                >
                  <div className="trash-card-head">
                    <div className="trash-card-copy">
                      <div className="trash-card-titleline">
                        <h3>{getDisplayNoteTitle(note, language)}</h3>
                        <span className="trash-card-chip is-type">
                          {note.contentType === "canvas" ? labels.canvasType : labels.noteType}
                        </span>
                      </div>
                      {preview ? <p>{preview}</p> : null}
                      <div className="trash-card-meta-inline">
                        <span>
                          {folderLabel} · {deletedAt}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="trash-card-actions">
                    <button
                      type="button"
                      className="trash-card-action is-primary"
                      onClick={() => onRestore(note.id)}
                    >
                      {labels.restore}
                    </button>
                    <button
                      type="button"
                      className="trash-card-action is-danger"
                      onClick={() => onDelete(note.id)}
                    >
                      {labels.deletePermanently}
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        </div>
      )}
    </section>
  );
}
