import type { EntryStatus, EntryType, WorkSchedule } from "../types";

export function todayKey() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

export function monthKey() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

export function minutesToClock(minutes: number) {
  const sign = minutes < 0 ? "-" : "";
  const absolute = Math.abs(minutes);
  return `${sign}${String(Math.floor(absolute / 60)).padStart(2, "0")}:${String(absolute % 60).padStart(2, "0")}`;
}

export function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short"
  }).format(new Date(value));
}

export function formatTime(value: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(value));
}

export function toDateTimeLocal(value?: string) {
  const date = value ? new Date(value) : new Date();
  const offset = date.getTimezoneOffset();
  const local = new Date(date.getTime() - offset * 60000);
  return local.toISOString().slice(0, 16);
}

export function fromDateTimeLocal(value: string) {
  return new Date(value).toISOString();
}

export function entryTypeLabel(type: EntryType) {
  return type === "IN" ? "Entrada" : "Saída";
}

export function statusLabel(status: EntryStatus) {
  if (status === "APPROVED") return "aprovado";
  if (status === "PENDING") return "pendente";
  return "rejeitado";
}

export function scheduleLabel(schedule: WorkSchedule) {
  if (schedule === "MON_FRI") return "seg-sex";
  if (schedule === "MON_SAT") return "seg-sáb";
  return "seg-dom";
}

export function statusClasses(status: EntryStatus) {
  if (status === "PENDING") return "border-yellow-300 bg-yellow-100 text-black";
  if (status === "REJECTED") return "border-red-200 bg-red-50 text-red-900";
  return "border-gray-200 bg-white text-ink";
}
