import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Target, Eye, TrendingUp, TrendingDown, XCircle, CheckCircle, BarChart3, Users, Calendar, MessageSquare, Plus, FileText, Trash2, Edit2 } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, Legend } from "recharts";
import { toast } from "sonner";

interface Props { userId: string; }
interface Rep { id: string; nome: string; meta_mensal_padrao: number; meta_quantidade: number; }
interface Deal { id: string; representative_id: string | null; status: string; closed_at: string | null; created_at: string; base_price: number; dollar_rate: number; machine_type: string; }
interface ClosingDeal { id: string; representative_id: string | null; status: string; deal_value: number; start_date: string; stage: string; probability: string; created_at: string; }
interface Visit { representative_id: string; semana: number; quantidade: number; meta: number; }
interface MonthlyGoal { representative_id: string; mes: number; meta_valor: number; meta_quantidade: number; machine_type: string; }
interface Feedback { id: string; representative_id: string; descricao: string; status: string; prioridade: string; created_at: string; resolved_at: string | null; }

type PeriodMode = "week" | "month" | "quarter" | "year";

const SHORT_MONTHS = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];
const QUARTER_MONTHS: Record<string, number[]> = { T1: [1,2,3], T2: [4,5,6], T3: [7,8,9], T4: [10,11,12] };
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
  const [feedbacks, setFeedbacks] = useState<Feedback[]>([]);
  const [loading, setLoading] = useState(true);
  const now = new Date();
  const [filterYear, setFilterYear] = useState(now.getFullYear());
  const [periodMode, setPeriodMode] = useState<PeriodMode>("month");
  const [filterMonth, setFilterMonth] = useState(now.getMonth() + 1);
  const [filterQuarter, setFilterQuarter] = useState<string>(`T${Math.floor(now.getMonth() / 3) + 1}`);
  const [filterWeek, setFilterWeek] = useState(getWeekNumber(now));

  // Feedback dialog
  const [fbDialogOpen, setFbDialogOpen] = useState(false);
  const [fbRepId, setFbRepId] = useState("");
  const [fbDesc, setFbDesc] = useState("");
  const [fbPrioridade, setFbPrioridade] = useState("normal");

  // Negociação dialog
  const [negDialogOpen, setNegDialogOpen] = useState(false);
  const [editingNegId, setEditingNegId] = useState<string | null>(null);
  const [negForm, setNegForm] = useState({
    representative_id: "",
    client_name: "",
    machine_name: "",
    machine_type: "Centro de Usinagem",
    deal_value: 0,
    stage: "Proposta Enviada" as "Proposta Enviada" | "Negociação Ativa" | "Decisão Próxima",
    probability: "Média" as "Baixa" | "Média" | "Alta",
    sale_type: "Venda Direta" as "Rentall" | "Venda Direta",
    notes: "",
  });

  const resetNegForm = () => {
    setNegForm({ representative_id: "", client_name: "", machine_name: "", machine_type: "Centro de Usinagem", deal_value: 0, stage: "Proposta Enviada", probability: "Média", sale_type: "Venda Direta", notes: "" });
    setEditingNegId(null);
  };

  const openNewNeg = () => { resetNegForm(); setNegDialogOpen(true); };

  const openEditNeg = (c: ClosingDeal) => {
    setEditingNegId(c.id);
    setNegForm({
      representative_id: c.representative_id || "",
      client_name: (c as any).client_name || "",
      machine_name: (c as any).machine_name || "",
      machine_type: (c as any).machine_type || "Centro de Usinagem",
      deal_value: c.deal_value,
      stage: c.stage as any,
      probability: c.probability as any,
      sale_type: (c as any).sale_type || "Venda Direta",
      notes: (c as any).notes || "",
    });
    setNegDialogOpen(true);
  };

  const handleSaveNeg = async () => {
    if (!negForm.representative_id || !negForm.client_name.trim()) {
      toast.error("Preencha representante e cliente");
      return;
    }
    if (editingNegId) {
      const { error } = await supabase.from("closing_deals" as any).update({
        representative_id: negForm.representative_id,
        client_name: negForm.client_name.trim(),
        machine_name: negForm.machine_name.trim(),
        machine_type: negForm.machine_type,
        deal_value: negForm.deal_value,
        stage: negForm.stage,
        probability: negForm.probability,
        sale_type: negForm.sale_type,
        notes: negForm.notes.trim() || null,
      } as any).eq("id", editingNegId);
      if (error) { toast.error("Erro ao atualizar"); return; }
      toast.success("Negociação atualizada");
    } else {
      const { error } = await supabase.from("closing_deals" as any).insert({
        user_id: userId,
        representative_id: negForm.representative_id,
        client_name: negForm.client_name.trim(),
        machine_name: negForm.machine_name.trim(),
        machine_type: negForm.machine_type,
        deal_value: negForm.deal_value,
        stage: negForm.stage,
        probability: negForm.probability,
        sale_type: negForm.sale_type,
        notes: negForm.notes.trim() || null,
      } as any);
      if (error) { toast.error("Erro ao salvar"); return; }
      toast.success("Negociação registrada");
    }
    setNegDialogOpen(false);
    resetNegForm();
    // Reload closing deals
    const { data } = await supabase.from("closing_deals" as any).select("id, representative_id, status, deal_value, start_date, stage, probability, created_at, client_name, machine_name, machine_type, sale_type, notes");
    if (data) setClosingDeals(data as any);
  };

  const handleDeleteNeg = async (id: string) => {
    await supabase.from("closing_deals" as any).delete().eq("id", id);
    toast.success("Negociação excluída");
    const { data } = await supabase.from("closing_deals" as any).select("id, representative_id, status, deal_value, start_date, stage, probability, created_at, client_name, machine_name, machine_type, sale_type, notes");
    if (data) setClosingDeals(data as any);
  };

  const handleMarkNeg = async (id: string, status: "ganha" | "perdida") => {
    await supabase.from("closing_deals" as any).update({ status } as any).eq("id", id);
    toast.success(status === "ganha" ? "Marcada como ganha!" : "Marcada como perdida");
    const { data } = await supabase.from("closing_deals" as any).select("id, representative_id, status, deal_value, start_date, stage, probability, created_at, client_name, machine_name, machine_type, sale_type, notes");
    if (data) setClosingDeals(data as any);
  };

  const fetchFeedbacks = async () => {
    const { data } = await supabase.from("feedbacks" as any).select("*").order("created_at", { ascending: false });
    if (data) setFeedbacks(data as any);
  };

  useEffect(() => {
    const fetchData = async () => {
      const [repsRes, dealsRes, closingRes, visitsRes, goalsRes, fbRes] = await Promise.all([
        supabase.from("representatives" as any).select("id, nome, meta_mensal_padrao, meta_quantidade").eq("status", "ATIVO").order("nome"),
        supabase.from("deals" as any).select("id, representative_id, status, closed_at, created_at, base_price, dollar_rate, machine_type"),
        supabase.from("closing_deals" as any).select("id, representative_id, status, deal_value, start_date, stage, probability, created_at"),
        supabase.from("weekly_visits" as any).select("representative_id, semana, quantidade, meta").eq("ano", filterYear),
        supabase.from("monthly_goals" as any).select("representative_id, mes, meta_valor, meta_quantidade, machine_type").eq("ano", filterYear),
        supabase.from("feedbacks" as any).select("*").order("created_at", { ascending: false }),
      ]);
      if (repsRes.data) setReps(repsRes.data as any);
      if (dealsRes.data) setDeals(dealsRes.data as any);
      if (closingRes.data) setClosingDeals(closingRes.data as any);
      if (visitsRes.data) setVisits(visitsRes.data as any);
      if (goalsRes.data) setGoals(goalsRes.data as any);
      if (fbRes.data) setFeedbacks(fbRes.data as any);
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

  const filterDealByPeriod = (d: Deal): boolean => {
    if (d.status !== "closed" || !d.closed_at) return false;
    const dt = new Date(d.closed_at);
    if (dt.getFullYear() !== filterYear) return false;
    if (periodMode === "week") return getWeekNumber(dt) === filterWeek;
    return activeMonths.includes(dt.getMonth() + 1);
  };

  // Helper: check if a date falls in active period
  const isInPeriod = (dt: Date): boolean => {
    if (dt.getFullYear() !== filterYear) return false;
    if (periodMode === "week") return getWeekNumber(dt) === filterWeek;
    return activeMonths.includes(dt.getMonth() + 1);
  };

  // Negociações abertas por representante, filtradas por período
  const openByRep = useMemo(() => {
    return reps.map(rep => {
      const repClosing = closingDeals.filter(c => {
        if (c.representative_id !== rep.id) return false;
        return isInPeriod(new Date(c.created_at));
      });
      const repOpenDeals = deals.filter(d => {
        if (d.representative_id !== rep.id || d.status !== "open") return false;
        return isInPeriod(new Date(d.created_at));
      });
      return {
        nome: rep.nome.split(" ")[0],
        radar: repClosing.length,
        vendas: repOpenDeals.length,
        total: repClosing.length + repOpenDeals.length,
      };
    }).filter(r => r.total > 0);
  }, [reps, closingDeals, deals, filterYear, periodMode, filterWeek, activeMonths]);

  // Oportunidades por data de criação (closing_deals por mês)
  const oppsByCreation = useMemo(() => {
    const counts: Record<number, number> = {};
    SHORT_MONTHS.forEach((_, i) => { counts[i + 1] = 0; });
    closingDeals.forEach(c => {
      const dt = new Date(c.created_at);
      if (dt.getFullYear() === filterYear) {
        counts[dt.getMonth() + 1]++;
      }
    });
    return SHORT_MONTHS.map((label, i) => ({ mes: label, qtd: counts[i + 1] }));
  }, [closingDeals, filterYear]);

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

      // Feedbacks pendentes por rep
      const pendingFb = feedbacks.filter(f => f.representative_id === rep.id && f.status === "pendente");

      return {
        id: rep.id, nome: rep.nome,
        totalVisits, visitPct,
        oppCount, oppValue, weightedPipeline,
        lostCount, lostValue,
        wonCount, winRate,
        closedCount, closedFobBrl,
        metaValor, metaQtd, pctValor, pctQtd,
        yearFobBrl, yearCount,
        pendingFbCount: pendingFb.length,
      };
    }).sort((a, b) => b.closedFobBrl - a.closedFobBrl);
  }, [reps, deals, closingDeals, visits, goals, feedbacks, filterYear, periodMode, filterMonth, filterQuarter, filterWeek, activeMonths]);

  const chartData = useMemo(() => {
    return repMetrics.map(r => ({
      nome: r.nome.split(" ")[0],
      meta: r.metaValor,
      realizado: r.closedFobBrl,
    }));
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
    const totalPendingFb = feedbacks.filter(f => f.status === "pendente").length;
    return { totalVisits, totalOpps, totalLost, totalWon, globalWinRate, totalRealized, totalMeta, totalPipeline, totalPendingFb };
  }, [repMetrics, feedbacks]);

  // Save feedback
  const handleSaveFeedback = async () => {
    if (!fbRepId || !fbDesc.trim()) { toast.error("Preencha representante e descrição"); return; }
    const { error } = await supabase.from("feedbacks" as any).insert({
      user_id: userId,
      representative_id: fbRepId,
      descricao: fbDesc.trim(),
      prioridade: fbPrioridade,
    } as any);
    if (error) { toast.error("Erro ao salvar feedback"); return; }
    toast.success("Feedback registrado");
    setFbDesc(""); setFbRepId(""); setFbDialogOpen(false);
    fetchFeedbacks();
  };

  const handleResolveFeedback = async (id: string) => {
    await supabase.from("feedbacks" as any).update({ status: "resolvido", resolved_at: new Date().toISOString() } as any).eq("id", id);
    toast.success("Feedback resolvido");
    fetchFeedbacks();
  };

  const handleDeleteFeedback = async (id: string) => {
    await supabase.from("feedbacks" as any).delete().eq("id", id);
    fetchFeedbacks();
  };

  if (loading) return <p className="text-muted-foreground text-center py-8">Carregando...</p>;

  const metaPct = globalKpis.totalMeta > 0 ? (globalKpis.totalRealized / globalKpis.totalMeta) * 100 : 0;
  const weekOptions = Array.from({ length: 52 }, (_, i) => i + 1);
  const pendingFeedbacksList = feedbacks.filter(f => f.status === "pendente");

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <h2 className="font-heading text-base sm:text-lg md:text-xl font-bold text-foreground flex items-center gap-2">
          <BarChart3 className="h-4 w-4 sm:h-5 sm:w-5" /> KPIs de Performance
        </h2>
        <div className="flex items-center gap-2">
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

      {/* Global KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <KpiCard icon={<Eye className="h-4 w-4" />} label="Visitas" value={String(globalKpis.totalVisits)} color="bg-primary/10 text-primary" />
        <KpiCard icon={<Target className="h-4 w-4" />} label="Oportunidades Ativas" value={String(globalKpis.totalOpps)} sub={formatBrl(globalKpis.totalPipeline)} color="bg-accent/10 text-accent" />
        <KpiCard icon={<FileText className="h-4 w-4" />} label={`Neg. Abertas (${periodLabel})`} value={String(openByRep.reduce((s, r) => s + r.total, 0))} sub={`Radar: ${openByRep.reduce((s, r) => s + r.radar, 0)} | Vendas: ${openByRep.reduce((s, r) => s + r.vendas, 0)}`} color="bg-[hsl(var(--ca-blue))]/10 text-[hsl(var(--ca-blue))]" />
        <KpiCard icon={<XCircle className="h-4 w-4" />} label="Perdidas" value={String(globalKpis.totalLost)} color="bg-destructive/10 text-destructive" />
        <KpiCard icon={<CheckCircle className="h-4 w-4" />} label="Win Rate" value={formatPct(globalKpis.globalWinRate)} sub={`${globalKpis.totalWon}W / ${globalKpis.totalLost}L`} color="bg-accent/10 text-accent" />
        <KpiCard icon={<MessageSquare className="h-4 w-4" />} label="Feedbacks Pendentes" value={String(globalKpis.totalPendingFb)} color={globalKpis.totalPendingFb > 0 ? "bg-[hsl(var(--ca-orange))]/10 text-[hsl(var(--ca-orange))]" : "bg-accent/10 text-accent"} />
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

      {/* Negociações Abertas por Mês chart */}
      <Card className="p-4 border-border bg-card">
        <h3 className="text-sm font-semibold text-foreground mb-3">Negociações Abertas por Representante — {periodLabel}</h3>
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

      {/* Feedbacks Pendentes Section */}
      <Card className="p-4 border-border bg-card">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <MessageSquare className="h-4 w-4" /> Feedbacks Pendentes
          </h3>
          <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={() => setFbDialogOpen(true)}>
            <Plus className="h-3 w-3" /> Novo Feedback
          </Button>
        </div>

        {pendingFeedbacksList.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-4">Nenhum feedback pendente 🎉</p>
        ) : (
          <div className="space-y-2 max-h-[300px] overflow-y-auto">
            {pendingFeedbacksList.map(fb => {
              const repName = reps.find(r => r.id === fb.representative_id)?.nome || "—";
              return (
                <div key={fb.id} className="flex items-start justify-between gap-2 p-2 rounded-lg bg-secondary/30 border border-border">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="text-xs font-semibold text-foreground">{repName}</span>
                      <Badge variant={fb.prioridade === "alta" ? "destructive" : fb.prioridade === "baixa" ? "secondary" : "outline"} className="text-[10px]">
                        {fb.prioridade}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground truncate">{fb.descricao}</p>
                    <span className="text-[10px] text-muted-foreground">{new Date(fb.created_at).toLocaleDateString("pt-BR")}</span>
                  </div>
                  <div className="flex gap-1">
                    <Button size="sm" variant="ghost" className="h-6 w-6 p-0" onClick={() => handleResolveFeedback(fb.id)} title="Resolver">
                      <CheckCircle className="h-3.5 w-3.5 text-accent" />
                    </Button>
                    <Button size="sm" variant="ghost" className="h-6 w-6 p-0" onClick={() => handleDeleteFeedback(fb.id)} title="Excluir">
                      <Trash2 className="h-3.5 w-3.5 text-destructive" />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>

      {/* Per-rep cards */}
      <div className="space-y-3">
        <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
          <Users className="h-4 w-4" /> Detalhamento por Representante — {periodLabel}
        </h3>
        {repMetrics.map(r => {
          const metaColor = r.pctValor >= 100 ? "text-accent" : r.pctValor >= 70 ? "text-foreground" : "text-destructive";
          return (
            <Card key={r.id} className="p-4 border-border bg-card">
              <div className="flex items-center justify-between mb-3">
                <h4 className="font-semibold text-sm text-foreground">{r.nome}</h4>
                <div className="flex gap-1.5 flex-wrap justify-end">
                  {r.winRate >= 60 && <Badge variant="secondary" className="text-[10px]">🔥 Top Closer</Badge>}
                  {r.pctValor >= 100 && <Badge className="text-[10px] bg-accent text-accent-foreground">✅ Meta Batida</Badge>}
                  {r.lostCount > r.wonCount && r.lostCount > 0 && <Badge variant="destructive" className="text-[10px]">⚠️ Atenção</Badge>}
                  {r.pendingFbCount > 0 && <Badge variant="outline" className="text-[10px]">💬 {r.pendingFbCount} fb</Badge>}
                </div>
              </div>
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
            </Card>
          );
        })}
      </div>

      {/* Feedback Dialog */}
      <Dialog open={fbDialogOpen} onOpenChange={setFbDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base">Novo Feedback</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Representante</label>
              <Select value={fbRepId} onValueChange={setFbRepId}>
                <SelectTrigger className="h-9 text-sm">
                  <SelectValue placeholder="Selecione..." />
                </SelectTrigger>
                <SelectContent>
                  {reps.map(r => (
                    <SelectItem key={r.id} value={r.id}>{r.nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Descrição</label>
              <Input value={fbDesc} onChange={e => setFbDesc(e.target.value)} placeholder="Descreva o feedback..." className="h-9 text-sm" />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Prioridade</label>
              <div className="flex gap-2">
                {["baixa", "normal", "alta"].map(p => (
                  <PillButton key={p} active={fbPrioridade === p} onClick={() => setFbPrioridade(p)}>
                    {p.charAt(0).toUpperCase() + p.slice(1)}
                  </PillButton>
                ))}
              </div>
            </div>
            <Button onClick={handleSaveFeedback} className="w-full h-9 text-sm">Salvar Feedback</Button>
          </div>
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
