import { useEffect, useMemo, useState } from "react";

function dateKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export function ClockCalendar() {
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const interval = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(interval);
  }, []);

  const days = useMemo(() => {
    const first = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOffset = first.getDay();
    const start = new Date(first);
    start.setDate(first.getDate() - startOffset);

    return Array.from({ length: 42 }, (_, index) => {
      const day = new Date(start);
      day.setDate(start.getDate() + index);
      return day;
    });
  }, [now]);

  return (
    <section className="grid gap-4 md:grid-cols-[1fr_280px]">
      <div className="panel flex min-h-36 flex-col justify-center p-6">
        <span className="text-sm font-medium text-gray-500">
          {now.toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long", year: "numeric" })}
        </span>
        <strong className="mt-2 text-5xl font-semibold tracking-normal text-ink">
          {now.toLocaleTimeString("pt-BR")}
        </strong>
      </div>
      <div className="panel p-4">
        <div className="mb-3 text-sm font-semibold text-ink">
          {now.toLocaleDateString("pt-BR", { month: "long", year: "numeric" })}
        </div>
        <div className="grid grid-cols-7 gap-1 text-center text-xs">
          {["D", "S", "T", "Q", "Q", "S", "S"].map((item, index) => (
            <span className="py-1 font-semibold text-gray-500" key={`${item}-${index}`}>
              {item}
            </span>
          ))}
          {days.map((day) => {
            const active = dateKey(day) === dateKey(now);
            const muted = day.getMonth() !== now.getMonth();
            return (
              <span
                className={[
                  "rounded-md py-1.5",
                  active ? "bg-accent font-bold text-white" : muted ? "text-gray-300" : "text-ink"
                ].join(" ")}
                key={day.toISOString()}
              >
                {day.getDate()}
              </span>
            );
          })}
        </div>
      </div>
    </section>
  );
}
