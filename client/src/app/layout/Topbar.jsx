import { LogOut, Moon, RefreshCw, Sun } from "lucide-react";
import { useAppSession } from "../../context/AppSessionContext.jsx";
import { useNavigation, useWorkspaceData } from "../context/workspaceContexts.js";

export function formatTime(value) {
  if (!value) return "--:--";

  return new Intl.DateTimeFormat("pt-BR", {
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(value));
}

export default function Topbar() {
  const { theme, toggleTheme } = useAppSession();
  const { lastUpdated, loadData } = useWorkspaceData();
  const { logout } = useNavigation();

  return (
    <header className="topbar">
      <div>
        <h1>Infraestrutura em tempo real</h1>
        <p>Ultima atualizacao: {formatTime(lastUpdated)}</p>
      </div>
      <div className="topbar-actions">
        <button className="icon-button" onClick={() => loadData()} title="Atualizar">
          <RefreshCw size={18} />
        </button>
        <button className="icon-button" onClick={toggleTheme} title={theme === "dark" ? "Modo claro" : "Modo noturno"}>
          {theme === "dark" ? <Sun size={18} /> : <Moon size={18} />}
        </button>
        <button className="icon-button" onClick={logout} title="Sair">
          <LogOut size={18} />
        </button>
      </div>
    </header>
  );
}
