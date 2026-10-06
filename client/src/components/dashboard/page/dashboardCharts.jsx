import { Area, AreaChart, Bar, BarChart, CartesianGrid, Tooltip, XAxis, YAxis } from "recharts";

export function SimpleBarChart({ data, color = "#2563eb", ...responsiveProps }) {
  return (
    <BarChart data={data} {...responsiveProps}>
      <CartesianGrid strokeDasharray="3 3" stroke="var(--border-soft, #e2e8f0)" />
      <XAxis dataKey="label" stroke="#69758a" interval={0} angle={-20} textAnchor="end" height={50} />
      <YAxis allowDecimals={false} stroke="#69758a" />
      <Tooltip />
      <Bar dataKey="count" fill={color} radius={[4, 4, 0, 0]} />
    </BarChart>
  );
}

export function SimpleTrendChart({ data, color = "#2563eb", ...responsiveProps }) {
  return (
    <AreaChart data={data} {...responsiveProps}>
      <CartesianGrid strokeDasharray="3 3" stroke="var(--border-soft, #e2e8f0)" />
      <XAxis dataKey="date" stroke="#69758a" tickFormatter={(value) => value.slice(5)} />
      <YAxis allowDecimals={false} stroke="#69758a" />
      <Tooltip />
      <Area dataKey="count" stroke={color} fill={color} fillOpacity={0.25} />
    </AreaChart>
  );
}
