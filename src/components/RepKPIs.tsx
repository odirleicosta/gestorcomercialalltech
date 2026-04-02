import { useState, useEffect, useMemo } from "react";
import SafeComponent from "@/components/SafeComponent";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Target, Eye, TrendingUp, TrendingDown, XCircle, CheckCircle, BarChart3, Users, Calendar, Plus, FileText, Trash2, Edit2, PieChart, ChevronDown, ChevronUp, AlertTriangle, ClipboardList, Database, Save } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";

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
  updated_at?: string; next_step?: string | null;
}
interface MonthlyOpp { representative_id: string; mes: number; quantidade: number; }
interface Visit { representative_id: string; semana: number; quantidade: number; meta: number; }
interface MonthlyGoal { representative_id: string; mes: number; meta_valor: number; meta_quantidade: number; machine_type: string; }

type PeriodMode = "week" | "month" | "quarter" | "year";
type ViewTab = "equipe" | "representante" | "perdas" | "visitas" | "dados";

const SHORT_MONTHS = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];
const QUARTER_MONTHS: Record<string, number[]> = { T1: [1,2,3], T2: [4,5,6], T3: [7,8,9], T4: [10,11,12] };
const LOSS_REASONS = [
  "Desistência por Cancelamento do Projeto",
  "Relacionamento com o cliente",
  "Preço",
  "Condição de Pagamento",
  "Comprou máquina usada",
  "Desistência por Sem Previsão de Investimento",
  "Desistência por Postergação",
  "Desistência por Baixa Produção",
  "Desistência por Cliente Curioso",
  "Produto não atende",
  "Concorrência (AMADA)",
  "Concorrência (MAZAK)",
  "Outro",
] as const;
const LOSS_BAR_COLORS = [
  "hsl(var(--primary))", "hsl(var(--destructive))", "hsl(var(--accent))",
  "hsl(220, 70%, 55%)", "hsl(280, 60%, 55%)", "hsl(30, 80%, 55%)",
  "hsl(160, 60%, 45%)", "hsl(340, 70%, 50%)", "hsl(50, 80%, 50%)",
  "hsl(200, 60%, 50%)", "hsl(120, 50%, 45%)", "hsl(10, 70%, 50%)",
  "hsl(0, 0%, 50%)",
];
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
  const [monthlyOpps, setMonthlyOpps] = useState<MonthlyOpp[]>([]);
  const [allVisits, setAllVisits] = useState<{ representative_id: string; semana: number; quantidade: number; meta: number; ano: number }[]>([]);

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
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

  // Rep view filter
  const [repViewFilter, setRepViewFilter] = useState<string>("all");

  // Visitas tab state
  const [visitEditWeek, setVisitEditWeek] = useState(getWeekNumber(now));
  const [visitInlineEntries, setVisitInlineEntries] = useState<Record<string, { meta: number; quantidade: number }>>({});
  const [visitSaving, setVisitSaving] = useState(false);

  // Dados tab state
  const [oppsData, setOppsData] = useState<Record<string, Record<number, number>>>({});
  const [goalsData, setGoalsData] = useState<Record<string, Record<number, number>>>({});
  const [goalsFilterType, setGoalsFilterType] = useState("all");
  const [dataSaving, setDataSaving] = useState(false);
  const MACHINE_TYPES = ["all", "Centro de Usinagem", "Torno CNC", "Corte a Laser", "Dobradeira", "Mandrilhadora", "Retífica", "Eletroerosão", "Outro"];

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
    const { data } = await supabase.from("closing_deals" as any).select("id, representative_id, status, deal_value, start_date, stage, probability, created_at, client_name, machine_name, machine_type, sale_type, notes, motivo_perda, motivo_perda_detalhe, lost_reason, lost_reason_detail, updated_at, next_step");
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
      try {
        const [repsRes, dealsRes, closingRes, visitsRes, goalsRes, oppsRes] = await Promise.all([
          supabase.from("representatives" as any).select("id, nome, meta_mensal_padrao, meta_quantidade").eq("status", "ATIVO").order("nome"),
          supabase.from("deals" as any).select("id, representative_id, status, closed_at, created_at, base_price, dollar_rate, machine_type"),
          supabase.from("closing_deals" as any).select("id, representative_id, status, deal_value, start_date, stage, probability, created_at, client_name, machine_name, machine_type, sale_type, notes, motivo_perda, motivo_perda_detalhe, lost_reason, lost_reason_detail, updated_at, next_step"),
          supabase.from("weekly_visits" as any).select("representative_id, semana, quantidade, meta, ano").eq("ano", filterYear),
          supabase.from("monthly_goals" as any).select("representative_id, mes, meta_valor, meta_quantidade, machine_type").eq("ano", filterYear),
          supabase.from("monthly_opportunities" as any).select("representative_id, mes, quantidade").eq("ano", filterYear),
        ]);
        if (repsRes.data) setReps(repsRes.data as any);
        if (dealsRes.data) setDeals(dealsRes.data as any);
        if (closingRes.data) setClosingDeals(closingRes.data as any);
        if (visitsRes.data) { setVisits(visitsRes.data as any); setAllVisits(visitsRes.data as any); }
        if (goalsRes.data) setGoals(goalsRes.data as any);
        if (oppsRes.data) setMonthlyOpps(oppsRes.data as any);
      } catch (err) {
        console.error("RepKPIs fetchData error:", err);
        setLoadError("Não foi possível carregar os dados de KPIs.");
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [filterYear]);

  const activeMonths = useMemo((): number[] => {
    try {
      if (periodMode === "year") return [1,2,3,4,5,6,7,8,9,10,11,12];
      if (periodMode === "quarter") return QUARTER_MONTHS[filterQuarter] || [1,2,3];
      if (periodMode === "month") return [filterMonth];
      return [1,2,3,4,5,6,7,8,9,10,11,12];
    } catch (err) { console.error("activeMonths error:", err); return [1,2,3,4,5,6,7,8,9,10,11,12]; }
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
    try {
      return (reps || []).map(rep => {
        const repClosing = (closingDeals || []).filter(c => c.representative_id === rep.id && c.status === "ativa" && isInPeriod(new Date(c.created_at)));
        const repOpenDeals = (deals || []).filter(d => d.representative_id === rep.id && d.status === "open" && isInPeriod(new Date(d.created_at)));
        return { nome: (rep.nome || "").split(" ")[0], radar: repClosing.length, vendas: repOpenDeals.length, total: repClosing.length + repOpenDeals.length };
      }).filter(r => r.total > 0);
    } catch (err) { console.error("openByRep error:", err); return []; }
  }, [reps, closingDeals, deals, filterYear, periodMode, filterWeek, activeMonths]);

  const repMetrics = useMemo(() => {
    try {
      return (reps || []).map(rep => {
        const repVisits = (visits || []).filter(v => {
          if (v.representative_id !== rep.id) return false;
          if (periodMode === "week") return v.semana === filterWeek;
          return true;
        });
        const totalVisits = repVisits.reduce((s, v) => s + (v.quantidade || 0), 0);
        const totalVisitMeta = repVisits.reduce((s, v) => s + (v.meta || 0), 0);
        const visitPct = totalVisitMeta > 0 ? (totalVisits / totalVisitMeta) * 100 : 0;

        const activeOpps = (closingDeals || []).filter(c => c.representative_id === rep.id && c.status === "ativa");
        const oppCount = activeOpps.length;
        const oppValue = activeOpps.reduce((s, c) => s + (c.deal_value || 0), 0);
        const weightedPipeline = activeOpps.reduce((s, c) => {
          const w = c.probability === "Alta" ? 0.8 : c.probability === "Média" ? 0.5 : 0.2;
          return s + (c.deal_value || 0) * w;
        }, 0);

        const lost = (closingDeals || []).filter(c => c.representative_id === rep.id && c.status === "perdida");
        const lostCount = lost.length;
        const lostValue = lost.reduce((s, c) => s + (c.deal_value || 0), 0);
        const won = (closingDeals || []).filter(c => c.representative_id === rep.id && c.status === "ganha");
        const wonCount = won.length;
        const totalDecided = wonCount + lostCount;
        const winRate = totalDecided > 0 ? (wonCount / totalDecided) * 100 : 0;

        const closedDeals = (deals || []).filter(d => d.representative_id === rep.id && filterDealByPeriod(d));
        const closedCount = closedDeals.length;
        const closedFobBrl = closedDeals.reduce((s, d) => s + (d.base_price || 0) * (d.dollar_rate || 0), 0);

        const periodGoals = (goals || []).filter(g => g.representative_id === rep.id && activeMonths.includes(g.mes));
        const monthCount = periodMode === "week" ? 1 : activeMonths.length;
        const metaValor = periodGoals.reduce((s, g) => s + (g.meta_valor || 0), 0) || (rep.meta_mensal_padrao || 0) * monthCount;
        const metaQtd = periodGoals.reduce((s, g) => s + (g.meta_quantidade || 0), 0) || (rep.meta_quantidade || 0) * monthCount;
        const pctValor = metaValor > 0 ? (closedFobBrl / metaValor) * 100 : 0;
        const pctQtd = metaQtd > 0 ? (closedCount / metaQtd) * 100 : 0;

        const yearClosed = (deals || []).filter(d => d.representative_id === rep.id && d.status === "closed" && d.closed_at && new Date(d.closed_at).getFullYear() === filterYear);
        const yearFobBrl = yearClosed.reduce((s, d) => s + (d.base_price || 0) * (d.dollar_rate || 0), 0);
        const yearCount = yearClosed.length;

        return {
          id: rep.id, nome: rep.nome || "",
          totalVisits, visitPct,
          oppCount, oppValue, weightedPipeline,
          lostCount, lostValue,
          wonCount, winRate,
          closedCount, closedFobBrl,
          metaValor, metaQtd, pctValor, pctQtd,
          yearFobBrl, yearCount,
        };
      }).sort((a, b) => b.closedFobBrl - a.closedFobBrl);
    } catch (err) { console.error("repMetrics error:", err); return []; }
  }, [reps, deals, closingDeals, visits, goals, filterYear, periodMode, filterMonth, filterQuarter, filterWeek, activeMonths]);

  const chartData = useMemo(() => {
    try {
      return (repMetrics || []).map(r => ({ nome: (r.nome || "").split(" ")[0], meta: r.metaValor || 0, realizado: r.closedFobBrl || 0 }));
    } catch (err) { console.error("chartData error:", err); return []; }
  }, [repMetrics]);

  const globalKpis = useMemo(() => {
    try {
      const m = repMetrics || [];
      const totalVisits = m.reduce((s, r) => s + (r.totalVisits || 0), 0);
      const totalOpps = m.reduce((s, r) => s + (r.oppCount || 0), 0);
      const totalLost = m.reduce((s, r) => s + (r.lostCount || 0), 0);
      const totalWon = m.reduce((s, r) => s + (r.wonCount || 0), 0);
      const totalDecided = totalWon + totalLost;
      const globalWinRate = totalDecided > 0 ? (totalWon / totalDecided) * 100 : 0;
      const totalRealized = m.reduce((s, r) => s + (r.closedFobBrl || 0), 0);
      const totalMeta = m.reduce((s, r) => s + (r.metaValor || 0), 0);
      const totalPipeline = m.reduce((s, r) => s + (r.oppValue || 0), 0);
      return { totalVisits, totalOpps, totalLost, totalWon, globalWinRate, totalRealized, totalMeta, totalPipeline };
    } catch (err) { console.error("globalKpis error:", err); return { totalVisits: 0, totalOpps: 0, totalLost: 0, totalWon: 0, globalWinRate: 0, totalRealized: 0, totalMeta: 0, totalPipeline: 0 }; }
  }, [repMetrics]);

  // Funnel data
  const funnelData = useMemo(() => {
    try {
      const totalVisitsVal = globalKpis.totalVisits || 0;
      const opportunities = (monthlyOpps || [])
        .filter(o => activeMonths.includes(o.mes))
        .reduce((s, o) => s + (o.quantidade || 0), 0);
      const proposals = (closingDeals || []).filter(c => c.status === "ativa" && isInPeriod(new Date(c.created_at))).length
        + (deals || []).filter(d => d.status === "open" && isInPeriod(new Date(d.created_at))).length;
      const won = globalKpis.totalWon || 0;
      const lost = globalKpis.totalLost || 0;
      return { visits: totalVisitsVal, opportunities, proposals, won, lost };
    } catch (err) { console.error("funnelData error:", err); return { visits: 0, opportunities: 0, proposals: 0, won: 0, lost: 0 }; }
  }, [globalKpis, monthlyOpps, closingDeals, deals, activeMonths, filterYear, periodMode, filterWeek]);

  // Weekly visits chart data (last 8 weeks)
  const weeklyChartData = useMemo(() => {
    try {
      if (periodMode !== "week") return [];
      const currentWeek = filterWeek;
      const weeks: { semana: string; realizadas: number; meta: number }[] = [];
      for (let i = 7; i >= 0; i--) {
        const w = currentWeek - i;
        if (w < 1) continue;
        const weekVisits = (allVisits || []).filter(v => v.semana === w && v.ano === filterYear);
        const totalRealizadas = weekVisits.reduce((s, v) => s + (v.quantidade || 0), 0);
        const totalMeta = weekVisits.reduce((s, v) => s + (v.meta || 0), 0) || (reps || []).length * 16;
        weeks.push({ semana: `S${w}`, realizadas: totalRealizadas, meta: totalMeta });
      }
      return weeks;
    } catch (err) { console.error("weeklyChartData error:", err); return []; }
  }, [periodMode, filterWeek, allVisits, filterYear, reps.length]);


  // Perdas analysis
  const lossAnalysis = useMemo(() => {
    try {
      let lostDeals = (closingDeals || []).filter(c => {
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

      const monthlyLoss: { mes: string; perdas: number }[] = SHORT_MONTHS.map((label, i) => {
        const count = lostDeals.filter(c => new Date(c.created_at).getMonth() === i).length;
        return { mes: label, perdas: count };
      });

      return { lostDeals, rankingData, monthlyLoss, totalWithReason };
    } catch (err) { console.error("lossAnalysis error:", err); return { lostDeals: [], rankingData: [], monthlyLoss: [], totalWithReason: 0 }; }
  }, [closingDeals, filterYear, periodMode, filterWeek, activeMonths, lossRepFilter]);

  const metaPct = (globalKpis?.totalMeta ?? 0) > 0 ? ((globalKpis?.totalRealized ?? 0) / globalKpis.totalMeta) * 100 : 0;
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
    <SafeComponent loading={loading} error={loadError} onRetry={() => window.location.reload()}>
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
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <KpiCard icon={<Eye className="h-4 w-4" />} label="Visitas" value={String(globalKpis.totalVisits)} color="bg-primary/10 text-primary" />
        <KpiCard icon={<Target className="h-4 w-4" />} label="Oportunidades Ativas" value={String(globalKpis.totalOpps)} sub={formatBrl(globalKpis.totalPipeline)} color="bg-accent/10 text-accent" />
        <KpiCard icon={<FileText className="h-4 w-4" />} label={`Neg. Abertas (${periodLabel})`} value={String(openByRep.reduce((s, r) => s + r.total, 0))} sub={`Radar: ${openByRep.reduce((s, r) => s + r.radar, 0)} | Vendas: ${openByRep.reduce((s, r) => s + r.vendas, 0)}`} color="bg-primary/10 text-primary" />
        <KpiCard icon={<CheckCircle className="h-4 w-4" />} label="Win Rate" value={formatPct(globalKpis.globalWinRate)} sub={`${globalKpis.totalWon}W / ${globalKpis.totalLost}L`} color="bg-accent/10 text-accent" />
      </div>



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
    </SafeComponent>
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
