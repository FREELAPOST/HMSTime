import { useEffect, useMemo, useState } from "react";
import { Check, Download, Plus, RotateCcw, Save, Upload, X } from "lucide-react";
import { api, apiBlob, getAssetUrl } from "../api/client";
import { ChangePinModal } from "../components/ChangePinModal";
import { Header } from "../components/Header";
import { Modal } from "../components/Modal";
import { Timeline } from "../components/Timeline";
import { useAuth } from "../hooks/useAuth";
import type {
  AdminOverview,
  Checkpoint,
  CompanySettings,
  EntryType,
  MonthlyReport,
  TimelineItem,
  User,
  WorkSchedule
} from "../types";
import {
  fromDateTimeLocal,
  minutesToClock,
  monthKey,
  scheduleLabel,
  todayKey,
  toDateTimeLocal
} from "../utils/time";

type Tab = "overview" | "pending" | "reports" | "company" | "checkpoints";
type EntryModalState = {
  mode: "CREATE" | "UPDATE" | "DELETE";
  userId: string;
  entry?: TimelineItem;
};

export function AdminDashboard() {
  const { user, logout } = useAuth();
  const [tab, setTab] = useState<Tab>("overview");
  const [date, setDate] = useState(todayKey());
  const [month, setMonth] = useState(monthKey());
  const [overview, setOverview] = useState<AdminOverview | null>(null);
  const [company, setCompany] = useState<CompanySettings | null>(null);
  const [checkpoints, setCheckpoints] = useState<Checkpoint[]>([]);
  const [report, setReport] = useState<MonthlyReport | null>(null);
  const [reportUserId, setReportUserId] = useState("all");
  const [error, setError] = useState("");
  const [pinModal, setPinModal] = useState(false);
  const [entryModal, setEntryModal] = useState<EntryModalState | null>(null);

  async function loadOverview() {
    setError("");
    try {
      setOverview(await api<AdminOverview>(`/time/admin/overview?date=${date}&month=${month}`));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao carregar painel.");
    }
  }

  async function loadCompany() {
    const payload = await api<{ company: CompanySettings }>("/company");
    setCompany(payload.company);
  }

  async function loadCheckpoints() {
    const payload = await api<{ checkpoints: Checkpoint[] }>("/checkpoints");
    setCheckpoints(payload.checkpoints);
  }

  useEffect(() => {
    loadOverview();
  }, [date, month]);

  useEffect(() => {
    if (tab === "company") loadCompany().catch((err) => setError(err.message));
    if (tab === "checkpoints") loadCheckpoints().catch((err) => setError(err.message));
  }, [tab]);

  const employees = useMemo(() => overview?.rows.filter((row) => row.user.role === "EMPLOYEE") ?? [], [overview]);

  return (
    <div className="min-h-screen bg-gray-100 text-ink">
      <Header user={user!} onLogout={logout} onChangePin={() => setPinModal(true)} />
      <main className="mx-auto max-w-7xl space-y-5 px-4 py-5">
        <section className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold">Admin</h1>
            <p className="text-sm text-gray-500">Ponto, banco de horas e pendências</p>
          </div>
          <div className="flex flex-wrap gap-2 rounded-lg border border-gray-200 bg-white p-1">
            {[
              ["overview", "Painel"],
              ["pending", "Pendências"],
              ["reports", "Relatórios"],
              ["company", "Empresa"],
              ["checkpoints", "Backups"]
            ].map(([key, label]) => (
              <button
                className={`rounded-md px-3 py-2 text-sm font-medium ${tab === key ? "bg-accent text-white" : "text-gray-700 hover:bg-gray-100"}`}
                key={key}
                type="button"
                onClick={() => setTab(key as Tab)}
              >
                {label}
              </button>
            ))}
          </div>
        </section>

        {error && <p className="rounded-md bg-red-50 p-3 text-sm text-red-700">{error}</p>}

        {tab === "overview" && (
          <OverviewSection
            date={date}
            month={month}
            overview={overview}
            onDate={setDate}
            onMonth={setMonth}
            onRefresh={loadOverview}
            onEntry={(state) => setEntryModal(state)}
          />
        )}

        {tab === "pending" && <PendingSection overview={overview} onRefresh={loadOverview} />}

        {tab === "reports" && (
          <ReportsSection
            month={month}
            setMonth={setMonth}
            users={employees.map((row) => row.user)}
            report={report}
            reportUserId={reportUserId}
            setReportUserId={setReportUserId}
            setReport={setReport}
          />
        )}

        {tab === "company" && company && <CompanySection company={company} setCompany={setCompany} />}

        {tab === "checkpoints" && (
          <CheckpointSection checkpoints={checkpoints} onRefresh={loadCheckpoints} setCheckpoints={setCheckpoints} />
        )}
      </main>
      {pinModal && <ChangePinModal onClose={() => setPinModal(false)} />}
      {entryModal && (
        <AdminEntryModal
          state={entryModal}
          onClose={() => setEntryModal(null)}
          onDone={async () => {
            setEntryModal(null);
            await loadOverview();
          }}
        />
      )}
    </div>
  );
}

function OverviewSection({
  date,
  month,
  overview,
  onDate,
  onMonth,
  onRefresh,
  onEntry
}: {
  date: string;
  month: string;
  overview: AdminOverview | null;
  onDate: (date: string) => void;
  onMonth: (month: string) => void;
  onRefresh: () => void;
  onEntry: (state: EntryModalState) => void;
}) {
  return (
    <div className="grid gap-5 lg:grid-cols-[340px_1fr]">
      <section className="space-y-5">
        <CreateUserPanel onCreated={onRefresh} />
        <div className="panel p-5">
          <h2 className="mb-3 text-base font-semibold">Filtros</h2>
          <div className="grid gap-3">
            <label className="block text-sm font-medium">
              Dia
              <input className="field mt-1" type="date" value={date} onChange={(event) => onDate(event.target.value)} />
            </label>
            <label className="block text-sm font-medium">
              Mês
              <input className="field mt-1" type="month" value={month} onChange={(event) => onMonth(event.target.value)} />
            </label>
          </div>
        </div>
      </section>

      <section className="space-y-3">
        {overview?.rows
          .filter((row) => row.user.role === "EMPLOYEE")
          .map((row) => (
            <div className="panel p-4" key={row.user.id}>
              <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <strong>{row.user.code}</strong>
                    <span>{row.user.name}</span>
                    {!row.user.isActive && <span className="rounded bg-gray-200 px-2 py-0.5 text-xs">desativado</span>}
                    {row.user.isBlocked && <span className="rounded bg-red-100 px-2 py-0.5 text-xs text-red-700">bloqueado</span>}
                  </div>
                  <div className="mt-1 text-sm text-gray-500">
                    {scheduleLabel(row.user.workSchedule)} · {minutesToClock(row.user.dailyMinutesExpected)} por dia
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <MiniMetric label="Mês" value={minutesToClock(row.month.balanceMinutes)} />
                  <MiniMetric label="Dia" value={minutesToClock(row.day.balanceMinutes)} />
                  <button className="icon-button" title="Lançar ponto" type="button" onClick={() => onEntry({ mode: "CREATE", userId: row.user.id })}>
                    <Plus size={17} />
                  </button>
                  <UserActions user={row.user} onDone={onRefresh} />
                </div>
              </div>
              <Timeline
                entries={row.day.entries}
                canEdit
                onEdit={(entry) => onEntry({ mode: "UPDATE", userId: row.user.id, entry })}
                onDelete={(entry) => onEntry({ mode: "DELETE", userId: row.user.id, entry })}
              />
            </div>
          ))}
      </section>
    </div>
  );
}

function MiniMetric({ label, value }: { label: string; value: string }) {
  return (
    <span className="rounded-md border border-gray-200 px-3 py-1 text-sm">
      <span className="text-gray-500">{label}</span> <strong className="text-accent">{value}</strong>
    </span>
  );
}

function CreateUserPanel({ onCreated }: { onCreated: () => void }) {
  const [name, setName] = useState("");
  const [hours, setHours] = useState("8");
  const [schedule, setSchedule] = useState<WorkSchedule>("MON_FRI");
  const [error, setError] = useState("");

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError("");

    try {
      await api("/users", {
        method: "POST",
        body: {
          name,
          dailyMinutesExpected: Math.round(Number(hours) * 60),
          workSchedule: schedule
        }
      });
      setName("");
      setHours("8");
      onCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao cadastrar.");
    }
  }

  return (
    <form className="panel space-y-3 p-5" onSubmit={submit}>
      <h2 className="text-base font-semibold">Novo funcionário</h2>
      <input className="field" placeholder="Nome completo" value={name} onChange={(event) => setName(event.target.value)} />
      <div className="grid grid-cols-2 gap-3">
        <label className="text-sm font-medium">
          Horas/dia
          <input className="field mt-1" min={1} max={16} step={0.25} type="number" value={hours} onChange={(event) => setHours(event.target.value)} />
        </label>
        <label className="text-sm font-medium">
          Jornada
          <select className="field mt-1" value={schedule} onChange={(event) => setSchedule(event.target.value as WorkSchedule)}>
            <option value="MON_FRI">seg-sex</option>
            <option value="MON_SAT">seg-sáb</option>
            <option value="MON_SUN">seg-dom</option>
          </select>
        </label>
      </div>
      {error && <p className="rounded-md bg-red-50 p-2 text-sm text-red-700">{error}</p>}
      <button className="focus-ring inline-flex items-center gap-2 rounded-md bg-accent px-4 py-2 text-sm font-semibold text-white" type="submit">
        <Plus size={16} /> Cadastrar
      </button>
    </form>
  );
}

function UserActions({ user, onDone }: { user: User; onDone: () => void }) {
  async function toggleActive() {
    await api(`/users/${user.id}`, {
      method: "PATCH",
      body: { isActive: !user.isActive }
    });
    onDone();
  }

  async function unblock() {
    const pin = window.prompt("PIN do admin");
    if (!pin) return;
    await api(`/users/${user.id}/unblock`, {
      method: "POST",
      body: { pin }
    });
    onDone();
  }

  return (
    <div className="flex gap-1">
      <button className="rounded-md border border-gray-200 px-3 py-2 text-xs font-semibold hover:border-accent" type="button" onClick={toggleActive}>
        {user.isActive ? "Desativar" : "Ativar"}
      </button>
      {user.isBlocked && (
        <button className="rounded-md border border-yellow-300 bg-yellow-100 px-3 py-2 text-xs font-semibold text-black" type="button" onClick={unblock}>
          Desbloquear
        </button>
      )}
    </div>
  );
}

function PendingSection({ overview, onRefresh }: { overview: AdminOverview | null; onRefresh: () => void }) {
  async function approve(id: string) {
    const pin = window.prompt("PIN do admin");
    if (!pin) return;
    await api(`/time/admin/adjustments/${id}/approve`, { method: "POST", body: { pin } });
    onRefresh();
  }

  async function reject(id: string) {
    const pin = window.prompt("PIN do admin");
    if (!pin) return;
    const rejectionReason = window.prompt("Justificativa opcional") || undefined;
    await api(`/time/admin/adjustments/${id}/reject`, { method: "POST", body: { pin, rejectionReason } });
    onRefresh();
  }

  const pending = overview?.pending ?? [];

  return (
    <section className="panel p-5">
      <h2 className="mb-4 text-base font-semibold">Pendências</h2>
      <div className="space-y-2">
        {pending.length === 0 && <p className="text-sm text-gray-500">Nenhuma pendência.</p>}
        {pending.map((request) => (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-yellow-300 bg-yellow-100 px-4 py-3" key={request.id}>
            <div>
              <strong>{request.user?.code}</strong> {request.user?.name}
              <div className="text-sm text-black/70">
                {request.kind} · {request.reason} · {request.requestedOccurredAt ? new Date(request.requestedOccurredAt).toLocaleString("pt-BR") : "sem horário"}
              </div>
            </div>
            <div className="flex gap-2">
              <button className="icon-button bg-white" title="Aprovar" type="button" onClick={() => approve(request.id)}>
                <Check size={18} />
              </button>
              <button className="icon-button bg-white" title="Rejeitar" type="button" onClick={() => reject(request.id)}>
                <X size={18} />
              </button>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function ReportsSection({
  month,
  setMonth,
  users,
  report,
  reportUserId,
  setReportUserId,
  setReport
}: {
  month: string;
  setMonth: (month: string) => void;
  users: User[];
  report: MonthlyReport | null;
  reportUserId: string;
  setReportUserId: (id: string) => void;
  setReport: (report: MonthlyReport) => void;
}) {
  const [startDate, setStartDate] = useState(todayKey());
  const [endDate, setEndDate] = useState(todayKey());

  async function loadReport() {
    setReport(await api<MonthlyReport>(`/reports/month?month=${month}&userId=${reportUserId}`));
  }

  async function loadPeriodReport() {
    setReport(
      await api<MonthlyReport>(`/reports/period?startDate=${startDate}&endDate=${endDate}&userId=${reportUserId}`)
    );
  }

  async function downloadPdf() {
    const blob = await apiBlob(`/reports/month/pdf?month=${month}&userId=${reportUserId}`);
    const url = URL.createObjectURL(blob);
    window.open(url, "_blank", "noopener,noreferrer");
  }

  async function downloadPeriodPdf() {
    const blob = await apiBlob(`/reports/period/pdf?startDate=${startDate}&endDate=${endDate}&userId=${reportUserId}`);
    const url = URL.createObjectURL(blob);
    window.open(url, "_blank", "noopener,noreferrer");
  }

  return (
    <section className="panel p-5">
      <div className="mb-4 grid gap-3 lg:grid-cols-[160px_160px_160px_1fr_auto_auto]">
        <input className="field" type="month" value={month} onChange={(event) => setMonth(event.target.value)} />
        <input className="field" type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} />
        <input className="field" type="date" value={endDate} onChange={(event) => setEndDate(event.target.value)} />
        <select className="field" value={reportUserId} onChange={(event) => setReportUserId(event.target.value)}>
          <option value="all">Todos os funcionários</option>
          {users.map((employee) => (
            <option key={employee.id} value={employee.id}>
              {employee.code} - {employee.name}
            </option>
          ))}
        </select>
        <button className="focus-ring rounded-md bg-accent px-4 py-2 text-sm font-semibold text-white" type="button" onClick={loadReport}>
          Mensal
        </button>
        <button className="focus-ring rounded-md border border-gray-300 px-4 py-2 text-sm font-semibold" type="button" onClick={loadPeriodReport}>
          Período
        </button>
      </div>
      <div className="mb-4 flex flex-wrap gap-2">
        <button className="focus-ring inline-flex items-center gap-2 rounded-md border border-gray-300 px-4 py-2 text-sm font-semibold" type="button" onClick={downloadPdf}>
          <Download size={16} /> PDF mensal
        </button>
        <button className="focus-ring inline-flex items-center gap-2 rounded-md border border-gray-300 px-4 py-2 text-sm font-semibold" type="button" onClick={downloadPeriodPdf}>
          <Download size={16} /> PDF período
        </button>
      </div>
      <div className="space-y-3">
        {report?.employees.map((employee) => (
          <div className="rounded-lg border border-gray-200 p-4" key={employee.user.id}>
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <strong>
                {employee.user.code} - {employee.user.name}
              </strong>
              <span className="font-bold text-accent">{minutesToClock(employee.balance.balanceMinutes)}</span>
            </div>
            <div className="grid grid-cols-2 gap-2 text-sm md:grid-cols-4">
              <MiniMetric label="Esperado" value={minutesToClock(employee.balance.expectedMinutes)} />
              <MiniMetric label="Trabalhado" value={minutesToClock(employee.balance.workedMinutes)} />
              <MiniMetric label="Dias escala" value={String(employee.balance.expectedDays)} />
              <MiniMetric label="Dias mês" value={String(employee.days.length)} />
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function CompanySection({
  company,
  setCompany
}: {
  company: CompanySettings;
  setCompany: (company: CompanySettings) => void;
}) {
  const [legalName, setLegalName] = useState(company.legalName);
  const [cnpj, setCnpj] = useState(company.cnpj);
  const [address, setAddress] = useState(company.address);

  async function save(event: React.FormEvent) {
    event.preventDefault();
    const payload = await api<{ company: CompanySettings }>("/company", {
      method: "PATCH",
      body: { legalName, cnpj, address }
    });
    setCompany(payload.company);
  }

  async function uploadLogo(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    const formData = new FormData();
    formData.append("logo", file);
    const payload = await api<{ company: CompanySettings }>("/company/logo", {
      method: "POST",
      body: formData
    });
    setCompany(payload.company);
  }

  return (
    <section className="panel p-5">
      <form className="grid gap-4 lg:grid-cols-[180px_1fr]" onSubmit={save}>
        <div className="flex h-32 items-center justify-center rounded-lg border border-gray-200 bg-gray-50">
          {company.logoPath ? <img className="max-h-24 max-w-36 object-contain" src={getAssetUrl(company.logoPath)} /> : <Upload size={28} className="text-gray-400" />}
        </div>
        <div className="space-y-3">
          <input className="field" placeholder="Razão social" value={legalName} onChange={(event) => setLegalName(event.target.value)} />
          <input className="field" placeholder="CNPJ" value={cnpj} onChange={(event) => setCnpj(event.target.value)} />
          <input className="field" placeholder="Endereço" value={address} onChange={(event) => setAddress(event.target.value)} />
          <div className="flex flex-wrap gap-2">
            <label className="focus-ring inline-flex cursor-pointer items-center gap-2 rounded-md border border-gray-300 px-4 py-2 text-sm font-semibold">
              <Upload size={16} /> Logo
              <input className="hidden" accept="image/png,image/jpeg,image/webp" type="file" onChange={uploadLogo} />
            </label>
            <button className="focus-ring inline-flex items-center gap-2 rounded-md bg-accent px-4 py-2 text-sm font-semibold text-white" type="submit">
              <Save size={16} /> Salvar
            </button>
          </div>
        </div>
      </form>
    </section>
  );
}

function CheckpointSection({
  checkpoints,
  onRefresh
}: {
  checkpoints: Checkpoint[];
  onRefresh: () => void;
  setCheckpoints: (checkpoints: Checkpoint[]) => void;
}) {
  async function create() {
    await api("/checkpoints", { method: "POST", body: { reason: "checkpoint manual" } });
    onRefresh();
  }

  async function restore(id: string) {
    const confirmation = window.prompt('Digite "RESTAURAR" para confirmar');
    if (confirmation !== "RESTAURAR") return;
    const pin = window.prompt("PIN do admin");
    if (!pin) return;
    await api(`/checkpoints/${id}/restore`, { method: "POST", body: { pin, confirmation } });
    onRefresh();
  }

  return (
    <section className="panel p-5">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="text-base font-semibold">Checkpoints</h2>
        <button className="focus-ring inline-flex items-center gap-2 rounded-md bg-accent px-4 py-2 text-sm font-semibold text-white" type="button" onClick={create}>
          <Plus size={16} /> Criar
        </button>
      </div>
      <div className="space-y-2">
        {checkpoints.map((checkpoint) => (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-gray-200 px-4 py-3" key={checkpoint.id}>
            <div>
              <strong>{new Date(checkpoint.createdAt).toLocaleString("pt-BR")}</strong>
              <div className="text-sm text-gray-500">{checkpoint.reason || checkpoint.fileName}</div>
            </div>
            <button className="focus-ring inline-flex items-center gap-2 rounded-md border border-red-200 px-3 py-2 text-sm font-semibold text-red-700" type="button" onClick={() => restore(checkpoint.id)}>
              <RotateCcw size={16} /> Restaurar
            </button>
          </div>
        ))}
      </div>
    </section>
  );
}

function AdminEntryModal({ state, onClose, onDone }: { state: EntryModalState; onClose: () => void; onDone: () => void }) {
  const [type, setType] = useState<EntryType>(state.entry?.type ?? "IN");
  const [occurredAt, setOccurredAt] = useState(toDateTimeLocal(state.entry?.occurredAt));
  const [reason, setReason] = useState("");
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    try {
      if (state.mode === "CREATE") {
        await api("/time/admin/entries", {
          method: "POST",
          body: { userId: state.userId, type, occurredAt: fromDateTimeLocal(occurredAt), reason, pin }
        });
      }
      if (state.mode === "UPDATE" && state.entry?.entryId) {
        await api(`/time/admin/entries/${state.entry.entryId}`, {
          method: "PATCH",
          body: { type, occurredAt: fromDateTimeLocal(occurredAt), reason, pin }
        });
      }
      if (state.mode === "DELETE" && state.entry?.entryId) {
        await api(`/time/admin/entries/${state.entry.entryId}`, {
          method: "DELETE",
          body: { reason, pin }
        });
      }
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao salvar registro.");
    }
  }

  const title = state.mode === "CREATE" ? "Lançar ponto" : state.mode === "UPDATE" ? "Editar ponto" : "Excluir ponto";

  return (
    <Modal title={title} onClose={onClose}>
      <form className="space-y-4" onSubmit={submit}>
        {state.mode !== "DELETE" && (
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block text-sm font-medium">
              Tipo
              <select className="field mt-1" value={type} onChange={(event) => setType(event.target.value as EntryType)}>
                <option value="IN">Entrada</option>
                <option value="OUT">Saída</option>
              </select>
            </label>
            <label className="block text-sm font-medium">
              Data/hora
              <input className="field mt-1" type="datetime-local" value={occurredAt} onChange={(event) => setOccurredAt(event.target.value)} />
            </label>
          </div>
        )}
        <label className="block text-sm font-medium">
          Justificativa
          <input className="field mt-1" maxLength={50} value={reason} onChange={(event) => setReason(event.target.value)} />
        </label>
        <label className="block text-sm font-medium">
          PIN do admin
          <input className="field mt-1" inputMode="numeric" maxLength={4} type="password" value={pin} onChange={(event) => setPin(event.target.value.replace(/\D/g, "").slice(0, 4))} />
        </label>
        {error && <p className="rounded-md bg-red-50 p-3 text-sm text-red-700">{error}</p>}
        <button className="focus-ring rounded-md bg-accent px-4 py-2 text-sm font-semibold text-white" type="submit">
          Confirmar
        </button>
      </form>
    </Modal>
  );
}
