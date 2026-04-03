import React, { useState, useEffect, useMemo, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import { Eye, Users, Target, TrendingUp, Save, Calendar, BarChart3, Lightbulb, Flag, Filter, Activity, XCircle, AlertTriangle, Plus, Trash2, Edit2, SlidersHorizontal, ChevronDown } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell, ReferenceLine, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar, PieChart, Pie } from "recharts";

interface Props {
  userId: string;
}

type PeriodMode = "semana" | "mes" | "trimestre" | "ano";

interface Rep {
  id: string;
  nome: string;
}

interface VisitRow {
  representative_id: string;
  nome: string;
  meta: number;
  quantidade: number;
}

const QUARTER_MONTHS: Record<string, number[]> = {
  T1: [1, 2, 3], T2: [4, 5, 6], T3: [7, 8, 9], T4: [10, 11, 12],
};

const DEFAULT_META = 16;

const getWeekNumber = (d: Date): number => {
  const start = new Date(d.getFullYear(), 0, 1);
  const diff = d.getTime() - start.getTime() + (start.getTimezoneOffset() - d.getTimezoneOffset()) * 60000;
  return Math.ceil((diff / 86400000 + start.getDay() + 1) / 7);
};

const currentYear = new Date().getFullYear();
const currentWeek = getWeekNumber(new Date());

const RepKPIs = ({ userId }: Props) => {
  const [subTab, setSubTab] = useState<"visitas" | "oportunidades" | "metas" | "desempenho" | "perdidas">("desempenho");
  const [filterRep, setFilterRep] = useState<string>("all");
  const [reps, setReps] = useState<Rep[]>([]);
  const [filterYear, setFilterYear] = useState(currentYear);
  const [filterWeek, setFilterWeek] = useState(currentWeek);
  const [periodMode, setPeriodMode] = useState<PeriodMode>("mes");
  const [filterMonth, setFilterMonth] = useState(new Date().getMonth() + 1);
  const [filterQuarter, setFilterQuarter] = useState<string>(`T${Math.ceil((new Date().getMonth() + 1) / 3)}`);
  const [visits, setVisits] = useState<VisitRow[]>([]);
  const [saving, setSaving] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [weeklyHistory, setWeeklyHistory] = useState<{ semana: number; total: number; meta: number }[]>([]);
  const [opportunities, setOpportunities] = useState<{ representative_id: string; nome: string; qty_proprias: number; qty_sdr: number }[]>([]);
  const [savingOpp, setSavingOpp] = useState(false);
  const [goals, setGoals] = useState<{ representative_id: string; nome: string; meta_quantidade: number; byType: Record<string, number> }[]>([]);
  const [closedDealsForMetas, setClosedDealsForMetas] = useState<{ representative_id: string | null; machine_type: string }[]>([]);
  const [allYearVisits, setAllYearVisits] = useState<{ representative_id: string; semana: number; quantidade: number; meta: number }[]>([]);
  const [allYearOpps, setAllYearOpps] = useState<{ representative_id: string; mes: number; qty_proprias: number; qty_sdr: number }[]>([]);
  const [allYearGoals, setAllYearGoals] = useState<{ representative_id: string; mes: number; meta_quantidade: number; machine_type: string }[]>([]);
  const [allYearClosedDeals, setAllYearClosedDeals] = useState<{ representative_id: string | null; closed_at: string; machine_type: string }[]>([]);
  const [lostDeals, setLostDeals] = useState<{ id: string; representative_id: string | null; client_name: string; machine_name: string; machine_type: string; deal_value: number; motivo_perda: string | null; motivo_perda_detalhe: string | null; data_perda: string; notes: string | null; created_at: string; updated_at: string }[]>([]);
  const [lostFormOpen, setLostFormOpen] = useState(false);
  const [editingLostId, setEditingLostId] = useState<string | null>(null);
  const [savingLost, setSavingLost] = useState(false);
  const [lostForm, setLostForm] = useState({
    representative_id: "",
    motivo_perda: "",
    data_perda: new Date().toISOString().slice(0, 10),
    quantidade: 1,
  });

  // Load reps
  useEffect(() => {
    const load = async () => {
      const { data } = await supabase
        .from("representatives")
        .select("id, nome")
        .eq("user_id", userId)
        .eq("status", "ATIVO")
        .order("nome");
      if (data) setReps(data);
    };
    load();
  }, [userId]);

  // Load visits for selected week
  useEffect(() => {
    if (!reps.length) return;
    const load = async () => {
      const { data } = await supabase
        .from("weekly_visits")
        .select("representative_id, quantidade, meta")
        .eq("user_id", userId)
        .eq("ano", filterYear)
        .eq("semana", filterWeek);

      const rows: VisitRow[] = reps.map((r) => {
        const existing = data?.find((v) => v.representative_id === r.id);
        return {
          representative_id: r.id,
          nome: r.nome,
          meta: existing?.meta ?? DEFAULT_META,
          quantidade: existing?.quantidade ?? 0,
        };
      });
      setVisits(rows);
      setLoaded(true);
    };
    load();
  }, [reps, filterYear, filterWeek, userId]);

  // Load weekly evolution for the year
  useEffect(() => {
    const load = async () => {
      const { data } = await supabase
        .from("weekly_visits")
        .select("semana, quantidade, meta")
        .eq("user_id", userId)
        .eq("ano", filterYear)
        .order("semana");
      if (!data) return;
      const grouped: Record<number, { total: number; metaTotal: number }> = {};
      for (const row of data) {
        if (!grouped[row.semana]) grouped[row.semana] = { total: 0, metaTotal: 0 };
        grouped[row.semana].total += row.quantidade;
        grouped[row.semana].metaTotal += row.meta;
      }
      setWeeklyHistory(
        Object.entries(grouped)
          .map(([s, v]) => ({ semana: Number(s), total: v.total, meta: v.metaTotal }))
          .sort((a, b) => a.semana - b.semana)
      );
    };
    load();
  }, [userId, filterYear, visits]); // re-fetch when visits change (after edits)

  // Load monthly opportunities for selected month
  useEffect(() => {
    if (!reps.length) return;
    const load = async () => {
      const { data } = await supabase
        .from("monthly_opportunities")
        .select("representative_id, qty_proprias, qty_sdr")
        .eq("user_id", userId)
        .eq("ano", filterYear)
        .eq("mes", filterMonth);

      const rows = reps.map((r) => {
        const existing = (data || []).find((d: any) => d.representative_id === r.id);
        return {
          representative_id: r.id,
          nome: r.nome,
          qty_proprias: existing?.qty_proprias ?? 0,
          qty_sdr: existing?.qty_sdr ?? 0,
        };
      });
      setOpportunities(rows);
    };
    load();
  }, [reps, filterYear, filterMonth, userId]);

  // Load monthly goals (all machine_types from Representatives tab)
  useEffect(() => {
    if (!reps.length) return;
    const load = async () => {
      const { data } = await supabase
        .from("monthly_goals")
        .select("representative_id, meta_valor, meta_quantidade, machine_type")
        .eq("user_id", userId)
        .eq("ano", filterYear)
        .eq("mes", filterMonth);

      const rows = reps.map((r) => {
        const repGoals = (data || []).filter((d: any) => d.representative_id === r.id);
        const meta_quantidade = repGoals.reduce((s: number, g: any) => s + (g.meta_quantidade || 0), 0);
        const byType: Record<string, number> = {};
        repGoals.forEach((g: any) => { if (g.machine_type && g.meta_quantidade > 0) byType[g.machine_type] = (byType[g.machine_type] || 0) + g.meta_quantidade; });
        return {
          representative_id: r.id,
          nome: r.nome,
          meta_quantidade,
          byType,
        };
      });
      setGoals(rows);
    };
    load();
  }, [reps, filterYear, filterMonth, userId]);

  // Load closed deals for Metas tab (by month)
  useEffect(() => {
    const load = async () => {
      const startDate = `${filterYear}-${String(filterMonth).padStart(2, "0")}-01`;
      const endMonth = filterMonth === 12 ? 1 : filterMonth + 1;
      const endYear = filterMonth === 12 ? filterYear + 1 : filterYear;
      const endDate = `${endYear}-${String(endMonth).padStart(2, "0")}-01`;
      const { data } = await supabase
        .from("deals")
        .select("representative_id, machine_type")
        .eq("user_id", userId)
        .eq("status", "closed")
        .gte("closed_at", startDate)
        .lt("closed_at", endDate);
      setClosedDealsForMetas(data || []);
    };
    load();
  }, [userId, filterYear, filterMonth]);


  useEffect(() => {
    if (!reps.length) return;
    const load = async () => {
      const [visRes, oppRes, goalRes, closedRes] = await Promise.all([
        supabase.from("weekly_visits").select("representative_id, semana, quantidade, meta").eq("user_id", userId).eq("ano", filterYear),
        supabase.from("monthly_opportunities").select("representative_id, mes, qty_proprias, qty_sdr, quantidade").eq("user_id", userId).eq("ano", filterYear),
        supabase.from("monthly_goals").select("representative_id, mes, meta_quantidade, machine_type").eq("user_id", userId).eq("ano", filterYear),
        supabase.from("deals").select("representative_id, closed_at, machine_type").eq("user_id", userId).eq("status", "closed").gte("closed_at", `${filterYear}-01-01`).lt("closed_at", `${filterYear + 1}-01-01`),
      ]);
      setAllYearVisits(visRes.data || []);
      setAllYearOpps(oppRes.data || []);
      setAllYearGoals(goalRes.data || []);
      setAllYearClosedDeals(closedRes.data || []);
    };
    load();
  }, [reps, filterYear, userId]);

  // Load lost deals from independent table
  const loadLostDeals = useCallback(async () => {
    const { data } = await supabase
      .from("negociacoes_perdidas" as any)
      .select("id, representative_id, client_name, machine_name, machine_type, deal_value, motivo_perda, motivo_perda_detalhe, data_perda, notes, quantidade, created_at, updated_at")
      .eq("user_id", userId)
      .order("data_perda", { ascending: false });
    setLostDeals((data as any) || []);
  }, [userId]);

  useEffect(() => { loadLostDeals(); }, [loadLostDeals]);

  const DEFAULT_MOTIVOS = ["Preço", "Concorrência", "Cancelamento do Projeto", "Sem Investimento", "Cliente Curioso", "Postergação", "Comprou máquina usada", "Relacionamento com o cliente"];
  const [customMotivos, setCustomMotivos] = useState<string[]>([]);
  const MOTIVOS_PERDA = useMemo(() => {
    const fromDb = lostDeals.map(d => d.motivo_perda).filter(Boolean) as string[];
    const all = new Set([...DEFAULT_MOTIVOS, ...customMotivos, ...fromDb]);
    return Array.from(all).sort();
  }, [customMotivos, lostDeals]);
  const [addingCustomMotivo, setAddingCustomMotivo] = useState(false);
  const [customMotivo, setCustomMotivo] = useState("");

  const resetLostForm = () => {
    setLostForm({ representative_id: "", motivo_perda: "", data_perda: new Date().toISOString().slice(0, 10), quantidade: 1 });
    setEditingLostId(null);
  };

  const handleSaveLost = async () => {
    if (!lostForm.representative_id) { toast.error("Selecione o representante"); return; }
    if (!lostForm.motivo_perda) { toast.error("Selecione o motivo da perda"); return; }
    setSavingLost(true);
    const payload = {
      user_id: userId,
      representative_id: lostForm.representative_id || null,
      client_name: reps.find(r => r.id === lostForm.representative_id)?.nome || "",
      machine_name: "",
      machine_type: "",
      deal_value: 0,
      motivo_perda: lostForm.motivo_perda,
      motivo_perda_detalhe: null,
      data_perda: lostForm.data_perda,
      notes: null,
      quantidade: lostForm.quantidade,
    };
    let error;
    if (editingLostId) {
      ({ error } = await supabase.from("negociacoes_perdidas" as any).update(payload as any).eq("id", editingLostId));
    } else {
      ({ error } = await supabase.from("negociacoes_perdidas" as any).insert(payload as any));
    }
    setSavingLost(false);
    if (error) { toast.error("Erro ao salvar: " + error.message); return; }
    toast.success(editingLostId ? "Registro atualizado" : "Negociação perdida registrada");
    resetLostForm();
    setLostFormOpen(false);
    loadLostDeals();
  };

  const handleDeleteLost = async (id: string) => {
    const { error } = await supabase.from("negociacoes_perdidas" as any).delete().eq("id", id);
    if (error) { toast.error("Erro ao excluir"); return; }
    toast.success("Registro excluído");
    loadLostDeals();
  };

  const openEditLost = (deal: typeof lostDeals[0]) => {
    setEditingLostId(deal.id);
    setLostForm({
      representative_id: deal.representative_id || "",
      motivo_perda: deal.motivo_perda || "",
      data_perda: deal.data_perda,
      quantidade: (deal as any).quantidade || 1,
    });
    setLostFormOpen(true);
  };

  const handleChange = useCallback((repId: string, value: string) => {
    const num = Math.max(0, parseInt(value) || 0);
    setVisits((prev) =>
      prev.map((v) => (v.representative_id === repId ? { ...v, quantidade: num } : v))
    );
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      for (const row of visits) {
        const { error } = await supabase
          .from("weekly_visits")
          .upsert(
            {
              user_id: userId,
              representative_id: row.representative_id,
              ano: filterYear,
              semana: filterWeek,
              quantidade: row.quantidade,
              meta: row.meta,
            },
            { onConflict: "user_id,representative_id,ano,semana" }
          );
        if (error) throw error;
      }
      toast.success("Visitas salvas com sucesso!");
    } catch (e: any) {
      toast.error("Erro ao salvar: " + e.message);
    } finally {
      setSaving(false);
    }
  };

  // Filtered data by rep
  const filteredVisits = useMemo(() => filterRep === "all" ? visits : visits.filter(v => v.representative_id === filterRep), [visits, filterRep]);
  const filteredOpportunities = useMemo(() => filterRep === "all" ? opportunities : opportunities.filter(o => o.representative_id === filterRep), [opportunities, filterRep]);
  const filteredGoals = useMemo(() => filterRep === "all" ? goals : goals.filter(g => g.representative_id === filterRep), [goals, filterRep]);

  // KPIs
  const kpis = useMemo(() => {
    const totalVisitas = filteredVisits.reduce((s, v) => s + v.quantidade, 0);
    const totalMeta = filteredVisits.reduce((s, v) => s + v.meta, 0);
    const pctEquipe = totalMeta > 0 ? (totalVisitas / totalMeta) * 100 : 0;
    const media = filteredVisits.length > 0 ? totalVisitas / filteredVisits.length : 0;
    return { totalVisitas, totalMeta, pctEquipe, media };
  }, [filteredVisits]);

  // Chart data
  const chartData = useMemo(() =>
    filteredVisits.map((v) => ({
      nome: v.nome.split(" ").slice(0, 2).join(" "),
      quantidade: v.quantidade,
      meta: v.meta,
    })),
    [filteredVisits]
  );

  // Week options (1-52)
  const weekOptions = useMemo(() => {
    const maxWeek = filterYear === currentYear ? currentWeek : 52;
    return Array.from({ length: maxWeek }, (_, i) => i + 1);
  }, [filterYear]);

  // Opportunities KPIs
  const oppKpis = useMemo(() => {
    const totalProprias = filteredOpportunities.reduce((s, o) => s + o.qty_proprias, 0);
    const totalSdr = filteredOpportunities.reduce((s, o) => s + o.qty_sdr, 0);
    const totalAberto = totalProprias + totalSdr;
    const pctProprias = totalAberto > 0 ? (totalProprias / totalAberto) * 100 : 0;
    return { totalAberto, totalProprias, totalSdr, pctProprias };
  }, [filteredOpportunities]);

  const oppChartData = useMemo(() =>
    filteredOpportunities
      .filter((o) => o.qty_proprias + o.qty_sdr > 0)
      .map((o) => ({
        nome: o.nome.split(" ").slice(0, 2).join(" "),
        proprias: o.qty_proprias,
        sdr: o.qty_sdr,
      })),
    [filteredOpportunities]
  );

  const handleOppChange = useCallback((repId: string, field: "qty_proprias" | "qty_sdr", value: string) => {
    const num = Math.max(0, parseInt(value) || 0);
    setOpportunities((prev) =>
      prev.map((o) => (o.representative_id === repId ? { ...o, [field]: num } : o))
    );
  }, []);

  const handleSaveOpp = async () => {
    setSavingOpp(true);
    try {
      for (const row of opportunities) {
        const { error } = await supabase
          .from("monthly_opportunities")
          .upsert(
            {
              user_id: userId,
              representative_id: row.representative_id,
              ano: filterYear,
              mes: filterMonth,
              quantidade: row.qty_proprias + row.qty_sdr,
              qty_proprias: row.qty_proprias,
              qty_sdr: row.qty_sdr,
            } as any,
            { onConflict: "user_id,representative_id,ano,mes" }
          );
        if (error) throw error;
      }
      toast.success("Oportunidades salvas com sucesso!");
    } catch (e: any) {
      toast.error("Erro ao salvar: " + e.message);
    } finally {
      setSavingOpp(false);
    }
  };


  const MONTHS = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];

  const MACHINE_TYPES = ["Centro de Usinagem", "Torno CNC", "Plu.go"];

  const goalsKpis = useMemo(() => {
    const totalQtd = filteredGoals.reduce((s, g) => s + g.meta_quantidade, 0);
    const repsComMeta = filteredGoals.filter((g) => g.meta_quantidade > 0).length;
    // Per machine type breakdown
    const byType = MACHINE_TYPES.map(mt => ({
      type: mt,
      total: filteredGoals.reduce((s, g) => s + (g.byType?.[mt] || 0), 0),
    }));
    return { totalQtd, repsComMeta, byType };
  }, [filteredGoals]);

  // Closed deals grouped by rep + machine_type for Metas tab
  const closedByRepType = useMemo(() => {
    const map: Record<string, Record<string, number>> = {};
    for (const d of closedDealsForMetas) {
      const repId = d.representative_id || "__none__";
      if (!map[repId]) map[repId] = {};
      const mt = d.machine_type || "Outro";
      map[repId][mt] = (map[repId][mt] || 0) + 1;
    }
    return map;
  }, [closedDealsForMetas]);

  const totalRealizadoQtd = useMemo(() => {
    if (filterRep === "all") return closedDealsForMetas.length;
    return closedDealsForMetas.filter(d => d.representative_id === filterRep).length;
  }, [closedDealsForMetas, filterRep]);

  const formatBrl = (v: number) => v >= 1_000_000 ? `${(v / 1_000_000).toFixed(1)}M` : v >= 1_000 ? `${(v / 1_000).toFixed(0)}k` : String(v);

  const desempenhoPeriodLabel = useMemo(() => {
    if (periodMode === "ano") return `${filterYear}`;
    if (periodMode === "trimestre") return `${filterQuarter} ${filterYear}`;
    return `${MONTHS[filterMonth - 1]} ${filterYear}`;
  }, [periodMode, filterMonth, filterYear, filterQuarter]);

  const btnClass = (active: boolean) =>
    `px-2.5 py-1 rounded-full text-[10px] sm:text-xs font-medium transition-all ${active ? "bg-primary text-primary-foreground shadow-sm" : "bg-secondary text-muted-foreground hover:bg-secondary/80 border border-border"}`;

  const [filterExpanded, setFilterExpanded] = useState(false);

  return (
    <div className="space-y-6">
      {/* ═══ FILTRO GLOBAL (só Desempenho) ═══ */}
      {subTab === "desempenho" && (
        filterExpanded ? (
          <div className="rounded-xl border border-border bg-card p-4 space-y-3">
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide w-12 shrink-0">Ano</span>
              <div className="flex gap-1">
                {[currentYear - 1, currentYear, currentYear + 1].map(y => (
                  <button key={y} onClick={() => setFilterYear(y)} className={btnClass(filterYear === y)}>{y}</button>
                ))}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide w-12 shrink-0">Visão</span>
              <div className="flex gap-1 flex-wrap">
                <button onClick={() => setPeriodMode("mes")} className={btnClass(periodMode === "mes")}>Mês</button>
                {["T1", "T2", "T3", "T4"].map(q => (
                  <button key={q} onClick={() => { setPeriodMode("trimestre"); setFilterQuarter(q); setFilterExpanded(false); }} className={btnClass(periodMode === "trimestre" && filterQuarter === q)}>{q}</button>
                ))}
                <button onClick={() => { setPeriodMode("ano"); setFilterExpanded(false); }} className={btnClass(periodMode === "ano")}>Ano</button>
              </div>
            </div>
            {periodMode === "mes" && (
              <div className="flex items-start gap-2">
                <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide w-12 shrink-0 mt-1">Mês</span>
                <div className="flex flex-wrap gap-1">
                  {MONTHS.map((m, i) => (
                    <button key={i} onClick={() => { setFilterMonth(i + 1); setFilterExpanded(false); }} className={btnClass(filterMonth === i + 1)}>{m}</button>
                  ))}
                </div>
              </div>
            )}
            {reps.length > 0 && (
              <div className="flex items-start gap-2">
                <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide w-12 shrink-0 mt-1">Rep.</span>
                <div className="flex flex-wrap gap-1">
                  <button onClick={() => { setFilterRep("all"); setFilterExpanded(false); }} className={btnClass(filterRep === "all")}>Todos</button>
                  {reps.map(r => (
                    <button key={r.id} onClick={() => { setFilterRep(r.id); setFilterExpanded(false); }} className={btnClass(filterRep === r.id)}>{r.nome.split(" ").slice(0, 2).join(" ")}</button>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          <button
            onClick={() => setFilterExpanded(true)}
            className="inline-flex items-center gap-2 bg-primary/10 hover:bg-primary/15 text-primary border border-primary/20 rounded-full px-4 py-1.5 transition-all group"
          >
            <SlidersHorizontal className="h-3.5 w-3.5" />
            <span className="text-xs sm:text-sm font-semibold">{desempenhoPeriodLabel}{filterRep !== "all" ? ` · ${reps.find(r => r.id === filterRep)?.nome?.split(" ").slice(0,2).join(" ")}` : ""}</span>
            <ChevronDown className="h-3.5 w-3.5 opacity-60 group-hover:opacity-100 transition-opacity" />
          </button>
        )
      )}

      {/* Sub-tabs */}
      <div className="flex items-center gap-2">
        <button
          onClick={() => setSubTab("desempenho")}
          className={`px-4 py-2 rounded-full text-sm font-semibold transition-all ${subTab === "desempenho" ? "bg-primary text-primary-foreground shadow" : "bg-muted text-muted-foreground hover:bg-muted/80"}`}
        >
          <Activity className="inline h-4 w-4 mr-1.5 -mt-0.5" />
          Desempenho
        </button>
        <button
          onClick={() => setSubTab("visitas")}
          className={`px-4 py-2 rounded-full text-sm font-semibold transition-all ${subTab === "visitas" ? "bg-primary text-primary-foreground shadow" : "bg-muted text-muted-foreground hover:bg-muted/80"}`}
        >
          <Eye className="inline h-4 w-4 mr-1.5 -mt-0.5" />
          Visitas
        </button>
        <button
          onClick={() => setSubTab("oportunidades")}
          className={`px-4 py-2 rounded-full text-sm font-semibold transition-all ${subTab === "oportunidades" ? "bg-primary text-primary-foreground shadow" : "bg-muted text-muted-foreground hover:bg-muted/80"}`}
        >
          <Lightbulb className="inline h-4 w-4 mr-1.5 -mt-0.5" />
          Oportunidades
        </button>
        <button
          onClick={() => setSubTab("metas")}
          className={`px-4 py-2 rounded-full text-sm font-semibold transition-all ${subTab === "metas" ? "bg-primary text-primary-foreground shadow" : "bg-muted text-muted-foreground hover:bg-muted/80"}`}
        >
          <Flag className="inline h-4 w-4 mr-1.5 -mt-0.5" />
          Metas
        </button>
        <button
          onClick={() => setSubTab("perdidas")}
          className={`px-4 py-2 rounded-full text-sm font-semibold transition-all ${subTab === "perdidas" ? "bg-destructive text-destructive-foreground shadow" : "bg-muted text-muted-foreground hover:bg-muted/80"}`}
        >
          <XCircle className="inline h-4 w-4 mr-1.5 -mt-0.5" />
          Perdidas
        </button>
      </div>

      {/* ═══ VISITAS ═══ */}
      {subTab === "visitas" && (<>

      {/* Week selector for Visitas */}
      <div className="flex items-center gap-2 flex-wrap">
        <Select value={filterRep} onValueChange={setFilterRep}>
          <SelectTrigger className="w-[140px] text-xs h-8"><Users className="h-3.5 w-3.5 mr-1" /><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Equipe</SelectItem>
            {reps.map((r) => (<SelectItem key={r.id} value={r.id}>{r.nome}</SelectItem>))}
          </SelectContent>
        </Select>
        <Select value={String(filterYear)} onValueChange={(v) => setFilterYear(Number(v))}>
          <SelectTrigger className="w-24 text-xs h-8"><SelectValue /></SelectTrigger>
          <SelectContent>
            {[currentYear - 1, currentYear, currentYear + 1].map((y) => (<SelectItem key={y} value={String(y)}>{y}</SelectItem>))}
          </SelectContent>
        </Select>
        <Select value={String(filterWeek)} onValueChange={(v) => setFilterWeek(Number(v))}>
          <SelectTrigger className="w-40 text-xs h-8"><Calendar className="h-4 w-4 mr-1" /><SelectValue /></SelectTrigger>
          <SelectContent>
            {weekOptions.map((w) => (<SelectItem key={w} value={String(w)}>Semana {w}</SelectItem>))}
          </SelectContent>
        </Select>
      </div>
      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KpiCard
          icon={<Eye className="h-5 w-5" />}
          label="Total Visitas"
          value={String(kpis.totalVisitas)}
          color="text-primary"
        />
        <KpiCard
          icon={<Target className="h-5 w-5" />}
          label="Meta Equipe"
          value={String(kpis.totalMeta)}
          color="text-muted-foreground"
        />
        <KpiCard
          icon={<TrendingUp className="h-5 w-5" />}
          label="% Atingimento"
          value={`${kpis.pctEquipe.toFixed(0)}%`}
          color={kpis.pctEquipe >= 80 ? "text-green-500" : kpis.pctEquipe >= 50 ? "text-yellow-500" : "text-destructive"}
        />
        <KpiCard
          icon={<Users className="h-5 w-5" />}
          label="Média / Vendedor"
          value={kpis.media.toFixed(1)}
          color="text-primary"
        />
      </div>

      {/* Table */}
      <Card className="overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50">
              <TableHead className="font-semibold">Representante</TableHead>
              <TableHead className="text-center font-semibold w-28">Meta</TableHead>
              <TableHead className="text-center font-semibold w-36">Visitas Realizadas</TableHead>
              <TableHead className="text-center font-semibold w-40">% Atingido</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredVisits.map((row) => {
              const pct = row.meta > 0 ? (row.quantidade / row.meta) * 100 : 0;
              return (
                <TableRow key={row.representative_id}>
                  <TableCell className="font-medium">{row.nome}</TableCell>
                  <TableCell className="text-center">
                    <Badge variant="secondary">{row.meta}</Badge>
                  </TableCell>
                  <TableCell className="text-center">
                    <Input
                      type="number"
                      min={0}
                      className="w-20 mx-auto text-center h-9"
                      value={row.quantidade || ""}
                      onChange={(e) => handleChange(row.representative_id, e.target.value)}
                      placeholder="0"
                    />
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2 justify-center">
                      <Progress
                        value={Math.min(pct, 100)}
                        className="h-2 w-20"
                      />
                      <span
                        className={`text-sm font-semibold min-w-[3rem] text-right ${
                          pct >= 100
                            ? "text-green-500"
                            : pct >= 50
                            ? "text-yellow-500"
                            : "text-destructive"
                        }`}
                      >
                        {pct.toFixed(0)}%
                      </span>
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
            {visits.length === 0 && loaded && (
              <TableRow>
                <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                  Nenhum representante cadastrado. Cadastre na aba "Representantes".
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Card>

      {/* Chart */}
      {visits.length > 0 && (
        <Card className="p-4 sm:p-6">
          <div className="flex items-center gap-2 mb-4">
            <BarChart3 className="h-5 w-5 text-primary" />
            <h3 className="font-semibold text-foreground">Visitas por Representante</h3>
          </div>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart
              data={chartData}
              margin={{ top: 5, right: 10, left: 0, bottom: 5 }}
            >
              <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
              <XAxis
                dataKey="nome"
                tick={{ fontSize: 11 }}
                className="fill-muted-foreground"
                interval={0}
                angle={-25}
                textAnchor="end"
                height={60}
              />
              <YAxis allowDecimals={false} className="fill-muted-foreground" tick={{ fontSize: 12 }} />
              <Tooltip
                contentStyle={{ borderRadius: 8, border: "1px solid hsl(var(--border))", background: "hsl(var(--card))" }}
                formatter={(value: number) => [value, "Visitas"]}
              />
              <ReferenceLine y={DEFAULT_META} stroke="hsl(var(--muted-foreground))" strokeDasharray="4 4" label={{ value: `Meta ${DEFAULT_META}`, position: "right", fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
              <Bar dataKey="quantidade" radius={[6, 6, 0, 0]} maxBarSize={48}>
                {chartData.map((entry, idx) => (
                  <Cell
                    key={idx}
                    fill={
                      entry.quantidade >= entry.meta
                        ? "hsl(142 71% 45%)"
                        : entry.quantidade >= entry.meta * 0.5
                        ? "hsl(48 96% 53%)"
                        : "hsl(var(--destructive))"
                    }
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </Card>
      )}

      {/* Performance by Rep - % Atingimento */}
      {visits.length > 0 && (
        <Card className="p-4 sm:p-6">
          <div className="flex items-center gap-2 mb-4">
            <Target className="h-5 w-5 text-primary" />
            <h3 className="font-semibold text-foreground">Desempenho por Representante</h3>
          </div>
          <div className="space-y-3">
            {visits
              .map((v) => ({ ...v, pct: v.meta > 0 ? (v.quantidade / v.meta) * 100 : 0 }))
              .sort((a, b) => b.pct - a.pct)
              .map((row) => {
                const color =
                  row.pct >= 100
                    ? "bg-green-500"
                    : row.pct >= 70
                    ? "bg-yellow-500"
                    : "bg-destructive";
                const textColor =
                  row.pct >= 100
                    ? "text-green-600"
                    : row.pct >= 70
                    ? "text-yellow-600"
                    : "text-destructive";
                return (
                  <div key={row.representative_id} className="flex items-center gap-3">
                    <span className="text-sm font-medium w-40 truncate">{row.nome}</span>
                    <div className="flex-1 h-5 rounded-full bg-muted overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${color}`}
                        style={{ width: `${Math.min(row.pct, 100)}%` }}
                      />
                    </div>
                    <span className={`text-sm font-bold min-w-[4rem] text-right ${textColor}`}>
                      {row.pct.toFixed(0)}%
                    </span>
                    <span className="text-xs text-muted-foreground min-w-[4.5rem]">
                      {row.quantidade}/{row.meta}
                    </span>
                  </div>
                );
              })}
          </div>
        </Card>
      )}

      {weeklyHistory.length > 1 && (
        <Card className="p-4 sm:p-6">
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp className="h-5 w-5 text-primary" />
            <h3 className="font-semibold text-foreground">Evolução Semanal — Equipe {filterYear}</h3>
          </div>
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={weeklyHistory} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
              <XAxis
                dataKey="semana"
                tickFormatter={(v) => `S${v}`}
                className="fill-muted-foreground"
                tick={{ fontSize: 11 }}
              />
              <YAxis allowDecimals={false} className="fill-muted-foreground" tick={{ fontSize: 12 }} />
              <Tooltip
                contentStyle={{ borderRadius: 8, border: "1px solid hsl(var(--border))", background: "hsl(var(--card))" }}
                labelFormatter={(v) => `Semana ${v}`}
                formatter={(value: number, name: string) => [value, name === "total" ? "Visitas" : "Meta"]}
              />
              <Line type="monotone" dataKey="total" stroke="hsl(var(--primary))" strokeWidth={2.5} dot={{ r: 4 }} activeDot={{ r: 6 }} name="total" />
              <Line type="monotone" dataKey="meta" stroke="hsl(var(--muted-foreground))" strokeWidth={1.5} strokeDasharray="5 5" dot={false} name="meta" />
            </LineChart>
          </ResponsiveContainer>
        </Card>
      )}

      {/* Save Visits button */}
      {visits.length > 0 && (
        <div className="flex justify-end">
          <Button onClick={handleSave} disabled={saving} size="lg">
            <Save className="h-4 w-4 mr-2" />
            {saving ? "Salvando..." : "Salvar Visitas"}
          </Button>
        </div>
      )}
      </>)}

      {/* ═══ OPORTUNIDADES ═══ */}
      {subTab === "oportunidades" && (<>
        <div className="flex items-center gap-2 flex-wrap">
          <Select value={filterRep} onValueChange={setFilterRep}>
            <SelectTrigger className="w-[140px] text-xs h-8"><Users className="h-3.5 w-3.5 mr-1" /><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Equipe</SelectItem>
              {reps.map((r) => (<SelectItem key={r.id} value={r.id}>{r.nome}</SelectItem>))}
            </SelectContent>
          </Select>
          <Select value={String(filterYear)} onValueChange={(v) => setFilterYear(Number(v))}>
            <SelectTrigger className="w-24 text-xs h-8"><SelectValue /></SelectTrigger>
            <SelectContent>
              {[currentYear - 1, currentYear, currentYear + 1].map((y) => (<SelectItem key={y} value={String(y)}>{y}</SelectItem>))}
            </SelectContent>
          </Select>
          <Select value={String(filterMonth)} onValueChange={(v) => setFilterMonth(Number(v))}>
            <SelectTrigger className="w-24 text-xs h-8"><Calendar className="h-3.5 w-3.5 mr-1" /><SelectValue /></SelectTrigger>
            <SelectContent>
              {MONTHS.map((m, i) => (<SelectItem key={i} value={String(i + 1)}>{m}</SelectItem>))}
            </SelectContent>
          </Select>
        </div>
        {/* Opp KPI Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <KpiCard icon={<Lightbulb className="h-5 w-5" />} label="Total Abertas" value={String(oppKpis.totalAberto)} color="text-primary" />
          <KpiCard icon={<Users className="h-5 w-5" />} label="Próprias Rep." value={String(oppKpis.totalProprias)} color="text-green-500" />
          <KpiCard icon={<Target className="h-5 w-5" />} label="SDR / Interno" value={String(oppKpis.totalSdr)} color="text-yellow-500" />
          <KpiCard icon={<TrendingUp className="h-5 w-5" />} label="% Geração Própria" value={`${oppKpis.pctProprias.toFixed(1)}%`} color={oppKpis.pctProprias >= 50 ? "text-green-500" : "text-yellow-500"} />
        </div>

        {/* Opp Editable Table */}
        <Card className="overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead className="font-semibold">Representante</TableHead>
                <TableHead className="text-center font-semibold w-32">Próprias</TableHead>
                <TableHead className="text-center font-semibold w-32">SDR/Interno</TableHead>
                <TableHead className="text-center font-semibold w-24">Total</TableHead>
                <TableHead className="text-center font-semibold w-28">% Próprias</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredOpportunities.map((row) => {
                const total = row.qty_proprias + row.qty_sdr;
                const pct = total > 0 ? (row.qty_proprias / total) * 100 : 0;
                return (
                  <TableRow key={row.representative_id}>
                    <TableCell className="font-medium">{row.nome}</TableCell>
                    <TableCell className="text-center">
                      <Input type="number" min={0} className="w-20 mx-auto text-center h-9" value={row.qty_proprias || ""} onChange={(e) => handleOppChange(row.representative_id, "qty_proprias", e.target.value)} placeholder="0" />
                    </TableCell>
                    <TableCell className="text-center">
                      <Input type="number" min={0} className="w-20 mx-auto text-center h-9" value={row.qty_sdr || ""} onChange={(e) => handleOppChange(row.representative_id, "qty_sdr", e.target.value)} placeholder="0" />
                    </TableCell>
                    <TableCell className="text-center font-semibold">{total}</TableCell>
                    <TableCell className="text-center">
                      <Badge variant={pct >= 50 ? "default" : "secondary"}>{pct.toFixed(1)}%</Badge>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </Card>

        {/* Opp Stacked Bar Chart */}
        {oppChartData.length > 0 && (
          <Card className="p-4 sm:p-6">
            <div className="flex items-center gap-2 mb-4">
              <BarChart3 className="h-5 w-5 text-primary" />
              <h3 className="font-semibold text-foreground">Origem das Oportunidades por Representante</h3>
            </div>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={oppChartData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="nome" tick={{ fontSize: 11 }} className="fill-muted-foreground" interval={0} angle={-25} textAnchor="end" height={60} />
                <YAxis allowDecimals={false} className="fill-muted-foreground" tick={{ fontSize: 12 }} />
                <Tooltip contentStyle={{ borderRadius: 8, border: "1px solid hsl(var(--border))", background: "hsl(var(--card))" }} />
                <Legend />
                <Bar dataKey="proprias" name="Próprias" stackId="a" fill="hsl(142 71% 45%)" radius={[0, 0, 0, 0]} maxBarSize={48} />
                <Bar dataKey="sdr" name="SDR / Interno" stackId="a" fill="hsl(48 96% 53%)" radius={[6, 6, 0, 0]} maxBarSize={48} />
              </BarChart>
            </ResponsiveContainer>
          </Card>
        )}

        {/* Save Opp button */}
        {opportunities.length > 0 && (
          <div className="flex justify-end">
            <Button onClick={handleSaveOpp} disabled={savingOpp} size="lg">
              <Save className="h-4 w-4 mr-2" />
              {savingOpp ? "Salvando..." : "Salvar Oportunidades"}
            </Button>
          </div>
        )}
      </>)}

      {/* ═══ METAS ═══ */}
      {subTab === "metas" && (<>
        <div className="flex items-center gap-2 flex-wrap">
          <Select value={filterRep} onValueChange={setFilterRep}>
            <SelectTrigger className="w-[140px] text-xs h-8"><Users className="h-3.5 w-3.5 mr-1" /><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Equipe</SelectItem>
              {reps.map((r) => (<SelectItem key={r.id} value={r.id}>{r.nome}</SelectItem>))}
            </SelectContent>
          </Select>
          <Select value={String(filterYear)} onValueChange={(v) => setFilterYear(Number(v))}>
            <SelectTrigger className="w-24 text-xs h-8"><SelectValue /></SelectTrigger>
            <SelectContent>
              {[currentYear - 1, currentYear, currentYear + 1].map((y) => (<SelectItem key={y} value={String(y)}>{y}</SelectItem>))}
            </SelectContent>
          </Select>
          <Select value={String(filterMonth)} onValueChange={(v) => setFilterMonth(Number(v))}>
            <SelectTrigger className="w-24 text-xs h-8"><Calendar className="h-3.5 w-3.5 mr-1" /><SelectValue /></SelectTrigger>
            <SelectContent>
              {MONTHS.map((m, i) => (<SelectItem key={i} value={String(i + 1)}>{m}</SelectItem>))}
            </SelectContent>
          </Select>
        </div>
        {/* Goals KPI Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <KpiCard icon={<Flag className="h-5 w-5" />} label="Meta Total" value={String(goalsKpis.totalQtd)} color="text-primary" />
          <KpiCard icon={<TrendingUp className="h-5 w-5" />} label="Realizado" value={String(totalRealizadoQtd)} color={totalRealizadoQtd >= goalsKpis.totalQtd && goalsKpis.totalQtd > 0 ? "text-accent" : "text-foreground"} />
          <KpiCard icon={<Target className="h-5 w-5" />} label="% Atingimento" value={goalsKpis.totalQtd > 0 ? `${((totalRealizadoQtd / goalsKpis.totalQtd) * 100).toFixed(1)}%` : "—"} color={goalsKpis.totalQtd > 0 ? (totalRealizadoQtd / goalsKpis.totalQtd >= 1 ? "text-accent" : totalRealizadoQtd / goalsKpis.totalQtd >= 0.7 ? "text-yellow-500" : "text-destructive") : "text-muted-foreground"} />
          <KpiCard icon={<Users className="h-5 w-5" />} label="Reps com Meta" value={`${goalsKpis.repsComMeta}/${filteredGoals.length}`} color="text-muted-foreground" />
        </div>

        <p className="text-xs text-muted-foreground">As metas são cadastradas na aba Representantes. O realizado é calculado automaticamente a partir das vendas fechadas no mês.</p>

        {/* Goals Table with Realizado */}
        <Card className="overflow-hidden overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead className="font-semibold" rowSpan={2}>Representante</TableHead>
                {MACHINE_TYPES.map(mt => (
                  <TableHead key={mt} className="text-center font-semibold border-l border-border" colSpan={2}>{mt}</TableHead>
                ))}
                <TableHead className="text-center font-semibold border-l border-border" colSpan={3}>Total</TableHead>
              </TableRow>
              <TableRow className="bg-muted/30">
                {MACHINE_TYPES.map(mt => (
                  <React.Fragment key={`h-${mt}`}>
                    <TableHead className="text-center text-xs border-l border-border">Meta</TableHead>
                    <TableHead className="text-center text-xs">Real.</TableHead>
                  </React.Fragment>
                ))}
                <TableHead className="text-center text-xs border-l border-border">Meta</TableHead>
                <TableHead className="text-center text-xs">Real.</TableHead>
                <TableHead className="text-center text-xs">%</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredGoals.map((row) => {
                const repClosed = closedByRepType[row.representative_id] || {};
                const totalMeta = row.meta_quantidade;
                const totalReal = MACHINE_TYPES.reduce((s, mt) => s + (repClosed[mt] || 0), 0);
                const pct = totalMeta > 0 ? (totalReal / totalMeta) * 100 : 0;
                const pctColor = totalMeta === 0 ? "text-muted-foreground" : pct >= 100 ? "text-accent" : pct >= 70 ? "text-yellow-500" : "text-destructive";
                return (
                  <TableRow key={row.representative_id}>
                    <TableCell className="font-medium">{row.nome}</TableCell>
                    {MACHINE_TYPES.map(mt => {
                      const meta = row.byType[mt] || 0;
                      const real = repClosed[mt] || 0;
                      return (
                        <React.Fragment key={mt}>
                          <TableCell className="text-center border-l border-border">{meta > 0 ? meta : "—"}</TableCell>
                          <TableCell className={`text-center font-medium ${meta > 0 && real >= meta ? "text-accent" : real > 0 ? "text-foreground" : "text-muted-foreground"}`}>{real}</TableCell>
                        </React.Fragment>
                      );
                    })}
                    <TableCell className="text-center font-bold border-l border-border">{totalMeta > 0 ? totalMeta : "—"}</TableCell>
                    <TableCell className="text-center font-bold">{totalReal}</TableCell>
                    <TableCell className={`text-center font-bold ${pctColor}`}>
                      {totalMeta > 0 ? (
                        <div className="flex flex-col items-center gap-1">
                          <span>{pct.toFixed(0)}%</span>
                          <Progress value={Math.min(pct, 100)} className="h-1.5 w-16" />
                        </div>
                      ) : "—"}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </Card>
      </>)}

      {/* ═══ DESEMPENHO ═══ */}
      {subTab === "desempenho" && (() => {
        // Helper: get weeks that belong to a given month (approximate)
        const getWeeksForMonth = (month: number, year: number): number[] => {
          const weeks: number[] = [];
          const d = new Date(year, month - 1, 1);
          while (d.getMonth() === month - 1) {
            weeks.push(getWeekNumber(d));
            d.setDate(d.getDate() + 7);
          }
          return [...new Set(weeks)];
        };

        // Determine which weeks and months are in scope
        let relevantWeeks: number[] = [];
        let relevantMonths: number[] = [];
        let periodLabel = "";

        if (periodMode === "semana") {
          relevantWeeks = [filterWeek];
          periodLabel = `Semana ${filterWeek}`;
        } else if (periodMode === "mes") {
          relevantWeeks = getWeeksForMonth(filterMonth, filterYear);
          relevantMonths = [filterMonth];
          periodLabel = MONTHS[filterMonth - 1] + ` ${filterYear}`;
        } else if (periodMode === "trimestre") {
          relevantMonths = QUARTER_MONTHS[filterQuarter] || [];
          relevantWeeks = relevantMonths.flatMap(m => getWeeksForMonth(m, filterYear));
          periodLabel = `${filterQuarter} ${filterYear}`;
        } else {
          relevantWeeks = Array.from({ length: 52 }, (_, i) => i + 1);
          relevantMonths = Array.from({ length: 12 }, (_, i) => i + 1);
          periodLabel = `${filterYear}`;
        }

        const uniqueWeeks = new Set(relevantWeeks);

        // Aggregate per-rep
        const perfData = reps
          .filter(r => filterRep === "all" || r.id === filterRep)
          .map((r) => {
            const repVisits = allYearVisits.filter(v => v.representative_id === r.id && uniqueWeeks.has(v.semana));
            const visitasRealizadas = repVisits.reduce((s, v) => s + v.quantidade, 0);
            const visitasMeta = repVisits.reduce((s, v) => s + v.meta, 0);
            const effectiveMeta = visitasMeta > 0 ? visitasMeta : (periodMode === "semana" ? DEFAULT_META : 0);
            const pctVisitas = effectiveMeta > 0 ? (visitasRealizadas / effectiveMeta) * 100 : 0;

            const repOpps = allYearOpps.filter(o => o.representative_id === r.id && relevantMonths.includes(o.mes));
            const oppProprias = repOpps.reduce((s, o) => s + o.qty_proprias, 0);
            const oppSdr = repOpps.reduce((s, o) => s + o.qty_sdr, 0);
            const totalOpp = oppProprias + oppSdr;

            const monthsToUse = relevantMonths.length > 0 ? relevantMonths : (periodMode === "semana" ? [filterMonth] : []);
            const repGoals = allYearGoals.filter(g => g.representative_id === r.id && monthsToUse.includes(g.mes));
            const metaQtd = repGoals.reduce((s, g) => s + (g.meta_quantidade || 0), 0);

            const byType: Record<string, number> = {};
            repGoals.forEach(g => {
              if (g.machine_type && g.meta_quantidade > 0) {
                byType[g.machine_type] = (byType[g.machine_type] || 0) + g.meta_quantidade;
              }
            });

            return { id: r.id, nome: r.nome, shortName: r.nome.split(" ").slice(0, 2).join(" "), visitasRealizadas, visitasMeta: effectiveMeta, pctVisitas, oppProprias, oppSdr, totalOpp, metaQtd, byType };
          });

        const totalVisitas = perfData.reduce((s, r) => s + r.visitasRealizadas, 0);
        const totalMeta = perfData.reduce((s, r) => s + r.visitasMeta, 0);
        const totalOpp = perfData.reduce((s, r) => s + r.totalOpp, 0);
        const totalMetaQtd = perfData.reduce((s, r) => s + r.metaQtd, 0);
        const pctGeral = totalMeta > 0 ? (totalVisitas / totalMeta) * 100 : 0;

        const compData = perfData.map(r => ({
          nome: r.shortName, visitas: r.visitasRealizadas, meta: r.visitasMeta, oportunidades: r.totalOpp, proprias: r.oppProprias, sdr: r.oppSdr, metaQtd: r.metaQtd,
        }));

        const ranking = [...perfData].sort((a, b) => b.pctVisitas - a.pctVisitas);

        // Evolution data
        let evolutionData: { label: string; visitas: number; meta: number; opp: number }[] = [];
        if (periodMode === "semana" || periodMode === "mes") {
          const sortedWeeks = [...uniqueWeeks].sort((a, b) => a - b);
          evolutionData = sortedWeeks.map(w => {
            const wV = allYearVisits.filter(v => v.semana === w && (filterRep === "all" || v.representative_id === filterRep));
            const wO = allYearOpps.filter(o => relevantMonths.includes(o.mes) && (filterRep === "all" || o.representative_id === filterRep));
            return { label: `S${w}`, visitas: wV.reduce((s, v) => s + v.quantidade, 0), meta: wV.reduce((s, v) => s + v.meta, 0), opp: wO.reduce((s, o) => s + o.qty_proprias + o.qty_sdr, 0) / Math.max(sortedWeeks.length, 1) };
          });
        } else {
          const mList = periodMode === "trimestre" ? relevantMonths : Array.from({ length: 12 }, (_, i) => i + 1);
          evolutionData = mList.map(m => {
            const mWeekSet = new Set(getWeeksForMonth(m, filterYear));
            const mV = allYearVisits.filter(v => mWeekSet.has(v.semana) && (filterRep === "all" || v.representative_id === filterRep));
            const mO = allYearOpps.filter(o => o.mes === m && (filterRep === "all" || o.representative_id === filterRep));
            return { label: MONTHS[m - 1], visitas: mV.reduce((s, v) => s + v.quantidade, 0), meta: mV.reduce((s, v) => s + v.meta, 0), opp: mO.reduce((s, o) => s + o.qty_proprias + o.qty_sdr, 0) };
          });
        }

        const metaByType = MACHINE_TYPES.map(mt => ({
          type: mt, total: perfData.reduce((s, r) => s + (r.byType[mt] || 0), 0),
        }));

        return (
          <>
            {/* Summary KPIs */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <KpiCard icon={<Eye className="h-5 w-5" />} label="Visitas Realizadas" value={String(totalVisitas)} color="text-primary" />
              <KpiCard icon={<Lightbulb className="h-5 w-5" />} label="Oportunidades" value={String(totalOpp)} color="text-muted-foreground" />
              <KpiCard icon={<Flag className="h-5 w-5" />} label="Meta Qtd Máquinas" value={String(totalMetaQtd)} color="text-primary" />
              <KpiCard icon={<TrendingUp className="h-5 w-5" />} label="% Ating. Visitas" value={`${pctGeral.toFixed(0)}%`} color={pctGeral >= 80 ? "text-accent" : pctGeral >= 50 ? "text-primary" : "text-destructive"} />
            </div>

            {/* Visitas vs Meta */}
            <Card className="p-4 sm:p-6">
              <div className="flex items-center gap-2 mb-4">
                <BarChart3 className="h-5 w-5 text-primary" />
                <h3 className="font-semibold text-foreground">Visitas vs Meta por Representante</h3>
              </div>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={compData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="nome" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} interval={0} angle={-25} textAnchor="end" height={60} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }} />
                  <Tooltip contentStyle={{ borderRadius: 8, border: "1px solid hsl(var(--border))", background: "hsl(var(--card))" }} />
                  <Legend />
                  <Bar dataKey="visitas" name="Visitas" fill="hsl(var(--primary))" radius={[6, 6, 0, 0]} maxBarSize={40} />
                  <Bar dataKey="meta" name="Meta" fill="hsl(var(--muted-foreground))" radius={[6, 6, 0, 0]} maxBarSize={40} opacity={0.4} />
                </BarChart>
              </ResponsiveContainer>
            </Card>

            {/* Oportunidades por Rep */}
            {compData.some(c => c.oportunidades > 0) && (
              <Card className="p-4 sm:p-6">
                <div className="flex items-center gap-2 mb-4">
                  <Lightbulb className="h-5 w-5 text-muted-foreground" />
                  <h3 className="font-semibold text-foreground">Oportunidades por Representante</h3>
                </div>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={compData.filter(c => c.oportunidades > 0)} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="nome" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} interval={0} angle={-25} textAnchor="end" height={60} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }} />
                    <Tooltip contentStyle={{ borderRadius: 8, border: "1px solid hsl(var(--border))", background: "hsl(var(--card))" }} />
                    <Legend />
                    <Bar dataKey="proprias" name="Próprias" stackId="a" fill="hsl(var(--primary))" radius={[0, 0, 0, 0]} maxBarSize={40} />
                    <Bar dataKey="sdr" name="SDR / Interno" stackId="a" fill="hsl(var(--muted-foreground))" radius={[6, 6, 0, 0]} maxBarSize={40} />
                  </BarChart>
                </ResponsiveContainer>
              </Card>
            )}

            {/* Metas por Tipo de Máquina */}
            {metaByType.some(m => m.total > 0) && (
              <Card className="p-4 sm:p-6">
                <div className="flex items-center gap-2 mb-4">
                  <Flag className="h-5 w-5 text-primary" />
                  <h3 className="font-semibold text-foreground">Metas por Tipo de Máquina</h3>
                </div>
                <div className="grid grid-cols-3 gap-3 mb-4">
                  {metaByType.map(mt => (
                    <div key={mt.type} className="p-3 rounded-lg bg-secondary text-center">
                      <p className="text-[10px] text-muted-foreground truncate">{mt.type}</p>
                      <p className="text-lg font-bold text-foreground">{mt.total}</p>
                    </div>
                  ))}
                </div>
                {perfData.some(r => r.metaQtd > 0) && (
                  <ResponsiveContainer width="100%" height={280}>
                    <BarChart data={compData.filter(c => c.metaQtd > 0)} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis dataKey="nome" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} interval={0} angle={-25} textAnchor="end" height={60} />
                      <YAxis allowDecimals={false} tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }} />
                      <Tooltip contentStyle={{ borderRadius: 8, border: "1px solid hsl(var(--border))", background: "hsl(var(--card))" }} />
                      <Bar dataKey="metaQtd" name="Meta Qtd" fill="hsl(var(--primary))" radius={[6, 6, 0, 0]} maxBarSize={40} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </Card>
            )}

            {/* Ranking */}
            <Card className="p-4 sm:p-6">
              <div className="flex items-center gap-2 mb-4">
                <Activity className="h-5 w-5 text-primary" />
                <h3 className="font-semibold text-foreground">Ranking de Desempenho — {periodLabel}</h3>
              </div>
              <div className="space-y-3">
                {ranking.map((row, i) => {
                  const color = row.pctVisitas >= 100 ? "bg-accent" : row.pctVisitas >= 70 ? "bg-primary" : "bg-destructive";
                  const textColor = row.pctVisitas >= 100 ? "text-accent" : row.pctVisitas >= 70 ? "text-primary" : "text-destructive";
                  const medal = i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `#${i + 1}`;
                  return (
                    <div key={row.id} className="flex items-center gap-3">
                      <span className="text-sm font-bold w-8">{medal}</span>
                      <span className="text-sm font-medium w-36 truncate">{row.nome}</span>
                      <div className="flex-1 h-5 rounded-full bg-muted overflow-hidden">
                        <div className={`h-full rounded-full transition-all duration-500 ${color}`} style={{ width: `${Math.min(row.pctVisitas, 100)}%` }} />
                      </div>
                      <span className={`text-sm font-bold min-w-[3.5rem] text-right ${textColor}`}>{row.pctVisitas.toFixed(0)}%</span>
                      <div className="flex gap-2 text-xs text-muted-foreground">
                        <span title="Visitas">{row.visitasRealizadas}v</span>
                        <span title="Oportunidades">{row.totalOpp}o</span>
                        <span title="Meta Máq">{row.metaQtd}m</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </Card>

            {/* Evolução temporal */}
            {evolutionData.length > 1 && (
              <Card className="p-4 sm:p-6">
                <div className="flex items-center gap-2 mb-4">
                  <TrendingUp className="h-5 w-5 text-primary" />
                  <h3 className="font-semibold text-foreground">
                    Evolução {periodMode === "semana" || periodMode === "mes" ? "Semanal" : "Mensal"} — {periodLabel}
                  </h3>
                </div>
                <ResponsiveContainer width="100%" height={280}>
                  <LineChart data={evolutionData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="label" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }} />
                    <Tooltip
                      contentStyle={{ borderRadius: 8, border: "1px solid hsl(var(--border))", background: "hsl(var(--card))" }}
                      formatter={(value: number, name: string) => [value, name === "visitas" ? "Visitas" : name === "meta" ? "Meta" : "Oportunidades"]}
                    />
                    <Legend formatter={(v) => v === "visitas" ? "Visitas" : v === "meta" ? "Meta" : "Oportunidades"} />
                    <Line type="monotone" dataKey="visitas" stroke="hsl(var(--primary))" strokeWidth={2.5} dot={{ r: 4, fill: "hsl(var(--primary))" }} name="visitas" />
                    <Line type="monotone" dataKey="meta" stroke="hsl(var(--muted-foreground))" strokeWidth={1.5} strokeDasharray="5 5" dot={false} name="meta" />
                    <Line type="monotone" dataKey="opp" stroke="hsl(var(--accent))" strokeWidth={2} dot={{ r: 3, fill: "hsl(var(--accent))" }} name="opp" />
                  </LineChart>
                </ResponsiveContainer>
              </Card>
            )}

            {/* ═══ FUNIL DE CONVERSÃO ═══ */}
            {(() => {
              // Filter closed deals by period and rep
              const filteredClosed = allYearClosedDeals.filter(d => {
                if (filterRep !== "all" && d.representative_id !== filterRep) return false;
                if (!d.closed_at) return false;
                const dt = new Date(d.closed_at);
                const m = dt.getMonth() + 1;
                if (periodMode === "mes") return m === filterMonth;
                if (periodMode === "trimestre") return relevantMonths.includes(m);
                return true; // ano
              });
              const vendasFechadas = filteredClosed.length;
              const fmtPct = (a: number, b: number) => b > 0 ? `${((a / b) * 100).toFixed(1)}%` : "—";

              const funnelSteps = [
                { label: "Visitas", value: totalVisitas, icon: <Eye className="h-4 w-4" />, colorClass: "text-primary bg-primary/15" },
                { label: "Oportunidades", value: totalOpp, icon: <Target className="h-4 w-4" />, colorClass: "text-accent bg-accent/15" },
                { label: "Vendas Fechadas", value: vendasFechadas, icon: <TrendingUp className="h-4 w-4" />, colorClass: "text-accent bg-accent/15" },
              ];
              const maxVal = Math.max(totalVisitas, totalOpp, vendasFechadas, 1);

              return (
                <Card className="p-4 sm:p-6">
                  <div className="flex items-center gap-2 mb-4">
                    <Target className="h-5 w-5 text-primary" />
                    <h3 className="font-semibold text-foreground">Funil de Conversão — {periodLabel}</h3>
                  </div>

                  <div className="space-y-3">
                    {funnelSteps.map((step) => {
                      const pct = maxVal > 0 ? (step.value / maxVal) * 100 : 0;
                      return (
                        <div key={step.label}>
                          <div className="flex items-center justify-between mb-1">
                            <div className="flex items-center gap-2">
                              <div className={`flex h-6 w-6 items-center justify-center rounded-md ${step.colorClass}`}>
                                {step.icon}
                              </div>
                              <span className="text-xs font-medium text-foreground">{step.label}</span>
                            </div>
                            <span className="text-sm font-bold text-foreground">{step.value}</span>
                          </div>
                          <Progress value={Math.min(pct, 100)} className="h-2" />
                        </div>
                      );
                    })}
                  </div>

                  {/* Taxas de conversão */}
                  <div className="mt-4 pt-3 border-t border-border">
                    <p className="text-[10px] text-muted-foreground mb-2 uppercase tracking-wide font-semibold">Taxas de Conversão</p>
                    <div className="grid grid-cols-3 gap-2">
                      {[
                        { from: "Visitas", to: "Oportunidades", pct: fmtPct(totalOpp, totalVisitas) },
                        { from: "Oportunidades", to: "Vendas", pct: fmtPct(vendasFechadas, totalOpp) },
                        { from: "Visitas", to: "Vendas", pct: fmtPct(vendasFechadas, totalVisitas) },
                      ].map((c) => (
                        <div key={c.from + c.to} className="text-center p-2 rounded-lg bg-secondary/40">
                          <p className="text-[10px] text-muted-foreground">{c.from}</p>
                          <div className="flex items-center justify-center gap-1 my-0.5">
                            <span className="text-muted-foreground text-xs">→</span>
                          </div>
                          <p className="text-[10px] text-muted-foreground">{c.to}</p>
                          <p className="text-sm font-bold text-primary mt-0.5">{c.pct}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                </Card>
              );
            })()}

            {/* ═══ META VS REALIZADO POR TIPO DE MÁQUINA ═══ */}
            {(() => {
              // Filter closed deals by period and rep
              const closedFiltered = allYearClosedDeals.filter(d => {
                if (filterRep !== "all" && d.representative_id !== filterRep) return false;
                if (!d.closed_at) return false;
                const dt = new Date(d.closed_at);
                const m = dt.getMonth() + 1;
                if (periodMode === "mes") return m === filterMonth;
                if (periodMode === "trimestre") return relevantMonths.includes(m);
                return true;
              });

              // Goals filtered by period and rep
              const goalsFiltered = allYearGoals.filter(g => {
                if (filterRep !== "all" && g.representative_id !== filterRep) return false;
                if (periodMode === "mes") return g.mes === filterMonth;
                if (periodMode === "trimestre") return relevantMonths.includes(g.mes);
                return true;
              });

              const chartDataMvR = MACHINE_TYPES.map(mt => {
                const metaVal = goalsFiltered.filter(g => g.machine_type === mt).reduce((s, g) => s + (g.meta_quantidade || 0), 0);
                const realVal = closedFiltered.filter(d => d.machine_type === mt).length;
                return { tipo: mt, meta: metaVal, realizado: realVal };
              });

              const totalMetaMvR = chartDataMvR.reduce((s, r) => s + r.meta, 0);
              const totalRealMvR = chartDataMvR.reduce((s, r) => s + r.realizado, 0);
              const pctAtingMvR = totalMetaMvR > 0 ? (totalRealMvR / totalMetaMvR) * 100 : 0;
              const melhorTipo = [...chartDataMvR].sort((a, b) => {
                const pA = a.meta > 0 ? a.realizado / a.meta : 0;
                const pB = b.meta > 0 ? b.realizado / b.meta : 0;
                return pB - pA;
              })[0];

              const pctColor = pctAtingMvR >= 100 ? "text-accent" : pctAtingMvR >= 70 ? "text-yellow-500" : "text-destructive";

              return (
                <Card className="p-4 sm:p-6">
                  <div className="flex items-center gap-2 mb-4">
                    <Flag className="h-5 w-5 text-primary" />
                    <h3 className="font-semibold text-foreground">Meta vs Realizado por Tipo de Máquina — {periodLabel}</h3>
                  </div>

                  {/* Summary cards */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
                    <div className="p-3 rounded-lg bg-secondary text-center">
                      <p className="text-[10px] text-muted-foreground uppercase tracking-wide font-semibold">Total Meta</p>
                      <p className="text-lg font-bold text-foreground">{totalMetaMvR}</p>
                    </div>
                    <div className="p-3 rounded-lg bg-secondary text-center">
                      <p className="text-[10px] text-muted-foreground uppercase tracking-wide font-semibold">Total Realizado</p>
                      <p className="text-lg font-bold text-foreground">{totalRealMvR}</p>
                    </div>
                    <div className="p-3 rounded-lg bg-secondary text-center">
                      <p className="text-[10px] text-muted-foreground uppercase tracking-wide font-semibold">% Atingido</p>
                      <p className={`text-lg font-bold ${pctColor}`}>{pctAtingMvR.toFixed(1)}%</p>
                    </div>
                    <div className="p-3 rounded-lg bg-secondary text-center">
                      <p className="text-[10px] text-muted-foreground uppercase tracking-wide font-semibold">Melhor Tipo</p>
                      <p className="text-sm font-bold text-foreground truncate">{melhorTipo?.tipo || "—"}</p>
                    </div>
                  </div>

                  {/* Chart */}
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={chartDataMvR} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis dataKey="tipo" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                      <YAxis allowDecimals={false} tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }} />
                      <Tooltip contentStyle={{ borderRadius: 8, border: "1px solid hsl(var(--border))", background: "hsl(var(--card))" }} />
                      <Legend />
                      <Bar dataKey="meta" name="Meta" fill="hsl(var(--muted-foreground))" radius={[6, 6, 0, 0]} maxBarSize={50} opacity={0.4} />
                      <Bar dataKey="realizado" name="Realizado" fill="hsl(var(--primary))" radius={[6, 6, 0, 0]} maxBarSize={50} />
                    </BarChart>
                  </ResponsiveContainer>

                  {/* Per-type detail */}
                  <div className="mt-4 pt-3 border-t border-border grid grid-cols-3 gap-2">
                    {chartDataMvR.map(r => {
                      const p = r.meta > 0 ? (r.realizado / r.meta) * 100 : 0;
                      const c = p >= 100 ? "text-accent" : p >= 70 ? "text-yellow-500" : "text-destructive";
                      return (
                        <div key={r.tipo} className="text-center p-2 rounded-lg bg-secondary/40">
                          <p className="text-[10px] text-muted-foreground font-medium truncate">{r.tipo}</p>
                          <p className="text-xs text-foreground">{r.realizado} / {r.meta}</p>
                          <p className={`text-sm font-bold mt-0.5 ${c}`}>{r.meta > 0 ? `${p.toFixed(0)}%` : "—"}</p>
                          <Progress value={Math.min(p, 100)} className="h-1.5 mt-1" />
                        </div>
                      );
                    })}
                  </div>
                </Card>
              );
            })()}

            {/* ═══ HEATMAP SEMANAL DE VISITAS ═══ */}
            {(() => {
              const filteredReps = reps.filter(r => filterRep === "all" || r.id === filterRep);
              const sortedWeeks = [...uniqueWeeks].sort((a, b) => a - b);

              if (filteredReps.length === 0 || sortedWeeks.length === 0) return null;

              const heatData = filteredReps.map(r => {
                const row: Record<number, number> = {};
                sortedWeeks.forEach(w => {
                  const found = allYearVisits.find(v => v.representative_id === r.id && v.semana === w);
                  row[w] = found ? found.quantidade : 0;
                });
                return { id: r.id, nome: r.nome.split(" ").slice(0, 2).join(" "), weeks: row };
              });

              const maxV = Math.max(...heatData.flatMap(r => Object.values(r.weeks)), 1);

              const getHeatColor = (val: number) => {
                if (val === 0) return "bg-muted text-muted-foreground";
                const ratio = val / maxV;
                if (ratio <= 0.25) return "bg-primary/10 text-primary";
                if (ratio <= 0.5) return "bg-primary/25 text-primary";
                if (ratio <= 0.75) return "bg-primary/40 text-primary-foreground";
                return "bg-primary/60 text-primary-foreground";
              };

              return (
                <Card className="p-4 sm:p-6">
                  <div className="flex items-center gap-2 mb-4">
                    <Eye className="h-5 w-5 text-primary" />
                    <h3 className="font-semibold text-foreground">Heatmap Semanal de Visitas — {periodLabel}</h3>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full border-collapse text-xs">
                      <thead>
                        <tr>
                          <th className="text-left p-1.5 text-muted-foreground font-semibold sticky left-0 bg-card z-10 min-w-[100px]">Rep</th>
                          {sortedWeeks.map(w => (
                            <th key={w} className="text-center p-1 text-muted-foreground font-medium min-w-[36px]">S{w}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {heatData.map(row => (
                          <tr key={row.id}>
                            <td className="p-1.5 font-medium text-foreground sticky left-0 bg-card z-10 truncate">{row.nome}</td>
                            {sortedWeeks.map(w => {
                              const val = row.weeks[w];
                              return (
                                <td key={w} className="p-0.5 text-center">
                                  <div className={`rounded-md w-full h-7 flex items-center justify-center text-[10px] font-bold ${getHeatColor(val)}`}>
                                    {val > 0 ? val : ""}
                                  </div>
                                </td>
                              );
                            })}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <div className="flex items-center gap-3 mt-4 pt-3 border-t border-border">
                    <span className="text-[10px] text-muted-foreground font-semibold">Intensidade:</span>
                    <div className="flex items-center gap-1">
                      {["bg-muted", "bg-primary/10", "bg-primary/25", "bg-primary/40", "bg-primary/60"].map((bg, i) => (
                        <div key={i} className={`h-3 w-6 rounded ${bg}`} />
                      ))}
                    </div>
                    <span className="text-[10px] text-muted-foreground">0 → Máx</span>
                  </div>
                </Card>
              );
            })()}
          </>
        );
      })()}

      {/* ═══ NEGOCIAÇÕES PERDIDAS ═══ */}
      {subTab === "perdidas" && (() => {
        const filtered = lostDeals.filter(d => {
          if (filterRep !== "all" && d.representative_id !== filterRep) return false;
          const dt = new Date(d.data_perda + "T00:00:00");
          if (dt.getFullYear() !== filterYear) return false;
          if (periodMode === "mes" && dt.getMonth() + 1 !== filterMonth) return false;
          if (periodMode === "trimestre") {
            const qMonths = QUARTER_MONTHS[filterQuarter] || [];
            if (!qMonths.includes(dt.getMonth() + 1)) return false;
          }
          return true;
        });

        const total = filtered.reduce((s, d) => s + ((d as any).quantidade || 1), 0);
        const totalValor = filtered.reduce((s, d) => s + (d.deal_value || 0), 0);

        const byRep: Record<string, number> = {};
        filtered.forEach(d => {
          const repName = reps.find(r => r.id === d.representative_id)?.nome || "Sem Rep";
          byRep[repName] = (byRep[repName] || 0) + ((d as any).quantidade || 1);
        });
        const repData = Object.entries(byRep).sort((a, b) => b[1] - a[1]).map(([nome, count]) => ({ nome, count }));

        const byMotivo: Record<string, number> = {};
        filtered.forEach(d => {
          const motivo = d.motivo_perda || "Não informado";
          byMotivo[motivo] = (byMotivo[motivo] || 0) + ((d as any).quantidade || 1);
        });
        const motivoData = Object.entries(byMotivo).sort((a, b) => b[1] - a[1]).map(([motivo, count]) => ({
          motivo, count, pct: total > 0 ? (count / total * 100) : 0,
        }));

        const bySubmotivo: Record<string, number> = {};
        filtered.forEach(d => {
          const sub = d.motivo_perda_detalhe || "Não informado";
          bySubmotivo[sub] = (bySubmotivo[sub] || 0) + ((d as any).quantidade || 1);
        });
        const submotivoData = Object.entries(bySubmotivo).sort((a, b) => b[1] - a[1]).map(([submotivo, count]) => ({ submotivo, count }));

        const formatBrlFull = (v: number) => `R$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
        const SHORT_MONTH_NAMES = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
        const formatDate = (d: string) => { const dt = new Date(d + "T00:00:00"); return `${SHORT_MONTH_NAMES[dt.getMonth()]} ${dt.getFullYear()}`; };
        const periodLabel = periodMode === "mes" ? `${MONTHS[filterMonth - 1]} ${filterYear}` : periodMode === "trimestre" ? `${filterQuarter} ${filterYear}` : `${filterYear}`;

        return (
          <>
            {/* Filters + Add Button */}
            <div className="flex items-center gap-2 flex-wrap">
              <Select value={filterRep} onValueChange={setFilterRep}>
                <SelectTrigger className="w-[140px] text-xs h-8"><Users className="h-3.5 w-3.5 mr-1" /><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Equipe</SelectItem>
                  {reps.map((r) => (<SelectItem key={r.id} value={r.id}>{r.nome}</SelectItem>))}
                </SelectContent>
              </Select>
              <Select value={String(filterYear)} onValueChange={(v) => setFilterYear(Number(v))}>
                <SelectTrigger className="w-24 text-xs h-8"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {[currentYear - 1, currentYear, currentYear + 1].map((y) => (<SelectItem key={y} value={String(y)}>{y}</SelectItem>))}
                </SelectContent>
              </Select>
              <Select value={String(filterMonth)} onValueChange={(v) => setFilterMonth(Number(v))}>
                <SelectTrigger className="w-24 text-xs h-8"><Calendar className="h-3.5 w-3.5 mr-1" /><SelectValue /></SelectTrigger>
                <SelectContent>
                  {MONTHS.map((m, i) => (<SelectItem key={i} value={String(i + 1)}>{m}</SelectItem>))}
                </SelectContent>
              </Select>
              <div className="ml-auto">
                <Button size="sm" onClick={() => { resetLostForm(); setLostFormOpen(true); }} className="gap-1.5">
                  <Plus className="h-4 w-4" /> Registrar Perda
                </Button>
              </div>
            </div>

            {/* KPI Summary */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <KpiCard icon={<XCircle className="h-5 w-5" />} label="Total Perdidas" value={String(total)} color="text-destructive" />
              <KpiCard icon={<AlertTriangle className="h-5 w-5" />} label="Valor Perdido" value={totalValor >= 1000 ? `R$ ${(totalValor / 1000).toFixed(0)}k` : formatBrlFull(totalValor)} color="text-destructive" />
              <KpiCard icon={<Users className="h-5 w-5" />} label="Reps Envolvidos" value={String(Object.keys(byRep).length)} color="text-muted-foreground" />
              <KpiCard icon={<Flag className="h-5 w-5" />} label="Motivos Distintos" value={String(Object.keys(byMotivo).length)} color="text-muted-foreground" />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* Por Representante */}
              <Card className="p-4">
                <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
                  <Users className="h-4 w-4 text-primary" /> Por Representante
                </h3>
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50">
                      <TableHead className="font-semibold">Representante</TableHead>
                      <TableHead className="text-center font-semibold w-20">Qtd</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {repData.map(r => (
                      <TableRow key={r.nome}>
                        <TableCell className="font-medium">{r.nome}</TableCell>
                        <TableCell className="text-center font-bold">{r.count}</TableCell>
                      </TableRow>
                    ))}
                    <TableRow className="bg-muted/30 font-bold">
                      <TableCell>Total</TableCell>
                      <TableCell className="text-center font-bold">{total}</TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </Card>

              {/* Motivo da Perda */}
              <Card className="p-4">
                <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-destructive" /> Motivo da Perda
                </h3>
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50">
                      <TableHead className="font-semibold">Motivo</TableHead>
                      <TableHead className="text-center font-semibold w-16">Qtd</TableHead>
                      <TableHead className="text-right font-semibold w-16">%</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {motivoData.map(m => (
                      <TableRow key={m.motivo}>
                        <TableCell className="font-medium text-sm">{m.motivo}</TableCell>
                        <TableCell className="text-center">{m.count}</TableCell>
                        <TableCell className="text-right">{m.pct.toFixed(1)}%</TableCell>
                      </TableRow>
                    ))}
                    <TableRow className="bg-muted/30 font-bold">
                      <TableCell>Total</TableCell>
                      <TableCell className="text-center font-bold">{total}</TableCell>
                      <TableCell className="text-right font-bold">100%</TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </Card>
            </div>

            {/* Motivo Chart */}
            {motivoData.length > 0 && (
              <Card className="p-4 sm:p-6">
                <h3 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
                  <BarChart3 className="h-4 w-4 text-destructive" /> Motivos de Perda
                </h3>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={motivoData} layout="vertical" margin={{ top: 5, right: 30, left: 10, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                    <YAxis dataKey="motivo" type="category" width={180} tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />
                    <Tooltip contentStyle={{ borderRadius: 8, border: "1px solid hsl(var(--border))", background: "hsl(var(--card))" }} formatter={(v: number) => [v, "Qtd"]} />
                    <Bar dataKey="count" name="Qtd" fill="hsl(var(--destructive))" radius={[0, 6, 6, 0]} maxBarSize={32} />
                  </BarChart>
                </ResponsiveContainer>
              </Card>
            )}

            {/* Submotivo */}
            {submotivoData.length > 0 && submotivoData[0].submotivo !== "Não informado" && (
              <Card className="p-4">
                <h3 className="text-sm font-semibold text-foreground mb-3">Submotivo da Perda</h3>
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50">
                      <TableHead className="font-semibold">Submotivo</TableHead>
                      <TableHead className="text-center font-semibold w-16">Qtd</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {submotivoData.map(s => (
                      <TableRow key={s.submotivo}>
                        <TableCell className="font-medium text-sm">{s.submotivo}</TableCell>
                        <TableCell className="text-center">{s.count}</TableCell>
                      </TableRow>
                    ))}
                    <TableRow className="bg-muted/30 font-bold">
                      <TableCell>Total</TableCell>
                      <TableCell className="text-center font-bold">{total}</TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </Card>
            )}

            {/* Detail Table */}
            <Card className="p-4 overflow-hidden">
              <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
                <XCircle className="h-4 w-4 text-destructive" /> Detalhamento
              </h3>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50">
                      <TableHead className="font-semibold">Data</TableHead>
                      <TableHead className="font-semibold">Cliente</TableHead>
                      <TableHead className="font-semibold">Máquina</TableHead>
                      <TableHead className="font-semibold">Rep</TableHead>
                      <TableHead className="font-semibold">Motivo</TableHead>
                      <TableHead className="text-center font-semibold w-14">Qtd</TableHead>
                      <TableHead className="w-20" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.map(d => (
                      <TableRow key={d.id}>
                        <TableCell className="text-sm whitespace-nowrap">{formatDate(d.data_perda)}</TableCell>
                        <TableCell className="text-sm font-medium">{d.client_name}</TableCell>
                        <TableCell className="text-sm">{d.machine_type ? `${d.machine_type} — ` : ""}{d.machine_name}</TableCell>
                        <TableCell className="text-sm">{reps.find(r => r.id === d.representative_id)?.nome || "—"}</TableCell>
                        <TableCell className="text-sm">{d.motivo_perda || "—"}</TableCell>
                        <TableCell className="text-sm text-center font-mono">{(d as any).quantidade || 1}</TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEditLost(d)}>
                              <Edit2 className="h-3.5 w-3.5" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => handleDeleteLost(d.id)}>
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                    {filtered.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center text-muted-foreground py-8">Nenhuma negociação perdida no período.</TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </Card>

            {/* Dialog Form */}
            <Dialog open={lostFormOpen} onOpenChange={(open) => { if (!open) { resetLostForm(); } setLostFormOpen(open); }}>
              <DialogContent className="max-w-lg">
                <DialogHeader>
                  <DialogTitle>{editingLostId ? "Editar" : "Registrar"} Negociação Perdida</DialogTitle>
                </DialogHeader>
                <div className="grid gap-4 py-2">
                  <div>
                    <Label className="text-xs">Mês da Perda *</Label>
                    <Input type="month" value={lostForm.data_perda.slice(0, 7)} onChange={e => setLostForm(f => ({ ...f, data_perda: e.target.value + "-01" }))} />
                  </div>
                  <div>
                    <Label className="text-xs">Representante *</Label>
                    <Select value={lostForm.representative_id} onValueChange={v => setLostForm(f => ({ ...f, representative_id: v }))}>
                      <SelectTrigger className="h-9"><SelectValue placeholder="Selecione" /></SelectTrigger>
                      <SelectContent>
                        {reps.map(r => <SelectItem key={r.id} value={r.id}>{r.nome}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-xs">Motivo da Perda *</Label>
                    {addingCustomMotivo ? (
                      <div className="flex gap-1">
                        <Input value={customMotivo} onChange={e => setCustomMotivo(e.target.value)} placeholder="Novo motivo" className="h-9" autoFocus />
                        <Button size="sm" className="h-9 px-2" onClick={() => {
                          const novoMotivo = customMotivo.trim();
                          if (novoMotivo) {
                            setCustomMotivos(prev => prev.includes(novoMotivo) ? prev : [...prev, novoMotivo]);
                            setLostForm(f => ({ ...f, motivo_perda: novoMotivo }));
                            setCustomMotivo("");
                            setAddingCustomMotivo(false);
                          }
                        }}>OK</Button>
                        <Button size="sm" variant="ghost" className="h-9 px-2" onClick={() => { setAddingCustomMotivo(false); setCustomMotivo(""); }}>✕</Button>
                      </div>
                    ) : (
                      <Select value={lostForm.motivo_perda} onValueChange={v => {
                        if (v === "__novo__") { setAddingCustomMotivo(true); } else { setLostForm(f => ({ ...f, motivo_perda: v })); }
                      }}>
                        <SelectTrigger className="h-9"><SelectValue placeholder="Selecione" /></SelectTrigger>
                        <SelectContent>
                          {MOTIVOS_PERDA.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                          <SelectItem value="__novo__" className="text-primary font-medium">+ Adicionar novo motivo</SelectItem>
                        </SelectContent>
                      </Select>
                    )}
                  </div>
                  <div>
                    <Label className="text-xs">Quantidade *</Label>
                    <Input type="number" min={1} value={lostForm.quantidade} onChange={e => setLostForm(f => ({ ...f, quantidade: Math.max(1, parseInt(e.target.value) || 1) }))} className="h-9" />
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => { resetLostForm(); setLostFormOpen(false); }}>Cancelar</Button>
                  <Button onClick={handleSaveLost} disabled={savingLost}>
                    {savingLost ? "Salvando..." : editingLostId ? "Atualizar" : "Registrar"}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </>
        );
      })()}
    </div>
  );
};

const KpiCard = ({ icon, label, value, color }: { icon: React.ReactNode; label: string; value: string; color: string }) => (
  <Card className="p-4">
    <div className="flex items-center gap-2 mb-1">
      <span className={color}>{icon}</span>
      <span className="text-xs text-muted-foreground font-medium">{label}</span>
    </div>
    <p className={`text-2xl font-bold ${color}`}>{value}</p>
  </Card>
);

export default RepKPIs;
