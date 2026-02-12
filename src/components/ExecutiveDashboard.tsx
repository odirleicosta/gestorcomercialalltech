import { useState, useMemo, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  TrendingUp, TrendingDown, DollarSign, Percent, Target,
  BarChart3, Users, Lock, Unlock, Trophy, Building2, Package,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import type { Deal } from "@/components/DealManager";

interface Props {
  userId: string;
}

const ExecutiveDashboard = ({ userId }: Props) => {
  const [deals, setDeals] = useState<Deal[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetch = async () => {
      const { data } = await supabase
        .from("deals" as any)
        .select("*")
        .order("created_at", { ascending: false });
      if (data) setDeals(data as unknown as Deal[]);
      setLoading(false);
    };
    fetch();
  }, []);

  const stats = useMemo(() => {
    if (deals.length === 0) return null;

    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    const total = deals.length;
    const closed = deals.filter((d) => d.status === "closed");
    const open = deals.filter((d) => d.status === "open");
    const closedCount = closed.length;
    const closingRate = total > 0 ? (closedCount / total) * 100 : 0;

    // Monthly commissions (closed deals this month)
    const thisMonthClosed = closed.filter((d) => {
      if (!d.closed_at) return false;
      const dt = new Date(d.closed_at);
      return dt.getMonth() === currentMonth && dt.getFullYear() === currentYear;
    });
    const monthSellerComm = thisMonthClosed.reduce((s, d) => s + d.seller_commission_value, 0);
    const monthManagerComm = thisMonthClosed.reduce((s, d) => s + d.manager_commission_value, 0);

    const allWithMargin = deals.filter((d) => d.gross_margin_percent > 0);
    const avgGrossMargin = allWithMargin.length > 0
      ? allWithMargin.reduce((s, d) => s + d.gross_margin_percent, 0) / allWithMargin.length
      : 0;
    const avgNetMargin = allWithMargin.length > 0
      ? allWithMargin.reduce((s, d) => s + d.net_margin_percent, 0) / allWithMargin.length
      : 0;

    const totalGrossProfit = closed.reduce((s, d) => s + d.gross_profit, 0);
    const totalNetProfit = closed.reduce((s, d) => s + d.net_profit, 0);
    const totalSellerComm = closed.reduce((s, d) => s + d.seller_commission_value, 0);
    const totalManagerComm = closed.reduce((s, d) => s + d.manager_commission_value, 0);

    const pipelineValue = open.reduce((s, d) => s + d.final_price * 0.5, 0);

    const threeMonthsAgo = new Date(currentYear, currentMonth - 3, now.getDate());
    const recentClosed = closed.filter((d) => d.closed_at && new Date(d.closed_at) >= threeMonthsAgo);
    const avgClosedPerMonth = recentClosed.length / 3;
    const forecast3m = avgClosedPerMonth * 3;
    const forecastValue = recentClosed.length > 0
      ? (recentClosed.reduce((s, d) => s + d.final_price, 0) / recentClosed.length) * forecast3m
      : 0;

    // Rankings
    const modelMap = new Map<string, { count: number; revenue: number; profit: number }>();
    const clientMap = new Map<string, { count: number; revenue: number; profit: number }>();

    closed.forEach((d) => {
      const model = d.machine_name || "Sem modelo";
      const client = d.client_name;

      const m = modelMap.get(model) || { count: 0, revenue: 0, profit: 0 };
      m.count++; m.revenue += d.final_price; m.profit += d.net_profit;
      modelMap.set(model, m);

      const c = clientMap.get(client) || { count: 0, revenue: 0, profit: 0 };
      c.count++; c.revenue += d.final_price; c.profit += d.net_profit;
      clientMap.set(client, c);
    });

    const topModels = Array.from(modelMap.entries())
      .sort((a, b) => b[1].revenue - a[1].revenue)
      .slice(0, 5);
    const topClients = Array.from(clientMap.entries())
      .sort((a, b) => b[1].revenue - a[1].revenue)
      .slice(0, 5);

    return {
      total, closedCount, openCount: open.length, closingRate,
      avgGrossMargin, avgNetMargin,
      totalGrossProfit, totalNetProfit,
      totalSellerComm, totalManagerComm,
      monthSellerComm, monthManagerComm,
      pipelineValue, forecast3m: Math.round(forecast3m), forecastValue,
      topModels, topClients,
    };
  }, [deals]);

  const formatUsd = (v: number) =>
    `US$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const formatPct = (v: number) =>
    v.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + "%";

  if (loading) return <p className="text-muted-foreground text-center py-8">Carregando...</p>;
  if (!stats) return <p className="text-muted-foreground text-center py-8">Nenhuma negociação registrada ainda.</p>;

  const monthName = new Date().toLocaleDateString("pt-BR", { month: "long" });

  return (
    <div className="space-y-6">
      <h2 className="font-heading text-lg font-semibold text-foreground flex items-center gap-2">
        <BarChart3 className="h-5 w-5" /> Dashboard Executivo
      </h2>

      {/* Row 1: Key metrics */}
      <div className="grid gap-4 grid-cols-2 md:grid-cols-4">
        <KpiCard icon={<Target className="h-5 w-5" />} label="Taxa de Fechamento" value={formatPct(stats.closingRate)} sub={`${stats.closedCount} de ${stats.total}`} />
        <KpiCard icon={<TrendingUp className="h-5 w-5" />} label="Margem Média Bruta" value={formatPct(stats.avgGrossMargin)} />
        <KpiCard icon={<TrendingDown className="h-5 w-5" />} label="Margem Média Líquida" value={formatPct(stats.avgNetMargin)} accent={stats.avgNetMargin < 0} />
        <KpiCard icon={<Unlock className="h-5 w-5" />} label="Pipeline Ponderado" value={formatUsd(stats.pipelineValue)} sub={`${stats.openCount} abertas`} />
      </div>

      {/* Row 2: Profits */}
      <div className="grid gap-4 grid-cols-2 md:grid-cols-3">
        <KpiCard icon={<DollarSign className="h-5 w-5" />} label="Lucro Bruto Total" value={formatUsd(stats.totalGrossProfit)} highlight />
        <KpiCard icon={<DollarSign className="h-5 w-5" />} label="Lucro Líquido Total" value={formatUsd(stats.totalNetProfit)} highlight accent={stats.totalNetProfit < 0} />
        <KpiCard icon={<BarChart3 className="h-5 w-5" />} label="Previsão 3 Meses" value={formatUsd(stats.forecastValue)} sub={`~${stats.forecast3m} fechamentos`} />
      </div>

      {/* Row 3: Commissions */}
      <div className="grid gap-4 grid-cols-2 md:grid-cols-4">
        <KpiCard icon={<Users className="h-5 w-5" />} label={`Com. Vendedor (${monthName})`} value={formatUsd(stats.monthSellerComm)} />
        <KpiCard icon={<Users className="h-5 w-5" />} label={`Com. Gestor (${monthName})`} value={formatUsd(stats.monthManagerComm)} />
        <KpiCard icon={<Users className="h-5 w-5" />} label="Com. Vendedor Total" value={formatUsd(stats.totalSellerComm)} />
        <KpiCard icon={<Users className="h-5 w-5" />} label="Com. Gestor Total" value={formatUsd(stats.totalManagerComm)} />
      </div>

      {/* Rankings */}
      <div className="grid gap-4 md:grid-cols-2">
        {/* Top Models */}
        <Card className="border-border bg-card p-5 shadow-sm">
          <h3 className="font-heading text-sm font-semibold text-card-foreground mb-3 flex items-center gap-2">
            <Trophy className="h-4 w-4 text-warning" /> Ranking por Modelo
          </h3>
          {stats.topModels.length === 0 ? (
            <p className="text-xs text-muted-foreground">Sem dados.</p>
          ) : (
            <div className="space-y-2">
              {stats.topModels.map(([name, data], i) => (
                <div key={name} className="flex items-center justify-between text-sm py-1.5 border-b border-border last:border-0">
                  <div className="flex items-center gap-2">
                    <span className={`text-xs font-bold w-5 ${i === 0 ? "text-warning" : "text-muted-foreground"}`}>{i + 1}º</span>
                    <Package className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="font-medium text-sm">{name}</span>
                    <Badge variant="secondary" className="text-[10px] h-4">{data.count}x</Badge>
                  </div>
                  <div className="text-xs text-right">
                    <div>{formatUsd(data.revenue)}</div>
                    <div className={data.profit < 0 ? "text-destructive" : "text-accent"}>{formatUsd(data.profit)}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* Top Clients */}
        <Card className="border-border bg-card p-5 shadow-sm">
          <h3 className="font-heading text-sm font-semibold text-card-foreground mb-3 flex items-center gap-2">
            <Trophy className="h-4 w-4 text-warning" /> Ranking por Cliente
          </h3>
          {stats.topClients.length === 0 ? (
            <p className="text-xs text-muted-foreground">Sem dados.</p>
          ) : (
            <div className="space-y-2">
              {stats.topClients.map(([name, data], i) => (
                <div key={name} className="flex items-center justify-between text-sm py-1.5 border-b border-border last:border-0">
                  <div className="flex items-center gap-2">
                    <span className={`text-xs font-bold w-5 ${i === 0 ? "text-warning" : "text-muted-foreground"}`}>{i + 1}º</span>
                    <Building2 className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="font-medium text-sm">{name}</span>
                    <Badge variant="secondary" className="text-[10px] h-4">{data.count}x</Badge>
                  </div>
                  <div className="text-xs text-right">
                    <div>{formatUsd(data.revenue)}</div>
                    <div className={data.profit < 0 ? "text-destructive" : "text-accent"}>{formatUsd(data.profit)}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      {/* Recent closed deals */}
      {deals.filter((d) => d.status === "closed").length > 0 && (
        <Card className="border-border bg-card p-6 shadow-sm">
          <h3 className="font-heading text-base font-semibold text-card-foreground mb-4 flex items-center gap-2">
            <Lock className="h-4 w-4" /> Últimas Vendas Fechadas
          </h3>
          <div className="space-y-2">
            {deals
              .filter((d) => d.status === "closed")
              .slice(0, 5)
              .map((d) => (
                <div key={d.id} className="flex items-center justify-between text-sm py-2 border-b border-border last:border-0">
                  <div>
                    <span className="font-medium">{d.client_name}</span>
                    {d.machine_name && <span className="text-muted-foreground ml-2">— {d.machine_name}</span>}
                  </div>
                  <div className="flex items-center gap-4 text-xs">
                    <span>{formatUsd(d.final_price)}</span>
                    <span className="text-accent">{formatPct(d.gross_margin_percent)}</span>
                    <span className={`font-bold ${d.net_margin_percent < 0 ? "text-destructive" : "text-accent"}`}>{formatPct(d.net_margin_percent)}</span>
                    <span className="text-muted-foreground">
                      {d.closed_at ? new Date(d.closed_at).toLocaleDateString("pt-BR") : ""}
                    </span>
                  </div>
                </div>
              ))}
          </div>
        </Card>
      )}
    </div>
  );
};

const KpiCard = ({ icon, label, value, sub, highlight, accent }: {
  icon: React.ReactNode; label: string; value: string; sub?: string; highlight?: boolean; accent?: boolean;
}) => (
  <Card className={`p-4 shadow-sm ${highlight ? "border-primary/30 bg-primary/5" : "border-border bg-card"}`}>
    <div className="flex items-center gap-2 mb-1 text-muted-foreground">{icon}<span className="text-xs font-medium">{label}</span></div>
    <p className={`font-heading text-xl font-bold ${accent ? "text-destructive" : "text-foreground"}`}>{value}</p>
    {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
  </Card>
);

export default ExecutiveDashboard;
