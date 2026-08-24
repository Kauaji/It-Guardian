import WidgetBarList from "../WidgetBarList.jsx";

export default function ServiceOrdersByStatusWidget({ data }) {
  return <WidgetBarList rows={data.rows} emptyMessage="Nenhuma ordem de servico registrada ainda." />;
}
