import { useState, useMemo, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import {
  TrendingUp, TrendingDown, DollarSign, Percent, Target,
  BarChart3, Users, Lock, Unlock, Trophy, Building2, Package,
} from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { supabase } from "@/integrations/supabase/client";
import type { Deal } from "@/components/DealManager";

interface Props {
  userId: string;
}

interface RepOption {
  id: string;
  nome: string;
}

const MONTHS = ["Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];

const ExecutiveDashboard = ({ userId }: Props) => {
  const [deals, setDeals] = useState<Deal[]>([]);
  const [reps, setReps] = useState<RepOption[]>([]);
  const [loading, setLoading] = useState(true);
  const now = new Date();
  const [filterMonth, setFilterMonth] = useState(now.getMonth() + 1);
  const [filterYear, setFilterYear] = useState(now.getFullYear());
  const [filterRep, setFilterRep] = useState("all");

  useEffect(() => {
    const fetchData = async () => {
      const [dealsRes, repsRes] = await Promise.all([
        supabase.from("deals" as any).select("*").order("created_at", { ascending: false }),
        supabase.from("representatives" as any).select("id, nome").eq("status", "ATIVO").order("nome"),
      ]);
      if (dealsRes.data) setDeals(dealsRes.data as unknown as Deal[]);
      if (repsRes.data) setReps(repsRes.data as unknown as RepOption[]);
      setLoading(false);
    };
    fetchData();
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

  // Type analysis for selected month/year/rep
  const typeAnalysis = useMemo(() => {
    const monthClosed = deals.filter(d => {
      if (d.status !== "closed" || !d.closed_at) return false;
      const dt = new Date(d.closed_at);
      const matchMonth = (dt.getMonth() + 1) === filterMonth && dt.getFullYear() === filterYear;
      const matchRep = filterRep === "all" || d.representative_id === filterRep;
      return matchMonth && matchRep;
    });

    const typeMap = new Map<string, { count: number; revenue: number; grossProfit: number; netProfit: number; basePriceSum: number }>();
    monthClosed.forEach(d => {
      const type = d.machine_type || "Não classificado";
      const t = typeMap.get(type) || { count: 0, revenue: 0, grossProfit: 0, netProfit: 0, basePriceSum: 0 };
      t.count++;
      t.revenue += d.final_price;
      t.grossProfit += d.gross_profit;
      t.netProfit += d.net_profit;
      t.basePriceSum += d.base_price;
      typeMap.set(type, t);
    });

    return Array.from(typeMap.entries()).map(([type, data]) => ({
      type,
      count: data.count,
      revenue: data.revenue,
      grossProfit: data.grossProfit,
      netProfit: data.netProfit,
      netMargin: data.basePriceSum > 0 ? (data.netProfit / data.basePriceSum) * 100 : 0,
      ticketMedio: data.count > 0 ? data.revenue / data.count : 0,
    })).sort((a, b) => b.revenue - a.revenue);
  }, [deals, filterMonth, filterYear, filterRep]);

  // Chart data
  const chartData = useMemo(() => {
    return typeAnalysis.map(row => ({
      name: row.type,
      Faturamento: Math.round(row.revenue * 100) / 100,
      "Lucro Líquido": Math.round(row.netProfit * 100) / 100,
    }));
  }, [typeAnalysis]);

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

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-end">
        <div>
          <Label className="text-xs text-muted-foreground">Mês</Label>
          <Select value={String(filterMonth)} onValueChange={v => setFilterMonth(parseInt(v))}>
            <SelectTrigger className="w-[150px] bg-secondary/50 border-border text-sm"><SelectValue /></SelectTrigger>
            <SelectContent>
              {MONTHS.map((m, i) => <SelectItem key={i} value={String(i + 1)}>{m}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-xs text-muted-foreground">Ano</Label>
          <Select value={String(filterYear)} onValueChange={v => setFilterYear(parseInt(v))}>
            <SelectTrigger className="w-[100px] bg-secondary/50 border-border text-sm"><SelectValue /></SelectTrigger>
            <SelectContent>
              {[2024, 2025, 2026, 2027].map(y => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-xs text-muted-foreground">Representante</Label>
          <Select value={filterRep} onValueChange={setFilterRep}>
            <SelectTrigger className="w-[180px] bg-secondary/50 border-border text-sm"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              {reps.map(r => <SelectItem key={r.id} value={r.id}>{r.nome}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

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

      {/* Type Analysis */}
      <Card className="border-border bg-card p-5 shadow-sm">
        <h3 className="font-heading text-sm font-semibold text-card-foreground mb-4 flex items-center gap-2">
          <Package className="h-4 w-4" /> Análise por Tipo — {MONTHS[filterMonth - 1]}/{filterYear}
          {filterRep !== "all" && reps.find(r => r.id === filterRep) && (
            <Badge variant="outline" className="text-[10px] ml-2">{reps.find(r => r.id === filterRep)!.nome}</Badge>
          )}
        </h3>
        {typeAnalysis.length === 0 ? (
          <p className="text-xs text-muted-foreground">Nenhuma venda fechada no período selecionado.</p>
        ) : (
          <>
            <div className="overflow-auto mb-6">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-xs text-muted-foreground">
                    <th className="text-left py-2 font-medium">Tipo</th>
                    <th className="text-right py-2 font-medium">Qtde</th>
                    <th className="text-right py-2 font-medium">Faturamento</th>
                    <th className="text-right py-2 font-medium">Lucro Bruto</th>
                    <th className="text-right py-2 font-medium">Lucro Líquido</th>
                    <th className="text-right py-2 font-medium">Margem Líquida</th>
                    <th className="text-right py-2 font-medium">Ticket Médio</th>
                  </tr>
                </thead>
                <tbody>
                  {typeAnalysis.map(row => (
                    <tr key={row.type} className="border-b border-border last:border-0">
                      <td className="py-2 font-medium">{row.type}</td>
                      <td className="py-2 text-right">{row.count}</td>
                      <td className="py-2 text-right">{formatUsd(row.revenue)}</td>
                      <td className="py-2 text-right text-accent">{formatUsd(row.grossProfit)}</td>
                      <td className={`py-2 text-right font-semibold ${row.netProfit < 0 ? "text-destructive" : "text-accent"}`}>{formatUsd(row.netProfit)}</td>
                      <td className={`py-2 text-right ${row.netMargin < 0 ? "text-destructive" : ""}`}>{formatPct(row.netMargin)}</td>
                      <td className="py-2 text-right">{formatUsd(row.ticketMedio)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Bar charts */}
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-2">Faturamento por Tipo</p>
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                    <XAxis dataKey="name" tick={{ fontSize: 11 }} className="fill-muted-foreground" />
                    <YAxis tick={{ fontSize: 10 }} className="fill-muted-foreground" />
                    <Tooltip formatter={(v: number) => formatUsd(v)} contentStyle={{ fontSize: 12 }} />
                    <Bar dataKey="Faturamento" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-2">Lucro Líquido por Tipo</p>
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                    <XAxis dataKey="name" tick={{ fontSize: 11 }} className="fill-muted-foreground" />
                    <YAxis tick={{ fontSize: 10 }} className="fill-muted-foreground" />
                    <Tooltip formatter={(v: number) => formatUsd(v)} contentStyle={{ fontSize: 12 }} />
                    <Bar dataKey="Lucro Líquido" fill="hsl(var(--accent))" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </>
        )}
      </Card>

      {/* Rankings */}
      <div className="grid gap-4 md:grid-cols-2">
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
                    {d.machine_type && <Badge variant="outline" className="text-[10px] h-4 ml-2">{d.machine_type}</Badge>}
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
