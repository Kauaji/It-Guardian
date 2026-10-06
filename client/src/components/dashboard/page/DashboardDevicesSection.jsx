import { Search } from "lucide-react";
import AlertList from "../AlertList.jsx";
import DeviceTable from "../DeviceTable.jsx";
import { statusClass } from "../dashboardFormatters.js";

export function DashboardDeviceToolbar({ search, setSearch, status, setStatus }) {
  return (
    <section className="toolbar">
      <div className="search-box">
        <Search size={18} />
        <input aria-label="Buscar por nome, IP ou status" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar por nome, IP ou status" />
      </div>
      <select aria-label="Filtrar por status" value={status} onChange={(event) => setStatus(event.target.value)}>
        <option value="">Todos os status</option>
        <option value="online">Online</option>
        <option value="offline">Offline</option>
        <option value="problem">Erro</option>
      </select>
    </section>
  );
}

export function DashboardDevicesSection({ loading, devices, selectedId, selectDevice, alerts }) {
  return (
    <section className="content-grid">
      <section className="panel devices-panel">
        <div className="panel-heading">
          <h2>Máquinas monitoradas</h2>
          {loading && <span className="loading">Carregando...</span>}
        </div>
        <DeviceTable
          devices={devices}
          selectedId={selectedId}
          onSelect={selectDevice}
          statusClass={statusClass}
        />
      </section>
      <AlertList alerts={alerts} />
    </section>
  );
}
