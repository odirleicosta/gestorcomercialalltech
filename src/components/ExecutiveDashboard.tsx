import { useState, useMemo, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  TrendingUp, TrendingDown, DollarSign, Target, BarChart3, Users,
  AlertTriangle, ArrowUpRight, ArrowDownRight, Gauge, CheckCircle2, XCircle,
} from "lucide-react";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  Legend as RechartLegend,
} from "recharts";
import { supabase } from "@/integrations/supabase/client";
import type { Deal } from "@/components/DealManager";

interface Props { userId: string; }
interface RepOption { id: string; nome: string; }
interface RepWithGoals extends RepOption {
  meta_mensal_padrao: number;
  meta_quantidade: number;
}
interface MonthlyGoal {
  representative_id: string;
  meta_quantidade: number;
  meta_valor: number;
  machine_type: string;
}

const MONTHS = ["Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];

const ExecutiveDashboard = ({ userId }: Props) => {
  const [deals, setDeals] = useState<Deal[]>([]);
  const [reps, setReps] = useState<RepOption[]>([]);
  const [repsWithGoals, setRepsWithGoals] = useState<RepWithGoals[]>([]);
  const [monthlyGoals, setMonthlyGoals] = useState<MonthlyGoal[]>([]);
  const [loading, setLoading] = useState(true);
  const now = new Date();
  const [filterMonth, setFilterMonth] = useState(now.getMonth() + 1);
  const [filterYear, setFilterYear] = useState(now.getFullYear());
  const [filterRep, setFilterRep] = useState("all");

  useEffect(() => {
    const fetchData = async () => {
      const [dealsRes, repsRes, goalsRes] = await Promise.all([
        supabase.from("deals" as any).select("*").order("created_at", { ascending: false }),
        supabase.from("representatives" as any).select("id, nome, meta_mensal_padrao, meta_quantidade").eq("status", "ATIVO").order("nome"),
        supabase.from("monthly_goals" as any).select("representative_id, meta_quantidade, meta_valor, machine_type"),
      ]);
      if (dealsRes.data) setDeals(dealsRes.data as unknown as Deal[]);
      if (repsRes.data) {
        const r = repsRes.data as unknown as RepWithGoals[];
        setReps(r.map(x => ({ id: x.id, nome: x.nome })));
        setRepsWithGoals(r);
      }
      if (goalsRes.data) setMonthlyGoals(goalsRes.data as unknown as MonthlyGoal[]);
      setLoading(false);
    };
    fetchData();
  }, []);

  // Fetch monthly goals when month/year changes
  useEffect(() => {
    const fetchGoals = async () => {
      const res = await supabase
        .from("monthly_goals" as any)
        .select("representative_id, meta_quantidade, meta_valor, machine_type")
        .eq("mes", filterMonth)
        .eq("ano", filterYear);
      if (res.data) setMonthlyGoals(res.data as unknown as MonthlyGoal[]);
    };
    fetchGoals();
  }, [filterMonth, filterYear]);

  const getMonthClosed = (month: number, year: number, repFilter = "all") => {
    return deals.filter(d => {
      if (d.status !== "closed" || !d.closed_at) return false;
      const dt = new Date(d.closed_at);
      const matchMonth = (dt.getMonth() + 1) === month && dt.getFullYear() === year;
      const matchRep = repFilter === "all" || d.representative_id === repFilter;
      return matchMonth && matchRep;
    });
  };

  // Get meta for a rep: use monthly_goals if exists, fallback to rep default
  const getRepMeta = (repId: string) => {
    const goals = monthlyGoals.filter(g => g.representative_id === repId);
    if (goals.length > 0) {
      return {
        metaQtd: goals.reduce((s, g) => s + g.meta_quantidade, 0),
        metaVal: goals.reduce((s, g) => s + g.meta_valor, 0),
      };
    }
    const rep = repsWithGoals.find(r => r.id === repId);
    return {
      metaQtd: rep?.meta_quantidade || 0,
      metaVal: rep?.meta_mensal_padrao || 0,
    };
  };

  const prevMonthNum = filterMonth === 1 ? 12 : filterMonth - 1;
  const prevYearNum = filterMonth === 1 ? filterYear - 1 : filterYear;

  const monthStats = useMemo(() => {
    const current = getMonthClosed(filterMonth, filterYear, filterRep);
    const previous = getMonthClosed(prevMonthNum, prevYearNum, filterRep);
    const calc = (arr: Deal[]) => ({
      count: arr.length,
      revenue: arr.reduce((s, d) => s + d.final_price, 0),
      netProfit: arr.reduce((s, d) => s + d.net_profit, 0),
      fobTotal: arr.reduce((s, d) => s + d.fob_cost, 0),
    });
    return { current: calc(current), previous: calc(previous), currentDeals: current };
  }, [deals, filterMonth, filterYear, filterRep]);

  // Rep ranking for the month
  const repRanking = useMemo(() => {
    if (repsWithGoals.length === 0) return [];
    return repsWithGoals.map(rep => {
      const repDeals = getMonthClosed(filterMonth, filterYear, rep.id);
      const revenue = repDeals.reduce((s, d) => s + d.final_price, 0);
      const fobTotal = repDeals.reduce((s, d) => s + d.fob_cost, 0);
      const count = repDeals.length;
      const { metaQtd, metaVal } = getRepMeta(rep.id);
      const pctQtd = metaQtd > 0 ? (count / metaQtd) * 100 : 0;
      return { ...rep, revenue, fobTotal, count, pctQtd, metaQtd, metaVal };
    }).filter(r => r.count > 0 || r.metaQtd > 0)
      .sort((a, b) => b.count - a.count);
  }, [repsWithGoals, deals, filterMonth, filterYear, monthlyGoals]);

  // Pipeline data
  const pipelineData = useMemo(() => {
    const openDeals = deals.filter(d => {
      if (d.status !== "open") return false;
      const matchRep = filterRep === "all" || d.representative_id === filterRep;
      return matchRep;
    });
    const totalOpen = openDeals.length;
    const totalValue = openDeals.reduce((s, d) => s + d.final_price, 0);
    const weightedForecast = openDeals.reduce((s, d) => s + d.final_price * 0.5, 0);
    return { totalOpen, totalValue, weightedForecast };
  }, [deals, filterRep]);

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

  // Goal alerts
  const goalAlerts = useMemo(() => {
    const alerts: string[] = [];
    const dayOfMonth = now.getDate();
    const daysInMonth = new Date(filterYear, filterMonth, 0).getDate();
    const progressPct = (dayOfMonth / daysInMonth) * 100;

    repRanking.forEach(rep => {
      if (rep.metaQtd > 0 && rep.pctQtd < progressPct * 0.8) {
        alerts.push(`⚠️ ${rep.nome}: ${rep.pctQtd.toFixed(0)}% da meta (${rep.count}/${rep.metaQtd})`);
      }
    });
    return alerts;
  }, [repRanking, filterMonth, filterYear]);

  // Historical weekly average (last 3 months closed deals / ~12 weeks)
  const historicalAvg = useMemo(() => {
    let totalClosed = 0;
    for (let i = 1; i <= 3; i++) {
      let m = filterMonth - i;
      let y = filterYear;
      while (m <= 0) { m += 12; y--; }
      totalClosed += getMonthClosed(m, y, filterRep).length;
    }
    return totalClosed / 12;
  }, [deals, filterMonth, filterYear, filterRep]);

  const formatUsd = (v: number) =>
    `US$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const formatPct = (v: number) =>
    v.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + "%";
  const formatCompact = (v: number) =>
    v >= 1000 ? `US$ ${(v / 1000).toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}k` : formatUsd(v);

  if (loading) return <p className="text-muted-foreground text-center py-8">Carregando...</p>;

  const { current: cur, previous: prev } = monthStats;

  const totalMetaQtd = repRanking.reduce((s, r) => s + r.metaQtd, 0);
  const totalSold = cur.count;
  const pctAtingido = totalMetaQtd > 0 ? (totalSold / totalMetaQtd) * 100 : 0;
  const faltam = Math.max(0, totalMetaQtd - totalSold);

  const calcVariation = (current: number, previous: number) => {
    if (previous === 0) return current > 0 ? 100 : 0;
    return ((current - previous) / previous) * 100;
  };

  const vendasVar = calcVariation(cur.count, prev.count);
  const fobVar = calcVariation(cur.fobTotal, prev.fobTotal);
  const cifVar = calcVariation(cur.revenue, prev.revenue);
  const prevMetaPct = prev.count > 0 && totalMetaQtd > 0 ? (prev.count / totalMetaQtd) * 100 : 0;
  const metaVar = calcVariation(pctAtingido, prevMetaPct);

  // Pace calculation
  const daysInMonth = new Date(filterYear, filterMonth, 0).getDate();
  const isCurrentMonth = filterMonth === (now.getMonth() + 1) && filterYear === now.getFullYear();
  const dayOfMonth = isCurrentMonth ? now.getDate() : daysInMonth;
  const diasRestantes = Math.max(0, daysInMonth - dayOfMonth);
  const semanasPassadas = Math.max(1, dayOfMonth / 7);
  const semanasRestantes = Math.max(0.1, diasRestantes / 7);
  const ritmoAtual = totalSold / semanasPassadas;
  const ritmoNecessario = diasRestantes > 0 ? faltam / semanasRestantes : 0;
  const ritmoDiario = diasRestantes > 0 ? faltam / diasRestantes : 0;
  const noRitmo = faltam <= 0 || ritmoAtual >= ritmoNecessario;

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Header + Filters */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h2 className="font-heading text-2xl font-bold text-foreground">Dashboard Comercial</h2>
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

      {/* ─── BLOCO 1: META GLOBAL DO MÊS ─── */}
      <section>
        <SectionTitle icon={<Target className="h-4 w-4" />} title="Meta Global do Mês" />
        <div className="grid gap-4 grid-cols-2 md:grid-cols-4">
          <CleanCard label="Meta" value={String(totalMetaQtd)} sub="máquinas" color="text-info" />
          <CleanCard label="Vendidas" value={String(totalSold)} sub="fechadas" color="text-accent" variation={vendasVar} />
          <CleanCard label="% Atingido" value={formatPct(pctAtingido)} color={pctAtingido >= 100 ? "text-accent" : pctAtingido >= 75 ? "text-warning" : "text-destructive"} variation={metaVar} />
          <CleanCard label="Faltam" value={String(faltam)} sub="para bater" color={faltam === 0 ? "text-accent" : "text-muted-foreground"} />
        </div>
      </section>

      {/* ─── RITMO COMERCIAL ─── */}
      {totalMetaQtd > 0 && diasRestantes > 0 && (
        <section>
          <SectionTitle icon={<Gauge className="h-4 w-4" />} title="Ritmo Comercial" />
          <div className="grid gap-4 grid-cols-2 md:grid-cols-3">
            <CleanCard label="Ritmo Atual" value={`${ritmoAtual.toFixed(1)}/sem`} sub={`${totalSold} em ${semanasPassadas.toFixed(1)} semanas`} color="text-info" />
            <CleanCard label="Ritmo Necessário" value={`${ritmoNecessario.toFixed(1)}/sem`} sub={`${faltam} em ${semanasRestantes.toFixed(1)} semanas`} color={noRitmo ? "text-accent" : "text-destructive"} />
            <Card className={`border-border/50 shadow-sm rounded-lg p-5 ${noRitmo ? "bg-accent/5 border-accent/20" : "bg-destructive/5 border-destructive/20"}`}>
              <p className="text-xs font-medium text-muted-foreground mb-1">Status</p>
              <div className="flex items-center gap-2">
                {noRitmo
                  ? <CheckCircle2 className="h-5 w-5 text-accent" />
                  : <XCircle className="h-5 w-5 text-destructive" />
                }
                <p className={`font-heading text-sm font-bold ${noRitmo ? "text-accent" : "text-destructive"}`}>
                  {faltam <= 0 ? "Meta batida! 🎉" : noRitmo ? "No ritmo para bater meta" : "Abaixo do ritmo necessário"}
                </p>
              </div>
              {!noRitmo && <p className="text-xs text-muted-foreground mt-1">Necessário {ritmoDiario.toFixed(1)} vendas/dia</p>}
            </Card>
          </div>
        </section>
      )}

      {repRanking.length > 0 && (
        <section>
          <SectionTitle icon={<Users className="h-4 w-4" />} title="Performance por Representante" />
          <Card className="bg-card border-border/50 shadow-sm rounded-lg overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border/50">
                    <th className="text-left py-3 px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Representante</th>
                    <th className="text-center py-3 px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Meta</th>
                    <th className="text-center py-3 px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Vendidas</th>
                    <th className="text-right py-3 px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wide">FOB</th>
                    <th className="text-right py-3 px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wide">CIF</th>
                    <th className="text-center py-3 px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wide">%</th>
                  </tr>
                </thead>
                <tbody>
                  {repRanking.map((rep, i) => (
                    <tr key={rep.id} className="border-b border-border/30 last:border-b-0 hover:bg-muted/30 transition-colors">
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          <span className="text-sm">{i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `${i + 1}º`}</span>
                          <span className="font-medium text-foreground">{rep.nome}</span>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-center text-muted-foreground">{rep.metaQtd}</td>
                      <td className="py-3 px-4 text-center font-semibold text-foreground">{rep.count}</td>
                      <td className="py-3 px-4 text-right text-muted-foreground">{formatCompact(rep.fobTotal)}</td>
                      <td className="py-3 px-4 text-right font-medium text-foreground">{formatCompact(rep.revenue)}</td>
                      <td className="py-3 px-4 text-center">
                        <span className={`text-sm font-semibold ${rep.pctQtd >= 100 ? "text-accent" : rep.pctQtd >= 75 ? "text-warning" : "text-destructive"}`}>
                          {rep.metaQtd > 0 ? formatPct(rep.pctQtd) : "—"}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </section>
      )}

      {/* ─── BLOCO 3: FATURAMENTO DO MÊS ─── */}
      <section>
        <SectionTitle icon={<DollarSign className="h-4 w-4" />} title="Faturamento do Mês" />
        <div className="grid gap-4 grid-cols-1 md:grid-cols-2">
          <CleanCard label="FOB Total" value={formatCompact(cur.fobTotal)} sub={`${cur.count} negociações fechadas`} color="text-info" variation={fobVar} />
          <CleanCard label="CIF Total" value={formatCompact(cur.revenue)} sub={`Lucro Líq: ${formatCompact(cur.netProfit)}`} color="text-accent" variation={cifVar} />
        </div>
      </section>

      {/* ─── BLOCO 4: PIPELINE ─── */}
      <section>
        <SectionTitle icon={<BarChart3 className="h-4 w-4" />} title="Pipeline" />
        <div className="grid gap-4 grid-cols-1 md:grid-cols-3">
          <CleanCard label="Em Negociação" value={String(pipelineData.totalOpen)} sub="negociações abertas" color="text-warning" />
          <CleanCard label="Valor Total" value={formatCompact(pipelineData.totalValue)} sub="em aberto" color="text-info" />
          <CleanCard label="Previsão Ponderada" value={formatCompact(pipelineData.weightedForecast)} sub="50% do valor aberto" color="text-accent" />
        </div>
      </section>

      {/* ─── EVOLUÇÃO 6 MESES ─── */}
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

const CleanCard = ({ label, value, sub, color = "text-foreground", variation }: {
  label: string; value: string; sub?: string; color?: string; variation?: number;
}) => (
  <Card className="bg-card border-border/50 shadow-sm rounded-lg p-5">
    <p className="text-xs font-medium text-muted-foreground mb-1">{label}</p>
    <div className="flex items-end gap-2">
      <p className={`font-heading text-2xl font-bold ${color}`}>{value}</p>
      {variation !== undefined && variation !== 0 && (
        <span className={`flex items-center gap-0.5 text-xs font-semibold mb-1 ${variation > 0 ? "text-accent" : "text-destructive"}`}>
          {variation > 0 ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
          {variation > 0 ? "+" : ""}{variation.toFixed(0)}%
        </span>
      )}
    </div>
    {sub && <p className="text-xs text-muted-foreground mt-1">{sub}</p>}
  </Card>
);

export default ExecutiveDashboard;
