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

  const handleFilterPeriodMode = (mode: "month" | "quarter" | "year" | "week") => {
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
    <div className="space-y-8 animate-fade-in min-h-screen rounded-2xl p-4 sm:p-6 lg:p-8" style={{ background: 'linear-gradient(145deg, #0f1729 0%, #162033 40%, #1a2744 100%)' }}>
      {/* ═══ HEADER ═══ */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-heading text-lg sm:text-2xl font-bold text-white flex items-center gap-2">
            <Flame className="h-5 w-5 sm:h-6 sm:w-6 text-[#F97316]" />
            Reunião Comercial
          </h2>
          <p className="text-xs sm:text-sm text-white/40 mt-0.5">{periodLabel}</p>
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

      {/* ═══ 1) HERO — MÁQUINAS VENDIDAS ═══ */}
      <section className="grid gap-5 lg:grid-cols-[1.6fr_1fr] lg:items-stretch">
        <div className="rounded-2xl p-6 sm:p-8 shadow-2xl flex flex-col justify-between border border-white/[0.08] relative overflow-hidden group hover:shadow-[0_8px_40px_rgba(0,0,0,0.5)] transition-all duration-300" style={{ background: 'linear-gradient(135deg, #1e3a5f 0%, #0f2744 60%, #0d1f38 100%)' }}>
          <div className="absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-[#F59E0B]/[0.08] to-transparent pointer-events-none" />
          <div className="absolute top-0 right-0 w-40 h-40 bg-white/[0.02] rounded-full -translate-y-1/2 translate-x-1/2 pointer-events-none" />
          <div>
            <p className="text-white/50 text-[10px] uppercase tracking-[0.2em] font-semibold mb-4">{periodLabel}</p>
            <div className="flex items-baseline gap-3">
              <span className="text-7xl sm:text-8xl font-black text-white tracking-tighter drop-shadow-[0_2px_12px_rgba(255,255,255,0.12)]">{totalSold}</span>
              <span className="text-xl sm:text-2xl font-medium text-white/25">/ {totalMetaQtd}</span>
              <span className="text-base text-white/20 font-normal">máquinas</span>
            </div>
            <div className="flex items-center gap-3 mt-3 flex-wrap">
              <span className={`inline-flex items-center gap-1.5 text-sm font-bold px-3 py-1 rounded-full ${
                pctAtingido >= 100 ? "bg-[#22C55E]/20 text-[#4ade80]" :
                pctAtingido >= 70 ? "bg-[#F59E0B]/20 text-[#FBBF24]" :
                "bg-[#EF4444]/20 text-[#F87171]"
              }`}>
                {pctAtingido >= 100 ? "✓ Acima da meta" : pctAtingido >= 70 ? "● No ritmo" : "⚠ Abaixo da meta"} — {formatPct(pctAtingido)}
              </span>
              <span className={`text-sm font-semibold ${faltam > 0 ? "text-white/50" : "text-[#4ade80]"}`}>
                {faltam > 0 ? `Faltam ${faltam} máquinas` : "🏆 Meta batida!"}
              </span>
            </div>
            {faltam > 0 && diasRestantes > 0 && (
              <div className="flex items-center gap-4 mt-3 text-[11px] text-white/40">
                <span>Meta restante: <span className="text-white/60 font-semibold">{faltam} máquinas</span></span>
                <span className="text-white/15">|</span>
                <span>Necessário: <span className="text-white/60 font-semibold">{ritmoNecessario.toFixed(1)} máq/semana</span></span>
              </div>
            )}
          </div>

          {/* Progress bar */}
          <div className="mt-6">
            <div className="w-full h-3.5 bg-white/[0.07] rounded-full overflow-hidden shadow-inner">
              <div
                className="h-full rounded-full transition-all duration-1000 shadow-lg"
                style={{
                  width: `${Math.min(pctAtingido, 100)}%`,
                  background: pctAtingido >= 100
                    ? "linear-gradient(90deg, #22C55E, #4ade80)"
                    : pctAtingido >= 70
                    ? "linear-gradient(90deg, #F59E0B, #FBBF24)"
                    : "linear-gradient(90deg, #EF4444, #F87171)",
                  boxShadow: `0 0 12px ${pctAtingido >= 100 ? "rgba(34,197,94,0.4)" : pctAtingido >= 70 ? "rgba(245,158,11,0.4)" : "rgba(239,68,68,0.4)"}`,
                }}
              />
            </div>
            <div className="flex items-center justify-between mt-2.5 text-white/35 text-[11px]">
              <span>Faturamento: <span className="text-white/50 font-medium">{cur.count > 0 ? formatCompact(cur.basePrice) : "—"}</span></span>
              <span>Projeção: <span className="text-white/50 font-medium">{projQtd} máq ({formatPct(projPct)})</span></span>
            </div>
          </div>
        </div>

        {/* KPIs SECUNDÁRIOS */}
        <div className="grid gap-3 sm:grid-cols-2 opacity-[0.92]">
          <KpiSecondaryCard
            label="Faturamento FOB"
            value={cur.count > 0 ? formatCompact(cur.basePrice) : "—"}
            icon={<DollarSign className="h-4 w-4" />}
            iconBg="#3B82F6"
            trend={prev.basePrice > 0 ? ((cur.basePrice - prev.basePrice) / prev.basePrice) * 100 : cur.basePrice > 0 ? 100 : 0}
            pctMeta={(() => {
              const totalMetaVal = filterRep !== "all"
                ? (repRanking.find(r => r.id === filterRep)?.metaVal || 0)
                : repRanking.reduce((s, r) => s + (r.metaVal || 0), 0);
              return totalMetaVal > 0 ? (cur.basePrice / totalMetaVal) * 100 : 0;
            })()}
          />
          <KpiSecondaryCard
            label="Margem Média"
            value={cur.count > 0 ? formatPct(margemMedia) : "—"}
            icon={<Zap className="h-4 w-4" />}
            iconBg="#8B5CF6"
            trend={prev.basePrice > 0 ? margemMedia - (prev.netProfit / prev.basePrice) * 100 : 0}
            pctMeta={margemMedia > 0 ? Math.min((margemMedia / 20) * 100, 100) : 0}
          />
          <KpiSecondaryCard
            label="Lucro Líquido"
            value={cur.count > 0 ? formatCompact(cur.netProfit) : "—"}
            icon={<TrendingUp className="h-4 w-4" />}
            iconBg="#22C55E"
            trend={prev.netProfit > 0 ? ((cur.netProfit - prev.netProfit) / prev.netProfit) * 100 : cur.netProfit > 0 ? 100 : 0}
            pctMeta={cur.basePrice > 0 ? Math.min((((cur.netProfit / cur.basePrice) * 100) / 15) * 100, 100) : 0}
          />
          <KpiSecondaryCard
            label="Comissões"
            value={cur.count > 0 ? formatCompact(commTotal) : "—"}
            icon={<DollarSign className="h-4 w-4" />}
            iconBg="#F59E0B"
            trend={prev.sellerComm + prev.managerComm > 0 ? ((commTotal - (prev.sellerComm + prev.managerComm)) / (prev.sellerComm + prev.managerComm)) * 100 : commTotal > 0 ? 100 : 0}
            pctMeta={cur.basePrice > 0 ? Math.min((((commTotal / cur.basePrice) * 100) / 5) * 100, 100) : 0}
          />
        </div>
      </section>

      {/* ═══ ATIVIDADE DA EQUIPE ═══ */}
      <section>
        <div className="flex items-center gap-2 mb-4">
          <Users className="h-5 w-5 text-[#8B5CF6]" />
          <h3 className="font-heading text-lg font-bold text-white">Atividade da Equipe</h3>
        </div>
        <div className="grid gap-3 sm:gap-4 grid-cols-1 sm:grid-cols-3">
          <div className="rounded-xl border border-white/[0.06] p-4 sm:p-5 shadow-lg text-center" style={{ background: 'rgba(255,255,255,0.04)' }}>
            <p className="font-heading text-3xl sm:text-4xl font-black text-white">{visitStats.totalVisitas}</p>
            <p className="text-xs text-white/40 mt-1">Visitas no período</p>
          </div>
          <div className="rounded-xl border border-white/[0.06] p-4 sm:p-5 shadow-lg text-center" style={{ background: 'rgba(255,255,255,0.04)' }}>
            <p className="font-heading text-3xl sm:text-4xl font-black text-white">{visitStats.media.toFixed(1)}</p>
            <p className="text-xs text-white/40 mt-1">Média por vendedor</p>
          </div>
          <div className="rounded-xl border border-white/[0.06] p-4 sm:p-5 shadow-lg text-center" style={{ background: 'rgba(255,255,255,0.04)' }}>
            <p className={`font-heading text-3xl sm:text-4xl font-black ${visitStats.pctMeta >= 100 ? "text-[#22C55E]" : visitStats.pctMeta >= 70 ? "text-[#F97316]" : "text-[#EF4444]"}`}>
              {formatPct(visitStats.pctMeta)}
            </p>
            <p className="text-xs text-white/40 mt-1">{visitStats.totalVisitas} de {visitStats.totalMeta} visitas</p>
          </div>
        </div>
      </section>

      {/* ═══ RANKING DE REPS — MÁQUINAS ═══ */}
      {sortedRanking.length > 0 && (
        <section>
          <div className="rounded-xl border border-white/[0.06] shadow-lg overflow-hidden" style={{ background: 'rgba(255,255,255,0.03)' }}>
            <div className="flex items-center justify-between px-4 sm:px-5 py-3 border-b border-white/[0.06]">
              <div className="flex items-center gap-2">
                <Trophy className="h-5 w-5 text-[#F59E0B]" />
                <h3 className="font-heading text-base font-bold text-white">Ranking — Máquinas Vendidas</h3>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="text-[10px] font-mono border-white/20 text-white/60">{periodLabel}</Badge>
                {sortedRanking.length > 5 && (
                  <button onClick={() => setShowAllReps(!showAllReps)} className="text-xs font-semibold text-[#60A5FA] hover:underline">
                    {showAllReps ? "Menos" : "Ver todos"}
                  </button>
                )}
              </div>
            </div>
            <div className="divide-y divide-white/[0.05]">
              {displayedRanking.map((rep, idx) => {
                const pct = rep.pctQtd;
                const medals = ["🥇", "🥈", "🥉"];
                const medal = idx < 3 ? medals[idx] : null;
                const avatarColors = ["#F59E0B", "#94A3B8", "#CD7F32", "#3B82F6", "#22C55E", "#8B5CF6"];
                const avatarColor = avatarColors[idx % avatarColors.length];
                const initials = rep.nome.split(" ").map((w: string) => w[0]).slice(0, 2).join("").toUpperCase();
                const progressColor = pct >= 100 ? "#22C55E" : pct >= 70 ? "#F59E0B" : "#EF4444";
                const visitCount = visitStats.perRep.get(rep.id) || 0;

                return (
                  <div key={rep.id} onClick={() => setFilterRep(rep.id)} className={`flex items-center gap-3 px-4 sm:px-5 py-3.5 transition-all duration-200 cursor-pointer ${idx === 0 ? "bg-[#F59E0B]/[0.08] hover:bg-[#F59E0B]/[0.12]" : idx === 1 ? "bg-white/[0.02] hover:bg-white/[0.05]" : idx === 2 ? "bg-white/[0.015] hover:bg-white/[0.04]" : "hover:bg-white/[0.04]"}`}>
                    <span className="text-base font-bold w-7 text-center shrink-0">
                      {medal || <span className="text-white/30 text-sm">#{idx + 1}</span>}
                    </span>
                    <div className="h-[32px] w-[32px] rounded-full flex items-center justify-center text-[11px] font-bold text-white shrink-0 ring-1 ring-white/10" style={{ backgroundColor: avatarColor }}>
                      {initials}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-semibold text-white truncate">{rep.nome}</p>
                        {pct >= 100 && <span className="text-[9px] bg-[#22C55E]/20 text-[#4ade80] font-bold px-1.5 py-0.5 rounded-full shrink-0">META ✓</span>}
                      </div>
                      <div className="w-full max-w-[200px] h-1.5 bg-white/[0.08] rounded-full mt-1.5 overflow-hidden">
                        <div className="h-full rounded-full transition-all duration-700" style={{ width: `${Math.min(pct, 100)}%`, background: `linear-gradient(90deg, ${progressColor}cc, ${progressColor})` }} />
                      </div>
                    </div>
                    <div className="text-right shrink-0 space-y-0.5">
                      <p className="text-sm font-black text-white tabular-nums">{rep.count} / {rep.metaQtd}</p>
                      <p className={`text-[10px] font-semibold ${pct >= 100 ? "text-[#4ade80]" : pct >= 70 ? "text-[#FBBF24]" : "text-[#F87171]"}`}>{formatPct(pct)}</p>
                      <p className="text-[9px] text-white/30">{visitCount} visitas</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </section>
      )}

      {/* ═══ RITMO COMERCIAL ═══ */}
      <section className="grid gap-3 sm:gap-4 grid-cols-1 md:grid-cols-2">
        <div className="rounded-xl border border-white/[0.06] p-4 sm:p-6 shadow-lg" style={{ background: 'rgba(255,255,255,0.04)' }}>
          <div className="flex items-center gap-2 mb-3 sm:mb-4">
            <div className="h-8 w-8 sm:h-10 sm:w-10 rounded-lg bg-[#3B82F6]/15 flex items-center justify-center">
              <Activity className="h-4 w-4 sm:h-5 sm:w-5 text-[#60A5FA]" />
            </div>
            <div>
              <h4 className="text-[10px] sm:text-xs font-semibold text-white/40 uppercase">Ritmo Atual</h4>
              <p className="font-heading text-xl sm:text-3xl font-black text-white">{ritmoAtual.toFixed(1)} <span className="text-sm sm:text-lg text-white/35">máq / semana</span></p>
            </div>
          </div>
          <div className={`rounded-lg px-4 py-3 ${noRitmo ? "bg-[#22C55E]/[0.08] border border-[#22C55E]/20" : "bg-[#EF4444]/[0.08] border border-[#EF4444]/20"}`}>
            <p className={`text-sm font-medium ${noRitmo ? "text-[#4ade80]" : "text-[#F87171]"}`}>
              {noRitmo
                ? faltam === 0
                  ? "✓ Meta já foi atingida! Manter o momento."
                  : `✓ Ritmo suficiente — vendendo ${ritmoAtual.toFixed(1)} máq/sem.`
                : `⚠ Ritmo insuficiente — precisa ${ritmoNecessario.toFixed(1)} máq/sem nos próximos ${Math.ceil(diasRestantes)} dias.`
              }
            </p>
          </div>
        </div>
        <div className="rounded-xl border border-white/[0.06] p-6 shadow-lg" style={{ background: 'rgba(255,255,255,0.04)' }}>
          <div className="flex items-center gap-2 mb-4">
            <div className={`h-10 w-10 rounded-lg flex items-center justify-center ${noRitmo ? "bg-[#22C55E]/15" : "bg-[#EF4444]/15"}`}>
              <Gauge className={`h-5 w-5 ${noRitmo ? "text-[#4ade80]" : "text-[#F87171]"}`} />
            </div>
            <div>
              <h4 className="text-xs font-semibold text-white/40 uppercase">Ritmo Necessário</h4>
              <p className="font-heading text-3xl font-black text-white">{faltam === 0 ? "0.0" : ritmoNecessario.toFixed(1)} <span className="text-lg text-white/35">/ semana</span></p>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="text-center rounded-lg py-2" style={{ background: 'rgba(255,255,255,0.04)' }}>
              <p className="text-xs text-white/35">Dias passados</p>
              <p className="font-heading text-xl font-black text-white">{elapsedDays}</p>
            </div>
            <div className="text-center rounded-lg py-2" style={{ background: 'rgba(255,255,255,0.04)' }}>
              <p className="text-xs text-white/35">Dias restantes</p>
              <p className="font-heading text-xl font-black text-white">{diasRestantes}</p>
            </div>
            <div className="text-center rounded-lg py-2" style={{ background: 'rgba(255,255,255,0.04)' }}>
              <p className="text-xs text-white/35">Total dias</p>
              <p className="font-heading text-xl font-black text-white">{totalDaysPeriod}</p>
            </div>
          </div>
        </div>
      </section>

      {/* ═══ RESULTADO FINANCEIRO ═══ */}
      <section>
        <div className="flex items-center gap-2 mb-4">
          <DollarSign className="h-5 w-5 text-[#4ade80]" />
          <h3 className="font-heading text-lg font-bold text-white">Resultado Financeiro</h3>
        </div>
        <div className="grid gap-3 sm:gap-4 grid-cols-2 md:grid-cols-4">
          <MetricCard label="Faturamento FOB" value={cur.count > 0 ? formatCompact(cur.basePrice) : "—"} icon={<DollarSign className="h-4 w-4" />} color="#3B82F6" sub={cur.count > 0 ? formatBrlCompact(cur.basePriceBrl) : undefined} />
          <MetricCard label="Ticket Médio" value={cur.count > 0 ? formatCompact(ticketMedio) : "—"} icon={<BarChart3 className="h-4 w-4" />} color="#8B5CF6" />
          <MetricCard label="Margem Média" value={cur.count > 0 ? formatPct(margemMedia) : "—"} icon={<Zap className="h-4 w-4" />} color={margemMedia >= 10 ? "#22C55E" : "#EF4444"} />
          <MetricCard label="Comissões" value={cur.count > 0 ? formatCompact(commTotal) : "—"} icon={<DollarSign className="h-4 w-4" />} color="#F59E0B" />
        </div>
      </section>

      {/* ═══ TENDÊNCIA ═══ */}
      <section>
        <div className="flex items-center gap-2 mb-4">
          <TrendingUp className="h-5 w-5 text-[#60A5FA]" />
          <h3 className="font-heading text-lg font-bold text-white">Tendência</h3>
        </div>
        <div className="grid gap-3 sm:gap-4 grid-cols-1 md:grid-cols-3">
          <div className="rounded-xl border border-white/[0.06] p-5 shadow-lg" style={{ background: 'rgba(255,255,255,0.04)' }}>
            <div className="flex items-center gap-3 mb-3">
              <div className={`h-10 w-10 rounded-lg flex items-center justify-center ${trend3m.icon === "up" ? "bg-[#22C55E]/15" : trend3m.icon === "down" ? "bg-[#EF4444]/15" : "bg-[#F97316]/15"}`}>
                {trend3m.icon === "up" ? <TrendingUp className="h-5 w-5 text-[#4ade80]" /> : trend3m.icon === "down" ? <TrendingDown className="h-5 w-5 text-[#F87171]" /> : <Minus className="h-5 w-5 text-[#FBBF24]" />}
              </div>
              <span className="text-xs font-semibold text-white/40 uppercase">Direção</span>
            </div>
            <p className={`font-heading text-2xl font-black ${trend3m.icon === "up" ? "text-[#4ade80]" : trend3m.icon === "down" ? "text-[#F87171]" : "text-[#FBBF24]"}`}>{trend3m.label}</p>
            <p className="text-xs text-white/35 mt-1">vs média últimos 3 meses</p>
          </div>
          <div className="rounded-xl border border-white/[0.06] p-5 shadow-lg" style={{ background: 'rgba(255,255,255,0.04)' }}>
            <h4 className="text-xs font-semibold text-white/40 uppercase mb-3">Comparativos</h4>
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-sm text-white/45">Mês anterior</span>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold text-white">{trend3m.prevMonth} máq</span>
                  {vendasVar !== 0 && <span className={`text-xs font-bold ${vendasVar > 0 ? "text-[#4ade80]" : "text-[#F87171]"}`}>{vendasVar > 0 ? "+" : ""}{vendasVar.toFixed(0)}%</span>}
                </div>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-white/45">Média 3 meses</span>
                <span className="text-sm font-bold text-white">{trend3m.avg.toFixed(1)} máq</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-white/45">Período atual</span>
                <span className="text-sm font-black text-white">{cur.count} máq</span>
              </div>
            </div>
          </div>
          <div className="rounded-xl border border-white/[0.06] p-5 shadow-lg" style={{ background: 'rgba(255,255,255,0.04)' }}>
            <h4 className="text-xs font-semibold text-white/40 uppercase mb-3">Evolução 6 Meses</h4>
            <ResponsiveContainer width="100%" height={120}>
              <AreaChart data={evolutionData}>
                <defs>
                  <linearGradient id="gradTrend" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.2} />
                    <stop offset="95%" stopColor="#3B82F6" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#9CA3AF' }} axisLine={false} tickLine={false} />
                <Area type="monotone" dataKey="Vendas" stroke="#3B82F6" fill="url(#gradTrend)" strokeWidth={2.5} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      </section>

      {/* ═══ EVOLUÇÃO COMPLETA ═══ */}
      <section>
        <div className="rounded-xl border border-white/[0.06] p-6 shadow-lg" style={{ background: 'rgba(255,255,255,0.04)' }}>
          <h4 className="text-xs font-semibold text-white/40 uppercase mb-4 flex items-center gap-2">
            <BarChart3 className="h-4 w-4 text-[#60A5FA]" /> Evolução Detalhada (6 meses)
          </h4>
          <ResponsiveContainer width="100%" height={260}>
            <AreaChart data={evolutionData}>
              <defs>
                <linearGradient id="gradFat2" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.25} />
                  <stop offset="95%" stopColor="#3B82F6" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="gradLucro2" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#22C55E" stopOpacity={0.25} />
                  <stop offset="95%" stopColor="#22C55E" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
              <XAxis dataKey="name" tick={{ fontSize: 12, fill: 'rgba(255,255,255,0.4)' }} />
              <YAxis tick={{ fontSize: 11, fill: 'rgba(255,255,255,0.4)' }} />
              <Tooltip formatter={(v: number) => formatUsd(v)} contentStyle={{ fontSize: 12, borderRadius: 12, background: '#1a2744', border: '1px solid rgba(255,255,255,0.1)', boxShadow: '0 8px 24px rgba(0,0,0,0.4)', color: '#fff' }} />
              <Area type="monotone" dataKey="Faturamento" stroke="#60A5FA" fill="url(#gradFat2)" strokeWidth={2.5} />
              <Area type="monotone" dataKey="Lucro Líquido" stroke="#4ade80" fill="url(#gradLucro2)" strokeWidth={2.5} />
              <RechartLegend wrapperStyle={{ fontSize: 12, color: 'rgba(255,255,255,0.5)' }} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </section>

      {/* ═══ RESUMO EXECUTIVO ═══ */}
      <section className="rounded-2xl p-6 md:p-8 text-white shadow-xl relative overflow-hidden border border-white/[0.06]" style={{ background: 'linear-gradient(135deg, #162033 0%, #1e3047 50%, #1a2744 100%)' }}>
        <div className="absolute top-0 right-0 w-48 h-48 bg-white/[0.03] rounded-full -translate-y-20 translate-x-20" />
        <div className="relative">
          <div className="flex items-center gap-2 mb-5">
            <FileText className="h-5 w-5 text-[#3B82F6]" />
            <h3 className="font-heading text-lg font-bold uppercase tracking-wider">Resumo Executivo</h3>
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            {/* Destaques */}
            <div className="space-y-2">
              <div className="flex items-center gap-1.5 mb-2">
                <div className="h-2 w-2 rounded-full bg-[#22C55E]" />
                <span className="text-xs font-bold uppercase tracking-wider text-[#4ade80]">Destaques</span>
              </div>
              {(() => {
                const positivos: string[] = [];
                if (topPerformer && topPerformer.pctQtd >= 100) positivos.push(`${topPerformer.nome} bateu a meta`);
                if (vendasVar > 10) positivos.push(`Vendas +${vendasVar.toFixed(0)}% vs anterior`);
                if (margemMedia > 15) positivos.push(`Margem saudável: ${formatPct(margemMedia)}`);
                if (noRitmo && faltam > 0) positivos.push("Ritmo suficiente para a meta");
                if (pctAtingido >= 100) positivos.push("Meta superada!");
                return positivos.length > 0
                  ? positivos.map((p, i) => <p key={i} className="text-xs text-white/80 leading-relaxed">✅ {p}</p>)
                  : <p className="text-xs text-white/40">Nenhum destaque</p>;
              })()}
            </div>
            {/* Atenção */}
            <div className="space-y-2">
              <div className="flex items-center gap-1.5 mb-2">
                <div className="h-2 w-2 rounded-full bg-[#F59E0B]" />
                <span className="text-xs font-bold uppercase tracking-wider text-[#FBBF24]">Atenção</span>
              </div>
              {(() => {
                const atencao: string[] = [];
                if (pctAtingido < 100 && pctAtingido >= 50) atencao.push(`${formatPct(pctAtingido)} da meta — acompanhar`);
                if (!noRitmo && diasRestantes > 0) atencao.push(`Ritmo ${ritmoAtual.toFixed(1)}/sem (precisa ${ritmoNecessario.toFixed(1)})`);
                if (margemMedia < 10 && margemMedia >= 5 && cur.count > 0) atencao.push(`Margem moderada: ${formatPct(margemMedia)}`);
                return atencao.length > 0
                  ? atencao.map((a, i) => <p key={i} className="text-xs text-white/80 leading-relaxed">⚠️ {a}</p>)
                  : <p className="text-xs text-white/40">Sem pontos de atenção</p>;
              })()}
            </div>
            {/* Alertas */}
            <div className="space-y-2">
              <div className="flex items-center gap-1.5 mb-2">
                <div className="h-2 w-2 rounded-full bg-[#EF4444]" />
                <span className="text-xs font-bold uppercase tracking-wider text-[#F87171]">Alertas</span>
              </div>
              {(() => {
                const alertas: string[] = [];
                const repsAbaixo = (repRanking || []).filter(r => r.metaQtd > 0 && r.pctQtd < 70);
                if (repsAbaixo.length > 0) alertas.push(`${repsAbaixo.length} rep${repsAbaixo.length > 1 ? "s" : ""} abaixo de 70%`);
                if (pctAtingido < 50) alertas.push(`Apenas ${formatPct(pctAtingido)} da meta`);
                if (margemMedia < 5 && cur.count > 0) alertas.push(`Margem crítica: ${formatPct(margemMedia)}`);
                if (trend3m.icon === "down") alertas.push("Tendência de queda");
                return alertas.length > 0
                  ? alertas.map((a, i) => <p key={i} className="text-xs text-white/80 leading-relaxed">🔴 {a}</p>)
                  : <p className="text-xs text-white/40">Sem alertas</p>;
              })()}
            </div>
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
                <Crosshair className="h-5 w-5 text-[#60A5FA]" />
                <h3 className="font-heading text-base font-bold text-white uppercase tracking-wider">Pipeline em Fechamento</h3>
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
                <Gauge className="h-5 w-5 text-[#60A5FA]" />
                <h3 className="font-heading text-base font-bold text-white uppercase tracking-wider">Previsão de Fechamento</h3>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {[
                  { label: "Alta Probabilidade", items: alta, color: "#22C55E", bg: "bg-green-500/10 border-green-500/20" },
                  { label: "Média Probabilidade", items: media, color: "#F59E0B", bg: "bg-yellow-500/10 border-yellow-500/20" },
                  { label: "Baixa Probabilidade", items: baixa, color: "#EF4444", bg: "bg-red-500/10 border-red-500/20" },
                ].map(({ label, items, color, bg }) => (
                  <div key={label} className="rounded-xl border border-white/[0.06] p-4" style={{ background: 'rgba(255,255,255,0.03)' }}>
                    <p className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color }}>{label}</p>
                    <div className="flex justify-between">
                      <div>
                        <p className="font-heading text-2xl font-black text-white">{items.reduce((s: number, d: any) => s + (d.quantity || 0), 0)}</p>
                        <p className="text-xs text-white/35">máquinas</p>
                      </div>
                      <div className="text-right">
                        <p className="font-heading text-lg font-bold text-white">{fmtUsd(items.reduce((s: number, d: any) => s + (d.deal_value || 0), 0))}</p>
                        <p className="text-xs text-white/35">{items.length} negociações</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            {(alertOver30.length > 0 || alertNoNext.length > 0 || baixa.length > 0 || alertNearDate.length > 0 || alertRisk.length > 0) && (
              <section>
                <div className="flex items-center gap-2 mb-4">
                  <AlertTriangle className="h-5 w-5 text-[#FBBF24]" />
                  <h3 className="font-heading text-base font-bold text-white uppercase tracking-wider">Alertas do Gestor</h3>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                  {[
                    { label: "> 30 dias", count: alertOver30.length, icon: <Clock className="h-4 w-4" />, color: "#F59E0B" },
                    { label: "Sem próximo passo", count: alertNoNext.length, icon: <ArrowRight className="h-4 w-4" />, color: "#EF4444" },
                    { label: "Baixa prob.", count: baixa.length, icon: <TrendingDown className="h-4 w-4" />, color: "#EF4444" },
                    { label: "Fecham em 7d", count: alertNearDate.length, icon: <Flame className="h-4 w-4" />, color: "#F97316" },
                    { label: "Com risco", count: alertRisk.length, icon: <AlertTriangle className="h-4 w-4" />, color: "#EF4444" },
                  ].map(({ label, count, icon, color }) => count > 0 ? (
                    <div key={label} className="rounded-xl border border-white/[0.06] p-3 text-center" style={{ background: 'rgba(255,255,255,0.03)' }}>
                      <div className="h-8 w-8 mx-auto rounded-lg flex items-center justify-center mb-1" style={{ backgroundColor: `${color}20`, color }}>{icon}</div>
                      <p className="font-heading text-xl font-black text-white">{count}</p>
                      <p className="text-[10px] text-white/35">{label}</p>
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
                <Trophy className="h-5 w-5 text-[#FBBF24]" />
                <h3 className="font-heading text-base font-bold text-white uppercase tracking-wider">Top 5 Prioridades</h3>
              </div>
              <div className="space-y-2">
                {top5.map((d: any, i: number) => (
                  <div key={d.id} className="flex items-center gap-3 rounded-xl border border-white/[0.06] p-3" style={{ background: 'rgba(255,255,255,0.03)' }}>
                    <div className="h-8 w-8 rounded-lg flex items-center justify-center font-heading font-black text-sm shrink-0"
                      style={{ backgroundColor: i === 0 ? 'rgba(245,158,11,0.15)' : 'rgba(59,130,246,0.15)', color: i === 0 ? '#FBBF24' : '#60A5FA' }}>
                      {i + 1}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-white truncate">{d.client_name}</p>
                      <p className="text-xs text-white/35">{repNm(d.representative_id)} · {d.machine_name || d.machine_type}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-sm font-bold text-white">{fmtUsd(d.deal_value)}</p>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${
                        d.probability === "Alta" ? "bg-green-500/20 text-[#4ade80]" :
                        d.probability === "Média" ? "bg-yellow-500/20 text-[#FBBF24]" :
                        "bg-red-500/20 text-[#F87171]"
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

/* --- Sub-components --- */
const MetricCard = ({ label, value, icon, color, sub }: {
  label: string; value: string; icon: React.ReactNode; color: string; sub?: string;
}) => (
  <div className="rounded-xl border border-white/[0.06] p-2.5 sm:p-5 shadow-lg hover:shadow-xl hover:border-white/[0.1] hover:bg-white/[0.06] transition-all duration-200 cursor-default" style={{ background: 'rgba(255,255,255,0.04)' }}>
    <div className="flex items-center gap-1.5 sm:gap-3 mb-1.5 sm:mb-3">
      <div className="h-7 w-7 sm:h-10 sm:w-10 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: `${color}20`, color }}>{icon}</div>
      <span className="text-[9px] sm:text-xs font-semibold text-white/40 uppercase leading-tight">{label}</span>
    </div>
    <p className="font-heading text-sm sm:text-2xl font-black text-white truncate">{value}</p>
    {sub && <p className="text-[9px] sm:text-xs text-white/30 mt-0.5 sm:mt-1">{sub}</p>}
  </div>
);

const KpiSecondaryCard = ({ label, value, icon, iconBg, trend, pctMeta }: {
  label: string; value: string; icon: React.ReactNode; iconBg: string; trend: number; pctMeta: number;
}) => {
  const progressColor = pctMeta >= 70 ? "#4ade80" : pctMeta >= 40 ? "#60A5FA" : "#F87171";
  const trendPositive = trend >= 0;
  return (
    <div className={`rounded-xl p-3 sm:p-5 shadow-lg hover:shadow-xl transition-all duration-200 cursor-default border ${trendPositive ? "border-[#22C55E]/[0.08] hover:border-[#22C55E]/[0.15]" : trend < 0 ? "border-[#EF4444]/[0.08] hover:border-[#EF4444]/[0.15]" : "border-white/[0.06] hover:border-white/[0.1]"}`} style={{ background: trendPositive ? 'rgba(34,197,94,0.03)' : trend < 0 ? 'rgba(239,68,68,0.03)' : 'rgba(255,255,255,0.04)' }}>
      <div className="flex items-center justify-between mb-2 sm:mb-3">
        <span className="text-[9px] sm:text-xs font-semibold text-white/40 uppercase leading-tight">{label}</span>
        <div className="h-7 w-7 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: `${iconBg}25`, color: iconBg }}>{icon}</div>
      </div>
      <p className="text-2xl sm:text-3xl font-black tracking-tight text-white truncate">{value}</p>
      {trend !== 0 && (
        <span className={`inline-flex items-center text-xs font-bold px-2 py-0.5 rounded-full mt-2 ${trendPositive ? "bg-[#22C55E]/20 text-[#4ade80]" : "bg-[#EF4444]/20 text-[#F87171]"}`}>
          {trendPositive ? "+" : ""}{trend.toFixed(0)}%
        </span>
      )}
      <div className="w-full h-1.5 bg-white/[0.08] rounded-full mt-3 overflow-hidden">
        <div className="h-full rounded-full transition-all duration-700" style={{ width: `${Math.min(pctMeta, 100)}%`, background: `linear-gradient(90deg, ${progressColor}cc, ${progressColor})` }} />
      </div>
    </div>
  );
};

export default ExecutiveDashboard;
