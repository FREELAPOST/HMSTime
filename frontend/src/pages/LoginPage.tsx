import { useState } from "react";
import { Fingerprint } from "lucide-react";
import { useAuth } from "../hooks/useAuth";

export function LoginPage() {
  const { login } = useAuth();
  const [code, setCode] = useState("");
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    setLoading(true);

    try {
      await login(code, pin);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha no login.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-gray-100 px-4">
      <section className="panel w-full max-w-sm p-6">
        <div className="mb-6 flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-accent text-white">
            <Fingerprint size={24} />
          </div>
          <div>
            <h1 className="text-lg font-semibold text-ink">Registro de ponto</h1>
            <p className="text-sm text-gray-500">Banco de horas local</p>
          </div>
        </div>

        <form className="space-y-4" onSubmit={submit}>
          <label className="block text-sm font-medium text-ink">
            Código
            <input
              className="field mt-1 text-lg tracking-normal"
              inputMode="numeric"
              maxLength={6}
              placeholder="000000"
              value={code}
              onChange={(event) => setCode(event.target.value.replace(/\D/g, "").slice(0, 6))}
            />
          </label>

          <label className="block text-sm font-medium text-ink">
            PIN
            <input
              className="field mt-1 text-lg tracking-normal"
              inputMode="numeric"
              maxLength={4}
              placeholder="1234"
              type="password"
              value={pin}
              onChange={(event) => setPin(event.target.value.replace(/\D/g, "").slice(0, 4))}
            />
          </label>

          {error && <p className="rounded-md bg-red-50 p-3 text-sm text-red-700">{error}</p>}

          <button
            className="focus-ring w-full rounded-md bg-accent px-4 py-3 text-sm font-semibold text-white disabled:opacity-60"
            disabled={loading || code.length !== 6 || pin.length !== 4}
            type="submit"
          >
            Entrar
          </button>
        </form>
      </section>
    </main>
  );
}
