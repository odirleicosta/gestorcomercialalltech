import { useState, useMemo, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  TrendingUp, TrendingDown, DollarSign, Target, BarChart3, Users,
  AlertTriangle, ArrowUpRight, ArrowDownRight, Gauge, CheckCircle2, XCircle,
  Flame, Trophy, Zap, AlertCircle,
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
  mes: number;
}

const MONTHS = ["Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];
const SHORT_MONTHS = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];
const QUARTERS = [
  { label: "T1", months: [1, 2, 3] },
  { label: "T2", months: [4, 5, 6] },
  { label: "T3", months: [7, 8, 9] },
  { label: "T4", months: [10, 11, 12] },
];

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
  const [filterMode, setFilterMode] = useState<"month" | "quarter" | "year">("month");
  const [filterQuarter, setFilterQuarter] = useState<number | null>(null);

  const activeMonths = useMemo(() => {
    if (filterMode === "year") return [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
    if (filterMode === "quarter" && filterQuarter !== null) return QUARTERS[filterQuarter].months;
    return [filterMonth];
  }, [filterMode, filterMonth, filterQuarter]);

  const periodLabel = useMemo(() => {
    if (filterMode === "year") return `${filterYear} — Ano Completo`;
    if (filterMode === "quarter" && filterQuarter !== null)
      return `${QUARTERS[filterQuarter].label} ${filterYear} (${SHORT_MONTHS[QUARTERS[filterQuarter].months[0] - 1]}–${SHORT_MONTHS[QUARTERS[filterQuarter].months[2] - 1]})`;
    return `${MONTHS[filterMonth - 1]} ${filterYear}`;
  }, [filterMode, filterMonth, filterYear, filterQuarter]);

  useEffect(() => {
    const fetchData = async () => {
      const [dealsRes, repsRes, goalsRes] = await Promise.all([
        supabase.from("deals" as any).select("*").order("created_at", { ascending: false }),
        supabase.from("representatives" as any).select("id, nome, meta_mensal_padrao, meta_quantidade").eq("status", "ATIVO").order("nome"),
        supabase.from("monthly_goals" as any).select("representative_id, meta_quantidade, meta_valor, machine_type, mes").eq("ano", filterYear),
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

  // Fetch monthly goals when year changes
  useEffect(() => {
    const fetchGoals = async () => {
      const res = await supabase
        .from("monthly_goals" as any)
        .select("representative_id, meta_quantidade, meta_valor, machine_type, mes")
        .eq("ano", filterYear);
      if (res.data) setMonthlyGoals(res.data as unknown as MonthlyGoal[]);
    };
    fetchGoals();
  }, [filterYear]);

  const getMonthClosed = (month: number, year: number, repFilter = "all") => {
    return deals.filter(d => {
      if (d.status !== "closed" || !d.closed_at) return false;
      const dt = new Date(d.closed_at);
      const matchMonth = (dt.getMonth() + 1) === month && dt.getFullYear() === year;
      const matchRep = repFilter === "all" || d.representative_id === repFilter;
      return matchMonth && matchRep;
    });
  };

  const getMultiMonthClosed = (months: number[], year: number, repFilter = "all") => {
    return deals.filter(d => {
      if (d.status !== "closed" || !d.closed_at) return false;
      const dt = new Date(d.closed_at);
      const m = dt.getMonth() + 1;
      return months.includes(m) && dt.getFullYear() === year && (repFilter === "all" || d.representative_id === repFilter);
    });
  };

  // Get meta for a rep across active months
  const getRepMeta = (repId: string) => {
    const goals = monthlyGoals.filter(g => g.representative_id === repId && activeMonths.includes(g.mes));
    if (goals.length > 0) {
      return {
        metaQtd: goals.reduce((s, g) => s + g.meta_quantidade, 0),
        metaVal: goals.reduce((s, g) => s + g.meta_valor, 0),
      };
    }
    const rep = repsWithGoals.find(r => r.id === repId);
    const monthCount = activeMonths.length;
    return {
      metaQtd: (rep?.meta_quantidade || 0) * monthCount,
      metaVal: (rep?.meta_mensal_padrao || 0) * monthCount,
    };
  };

  // Previous period for comparison
  const getPrevPeriodClosed = (repFilter = "all") => {
    if (filterMode === "year") {
      return getMultiMonthClosed([1,2,3,4,5,6,7,8,9,10,11,12], filterYear - 1, repFilter);
    }
    if (filterMode === "quarter" && filterQuarter !== null) {
      if (filterQuarter === 0) {
        return getMultiMonthClosed(QUARTERS[3].months, filterYear - 1, repFilter);
      }
      return getMultiMonthClosed(QUARTERS[filterQuarter - 1].months, filterYear, repFilter);
    }
    const prevM = filterMonth === 1 ? 12 : filterMonth - 1;
    const prevY = filterMonth === 1 ? filterYear - 1 : filterYear;
    return getMonthClosed(prevM, prevY, repFilter);
  };

  const monthStats = useMemo(() => {
    const current = getMultiMonthClosed(activeMonths, filterYear, filterRep);
    const previous = getPrevPeriodClosed(filterRep);
    const calc = (arr: Deal[]) => ({
      count: arr.length,
      revenue: arr.reduce((s, d) => s + d.final_price, 0),
      netProfit: arr.reduce((s, d) => s + d.net_profit, 0),
      fobTotal: arr.reduce((s, d) => s + d.fob_cost, 0),
    });
    return { current: calc(current), previous: calc(previous), currentDeals: current };
  }, [deals, activeMonths, filterYear, filterRep, monthlyGoals]);

  // Rep ranking
  const repRanking = useMemo(() => {
    if (repsWithGoals.length === 0) return [];
    return repsWithGoals.map(rep => {
      const repDeals = getMultiMonthClosed(activeMonths, filterYear, rep.id);
      const revenue = repDeals.reduce((s, d) => s + d.final_price, 0);
      const fobTotal = repDeals.reduce((s, d) => s + d.fob_cost, 0);
      const count = repDeals.length;
      const { metaQtd, metaVal } = getRepMeta(rep.id);
      const pctQtd = metaQtd > 0 ? (count / metaQtd) * 100 : 0;
      return { ...rep, revenue, fobTotal, count, pctQtd, metaQtd, metaVal };
    }).filter(r => r.count > 0 || r.metaQtd > 0)
      .sort((a, b) => b.count - a.count);
  }, [repsWithGoals, deals, activeMonths, filterYear, monthlyGoals]);

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

  // Monthly evolution (last 6 months from the last active month)
  const evolutionData = useMemo(() => {
    const lastActiveMonth = activeMonths[activeMonths.length - 1];
    const data: { name: string; Faturamento: number; "Lucro Líquido": number; Vendas: number }[] = [];
    for (let i = 5; i >= 0; i--) {
      let m = lastActiveMonth - i;
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
  }, [deals, activeMonths, filterYear, filterRep]);



  // Historical weekly average (last 3 months)
  const historicalAvg = useMemo(() => {
    const lastActiveMonth = activeMonths[activeMonths.length - 1];
    let totalClosed = 0;
    for (let i = 1; i <= 3; i++) {
      let m = lastActiveMonth - i;
      let y = filterYear;
      while (m <= 0) { m += 12; y--; }
      totalClosed += getMonthClosed(m, y, filterRep).length;
    }
    return totalClosed / 12;
  }, [deals, activeMonths, filterYear, filterRep]);

  const formatUsd = (v: number) =>
    `US$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const formatPct = (v: number) =>
    v.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + "%";
  const formatCompact = (v: number) =>
    v >= 1000 ? `US$ ${(v / 1000).toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}k` : formatUsd(v);

  // Pace calculation — compute total days across active months (must be before early return)
  const isCurrentYear = filterYear === now.getFullYear();
  const currentMonthNum = now.getMonth() + 1;

  const { totalDaysPeriod, elapsedDays } = useMemo(() => {
    let total = 0;
    let elapsed = 0;
    for (const m of activeMonths) {
      const daysInM = new Date(filterYear, m, 0).getDate();
      total += daysInM;
      if (isCurrentYear) {
        if (m < currentMonthNum) elapsed += daysInM;
        else if (m === currentMonthNum) elapsed += Math.min(now.getDate(), daysInM);
      } else if (filterYear < now.getFullYear()) {
        elapsed += daysInM;
      }
    }
    return { totalDaysPeriod: total, elapsedDays: elapsed };
  }, [activeMonths, filterYear, isCurrentYear, currentMonthNum]);

  // Commission totals for faturamento block
  const commissionTotal = useMemo(() => {
    const current = getMultiMonthClosed(activeMonths, filterYear, filterRep);
    return current.reduce((s, d) => s + d.seller_commission_value + d.manager_commission_value, 0);
  }, [deals, activeMonths, filterYear, filterRep]);

  // Smart alerts (pre-computed, used in render)
  const smartAlertsMemo = useMemo(() => {
    const alerts: string[] = [];
    if (filterMode !== "month") return alerts;
    const dayOfMonth = now.getDate();
    const daysInMonth = new Date(filterYear, filterMonth, 0).getDate();
    const progressPct = (dayOfMonth / daysInMonth) * 100;
    const totalMeta = repRanking.reduce((s, r) => s + r.metaQtd, 0);
    const totalSoldCalc = getMultiMonthClosed(activeMonths, filterYear, filterRep).length;
    repRanking.forEach(rep => {
      if (rep.metaQtd > 0) {
        const faltaRep = Math.max(0, rep.metaQtd - rep.count);
        if (faltaRep > 0 && rep.pctQtd < progressPct * 0.8) {
          alerts.push(`${rep.nome} precisa vender +${faltaRep} máquina${faltaRep > 1 ? "s" : ""} para atingir a meta`);
        }
      }
    });
    if (totalMeta > 0) {
      const teamPct = (totalSoldCalc / totalMeta) * 100;
      if (teamPct < progressPct) {
        const diff = Math.round(progressPct - teamPct);
        alerts.push(`Equipe está ${diff}% abaixo do ritmo necessário`);
      }
    }
    return alerts;
  }, [repRanking, filterMonth, filterYear, filterMode, activeMonths, filterRep, deals]);

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

  const diasRestantes = Math.max(0, totalDaysPeriod - elapsedDays);
  const semanasPassadas = Math.max(1, elapsedDays / 7);
  const semanasRestantes = Math.max(0.1, diasRestantes / 7);
  const ritmoAtual = totalSold / semanasPassadas;
  const ritmoNecessario = diasRestantes > 0 ? faltam / semanasRestantes : 0;
  const ritmoDiario = diasRestantes > 0 ? faltam / diasRestantes : 0;
  const noRitmo = faltam <= 0 || ritmoAtual >= ritmoNecessario;

  const handleMonthClick = (m: number) => {
    setFilterMonth(m);
    setFilterMode("month");
    setFilterQuarter(null);
  };

  const handleQuarterClick = (qi: number) => {
    setFilterMode("quarter");
    setFilterQuarter(qi);
  };

  const handleYearClick = () => {
    setFilterMode("year");
    setFilterQuarter(null);
  };

  // Add rhythm alert to smart alerts (not a hook - computed after early return)
  const smartAlerts = [...smartAlertsMemo];
  if (!noRitmo && diasRestantes > 0) {
    smartAlerts.push(`Ritmo atual: ${ritmoAtual.toFixed(1)}/sem — necessário: ${ritmoNecessario.toFixed(1)}/sem`);
  }

  const pctColor = pctAtingido >= 80 ? "text-[hsl(142,71%,45%)]" : pctAtingido >= 50 ? "text-[hsl(38,92%,50%)]" : "text-[hsl(0,72%,51%)]";
  const pctBg = pctAtingido >= 80 ? "bg-[hsl(142,71%,45%)]" : pctAtingido >= 50 ? "bg-[hsl(38,92%,50%)]" : "bg-[hsl(0,72%,51%)]";
  const pctGlow = pctAtingido >= 80 ? "wr-card-glow-green" : pctAtingido >= 50 ? "wr-card-glow-yellow" : "wr-card-glow-red";

  return (
    <div className="war-room space-y-6 animate-fade-in rounded-xl p-6 -mx-2">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-heading text-2xl font-bold text-[hsl(var(--wr-text))] flex items-center gap-2">
            <Zap className="h-6 w-6 text-[hsl(var(--wr-yellow))]" />
            WAR ROOM
          </h2>
          <p className="text-sm text-[hsl(var(--wr-text-muted))] mt-0.5">{periodLabel}</p>
        </div>
      </div>

      {/* ─── FILTROS ─── */}
      <div className="space-y-3">
        <div className="flex items-center gap-3">
          <span className="text-xs font-semibold text-[hsl(var(--wr-text-muted))] uppercase tracking-wide w-10">Ano</span>
          <div className="flex gap-1.5">
            {[2025, 2026, 2027].map(y => (
              <button key={y} onClick={() => setFilterYear(y)}
                className={`px-3.5 py-1.5 rounded-full text-xs font-medium transition-colors ${
                  filterYear === y ? "bg-[hsl(var(--wr-blue))] text-white shadow-sm" : "bg-[hsl(var(--wr-card-highlight))] text-[hsl(var(--wr-text-muted))] hover:bg-[hsl(var(--wr-card))]"
                }`}>{y}</button>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-3">
          <span className="text-xs font-semibold text-[hsl(var(--wr-text-muted))] uppercase tracking-wide w-10">Mês</span>
          <div className="flex flex-wrap gap-1.5">
            {SHORT_MONTHS.map((m, i) => {
              const monthNum = i + 1;
              const isActive = filterMode === "month" && filterMonth === monthNum;
              const isInRange = filterMode !== "month" && activeMonths.includes(monthNum);
              return (
                <button key={i} onClick={() => handleMonthClick(monthNum)}
                  className={`px-2.5 py-1.5 rounded-full text-xs font-medium transition-colors ${
                    isActive ? "bg-[hsl(var(--wr-blue))] text-white shadow-sm"
                    : isInRange ? "bg-[hsl(var(--wr-blue))]/20 text-[hsl(var(--wr-blue))]"
                    : "bg-[hsl(var(--wr-card-highlight))] text-[hsl(var(--wr-text-muted))] hover:bg-[hsl(var(--wr-card))]"
                  }`}>{m}</button>
              );
            })}
          </div>
        </div>

        <div className="flex items-center gap-3">
          <span className="text-xs font-semibold text-[hsl(var(--wr-text-muted))] uppercase tracking-wide w-10">Período</span>
          <div className="flex gap-1.5">
            {QUARTERS.map((q, i) => (
              <button key={i} onClick={() => handleQuarterClick(i)}
                className={`px-3.5 py-1.5 rounded-full text-xs font-medium transition-colors ${
                  filterMode === "quarter" && filterQuarter === i ? "bg-[hsl(var(--wr-blue))] text-white shadow-sm" : "bg-[hsl(var(--wr-card-highlight))] text-[hsl(var(--wr-text-muted))] hover:bg-[hsl(var(--wr-card))]"
                }`}>{q.label}</button>
            ))}
            <button onClick={handleYearClick}
              className={`px-3.5 py-1.5 rounded-full text-xs font-medium transition-colors ${
                filterMode === "year" ? "bg-[hsl(var(--wr-blue))] text-white shadow-sm" : "bg-[hsl(var(--wr-card-highlight))] text-[hsl(var(--wr-text-muted))] hover:bg-[hsl(var(--wr-card))]"
              }`}>Ano Completo</button>
          </div>
        </div>

        {reps.length > 0 && (
          <div className="flex items-center gap-3">
            <span className="text-xs font-semibold text-[hsl(var(--wr-text-muted))] uppercase tracking-wide w-10">Rep.</span>
            <Select value={filterRep} onValueChange={setFilterRep}>
              <SelectTrigger className="w-[180px] bg-[hsl(var(--wr-card))] border-[hsl(var(--wr-border))] text-[hsl(var(--wr-text))] text-sm h-8 rounded-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-[hsl(var(--wr-card))] border-[hsl(var(--wr-border))] text-[hsl(var(--wr-text))]">
                <SelectItem value="all">Todos</SelectItem>
                {reps.map(r => <SelectItem key={r.id} value={r.id}>{r.nome}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        )}
      </div>

      {/* ═══ BLOCO 1: STATUS GLOBAL (Grande) ═══ */}
      <section className={`wr-card ${pctGlow}`}>
        <div className="flex items-center gap-2 mb-4">
          <Target className="h-5 w-5 text-[hsl(var(--wr-blue))]" />
          <h3 className="font-heading text-lg font-bold text-[hsl(var(--wr-text))] uppercase tracking-wide">Status Global</h3>
        </div>
        <div className="grid grid-cols-3 gap-6 mb-6">
          <div className="text-center">
            <p className="text-xs font-medium text-[hsl(var(--wr-text-muted))] uppercase tracking-wide mb-1">Meta</p>
            <p className="font-heading text-4xl font-black text-[hsl(var(--wr-text))]">{totalMetaQtd}</p>
            <p className="text-xs text-[hsl(var(--wr-text-muted))]">máquinas</p>
          </div>
          <div className="text-center">
            <p className="text-xs font-medium text-[hsl(var(--wr-text-muted))] uppercase tracking-wide mb-1">Vendido</p>
            <p className="font-heading text-4xl font-black text-[hsl(142,71%,45%)]">{totalSold}</p>
            <p className="text-xs text-[hsl(var(--wr-text-muted))]">fechadas</p>
          </div>
          <div className="text-center">
            <p className="text-xs font-medium text-[hsl(var(--wr-text-muted))] uppercase tracking-wide mb-1">% Atingido</p>
            <p className={`font-heading text-4xl font-black ${pctColor}`}>{formatPct(pctAtingido)}</p>
            <p className="text-xs text-[hsl(var(--wr-text-muted))]">
              {faltam > 0 ? `faltam ${faltam}` : "Meta batida! 🎉"}
            </p>
          </div>
        </div>
        {/* Thermometer */}
        {totalMetaQtd > 0 && (
          <div>
            <div className="wr-thermometer">
              <div className={`wr-thermometer-fill ${pctBg}`} style={{ width: `${Math.min(pctAtingido, 100)}%` }} />
            </div>
            <div className="flex justify-between mt-2">
              <span className="text-xs text-[hsl(var(--wr-text-muted))]">0%</span>
              <span className="text-xs text-[hsl(var(--wr-text-muted))]">50%</span>
              <span className="text-xs text-[hsl(var(--wr-text-muted))]">100%</span>
            </div>
          </div>
        )}
      </section>

      {/* ═══ BLOCO 2: RANKING DA EQUIPE ═══ */}
      {repRanking.length > 0 && (
        <section>
          <div className="flex items-center gap-2 mb-4">
            <Trophy className="h-5 w-5 text-[hsl(var(--wr-yellow))]" />
            <h3 className="font-heading text-lg font-bold text-[hsl(var(--wr-text))] uppercase tracking-wide">Ranking da Equipe</h3>
          </div>
          <div className="space-y-3">
            {[...repRanking]
              .sort((a, b) => b.pctQtd - a.pctQtd)
              .map((rep, idx) => {
                const faltamRep = Math.max(0, rep.metaQtd - rep.count);
                const pctRep = rep.metaQtd > 0 ? (rep.count / rep.metaQtd) * 100 : 0;
                const medal = idx === 0 ? "🥇" : idx === 1 ? "🥈" : idx === 2 ? "🥉" : `${idx + 1}º`;
                const statusColor = pctRep >= 100 ? "text-[hsl(142,71%,45%)]" : pctRep >= 70 ? "text-[hsl(38,92%,50%)]" : "text-[hsl(0,72%,51%)]";
                const statusLabel = pctRep >= 100 ? "META BATIDA ✓" : pctRep >= 70 ? "ATENÇÃO" : "ABAIXO";
                const glowClass = pctRep >= 100 ? "wr-card-glow-green" : pctRep >= 70 ? "wr-card-glow-yellow" : "wr-card-glow-red";

                return (
                  <div key={rep.id} className={`wr-card ${idx < 3 ? glowClass : ""} flex items-center gap-4`}>
                    <span className="text-2xl w-10 text-center flex-shrink-0">{medal}</span>
                    <div className="flex-1 min-w-0">
                      <p className="font-heading font-bold text-[hsl(var(--wr-text))] truncate">{rep.nome}</p>
                      <div className="flex items-center gap-4 mt-1">
                        <span className="text-xs text-[hsl(var(--wr-text-muted))]">Meta: {rep.metaQtd}</span>
                        <span className="text-xs text-[hsl(var(--wr-text))] font-semibold">Vendido: {rep.count}</span>
                        <span className={`text-xs font-bold ${statusColor}`}>{formatPct(pctRep)}</span>
                      </div>
                    </div>
                    <div className="flex-shrink-0 text-right">
                      <span className={`text-xs font-black uppercase tracking-wider ${statusColor}`}>{statusLabel}</span>
                      {faltamRep > 0 && (
                        <p className="text-xs text-[hsl(var(--wr-text-muted))] mt-0.5">falta{faltamRep > 1 ? "m" : ""} {faltamRep}</p>
                      )}
                    </div>
                  </div>
                );
              })}
          </div>
        </section>
      )}

      {/* ═══ BLOCO 3: RITMO DE BATALHA ═══ */}
      {totalMetaQtd > 0 && diasRestantes > 0 && (
        <section>
          <div className="flex items-center gap-2 mb-4">
            <Gauge className="h-5 w-5 text-[hsl(var(--wr-blue))]" />
            <h3 className="font-heading text-lg font-bold text-[hsl(var(--wr-text))] uppercase tracking-wide">Ritmo de Batalha</h3>
          </div>
          <div className="grid gap-4 grid-cols-1 md:grid-cols-3">
            <div className="wr-card wr-card-glow-blue text-center">
              <p className="text-xs font-medium text-[hsl(var(--wr-text-muted))] uppercase mb-2">Ritmo Atual</p>
              <p className="font-heading text-3xl font-black text-[hsl(var(--wr-blue))]">{ritmoAtual.toFixed(1)}<span className="text-lg">/sem</span></p>
              <p className="text-xs text-[hsl(var(--wr-text-muted))] mt-1">{totalSold} em {semanasPassadas.toFixed(1)} semanas</p>
            </div>
            <div className="wr-card text-center">
              <p className="text-xs font-medium text-[hsl(var(--wr-text-muted))] uppercase mb-2">Ritmo Necessário</p>
              <p className={`font-heading text-3xl font-black ${noRitmo ? "text-[hsl(142,71%,45%)]" : "text-[hsl(0,72%,51%)]"}`}>{ritmoNecessario.toFixed(1)}<span className="text-lg">/sem</span></p>
              <p className="text-xs text-[hsl(var(--wr-text-muted))] mt-1">{faltam} em {semanasRestantes.toFixed(1)} semanas</p>
            </div>
            <div className={`wr-card text-center ${faltam <= 0 ? "wr-card-glow-green" : noRitmo ? "wr-card-glow-green" : ritmoAtual > 0 ? "wr-card-glow-red" : "wr-card-glow-yellow"}`}>
              <p className="text-xs font-medium text-[hsl(var(--wr-text-muted))] uppercase mb-2">Status</p>
              <p className="text-5xl mb-1">
                {faltam <= 0 ? "🔥" : noRitmo ? "🟢" : "🔴"}
              </p>
              <p className={`font-heading text-sm font-black uppercase ${faltam <= 0 ? "text-[hsl(142,71%,45%)]" : noRitmo ? "text-[hsl(142,71%,45%)]" : "text-[hsl(0,72%,51%)]"}`}>
                {faltam <= 0 ? "Meta batida!" : noRitmo ? "No ritmo" : "Abaixo do ritmo"}
              </p>
              {!noRitmo && <p className="text-xs text-[hsl(var(--wr-text-muted))] mt-1">Precisa {ritmoDiario.toFixed(1)} vendas/dia</p>}
            </div>
          </div>
        </section>
      )}

      {/* ═══ BLOCO 4: FATURAMENTO ═══ */}
      <section>
        <div className="flex items-center gap-2 mb-4">
          <DollarSign className="h-5 w-5 text-[hsl(142,71%,45%)]" />
          <h3 className="font-heading text-lg font-bold text-[hsl(var(--wr-text))] uppercase tracking-wide">Faturamento</h3>
        </div>
        <div className="grid gap-4 grid-cols-2 md:grid-cols-4">
          <WrMetricCard label="FOB Total" value={formatCompact(cur.fobTotal)} glow="blue" variation={fobVar} />
          <WrMetricCard label="CIF Total" value={formatCompact(cur.revenue)} glow="green" variation={cifVar} />
          <WrMetricCard label="Lucro Líquido" value={formatCompact(cur.netProfit)} glow="green" />
          <WrMetricCard label="Comissão Total" value={formatCompact(commissionTotal)} glow="yellow" />
        </div>
      </section>

      {/* ═══ BLOCO 5: ALERTAS INTELIGENTES ═══ */}
      {smartAlerts.length > 0 && (
        <section className="wr-card wr-card-glow-red">
          <div className="flex items-center gap-2 mb-3">
            <AlertCircle className="h-5 w-5 text-[hsl(0,72%,51%)]" />
            <h3 className="font-heading text-lg font-bold text-[hsl(var(--wr-text))] uppercase tracking-wide">Alertas</h3>
          </div>
          <div className="space-y-2">
            {smartAlerts.map((alert, i) => (
              <div key={i} className="flex items-start gap-2 bg-[hsl(0,72%,51%)]/10 rounded-lg px-4 py-3">
                <AlertTriangle className="h-4 w-4 text-[hsl(38,92%,50%)] flex-shrink-0 mt-0.5" />
                <p className="text-sm text-[hsl(var(--wr-text))] font-medium">{alert}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ═══ PIPELINE ═══ */}
      <section>
        <div className="flex items-center gap-2 mb-4">
          <BarChart3 className="h-5 w-5 text-[hsl(var(--wr-yellow))]" />
          <h3 className="font-heading text-lg font-bold text-[hsl(var(--wr-text))] uppercase tracking-wide">Pipeline</h3>
        </div>
        <div className="grid gap-4 grid-cols-1 md:grid-cols-3">
          <WrMetricCard label="Em Negociação" value={String(pipelineData.totalOpen)} glow="yellow" sub="abertas" />
          <WrMetricCard label="Valor Total" value={formatCompact(pipelineData.totalValue)} glow="blue" sub="em aberto" />
          <WrMetricCard label="Previsão Ponderada" value={formatCompact(pipelineData.weightedForecast)} glow="green" sub="50% do valor" />
        </div>
      </section>

      {/* ═══ EVOLUÇÃO 6 MESES ═══ */}
      <section>
        <div className="flex items-center gap-2 mb-4">
          <TrendingUp className="h-5 w-5 text-[hsl(var(--wr-blue))]" />
          <h3 className="font-heading text-lg font-bold text-[hsl(var(--wr-text))] uppercase tracking-wide">Evolução (6 meses)</h3>
        </div>
        <div className="wr-card">
          <ResponsiveContainer width="100%" height={240}>
            <AreaChart data={evolutionData}>
              <defs>
                <linearGradient id="gradFat" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(221, 83%, 53%)" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="hsl(221, 83%, 53%)" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="gradLucro" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(142, 71%, 45%)" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="hsl(142, 71%, 45%)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(217, 33%, 18%)" />
              <XAxis dataKey="name" tick={{ fontSize: 12, fill: 'hsl(215, 20%, 55%)' }} />
              <YAxis tick={{ fontSize: 11, fill: 'hsl(215, 20%, 55%)' }} />
              <Tooltip
                formatter={(v: number) => formatUsd(v)}
                contentStyle={{
                  fontSize: 12, borderRadius: 8,
                  background: 'hsl(217, 33%, 12%)',
                  border: '1px solid hsl(217, 33%, 18%)',
                  color: 'hsl(210, 40%, 98%)',
                }}
                labelStyle={{ color: 'hsl(215, 20%, 55%)' }}
              />
              <Area type="monotone" dataKey="Faturamento" stroke="hsl(221, 83%, 53%)" fill="url(#gradFat)" strokeWidth={2} />
              <Area type="monotone" dataKey="Lucro Líquido" stroke="hsl(142, 71%, 45%)" fill="url(#gradLucro)" strokeWidth={2} />
              <RechartLegend wrapperStyle={{ fontSize: 12, color: 'hsl(215, 20%, 55%)' }} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </section>
    </div>
  );
};

/* --- WAR ROOM Sub-components --- */

const WrMetricCard = ({ label, value, glow, sub, variation }: {
  label: string; value: string; glow: "green" | "red" | "yellow" | "blue"; sub?: string; variation?: number;
}) => {
  const glowClass = {
    green: "wr-card-glow-green",
    red: "wr-card-glow-red",
    yellow: "wr-card-glow-yellow",
    blue: "wr-card-glow-blue",
  }[glow];
  const valueColor = {
    green: "text-[hsl(142,71%,45%)]",
    red: "text-[hsl(0,72%,51%)]",
    yellow: "text-[hsl(38,92%,50%)]",
    blue: "text-[hsl(221,83%,53%)]",
  }[glow];

  return (
    <div className={`wr-card ${glowClass}`}>
      <p className="text-xs font-medium text-[hsl(var(--wr-text-muted))] uppercase tracking-wide mb-1">{label}</p>
      <div className="flex items-end gap-2">
        <p className={`font-heading text-2xl font-black ${valueColor}`}>{value}</p>
        {variation !== undefined && variation !== 0 && (
          <span className={`flex items-center gap-0.5 text-xs font-semibold mb-1 ${variation > 0 ? "text-[hsl(142,71%,45%)]" : "text-[hsl(0,72%,51%)]"}`}>
            {variation > 0 ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
            {variation > 0 ? "+" : ""}{variation.toFixed(0)}%
          </span>
        )}
      </div>
      {sub && <p className="text-xs text-[hsl(var(--wr-text-muted))] mt-1">{sub}</p>}
    </div>
  );
};

export default ExecutiveDashboard;
