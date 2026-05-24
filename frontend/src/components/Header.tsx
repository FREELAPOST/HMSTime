import { KeyRound, LogOut } from "lucide-react";
import type { User } from "../types";

export function Header({
  user,
  onLogout,
  onChangePin
}: {
  user: User;
  onLogout: () => void;
  onChangePin: () => void;
}) {
  return (
    <header className="sticky top-0 z-20 border-b border-gray-200 bg-gray-100/95 backdrop-blur">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3">
        <div>
          <div className="text-sm font-semibold text-ink">{user.name}</div>
          <div className="text-xs text-gray-500">{user.code}</div>
        </div>
        <div className="flex items-center gap-2">
          <button className="icon-button" type="button" title="Trocar PIN" onClick={onChangePin}>
            <KeyRound size={18} />
          </button>
          <button className="icon-button" type="button" title="Sair" onClick={onLogout}>
            <LogOut size={18} />
          </button>
        </div>
      </div>
    </header>
  );
}
