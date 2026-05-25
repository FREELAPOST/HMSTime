export type Role = "ADMIN" | "EMPLOYEE";
export type WorkSchedule = "MON_FRI" | "MON_SAT" | "MON_SUN";
export type EntryType = "IN" | "OUT";
export type EntryStatus = "APPROVED" | "PENDING" | "REJECTED";
export type AdjustmentKind = "CREATE" | "UPDATE" | "DELETE";
export type AdjustmentStatus = "PENDING" | "APPROVED" | "REJECTED";

export type User = {
  id: string;
  code: string;
  name: string;
  role: Role;
  dailyMinutesExpected: number;
  workSchedule: WorkSchedule;
  isActive?: boolean;
  isBlocked?: boolean;
  failedLoginAttempts?: number;
  deactivatedAt?: string | null;
};

export type TimelineItem = {
  id: string;
  entryId?: string;
  adjustmentId?: string;
  type: EntryType;
  occurredAt: string;
  status: EntryStatus;
  source: string;
  reason?: string | null;
  isEdited: boolean;
  isVirtual: boolean;
  affectsTotals: boolean;
  adjustmentKind?: AdjustmentKind;
  note?: string;
};

export type DaySummary = {
  date: string;
  entries: TimelineItem[];
  workedMinutes: number;
  expectedMinutes: number;
  balanceMinutes: number;
};

export type MonthBalance = {
  month: string;
  workedMinutes: number;
  expectedMinutes: number;
  balanceMinutes: number;
  expectedDays: number;
};

export type AdjustmentRequest = {
  id: string;
  userId: string;
  kind: AdjustmentKind;
  entryId?: string | null;
  requestedType?: EntryType | null;
  requestedOccurredAt?: string | null;
  reason: string;
  status: AdjustmentStatus;
  rejectionReason?: string | null;
  createdAt: string;
  reviewedAt?: string | null;
  user?: Pick<User, "id" | "code" | "name">;
};

export type AdminOverview = {
  date: string;
  month: string;
  rows: Array<{
    user: User;
    day: DaySummary;
    month: MonthBalance;
  }>;
  pending: AdjustmentRequest[];
};

export type CompanySettings = {
  id: string;
  legalName: string;
  cnpj: string;
  address: string;
  logoPath?: string | null;
};

export type Checkpoint = {
  id: string;
  fileName: string;
  filePath: string;
  reason?: string | null;
  createdAt: string;
  createdBy?: Pick<User, "id" | "code" | "name"> | null;
};

export type Holiday = {
  id: string;
  date: string;
  name: string;
  note?: string | null;
  createdAt: string;
  updatedAt: string;
};

export type MonthlyReport = {
  month: string;
  generatedAt: string;
  company: CompanySettings;
  employees: Array<{
    user: User;
    balance: MonthBalance;
    days: DaySummary[];
  }>;
};
