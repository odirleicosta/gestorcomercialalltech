import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, TrendingDown } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from "recharts";

const SHORT_MONTHS = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];

const formatBrl = (v: number) =>
  v >= 1000000 ? `${(v / 1000000).toFixed(1)}M` : v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v);

interface Deal {
  representative_id: string | null;
  status: string;
  closed_at: string | null;
  base_price: number;
  dollar_rate: number;
  machine_type: string;
}

interface Props {
  deals: Deal[];
  filterYear: number;
}

const MonthlyTrend = ({ deals, filterYear }: Props) => {
  const closedDeals = deals.filter(d => d.status === "closed" && d.closed_at);

  const getMonthData = (year: number) =>
    SHORT_MONTHS.map((label, i) => {
      const monthDeals = closedDeals.filter(d => {
        const dt = new Date(d.closed_at!);
        return dt.getFullYear() === year && dt.getMonth() === i;
      });
      const fob = monthDeals.reduce((s, d) => s + d.base_price * (d.dollar_rate || 0), 0);
      const count = monthDeals.length;
      const margin = fob > 0 ? (monthDeals.reduce((s, d) => s + d.base_price, 0) / count) : 0;
      return { mes: label, fob, count, ticket: count > 0 ? fob / count : 0 };
    });

  const current = getMonthData(filterYear);
  const previous = getMonthData(filterYear - 1);

  const chartData = SHORT_MONTHS.map((label, i) => ({
    mes: label,
    atual: current[i].fob,
    anterior: previous[i].fob,
    qtd: current[i].count,
    qtdAnterior: previous[i].count,
  }));

  // YTD comparison
  const now = new Date();
  const currentMonth = filterYear === now.getFullYear() ? now.getMonth() : 11;
  const ytdCurrent = current.slice(0, currentMonth + 1).reduce((s, m) => s + m.fob, 0);
  const ytdPrevious = previous.slice(0, currentMonth + 1).reduce((s, m) => s + m.fob, 0);
  const ytdGrowth = ytdPrevious > 0 ? ((ytdCurrent - ytdPrevious) / ytdPrevious) * 100 : 0;
  const avgTicket = current.slice(0, currentMonth + 1).reduce((s, m) => s + m.ticket, 0) / (currentMonth + 1);

  return (
    <Card className="p-4 border-border bg-card">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
          <TrendingUp className="h-4 w-4 text-primary" />
          Tendência Mensal — {filterYear}
        </h3>
        <div className="flex items-center gap-2">
          <Badge variant={ytdGrowth >= 0 ? "default" : "destructive"} className="text-xs gap-1">
            {ytdGrowth >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
            {ytdGrowth >= 0 ? "+" : ""}{ytdGrowth.toFixed(1)}% vs {filterYear - 1}
          </Badge>
        </div>
      </div>

      {/* Mini KPIs */}
      <div className="grid grid-cols-3 gap-3 mb-4">
        <div className="p-2 rounded-lg bg-primary/10 text-center">
          <p className="text-[10px] text-muted-foreground">Faturamento YTD</p>
          <p className="text-sm font-bold text-primary">R$ {formatBrl(ytdCurrent)}</p>
        </div>
        <div className="p-2 rounded-lg bg-accent/10 text-center">
          <p className="text-[10px] text-muted-foreground">Ticket Médio</p>
          <p className="text-sm font-bold text-accent">R$ {formatBrl(avgTicket)}</p>
        </div>
        <div className="p-2 rounded-lg bg-secondary text-center">
          <p className="text-[10px] text-muted-foreground">Máq. YTD</p>
          <p className="text-sm font-bold text-foreground">
            {current.slice(0, currentMonth + 1).reduce((s, m) => s + m.count, 0)}
          </p>
        </div>
      </div>

      {/* Chart */}
      <div className="h-[260px]">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis dataKey="mes" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />
            <YAxis
              tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
              tickFormatter={v => `${formatBrl(v)}`}
            />
            <Tooltip
              formatter={(value: number, name: string) => [
                `R$ ${Number(value).toLocaleString("pt-BR")}`,
                name === "atual" ? String(filterYear) : String(filterYear - 1),
              ]}
              contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }}
            />
            <Legend formatter={(v) => v === "atual" ? String(filterYear) : String(filterYear - 1)} />
            <Line type="monotone" dataKey="atual" stroke="hsl(var(--primary))" strokeWidth={2.5} dot={{ r: 4, fill: "hsl(var(--primary))" }} name="atual" />
            <Line type="monotone" dataKey="anterior" stroke="hsl(var(--muted-foreground))" strokeWidth={1.5} strokeDasharray="5 5" dot={false} name="anterior" />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Qty chart */}
      <div className="h-[160px] mt-4">
        <p className="text-[10px] text-muted-foreground uppercase tracking-wide font-semibold mb-2">Quantidade de Máquinas</p>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis dataKey="mes" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />
            <YAxis tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} allowDecimals={false} />
            <Tooltip
              formatter={(value: number, name: string) => [
                value,
                name === "qtd" ? String(filterYear) : String(filterYear - 1),
              ]}
              contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }}
            />
            <Line type="monotone" dataKey="qtd" stroke="hsl(var(--accent))" strokeWidth={2} dot={{ r: 3, fill: "hsl(var(--accent))" }} name="qtd" />
            <Line type="monotone" dataKey="qtdAnterior" stroke="hsl(var(--muted-foreground))" strokeWidth={1.5} strokeDasharray="5 5" dot={false} name="qtdAnterior" />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
};

export default MonthlyTrend;
