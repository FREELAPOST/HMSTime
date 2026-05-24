import { useState } from "react";
import { api } from "../api/client";
import { Modal } from "./Modal";

export function ChangePinModal({ onClose }: { onClose: () => void }) {
  const [currentPin, setCurrentPin] = useState("");
  const [newPin, setNewPin] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    setMessage("");

    try {
      await api("/auth/change-pin", {
        method: "POST",
        body: { currentPin, newPin }
      });
      setMessage("PIN alterado.");
      setCurrentPin("");
      setNewPin("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao alterar PIN.");
    }
  }

  return (
    <Modal title="Trocar PIN" onClose={onClose}>
      <form className="space-y-4" onSubmit={submit}>
        <label className="block text-sm font-medium">
          PIN atual
          <input className="field mt-1" inputMode="numeric" maxLength={4} type="password" value={currentPin} onChange={(event) => setCurrentPin(event.target.value)} />
        </label>
        <label className="block text-sm font-medium">
          Novo PIN
          <input className="field mt-1" inputMode="numeric" maxLength={4} type="password" value={newPin} onChange={(event) => setNewPin(event.target.value)} />
        </label>
        {error && <p className="rounded-md bg-red-50 p-3 text-sm text-red-700">{error}</p>}
        {message && <p className="rounded-md bg-green-50 p-3 text-sm text-green-700">{message}</p>}
        <button className="focus-ring rounded-md bg-accent px-4 py-2 text-sm font-semibold text-white" type="submit">
          Salvar
        </button>
      </form>
    </Modal>
  );
}
