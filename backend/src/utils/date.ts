import type { WorkSchedule } from "@prisma/client";

export function pad2(value: number) {
  return String(value).padStart(2, "0");
}

export function formatDateKey(date: Date) {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
}

export function formatMonthKey(date: Date) {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}`;
}

export function parseDateKey(dateKey: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) {
    throw new Error("Data inválida.");
  }

  const [year, month, day] = dateKey.split("-").map(Number);
  return new Date(year, month - 1, day, 0, 0, 0, 0);
}

export function parseMonthKey(monthKey: string) {
  if (!/^\d{4}-\d{2}$/.test(monthKey)) {
    throw new Error("Mês inválido.");
  }

  const [year, month] = monthKey.split("-").map(Number);
  const start = new Date(year, month - 1, 1, 0, 0, 0, 0);
  const end = new Date(year, month, 1, 0, 0, 0, 0);
  return { start, end, year, month };
}

export function addDays(date: Date, amount: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + amount);
  return next;
}

export function endOfDay(date: Date) {
  const end = new Date(date);
  end.setHours(23, 59, 59, 999);
  return end;
}

export function isSameLocalDay(a: Date, b: Date) {
  return formatDateKey(a) === formatDateKey(b);
}

export function isExpectedWorkday(date: Date, schedule: WorkSchedule) {
  const day = date.getDay();

  if (schedule === "MON_FRI") {
    return day >= 1 && day <= 5;
  }

  if (schedule === "MON_SAT") {
    return day >= 1 && day <= 6;
  }

  return true;
}

export function countExpectedDaysInMonth(monthKey: string, schedule: WorkSchedule) {
  const { start, end } = parseMonthKey(monthKey);
  let cursor = new Date(start);
  let total = 0;

  while (cursor < end) {
    if (isExpectedWorkday(cursor, schedule)) {
      total += 1;
    }
    cursor = addDays(cursor, 1);
  }

  return total;
}

export function eachDayOfMonth(monthKey: string) {
  const { start, end } = parseMonthKey(monthKey);
  const days: Date[] = [];
  let cursor = new Date(start);

  while (cursor < end) {
    days.push(new Date(cursor));
    cursor = addDays(cursor, 1);
  }

  return days;
}

export function minutesBetween(start: Date, end: Date) {
  return Math.max(0, Math.round((end.getTime() - start.getTime()) / 60000));
}

export function minutesToClock(minutes: number) {
  const sign = minutes < 0 ? "-" : "";
  const absolute = Math.abs(minutes);
  return `${sign}${pad2(Math.floor(absolute / 60))}:${pad2(absolute % 60)}`;
}
