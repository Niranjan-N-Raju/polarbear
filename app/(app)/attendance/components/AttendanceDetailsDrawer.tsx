import type { AttendanceStatus } from "@/types/attendance";
import { OutlineCloseIcon } from "@/app/components/icons";
import { STATUS_OPTIONS, statusStyle } from "../utils";
import { useDrawerClose } from "@/app/hooks/useDrawerClose";

export interface AttendancePerson {
  employeeId: string;
  name: string;
  comment: string;
  archived: boolean;
}
type Grouped = Record<AttendanceStatus, AttendancePerson[]>;
interface Props {
  date: string;
  details: Grouped;
  unmarked: AttendancePerson[];
  draggedEmployeeId: string | null;
  dragOverStatus: AttendanceStatus | null;
  removingAttendanceId: string | null;
  updatingStatusId: string | null;
  formatDate: (date: string) => string;
  onClose: () => void;
  onDragStart: (event: React.DragEvent, employeeId: string) => void;
  onDragEnd: () => void;
  onDragOver: (event: React.DragEvent, status: AttendanceStatus) => void;
  onDragLeave: (status: AttendanceStatus) => void;
  onDrop: (event: React.DragEvent, status: AttendanceStatus) => void;
  onRemove: (employeeId: string) => void;
}

export function AttendanceDetailsDrawer({
  date,
  details,
  unmarked,
  draggedEmployeeId,
  dragOverStatus,
  removingAttendanceId,
  updatingStatusId,
  formatDate,
  onClose,
  onDragStart,
  onDragEnd,
  onDragOver,
  onDragLeave,
  onDrop,
  onRemove,
}: Props) {
  const { visible, requestClose } = useDrawerClose();
  const close = () => requestClose(onClose);
  return (
    <>
      <div
        className={`fixed inset-0 z-40 bg-black/40 transition-opacity duration-200 ${visible ? "opacity-100" : "opacity-0"}`}
        style={{ height: "100vh" }}
        aria-hidden="true"
        onClick={close}
      />
      <div className="fixed inset-y-0 right-0 z-50 flex max-w-full pointer-events-none">
        <div
          className={`h-full w-screen max-w-md flex flex-col overflow-hidden bg-white shadow-2xl pointer-events-auto transition-transform duration-200 ease-out ${visible ? "translate-x-0" : "translate-x-full"}`}
        >
          <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
            <h3 className="font-semibold text-gray-900">{formatDate(date)}</h3>
            <button
              type="button"
              onClick={close}
              className="text-xl leading-none text-gray-400 hover:text-gray-700"
              aria-label="Close attendance details"
            >
              ×
            </button>
          </div>
          <div className="space-y-5 overflow-y-auto px-6 py-5">
            <p className="text-xs text-gray-400">
              Drag an employee onto another list to change their status.
            </p>
            {STATUS_OPTIONS.map((status) => {
              const people = details[status];
              return (
                <div
                  key={status}
                  onDragOver={(event) => onDragOver(event, status)}
                  onDragLeave={() => onDragLeave(status)}
                  onDrop={(event) => onDrop(event, status)}
                  className={`rounded-lg p-1 transition ${dragOverStatus === status ? "bg-brand-peach/40 ring-2 ring-brand-orange" : ""}`}
                >
                  <p
                    className={`mb-2 text-sm font-semibold ${statusStyle[status].split(" ").find((item) => item.startsWith("text-")) ?? "text-gray-900"}`}
                  >
                    {status} ({people.length})
                  </p>
                  {people.length === 0 ? (
                    <p className="text-xs text-gray-400">No employees.</p>
                  ) : (
                    <ul className="flex flex-wrap gap-1.5">
                      {people.map((person, index) => (
                        <li
                          key={`${person.name}-${index}`}
                          draggable={updatingStatusId !== person.employeeId}
                          onDragStart={(event) =>
                            onDragStart(event, person.employeeId)
                          }
                          onDragEnd={onDragEnd}
                          className={`inline-flex max-w-full cursor-grab items-center gap-1.5 rounded-lg ${statusStyle[status]} px-2.5 py-1.5 text-sm active:cursor-grabbing ${draggedEmployeeId === person.employeeId ? "opacity-40" : ""} ${updatingStatusId === person.employeeId ? "opacity-60" : ""}`}
                        >
                          <span className="min-w-0 truncate">
                            <span className="font-medium">{person.name}</span>
                            {person.archived && (
                              <span className="ml-1.5 inline-flex items-center rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-medium text-red-700">
                                Archived
                              </span>
                            )}
                            {person.comment && (
                              <span className="ml-1.5 text-xs text-gray-500">
                                {person.comment}
                              </span>
                            )}
                          </span>
                          <button
                            type="button"
                            onClick={() => onRemove(person.employeeId)}
                            disabled={
                              removingAttendanceId === person.employeeId
                            }
                            aria-label={`Remove attendance for ${person.name}`}
                            className="shrink-0 rounded-full p-0.5 text-gray-400 transition hover:bg-red-100 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            <OutlineCloseIcon className="h-3.5 w-3.5" />
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              );
            })}
            {unmarked.length > 0 && (
              <div className="rounded-lg border border-dashed border-gray-300 p-2">
                <p className="mb-2 text-sm font-semibold text-gray-500">
                  Unmarked ({unmarked.length})
                </p>
                <p className="mb-2 text-xs text-gray-400">
                  Drag onto a list above to mark their status.
                </p>
                <ul className="flex flex-wrap gap-1.5">
                  {unmarked.map((person, index) => (
                    <li
                      key={`${person.name}-${index}`}
                      draggable={updatingStatusId !== person.employeeId}
                      onDragStart={(event) => onDragStart(event, person.employeeId)}
                      onDragEnd={onDragEnd}
                      className={`inline-flex max-w-full cursor-grab items-center gap-1.5 rounded-lg border border-gray-300 bg-gray-50 px-2.5 py-1.5 text-sm text-gray-700 active:cursor-grabbing ${draggedEmployeeId === person.employeeId ? "opacity-40" : ""} ${updatingStatusId === person.employeeId ? "opacity-60" : ""}`}
                    >
                      <span className="min-w-0 truncate">
                        <span className="font-medium">{person.name}</span>
                        {person.archived && (
                          <span className="ml-1.5 inline-flex items-center rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-medium text-red-700">
                            Archived
                          </span>
                        )}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
