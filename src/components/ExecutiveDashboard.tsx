import { useState, useMemo, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import {
  TrendingUp, TrendingDown, DollarSign, Percent, Target,
  BarChart3, Users, Lock, Unlock, Trophy, Building2, Package,
  ArrowUpRight, ArrowDownRight, Minus, AlertTriangle, Medal, Calendar,
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line, Area, AreaChart, Legend as RechartLegend,
} from "recharts";
import { supabase } from "@/integrations/supabase/client";
import type { Deal } from "@/components/DealManager";

interface Props {
  userId: string;
}

interface RepOption {
  id: string;
  nome: string;
}

interface RepWithGoals extends RepOption {
  meta_mensal_padrao: number;
  meta_quantidade: number;
}

const MONTHS = ["Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];

const ExecutiveDashboard = ({ userId }: Props) => {
  const [deals, setDeals] = useState<Deal[]>([]);
  const [reps, setReps] = useState<RepOption[]>([]);
  const [repsWithGoals, setRepsWithGoals] = useState<RepWithGoals[]>([]);
  const [loading, setLoading] = useState(true);
  const now = new Date();
  const [filterMonth, setFilterMonth] = useState(now.getMonth() + 1);
  const [filterYear, setFilterYear] = useState(now.getFullYear());
  const [filterRep, setFilterRep] = useState("all");

  useEffect(() => {
    const fetchData = async () => {
      const [dealsRes, repsRes] = await Promise.all([
        supabase.from("deals" as any).select("*").order("created_at", { ascending: false }),
        supabase.from("representatives" as any).select("id, nome, meta_mensal_padrao, meta_quantidade").eq("status", "ATIVO").order("nome"),
      ]);
      if (dealsRes.data) setDeals(dealsRes.data as unknown as Deal[]);
      if (repsRes.data) {
        const r = repsRes.data as unknown as RepWithGoals[];
        setReps(r.map(x => ({ id: x.id, nome: x.nome })));
        setRepsWithGoals(r);
      }
      setLoading(false);
    };
    fetchData();
  }, []);

  // Helper: get closed deals for a specific month/year
  const getMonthClosed = (month: number, year: number, repFilter = "all") => {
    return deals.filter(d => {
      if (d.status !== "closed" || !d.closed_at) return false;
      const dt = new Date(d.closed_at);
      const matchMonth = (dt.getMonth() + 1) === month && dt.getFullYear() === year;
      const matchRep = repFilter === "all" || d.representative_id === repFilter;
      return matchMonth && matchRep;
    });
  };

  // Current month and previous month stats for comparison
  const monthStats = useMemo(() => {
    const current = getMonthClosed(filterMonth, filterYear, filterRep);
    const prevMonth = filterMonth === 1 ? 12 : filterMonth - 1;
    const prevYear = filterMonth === 1 ? filterYear - 1 : filterYear;
    const previous = getMonthClosed(prevMonth, prevYear, filterRep);

    const calc = (arr: Deal[]) => ({
      count: arr.length,
      revenue: arr.reduce((s, d) => s + d.final_price, 0),
      grossProfit: arr.reduce((s, d) => s + d.gross_profit, 0),
      netProfit: arr.reduce((s, d) => s + d.net_profit, 0),
      avgNetMargin: arr.length > 0 ? arr.reduce((s, d) => s + d.net_margin_percent, 0) / arr.length : 0,
      avgGrossMargin: arr.length > 0 ? arr.reduce((s, d) => s + d.gross_margin_percent, 0) / arr.length : 0,
      sellerComm: arr.reduce((s, d) => s + d.seller_commission_value, 0),
      managerComm: arr.reduce((s, d) => s + d.manager_commission_value, 0),
      ticketMedio: arr.length > 0 ? arr.reduce((s, d) => s + d.final_price, 0) / arr.length : 0,
    });

    return { current: calc(current), previous: calc(previous), currentDeals: current };
  }, [deals, filterMonth, filterYear, filterRep]);

  // Overall stats (all time)
  const stats = useMemo(() => {
    if (deals.length === 0) return null;
    const total = deals.length;
    const closed = deals.filter(d => d.status === "closed");
    const open = deals.filter(d => d.status === "open");
    const closedCount = closed.length;
    const closingRate = total > 0 ? (closedCount / total) * 100 : 0;
    const pipelineValue = open.reduce((s, d) => s + d.final_price * 0.5, 0);

    const modelMap = new Map<string, { count: number; revenue: number; profit: number }>();
    const clientMap = new Map<string, { count: number; revenue: number; profit: number }>();
    closed.forEach(d => {
      const model = d.machine_name || "Sem modelo";
      const client = d.client_name;
      const m = modelMap.get(model) || { count: 0, revenue: 0, profit: 0 };
      m.count++; m.revenue += d.final_price; m.profit += d.net_profit;
      modelMap.set(model, m);
      const c = clientMap.get(client) || { count: 0, revenue: 0, profit: 0 };
      c.count++; c.revenue += d.final_price; c.profit += d.net_profit;
      clientMap.set(client, c);
    });

    return {
      total, closedCount, openCount: open.length, closingRate, pipelineValue,
      topModels: Array.from(modelMap.entries()).sort((a, b) => b[1].revenue - a[1].revenue).slice(0, 5),
      topClients: Array.from(clientMap.entries()).sort((a, b) => b[1].revenue - a[1].revenue).slice(0, 5),
    };
  }, [deals]);

  // Monthly evolution (last 6 months)
  const evolutionData = useMemo(() => {
    const data: { name: string; Faturamento: number; "Lucro Líquido": number; Vendas: number }[] = [];
    for (let i = 5; i >= 0; i--) {
      let m = filterMonth - i;
      let y = filterYear;
      while (m <= 0) { m += 12; y--; }
      const closed = getMonthClosed(m, y, filterRep);
      data.push({
        name: `${MONTHS[m - 1].slice(0, 3)}/${String(y).slice(2)}`,
        Faturamento: Math.round(closed.reduce((s, d) => s + d.final_price, 0) * 100) / 100,
        "Lucro Líquido": Math.round(closed.reduce((s, d) => s + d.net_profit, 0) * 100) / 100,
        Vendas: closed.length,
      });
    }
    return data;
  }, [deals, filterMonth, filterYear, filterRep]);

  // Type analysis
  const typeAnalysis = useMemo(() => {
    const typeMap = new Map<string, { count: number; revenue: number; grossProfit: number; netProfit: number; basePriceSum: number }>();
    monthStats.currentDeals.forEach(d => {
      const type = d.machine_type || "Não classificado";
      const t = typeMap.get(type) || { count: 0, revenue: 0, grossProfit: 0, netProfit: 0, basePriceSum: 0 };
      t.count++; t.revenue += d.final_price; t.grossProfit += d.gross_profit;
      t.netProfit += d.net_profit; t.basePriceSum += d.base_price;
      typeMap.set(type, t);
    });
    return Array.from(typeMap.entries()).map(([type, data]) => ({
      type, count: data.count, revenue: data.revenue, grossProfit: data.grossProfit,
      netProfit: data.netProfit,
      netMargin: data.basePriceSum > 0 ? (data.netProfit / data.basePriceSum) * 100 : 0,
      ticketMedio: data.count > 0 ? data.revenue / data.count : 0,
    })).sort((a, b) => b.revenue - a.revenue);
  }, [monthStats.currentDeals]);

  const chartData = useMemo(() => typeAnalysis.map(row => ({
    name: row.type,
    Faturamento: Math.round(row.revenue * 100) / 100,
    "Lucro Líquido": Math.round(row.netProfit * 100) / 100,
  })), [typeAnalysis]);

  // Sales funnel
  const funnelData = useMemo(() => {
    const allMonth = deals.filter(d => {
      const dt = new Date(d.created_at);
      const matchMonth = (dt.getMonth() + 1) === filterMonth && dt.getFullYear() === filterYear;
      const matchRep = filterRep === "all" || d.representative_id === filterRep;
      return matchMonth && matchRep;
    });
    const total = allMonth.length;
    const open = allMonth.filter(d => d.status === "open").length;
    const closed = monthStats.currentDeals.length;
    return { total, open, closed };
  }, [deals, filterMonth, filterYear, filterRep, monthStats]);

  // Rep ranking for the month
  const repRanking = useMemo(() => {
    if (repsWithGoals.length === 0) return [];
    return repsWithGoals.map(rep => {
      const repDeals = getMonthClosed(filterMonth, filterYear, rep.id);
      const revenue = repDeals.reduce((s, d) => s + d.final_price, 0);
      const count = repDeals.length;
      const metaVal = rep.meta_mensal_padrao || 0;
      const metaQtd = rep.meta_quantidade || 0;
      const pctVal = metaVal > 0 ? (revenue / metaVal) * 100 : 0;
      const pctQtd = metaQtd > 0 ? (count / metaQtd) * 100 : 0;
      return { ...rep, revenue, count, pctVal, pctQtd, metaVal, metaQtd };
    }).filter(r => r.count > 0 || r.metaVal > 0 || r.metaQtd > 0)
      .sort((a, b) => b.revenue - a.revenue);
  }, [repsWithGoals, deals, filterMonth, filterYear]);

  // Goal alerts
  const goalAlerts = useMemo(() => {
    const alerts: string[] = [];
    const dayOfMonth = now.getDate();
    const daysInMonth = new Date(filterYear, filterMonth, 0).getDate();
    const progressPct = (dayOfMonth / daysInMonth) * 100;

    repRanking.forEach(rep => {
      if (rep.metaVal > 0 && rep.pctVal < progressPct * 0.8) {
        alerts.push(`⚠️ ${rep.nome}: faturamento em ${rep.pctVal.toFixed(0)}% da meta (esperado ~${progressPct.toFixed(0)}%)`);
      }
      if (rep.metaQtd > 0 && rep.pctQtd < progressPct * 0.8) {
        alerts.push(`⚠️ ${rep.nome}: quantidade em ${rep.pctQtd.toFixed(0)}% da meta (${rep.count}/${rep.metaQtd})`);
      }
    });
    return alerts;
  }, [repRanking, filterMonth, filterYear]);

  const formatUsd = (v: number) =>
    `US$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const formatPct = (v: number) =>
    v.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + "%";
  const formatCompact = (v: number) =>
    v >= 1000 ? `US$ ${(v / 1000).toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}k` : formatUsd(v);

  if (loading) return <p className="text-muted-foreground text-center py-8">Carregando...</p>;
  if (!stats) return <p className="text-muted-foreground text-center py-8">Nenhuma negociação registrada ainda.</p>;

  const { current: cur, previous: prev } = monthStats;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="icon-bubble icon-bubble--primary">
            <BarChart3 className="h-5 w-5" />
          </div>
          <div>
            <h2 className="font-heading text-xl font-bold text-foreground">Dashboard Executivo</h2>
            <p className="text-xs text-muted-foreground">Visão geral do desempenho comercial</p>
          </div>
        </div>
        <Badge variant="outline" className="text-xs gap-1">
          <Calendar className="h-3 w-3" />
          {MONTHS[filterMonth - 1]} {filterYear}
        </Badge>
      </div>

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

      {/* Goal Alerts */}
      {goalAlerts.length > 0 && (
        <Card className="border-warning/30 bg-warning/5 p-4 rounded-xl animate-fade-in">
          <div className="flex items-center gap-2 mb-2">
            <div className="icon-bubble icon-bubble--warning" style={{ height: '28px', width: '28px' }}>
              <AlertTriangle className="h-3.5 w-3.5" />
            </div>
            <span className="text-sm font-semibold text-foreground">Alertas de Metas</span>
          </div>
          <div className="space-y-1">
            {goalAlerts.map((a, i) => (
              <p key={i} className="text-xs text-muted-foreground">{a}</p>
            ))}
          </div>
        </Card>
      )}

      {/* Row 1: Monthly KPIs with MoM comparison */}
      <div className="grid gap-4 grid-cols-2 md:grid-cols-4">
        <KpiCard icon={<Package className="h-5 w-5" />} label="Vendas no Mês" value={String(cur.count)} delta={cur.count - prev.count} deltaLabel="vs mês anterior" variant="primary" />
        <KpiCard icon={<DollarSign className="h-5 w-5" />} label="Faturamento" value={formatCompact(cur.revenue)} delta={prev.revenue > 0 ? ((cur.revenue - prev.revenue) / prev.revenue) * 100 : 0} deltaLabel="%" isPercent variant="accent" />
        <KpiCard icon={<TrendingUp className="h-5 w-5" />} label="Lucro Líquido" value={formatCompact(cur.netProfit)} delta={prev.netProfit > 0 ? ((cur.netProfit - prev.netProfit) / prev.netProfit) * 100 : 0} deltaLabel="%" isPercent variant={cur.netProfit < 0 ? "destructive" : "accent"} accent={cur.netProfit < 0} />
        <KpiCard icon={<Target className="h-5 w-5" />} label="Ticket Médio" value={formatCompact(cur.ticketMedio)} delta={prev.ticketMedio > 0 ? ((cur.ticketMedio - prev.ticketMedio) / prev.ticketMedio) * 100 : 0} deltaLabel="%" isPercent variant="info" />
      </div>

      {/* Row 2: Margins & Pipeline */}
      <div className="grid gap-4 grid-cols-2 md:grid-cols-4">
        <KpiCard icon={<Percent className="h-5 w-5" />} label="Margem Bruta Média" value={formatPct(cur.avgGrossMargin)} delta={cur.avgGrossMargin - prev.avgGrossMargin} deltaLabel="pp" variant="accent" />
        <KpiCard icon={<Percent className="h-5 w-5" />} label="Margem Líquida Média" value={formatPct(cur.avgNetMargin)} delta={cur.avgNetMargin - prev.avgNetMargin} deltaLabel="pp" variant={cur.avgNetMargin < 0 ? "destructive" : "info"} accent={cur.avgNetMargin < 0} />
        <KpiCard icon={<Users className="h-5 w-5" />} label="Comissões (Mês)" value={formatCompact(cur.sellerComm + cur.managerComm)} sub={`Vend: ${formatCompact(cur.sellerComm)} | Gest: ${formatCompact(cur.managerComm)}`} variant="primary" />
        <KpiCard icon={<Unlock className="h-5 w-5" />} label="Pipeline Ponderado" value={formatCompact(stats.pipelineValue)} sub={`${stats.openCount} em aberto`} variant="warning" />
      </div>

      {/* Sales Funnel + Evolution chart */}
      <div className="grid gap-4 md:grid-cols-5">
        {/* Funnel */}
        <Card className="border-border/60 bg-card p-5 shadow-md rounded-xl md:col-span-2">
          <h3 className="font-heading text-sm font-semibold text-card-foreground mb-4 flex items-center gap-2">
            <div className="icon-bubble icon-bubble--primary" style={{ height: '28px', width: '28px' }}>
              <Target className="h-3.5 w-3.5" />
            </div>
            Funil de Vendas — {MONTHS[filterMonth - 1].slice(0, 3)}
          </h3>
          <div className="space-y-4">
            <FunnelStep label="Negociações Criadas" value={funnelData.total} max={funnelData.total} color="bg-info" />
            <FunnelStep label="Em Andamento" value={funnelData.open} max={funnelData.total} color="bg-warning" />
            <FunnelStep label="Vendas Fechadas" value={funnelData.closed} max={funnelData.total} color="bg-accent" />
            {funnelData.total > 0 && (
              <div className="pt-2 border-t border-border/50">
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>Taxa de Conversão</span>
                  <span className="font-bold text-foreground">{formatPct(funnelData.total > 0 ? (funnelData.closed / funnelData.total) * 100 : 0)}</span>
                </div>
              </div>
            )}
          </div>
        </Card>

        {/* Evolution line chart */}
        <Card className="border-border/60 bg-card p-5 shadow-md rounded-xl md:col-span-3">
          <h3 className="font-heading text-sm font-semibold text-card-foreground mb-4 flex items-center gap-2">
            <div className="icon-bubble icon-bubble--accent" style={{ height: '28px', width: '28px' }}>
              <TrendingUp className="h-3.5 w-3.5" />
            </div>
            Evolução Mensal (6 meses)
          </h3>
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={evolutionData}>
              <defs>
                <linearGradient id="gradFat" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.2} />
                  <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="gradLucro" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(var(--accent))" stopOpacity={0.2} />
                  <stop offset="95%" stopColor="hsl(var(--accent))" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
              <XAxis dataKey="name" tick={{ fontSize: 11 }} className="fill-muted-foreground" />
              <YAxis tick={{ fontSize: 10 }} className="fill-muted-foreground" />
              <Tooltip formatter={(v: number) => formatUsd(v)} contentStyle={{ fontSize: 12, borderRadius: 8 }} />
              <Area type="monotone" dataKey="Faturamento" stroke="hsl(var(--primary))" fill="url(#gradFat)" strokeWidth={2} />
              <Area type="monotone" dataKey="Lucro Líquido" stroke="hsl(var(--accent))" fill="url(#gradLucro)" strokeWidth={2} />
              <RechartLegend wrapperStyle={{ fontSize: 11 }} />
            </AreaChart>
          </ResponsiveContainer>
        </Card>
      </div>

      {/* Type Analysis */}
      <Card className="border-border/60 bg-card p-6 shadow-md rounded-xl">
        <h3 className="font-heading text-sm font-semibold text-card-foreground mb-4 flex items-center gap-2">
          <div className="icon-bubble icon-bubble--info" style={{ height: '28px', width: '28px' }}>
            <Package className="h-3.5 w-3.5" />
          </div>
          Análise por Tipo — {MONTHS[filterMonth - 1]}/{filterYear}
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
                    <tr key={row.type} className="border-b border-border/50 last:border-0 hover:bg-muted/30 transition-colors">
                      <td className="py-2.5 font-medium">{row.type}</td>
                      <td className="py-2.5 text-right">{row.count}</td>
                      <td className="py-2.5 text-right">{formatUsd(row.revenue)}</td>
                      <td className="py-2.5 text-right text-accent">{formatUsd(row.grossProfit)}</td>
                      <td className={`py-2.5 text-right font-semibold ${row.netProfit < 0 ? "text-destructive" : "text-accent"}`}>{formatUsd(row.netProfit)}</td>
                      <td className={`py-2.5 text-right ${row.netMargin < 0 ? "text-destructive" : ""}`}>{formatPct(row.netMargin)}</td>
                      <td className="py-2.5 text-right">{formatUsd(row.ticketMedio)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-2">Faturamento por Tipo</p>
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                    <XAxis dataKey="name" tick={{ fontSize: 11 }} className="fill-muted-foreground" />
                    <YAxis tick={{ fontSize: 10 }} className="fill-muted-foreground" />
                    <Tooltip formatter={(v: number) => formatUsd(v)} contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                    <Bar dataKey="Faturamento" fill="hsl(var(--primary))" radius={[6, 6, 0, 0]} />
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
                    <Tooltip formatter={(v: number) => formatUsd(v)} contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                    <Bar dataKey="Lucro Líquido" fill="hsl(var(--accent))" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </>
        )}
      </Card>

      {/* Rep Ranking */}
      {repRanking.length > 0 && (
        <Card className="border-border/60 bg-card p-6 shadow-md rounded-xl">
          <h3 className="font-heading text-sm font-semibold text-card-foreground mb-4 flex items-center gap-2">
            <div className="icon-bubble icon-bubble--warning" style={{ height: '28px', width: '28px' }}>
              <Medal className="h-3.5 w-3.5" />
            </div>
            Ranking de Representantes — {MONTHS[filterMonth - 1].slice(0, 3)}/{filterYear}
          </h3>
          <div className="space-y-3">
            {repRanking.map((rep, i) => (
              <div key={rep.id} className="p-3 rounded-lg border border-border/50 hover:bg-muted/20 transition-colors">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className={`text-sm font-bold w-6 ${i === 0 ? "text-warning" : i === 1 ? "text-muted-foreground" : "text-muted-foreground/60"}`}>
                      {i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `${i + 1}º`}
                    </span>
                    <span className="font-medium text-sm">{rep.nome}</span>
                  </div>
                  <div className="flex items-center gap-3 text-xs">
                    <Badge variant="secondary" className="text-[10px]">{rep.count} vendas</Badge>
                    <span className="font-semibold">{formatCompact(rep.revenue)}</span>
                  </div>
                </div>
                {(rep.metaVal > 0 || rep.metaQtd > 0) && (
                  <div className="grid gap-2 md:grid-cols-2">
                    {rep.metaVal > 0 && (
                      <div>
                        <div className="flex justify-between text-[11px] mb-1">
                          <span className="text-muted-foreground">Meta Valor</span>
                          <span className={`font-medium ${rep.pctVal >= 100 ? "text-accent" : rep.pctVal >= 70 ? "text-warning" : "text-destructive"}`}>
                            {formatPct(rep.pctVal)}
                          </span>
                        </div>
                        <Progress value={Math.min(rep.pctVal, 100)} className="h-1.5" />
                      </div>
                    )}
                    {rep.metaQtd > 0 && (
                      <div>
                        <div className="flex justify-between text-[11px] mb-1">
                          <span className="text-muted-foreground">Meta Qtd ({rep.count}/{rep.metaQtd})</span>
                          <span className={`font-medium ${rep.pctQtd >= 100 ? "text-accent" : rep.pctQtd >= 70 ? "text-warning" : "text-destructive"}`}>
                            {formatPct(rep.pctQtd)}
                          </span>
                        </div>
                        <Progress value={Math.min(rep.pctQtd, 100)} className="h-1.5" />
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Rankings */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card className="border-border/60 bg-card p-5 shadow-md rounded-xl">
          <h3 className="font-heading text-sm font-semibold text-card-foreground mb-3 flex items-center gap-2">
            <div className="icon-bubble icon-bubble--warning" style={{ height: '28px', width: '28px' }}>
              <Trophy className="h-3.5 w-3.5" />
            </div>
            Ranking por Modelo
          </h3>
          {stats.topModels.length === 0 ? (
            <p className="text-xs text-muted-foreground">Sem dados.</p>
          ) : (
            <div className="space-y-1">
              {stats.topModels.map(([name, data], i) => (
                <div key={name} className="flex items-center justify-between text-sm py-2 px-2 border-b border-border/50 last:border-0 hover:bg-muted/30 rounded-lg transition-colors">
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

        <Card className="border-border/60 bg-card p-5 shadow-md rounded-xl">
          <h3 className="font-heading text-sm font-semibold text-card-foreground mb-3 flex items-center gap-2">
            <div className="icon-bubble icon-bubble--warning" style={{ height: '28px', width: '28px' }}>
              <Trophy className="h-3.5 w-3.5" />
            </div>
            Ranking por Cliente
          </h3>
          {stats.topClients.length === 0 ? (
            <p className="text-xs text-muted-foreground">Sem dados.</p>
          ) : (
            <div className="space-y-1">
              {stats.topClients.map(([name, data], i) => (
                <div key={name} className="flex items-center justify-between text-sm py-2 px-2 border-b border-border/50 last:border-0 hover:bg-muted/30 rounded-lg transition-colors">
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
      {deals.filter(d => d.status === "closed").length > 0 && (
        <Card className="border-border/60 bg-card p-6 shadow-md rounded-xl">
          <h3 className="font-heading text-base font-semibold text-card-foreground mb-4 flex items-center gap-2">
            <div className="icon-bubble icon-bubble--accent" style={{ height: '28px', width: '28px' }}>
              <Lock className="h-3.5 w-3.5" />
            </div>
            Últimas Vendas Fechadas
          </h3>
          <div className="space-y-1">
            {deals
              .filter(d => d.status === "closed")
              .slice(0, 5)
              .map(d => (
                <div key={d.id} className="flex items-center justify-between text-sm py-2.5 px-2 border-b border-border/50 last:border-0 hover:bg-muted/30 rounded-lg transition-colors">
                  <div>
                    <span className="font-medium">{d.client_name}</span>
                    {d.machine_name && <span className="text-muted-foreground ml-2">— {d.machine_name}</span>}
                    {d.machine_type && <Badge variant="outline" className="text-[10px] h-4 ml-2">{d.machine_type}</Badge>}
                  </div>
                  <div className="flex items-center gap-4 text-xs">
                    <span className="font-medium">{formatUsd(d.final_price)}</span>
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

/* --- Sub-components --- */

const VARIANT_CLASSES: Record<string, string> = {
  primary: "kpi-card--primary",
  accent: "kpi-card--accent",
  warning: "kpi-card--warning",
  info: "kpi-card--info",
  destructive: "kpi-card--destructive",
};

const ICON_BUBBLE_CLASSES: Record<string, string> = {
  primary: "icon-bubble--primary",
  accent: "icon-bubble--accent",
  warning: "icon-bubble--warning",
  info: "icon-bubble--info",
  destructive: "icon-bubble--destructive",
};

const KpiCard = ({ icon, label, value, sub, highlight, accent, variant = "primary", delta, deltaLabel, isPercent }: {
  icon: React.ReactNode; label: string; value: string; sub?: string; highlight?: boolean; accent?: boolean; variant?: string;
  delta?: number; deltaLabel?: string; isPercent?: boolean;
}) => {
  const hasDelta = delta !== undefined && delta !== 0;
  const isPositive = (delta ?? 0) > 0;

  return (
    <div className={`kpi-card ${VARIANT_CLASSES[variant] || "kpi-card--primary"} ${highlight ? "ring-1 ring-primary/20" : ""} animate-fade-in`}>
      <div className="flex items-center gap-2.5 mb-2">
        <div className={`icon-bubble ${ICON_BUBBLE_CLASSES[variant] || "icon-bubble--primary"}`} style={{ height: '32px', width: '32px' }}>
          {icon}
        </div>
        <span className="text-xs font-medium text-muted-foreground leading-tight">{label}</span>
      </div>
      <p className={`font-heading text-2xl font-bold tracking-tight ${accent ? "text-destructive" : "text-foreground"}`}>{value}</p>
      <div className="flex items-center gap-2 mt-1.5">
        {hasDelta && (
          <span className={`inline-flex items-center gap-0.5 text-[11px] font-semibold rounded-full px-1.5 py-0.5 ${
            isPositive ? "text-accent bg-accent/10" : "text-destructive bg-destructive/10"
          }`}>
            {isPositive ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
            {isPercent ? formatDelta(delta!) : (delta! > 0 ? `+${delta}` : delta)}{deltaLabel ? ` ${deltaLabel}` : ""}
          </span>
        )}
        {!hasDelta && delta === 0 && deltaLabel && (
          <span className="inline-flex items-center gap-0.5 text-[11px] font-medium text-muted-foreground">
            <Minus className="h-3 w-3" /> {deltaLabel}
          </span>
        )}
        {sub && <p className="text-[11px] text-muted-foreground">{sub}</p>}
      </div>
    </div>
  );
};

const formatDelta = (v: number) => {
  const abs = Math.abs(v);
  return (v > 0 ? "+" : "-") + abs.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
};

const FunnelStep = ({ label, value, max, color }: { label: string; value: number; max: number; color: string }) => {
  const pct = max > 0 ? (value / max) * 100 : 0;
  return (
    <div>
      <div className="flex justify-between text-xs mb-1">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-semibold text-foreground">{value}</span>
      </div>
      <div className="h-2 rounded-full bg-muted overflow-hidden">
        <div className={`h-full rounded-full ${color} transition-all duration-500`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
};

export default ExecutiveDashboard;
