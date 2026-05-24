import { useEffect, useState } from "react";
import { Plus, RefreshCw } from "lucide-react";
import { api } from "../api/client";
import { ChangePinModal } from "../components/ChangePinModal";
import { ClockCalendar } from "../components/ClockCalendar";
import { Header } from "../components/Header";
import { Modal } from "../components/Modal";
import { Timeline } from "../components/Timeline";
import { useAuth } from "../hooks/useAuth";
import type { AdjustmentKind, DaySummary, EntryType, MonthBalance, TimelineItem } from "../types";
import {
  entryTypeLabel,
  fromDateTimeLocal,
  minutesToClock,
  monthKey,
  statusLabel,
  todayKey,
  toDateTimeLocal
} from "../utils/time";

type AdjustmentForm = {
  kind: AdjustmentKind;
  entry?: TimelineItem;
};

export function EmployeeDashboard() {
  const { user, logout } = useAuth();
  const [selectedDate, setSelectedDate] = useState(todayKey());
  const [selectedMonth, setSelectedMonth] = useState(monthKey());
  const [day, setDay] = useState<DaySummary | null>(null);
  const [month, setMonth] = useState<MonthBalance | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [pinModal, setPinModal] = useState(false);
  const [adjustment, setAdjustment] = useState<AdjustmentForm | null>(null);

  async function load() {
    setLoading(true);
    setError("");
    try {
      const [dayData, monthData] = await Promise.all([
        api<DaySummary>(`/time/me/day?date=${selectedDate}`),
        api<MonthBalance>(`/time/me/month?month=${selectedMonth}`)
      ]);
      setDay(dayData);
      setMonth(monthData);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao carregar dados.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, [selectedDate, selectedMonth]);

  async function punch(type: EntryType) {
    setError("");
    try {
      await api("/time/me/punch", {
        method: "POST",
        body: { type }
      });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao registrar ponto.");
    }
  }

  return (
    <div className="min-h-screen bg-gray-100 text-ink">
      <Header user={user!} onLogout={logout} onChangePin={() => setPinModal(true)} />
      <main className="mx-auto max-w-7xl space-y-5 px-4 py-5">
        <ClockCalendar />

        <section className="grid gap-4 md:grid-cols-[1fr_340px]">
          <div className="panel p-5">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-base font-semibold">Batida rápida</h2>
                <p className="text-sm text-gray-500">{selectedDate}</p>
              </div>
              <button className="icon-button" type="button" title="Atualizar" onClick={load}>
                <RefreshCw size={17} className={loading ? "animate-spin" : ""} />
              </button>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <button
                className="focus-ring rounded-lg bg-green-600 px-4 py-5 text-lg font-bold text-white transition hover:bg-green-700"
                type="button"
                onClick={() => punch("IN")}
              >
                Entrada
              </button>
              <button
                className="focus-ring rounded-lg bg-red-600 px-4 py-5 text-lg font-bold text-white transition hover:bg-red-700"
                type="button"
                onClick={() => punch("OUT")}
              >
                Saída
              </button>
            </div>
            {error && <p className="mt-4 rounded-md bg-red-50 p-3 text-sm text-red-700">{error}</p>}
          </div>

          <div className="panel p-5">
            <h2 className="mb-4 text-base font-semibold">Banco mensal</h2>
            <label className="mb-4 block text-sm font-medium">
              Mês
              <input className="field mt-1" type="month" value={selectedMonth} onChange={(event) => setSelectedMonth(event.target.value)} />
            </label>
            <div className="grid grid-cols-3 gap-2 text-center text-sm">
              <Metric label="Esperado" value={minutesToClock(month?.expectedMinutes ?? 0)} />
              <Metric label="Feito" value={minutesToClock(month?.workedMinutes ?? 0)} />
              <Metric label="Saldo" value={minutesToClock(month?.balanceMinutes ?? 0)} accent />
            </div>
          </div>
        </section>

        <section className="panel p-5">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold">Linha do tempo diária</h2>
              <p className="text-sm text-gray-500">
                Trabalhado {minutesToClock(day?.workedMinutes ?? 0)} · Saldo diário {minutesToClock(day?.balanceMinutes ?? 0)}
              </p>
            </div>
            <div className="flex gap-2">
              <input className="field w-auto" type="date" value={selectedDate} onChange={(event) => setSelectedDate(event.target.value)} />
              <button className="icon-button" type="button" title="Lançar manual" onClick={() => setAdjustment({ kind: "CREATE" })}>
                <Plus size={18} />
              </button>
            </div>
          </div>
          <Timeline
            entries={day?.entries ?? []}
            canEdit
            onEdit={(entry) => setAdjustment({ kind: "UPDATE", entry })}
            onDelete={(entry) => setAdjustment({ kind: "DELETE", entry })}
          />
        </section>
      </main>
      {pinModal && <ChangePinModal onClose={() => setPinModal(false)} />}
      {adjustment && (
        <AdjustmentModal
          form={adjustment}
          onClose={() => setAdjustment(null)}
          onDone={async () => {
            setAdjustment(null);
            await load();
          }}
        />
      )}
    </div>
  );
}

function Metric({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="rounded-md border border-gray-200 p-3">
      <div className="text-xs text-gray-500">{label}</div>
      <div className={`text-lg font-bold ${accent ? "text-accent" : "text-ink"}`}>{value}</div>
    </div>
  );
}

function AdjustmentModal({ form, onClose, onDone }: { form: AdjustmentForm; onClose: () => void; onDone: () => void }) {
  const [type, setType] = useState<EntryType>(form.entry?.type ?? "IN");
  const [occurredAt, setOccurredAt] = useState(toDateTimeLocal(form.entry?.occurredAt));
  const [reason, setReason] = useState("");
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError("");

    try {
      await api("/time/me/adjustments", {
        method: "POST",
        body: {
          kind: form.kind,
          entryId: form.entry?.entryId,
          type: form.kind === "DELETE" ? undefined : type,
          occurredAt: form.kind === "DELETE" ? undefined : fromDateTimeLocal(occurredAt),
          reason,
          pin
        }
      });
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao enviar pendência.");
    }
  }

  const title =
    form.kind === "CREATE" ? "Lançar ponto manual" : form.kind === "UPDATE" ? "Editar ponto" : "Excluir ponto";

  return (
    <Modal title={title} onClose={onClose}>
      <form className="space-y-4" onSubmit={submit}>
        {form.entry && (
          <p className="rounded-md bg-gray-50 p-3 text-sm text-gray-700">
            {entryTypeLabel(form.entry.type)} · {statusLabel(form.entry.status)}
          </p>
        )}
        {form.kind !== "DELETE" && (
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
          PIN
          <input className="field mt-1" inputMode="numeric" maxLength={4} type="password" value={pin} onChange={(event) => setPin(event.target.value.replace(/\D/g, "").slice(0, 4))} />
        </label>
        {error && <p className="rounded-md bg-red-50 p-3 text-sm text-red-700">{error}</p>}
        <button className="focus-ring rounded-md bg-accent px-4 py-2 text-sm font-semibold text-white" type="submit">
          Enviar
        </button>
      </form>
    </Modal>
  );
}
