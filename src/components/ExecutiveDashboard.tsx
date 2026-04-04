import { useState, useMemo, useEffect } from "react";
import SafeComponent from "@/components/SafeComponent";
import FilterBar from "@/components/FilterBar";
import {
  TrendingUp, TrendingDown, DollarSign, Target, BarChart3, Users,
  AlertTriangle, ArrowUpRight, ArrowDownRight, Gauge,
  Flame, Trophy, Zap, Minus, FileText, Activity,
  Crosshair, Clock, ArrowRight, Eye,
} from "lucide-react";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  Legend as RechartLegend,
} from "recharts";
import { supabase } from "@/integrations/supabase/client";
import type { Deal } from "@/components/DealManager";
import RepHistoryPanel from "@/components/RepHistoryPanel";
import { calcularRiscoMeta } from "@/lib/metaRisk";
import MetaRiskAlerts from "@/components/MetaRiskAlerts";
import { Badge } from "@/components/ui/badge";

interface Props { userId: string; }
interface RepOption { id: string; nome: string; }
interface RepWithGoals extends RepOption { meta_mensal_padrao: number; meta_quantidade: number; }
interface MonthlyGoal { representative_id: string; meta_quantidade: number; meta_valor: number; machine_type: string; mes: number; }

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
  const [activePlan, setActivePlan] = useState<any>(null);
  const [closingDeals, setClosingDeals] = useState<any[]>([]);
  const [weeklyVisits, setWeeklyVisits] = useState<{representative_id: string; quantidade: number; meta: number; semana: number}[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const now = new Date();
  const [filterMonth, setFilterMonth] = useState(now.getMonth() + 1);
  const [filterYear, setFilterYear] = useState(now.getFullYear());
  const [filterRep, setFilterRep] = useState("all");
  const [filterMode, setFilterMode] = useState<"month" | "quarter" | "year">("month");
  const [filterQuarter, setFilterQuarter] = useState<number | null>(null);
  const [showAllReps, setShowAllReps] = useState(false);

  const activeMonths = useMemo(() => {
    if (filterMode === "year") return [1,2,3,4,5,6,7,8,9,10,11,12];
    if (filterMode === "quarter" && filterQuarter !== null) return QUARTERS[filterQuarter].months;
    return [filterMonth];
  }, [filterMode, filterMonth, filterQuarter]);

  const periodLabel = useMemo(() => {
    if (filterMode === "year") return `${filterYear} — Ano Completo`;
    if (filterMode === "quarter" && filterQuarter !== null)
      return `${QUARTERS[filterQuarter].label} ${filterYear} (${SHORT_MONTHS[QUARTERS[filterQuarter].months[0]-1]}–${SHORT_MONTHS[QUARTERS[filterQuarter].months[2]-1]})`;
    return `${MONTHS[filterMonth - 1]} ${filterYear}`;
  }, [filterMode, filterMonth, filterYear, filterQuarter]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoadError(null);
        const [dealsRes, repsRes, goalsRes, planRes, closingRes, visitsRes] = await Promise.all([
          supabase.from("deals" as any).select("*").order("created_at", { ascending: false }),
          supabase.from("representatives" as any).select("id, nome, meta_mensal_padrao, meta_quantidade").eq("status", "ATIVO").order("nome"),
          supabase.from("monthly_goals" as any).select("representative_id, meta_quantidade, meta_valor, machine_type, mes").eq("ano", filterYear),
          supabase.from("strategic_plans" as any).select("*").eq("is_active", true).eq("mes", now.getMonth() + 1).eq("ano", now.getFullYear()).limit(1),
          supabase.from("closing_deals" as any).select("*").eq("status", "ativa"),
          supabase.from("weekly_visits" as any).select("representative_id, quantidade, meta, semana").eq("ano", filterYear),
        ]);
        if (dealsRes.data) setDeals(dealsRes.data as unknown as Deal[]);
        if (repsRes.data) {
          const r = repsRes.data as unknown as RepWithGoals[];
          setReps(r.map(x => ({ id: x.id, nome: x.nome })));
          setRepsWithGoals(r);
        }
        if (goalsRes.data) setMonthlyGoals(goalsRes.data as unknown as MonthlyGoal[]);
        if (planRes.data && (planRes.data as any[]).length > 0) setActivePlan((planRes.data as any[])[0]);
        if (closingRes.data) setClosingDeals(closingRes.data as any[]);
        if (visitsRes.data) setWeeklyVisits(visitsRes.data as any[]);
      } catch (err) {
        console.error("ExecutiveDashboard fetchData error:", err);
        setLoadError("Não foi possível carregar os dados do dashboard.");
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  useEffect(() => {
    const fetchYearData = async () => {
      try {
        const [goalsRes, visitsRes] = await Promise.all([
          supabase.from("monthly_goals" as any).select("representative_id, meta_quantidade, meta_valor, machine_type, mes").eq("ano", filterYear),
          supabase.from("weekly_visits" as any).select("representative_id, quantidade, meta, semana").eq("ano", filterYear),
        ]);
        if (goalsRes.data) setMonthlyGoals(goalsRes.data as unknown as MonthlyGoal[]);
        if (visitsRes.data) setWeeklyVisits(visitsRes.data as any[]);
      } catch (err) {
        console.error("ExecutiveDashboard fetchYearData error:", err);
      }
    };
    fetchYearData();
  }, [filterYear]);

  // ── helpers ──
  const getMonthClosed = (month: number, year: number, repFilter = "all") =>
    deals.filter(d => {
      if (d.status !== "closed" || !d.closed_at) return false;
      const dt = new Date(d.closed_at);
      return (dt.getMonth()+1) === month && dt.getFullYear() === year && (repFilter === "all" || d.representative_id === repFilter);
    });

  const getMultiMonthClosed = (months: number[], year: number, repFilter = "all") =>
    deals.filter(d => {
      if (d.status !== "closed" || !d.closed_at) return false;
      const dt = new Date(d.closed_at);
      return months.includes(dt.getMonth()+1) && dt.getFullYear() === year && (repFilter === "all" || d.representative_id === repFilter);
    });

  const getRepMeta = (repId: string) => {
    const goals = monthlyGoals.filter(g => g.representative_id === repId && activeMonths.includes(g.mes));
    if (goals.length > 0) return { metaQtd: goals.reduce((s,g) => s+g.meta_quantidade, 0), metaVal: goals.reduce((s,g) => s+g.meta_valor, 0) };
    const rep = repsWithGoals.find(r => r.id === repId);
    const mc = activeMonths.length;
    return { metaQtd: (rep?.meta_quantidade||0)*mc, metaVal: (rep?.meta_mensal_padrao||0)*mc };
  };

  const getPrevPeriodClosed = (repFilter = "all") => {
    if (filterMode === "year") return getMultiMonthClosed([1,2,3,4,5,6,7,8,9,10,11,12], filterYear-1, repFilter);
    if (filterMode === "quarter" && filterQuarter !== null) {
      if (filterQuarter === 0) return getMultiMonthClosed(QUARTERS[3].months, filterYear-1, repFilter);
      return getMultiMonthClosed(QUARTERS[filterQuarter-1].months, filterYear, repFilter);
    }
    const prevM = filterMonth === 1 ? 12 : filterMonth-1;
    const prevY = filterMonth === 1 ? filterYear-1 : filterYear;
    return getMonthClosed(prevM, prevY, repFilter);
  };

  // ── stats ──
  const calcStats = (arr: Deal[]) => ({
    count: arr.length,
    basePrice: arr.reduce((s,d) => s+d.base_price, 0),
    basePriceBrl: arr.reduce((s,d) => s+d.base_price * (d.dollar_rate || 0), 0),
    netProfit: arr.reduce((s,d) => s+d.net_profit, 0),
    grossProfit: arr.reduce((s,d) => s+d.gross_profit, 0),
    sellerComm: arr.reduce((s,d) => s+d.seller_commission_value, 0),
    managerComm: arr.reduce((s,d) => s+d.manager_commission_value, 0),
  });

  const currentDeals = useMemo(() => { try { return getMultiMonthClosed(activeMonths, filterYear, filterRep); } catch(e) { console.error("currentDeals error:", e); return []; } }, [deals, activeMonths, filterYear, filterRep]);
  const prevDeals = useMemo(() => { try { return getPrevPeriodClosed(filterRep); } catch(e) { console.error("prevDeals error:", e); return []; } }, [deals, activeMonths, filterYear, filterRep, filterMode, filterMonth, filterQuarter]);
  const cur = useMemo(() => { try { return calcStats(currentDeals); } catch(e) { console.error("cur error:", e); return { count: 0, basePrice: 0, basePriceBrl: 0, netProfit: 0, grossProfit: 0, sellerComm: 0, managerComm: 0 }; } }, [currentDeals]);
  const prev = useMemo(() => { try { return calcStats(prevDeals); } catch(e) { console.error("prev error:", e); return { count: 0, basePrice: 0, basePriceBrl: 0, netProfit: 0, grossProfit: 0, sellerComm: 0, managerComm: 0 }; } }, [prevDeals]);

  // ── pace ──
  const isCurrentYear = filterYear === now.getFullYear();
  const currentMonthNum = now.getMonth()+1;
  const { totalDaysPeriod, elapsedDays } = useMemo(() => {
    try {
      let total = 0, elapsed = 0;
      for (const m of activeMonths) {
        const d = new Date(filterYear, m, 0).getDate();
        total += d;
        if (isCurrentYear) { if (m < currentMonthNum) elapsed += d; else if (m === currentMonthNum) elapsed += Math.min(now.getDate(), d); }
        else if (filterYear < now.getFullYear()) elapsed += d;
      }
      return { totalDaysPeriod: total, elapsedDays: elapsed };
    } catch(e) { console.error("period calc error:", e); return { totalDaysPeriod: 30, elapsedDays: 0 }; }
  }, [activeMonths, filterYear, isCurrentYear, currentMonthNum]);

  // ── rep ranking ──
  const repRanking = useMemo(() => {
    try {
      return (repsWithGoals || []).map(rep => {
        const rd = getMultiMonthClosed(activeMonths, filterYear, rep.id);
        const s = calcStats(rd);
        const { metaQtd, metaVal } = getRepMeta(rep.id);
        const pctQtd = metaQtd > 0 ? (s.count / metaQtd)*100 : 0;
        const margem = s.basePrice > 0 ? (s.netProfit / s.basePrice)*100 : 0;
        const totalComm = s.sellerComm + s.managerComm;
        return { ...rep, ...s, metaQtd, metaVal, pctQtd, margem, totalComm };
      }).filter(r => r.count > 0 || r.metaQtd > 0).sort((a,b) => b.count - a.count);
    } catch(e) { console.error("repRanking error:", e); return []; }
  }, [repsWithGoals, deals, activeMonths, filterYear, monthlyGoals]);

  // ── 3-month trend ──
  const trend3m = useMemo(() => {
    try {
      const last = activeMonths[activeMonths.length-1] || 1;
      const prev3: number[] = [];
      for (let i = 1; i <= 3; i++) {
        let m = last - i, y = filterYear;
        while (m <= 0) { m += 12; y--; }
        prev3.push(getMonthClosed(m, y, filterRep).length);
      }
      const avg = prev3.reduce((s,v)=>s+v,0)/3;
      const c = cur.count;
      const prevMonth = prev3[0];
      if (c > avg*1.1) return { label: "Crescendo 📈", icon: "up" as const, avg, prevMonth };
      if (c < avg*0.9) return { label: "Em queda 📉", icon: "down" as const, avg, prevMonth };
      return { label: "Estável ➡️", icon: "stable" as const, avg, prevMonth };
    } catch(e) { console.error("trend3m error:", e); return { label: "Estável ➡️", icon: "stable" as const, avg: 0, prevMonth: 0 }; }
  }, [deals, activeMonths, filterYear, filterRep, cur]);

  // ── evolution chart ──
  const evolutionData = useMemo(() => {
    try {
      const last = activeMonths[activeMonths.length-1] || 1;
      const data: { name: string; Faturamento: number; "Lucro Líquido": number; Vendas: number }[] = [];
      for (let i = 5; i >= 0; i--) {
        let m = last - i, y = filterYear;
        while (m <= 0) { m += 12; y--; }
        const closed = getMonthClosed(m, y, filterRep);
        data.push({
          name: `${MONTHS[m-1].slice(0,3)}/${String(y).slice(2)}`,
          Faturamento: Math.round(closed.reduce((s,d)=>s+d.base_price,0)*100)/100,
          "Lucro Líquido": Math.round(closed.reduce((s,d)=>s+d.net_profit,0)*100)/100,
          Vendas: closed.length,
        });
      }
      return data;
    } catch(e) { console.error("evolutionData error:", e); return []; }
  }, [deals, activeMonths, filterYear, filterRep]);

  // ── formatting ──
  const formatUsd = (v: number) => `US$ ${v.toLocaleString("pt-BR",{minimumFractionDigits:2,maximumFractionDigits:2})}`;
  const formatPct = (v: number) => v.toLocaleString("pt-BR",{minimumFractionDigits:1,maximumFractionDigits:1})+"%";
  const formatCompact = (v: number) => {
    if (v >= 1_000_000) return `US$ ${(v/1_000_000).toLocaleString("pt-BR",{minimumFractionDigits:1,maximumFractionDigits:1})}M`;
    if (v >= 1_000) return `US$ ${(v/1_000).toLocaleString("pt-BR",{minimumFractionDigits:1,maximumFractionDigits:1})}k`;
    return formatUsd(v);
  };
  const formatBrlCompact = (v: number) => {
    if (v >= 1_000_000) return `R$ ${(v/1_000_000).toLocaleString("pt-BR",{minimumFractionDigits:1,maximumFractionDigits:1})}M`;
    if (v >= 1_000) return `R$ ${(v/1_000).toLocaleString("pt-BR",{minimumFractionDigits:1,maximumFractionDigits:1})}k`;
    return `R$ ${v.toLocaleString("pt-BR",{minimumFractionDigits:2,maximumFractionDigits:2})}`;
  };

  // When a specific rep is selected, use their individual meta; otherwise sum all
  const totalMetaQtd = useMemo(() => {
    try {
      if (filterRep !== "all") {
        const rep = (repRanking || []).find(r => r.id === filterRep);
        return rep ? rep.metaQtd : 0;
      }
      return (repRanking || []).reduce((s, r) => s + (r.metaQtd || 0), 0);
    } catch(e) { console.error("totalMetaQtd error:", e); return 0; }
  }, [repRanking, filterRep]);


  const totalSold = cur.count;
  const pctAtingido = totalMetaQtd > 0 ? (totalSold/totalMetaQtd)*100 : 0;
  const faltam = Math.max(0, totalMetaQtd - totalSold);
  const diasRestantes = Math.max(0, totalDaysPeriod - elapsedDays);
  const semanasPassadas = Math.max(1, elapsedDays/7);
  const semanasRestantes = Math.max(0.1, diasRestantes/7);
  const ritmoAtual = totalSold / semanasPassadas;
  const ritmoNecessario = diasRestantes > 0 ? faltam / semanasRestantes : 0;
  const noRitmo = faltam <= 0 || ritmoAtual >= ritmoNecessario;

  // Projeção
  const projQtd = elapsedDays > 0 ? Math.round((totalSold / elapsedDays) * totalDaysPeriod) : 0;
  const projPct = totalMetaQtd > 0 ? (projQtd / totalMetaQtd)*100 : 0;

  const ticketMedio = cur.count > 0 ? cur.basePrice / cur.count : 0;
  const margemMedia = cur.basePrice > 0 ? (cur.netProfit / cur.basePrice)*100 : 0;
  const commTotal = cur.sellerComm + cur.managerComm;

  const calcVar = (c: number, p: number) => { if (p === 0) return c > 0 ? 100 : 0; return ((c-p)/p)*100; };
  const vendasVar = calcVar(cur.count, prev.count);

  const handleFilterPeriodMode = (mode: "month" | "quarter" | "year") => {
    if (mode === "month") { setFilterMode("month"); setFilterQuarter(null); }
    else if (mode === "year") { setFilterMode("year"); setFilterQuarter(null); }
  };
  const handleFilterQuarter = (q: string) => {
    const idx = ["T1","T2","T3","T4"].indexOf(q);
    setFilterMode("quarter"); setFilterQuarter(idx >= 0 ? idx : 0);
  };
  const filterQuarterStr = filterQuarter !== null ? `T${filterQuarter + 1}` : "T1";

  const statusColor = (pct: number) => pct >= 100 ? "text-[#22C55E]" : pct >= 70 ? "text-[#F97316]" : "text-[#EF4444]";
  const statusBg = (pct: number) => pct >= 100 ? "bg-[#22C55E]" : pct >= 70 ? "bg-[#F97316]" : "bg-[#EF4444]";
  const statusBgLight = (pct: number) => pct >= 100 ? "bg-[#22C55E]/10" : pct >= 70 ? "bg-[#F97316]/10" : "bg-[#EF4444]/10";
  const statusLabel = (pct: number) => pct >= 100 ? "✓ Meta batida" : pct >= 70 ? "No ritmo" : "Abaixo";

  const sortedRanking = repRanking;
  const displayedRanking = showAllReps ? sortedRanking : sortedRanking.slice(0,5);
  const topPerformer = sortedRanking.length > 0 ? sortedRanking[0] : null;

  // ── Atividade da Equipe (visitas) ──
  const visitStats = useMemo(() => {
    try {
      // Compute which ISO weeks belong to active months
      const weeksInPeriod = new Set<number>();
      for (const m of activeMonths) {
        const daysInMonth = new Date(filterYear, m, 0).getDate();
        for (let d = 1; d <= daysInMonth; d++) {
          const dt = new Date(filterYear, m - 1, d);
          const jan1 = new Date(filterYear, 0, 1);
          const dayOfYear = Math.floor((dt.getTime() - jan1.getTime()) / 86400000) + 1;
          const weekNum = Math.ceil(dayOfYear / 7);
          weeksInPeriod.add(weekNum);
        }
      }

      const filtered = weeklyVisits.filter(v => {
        if (!weeksInPeriod.has(v.semana)) return false;
        if (filterRep !== "all" && v.representative_id !== filterRep) return false;
        return true;
      });

      const totalVisitas = filtered.reduce((s, v) => s + v.quantidade, 0);
      const totalMeta = filtered.reduce((s, v) => s + v.meta, 0);

      // Count distinct active reps
      const activeRepIds = new Set(repsWithGoals.map(r => r.id));
      const repsWithVisits = filterRep !== "all" ? 1 : activeRepIds.size;
      const media = repsWithVisits > 0 ? totalVisitas / repsWithVisits : 0;
      const pctMeta = totalMeta > 0 ? (totalVisitas / totalMeta) * 100 : 0;

      // Per-rep visit totals
      const perRep = new Map<string, number>();
      const allFiltered = weeklyVisits.filter(v => weeksInPeriod.has(v.semana));
      for (const v of allFiltered) {
        perRep.set(v.representative_id, (perRep.get(v.representative_id) || 0) + v.quantidade);
      }

      return { totalVisitas, media, pctMeta, totalMeta, perRep };
    } catch (e) {
      console.error("visitStats error:", e);
      return { totalVisitas: 0, media: 0, pctMeta: 0, totalMeta: 0, perRep: new Map<string, number>() };
    }
  }, [weeklyVisits, activeMonths, filterYear, filterRep, repsWithGoals]);

  // ── 6) RESUMO EXECUTIVO ──
  const resumoExecutivo = (() => {
    try {
      const lines: string[] = [];
      if (pctAtingido >= 100) {
        lines.push(`🏆 Meta superada! Equipe atingiu ${formatPct(pctAtingido)} da meta com ${totalSold} máquinas vendidas.`);
      } else if (pctAtingido >= 70) {
        lines.push(`📊 Equipe vendeu ${totalSold} de ${totalMetaQtd} máquinas (${formatPct(pctAtingido)}). Faltam ${faltam} para bater a meta.`);
      } else {
        lines.push(`⚠️ Atenção: equipe vendeu apenas ${totalSold} de ${totalMetaQtd} máquinas (${formatPct(pctAtingido)}). Ritmo precisa acelerar.`);
      }
      const positivos: string[] = [];
      if (topPerformer && topPerformer.pctQtd >= 100) positivos.push(`${topPerformer.nome} já bateu a meta individual`);
      if (vendasVar > 10) positivos.push(`vendas ${vendasVar.toFixed(0)}% acima do período anterior`);
      if (margemMedia > 15) positivos.push(`margem média saudável de ${formatPct(margemMedia)}`);
      if (noRitmo && faltam > 0) positivos.push(`ritmo atual é suficiente para bater a meta`);
      if (positivos.length > 0) lines.push(`✅ Destaques: ${positivos.join("; ")}.`);
      const alertas: string[] = [];
      const repsAbaixo = (repRanking || []).filter(r => r.metaQtd > 0 && r.pctQtd < 70);
      if (repsAbaixo.length > 0) alertas.push(`${repsAbaixo.length} representante${repsAbaixo.length > 1 ? "s" : ""} abaixo de 70% da meta`);
      if (!noRitmo && diasRestantes > 0) alertas.push(`ritmo atual (${ritmoAtual.toFixed(1)}/sem) abaixo do necessário (${ritmoNecessario.toFixed(1)}/sem)`);
      if (margemMedia < 5 && cur.count > 0) alertas.push(`margem média baixa (${formatPct(margemMedia)})`);
      if (trend3m.icon === "down") alertas.push(`tendência de queda nos últimos 3 meses`);
      if (alertas.length > 0) lines.push(`🔴 Alertas: ${alertas.join("; ")}.`);
      return lines;
    } catch(e) { console.error("resumoExecutivo error:", e); return ["Não foi possível gerar o resumo."]; }
  })();

  return (
    <SafeComponent loading={loading} error={loadError} onRetry={() => window.location.reload()}>
    <div className="space-y-8 animate-fade-in">
      {/* ═══ HEADER ═══ */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-heading text-lg sm:text-2xl font-bold text-foreground flex items-center gap-2">
            <Flame className="h-5 w-5 sm:h-6 sm:w-6 text-[#F97316]" />
            Reunião Comercial
          </h2>
          <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">{periodLabel}</p>
        </div>
      </div>

      <FilterBar
        year={filterYear}
        onYearChange={setFilterYear}
        periodMode={filterMode}
        onPeriodModeChange={handleFilterPeriodMode}
        month={filterMonth}
        onMonthChange={(m) => { setFilterMonth(m); setFilterMode("month"); setFilterQuarter(null); }}
        quarter={filterQuarterStr}
        onQuarterChange={handleFilterQuarter}
        showRep
        rep={filterRep}
        onRepChange={setFilterRep}
        reps={reps}
      />

      {/* ═══ 1) STATUS DO MÊS ═══ */}
      <section className="bg-gradient-to-br from-[#1E293B] to-[#0F172A] rounded-2xl p-4 sm:p-6 md:p-8 text-white shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-white/[0.02] rounded-full -translate-y-32 translate-x-32" />
        <div className="absolute bottom-0 left-0 w-48 h-48 bg-white/[0.02] rounded-full translate-y-24 -translate-x-24" />
        <div className="relative">
          <div className="flex items-center gap-2 mb-4 sm:mb-6">
            <Target className="h-4 w-4 sm:h-5 sm:w-5 text-[#3B82F6]" />
            <h3 className="font-heading text-sm sm:text-lg font-bold uppercase tracking-wider">Status do Período</h3>
          </div>

          <div className={`grid grid-cols-3 ${activePlan ? "md:grid-cols-6" : "md:grid-cols-5"} gap-3 sm:gap-4 md:gap-6 mb-4 sm:mb-6`}>
            <div>
              <p className="text-white/50 text-[10px] sm:text-xs uppercase tracking-wider mb-1">Meta Oficial</p>
              <p className="font-heading text-2xl sm:text-4xl font-black">{totalMetaQtd}</p>
            </div>
            {activePlan && (
              <div>
                <p className="text-white/50 text-[10px] sm:text-xs uppercase tracking-wider mb-1">Meta Planejada</p>
                <p className="font-heading text-2xl sm:text-4xl font-black text-[#3B82F6]">{totalMetaQtd + activePlan.qty_machines}</p>
                <p className="text-[10px] text-white/40 mt-0.5 hidden sm:block">+{activePlan.qty_machines} máq.</p>
              </div>
            )}
            <div>
              <p className="text-white/50 text-[10px] sm:text-xs uppercase tracking-wider mb-1">Vendidas</p>
              <p className="font-heading text-2xl sm:text-4xl font-black text-[#22C55E]">{totalSold}</p>
            </div>
            <div>
              <p className="text-white/50 text-[10px] sm:text-xs uppercase tracking-wider mb-1">Projeção</p>
              <p className={`font-heading text-2xl sm:text-4xl font-black ${projPct >= 100 ? "text-[#22C55E]" : projPct >= 70 ? "text-[#F97316]" : "text-[#EF4444]"}`}>{projQtd}</p>
            </div>
            <div>
              <p className="text-white/50 text-[10px] sm:text-xs uppercase tracking-wider mb-1">% Atingido</p>
              <p className={`font-heading text-2xl sm:text-4xl font-black ${statusColor(pctAtingido)}`}>{formatPct(pctAtingido)}</p>
            </div>
            <div>
              <p className="text-white/50 text-[10px] sm:text-xs uppercase tracking-wider mb-1">Faltam</p>
              <p className={`font-heading text-2xl sm:text-4xl font-black ${faltam === 0 ? "text-[#22C55E]" : "text-white"}`}>{faltam}</p>
            </div>
          </div>

          {/* Dual progress bars when plan exists */}
          {activePlan && (
            <div className="mb-2">
              <div className="flex justify-between text-[10px] text-white/40 mb-1">
                <span>Meta Oficial: {totalMetaQtd}</span>
                <span>Meta Planejada: {totalMetaQtd + activePlan.qty_machines}</span>
              </div>
            </div>
          )}

          {/* Progress bar */}
          <div className="w-full h-4 bg-white/10 rounded-full overflow-hidden mb-3">
            <div className={`h-full rounded-full transition-all duration-1000 ${pctAtingido >= 100 ? "bg-[#22C55E]" : pctAtingido >= 70 ? "bg-[#F97316]" : "bg-[#EF4444]"}`} style={{ width: `${Math.min(pctAtingido, 100)}%` }} />
          </div>

          {/* Frase automática */}
          <p className="text-white/70 text-sm leading-relaxed">
            {faltam === 0
              ? `🏆 Meta batida! Equipe já vendeu ${totalSold} máquinas no período.`
              : `No ritmo atual fecharemos ${projQtd} máquinas. Faltam ${faltam} para a meta.`}
            {vendasVar !== 0 && (
              <span className={`ml-2 inline-flex items-center gap-0.5 text-xs font-bold px-2 py-0.5 rounded-full ${vendasVar > 0 ? "bg-[#22C55E]/20 text-[#22C55E]" : "bg-[#EF4444]/20 text-[#EF4444]"}`}>
                {vendasVar > 0 ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
                {vendasVar > 0 ? "+" : ""}{vendasVar.toFixed(0)}% vs anterior
              </span>
            )}
          </p>
        </div>
      </section>

      {/* ═══ ATIVIDADE DA EQUIPE ═══ */}
      <section>
        <div className="flex items-center gap-2 mb-4">
          <Users className="h-5 w-5 text-[#8B5CF6]" />
          <h3 className="font-heading text-lg font-bold text-foreground">Atividade da Equipe</h3>
        </div>
        <div className="grid gap-3 sm:gap-4 grid-cols-1 sm:grid-cols-3">
          <MetricCard label="Total de Visitas" value={String(visitStats.totalVisitas)} icon={<Users className="h-5 w-5" />} color="#8B5CF6" sub={`no período`} />
          <MetricCard label="Média por Vendedor" value={visitStats.media.toFixed(1)} icon={<BarChart3 className="h-5 w-5" />} color="#3B82F6" sub="visitas / rep" />
          <MetricCard label="% Meta de Visitas" value={formatPct(visitStats.pctMeta)} icon={<Target className="h-5 w-5" />} color={visitStats.pctMeta >= 100 ? "#22C55E" : visitStats.pctMeta >= 70 ? "#F97316" : "#EF4444"} sub={`${visitStats.totalVisitas} de ${visitStats.totalMeta}`} />
        </div>
      </section>

      {sortedRanking.length > 0 && (
        <section>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Trophy className="h-5 w-5 text-[#F97316]" />
              <h3 className="font-heading text-lg font-bold text-foreground">Ranking da Equipe</h3>
            </div>
            {sortedRanking.length > 5 && (
              <button onClick={() => setShowAllReps(!showAllReps)} className="text-xs font-semibold text-[#3B82F6] hover:underline">
                {showAllReps ? "Mostrar menos" : "Ver todos"}
              </button>
            )}
          </div>
          <div className="space-y-2">
            {displayedRanking.map((rep, idx) => {
              const faltaRep = Math.max(0, rep.metaQtd - rep.count);
              const pct = rep.pctQtd;
              const medal = idx === 0 ? "🥇" : idx === 1 ? "🥈" : idx === 2 ? "🥉" : `${idx+1}º`;
              const bg = idx === 0 ? "bg-primary/5 border-primary/30"
                : idx === 1 ? "bg-muted/50 border-border"
                : idx === 2 ? "bg-[#F97316]/5 border-[#F97316]/20"
                : "bg-card border-border";

              return (
                <div key={rep.id} onClick={() => setFilterRep(rep.id)} className={`rounded-xl border p-3 sm:p-4 flex items-center gap-2 sm:gap-4 shadow-sm hover:shadow-md transition-shadow cursor-pointer ${bg}`}>
                  <span className="text-lg sm:text-2xl w-7 sm:w-10 text-center flex-shrink-0">{medal}</span>
                  <div className="h-8 w-8 sm:h-10 sm:w-10 rounded-full bg-muted flex items-center justify-center text-xs sm:text-sm font-bold text-foreground flex-shrink-0">
                    {rep.nome.charAt(0)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-heading text-sm sm:text-base font-bold text-foreground truncate">{rep.nome}</p>
                    <div className="flex items-center gap-2 sm:gap-3 mt-0.5 sm:mt-1 flex-wrap">
                      <span className="text-[10px] sm:text-xs text-muted-foreground">Meta: <b>{rep.metaQtd}</b></span>
                      <span className="text-[10px] sm:text-xs font-semibold text-foreground">Vendido: <b>{rep.count}</b></span>
                      <span className="text-[10px] sm:text-xs text-muted-foreground">Visitas: <b>{visitStats.perRep.get(rep.id) || 0}</b></span>
                      <span className={`text-[10px] sm:text-xs font-bold ${statusColor(pct)}`}>{formatPct(pct)}</span>
                      {faltaRep > 0 && <span className="text-[10px] sm:text-xs text-muted-foreground hidden sm:inline">Faltam: <b>{faltaRep}</b></span>}
                    </div>
                    {/* Mini progress */}
                    <div className="w-full max-w-[200px] h-1.5 bg-muted rounded-full mt-1.5 sm:mt-2 overflow-hidden">
                      <div className={`h-full rounded-full transition-all duration-700 ${statusBg(pct)}`} style={{ width: `${Math.min(pct, 100)}%` }} />
                    </div>
                  </div>
                  <div className="flex-shrink-0 text-right hidden sm:block">
                    <span className={`inline-flex items-center text-xs font-bold uppercase px-2.5 py-1 rounded-full ${statusBgLight(pct)} ${statusColor(pct)}`}>
                      {statusLabel(pct)}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* ═══ 3) RITMO COMERCIAL ═══ */}
      <section className="grid gap-3 sm:gap-4 grid-cols-1 md:grid-cols-2">
        <div className="bg-card rounded-xl border border-border p-4 sm:p-6 shadow-sm">
          <div className="flex items-center gap-2 mb-3 sm:mb-4">
            <div className="h-8 w-8 sm:h-10 sm:w-10 rounded-lg bg-[#3B82F6]/10 flex items-center justify-center">
              <Activity className="h-4 w-4 sm:h-5 sm:w-5 text-[#3B82F6]" />
            </div>
            <div>
              <h4 className="text-[10px] sm:text-xs font-semibold text-muted-foreground uppercase">Ritmo Atual</h4>
              <p className="font-heading text-xl sm:text-3xl font-black text-foreground">{ritmoAtual.toFixed(1)} <span className="text-sm sm:text-lg text-muted-foreground">/ semana</span></p>
            </div>
          </div>
          <div className={`rounded-lg px-4 py-3 ${noRitmo ? "bg-[#22C55E]/10" : "bg-[#EF4444]/10"}`}>
            <p className={`text-sm font-medium ${noRitmo ? "text-[#22C55E]" : "text-[#EF4444]"}`}>
              {noRitmo
                ? faltam === 0
                  ? "✓ Meta já foi atingida! Manter o momento."
                  : `✓ Ritmo atual é suficiente. Continue vendendo ${ritmoAtual.toFixed(1)} máquinas/semana para bater a meta.`
                : `⚠ Ritmo insuficiente. É necessário acelerar para ${ritmoNecessario.toFixed(1)} máquinas/semana nos próximos ${Math.ceil(diasRestantes)} dias.`
              }
            </p>
          </div>
        </div>
        <div className="bg-card rounded-xl border border-border p-6 shadow-sm">
          <div className="flex items-center gap-2 mb-4">
            <div className={`h-10 w-10 rounded-lg flex items-center justify-center ${noRitmo ? "bg-[#22C55E]/10" : "bg-[#EF4444]/10"}`}>
              <Gauge className={`h-5 w-5 ${noRitmo ? "text-[#22C55E]" : "text-[#EF4444]"}`} />
            </div>
            <div>
              <h4 className="text-xs font-semibold text-muted-foreground uppercase">Ritmo Necessário</h4>
              <p className="font-heading text-3xl font-black text-foreground">{faltam === 0 ? "0.0" : ritmoNecessario.toFixed(1)} <span className="text-lg text-muted-foreground">/ semana</span></p>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="text-center bg-muted/50 rounded-lg py-2">
              <p className="text-xs text-muted-foreground">Dias passados</p>
              <p className="font-heading text-xl font-black text-foreground">{elapsedDays}</p>
            </div>
            <div className="text-center bg-muted/50 rounded-lg py-2">
              <p className="text-xs text-muted-foreground">Dias restantes</p>
              <p className="font-heading text-xl font-black text-foreground">{diasRestantes}</p>
            </div>
            <div className="text-center bg-muted/50 rounded-lg py-2">
              <p className="text-xs text-muted-foreground">Total dias</p>
              <p className="font-heading text-xl font-black text-foreground">{totalDaysPeriod}</p>
            </div>
          </div>
        </div>
      </section>

      {/* ═══ 4) RESULTADO FINANCEIRO ═══ */}
      <section>
        <div className="flex items-center gap-2 mb-4">
          <DollarSign className="h-5 w-5 text-[#22C55E]" />
          <h3 className="font-heading text-lg font-bold text-foreground">Resultado Financeiro</h3>
        </div>
        <div className="grid gap-3 sm:gap-4 grid-cols-2 md:grid-cols-4">
          <MetricCard label="FOB Total" value={cur.count > 0 ? formatCompact(cur.basePrice) : "—"} icon={<DollarSign className="h-5 w-5" />} color="#3B82F6" sub={`${cur.count} vendas`} />
          <MetricCard label="Ticket Médio" value={cur.count > 0 ? formatCompact(ticketMedio) : "—"} icon={<BarChart3 className="h-5 w-5" />} color="#8B5CF6" sub="FOB / máquina" />
          <MetricCard label="Margem Média" value={cur.count > 0 ? formatPct(margemMedia) : "—"} icon={<Zap className="h-5 w-5" />} color={margemMedia >= 0 ? "#22C55E" : "#EF4444"} sub="Lucro líq. / preço base" />
          <MetricCard label="FOB Total BRL" value={cur.count > 0 ? formatBrlCompact(cur.basePriceBrl) : "—"} icon={<DollarSign className="h-5 w-5" />} color="#F97316" sub="Convertido em R$" />
        </div>
      </section>

      {/* ═══ 5) TENDÊNCIA ═══ */}
      <section>
        <div className="flex items-center gap-2 mb-4">
          <TrendingUp className="h-5 w-5 text-[#3B82F6]" />
          <h3 className="font-heading text-lg font-bold text-foreground">Tendência</h3>
        </div>
        <div className="grid gap-3 sm:gap-4 grid-cols-1 md:grid-cols-3">
          {/* Trend card */}
           <div className="bg-card rounded-xl border border-border p-5 shadow-sm">
            <div className="flex items-center gap-3 mb-3">
              <div className={`h-10 w-10 rounded-lg flex items-center justify-center ${trend3m.icon === "up" ? "bg-[#22C55E]/10" : trend3m.icon === "down" ? "bg-[#EF4444]/10" : "bg-[#F97316]/10"}`}>
                {trend3m.icon === "up" ? <TrendingUp className="h-5 w-5 text-[#22C55E]" /> : trend3m.icon === "down" ? <TrendingDown className="h-5 w-5 text-[#EF4444]" /> : <Minus className="h-5 w-5 text-[#F97316]" />}
              </div>
              <span className="text-xs font-semibold text-muted-foreground uppercase">Direção</span>
            </div>
            <p className={`font-heading text-2xl font-black ${trend3m.icon === "up" ? "text-[#22C55E]" : trend3m.icon === "down" ? "text-[#EF4444]" : "text-[#F97316]"}`}>{trend3m.label}</p>
            <p className="text-xs text-muted-foreground mt-1">vs média últimos 3 meses</p>
          </div>
          {/* Comparison */}
          <div className="bg-card rounded-xl border border-border p-5 shadow-sm">
            <h4 className="text-xs font-semibold text-muted-foreground uppercase mb-3">Comparativos</h4>
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Mês anterior</span>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold text-foreground">{trend3m.prevMonth} vendas</span>
                  {vendasVar !== 0 && <span className={`text-xs font-bold ${vendasVar > 0 ? "text-[#22C55E]" : "text-[#EF4444]"}`}>{vendasVar > 0 ? "+" : ""}{vendasVar.toFixed(0)}%</span>}
                </div>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Média 3 meses</span>
                <span className="text-sm font-bold text-foreground">{trend3m.avg.toFixed(1)} vendas</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Período atual</span>
                <span className="text-sm font-black text-foreground">{cur.count} vendas</span>
              </div>
            </div>
          </div>
          {/* Evolution mini-chart */}
          <div className="bg-card rounded-xl border border-border p-5 shadow-sm">
            <h4 className="text-xs font-semibold text-muted-foreground uppercase mb-3">Evolução 6 Meses</h4>
            <ResponsiveContainer width="100%" height={120}>
              <AreaChart data={evolutionData}>
                <defs>
                  <linearGradient id="gradTrend" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.2} />
                    <stop offset="95%" stopColor="#3B82F6" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#9CA3AF' }} axisLine={false} tickLine={false} />
                <Area type="monotone" dataKey="Faturamento" stroke="#3B82F6" fill="url(#gradTrend)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      </section>

      {/* ═══ EVOLUÇÃO COMPLETA ═══ */}
      <section>
        <div className="bg-card rounded-xl border border-border p-6 shadow-sm">
          <h4 className="text-xs font-semibold text-muted-foreground uppercase mb-4 flex items-center gap-2">
            <BarChart3 className="h-4 w-4 text-[#3B82F6]" /> Evolução Detalhada (6 meses)
          </h4>
          <ResponsiveContainer width="100%" height={260}>
            <AreaChart data={evolutionData}>
              <defs>
                <linearGradient id="gradFat2" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.15} />
                  <stop offset="95%" stopColor="#3B82F6" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="gradLucro2" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#22C55E" stopOpacity={0.15} />
                  <stop offset="95%" stopColor="#22C55E" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
              <XAxis dataKey="name" tick={{ fontSize: 12, fill: '#6B7280' }} />
              <YAxis tick={{ fontSize: 11, fill: '#6B7280' }} />
              <Tooltip formatter={(v: number) => formatUsd(v)} contentStyle={{ fontSize: 12, borderRadius: 12, background: '#fff', border: '1px solid #E5E7EB', boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }} />
              <Area type="monotone" dataKey="Faturamento" stroke="#3B82F6" fill="url(#gradFat2)" strokeWidth={2.5} />
              <Area type="monotone" dataKey="Lucro Líquido" stroke="#22C55E" fill="url(#gradLucro2)" strokeWidth={2.5} />
              <RechartLegend wrapperStyle={{ fontSize: 12 }} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </section>

      {/* ═══ 6) RESUMO EXECUTIVO ═══ */}
      <section className="bg-gradient-to-br from-[#1E293B] to-[#334155] rounded-2xl p-6 md:p-8 text-white shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-48 h-48 bg-white/[0.03] rounded-full -translate-y-20 translate-x-20" />
        <div className="relative">
          <div className="flex items-center gap-2 mb-5">
            <FileText className="h-5 w-5 text-[#3B82F6]" />
            <h3 className="font-heading text-lg font-bold uppercase tracking-wider">Resumo Executivo</h3>
          </div>
          <div className="space-y-3">
            {resumoExecutivo.map((line, i) => (
              <p key={i} className="text-sm leading-relaxed text-white/90">{line}</p>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ 7) RADAR DE FECHAMENTO ═══ */}
      {closingDeals.length > 0 && (() => {
        const fmtUsd = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "USD" }).replace("US$", "US$ ");
        const totalVal = closingDeals.reduce((s: number, d: any) => s + (d.deal_value || 0), 0);
        const totalMach = closingDeals.reduce((s: number, d: any) => s + (d.quantity || 0), 0);
        const ticket = closingDeals.length > 0 ? totalVal / closingDeals.length : 0;
        const alta = closingDeals.filter((d: any) => d.probability === "Alta");
        const media = closingDeals.filter((d: any) => d.probability === "Média");
        const baixa = closingDeals.filter((d: any) => d.probability === "Baixa");
        const daysSince = (s: string) => Math.floor((Date.now() - new Date(s).getTime()) / 86400000);
        const alertOver30 = closingDeals.filter((d: any) => daysSince(d.start_date) > 30);
        const alertNoNext = closingDeals.filter((d: any) => !d.next_step);
        const alertNearDate = closingDeals.filter((d: any) => {
          if (!d.expected_close_date) return false;
          const diff = Math.floor((new Date(d.expected_close_date).getTime() - Date.now()) / 86400000);
          return diff >= 0 && diff <= 7;
        });
        const alertRisk = closingDeals.filter((d: any) => d.risk_reason);
        const top5 = [...closingDeals].sort((a: any, b: any) => {
          const probW: Record<string, number> = { Alta: 3, Média: 2, Baixa: 1 };
          return (b.deal_value || 0) * (probW[b.probability] || 1) - (a.deal_value || 0) * (probW[a.probability] || 1);
        }).slice(0, 5);
        const repNm = (id: string | null) => reps.find(r => r.id === id)?.nome || "—";

        return (
          <>
            <section>
              <div className="flex items-center gap-2 mb-4">
                <Crosshair className="h-5 w-5 text-primary" />
                <h3 className="font-heading text-base font-bold text-foreground uppercase tracking-wider">Pipeline em Fechamento</h3>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <MetricCard label="Negociações Ativas" value={String(closingDeals.length)} icon={<Crosshair className="h-4 w-4" />} color="#3B82F6" />
                <MetricCard label="Valor Total" value={fmtUsd(totalVal)} icon={<DollarSign className="h-4 w-4" />} color="#22C55E" />
                <MetricCard label="Máquinas" value={String(totalMach)} icon={<Target className="h-4 w-4" />} color="#8B5CF6" />
                <MetricCard label="Ticket Médio" value={fmtUsd(ticket)} icon={<TrendingUp className="h-4 w-4" />} color="#F59E0B" />
              </div>
            </section>

            <section>
              <div className="flex items-center gap-2 mb-4">
                <Gauge className="h-5 w-5 text-primary" />
                <h3 className="font-heading text-base font-bold text-foreground uppercase tracking-wider">Previsão de Fechamento</h3>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {[
                  { label: "Alta Probabilidade", items: alta, color: "#22C55E", bg: "bg-green-500/10 border-green-500/20" },
                  { label: "Média Probabilidade", items: media, color: "#F59E0B", bg: "bg-yellow-500/10 border-yellow-500/20" },
                  { label: "Baixa Probabilidade", items: baixa, color: "#EF4444", bg: "bg-red-500/10 border-red-500/20" },
                ].map(({ label, items, color, bg }) => (
                  <div key={label} className={`rounded-xl border p-4 ${bg}`}>
                    <p className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color }}>{label}</p>
                    <div className="flex justify-between">
                      <div>
                        <p className="font-heading text-2xl font-black text-foreground">{items.reduce((s: number, d: any) => s + (d.quantity || 0), 0)}</p>
                        <p className="text-xs text-muted-foreground">máquinas</p>
                      </div>
                      <div className="text-right">
                        <p className="font-heading text-lg font-bold text-foreground">{fmtUsd(items.reduce((s: number, d: any) => s + (d.deal_value || 0), 0))}</p>
                        <p className="text-xs text-muted-foreground">{items.length} negociações</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            {(alertOver30.length > 0 || alertNoNext.length > 0 || baixa.length > 0 || alertNearDate.length > 0 || alertRisk.length > 0) && (
              <section>
                <div className="flex items-center gap-2 mb-4">
                  <AlertTriangle className="h-5 w-5 text-yellow-500" />
                  <h3 className="font-heading text-base font-bold text-foreground uppercase tracking-wider">Alertas do Gestor</h3>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                  {[
                    { label: "> 30 dias", count: alertOver30.length, icon: <Clock className="h-4 w-4" />, color: "#F59E0B" },
                    { label: "Sem próximo passo", count: alertNoNext.length, icon: <ArrowRight className="h-4 w-4" />, color: "#EF4444" },
                    { label: "Baixa prob.", count: baixa.length, icon: <TrendingDown className="h-4 w-4" />, color: "#EF4444" },
                    { label: "Fecham em 7d", count: alertNearDate.length, icon: <Flame className="h-4 w-4" />, color: "#F97316" },
                    { label: "Com risco", count: alertRisk.length, icon: <AlertTriangle className="h-4 w-4" />, color: "#EF4444" },
                  ].map(({ label, count, icon, color }) => count > 0 ? (
                    <div key={label} className="bg-card rounded-xl border border-border p-3 text-center">
                      <div className="h-8 w-8 mx-auto rounded-lg flex items-center justify-center mb-1" style={{ backgroundColor: `${color}15`, color }}>{icon}</div>
                      <p className="font-heading text-xl font-black text-foreground">{count}</p>
                      <p className="text-[10px] text-muted-foreground">{label}</p>
                    </div>
                  ) : null)}
                </div>

                {/* Meta em Risco */}
                {(() => {
                  const metaRiscos = calcularRiscoMeta(
                    repRanking.map(r => ({ id: r.id, nome: r.nome, metaValor: r.metaQtd, vendido: r.count })),
                    new Date().getDate()
                  );
                  if (metaRiscos.length === 0) return null;
                  return (
                    <div className="mt-4">
                      <div className="flex items-center gap-2 mb-3">
                        <Badge variant="destructive" className="text-[10px]">Meta em Risco</Badge>
                      </div>
                      <MetaRiskAlerts riscos={metaRiscos} />
                    </div>
                  );
                })()}
              </section>
            )}

            <section>
              <div className="flex items-center gap-2 mb-4">
                <Trophy className="h-5 w-5 text-yellow-500" />
                <h3 className="font-heading text-base font-bold text-foreground uppercase tracking-wider">Top 5 Prioridades</h3>
              </div>
              <div className="space-y-2">
                {top5.map((d: any, i: number) => (
                  <div key={d.id} className="flex items-center gap-3 bg-card rounded-xl border border-border p-3">
                    <div className="h-8 w-8 rounded-lg flex items-center justify-center font-heading font-black text-sm shrink-0"
                      style={{ backgroundColor: i === 0 ? '#F59E0B15' : '#3B82F615', color: i === 0 ? '#F59E0B' : '#3B82F6' }}>
                      {i + 1}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-foreground truncate">{d.client_name}</p>
                      <p className="text-xs text-muted-foreground">{repNm(d.representative_id)} · {d.machine_name || d.machine_type}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-sm font-bold text-foreground">{fmtUsd(d.deal_value)}</p>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${
                        d.probability === "Alta" ? "bg-green-500/15 text-green-400" :
                        d.probability === "Média" ? "bg-yellow-500/15 text-yellow-400" :
                        "bg-red-500/15 text-red-400"
                      }`}>{d.probability}</span>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          </>
        );
      })()}

      {/* ═══ HISTÓRICO INDIVIDUAL ═══ */}
      {filterRep !== "all" && (
        <RepHistoryPanel
          repId={filterRep}
          repName={reps.find(r => r.id === filterRep)?.nome || ""}
          deals={deals}
          repsWithGoals={repsWithGoals}
          monthlyGoals={monthlyGoals}
          filterYear={filterYear}
        />
      )}
    </div>
    </SafeComponent>
  );
};

/* --- Sub-component --- */
const MetricCard = ({ label, value, icon, color, sub }: {
  label: string; value: string; icon: React.ReactNode; color: string; sub?: string;
}) => (
  <div className="bg-card rounded-xl border border-border p-2.5 sm:p-5 shadow-sm hover:shadow-md transition-shadow">
    <div className="flex items-center gap-1.5 sm:gap-3 mb-1.5 sm:mb-3">
      <div className="h-7 w-7 sm:h-10 sm:w-10 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: `${color}15`, color }}>{icon}</div>
      <span className="text-[9px] sm:text-xs font-semibold text-muted-foreground uppercase leading-tight">{label}</span>
    </div>
    <p className="font-heading text-sm sm:text-2xl font-black text-foreground truncate">{value}</p>
    {sub && <p className="text-[9px] sm:text-xs text-muted-foreground mt-0.5 sm:mt-1">{sub}</p>}
  </div>
);

export default ExecutiveDashboard;
