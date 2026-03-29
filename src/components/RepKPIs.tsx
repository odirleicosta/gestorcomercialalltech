import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Target, Eye, TrendingUp, TrendingDown, XCircle, CheckCircle, BarChart3, Users, Calendar, Plus, FileText, Trash2, Edit2, PieChart, ChevronDown, ChevronUp, AlertTriangle, ClipboardList } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, Legend, PieChart as RechartsPie, Pie, LineChart, Line, CartesianGrid } from "recharts";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";

interface Props { userId: string; }
interface Rep { id: string; nome: string; meta_mensal_padrao: number; meta_quantidade: number; }
interface Deal { id: string; representative_id: string | null; status: string; closed_at: string | null; created_at: string; base_price: number; dollar_rate: number; machine_type: string; }
interface ClosingDeal {
  id: string; representative_id: string | null; status: string; deal_value: number;
  start_date: string; stage: string; probability: string; created_at: string;
  client_name?: string; machine_name?: string; machine_type?: string;
  sale_type?: string; notes?: string;
  motivo_perda?: string | null; motivo_perda_detalhe?: string | null;
  lost_reason?: string | null; lost_reason_detail?: string | null;
}
interface Visit { representative_id: string; semana: number; quantidade: number; meta: number; }
interface MonthlyGoal { representative_id: string; mes: number; meta_valor: number; meta_quantidade: number; machine_type: string; }

type PeriodMode = "week" | "month" | "quarter" | "year";
type ViewTab = "equipe" | "representante" | "perdas" | "visitas";

const SHORT_MONTHS = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];
const QUARTER_MONTHS: Record<string, number[]> = { T1: [1,2,3], T2: [4,5,6], T3: [7,8,9], T4: [10,11,12] };
const LOSS_REASONS = ["Preço", "Concorrência", "Prazo de entrega", "Falta de crédito/financiamento", "Cliente desistiu", "Outro"];
const LOSS_BAR_COLORS = ["hsl(var(--primary))", "hsl(var(--destructive))", "hsl(var(--accent))", "hsl(220, 70%, 55%)", "hsl(280, 60%, 55%)", "hsl(30, 80%, 55%)"];
const formatBrl = (v: number) => `R$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
const formatPct = (v: number) => `${v.toFixed(1)}%`;

const PillButton = ({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) => (
  <button
    onClick={onClick}
    className={`px-3 py-1 rounded-full text-xs font-medium transition-all ${
      active ? "bg-primary text-primary-foreground shadow-sm" : "bg-secondary text-muted-foreground hover:bg-secondary/80"
    }`}
  >
    {children}
  </button>
);

const getWeekNumber = (d: Date): number => {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  date.setUTCDate(date.getUTCDate() + 4 - (date.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  return Math.ceil((((date.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
};

const RepKPIs = ({ userId }: Props) => {
  const [reps, setReps] = useState<Rep[]>([]);
  const [deals, setDeals] = useState<Deal[]>([]);
  const [closingDeals, setClosingDeals] = useState<ClosingDeal[]>([]);
  const [visits, setVisits] = useState<Visit[]>([]);
  const [goals, setGoals] = useState<MonthlyGoal[]>([]);
  const [allVisits, setAllVisits] = useState<{ representative_id: string; semana: number; quantidade: number; meta: number; ano: number }[]>([]);

  const [loading, setLoading] = useState(true);
  const now = new Date();
  const [filterYear, setFilterYear] = useState(now.getFullYear());
  const [periodMode, setPeriodMode] = useState<PeriodMode>("month");
  const [filterMonth, setFilterMonth] = useState(now.getMonth() + 1);
  const [filterQuarter, setFilterQuarter] = useState<string>(`T${Math.floor(now.getMonth() / 3) + 1}`);
  const [filterWeek, setFilterWeek] = useState(getWeekNumber(now));
  const [viewTab, setViewTab] = useState<ViewTab>("equipe");

  // Negociação dialog
  const [negDialogOpen, setNegDialogOpen] = useState(false);
  const [editingNegId, setEditingNegId] = useState<string | null>(null);
  const [negForm, setNegForm] = useState({
    representative_id: "", client_name: "", machine_name: "", machine_type: "Centro de Usinagem",
    deal_value: 0, stage: "Proposta Enviada" as "Proposta Enviada" | "Negociação Ativa" | "Decisão Próxima",
    probability: "Média" as "Baixa" | "Média" | "Alta",
    sale_type: "Venda Direta" as "Rentall" | "Venda Direta", notes: "",
  });

  // Loss reason dialog
  const [lossDialogOpen, setLossDialogOpen] = useState(false);
  const [lossTargetId, setLossTargetId] = useState<string | null>(null);
  const [lossMotivo, setLossMotivo] = useState("");
  const [lossDetalhe, setLossDetalhe] = useState("");

  // Visit registration dialog
  const [visitDialogOpen, setVisitDialogOpen] = useState(false);
  const [visitEntries, setVisitEntries] = useState<{ rep_id: string; meta: number; quantidade: number }[]>([]);

  // Expanded rep cards
  const [expandedReps, setExpandedReps] = useState<Set<string>>(new Set());

  // Perdas filter by rep
  const [lossRepFilter, setLossRepFilter] = useState<string>("all");

  // Visitas tab state
  const [visitEditWeek, setVisitEditWeek] = useState(getWeekNumber(now));
  const [visitInlineEntries, setVisitInlineEntries] = useState<Record<string, { meta: number; quantidade: number }>>({});
  const [visitSaving, setVisitSaving] = useState(false);

  const resetNegForm = () => {
    setNegForm({ representative_id: "", client_name: "", machine_name: "", machine_type: "Centro de Usinagem", deal_value: 0, stage: "Proposta Enviada", probability: "Média", sale_type: "Venda Direta", notes: "" });
    setEditingNegId(null);
  };

  const openNewNeg = () => { resetNegForm(); setNegDialogOpen(true); };

  const openEditNeg = (c: ClosingDeal) => {
    setEditingNegId(c.id);
    setNegForm({
      representative_id: c.representative_id || "",
      client_name: c.client_name || "",
      machine_name: c.machine_name || "",
      machine_type: c.machine_type || "Centro de Usinagem",
      deal_value: c.deal_value,
      stage: c.stage as any,
      probability: c.probability as any,
      sale_type: (c.sale_type || "Venda Direta") as "Rentall" | "Venda Direta",
      notes: c.notes || "",
    });
    setNegDialogOpen(true);
  };

  const reloadClosing = async () => {
    const { data } = await supabase.from("closing_deals" as any).select("id, representative_id, status, deal_value, start_date, stage, probability, created_at, client_name, machine_name, machine_type, sale_type, notes, motivo_perda, motivo_perda_detalhe, lost_reason, lost_reason_detail");
    if (data) setClosingDeals(data as any);
  };

  const handleSaveNeg = async () => {
    if (!negForm.representative_id || !negForm.client_name.trim()) {
      toast.error("Preencha representante e cliente");
      return;
    }
    const payload = {
      representative_id: negForm.representative_id,
      client_name: negForm.client_name.trim(),
      machine_name: negForm.machine_name.trim(),
      machine_type: negForm.machine_type,
      deal_value: negForm.deal_value,
      stage: negForm.stage,
      probability: negForm.probability,
      sale_type: negForm.sale_type,
      notes: negForm.notes.trim() || null,
    };
    if (editingNegId) {
      const { error } = await supabase.from("closing_deals" as any).update(payload as any).eq("id", editingNegId);
      if (error) { toast.error("Erro ao atualizar"); return; }
      toast.success("Negociação atualizada");
    } else {
      const { error } = await supabase.from("closing_deals" as any).insert({ ...payload, user_id: userId } as any);
      if (error) { toast.error("Erro ao salvar"); return; }
      toast.success("Negociação registrada");
    }
    setNegDialogOpen(false);
    resetNegForm();
    reloadClosing();
  };

  const handleDeleteNeg = async (id: string) => {
    await supabase.from("closing_deals" as any).delete().eq("id", id);
    toast.success("Negociação excluída");
    reloadClosing();
  };

  const handleMarkNeg = async (id: string, status: "ganha" | "perdida") => {
    if (status === "perdida") {
      setLossTargetId(id);
      setLossMotivo("");
      setLossDetalhe("");
      setLossDialogOpen(true);
      return;
    }
    await supabase.from("closing_deals" as any).update({ status } as any).eq("id", id);
    toast.success("Marcada como ganha!");
    reloadClosing();
  };

  const confirmLoss = async () => {
    if (!lossTargetId || !lossMotivo) {
      toast.error("Selecione um motivo");
      return;
    }
    if (lossMotivo === "Outro" && !lossDetalhe.trim()) {
      toast.error("Descreva o motivo");
      return;
    }
    const reason = lossMotivo;
    const detail = lossMotivo === "Outro" ? (lossDetalhe.trim() || null) : null;
    await supabase.from("closing_deals" as any).update({
      status: "perdida",
      lost_reason: reason,
      lost_reason_detail: detail,
      motivo_perda: reason,
      motivo_perda_detalhe: detail,
    } as any).eq("id", lossTargetId);
    toast.success("Marcada como perdida");
    setLossDialogOpen(false);
    setLossTargetId(null);
    reloadClosing();
  };

  // Visit registration
  const openVisitDialog = () => {
    const currentWeek = getWeekNumber(now);
    setVisitEntries(reps.map(r => {
      const existing = visits.find(v => v.representative_id === r.id && v.semana === currentWeek);
      return { rep_id: r.id, meta: existing?.meta ?? 16, quantidade: existing?.quantidade ?? 0 };
    }));
    setVisitDialogOpen(true);
  };

  const handleSaveVisits = async () => {
    const currentWeek = getWeekNumber(now);
    for (const entry of visitEntries) {
      await supabase.from("weekly_visits" as any).upsert({
        user_id: userId,
        representative_id: entry.rep_id,
        ano: filterYear,
        semana: currentWeek,
        meta: entry.meta,
        quantidade: entry.quantidade,
      } as any, { onConflict: "representative_id,ano,semana" });
    }
    toast.success("Visitas registradas!");
    setVisitDialogOpen(false);
    // Reload visits
    const { data } = await supabase.from("weekly_visits" as any).select("representative_id, semana, quantidade, meta, ano").eq("ano", filterYear);
    if (data) {
      setVisits(data as any);
      setAllVisits(data as any);
    }
  };

  useEffect(() => {
    const fetchData = async () => {
      const [repsRes, dealsRes, closingRes, visitsRes, goalsRes] = await Promise.all([
        supabase.from("representatives" as any).select("id, nome, meta_mensal_padrao, meta_quantidade").eq("status", "ATIVO").order("nome"),
        supabase.from("deals" as any).select("id, representative_id, status, closed_at, created_at, base_price, dollar_rate, machine_type"),
        supabase.from("closing_deals" as any).select("id, representative_id, status, deal_value, start_date, stage, probability, created_at, client_name, machine_name, machine_type, sale_type, notes, motivo_perda, motivo_perda_detalhe, lost_reason, lost_reason_detail"),
        supabase.from("weekly_visits" as any).select("representative_id, semana, quantidade, meta, ano").eq("ano", filterYear),
        supabase.from("monthly_goals" as any).select("representative_id, mes, meta_valor, meta_quantidade, machine_type").eq("ano", filterYear),
      ]);
      if (repsRes.data) setReps(repsRes.data as any);
      if (dealsRes.data) setDeals(dealsRes.data as any);
      if (closingRes.data) setClosingDeals(closingRes.data as any);
      if (visitsRes.data) { setVisits(visitsRes.data as any); setAllVisits(visitsRes.data as any); }
      if (goalsRes.data) setGoals(goalsRes.data as any);
      setLoading(false);
    };
    fetchData();
  }, [filterYear]);

  const activeMonths = useMemo((): number[] => {
    if (periodMode === "year") return [1,2,3,4,5,6,7,8,9,10,11,12];
    if (periodMode === "quarter") return QUARTER_MONTHS[filterQuarter];
    if (periodMode === "month") return [filterMonth];
    return [1,2,3,4,5,6,7,8,9,10,11,12];
  }, [periodMode, filterMonth, filterQuarter]);

  const periodLabel = useMemo(() => {
    if (periodMode === "year") return String(filterYear);
    if (periodMode === "quarter") return `${filterQuarter}/${filterYear}`;
    if (periodMode === "month") return `${SHORT_MONTHS[filterMonth - 1]}/${filterYear}`;
    return `Semana ${filterWeek}/${filterYear}`;
  }, [periodMode, filterYear, filterMonth, filterQuarter, filterWeek]);

  const isInPeriod = (dt: Date): boolean => {
    if (dt.getFullYear() !== filterYear) return false;
    if (periodMode === "week") return getWeekNumber(dt) === filterWeek;
    return activeMonths.includes(dt.getMonth() + 1);
  };

  const filterDealByPeriod = (d: Deal): boolean => {
    if (d.status !== "closed" || !d.closed_at) return false;
    const dt = new Date(d.closed_at);
    return isInPeriod(dt);
  };

  const getLostReason = (c: ClosingDeal): string | null => c.lost_reason || c.motivo_perda || null;
  const getLostDetail = (c: ClosingDeal): string | null => c.lost_reason_detail || c.motivo_perda_detalhe || null;

  // Negociações abertas por representante
  const openByRep = useMemo(() => {
    return reps.map(rep => {
      const repClosing = closingDeals.filter(c => c.representative_id === rep.id && c.status === "ativa" && isInPeriod(new Date(c.created_at)));
      const repOpenDeals = deals.filter(d => d.representative_id === rep.id && d.status === "open" && isInPeriod(new Date(d.created_at)));
      return { nome: rep.nome.split(" ")[0], radar: repClosing.length, vendas: repOpenDeals.length, total: repClosing.length + repOpenDeals.length };
    }).filter(r => r.total > 0);
  }, [reps, closingDeals, deals, filterYear, periodMode, filterWeek, activeMonths]);

  const repMetrics = useMemo(() => {
    return reps.map(rep => {
      const repVisits = visits.filter(v => {
        if (v.representative_id !== rep.id) return false;
        if (periodMode === "week") return v.semana === filterWeek;
        return true;
      });
      const totalVisits = repVisits.reduce((s, v) => s + v.quantidade, 0);
      const totalVisitMeta = repVisits.reduce((s, v) => s + v.meta, 0);
      const visitPct = totalVisitMeta > 0 ? (totalVisits / totalVisitMeta) * 100 : 0;

      const activeOpps = closingDeals.filter(c => c.representative_id === rep.id && c.status === "ativa");
      const oppCount = activeOpps.length;
      const oppValue = activeOpps.reduce((s, c) => s + c.deal_value, 0);
      const weightedPipeline = activeOpps.reduce((s, c) => {
        const w = c.probability === "Alta" ? 0.8 : c.probability === "Média" ? 0.5 : 0.2;
        return s + c.deal_value * w;
      }, 0);

      const lost = closingDeals.filter(c => c.representative_id === rep.id && c.status === "perdida");
      const lostCount = lost.length;
      const lostValue = lost.reduce((s, c) => s + c.deal_value, 0);
      const won = closingDeals.filter(c => c.representative_id === rep.id && c.status === "ganha");
      const wonCount = won.length;
      const totalDecided = wonCount + lostCount;
      const winRate = totalDecided > 0 ? (wonCount / totalDecided) * 100 : 0;

      const closedDeals = deals.filter(d => d.representative_id === rep.id && filterDealByPeriod(d));
      const closedCount = closedDeals.length;
      const closedFobBrl = closedDeals.reduce((s, d) => s + d.base_price * (d.dollar_rate || 0), 0);

      const periodGoals = goals.filter(g => g.representative_id === rep.id && activeMonths.includes(g.mes));
      const monthCount = periodMode === "week" ? 1 : activeMonths.length;
      const metaValor = periodGoals.reduce((s, g) => s + g.meta_valor, 0) || rep.meta_mensal_padrao * monthCount;
      const metaQtd = periodGoals.reduce((s, g) => s + g.meta_quantidade, 0) || rep.meta_quantidade * monthCount;
      const pctValor = metaValor > 0 ? (closedFobBrl / metaValor) * 100 : 0;
      const pctQtd = metaQtd > 0 ? (closedCount / metaQtd) * 100 : 0;

      const yearClosed = deals.filter(d => d.representative_id === rep.id && d.status === "closed" && d.closed_at && new Date(d.closed_at).getFullYear() === filterYear);
      const yearFobBrl = yearClosed.reduce((s, d) => s + d.base_price * (d.dollar_rate || 0), 0);
      const yearCount = yearClosed.length;

      return {
        id: rep.id, nome: rep.nome,
        totalVisits, visitPct,
        oppCount, oppValue, weightedPipeline,
        lostCount, lostValue,
        wonCount, winRate,
        closedCount, closedFobBrl,
        metaValor, metaQtd, pctValor, pctQtd,
        yearFobBrl, yearCount,
      };
    }).sort((a, b) => b.closedFobBrl - a.closedFobBrl);
  }, [reps, deals, closingDeals, visits, goals, filterYear, periodMode, filterMonth, filterQuarter, filterWeek, activeMonths]);

  const chartData = useMemo(() => {
    return repMetrics.map(r => ({ nome: r.nome.split(" ")[0], meta: r.metaValor, realizado: r.closedFobBrl }));
  }, [repMetrics]);

  const globalKpis = useMemo(() => {
    const totalVisits = repMetrics.reduce((s, r) => s + r.totalVisits, 0);
    const totalOpps = repMetrics.reduce((s, r) => s + r.oppCount, 0);
    const totalLost = repMetrics.reduce((s, r) => s + r.lostCount, 0);
    const totalWon = repMetrics.reduce((s, r) => s + r.wonCount, 0);
    const totalDecided = totalWon + totalLost;
    const globalWinRate = totalDecided > 0 ? (totalWon / totalDecided) * 100 : 0;
    const totalRealized = repMetrics.reduce((s, r) => s + r.closedFobBrl, 0);
    const totalMeta = repMetrics.reduce((s, r) => s + r.metaValor, 0);
    const totalPipeline = repMetrics.reduce((s, r) => s + r.oppValue, 0);
    return { totalVisits, totalOpps, totalLost, totalWon, globalWinRate, totalRealized, totalMeta, totalPipeline };
  }, [repMetrics]);

  // Weekly visits chart data (last 8 weeks)
  const weeklyChartData = useMemo(() => {
    if (periodMode !== "week") return [];
    const currentWeek = filterWeek;
    const weeks: { semana: string; realizadas: number; meta: number }[] = [];
    for (let i = 7; i >= 0; i--) {
      const w = currentWeek - i;
      if (w < 1) continue;
      const weekVisits = allVisits.filter(v => v.semana === w && v.ano === filterYear);
      const totalRealizadas = weekVisits.reduce((s, v) => s + v.quantidade, 0);
      const totalMeta = weekVisits.reduce((s, v) => s + v.meta, 0) || reps.length * 16;
      weeks.push({ semana: `S${w}`, realizadas: totalRealizadas, meta: totalMeta });
    }
    return weeks;
  }, [periodMode, filterWeek, allVisits, filterYear, reps.length]);

  // Lost deals without reason count
  const lostWithoutReason = useMemo(() => {
    return closingDeals.filter(c => c.status === "perdida" && !getLostReason(c)).length;
  }, [closingDeals]);

  // Perdas analysis
  const lossAnalysis = useMemo(() => {
    let lostDeals = closingDeals.filter(c => {
      if (c.status !== "perdida") return false;
      return isInPeriod(new Date(c.created_at));
    });
    if (lossRepFilter !== "all") {
      lostDeals = lostDeals.filter(c => c.representative_id === lossRepFilter);
    }
    const withReason = lostDeals.filter(c => getLostReason(c));
    const reasonCounts: Record<string, number> = {};
    withReason.forEach(c => {
      const m = getLostReason(c)!;
      reasonCounts[m] = (reasonCounts[m] || 0) + 1;
    });
    const totalWithReason = withReason.length;
    const rankingData = Object.entries(reasonCounts)
      .map(([name, value]) => ({ name, value, pct: totalWithReason > 0 ? (value / totalWithReason) * 100 : 0 }))
      .sort((a, b) => b.value - a.value);

    // Monthly loss chart
    const monthlyLoss: { mes: string; perdas: number }[] = SHORT_MONTHS.map((label, i) => {
      const count = lostDeals.filter(c => new Date(c.created_at).getMonth() === i).length;
      return { mes: label, perdas: count };
    });

    return { lostDeals, rankingData, monthlyLoss, totalWithReason };
  }, [closingDeals, filterYear, periodMode, filterWeek, activeMonths, lossRepFilter]);

  if (loading) return <p className="text-muted-foreground text-center py-8">Carregando...</p>;

  const metaPct = globalKpis.totalMeta > 0 ? (globalKpis.totalRealized / globalKpis.totalMeta) * 100 : 0;
  const weekOptions = Array.from({ length: 52 }, (_, i) => i + 1);

  const toggleRepExpanded = (id: string) => {
    setExpandedReps(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const renderNegActions = (neg: ClosingDeal) => (
    <div className="flex gap-1 shrink-0">
      <Button size="sm" variant="ghost" className="h-6 w-6 p-0" onClick={() => openEditNeg(neg)} title="Editar">
        <Edit2 className="h-3.5 w-3.5 text-primary" />
      </Button>
      <Button size="sm" variant="ghost" className="h-6 w-6 p-0" onClick={() => handleMarkNeg(neg.id, "ganha")} title="Marcar Ganha">
        <CheckCircle className="h-3.5 w-3.5 text-accent" />
      </Button>
      <Button size="sm" variant="ghost" className="h-6 w-6 p-0" onClick={() => handleMarkNeg(neg.id, "perdida")} title="Marcar Perdida">
        <XCircle className="h-3.5 w-3.5 text-destructive" />
      </Button>
      <Button size="sm" variant="ghost" className="h-6 w-6 p-0" onClick={() => handleDeleteNeg(neg.id)} title="Excluir">
        <Trash2 className="h-3.5 w-3.5 text-destructive" />
      </Button>
    </div>
  );

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <h2 className="font-heading text-base sm:text-lg md:text-xl font-bold text-foreground flex items-center gap-2">
          <BarChart3 className="h-4 w-4 sm:h-5 sm:w-5" /> KPIs de Performance
        </h2>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" className="h-8 text-xs gap-1" onClick={openVisitDialog}>
            <ClipboardList className="h-3.5 w-3.5" /> Registrar Visitas
          </Button>
          <Select value={String(filterYear)} onValueChange={v => setFilterYear(parseInt(v))}>
            <SelectTrigger className="w-[80px] bg-secondary/50 border-border text-xs h-8">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {[2024, 2025, 2026, 2027].map(y => (
                <SelectItem key={y} value={String(y)}>{y}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Period toggle pills */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1 bg-secondary/50 rounded-full p-0.5">
          <PillButton active={periodMode === "week"} onClick={() => setPeriodMode("week")}>Semana</PillButton>
          <PillButton active={periodMode === "month"} onClick={() => setPeriodMode("month")}>Mês</PillButton>
          <PillButton active={periodMode === "quarter"} onClick={() => setPeriodMode("quarter")}>Trimestre</PillButton>
          <PillButton active={periodMode === "year"} onClick={() => setPeriodMode("year")}>Ano</PillButton>
        </div>

        {periodMode === "week" && (
          <Select value={String(filterWeek)} onValueChange={v => setFilterWeek(parseInt(v))}>
            <SelectTrigger className="w-[100px] bg-secondary/50 border-border text-xs h-8">
              <SelectValue placeholder="Semana" />
            </SelectTrigger>
            <SelectContent>
              {weekOptions.map(w => (
                <SelectItem key={w} value={String(w)}>Sem {w}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        {periodMode === "quarter" && (
          <div className="flex items-center gap-1 bg-secondary/50 rounded-full p-0.5">
            {["T1", "T2", "T3", "T4"].map(q => (
              <PillButton key={q} active={filterQuarter === q} onClick={() => setFilterQuarter(q)}>{q}</PillButton>
            ))}
          </div>
        )}

        {periodMode === "month" && (
          <div className="flex items-center gap-1 flex-wrap">
            {SHORT_MONTHS.map((m, i) => (
              <PillButton key={m} active={filterMonth === i + 1} onClick={() => setFilterMonth(i + 1)}>{m}</PillButton>
            ))}
          </div>
        )}

        <Badge variant="outline" className="text-xs ml-auto">
          <Calendar className="h-3 w-3 mr-1" />
          {periodLabel}
        </Badge>
      </div>

      {/* View Tab Pills */}
      <div className="flex items-center gap-1 bg-secondary/50 rounded-full p-0.5 w-fit">
        <PillButton active={viewTab === "equipe"} onClick={() => setViewTab("equipe")}>
          <span className="flex items-center gap-1"><Users className="h-3 w-3" /> Equipe</span>
        </PillButton>
        <PillButton active={viewTab === "representante"} onClick={() => setViewTab("representante")}>
          <span className="flex items-center gap-1"><Target className="h-3 w-3" /> Por Representante</span>
        </PillButton>
        <PillButton active={viewTab === "perdas"} onClick={() => setViewTab("perdas")}>
          <span className="flex items-center gap-1"><XCircle className="h-3 w-3" /> Perdas</span>
        </PillButton>
        <PillButton active={viewTab === "visitas"} onClick={() => setViewTab("visitas")}>
          <span className="flex items-center gap-1"><Eye className="h-3 w-3" /> Visitas</span>
        </PillButton>
      </div>

      {/* ===================== VIEW: EQUIPE ===================== */}
      {viewTab === "equipe" && (
        <>
          {/* Alert: losses without reason */}
          {lostWithoutReason > 0 && (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-destructive/10 border border-destructive/30">
              <AlertTriangle className="h-4 w-4 text-destructive shrink-0" />
              <span className="text-xs text-destructive font-medium">
                {lostWithoutReason} negociação(ões) perdida(s) sem motivo registrado. Acesse a aba <button className="underline font-bold" onClick={() => setViewTab("perdas")}>Perdas</button> para completar.
              </span>
            </div>
          )}

          {/* Global KPI Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            <KpiCard icon={<Eye className="h-4 w-4" />} label="Visitas" value={String(globalKpis.totalVisits)} color="bg-primary/10 text-primary" />
            <KpiCard icon={<Target className="h-4 w-4" />} label="Oportunidades Ativas" value={String(globalKpis.totalOpps)} sub={formatBrl(globalKpis.totalPipeline)} color="bg-accent/10 text-accent" />
            <KpiCard icon={<FileText className="h-4 w-4" />} label={`Neg. Abertas (${periodLabel})`} value={String(openByRep.reduce((s, r) => s + r.total, 0))} sub={`Radar: ${openByRep.reduce((s, r) => s + r.radar, 0)} | Vendas: ${openByRep.reduce((s, r) => s + r.vendas, 0)}`} color="bg-primary/10 text-primary" />
            <KpiCard icon={<XCircle className="h-4 w-4" />} label="Perdidas" value={String(globalKpis.totalLost)} color="bg-destructive/10 text-destructive" />
            <KpiCard icon={<CheckCircle className="h-4 w-4" />} label="Win Rate" value={formatPct(globalKpis.globalWinRate)} sub={`${globalKpis.totalWon}W / ${globalKpis.totalLost}L`} color="bg-accent/10 text-accent" />
          </div>

          {/* Meta vs Realizado global */}
          <Card className="p-4 border-border bg-card">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-foreground">Meta vs Realizado — {periodLabel}</span>
              <Badge variant={metaPct >= 100 ? "default" : metaPct >= 70 ? "secondary" : "destructive"} className="text-xs">
                {formatPct(metaPct)}
              </Badge>
            </div>
            <Progress value={Math.min(metaPct, 100)} className="h-3" />
            <div className="flex justify-between text-xs text-muted-foreground mt-1">
              <span>Realizado: {formatBrl(globalKpis.totalRealized)}</span>
              <span>Meta: {formatBrl(globalKpis.totalMeta)}</span>
            </div>
          </Card>

          {/* Weekly visits chart */}
          {periodMode === "week" && weeklyChartData.length > 0 && (
            <Card className="p-4 border-border bg-card">
              <h3 className="text-sm font-semibold text-foreground mb-3">Evolução de Visitas Semanais</h3>
              <div className="h-[220px]">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={weeklyChartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="semana" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                    <YAxis tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} allowDecimals={false} />
                    <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }} />
                    <Legend />
                    <Line type="monotone" dataKey="realizadas" stroke="hsl(var(--primary))" strokeWidth={2} dot={{ r: 4, fill: "hsl(var(--primary))" }} name="Realizadas" />
                    <Line type="monotone" dataKey="meta" stroke="hsl(var(--muted-foreground))" strokeWidth={2} strokeDasharray="5 5" dot={false} name="Meta" />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </Card>
          )}

          {/* Negociações Abertas por Representante */}
          <Card className="p-4 border-border bg-card">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-foreground">Negociações Abertas por Representante — {periodLabel}</h3>
              <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={openNewNeg}>
                <Plus className="h-3 w-3" /> Nova Negociação
              </Button>
            </div>
            {openByRep.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-6">Nenhuma negociação aberta neste período</p>
            ) : (
              <div className="h-[220px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={openByRep} barGap={2}>
                    <XAxis dataKey="nome" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                    <YAxis tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} allowDecimals={false} />
                    <Tooltip
                      formatter={(value: number, name: string) => [value, name === "radar" ? "Radar" : "Vendas Abertas"]}
                      contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }}
                    />
                    <Legend formatter={(value) => value === "radar" ? "Radar" : "Vendas Abertas"} />
                    <Bar dataKey="radar" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="vendas" fill="hsl(var(--accent))" radius={[4, 4, 0, 0]} opacity={0.7} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}

            {/* Active negotiations list */}
            {(() => {
              const activeNegs = closingDeals.filter(c => c.status === "ativa" && isInPeriod(new Date(c.created_at)));
              if (activeNegs.length === 0) return null;
              return (
                <div className="mt-4 space-y-2 max-h-[300px] overflow-y-auto">
                  <h4 className="text-xs font-semibold text-muted-foreground">Negociações ativas ({activeNegs.length})</h4>
                  {activeNegs.map(neg => {
                    const repName = reps.find(r => r.id === neg.representative_id)?.nome || "—";
                    return (
                      <div key={neg.id} className="flex items-center justify-between gap-2 p-2 rounded-lg bg-secondary/30 border border-border">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                            <span className="text-xs font-semibold text-foreground">{neg.client_name || "—"}</span>
                            <Badge variant="outline" className="text-[10px]">{repName}</Badge>
                            <Badge variant="secondary" className="text-[10px]">{neg.stage}</Badge>
                          </div>
                          <p className="text-[10px] text-muted-foreground">{neg.machine_name && `${neg.machine_name} · `}{formatBrl(neg.deal_value)}</p>
                        </div>
                        {renderNegActions(neg)}
                      </div>
                    );
                  })}
                </div>
              );
            })()}
          </Card>

          {/* Chart: Meta vs Realizado by Rep */}
          {chartData.length > 0 && (
            <Card className="p-4 border-border bg-card">
              <h3 className="text-sm font-semibold text-foreground mb-3">Meta vs Realizado por Representante — {periodLabel}</h3>
              <div className="h-[250px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData} barGap={2}>
                    <XAxis dataKey="nome" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                    <YAxis tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} tickFormatter={v => v >= 1000000 ? `${(v/1000000).toFixed(1)}M` : v >= 1000 ? `${(v/1000).toFixed(0)}k` : String(v)} />
                    <Tooltip
                      formatter={(value: number, name: string) => [formatBrl(value), name === "meta" ? "Meta" : "Realizado"]}
                      contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }}
                    />
                    <Legend formatter={(value) => value === "meta" ? "Meta" : "Realizado"} />
                    <Bar dataKey="meta" fill="hsl(var(--muted-foreground))" radius={[4, 4, 0, 0]} opacity={0.4} />
                    <Bar dataKey="realizado" radius={[4, 4, 0, 0]}>
                      {chartData.map((entry, i) => (
                        <Cell key={i} fill={entry.realizado >= entry.meta ? "hsl(var(--accent))" : "hsl(var(--primary))"} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Card>
          )}
        </>
      )}

      {/* ===================== VIEW: POR REPRESENTANTE ===================== */}
      {viewTab === "representante" && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
              <Users className="h-4 w-4" /> Detalhamento por Representante — {periodLabel}
            </h3>
            <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={openNewNeg}>
              <Plus className="h-3 w-3" /> Nova Negociação
            </Button>
          </div>
          {repMetrics.map(r => {
            const metaColor = r.pctValor >= 100 ? "text-accent" : r.pctValor >= 70 ? "text-foreground" : "text-destructive";
            const isExpanded = expandedReps.has(r.id);
            const repActiveNegs = closingDeals.filter(c => c.representative_id === r.id && c.status === "ativa");
            return (
              <Card key={r.id} className="border-border bg-card overflow-hidden">
                <button
                  className="w-full p-4 text-left flex items-center justify-between hover:bg-secondary/20 transition-colors"
                  onClick={() => toggleRepExpanded(r.id)}
                >
                  <div className="flex items-center gap-2">
                    <h4 className="font-semibold text-sm text-foreground">{r.nome}</h4>
                    <div className="flex gap-1.5 flex-wrap">
                      {r.winRate >= 60 && <Badge variant="secondary" className="text-[10px]">🔥 Top Closer</Badge>}
                      {r.pctValor >= 100 && <Badge className="text-[10px] bg-accent text-accent-foreground">✅ Meta Batida</Badge>}
                      {r.lostCount > r.wonCount && r.lostCount > 0 && <Badge variant="destructive" className="text-[10px]">⚠️ Atenção</Badge>}
                    </div>
                  </div>
                  {isExpanded ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
                </button>

                <div className="px-4 pb-4">
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                    <MetricCell label="Visitas" value={String(r.totalVisits)} sub={r.visitPct > 0 ? `${formatPct(r.visitPct)} da meta` : "—"} icon={<Eye className="h-3 w-3" />} />
                    <MetricCell label="Oportunidades" value={String(r.oppCount)} sub={formatBrl(r.weightedPipeline) + " pond."} icon={<Target className="h-3 w-3" />} />
                    <MetricCell label="Perdidas" value={String(r.lostCount)} sub={formatBrl(r.lostValue)} icon={<XCircle className="h-3 w-3 text-destructive" />} />
                    <MetricCell label="Win Rate" value={formatPct(r.winRate)} sub={`${r.wonCount}W / ${r.lostCount}L`} icon={r.winRate >= 50 ? <TrendingUp className="h-3 w-3 text-accent" /> : <TrendingDown className="h-3 w-3 text-destructive" />} />
                  </div>
                  <div className="mt-3 space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">Meta Valor ({periodLabel})</span>
                      <span className={`font-semibold ${metaColor}`}>{formatPct(r.pctValor)} — {formatBrl(r.closedFobBrl)} / {formatBrl(r.metaValor)}</span>
                    </div>
                    <Progress value={Math.min(r.pctValor, 100)} className="h-2" />
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">Meta Qtd ({periodLabel})</span>
                      <span className="font-medium text-foreground">{r.closedCount} / {r.metaQtd} máq ({formatPct(r.pctQtd)})</span>
                    </div>
                    <Progress value={Math.min(r.pctQtd, 100)} className="h-2" />
                  </div>
                  <div className="mt-2 flex gap-4 text-[11px] text-muted-foreground">
                    <span>Ano: {r.yearCount} máq</span>
                    <span>{formatBrl(r.yearFobBrl)} faturado</span>
                  </div>
                </div>

                {/* Expanded: active negotiations */}
                {isExpanded && (
                  <div className="border-t border-border px-4 py-3 bg-secondary/10 space-y-2">
                    <h5 className="text-xs font-semibold text-muted-foreground">Negociações ativas ({repActiveNegs.length})</h5>
                    {repActiveNegs.length === 0 ? (
                      <p className="text-xs text-muted-foreground py-2">Nenhuma negociação ativa</p>
                    ) : (
                      repActiveNegs.map(neg => (
                        <div key={neg.id} className="flex items-center justify-between gap-2 p-2 rounded-lg bg-card border border-border">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                              <span className="text-xs font-semibold text-foreground">{neg.client_name || "—"}</span>
                              <Badge variant="secondary" className="text-[10px]">{neg.stage}</Badge>
                              <Badge variant={neg.probability === "Alta" ? "default" : neg.probability === "Baixa" ? "destructive" : "secondary"} className="text-[10px]">{neg.probability}</Badge>
                            </div>
                            <p className="text-[10px] text-muted-foreground">{neg.machine_name && `${neg.machine_name} · `}{formatBrl(neg.deal_value)}</p>
                          </div>
                          {renderNegActions(neg)}
                        </div>
                      ))
                    )}
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}

      {/* ===================== VIEW: PERDAS ===================== */}
      {viewTab === "perdas" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
              <PieChart className="h-4 w-4 text-destructive" /> Análise de Perdas — {periodLabel}
            </h3>
          </div>

          {/* Rep filter pills */}
          <div className="flex items-center gap-1 flex-wrap">
            <PillButton active={lossRepFilter === "all"} onClick={() => setLossRepFilter("all")}>Todos</PillButton>
            {reps.map(r => (
              <PillButton key={r.id} active={lossRepFilter === r.id} onClick={() => setLossRepFilter(r.id)}>
                {r.nome.split(" ")[0]}
              </PillButton>
            ))}
          </div>

          {lossAnalysis.lostDeals.length === 0 ? (
            <Card className="p-6 border-border bg-card">
              <p className="text-xs text-muted-foreground text-center">Nenhuma perda registrada neste período</p>
            </Card>
          ) : (
            <>
              {/* Ranking horizontal bars */}
              <Card className="p-4 border-border bg-card">
                <h4 className="text-xs font-semibold text-foreground mb-3">Ranking de Motivos</h4>
                {lossAnalysis.rankingData.length === 0 ? (
                  <p className="text-xs text-muted-foreground text-center py-4">Nenhum motivo registrado</p>
                ) : (
                  <div className="space-y-2">
                    {lossAnalysis.rankingData.map((item, i) => {
                      const maxVal = lossAnalysis.rankingData[0]?.value || 1;
                      const barWidth = (item.value / maxVal) * 100;
                      return (
                        <div key={item.name} className="space-y-1">
                          <div className="flex justify-between text-xs">
                            <span className="text-foreground font-medium">{item.name}</span>
                            <span className="text-muted-foreground">{item.value} ({item.pct.toFixed(0)}%)</span>
                          </div>
                          <div className="h-2 bg-secondary rounded-full overflow-hidden">
                            <div
                              className="h-full rounded-full transition-all"
                              style={{ width: `${barWidth}%`, backgroundColor: LOSS_BAR_COLORS[i % LOSS_BAR_COLORS.length] }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </Card>

              {/* Monthly loss chart */}
              <Card className="p-4 border-border bg-card">
                <h4 className="text-xs font-semibold text-foreground mb-3">Perdas por Mês</h4>
                <div className="h-[200px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={lossAnalysis.monthlyLoss}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis dataKey="mes" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />
                      <YAxis tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} allowDecimals={false} />
                      <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }} />
                      <Bar dataKey="perdas" fill="hsl(var(--destructive))" radius={[4, 4, 0, 0]} name="Perdas" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </Card>

              {/* Detailed loss table */}
              <Card className="p-4 border-border bg-card">
                <h4 className="text-xs font-semibold text-foreground mb-3">Lista Detalhada de Perdas ({lossAnalysis.lostDeals.length})</h4>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-xs">Cliente</TableHead>
                        <TableHead className="text-xs">Representante</TableHead>
                        <TableHead className="text-xs">Motivo</TableHead>
                        <TableHead className="text-xs">Máquina</TableHead>
                        <TableHead className="text-xs">Valor</TableHead>
                        <TableHead className="text-xs">Data</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {lossAnalysis.lostDeals
                        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
                        .map(deal => {
                          const repName = reps.find(r => r.id === deal.representative_id)?.nome || "—";
                          const reason = getLostReason(deal);
                          const detail = getLostDetail(deal);
                          const displayReason = reason
                            ? (reason === "Outro" && detail ? `Outro: ${detail}` : reason)
                            : "—";
                          return (
                            <TableRow key={deal.id}>
                              <TableCell className="text-xs font-medium">{deal.client_name || "—"}</TableCell>
                              <TableCell className="text-xs"><Badge variant="outline" className="text-[10px]">{repName}</Badge></TableCell>
                              <TableCell className="text-xs">
                                {reason ? <Badge variant="destructive" className="text-[10px]">{displayReason}</Badge> : <span className="text-muted-foreground">—</span>}
                              </TableCell>
                              <TableCell className="text-xs">{deal.machine_name || "—"}</TableCell>
                              <TableCell className="text-xs">{formatBrl(deal.deal_value)}</TableCell>
                              <TableCell className="text-xs text-muted-foreground">{new Date(deal.created_at).toLocaleDateString("pt-BR")}</TableCell>
                            </TableRow>
                          );
                        })}
                    </TableBody>
                  </Table>
                </div>
              </Card>
            </>
          )}
        </div>
      )}

      {/* ===================== VIEW: VISITAS ===================== */}
      {viewTab === "visitas" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
              <Eye className="h-4 w-4" /> Controle de Visitas — {filterYear}
            </h3>
            <div className="flex items-center gap-2">
              <Label className="text-xs text-muted-foreground">Semana:</Label>
              <Select value={String(visitEditWeek)} onValueChange={v => setVisitEditWeek(parseInt(v))}>
                <SelectTrigger className="w-[100px] bg-secondary/50 border-border text-xs h-8">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Array.from({ length: 52 }, (_, i) => i + 1).map(w => (
                    <SelectItem key={w} value={String(w)}>Sem {w}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Editable table */}
          <Card className="p-4 border-border bg-card">
            <h4 className="text-xs font-semibold text-foreground mb-3">Registrar / Editar Visitas — Semana {visitEditWeek}</h4>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs">Representante</TableHead>
                    <TableHead className="text-xs text-center">Meta</TableHead>
                    <TableHead className="text-xs text-center">Realizadas</TableHead>
                    <TableHead className="text-xs text-center">%</TableHead>
                    <TableHead className="text-xs text-center">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {reps.map(rep => {
                    const existing = allVisits.find(v => v.representative_id === rep.id && v.semana === visitEditWeek && v.ano === filterYear);
                    const inlineKey = `${rep.id}-${visitEditWeek}`;
                    const inlineEntry = visitInlineEntries[inlineKey];
                    const meta = inlineEntry?.meta ?? existing?.meta ?? 16;
                    const qtd = inlineEntry?.quantidade ?? existing?.quantidade ?? 0;
                    const pct = meta > 0 ? (qtd / meta) * 100 : 0;
                    const statusColor = pct >= 100 ? "text-accent" : pct >= 75 ? "text-foreground" : "text-destructive";
                    const statusBadge = pct >= 100 ? "default" : pct >= 75 ? "secondary" : "destructive";
                    return (
                      <TableRow key={rep.id}>
                        <TableCell className="text-xs font-medium">{rep.nome}</TableCell>
                        <TableCell className="text-center">
                          <Input
                            type="number"
                            value={meta}
                            onChange={e => {
                              setVisitInlineEntries(prev => ({
                                ...prev,
                                [inlineKey]: { meta: Number(e.target.value), quantidade: prev[inlineKey]?.quantidade ?? qtd },
                              }));
                            }}
                            className="h-8 w-16 text-xs text-center mx-auto"
                          />
                        </TableCell>
                        <TableCell className="text-center">
                          <Input
                            type="number"
                            value={qtd}
                            onChange={e => {
                              setVisitInlineEntries(prev => ({
                                ...prev,
                                [inlineKey]: { meta: prev[inlineKey]?.meta ?? meta, quantidade: Number(e.target.value) },
                              }));
                            }}
                            className="h-8 w-16 text-xs text-center mx-auto"
                          />
                        </TableCell>
                        <TableCell className={`text-xs text-center font-semibold ${statusColor}`}>{formatPct(pct)}</TableCell>
                        <TableCell className="text-center">
                          <Badge variant={statusBadge as any} className="text-[10px]">
                            {pct >= 100 ? "✅ Atingiu" : pct >= 75 ? "⚠️ Parcial" : "❌ Abaixo"}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
            <Button
              className="w-full mt-3 h-9 text-sm"
              disabled={visitSaving}
              onClick={async () => {
                setVisitSaving(true);
                for (const rep of reps) {
                  const key = `${rep.id}-${visitEditWeek}`;
                  const existing = allVisits.find(v => v.representative_id === rep.id && v.semana === visitEditWeek && v.ano === filterYear);
                  const entry = visitInlineEntries[key];
                  const meta = entry?.meta ?? existing?.meta ?? 16;
                  const qtd = entry?.quantidade ?? existing?.quantidade ?? 0;
                  await supabase.from("weekly_visits" as any).upsert({
                    user_id: userId,
                    representative_id: rep.id,
                    ano: filterYear,
                    semana: visitEditWeek,
                    meta,
                    quantidade: qtd,
                  } as any, { onConflict: "representative_id,ano,semana" });
                }
                const { data } = await supabase.from("weekly_visits" as any).select("representative_id, semana, quantidade, meta, ano").eq("ano", filterYear);
                if (data) { setVisits(data as any); setAllVisits(data as any); }
                setVisitInlineEntries({});
                setVisitSaving(false);
                toast.success("Visitas salvas!");
              }}
            >
              {visitSaving ? "Salvando..." : "Salvar Visitas"}
            </Button>
          </Card>

          {/* Resumo anual */}
          <Card className="p-4 border-border bg-card">
            <h4 className="text-xs font-semibold text-foreground mb-3">Resumo Anual — {filterYear}</h4>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs">Representante</TableHead>
                    <TableHead className="text-xs text-center">Semanas</TableHead>
                    <TableHead className="text-xs text-center">Total Realizadas</TableHead>
                    <TableHead className="text-xs text-center">Total Meta</TableHead>
                    <TableHead className="text-xs text-center">Média/Sem</TableHead>
                    <TableHead className="text-xs text-center">% Geral</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {reps.map(rep => {
                    const repVisits = allVisits.filter(v => v.representative_id === rep.id && v.ano === filterYear);
                    const totalQtd = repVisits.reduce((s, v) => s + v.quantidade, 0);
                    const totalMeta = repVisits.reduce((s, v) => s + v.meta, 0);
                    const weekCount = repVisits.length;
                    const avg = weekCount > 0 ? totalQtd / weekCount : 0;
                    const pct = totalMeta > 0 ? (totalQtd / totalMeta) * 100 : 0;
                    const statusColor = pct >= 100 ? "text-accent" : pct >= 75 ? "text-foreground" : "text-destructive";
                    return (
                      <TableRow key={rep.id}>
                        <TableCell className="text-xs font-medium">{rep.nome}</TableCell>
                        <TableCell className="text-xs text-center">{weekCount}</TableCell>
                        <TableCell className="text-xs text-center font-semibold">{totalQtd}</TableCell>
                        <TableCell className="text-xs text-center text-muted-foreground">{totalMeta}</TableCell>
                        <TableCell className="text-xs text-center">{avg.toFixed(1)}</TableCell>
                        <TableCell className={`text-xs text-center font-semibold ${statusColor}`}>{formatPct(pct)}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </Card>

          {/* Evolução semanal chart */}
          {(() => {
            const weeks: { semana: string; realizadas: number; meta: number }[] = [];
            for (let w = Math.max(1, visitEditWeek - 7); w <= visitEditWeek; w++) {
              const wVisits = allVisits.filter(v => v.semana === w && v.ano === filterYear);
              const totalR = wVisits.reduce((s, v) => s + v.quantidade, 0);
              const totalM = wVisits.reduce((s, v) => s + v.meta, 0) || reps.length * 16;
              weeks.push({ semana: `S${w}`, realizadas: totalR, meta: totalM });
            }
            if (weeks.length === 0) return null;
            return (
              <Card className="p-4 border-border bg-card">
                <h4 className="text-xs font-semibold text-foreground mb-3">Evolução Semanal</h4>
                <div className="h-[220px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={weeks}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis dataKey="semana" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                      <YAxis tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} allowDecimals={false} />
                      <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }} />
                      <Legend />
                      <Line type="monotone" dataKey="realizadas" stroke="hsl(var(--primary))" strokeWidth={2} dot={{ r: 4, fill: "hsl(var(--primary))" }} name="Realizadas" />
                      <Line type="monotone" dataKey="meta" stroke="hsl(var(--muted-foreground))" strokeWidth={2} strokeDasharray="5 5" dot={false} name="Meta" />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </Card>
            );
          })()}
        </div>
      )}

      {/* ===================== DIALOGS ===================== */}

      {/* Negociação Dialog */}
      <Dialog open={negDialogOpen} onOpenChange={(v) => { setNegDialogOpen(v); if (!v) resetNegForm(); }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-base">{editingNegId ? "Editar Negociação" : "Nova Negociação"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Representante *</Label>
                <Select value={negForm.representative_id} onValueChange={v => setNegForm(f => ({ ...f, representative_id: v }))}>
                  <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="Selecione..." /></SelectTrigger>
                  <SelectContent>
                    {reps.map(r => <SelectItem key={r.id} value={r.id}>{r.nome}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Cliente *</Label>
                <Input value={negForm.client_name} onChange={e => setNegForm(f => ({ ...f, client_name: e.target.value }))} className="h-9 text-sm" placeholder="Nome do cliente" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Máquina</Label>
                <Input value={negForm.machine_name} onChange={e => setNegForm(f => ({ ...f, machine_name: e.target.value }))} className="h-9 text-sm" placeholder="Ex: VMC-850" />
              </div>
              <div>
                <Label className="text-xs">Valor (R$)</Label>
                <Input type="number" value={negForm.deal_value || ""} onChange={e => setNegForm(f => ({ ...f, deal_value: Number(e.target.value) }))} className="h-9 text-sm" placeholder="0" />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label className="text-xs">Estágio</Label>
                <Select value={negForm.stage} onValueChange={v => setNegForm(f => ({ ...f, stage: v as any }))}>
                  <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Proposta Enviada">Proposta Enviada</SelectItem>
                    <SelectItem value="Negociação Ativa">Negociação Ativa</SelectItem>
                    <SelectItem value="Decisão Próxima">Decisão Próxima</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Probabilidade</Label>
                <Select value={negForm.probability} onValueChange={v => setNegForm(f => ({ ...f, probability: v as any }))}>
                  <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Baixa">Baixa</SelectItem>
                    <SelectItem value="Média">Média</SelectItem>
                    <SelectItem value="Alta">Alta</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Tipo Venda</Label>
                <Select value={negForm.sale_type} onValueChange={v => setNegForm(f => ({ ...f, sale_type: v as any }))}>
                  <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Venda Direta">Venda Direta</SelectItem>
                    <SelectItem value="Rentall">Rentall</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label className="text-xs">Observações</Label>
              <Textarea value={negForm.notes} onChange={e => setNegForm(f => ({ ...f, notes: e.target.value }))} className="text-sm min-h-[60px]" placeholder="Notas sobre a negociação..." />
            </div>
            <Button onClick={handleSaveNeg} className="w-full h-9 text-sm">
              {editingNegId ? "Atualizar Negociação" : "Registrar Negociação"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Loss Reason Dialog */}
      <Dialog open={lossDialogOpen} onOpenChange={v => { setLossDialogOpen(v); if (!v) setLossTargetId(null); }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-base">Motivo da Perda</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-xs">Motivo *</Label>
              <Select value={lossMotivo} onValueChange={v => setLossMotivo(v)}>
                <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="Selecione o motivo..." /></SelectTrigger>
                <SelectContent>
                  {LOSS_REASONS.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            {lossMotivo === "Outro" && (
              <div>
                <Label className="text-xs">Observações *</Label>
                <Textarea value={lossDetalhe} onChange={e => setLossDetalhe(e.target.value)} className="text-sm min-h-[60px]" placeholder="Descreva o motivo..." />
              </div>
            )}
            {lossMotivo && lossMotivo !== "Outro" && (
              <div>
                <Label className="text-xs">Observações (opcional)</Label>
                <Textarea value={lossDetalhe} onChange={e => setLossDetalhe(e.target.value)} className="text-sm min-h-[60px]" placeholder="Informações adicionais..." />
              </div>
            )}
            <Button onClick={confirmLoss} className="w-full h-9 text-sm" variant="destructive">
              Confirmar Perda
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Visit Registration Dialog */}
      <Dialog open={visitDialogOpen} onOpenChange={setVisitDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base">Registrar Visitas — Semana {getWeekNumber(now)}/{filterYear}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 max-h-[400px] overflow-y-auto">
            {visitEntries.map((entry, i) => {
              const rep = reps.find(r => r.id === entry.rep_id);
              if (!rep) return null;
              return (
                <div key={entry.rep_id} className="flex items-center gap-3 p-2 rounded-lg bg-secondary/30 border border-border">
                  <span className="text-xs font-medium text-foreground flex-1 min-w-0 truncate">{rep.nome}</span>
                  <div className="flex items-center gap-2">
                    <div className="text-center">
                      <Label className="text-[10px] text-muted-foreground">Meta</Label>
                      <Input
                        type="number"
                        value={entry.meta}
                        onChange={e => {
                          const next = [...visitEntries];
                          next[i] = { ...next[i], meta: Number(e.target.value) };
                          setVisitEntries(next);
                        }}
                        className="h-8 w-16 text-xs text-center"
                      />
                    </div>
                    <div className="text-center">
                      <Label className="text-[10px] text-muted-foreground">Realizadas</Label>
                      <Input
                        type="number"
                        value={entry.quantidade}
                        onChange={e => {
                          const next = [...visitEntries];
                          next[i] = { ...next[i], quantidade: Number(e.target.value) };
                          setVisitEntries(next);
                        }}
                        className="h-8 w-16 text-xs text-center"
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
          <Button onClick={handleSaveVisits} className="w-full h-9 text-sm">
            Salvar Visitas
          </Button>
        </DialogContent>
      </Dialog>
    </div>
  );
};

const KpiCard = ({ icon, label, value, color, sub }: { icon: React.ReactNode; label: string; value: string; color: string; sub?: string }) => (
  <Card className="p-3 border-border bg-card shadow-sm">
    <div className="flex items-center gap-2 mb-1">
      <div className={`flex h-7 w-7 items-center justify-center rounded-lg ${color}`}>{icon}</div>
      <span className="text-[10px] sm:text-xs text-muted-foreground">{label}</span>
    </div>
    <p className="text-sm sm:text-lg font-bold text-foreground">{value}</p>
    {sub && <p className="text-[10px] text-muted-foreground mt-0.5">{sub}</p>}
  </Card>
);

const MetricCell = ({ label, value, sub, icon }: { label: string; value: string; sub: string; icon: React.ReactNode }) => (
  <div className="space-y-0.5">
    <div className="flex items-center gap-1 text-muted-foreground">{icon}<span>{label}</span></div>
    <p className="font-semibold text-foreground text-sm">{value}</p>
    <p className="text-muted-foreground text-[10px]">{sub}</p>
  </div>
);

export default RepKPIs;
