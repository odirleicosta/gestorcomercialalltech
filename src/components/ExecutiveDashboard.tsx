import { useState, useMemo, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  TrendingUp, TrendingDown, DollarSign, Percent, Target,
  BarChart3, Users, Lock, Unlock,
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

    const total = deals.length;
    const closed = deals.filter((d) => d.status === "closed");
    const open = deals.filter((d) => d.status === "open");
    const closedCount = closed.length;
    const closingRate = total > 0 ? (closedCount / total) * 100 : 0;

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

    // Pipeline ponderado: valor das abertas (sem probabilidade, usando 50% como default)
    const pipelineValue = open.reduce((s, d) => s + d.final_price * 0.5, 0);

    // Previsão próximos 3 meses: média de fechamentos por mês * 3
    const now = new Date();
    const threeMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 3, now.getDate());
    const recentClosed = closed.filter((d) => d.closed_at && new Date(d.closed_at) >= threeMonthsAgo);
    const monthsActive = Math.max(1, 3);
    const avgClosedPerMonth = recentClosed.length / monthsActive;
    const forecast3m = avgClosedPerMonth * 3;
    const forecastValue = recentClosed.length > 0
      ? (recentClosed.reduce((s, d) => s + d.final_price, 0) / recentClosed.length) * forecast3m
      : 0;

    return {
      total, closedCount, openCount: open.length, closingRate,
      avgGrossMargin, avgNetMargin,
      totalGrossProfit, totalNetProfit,
      totalSellerComm, totalManagerComm,
      pipelineValue, forecast3m: Math.round(forecast3m), forecastValue,
    };
  }, [deals]);

  const formatUsd = (v: number) =>
    `US$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const formatPct = (v: number) =>
    v.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + "%";

  if (loading) return <p className="text-muted-foreground text-center py-8">Carregando...</p>;
  if (!stats) return <p className="text-muted-foreground text-center py-8">Nenhuma negociação registrada ainda.</p>;

  return (
    <div className="space-y-6">
      <h2 className="font-heading text-lg font-semibold text-foreground flex items-center gap-2">
        <BarChart3 className="h-5 w-5" /> Dashboard Executivo
      </h2>

      {/* KPI Cards */}
      <div className="grid gap-4 grid-cols-2 md:grid-cols-4">
        <KpiCard icon={<Target className="h-5 w-5" />} label="Taxa de Fechamento" value={formatPct(stats.closingRate)} sub={`${stats.closedCount} de ${stats.total} negociações`} />
        <KpiCard icon={<TrendingUp className="h-5 w-5" />} label="Margem Média Bruta" value={formatPct(stats.avgGrossMargin)} />
        <KpiCard icon={<TrendingDown className="h-5 w-5" />} label="Margem Média Líquida" value={formatPct(stats.avgNetMargin)} accent={stats.avgNetMargin < 0} />
        <KpiCard icon={<Unlock className="h-5 w-5" />} label="Pipeline Ponderado" value={formatUsd(stats.pipelineValue)} sub={`${stats.openCount} negociações abertas`} />
      </div>

      <div className="grid gap-4 grid-cols-2 md:grid-cols-3">
        <KpiCard icon={<DollarSign className="h-5 w-5" />} label="Lucro Total Bruto" value={formatUsd(stats.totalGrossProfit)} highlight />
        <KpiCard icon={<DollarSign className="h-5 w-5" />} label="Lucro Total Líquido" value={formatUsd(stats.totalNetProfit)} highlight accent={stats.totalNetProfit < 0} />
        <KpiCard icon={<BarChart3 className="h-5 w-5" />} label="Previsão 3 Meses" value={formatUsd(stats.forecastValue)} sub={`~${stats.forecast3m} fechamentos estimados`} />
      </div>

      <div className="grid gap-4 grid-cols-2">
        <KpiCard icon={<Users className="h-5 w-5" />} label="Comissão Total Vendedor" value={formatUsd(stats.totalSellerComm)} />
        <KpiCard icon={<Users className="h-5 w-5" />} label="Comissão Total Gestor" value={formatUsd(stats.totalManagerComm)} />
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
                    <span className={d.net_margin_percent < 0 ? "text-destructive" : ""}>{formatPct(d.net_margin_percent)}</span>
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
