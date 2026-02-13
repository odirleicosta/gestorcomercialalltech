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

  // Totals for meta do mês
  const totalMetaQtd = repRanking.reduce((s, r) => s + r.metaQtd, 0);
  const totalSold = cur.count;
  const pctAtingido = totalMetaQtd > 0 ? (totalSold / totalMetaQtd) * 100 : 0;
  const faltam = Math.max(0, totalMetaQtd - totalSold);

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Header + Filters */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h2 className="font-heading text-2xl font-bold text-foreground">Dashboard</h2>
          <p className="text-sm text-muted-foreground mt-0.5">{MONTHS[filterMonth - 1]} {filterYear}</p>
        </div>
        <div className="flex flex-wrap gap-2 items-center">
          <Select value={String(filterMonth)} onValueChange={v => setFilterMonth(parseInt(v))}>
            <SelectTrigger className="w-[130px] bg-card border-border text-sm h-9"><SelectValue /></SelectTrigger>
            <SelectContent>
              {MONTHS.map((m, i) => <SelectItem key={i} value={String(i + 1)}>{m}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={String(filterYear)} onValueChange={v => setFilterYear(parseInt(v))}>
            <SelectTrigger className="w-[90px] bg-card border-border text-sm h-9"><SelectValue /></SelectTrigger>
            <SelectContent>
              {[2024, 2025, 2026, 2027].map(y => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={filterRep} onValueChange={setFilterRep}>
            <SelectTrigger className="w-[160px] bg-card border-border text-sm h-9"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              {reps.map(r => <SelectItem key={r.id} value={r.id}>{r.nome}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Goal Alerts */}
      {goalAlerts.length > 0 && (
        <div className="bg-warning/5 border border-warning/20 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle className="h-4 w-4 text-warning" />
            <span className="text-sm font-semibold text-foreground">Alertas de Metas</span>
          </div>
          <div className="space-y-1">
            {goalAlerts.map((a, i) => (
              <p key={i} className="text-xs text-muted-foreground">{a}</p>
            ))}
          </div>
        </div>
      )}

      {/* ─── BLOCO 1: META DO MÊS ─── */}
      <section>
        <SectionTitle icon={<Target className="h-4 w-4" />} title="Meta do Mês" />
        <div className="grid gap-4 grid-cols-2 md:grid-cols-4">
          <CleanCard label="Meta" value={String(totalMetaQtd)} sub="máquinas" color="text-info" />
          <CleanCard label="Vendidas" value={String(totalSold)} sub="fechadas" color="text-accent" />
          <CleanCard label="% Atingido" value={formatPct(pctAtingido)} color={pctAtingido >= 100 ? "text-accent" : pctAtingido >= 75 ? "text-warning" : "text-destructive"} />
          <CleanCard label="Faltam" value={String(faltam)} sub="para bater" color={faltam === 0 ? "text-accent" : "text-muted-foreground"} />
        </div>
      </section>

      {/* ─── BLOCO 2: RENTABILIDADE ─── */}
      <section>
        <SectionTitle icon={<DollarSign className="h-4 w-4" />} title="Rentabilidade" />
        <div className="grid gap-4 grid-cols-1 md:grid-cols-3">
          <CleanCard label="Margem Bruta" value={formatPct(cur.avgGrossMargin)} sub={`${cur.avgGrossMargin >= prev.avgGrossMargin ? "↑" : "↓"} vs mês anterior`} color={cur.avgGrossMargin >= 20 ? "text-accent" : cur.avgGrossMargin >= 10 ? "text-warning" : "text-destructive"} />
          <CleanCard label="Margem Líquida" value={formatPct(cur.avgNetMargin)} sub={`${cur.avgNetMargin >= prev.avgNetMargin ? "↑" : "↓"} vs mês anterior`} color={cur.avgNetMargin >= 15 ? "text-accent" : cur.avgNetMargin >= 5 ? "text-warning" : "text-destructive"} />
          <CleanCard label="Lucro Líquido" value={formatCompact(cur.netProfit)} sub={`Faturamento: ${formatCompact(cur.revenue)}`} color={cur.netProfit >= 0 ? "text-accent" : "text-destructive"} />
        </div>
      </section>

      {/* ─── BLOCO 3: EXECUÇÃO SEMANAL (placeholder — dados de visita futuros) ─── */}
      <section>
        <SectionTitle icon={<Calendar className="h-4 w-4" />} title="Execução Semanal" />
        <div className="grid gap-4 grid-cols-1 md:grid-cols-3">
          <CleanCard label="Visitas Semana" value="—" sub="em breve" color="text-muted-foreground" />
          <CleanCard label="Meta" value="16" sub="visitas/rep" color="text-info" />
          <CleanCard label="% Atingido" value="—" sub="em breve" color="text-muted-foreground" />
        </div>
      </section>

      {/* ─── BLOCO 4: PIPELINE ─── */}
      <section>
        <SectionTitle icon={<BarChart3 className="h-4 w-4" />} title="Pipeline" />
        <Card className="bg-card border-border/50 shadow-sm rounded-lg p-6">
          <div className="space-y-5">
            <PipelineBar label="Negociações" value={funnelData.total} max={funnelData.total} color="bg-info" />
            <PipelineBar label="Em Andamento" value={funnelData.open} max={funnelData.total} color="bg-warning" />
            <PipelineBar label="Fechadas" value={funnelData.closed} max={funnelData.total} color="bg-accent" />
          </div>
          {funnelData.total > 0 && (
            <div className="flex justify-between text-sm mt-6 pt-4 border-t border-border/50">
              <span className="text-muted-foreground">Taxa de Conversão</span>
              <span className="font-bold text-foreground">{formatPct((funnelData.closed / funnelData.total) * 100)}</span>
            </div>
          )}
        </Card>
      </section>

      {/* ─── EVOLUÇÃO ─── */}
      <section>
        <SectionTitle icon={<TrendingUp className="h-4 w-4" />} title="Evolução (6 meses)" />
        <Card className="bg-card border-border/50 shadow-sm rounded-lg p-6">
          <ResponsiveContainer width="100%" height={240}>
            <AreaChart data={evolutionData}>
              <defs>
                <linearGradient id="gradFat" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.15} />
                  <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="gradLucro" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(var(--accent))" stopOpacity={0.15} />
                  <stop offset="95%" stopColor="hsl(var(--accent))" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="name" tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }} />
              <YAxis tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} />
              <Tooltip formatter={(v: number) => formatUsd(v)} contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid hsl(var(--border))' }} />
              <Area type="monotone" dataKey="Faturamento" stroke="hsl(var(--primary))" fill="url(#gradFat)" strokeWidth={2} />
              <Area type="monotone" dataKey="Lucro Líquido" stroke="hsl(var(--accent))" fill="url(#gradLucro)" strokeWidth={2} />
              <RechartLegend wrapperStyle={{ fontSize: 12 }} />
            </AreaChart>
          </ResponsiveContainer>
        </Card>
      </section>

      {/* ─── RANKING REPRESENTANTES ─── */}
      {repRanking.length > 0 && (
        <section>
          <SectionTitle icon={<Medal className="h-4 w-4" />} title="Ranking de Representantes" />
          <Card className="bg-card border-border/50 shadow-sm rounded-lg p-6">
            <div className="space-y-3">
              {repRanking.map((rep, i) => (
                <div key={rep.id} className="flex items-center justify-between py-3 px-3 rounded-lg hover:bg-muted/30 transition-colors">
                  <div className="flex items-center gap-3">
                    <span className="text-lg w-8">
                      {i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `${i + 1}º`}
                    </span>
                    <div>
                      <span className="font-medium text-sm text-foreground">{rep.nome}</span>
                      <p className="text-xs text-muted-foreground">{rep.count} vendas • {formatCompact(rep.revenue)}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    {rep.metaQtd > 0 && (
                      <div className="text-right">
                        <p className={`text-sm font-semibold ${rep.pctQtd >= 100 ? "text-accent" : rep.pctQtd >= 75 ? "text-warning" : "text-destructive"}`}>
                          {formatPct(rep.pctQtd)}
                        </p>
                        <p className="text-[10px] text-muted-foreground">{rep.count}/{rep.metaQtd} qtd</p>
                      </div>
                    )}
                    {rep.metaVal > 0 && (
                      <div className="w-20">
                        <Progress value={Math.min(rep.pctVal, 100)} className="h-1.5" />
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </section>
      )}
    </div>
  );
};

/* --- Sub-components --- */

const SectionTitle = ({ icon, title }: { icon: React.ReactNode; title: string }) => (
  <div className="flex items-center gap-2 mb-3">
    <div className="text-muted-foreground">{icon}</div>
    <h3 className="font-heading text-sm font-semibold text-foreground uppercase tracking-wide">{title}</h3>
  </div>
);

const CleanCard = ({ label, value, sub, color = "text-foreground" }: {
  label: string; value: string; sub?: string; color?: string;
}) => (
  <Card className="bg-card border-border/50 shadow-sm rounded-lg p-5">
    <p className="text-xs font-medium text-muted-foreground mb-1">{label}</p>
    <p className={`font-heading text-2xl font-bold ${color}`}>{value}</p>
    {sub && <p className="text-xs text-muted-foreground mt-1">{sub}</p>}
  </Card>
);

const PipelineBar = ({ label, value, max, color }: { label: string; value: number; max: number; color: string }) => {
  const pct = max > 0 ? (value / max) * 100 : 0;
  return (
    <div>
      <div className="flex justify-between text-sm mb-2">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-semibold text-foreground">{value}</span>
      </div>
      <div className="h-2.5 rounded-full bg-muted overflow-hidden">
        <div className={`h-full rounded-full ${color} transition-all duration-500`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
};

export default ExecutiveDashboard;
