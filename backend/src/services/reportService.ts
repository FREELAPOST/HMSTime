import { Role } from "@prisma/client";
import { prisma } from "../prisma.js";
import { buildTimeline, calculateWorkedMinutes, getMonthBalance, getMonthlyDays } from "./timeService.js";
import { AppError } from "../utils/errors.js";
import { addDays, endOfDay, formatDateKey, isExpectedWorkday, parseDateKey } from "../utils/date.js";

export async function buildMonthlyReport(input: {
  requesterId: string;
  requesterRole: Role;
  month: string;
  userId?: string;
}) {
  const where =
    input.requesterRole === "ADMIN"
      ? input.userId && input.userId !== "all"
        ? { id: input.userId }
        : { role: "EMPLOYEE" as const }
      : { id: input.requesterId };

  const users = await prisma.user.findMany({
    where,
    orderBy: { code: "asc" }
  });

  if (users.length === 0) {
    throw new AppError("Nenhum funcionário encontrado para o relatório.", 404);
  }

  const company = await prisma.companySettings.upsert({
    where: { id: "company" },
    update: {},
    create: { id: "company" }
  });

  const employees = await Promise.all(
    users.map(async (user) => ({
      user: {
        id: user.id,
        code: user.code,
        name: user.name,
        dailyMinutesExpected: user.dailyMinutesExpected,
        workSchedule: user.workSchedule,
        isActive: user.isActive
      },
      balance: await getMonthBalance(user, input.month),
      days: await getMonthlyDays(user, input.month)
    }))
  );

  return {
    month: input.month,
    generatedAt: new Date(),
    company,
    employees
  };
}

async function getReportUsers(input: { requesterId: string; requesterRole: Role; userId?: string }) {
  const where =
    input.requesterRole === "ADMIN"
      ? input.userId && input.userId !== "all"
        ? { id: input.userId }
        : { role: "EMPLOYEE" as const }
      : { id: input.requesterId };

  const users = await prisma.user.findMany({
    where,
    orderBy: { code: "asc" }
  });

  if (users.length === 0) {
    throw new AppError("Nenhum funcionário encontrado para o relatório.", 404);
  }

  return users;
}

async function getCompanySettings() {
  return prisma.companySettings.upsert({
    where: { id: "company" },
    update: {},
    create: { id: "company" }
  });
}

export async function buildPeriodReport(input: {
  requesterId: string;
  requesterRole: Role;
  startDate: string;
  endDate: string;
  userId?: string;
}) {
  const start = parseDateKey(input.startDate);
  const endDay = parseDateKey(input.endDate);

  if (start > endDay) {
    throw new AppError("Período inválido.", 422);
  }

  const end = endOfDay(endDay);
  const users = await getReportUsers(input);
  const company = await getCompanySettings();
  const periodLabel = `${input.startDate} a ${input.endDate}`;

  const employees = await Promise.all(
    users.map(async (user) => {
      const entries = await buildTimeline(user.id, { start, end, includeRejectedDisplay: true });
      const days = [];
      let cursor = new Date(start);

      while (cursor <= endDay) {
        const date = formatDateKey(cursor);
        const dayEntries = entries.filter((entry) => formatDateKey(entry.occurredAt) === date);
        const workedMinutes = calculateWorkedMinutes(dayEntries);
        const expectedMinutes = isExpectedWorkday(cursor, user.workSchedule) ? user.dailyMinutesExpected : 0;
        days.push({
          date,
          entries: dayEntries,
          workedMinutes,
          expectedMinutes,
          balanceMinutes: workedMinutes - expectedMinutes
        });
        cursor = addDays(cursor, 1);
      }

      const workedMinutes = days.reduce((total, day) => total + day.workedMinutes, 0);
      const expectedMinutes = days.reduce((total, day) => total + day.expectedMinutes, 0);
      const expectedDays = days.filter((day) => day.expectedMinutes > 0).length;

      return {
        user: {
          id: user.id,
          code: user.code,
          name: user.name,
          dailyMinutesExpected: user.dailyMinutesExpected,
          workSchedule: user.workSchedule,
          isActive: user.isActive
        },
        balance: {
          month: periodLabel,
          workedMinutes,
          expectedMinutes,
          balanceMinutes: workedMinutes - expectedMinutes,
          expectedDays
        },
        days
      };
    })
  );

  return {
    month: periodLabel,
    generatedAt: new Date(),
    company,
    employees
  };
}
