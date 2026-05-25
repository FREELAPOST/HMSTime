import type { Holiday, User, WorkSchedule } from "@prisma/client";
import { prisma } from "../prisma.js";
import { addDays, formatDateKey, isExpectedWorkday, parseDateKey, parseMonthKey } from "../utils/date.js";
import { AppError } from "../utils/errors.js";
import { audit } from "./auditService.js";

export type HolidayMap = Map<string, Holiday>;

export async function getHolidaysBetween(start: Date, endExclusive: Date) {
  const holidays = await prisma.holiday.findMany({
    where: {
      date: {
        gte: start,
        lt: endExclusive
      }
    },
    orderBy: { date: "asc" }
  });

  return new Map(holidays.map((holiday) => [formatDateKey(holiday.date), holiday]));
}

export function getExpectedMinutesForDate(user: Pick<User, "dailyMinutesExpected" | "workSchedule">, date: Date, holidays: HolidayMap) {
  if (holidays.has(formatDateKey(date))) {
    return 0;
  }

  return isExpectedWorkday(date, user.workSchedule as WorkSchedule) ? user.dailyMinutesExpected : 0;
}

export async function listHolidays(input: { month?: string; startDate?: string; endDate?: string }) {
  let start: Date;
  let end: Date;

  if (input.month) {
    const range = parseMonthKey(input.month);
    start = range.start;
    end = range.end;
  } else {
    start = input.startDate ? parseDateKey(input.startDate) : parseDateKey(formatDateKey(new Date()));
    const endDate = input.endDate ? parseDateKey(input.endDate) : start;
    end = addDays(endDate, 1);
  }

  return prisma.holiday.findMany({
    where: { date: { gte: start, lt: end } },
    orderBy: { date: "asc" }
  });
}

export async function createHoliday(input: { actorId: string; date: string; name: string; note?: string }) {
  const date = parseDateKey(input.date);
  const name = input.name.trim();
  const note = input.note?.trim() || null;

  if (!name || name.length > 80) {
    throw new AppError("Nome do feriado obrigatório com no máximo 80 caracteres.", 422);
  }

  if (note && note.length > 160) {
    throw new AppError("Observação deve ter no máximo 160 caracteres.", 422);
  }

  const holiday = await prisma.holiday.upsert({
    where: { date },
    update: {
      name,
      note,
      createdById: input.actorId
    },
    create: {
      date,
      name,
      note,
      createdById: input.actorId
    }
  });

  await audit({
    actorId: input.actorId,
    action: "UPSERT_HOLIDAY",
    entity: "Holiday",
    entityId: holiday.id,
    details: { date: input.date, name, note }
  });

  return holiday;
}

export async function deleteHoliday(input: { actorId: string; id: string }) {
  const holiday = await prisma.holiday.findUnique({ where: { id: input.id } });

  if (!holiday) {
    throw new AppError("Feriado não encontrado.", 404);
  }

  await prisma.holiday.delete({ where: { id: input.id } });
  await audit({
    actorId: input.actorId,
    action: "DELETE_HOLIDAY",
    entity: "Holiday",
    entityId: input.id,
    details: { date: formatDateKey(holiday.date), name: holiday.name }
  });

  return holiday;
}
