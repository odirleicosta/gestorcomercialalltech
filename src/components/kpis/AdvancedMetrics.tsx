import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Clock, RefreshCcw, TrendingUp, DollarSign } from "lucide-react";

interface Deal {
  id: string;
  representative_id: string | null;
  status: string;
  closed_at: string | null;
  created_at: string;
  base_price: number;
  dollar_rate: number;
  client_name?: string;
}

interface ClosingDeal {
  id: string;
  status: string;
  deal_value: number;
  probability: string;
}

interface Props {
  deals: Deal[];
  closingDeals: ClosingDeal[];
  filterYear: number;
  activeMonths: number[];
}

const formatBrl = (v: number) =>
  v >= 1000000 ? `R$ ${(v / 1000000).toFixed(1)}M` : v >= 1000 ? `R$ ${(v / 1000).toFixed(0)}k` : `R$ ${v.toFixed(0)}`;

const AdvancedMetrics = ({ deals, closingDeals, filterYear, activeMonths }: Props) => {
  // 1. Ciclo Médio de Venda
  const closedDeals = deals.filter(d => {
    if (d.status !== "closed" || !d.closed_at) return false;
    const dt = new Date(d.closed_at);
    return dt.getFullYear() === filterYear && activeMonths.includes(dt.getMonth() + 1);
  });

  const cycles = closedDeals.map(d => {
    const created = new Date(d.created_at);
    const closed = new Date(d.closed_at!);
    return Math.max(1, Math.floor((closed.getTime() - created.getTime()) / 86400000));
  });
  const avgCycle = cycles.length > 0 ? cycles.reduce((s, c) => s + c, 0) / cycles.length : 0;
  const minCycle = cycles.length > 0 ? Math.min(...cycles) : 0;
  const maxCycle = cycles.length > 0 ? Math.max(...cycles) : 0;

  // 2. Taxa de Recompra
  const clientDealCount: Record<string, number> = {};
  const allClosedThisYear = deals.filter(d => d.status === "closed" && d.closed_at && new Date(d.closed_at).getFullYear() === filterYear);
  allClosedThisYear.forEach(d => {
    const client = (d as any).client_name || "unknown";
    clientDealCount[client] = (clientDealCount[client] || 0) + 1;
  });
  const totalClients = Object.keys(clientDealCount).length;
  const repeatClients = Object.values(clientDealCount).filter(c => c >= 2).length;
  const repeatRate = totalClients > 0 ? (repeatClients / totalClients) * 100 : 0;

  // 3. Previsão de Receita
  const now = new Date();
  const dayOfYear = Math.floor((now.getTime() - new Date(now.getFullYear(), 0, 1).getTime()) / 86400000) + 1;
  const daysInYear = 365;
  const ytdRevenue = allClosedThisYear.reduce((s, d) => s + d.base_price * (d.dollar_rate || 0), 0);
  const projectedRevenue = dayOfYear > 0 ? (ytdRevenue / dayOfYear) * daysInYear : 0;

  const activePipeline = closingDeals.filter(c => c.status === "ativa");
  const weightedPipeline = activePipeline.reduce((s, c) => {
    const w = c.probability === "Alta" ? 0.8 : c.probability === "Média" ? 0.5 : 0.2;
    return s + c.deal_value * w;
  }, 0);
  const totalForecast = ytdRevenue + weightedPipeline;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
      {/* Ciclo Médio */}
      <Card className="p-4 border-border bg-card">
        <div className="flex items-center gap-2 mb-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
            <Clock className="h-4 w-4 text-primary" />
          </div>
          <div>
            <p className="text-xs font-semibold text-foreground">Ciclo Médio de Venda</p>
            <p className="text-[10px] text-muted-foreground">Criação → Fechamento</p>
          </div>
        </div>
        <p className="text-2xl font-bold text-primary">{avgCycle.toFixed(0)} dias</p>
        <div className="flex items-center gap-3 mt-2 text-[10px] text-muted-foreground">
          <span>Mín: {minCycle}d</span>
          <span>·</span>
          <span>Máx: {maxCycle}d</span>
          <span>·</span>
          <span>{closedDeals.length} vendas</span>
        </div>
        {avgCycle > 60 && (
          <Badge variant="destructive" className="text-[9px] mt-2">
            Ciclo longo — otimize o processo
          </Badge>
        )}
      </Card>

      {/* Taxa de Recompra */}
      <Card className="p-4 border-border bg-card">
        <div className="flex items-center gap-2 mb-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent/10">
            <RefreshCcw className="h-4 w-4 text-accent" />
          </div>
          <div>
            <p className="text-xs font-semibold text-foreground">Taxa de Recompra</p>
            <p className="text-[10px] text-muted-foreground">Clientes com 2+ compras</p>
          </div>
        </div>
        <p className="text-2xl font-bold text-accent">{repeatRate.toFixed(1)}%</p>
        <div className="flex items-center gap-3 mt-2 text-[10px] text-muted-foreground">
          <span>{repeatClients} recorrentes</span>
          <span>·</span>
          <span>{totalClients} clientes únicos</span>
        </div>
        {repeatRate >= 20 && (
          <Badge className="text-[9px] mt-2 bg-accent/20 text-accent border-accent/30">
            Boa fidelização
          </Badge>
        )}
      </Card>

      {/* Previsão de Receita */}
      <Card className="p-4 border-border bg-card">
        <div className="flex items-center gap-2 mb-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
            <TrendingUp className="h-4 w-4 text-primary" />
          </div>
          <div>
            <p className="text-xs font-semibold text-foreground">Previsão de Receita</p>
            <p className="text-[10px] text-muted-foreground">Ritmo + Pipeline ponderado</p>
          </div>
        </div>
        <p className="text-2xl font-bold text-primary">{formatBrl(totalForecast)}</p>
        <div className="flex flex-col gap-1 mt-2 text-[10px] text-muted-foreground">
          <span>Projeção pelo ritmo: {formatBrl(projectedRevenue)}</span>
          <span>Pipeline ponderado: {formatBrl(weightedPipeline)}</span>
          <span>Realizado YTD: {formatBrl(ytdRevenue)}</span>
        </div>
      </Card>
    </div>
  );
};

export default AdvancedMetrics;
