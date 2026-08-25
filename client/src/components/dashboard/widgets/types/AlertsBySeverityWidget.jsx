import WidgetBarList from "../WidgetBarList.jsx";

const toneByLabel = { Critica: "danger", Alta: "danger", Media: "warning", Atencao: "warning", Baixa: "" };

export default function AlertsBySeverityWidget({ data }) {
  return (
    <WidgetBarList
      rows={data.rows}
      emptyMessage="Nenhum alerta ativo no momento."
      toneFor={(label) => toneByLabel[label] || ""}
    />
  );
}
