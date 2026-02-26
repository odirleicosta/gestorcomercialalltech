import { Card } from "@/components/ui/card";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";

interface ChartData {
  month: string;
  vendedor: number;
  gestor: number;
}

interface Props {
  data: ChartData[];
  filterYear: number;
}

const formatBrlShort = (v: number) => {
  if (v >= 1000) return `R$ ${(v / 1000).toFixed(1)}k`;
  return `R$ ${v.toFixed(0)}`;
};

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload) return null;
  return (
    <div className="bg-card border border-border rounded-lg p-3 shadow-lg text-sm">
      <p className="font-semibold text-foreground mb-1">{label}</p>
      {payload.map((p: any) => (
        <div key={p.name} className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: p.fill }} />
          <span className="text-muted-foreground">{p.name}:</span>
          <span className="font-medium text-foreground">
            R$ {p.value.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
          </span>
        </div>
      ))}
    </div>
  );
};

const CommissionChart = ({ data, filterYear }: Props) => {
  return (
    <Card className="border-border bg-card p-4 sm:p-6 shadow-sm">
      <h3 className="font-heading text-sm sm:text-base font-semibold text-card-foreground mb-4">
        📊 Comissões Vendedor vs Gestor — {filterYear}
      </h3>
      <div className="h-[250px] sm:h-[300px]">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} barGap={2}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis dataKey="month" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
            <YAxis tickFormatter={formatBrlShort} tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} width={65} />
            <Tooltip content={<CustomTooltip />} />
            <Legend
              formatter={(value: string) => <span className="text-xs text-foreground">{value}</span>}
            />
            <Bar dataKey="vendedor" name="Vendedor" fill="hsl(var(--accent))" radius={[4, 4, 0, 0]} stackId="a" />
            <Bar dataKey="gestor" name="Gestor" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} stackId="a" />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
};

export default CommissionChart;
