import { Edit2, Trash2 } from "lucide-react";
import type { TimelineItem } from "../types";
import { entryTypeLabel, formatTime, statusClasses, statusLabel } from "../utils/time";

export function Timeline({
  entries,
  canEdit,
  onEdit,
  onDelete
}: {
  entries: TimelineItem[];
  canEdit?: boolean;
  onEdit?: (entry: TimelineItem) => void;
  onDelete?: (entry: TimelineItem) => void;
}) {
  if (entries.length === 0) {
    return <div className="rounded-md border border-dashed border-gray-300 p-5 text-center text-sm text-gray-500">Sem registros.</div>;
  }

  return (
    <ol className="space-y-2">
      {entries.map((entry) => (
        <li className={`flex items-center gap-3 rounded-lg border px-3 py-2 ${statusClasses(entry.status)}`} key={entry.id}>
          <div className="h-2.5 w-2.5 rounded-full bg-current opacity-60" />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
              <strong>{entryTypeLabel(entry.type)}</strong>
              <span>{formatTime(entry.occurredAt)}</span>
              <span className="rounded bg-black/5 px-2 py-0.5 text-xs">{statusLabel(entry.status)}</span>
              {entry.isEdited && <span className="rounded bg-orange-100 px-2 py-0.5 text-xs text-orange-800">editado</span>}
            </div>
            {(entry.reason || entry.note) && (
              <p className="mt-1 truncate text-xs text-gray-600">{entry.note || entry.reason}</p>
            )}
          </div>
          {canEdit && entry.entryId && entry.status === "APPROVED" && (
            <div className="flex shrink-0 gap-1">
              <button className="icon-button" type="button" title="Editar" onClick={() => onEdit?.(entry)}>
                <Edit2 size={16} />
              </button>
              <button className="icon-button" type="button" title="Excluir" onClick={() => onDelete?.(entry)}>
                <Trash2 size={16} />
              </button>
            </div>
          )}
        </li>
      ))}
    </ol>
  );
}
