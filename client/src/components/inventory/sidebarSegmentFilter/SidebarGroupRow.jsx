// Linha do cabecalho de um grupo (filtro + botao de recolher).
export default function SidebarGroupRow({ active, dotStyle, label, count, collapsed, collapseTitle, onSelect, onToggle }) {
  return (
    <div className="sidebar-group-row">
      <button type="button" className={`sidebar-group-filter ${active ? "active" : ""}`} onClick={onSelect}>
        <span className="segment-filter-dot group" style={dotStyle} />
        <span className="sidebar-filter-label">{label}</span>
        <small>{count}</small>
      </button>
      <button type="button" className="sidebar-group-collapse" onClick={onToggle} title={collapseTitle}>
        {collapsed ? "+" : "-"}
      </button>
    </div>
  );
}
