import { useState, useMemo, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  TrendingUp, TrendingDown, DollarSign, Target, BarChart3, Users,
  AlertTriangle, ArrowUpRight, ArrowDownRight, Gauge, CheckCircle2, XCircle,
  Flame, Trophy, Zap, AlertCircle, Minus,
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
  const [showAllReps, setShowAllReps] = useState(false);
  const [rankingMode, setRankingMode] = useState<"qty" | "revenue" | "margin" | "commission">("qty");

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
      grossProfit: arr.reduce((s, d) => s + d.gross_profit, 0),
      basePrice: arr.reduce((s, d) => s + d.base_price, 0),
      sellerComm: arr.reduce((s, d) => s + d.seller_commission_value, 0),
      managerComm: arr.reduce((s, d) => s + d.manager_commission_value, 0),
    });
    return { current: calc(current), previous: calc(previous), currentDeals: current };
  }, [deals, activeMonths, filterYear, filterRep, monthlyGoals]);

  // ─── 1) PROJEÇÃO DO MÊS ───
  const projection = useMemo(() => {
    if (filterMode !== "month") return null;
    const isCurrentYear = filterYear === now.getFullYear();
    const isCurrentMonth = isCurrentYear && filterMonth === now.getMonth() + 1;
    if (!isCurrentMonth) return null;

    const daysInMonth = new Date(filterYear, filterMonth, 0).getDate();
    const daysPassed = now.getDate();
    if (daysPassed === 0) return null;

    const totalMetaQtd = repsWithGoals.reduce((s, r) => s + getRepMeta(r.id).metaQtd, 0);
    const totalMetaVal = repsWithGoals.reduce((s, r) => s + getRepMeta(r.id).metaVal, 0);
    const projQtd = Math.round((monthStats.current.count / daysPassed) * daysInMonth);
    const projVal = (monthStats.current.basePrice / daysPassed) * daysInMonth;
    const pctQtd = totalMetaQtd > 0 ? (projQtd / totalMetaQtd) * 100 : 0;
    const pctVal = totalMetaVal > 0 ? (projVal / totalMetaVal) * 100 : 0;

    return { projQtd, projVal, metaQtd: totalMetaQtd, metaVal: totalMetaVal, pctQtd, pctVal, daysPassed, daysInMonth };
  }, [filterMode, filterMonth, filterYear, monthStats, repsWithGoals, monthlyGoals]);

  // ─── 2) TENDÊNCIA 3 MESES ───
  const trend3m = useMemo(() => {
    const lastActiveMonth = activeMonths[activeMonths.length - 1];
    const months: number[] = [];
    for (let i = 1; i <= 3; i++) {
      let m = lastActiveMonth - i;
      let y = filterYear;
      while (m <= 0) { m += 12; y--; }
      months.push(getMonthClosed(m, y, filterRep).length);
    }
    // months[0] = most recent of the 3, months[2] = oldest
    const avg = months.reduce((s, v) => s + v, 0) / 3;
    const currentCount = monthStats.current.count;
    // Compare current vs avg
    if (avg === 0 && currentCount === 0) return { label: "Estável", icon: "stable", avg, current: currentCount };
    if (currentCount > avg * 1.1) return { label: "Crescendo", icon: "up", avg, current: currentCount };
    if (currentCount < avg * 0.9) return { label: "Em queda", icon: "down", avg, current: currentCount };
    return { label: "Estável", icon: "stable", avg, current: currentCount };
  }, [deals, activeMonths, filterYear, filterRep, monthStats]);

  // ─── 3) TICKET MÉDIO ───
  const ticketMedio = useMemo(() => {
    const cur = monthStats.current;
    const global = cur.count > 0 ? cur.basePrice / cur.count : 0;

    const byRep = repsWithGoals.map(rep => {
      const repDeals = getMultiMonthClosed(activeMonths, filterYear, rep.id);
      const total = repDeals.reduce((s, d) => s + d.base_price, 0);
      const count = repDeals.length;
      return { id: rep.id, nome: rep.nome, ticket: count > 0 ? total / count : 0, count };
    }).filter(r => r.count > 0).sort((a, b) => b.ticket - a.ticket);

    return { global, byRep };
  }, [monthStats, repsWithGoals, deals, activeMonths, filterYear]);

  // ─── 4) MARGEM MÉDIA REAL ───
  const margemMedia = useMemo(() => {
    const cur = monthStats.current;
    const global = cur.basePrice > 0 ? (cur.netProfit / cur.basePrice) * 100 : 0;

    const byRep = repsWithGoals.map(rep => {
      const repDeals = getMultiMonthClosed(activeMonths, filterYear, rep.id);
      const totalBase = repDeals.reduce((s, d) => s + d.base_price, 0);
      const totalNet = repDeals.reduce((s, d) => s + d.net_profit, 0);
      return { id: rep.id, nome: rep.nome, margem: totalBase > 0 ? (totalNet / totalBase) * 100 : 0, count: repDeals.length };
    }).filter(r => r.count > 0).sort((a, b) => b.margem - a.margem);

    return { global, byRep };
  }, [monthStats, repsWithGoals, deals, activeMonths, filterYear]);

  // ─── 5) RANKINGS MÚLTIPLOS ───
  const repRanking = useMemo(() => {
    if (repsWithGoals.length === 0) return [];
    return repsWithGoals.map(rep => {
      const repDeals = getMultiMonthClosed(activeMonths, filterYear, rep.id);
      const revenue = repDeals.reduce((s, d) => s + d.final_price, 0);
      const basePrice = repDeals.reduce((s, d) => s + d.base_price, 0);
      const fobTotal = repDeals.reduce((s, d) => s + d.fob_cost, 0);
      const netProfit = repDeals.reduce((s, d) => s + d.net_profit, 0);
      const totalComm = repDeals.reduce((s, d) => s + d.seller_commission_value + d.manager_commission_value, 0);
      const count = repDeals.length;
      const { metaQtd, metaVal } = getRepMeta(rep.id);
      const pctQtd = metaQtd > 0 ? (count / metaQtd) * 100 : 0;
      const margem = basePrice > 0 ? (netProfit / basePrice) * 100 : 0;
      return { ...rep, revenue, basePrice, fobTotal, count, pctQtd, metaQtd, metaVal, netProfit, totalComm, margem };
    }).filter(r => r.count > 0 || r.metaQtd > 0);
  }, [repsWithGoals, deals, activeMonths, filterYear, monthlyGoals]);

  const sortedRanking = useMemo(() => {
    const sorted = [...repRanking];
    switch (rankingMode) {
      case "qty": return sorted.sort((a, b) => b.count - a.count);
      case "revenue": return sorted.sort((a, b) => b.basePrice - a.basePrice);
      case "margin": return sorted.sort((a, b) => b.netProfit - a.netProfit);
      case "commission": return sorted.sort((a, b) => b.totalComm - a.totalComm);
      default: return sorted;
    }
  }, [repRanking, rankingMode]);

  // Pace calculation
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

  const commissionTotal = useMemo(() => {
    return monthStats.current.sellerComm + monthStats.current.managerComm;
  }, [monthStats]);

  // Evolution data (last 6 months)
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
        Faturamento: Math.round(closed.reduce((s, d) => s + d.base_price, 0) * 100) / 100,
        "Lucro Líquido": Math.round(closed.reduce((s, d) => s + d.net_profit, 0) * 100) / 100,
        Vendas: closed.length,
      });
    }
    return data;
  }, [deals, activeMonths, filterYear, filterRep]);

  // Smart alerts
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
  const fobVar = calcVariation(cur.basePrice, prev.basePrice);

  const diasRestantes = Math.max(0, totalDaysPeriod - elapsedDays);
  const semanasPassadas = Math.max(1, elapsedDays / 7);
  const semanasRestantes = Math.max(0.1, diasRestantes / 7);
  const ritmoAtual = totalSold / semanasPassadas;
  const ritmoNecessario = diasRestantes > 0 ? faltam / semanasRestantes : 0;
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

  const smartAlerts = [...smartAlertsMemo];
  if (!noRitmo && diasRestantes > 0) {
    smartAlerts.push(`Ritmo atual: ${ritmoAtual.toFixed(1)}/sem — necessário: ${ritmoNecessario.toFixed(1)}/sem`);
  }

  const topPerformer = sortedRanking.length > 0 ? sortedRanking[0] : null;
  const worstPerformer = sortedRanking.length > 1 ? sortedRanking[sortedRanking.length - 1] : null;
  const displayedRanking = showAllReps ? sortedRanking : sortedRanking.slice(0, 5);

  const statusColor = (pct: number) =>
    pct >= 100 ? "text-[#22C55E]" : pct >= 70 ? "text-[#F97316]" : "text-[#EF4444]";
  const statusLabel = (pct: number) =>
    pct >= 100 ? "Acima" : pct >= 70 ? "No Ritmo" : "Abaixo";

  const getRankingValue = (rep: typeof sortedRanking[0]) => {
    switch (rankingMode) {
      case "qty": return `${rep.count} vendas`;
      case "revenue": return formatCompact(rep.basePrice);
      case "margin": return formatCompact(rep.netProfit);
      case "commission": return formatCompact(rep.totalComm);
    }
  };

  const rankingModes = [
    { key: "qty" as const, label: "Quantidade" },
    { key: "revenue" as const, label: "Faturamento" },
    { key: "margin" as const, label: "Margem" },
    { key: "commission" as const, label: "Comissão" },
  ];

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-heading text-2xl font-bold text-foreground flex items-center gap-2">
            <Flame className="h-6 w-6 text-[#F97316]" />
            Painel Inteligente de Resultado
          </h2>
          <p className="text-sm text-muted-foreground mt-0.5">{periodLabel}</p>
        </div>
      </div>

      {/* ─── FILTROS ─── */}
      <div className="space-y-3">
        <div className="flex items-center gap-3">
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide w-10">Ano</span>
          <div className="flex gap-1.5">
            {[2025, 2026, 2027].map(y => (
              <button key={y} onClick={() => setFilterYear(y)}
                className={`px-3.5 py-1.5 rounded-full text-xs font-medium transition-all ${
                  filterYear === y ? "bg-[#3B82F6] text-white shadow-md shadow-[#3B82F6]/30" : "bg-white text-muted-foreground hover:bg-gray-100 border border-border"
                }`}>{y}</button>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide w-10">Mês</span>
          <div className="flex flex-wrap gap-1.5">
            {SHORT_MONTHS.map((m, i) => {
              const monthNum = i + 1;
              const isActive = filterMode === "month" && filterMonth === monthNum;
              const isInRange = filterMode !== "month" && activeMonths.includes(monthNum);
              return (
                <button key={i} onClick={() => handleMonthClick(monthNum)}
                  className={`px-2.5 py-1.5 rounded-full text-xs font-medium transition-all ${
                    isActive ? "bg-[#3B82F6] text-white shadow-md shadow-[#3B82F6]/30"
                    : isInRange ? "bg-[#3B82F6]/10 text-[#3B82F6] border border-[#3B82F6]/30"
                    : "bg-white text-muted-foreground hover:bg-gray-100 border border-border"
                  }`}>{m}</button>
              );
            })}
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide w-10">Período</span>
          <div className="flex gap-1.5">
            {QUARTERS.map((q, i) => (
              <button key={i} onClick={() => handleQuarterClick(i)}
                className={`px-3.5 py-1.5 rounded-full text-xs font-medium transition-all ${
                  filterMode === "quarter" && filterQuarter === i ? "bg-[#3B82F6] text-white shadow-md shadow-[#3B82F6]/30" : "bg-white text-muted-foreground hover:bg-gray-100 border border-border"
                }`}>{q.label}</button>
            ))}
            <button onClick={handleYearClick}
              className={`px-3.5 py-1.5 rounded-full text-xs font-medium transition-all ${
                filterMode === "year" ? "bg-[#3B82F6] text-white shadow-md shadow-[#3B82F6]/30" : "bg-white text-muted-foreground hover:bg-gray-100 border border-border"
              }`}>Ano Completo</button>
          </div>
        </div>
        {reps.length > 0 && (
          <div className="flex items-center gap-3">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide w-10">Rep.</span>
            <Select value={filterRep} onValueChange={setFilterRep}>
              <SelectTrigger className="w-[180px] bg-white border-border text-sm h-8 rounded-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                {reps.map(r => <SelectItem key={r.id} value={r.id}>{r.nome}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        )}
      </div>

      {/* ═══ 4 KPIs SUPERIORES ═══ */}
      <div className="grid gap-4 grid-cols-2 md:grid-cols-4">
        <div className="bg-white rounded-xl border border-border p-5 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center gap-3 mb-3">
            <div className="h-10 w-10 rounded-lg bg-[#3B82F6]/10 flex items-center justify-center">
              <Target className="h-5 w-5 text-[#3B82F6]" />
            </div>
            <span className="text-xs font-semibold text-muted-foreground uppercase">Meta</span>
          </div>
          <p className="font-heading text-3xl font-black text-foreground">{totalMetaQtd}</p>
          <p className="text-xs text-muted-foreground mt-1">máquinas</p>
        </div>

        <div className="bg-white rounded-xl border border-border p-5 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center gap-3 mb-3">
            <div className="h-10 w-10 rounded-lg bg-[#22C55E]/10 flex items-center justify-center">
              <TrendingUp className="h-5 w-5 text-[#22C55E]" />
            </div>
            <span className="text-xs font-semibold text-muted-foreground uppercase">Vendido</span>
          </div>
          <div className="flex items-end gap-2">
            <p className="font-heading text-3xl font-black text-foreground">{totalSold}</p>
            {vendasVar !== 0 && (
              <span className={`inline-flex items-center gap-0.5 text-xs font-bold px-2 py-0.5 rounded-full mb-1 ${vendasVar > 0 ? "bg-[#22C55E]/10 text-[#22C55E]" : "bg-[#EF4444]/10 text-[#EF4444]"}`}>
                {vendasVar > 0 ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
                {vendasVar > 0 ? "+" : ""}{vendasVar.toFixed(0)}%
              </span>
            )}
          </div>
          <p className="text-xs text-muted-foreground mt-1">{faltam > 0 ? `faltam ${faltam}` : "Meta batida! 🎉"}</p>
        </div>

        <div className="bg-white rounded-xl border border-border p-5 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center gap-3 mb-3">
            <div className={`h-10 w-10 rounded-lg flex items-center justify-center ${pctAtingido >= 80 ? "bg-[#22C55E]/10" : pctAtingido >= 50 ? "bg-[#F97316]/10" : "bg-[#EF4444]/10"}`}>
              <Gauge className={`h-5 w-5 ${statusColor(pctAtingido)}`} />
            </div>
            <span className="text-xs font-semibold text-muted-foreground uppercase">% Atingido</span>
          </div>
          <p className={`font-heading text-3xl font-black ${statusColor(pctAtingido)}`}>{formatPct(pctAtingido)}</p>
        </div>

        <div className="bg-white rounded-xl border border-border p-5 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center gap-3 mb-3">
            <div className="h-10 w-10 rounded-lg bg-[#3B82F6]/10 flex items-center justify-center">
              <BarChart3 className="h-5 w-5 text-[#3B82F6]" />
            </div>
            <span className="text-xs font-semibold text-muted-foreground uppercase">Ritmo</span>
          </div>
          <p className="font-heading text-3xl font-black text-foreground">{ritmoAtual.toFixed(1)}<span className="text-lg text-muted-foreground">/sem</span></p>
          <p className={`text-xs font-semibold mt-1 ${noRitmo ? "text-[#22C55E]" : "text-[#EF4444]"}`}>
            {noRitmo ? "✓ Acima do necessário" : `Necessário: ${ritmoNecessario.toFixed(1)}/sem`}
          </p>
        </div>
      </div>

      {/* ═══ INTELIGÊNCIA: PROJEÇÃO + TENDÊNCIA + TICKET + MARGEM ═══ */}
      <div className="grid gap-4 grid-cols-2 md:grid-cols-4">
        {/* Projeção do Mês */}
        <div className="bg-white rounded-xl border border-border p-5 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center gap-3 mb-3">
            <div className="h-10 w-10 rounded-lg bg-[#8B5CF6]/10 flex items-center justify-center">
              <Target className="h-5 w-5 text-[#8B5CF6]" />
            </div>
            <span className="text-xs font-semibold text-muted-foreground uppercase">Projeção Mês</span>
          </div>
          {projection ? (
            <>
              <p className="font-heading text-3xl font-black text-foreground">{projection.projQtd}</p>
              <p className="text-xs text-muted-foreground mt-1">
                máquinas projetadas ({projection.daysPassed}/{projection.daysInMonth} dias)
              </p>
              <div className="mt-2 flex items-center gap-2">
                <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${projection.pctQtd >= 100 ? "bg-[#22C55E]/10 text-[#22C55E]" : projection.pctQtd >= 70 ? "bg-[#F97316]/10 text-[#F97316]" : "bg-[#EF4444]/10 text-[#EF4444]"}`}>
                  {formatPct(projection.pctQtd)} da meta
                </span>
              </div>
            </>
          ) : (
            <>
              <p className="font-heading text-2xl font-black text-muted-foreground">—</p>
              <p className="text-xs text-muted-foreground mt-1">Disponível apenas no mês atual</p>
            </>
          )}
        </div>

        {/* Tendência 3 Meses */}
        <div className="bg-white rounded-xl border border-border p-5 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center gap-3 mb-3">
            <div className={`h-10 w-10 rounded-lg flex items-center justify-center ${
              trend3m.icon === "up" ? "bg-[#22C55E]/10" : trend3m.icon === "down" ? "bg-[#EF4444]/10" : "bg-[#F97316]/10"
            }`}>
              {trend3m.icon === "up" ? <TrendingUp className="h-5 w-5 text-[#22C55E]" /> :
               trend3m.icon === "down" ? <TrendingDown className="h-5 w-5 text-[#EF4444]" /> :
               <Minus className="h-5 w-5 text-[#F97316]" />}
            </div>
            <span className="text-xs font-semibold text-muted-foreground uppercase">Tendência 3M</span>
          </div>
          <p className={`font-heading text-2xl font-black ${
            trend3m.icon === "up" ? "text-[#22C55E]" : trend3m.icon === "down" ? "text-[#EF4444]" : "text-[#F97316]"
          }`}>{trend3m.label}</p>
          <p className="text-xs text-muted-foreground mt-1">
            Média 3M: {trend3m.avg.toFixed(1)} · Atual: {trend3m.current}
          </p>
        </div>

        {/* Ticket Médio */}
        <div className="bg-white rounded-xl border border-border p-5 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center gap-3 mb-3">
            <div className="h-10 w-10 rounded-lg bg-[#3B82F6]/10 flex items-center justify-center">
              <DollarSign className="h-5 w-5 text-[#3B82F6]" />
            </div>
            <span className="text-xs font-semibold text-muted-foreground uppercase">Ticket Médio</span>
          </div>
          <p className="font-heading text-2xl font-black text-foreground">{cur.count > 0 ? formatCompact(ticketMedio.global) : "—"}</p>
          <p className="text-xs text-muted-foreground mt-1">FOB / máquina (equipe)</p>
        </div>

        {/* Margem Média Real */}
        <div className="bg-white rounded-xl border border-border p-5 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center gap-3 mb-3">
            <div className="h-10 w-10 rounded-lg bg-[#22C55E]/10 flex items-center justify-center">
              <Zap className="h-5 w-5 text-[#22C55E]" />
            </div>
            <span className="text-xs font-semibold text-muted-foreground uppercase">Margem Média</span>
          </div>
          <p className={`font-heading text-2xl font-black ${margemMedia.global >= 0 ? "text-[#22C55E]" : "text-[#EF4444]"}`}>
            {cur.count > 0 ? formatPct(margemMedia.global) : "—"}
          </p>
          <p className="text-xs text-muted-foreground mt-1">Lucro líquido / preço base</p>
        </div>
      </div>

      {/* ═══ TICKET + MARGEM POR REPRESENTANTE ═══ */}
      {filterRep === "all" && (ticketMedio.byRep.length > 0 || margemMedia.byRep.length > 0) && (
        <div className="grid gap-4 grid-cols-1 md:grid-cols-2">
          {/* Ticket por Rep */}
          {ticketMedio.byRep.length > 0 && (
            <div className="bg-white rounded-xl border border-border p-5 shadow-sm">
              <h4 className="text-xs font-semibold text-muted-foreground uppercase mb-3 flex items-center gap-2">
                <DollarSign className="h-4 w-4 text-[#3B82F6]" /> Ticket Médio por Representante
              </h4>
              <div className="space-y-2">
                {ticketMedio.byRep.map((r, i) => (
                  <div key={r.id} className="flex items-center justify-between py-1.5 border-b border-border/50 last:border-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-muted-foreground w-5">{i + 1}º</span>
                      <span className="text-sm font-medium text-foreground">{r.nome}</span>
                    </div>
                    <div className="text-right">
                      <span className="text-sm font-bold text-foreground">{formatCompact(r.ticket)}</span>
                      <span className="text-xs text-muted-foreground ml-1">({r.count})</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Margem por Rep */}
          {margemMedia.byRep.length > 0 && (
            <div className="bg-white rounded-xl border border-border p-5 shadow-sm">
              <h4 className="text-xs font-semibold text-muted-foreground uppercase mb-3 flex items-center gap-2">
                <Zap className="h-4 w-4 text-[#22C55E]" /> Margem Média por Representante
              </h4>
              <div className="space-y-2">
                {margemMedia.byRep.map((r, i) => (
                  <div key={r.id} className="flex items-center justify-between py-1.5 border-b border-border/50 last:border-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-muted-foreground w-5">{i + 1}º</span>
                      <span className="text-sm font-medium text-foreground">{r.nome}</span>
                    </div>
                    <div className="text-right">
                      <span className={`text-sm font-bold ${r.margem >= 0 ? "text-[#22C55E]" : "text-[#EF4444]"}`}>{formatPct(r.margem)}</span>
                      <span className="text-xs text-muted-foreground ml-1">({r.count})</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ═══ TOP PERFORMER + WORST PERFORMER ═══ */}
      <div className="grid gap-4 grid-cols-1 md:grid-cols-3">
        {topPerformer && topPerformer.metaQtd > 0 && (
          <div className="md:col-span-2 bg-gradient-to-r from-[#3B82F6] to-[#2563EB] rounded-xl p-6 text-white shadow-lg shadow-[#3B82F6]/20 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full -translate-y-8 translate-x-8" />
            <div className="absolute bottom-0 left-0 w-24 h-24 bg-white/5 rounded-full translate-y-6 -translate-x-6" />
            <div className="relative">
              <div className="flex items-center gap-2 mb-4">
                <span className="text-xs font-bold uppercase tracking-wider bg-white/20 px-3 py-1 rounded-full">⭐ Top Performer</span>
              </div>
              <div className="flex items-center gap-4 mb-4">
                <div className="h-14 w-14 rounded-full bg-white/20 flex items-center justify-center text-2xl font-black">
                  {topPerformer.nome.charAt(0)}
                </div>
                <div>
                  <p className="font-heading text-xl font-bold">{topPerformer.nome}</p>
                  <p className="text-white/70 text-sm">Liderando a equipe</p>
                </div>
              </div>
              <div className="grid grid-cols-4 gap-3 mb-4">
                <div>
                  <p className="text-white/60 text-xs uppercase">Vendido</p>
                  <p className="font-heading text-2xl font-black">{topPerformer.count}</p>
                </div>
                <div>
                  <p className="text-white/60 text-xs uppercase">Meta</p>
                  <p className="font-heading text-2xl font-black">{topPerformer.metaQtd}</p>
                </div>
                <div>
                  <p className="text-white/60 text-xs uppercase">Faturamento</p>
                  <p className="font-heading text-lg font-black">{formatCompact(topPerformer.basePrice)}</p>
                </div>
                <div>
                  <p className="text-white/60 text-xs uppercase">Margem</p>
                  <p className="font-heading text-lg font-black">{formatPct(topPerformer.margem)}</p>
                </div>
              </div>
              <div className="w-full h-3 bg-white/20 rounded-full overflow-hidden">
                <div className="h-full bg-white rounded-full transition-all duration-700" style={{ width: `${Math.min(topPerformer.pctQtd, 100)}%` }} />
              </div>
              <p className="text-white/60 text-xs mt-2">
                {topPerformer.count >= topPerformer.metaQtd ? "Meta batida! 🏆" : `Faltam ${topPerformer.metaQtd - topPerformer.count} máquinas`}
              </p>
            </div>
          </div>
        )}

        {worstPerformer && worstPerformer.metaQtd > 0 && worstPerformer.id !== topPerformer?.id && (
          <div className="bg-white rounded-xl border-2 border-[#EF4444]/30 p-6 shadow-sm shadow-[#EF4444]/10 relative overflow-hidden">
            <div className="absolute top-0 right-0 h-1 w-full bg-gradient-to-r from-[#EF4444] to-[#F97316]" />
            <div className="flex items-center gap-2 mb-4">
              <span className="text-xs font-bold uppercase tracking-wider text-[#EF4444] bg-[#EF4444]/10 px-3 py-1 rounded-full">⚠ Atenção</span>
            </div>
            <div className="flex items-center gap-3 mb-3">
              <div className="h-12 w-12 rounded-full bg-[#EF4444]/10 flex items-center justify-center text-lg font-black text-[#EF4444]">
                {worstPerformer.nome.charAt(0)}
              </div>
              <div>
                <p className="font-heading font-bold text-foreground">{worstPerformer.nome}</p>
                <p className="text-xs text-muted-foreground">{worstPerformer.count} vendidas</p>
              </div>
            </div>
            <p className="font-heading text-2xl font-black text-[#EF4444]">{formatPct(worstPerformer.pctQtd)}</p>
            <p className="text-xs text-muted-foreground mt-2">
              Falta{Math.max(0, worstPerformer.metaQtd - worstPerformer.count) > 1 ? "m" : ""} {Math.max(0, worstPerformer.metaQtd - worstPerformer.count)} máquina{Math.max(0, worstPerformer.metaQtd - worstPerformer.count) > 1 ? "s" : ""}
            </p>
          </div>
        )}
      </div>

      {/* ═══ RANKINGS MÚLTIPLOS ═══ */}
      {sortedRanking.length > 0 && (
        <section>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Trophy className="h-5 w-5 text-[#F97316]" />
              <h3 className="font-heading text-lg font-bold text-foreground">Ranking da Equipe</h3>
            </div>
            <div className="flex items-center gap-2">
              {rankingModes.map(rm => (
                <button key={rm.key} onClick={() => setRankingMode(rm.key)}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                    rankingMode === rm.key ? "bg-[#F97316] text-white shadow-md shadow-[#F97316]/30" : "bg-white text-muted-foreground hover:bg-gray-100 border border-border"
                  }`}>{rm.label}</button>
              ))}
            </div>
          </div>
          {sortedRanking.length > 5 && (
            <div className="flex justify-end mb-2">
              <button onClick={() => setShowAllReps(!showAllReps)} className="text-xs font-semibold text-[#3B82F6] hover:underline">
                {showAllReps ? "Mostrar menos" : "Ver Todos"}
              </button>
            </div>
          )}
          <div className="space-y-3">
            {displayedRanking.map((rep, idx) => {
              const faltamRep = Math.max(0, rep.metaQtd - rep.count);
              const pctRep = rep.metaQtd > 0 ? (rep.count / rep.metaQtd) * 100 : 0;
              const medal = idx === 0 ? "🥇" : idx === 1 ? "🥈" : idx === 2 ? "🥉" : `${idx + 1}º`;
              const cardBg = idx === 0
                ? "bg-gradient-to-r from-[#3B82F6]/5 to-[#3B82F6]/10 border-[#3B82F6]/30"
                : idx === 1
                ? "bg-gradient-to-r from-gray-50 to-gray-100 border-gray-200"
                : idx === 2
                ? "bg-gradient-to-r from-[#F97316]/5 to-[#F97316]/10 border-[#F97316]/20"
                : "bg-white border-border";

              return (
                <div key={rep.id} className={`rounded-xl border p-4 flex items-center gap-4 shadow-sm hover:shadow-md transition-shadow ${cardBg}`}>
                  <span className="text-2xl w-10 text-center flex-shrink-0">{medal}</span>
                  <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center text-sm font-bold text-foreground flex-shrink-0">
                    {rep.nome.charAt(0)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-heading font-bold text-foreground truncate">{rep.nome}</p>
                    <div className="flex items-center gap-3 mt-1 flex-wrap">
                      <span className="text-xs text-muted-foreground">Qtd: <b>{rep.count}</b></span>
                      <span className="text-xs text-muted-foreground">Fat: <b>{formatCompact(rep.basePrice)}</b></span>
                      <span className="text-xs text-muted-foreground">Margem: <b className={rep.margem >= 0 ? "text-[#22C55E]" : "text-[#EF4444]"}>{formatPct(rep.margem)}</b></span>
                      <span className="text-xs text-muted-foreground">Com: <b>{formatCompact(rep.totalComm)}</b></span>
                    </div>
                  </div>
                  <div className="flex-shrink-0 text-right">
                    <p className="text-sm font-black text-foreground">{getRankingValue(rep)}</p>
                    <span className={`inline-flex items-center text-xs font-bold uppercase px-2.5 py-1 rounded-full mt-1 ${
                      pctRep >= 100 ? "bg-[#22C55E]/10 text-[#22C55E]" : pctRep >= 70 ? "bg-[#F97316]/10 text-[#F97316]" : "bg-[#EF4444]/10 text-[#EF4444]"
                    }`}>
                      {statusLabel(pctRep)}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* ═══ FATURAMENTO ═══ */}
      <section>
        <div className="flex items-center gap-2 mb-4">
          <DollarSign className="h-5 w-5 text-[#22C55E]" />
          <h3 className="font-heading text-lg font-bold text-foreground">Faturamento</h3>
        </div>
        <div className="grid gap-4 grid-cols-1 md:grid-cols-4">
          <CaMetricCard label="FOB Total" value={formatCompact(cur.basePrice)} icon={<DollarSign className="h-5 w-5" />} color="#3B82F6" variation={fobVar} sub={`${cur.count} negociações fechadas`} />
          <CaMetricCard label="Lucro Líquido" value={formatCompact(cur.netProfit)} icon={<Zap className="h-5 w-5" />} color="#22C55E" sub="Resultado após comissões" />
          <CaMetricCard label="Comissões" value={formatCompact(commissionTotal)} icon={<Users className="h-5 w-5" />} color="#F97316" sub="Vendedor + Gestor" />
          <CaMetricCard label="Lucro Bruto" value={formatCompact(cur.grossProfit)} icon={<TrendingUp className="h-5 w-5" />} color="#8B5CF6" sub="Antes das comissões" />
        </div>
      </section>

      {/* ═══ EVOLUÇÃO 6 MESES ═══ */}
      <section>
        <div className="flex items-center gap-2 mb-4">
          <TrendingUp className="h-5 w-5 text-[#3B82F6]" />
          <h3 className="font-heading text-lg font-bold text-foreground">Evolução (6 meses)</h3>
        </div>
        <div className="bg-white rounded-xl border border-border p-6 shadow-sm">
          <ResponsiveContainer width="100%" height={260}>
            <AreaChart data={evolutionData}>
              <defs>
                <linearGradient id="gradFat" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.15} />
                  <stop offset="95%" stopColor="#3B82F6" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="gradLucro" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#22C55E" stopOpacity={0.15} />
                  <stop offset="95%" stopColor="#22C55E" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
              <XAxis dataKey="name" tick={{ fontSize: 12, fill: '#6B7280' }} />
              <YAxis tick={{ fontSize: 11, fill: '#6B7280' }} />
              <Tooltip
                formatter={(v: number) => formatUsd(v)}
                contentStyle={{
                  fontSize: 12, borderRadius: 12,
                  background: '#fff',
                  border: '1px solid #E5E7EB',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
                }}
              />
              <Area type="monotone" dataKey="Faturamento" stroke="#3B82F6" fill="url(#gradFat)" strokeWidth={2.5} />
              <Area type="monotone" dataKey="Lucro Líquido" stroke="#22C55E" fill="url(#gradLucro)" strokeWidth={2.5} />
              <RechartLegend wrapperStyle={{ fontSize: 12 }} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </section>

      {/* ═══ ALERTAS ═══ */}
      {smartAlerts.length > 0 && (
        <section className="bg-gradient-to-r from-[#EF4444] to-[#DC2626] rounded-xl p-6 text-white shadow-lg shadow-[#EF4444]/20 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-40 h-40 bg-white/5 rounded-full -translate-y-12 translate-x-12" />
          <div className="relative">
            <div className="flex items-center gap-2 mb-4">
              <Flame className="h-6 w-6" />
              <h3 className="font-heading text-lg font-bold uppercase tracking-wide">Alerta Comercial</h3>
            </div>
            <div className="space-y-2">
              {smartAlerts.map((alert, i) => (
                <div key={i} className="flex items-start gap-2 bg-white/10 rounded-lg px-4 py-3">
                  <AlertTriangle className="h-4 w-4 text-white/80 flex-shrink-0 mt-0.5" />
                  <p className="text-sm font-medium">{alert}</p>
                </div>
              ))}
            </div>
            {totalMetaQtd > 0 && diasRestantes > 0 && (
              <div className="flex gap-6 mt-4 pt-4 border-t border-white/20">
                <div>
                  <p className="text-white/60 text-xs uppercase">Ritmo Atual</p>
                  <p className="font-heading text-xl font-black">{ritmoAtual.toFixed(1)}/sem</p>
                </div>
                <div>
                  <p className="text-white/60 text-xs uppercase">Ritmo Necessário</p>
                  <p className="font-heading text-xl font-black">{ritmoNecessario.toFixed(1)}/sem</p>
                </div>
              </div>
            )}
          </div>
        </section>
      )}
    </div>
  );
};

/* --- Sub-components --- */

const CaMetricCard = ({ label, value, icon, color, sub, variation }: {
  label: string; value: string; icon: React.ReactNode; color: string; sub?: string; variation?: number;
}) => (
  <div className="bg-white rounded-xl border border-border p-5 shadow-sm hover:shadow-md transition-shadow">
    <div className="flex items-center gap-3 mb-3">
      <div className="h-10 w-10 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${color}15`, color }}>
        {icon}
      </div>
      <span className="text-xs font-semibold text-muted-foreground uppercase">{label}</span>
    </div>
    <div className="flex items-end gap-2">
      <p className="font-heading text-2xl font-black text-foreground">{value}</p>
      {variation !== undefined && variation !== 0 && (
        <span className={`inline-flex items-center gap-0.5 text-xs font-bold px-2 py-0.5 rounded-full mb-1 ${variation > 0 ? "bg-[#22C55E]/10 text-[#22C55E]" : "bg-[#EF4444]/10 text-[#EF4444]"}`}>
          {variation > 0 ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
          {variation > 0 ? "+" : ""}{variation.toFixed(0)}%
        </span>
      )}
    </div>
    {sub && <p className="text-xs text-muted-foreground mt-1">{sub}</p>}
  </div>
);

export default ExecutiveDashboard;
