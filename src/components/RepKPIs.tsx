import React, { useState, useEffect, useMemo, useCallback } from "react";
import FilterBar from "@/components/FilterBar";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import { Eye, Users, Target, TrendingUp, Save, Calendar, BarChart3, Lightbulb, Flag, Filter, Activity, XCircle, AlertTriangle, Plus, Trash2, Edit2, SlidersHorizontal, ChevronDown, FileSpreadsheet, Clock, FileDown } from "lucide-react";
import { exportOpportunitiesPdf, exportLostDealsPdf } from "@/lib/pdfExport";
import VisitImport from "@/components/VisitImport";
import LostDealImport from "@/components/LostDealImport";
import OpportunityImport from "@/components/OpportunityImport";
import GoalImport from "@/components/GoalImport";
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

const getWeeksForMonth = (month: number, year: number): number[] => {
  const weeks: number[] = [];
  const d = new Date(year, month - 1, 1);
  while (d.getMonth() === month - 1) {
    weeks.push(getWeekNumber(d));
    d.setDate(d.getDate() + 7);
  }
  return [...new Set(weeks)];
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
  const [lostDeals, setLostDeals] = useState<{ id: string; representative_id: string | null; client_name: string; machine_name: string; machine_type: string; deal_value: number; motivo_perda: string | null; motivo_perda_detalhe: string | null; data_perda: string; data_criacao: string | null; notes: string | null; created_at: string; updated_at: string }[]>([]);
  const [lostFormOpen, setLostFormOpen] = useState(false);
  const [editingLostId, setEditingLostId] = useState<string | null>(null);
  const [savingLost, setSavingLost] = useState(false);
  const [lostForm, setLostForm] = useState({
    representative_id: "",
    motivo_perda: "",
    data_perda: new Date().toISOString().slice(0, 10),
    quantidade: 1,
  });
  const [selRadar, setSelRadar] = useState<string[]>([]);
  const [lostFilterRep, setLostFilterRep] = useState<string | null>(null);
  const [lostFilterMotivo, setLostFilterMotivo] = useState<string | null>(null);
  const [lostFilterSubmotivo, setLostFilterSubmotivo] = useState<string | null>(null);
  const [visitImportOpen, setVisitImportOpen] = useState(false);
  const [lostImportOpen, setLostImportOpen] = useState(false);
  const [oppImportOpen, setOppImportOpen] = useState(false);
  const [metaImportOpen, setMetaImportOpen] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [importedVisits, setImportedVisits] = useState<{ id: string; data_visita: string; cliente: string; cnpj: string | null; assunto: string | null; descricao: string | null; representative_id: string }[]>([]);
  const [importedPage, setImportedPage] = useState(0);
  const IMPORTED_PAGE_SIZE = 20;

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
  }, [reps, filterYear, filterMonth, userId, refreshKey]);

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
  }, [reps, filterYear, filterMonth, userId, refreshKey]);

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

  // Load imported visit details
  const loadImportedVisits = useCallback(async () => {
    const { data } = await supabase
      .from("visitas_importadas" as any)
      .select("id, data_visita, cliente, cnpj, assunto, descricao, representative_id")
      .eq("user_id", userId)
      .order("data_visita", { ascending: false });
    setImportedVisits((data as any) || []);
    setImportedPage(0);
  }, [userId]);

  useEffect(() => { loadImportedVisits(); }, [loadImportedVisits]);

  // Refresh visit data after import — full reload
  const handleImported = useCallback(async () => {
    // Reload weekly_visits for ALL weeks of the year (source of truth)
    const { data: allVis } = await supabase
      .from("weekly_visits")
      .select("representative_id, semana, quantidade, meta")
      .eq("user_id", userId)
      .eq("ano", filterYear);
    setAllYearVisits(allVis || []);

    // Rebuild current week view from the full year data
    const currentWeekData = (allVis || []).filter((v) => v.semana === filterWeek);
    const rows: VisitRow[] = reps.map((r) => {
      const existing = currentWeekData.find((v) => v.representative_id === r.id);
      return { representative_id: r.id, nome: r.nome, meta: existing?.meta ?? DEFAULT_META, quantidade: existing?.quantidade ?? 0 };
    });
    setVisits(rows);

    // Reload imported visits detail
    await loadImportedVisits();

    // Check if imported weeks differ from current filter
    const weeksWithData = new Set((allVis || []).filter(v => v.quantidade > 0).map(v => v.semana));
    if (weeksWithData.size > 0 && !weeksWithData.has(filterWeek)) {
      const firstWeek = Math.min(...Array.from(weeksWithData));
      toast.info(`Visitas importadas encontradas na semana ${firstWeek}. Ajustando filtro...`);
      setFilterWeek(firstWeek);
    } else {
      toast.success("Dados de visitas atualizados");
    }

    // Bump refresh key for other dependent components
    setRefreshKey(k => k + 1);
  }, [userId, filterYear, filterWeek, reps, loadImportedVisits]);

  // Load lost deals from independent table
  const loadLostDeals = useCallback(async () => {
    const { data } = await supabase
      .from("negociacoes_perdidas" as any)
      .select("id, representative_id, client_name, machine_name, machine_type, deal_value, motivo_perda, motivo_perda_detalhe, data_perda, data_criacao, notes, quantidade, created_at, updated_at")
      .eq("user_id", userId)
      .order("data_perda", { ascending: false });
    setLostDeals((data as any) || []);
  }, [userId]);

  useEffect(() => { loadLostDeals(); }, [loadLostDeals]);

  // Initialize radar selection when reps load
  useEffect(() => {
    if (reps.length > 0 && selRadar.length === 0) {
      setSelRadar(reps.slice(0, 3).map(r => r.id));
    }
  }, [reps]);

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

  // Determine if we're in single-week edit mode (week selector visible & month mode)
  const isWeekEditMode = periodMode === "semana";

  // Shared: relevant months for current period mode
  const relevantMonths = useMemo(() => {
    if (periodMode === "trimestre") return QUARTER_MONTHS[filterQuarter] || [];
    if (periodMode === "ano") return [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
    return [filterMonth];
  }, [periodMode, filterQuarter, filterMonth]);

  const isMonthMode = periodMode === "mes" || periodMode === "semana";

  // Aggregated visits based on periodMode using allYearVisits
  const aggregatedVisits = useMemo(() => {
    // Only single-week mode uses the `visits` state directly
    if (periodMode === "semana") return null;
    let relevantWeeks: number[];
    if (periodMode === "mes") {
      relevantWeeks = getWeeksForMonth(filterMonth, filterYear);
    } else if (periodMode === "trimestre") {
      relevantWeeks = (QUARTER_MONTHS[filterQuarter] || []).flatMap(m => getWeeksForMonth(m, filterYear));
    } else {
      relevantWeeks = Array.from({ length: 52 }, (_, i) => i + 1);
    }
    const weekSet = new Set(relevantWeeks);
    const filtered = allYearVisits.filter(v => weekSet.has(v.semana));
    return reps.map(r => {
      const repRows = filtered.filter(v => v.representative_id === r.id);
      return {
        representative_id: r.id,
        nome: r.nome,
        meta: repRows.reduce((s, v) => s + v.meta, 0),
        quantidade: repRows.reduce((s, v) => s + v.quantidade, 0),
      };
    });
  }, [periodMode, filterMonth, filterQuarter, filterYear, allYearVisits, reps]);

  // Effective visits: aggregated for month/quarter/year, single-week for semana
  const effectiveVisits = useMemo(() => aggregatedVisits || visits, [aggregatedVisits, visits]);

  // Aggregated opportunities based on periodMode
  const effectiveOpportunities = useMemo(() => {
    if (isMonthMode) return opportunities;
    const monthSet = new Set(relevantMonths);
    return reps.map(r => {
      const repRows = allYearOpps.filter(o => o.representative_id === r.id && monthSet.has(o.mes));
      return {
        representative_id: r.id,
        nome: r.nome,
        qty_proprias: repRows.reduce((s, o) => s + (o.qty_proprias || 0), 0),
        qty_sdr: repRows.reduce((s, o) => s + (o.qty_sdr || 0), 0),
      };
    });
  }, [isMonthMode, relevantMonths, allYearOpps, reps, opportunities]);

  // Aggregated goals based on periodMode
  const effectiveGoals = useMemo(() => {
    if (isMonthMode) return goals;
    const monthSet = new Set(relevantMonths);
    return reps.map(r => {
      const repGoals = allYearGoals.filter(g => g.representative_id === r.id && monthSet.has(g.mes));
      const meta_quantidade = repGoals.reduce((s, g) => s + (g.meta_quantidade || 0), 0);
      const byType: Record<string, number> = {};
      repGoals.forEach(g => { if (g.machine_type && g.meta_quantidade > 0) byType[g.machine_type] = (byType[g.machine_type] || 0) + g.meta_quantidade; });
      return { representative_id: r.id, nome: r.nome, meta_quantidade, byType };
    });
  }, [isMonthMode, relevantMonths, allYearGoals, reps, goals]);

  // Aggregated closed deals for metas based on periodMode
  const effectiveClosedDeals = useMemo(() => {
    if (isMonthMode) return closedDealsForMetas;
    const monthSet = new Set(relevantMonths);
    return (allYearClosedDeals || []).filter(d => {
      if (!d.closed_at) return false;
      const m = new Date(d.closed_at).getMonth() + 1;
      return monthSet.has(m);
    });
  }, [isMonthMode, relevantMonths, allYearClosedDeals, closedDealsForMetas]);

  // Filtered data by rep
  const filteredVisits = useMemo(() => filterRep === "all" ? effectiveVisits : effectiveVisits.filter(v => v.representative_id === filterRep), [effectiveVisits, filterRep]);
  const filteredOpportunities = useMemo(() => filterRep === "all" ? effectiveOpportunities : effectiveOpportunities.filter(o => o.representative_id === filterRep), [effectiveOpportunities, filterRep]);
  const filteredGoals = useMemo(() => filterRep === "all" ? effectiveGoals : effectiveGoals.filter(g => g.representative_id === filterRep), [effectiveGoals, filterRep]);

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
    for (const d of effectiveClosedDeals) {
      const repId = d.representative_id || "__none__";
      if (!map[repId]) map[repId] = {};
      const mt = d.machine_type || "Outro";
      map[repId][mt] = (map[repId][mt] || 0) + 1;
    }
    return map;
  }, [effectiveClosedDeals]);

  const totalRealizadoQtd = useMemo(() => {
    if (filterRep === "all") return effectiveClosedDeals.length;
    return effectiveClosedDeals.filter(d => d.representative_id === filterRep).length;
  }, [effectiveClosedDeals, filterRep]);

  const formatBrl = (v: number) => v >= 1_000_000 ? `${(v / 1_000_000).toFixed(1)}M` : v >= 1_000 ? `${(v / 1_000).toFixed(0)}k` : String(v);




  return (
    <div className="space-y-6">
      {/* ═══ FILTRO GLOBAL ═══ */}
      <FilterBar
        year={filterYear}
        onYearChange={setFilterYear}
        periodMode={periodMode === "semana" ? "week" : periodMode === "mes" ? "month" : periodMode === "trimestre" ? "quarter" : "year"}
        onPeriodModeChange={(m) => {
          if (m === "month") setPeriodMode("mes");
          else if (m === "week") setPeriodMode("semana");
          else if (m === "quarter") setPeriodMode("trimestre");
          else setPeriodMode("ano");
        }}
        month={filterMonth}
        onMonthChange={setFilterMonth}
        quarter={filterQuarter}
        onQuarterChange={setFilterQuarter}
        showRep
        rep={filterRep}
        onRepChange={setFilterRep}
        reps={reps}
        showWeek={subTab === "visitas" && periodMode === "semana"}
        week={filterWeek}
        onWeekChange={setFilterWeek}
        maxWeek={52}
      />

      {/* Sub-tabs */}
      <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:items-center">
        <button
          onClick={() => setSubTab("desempenho")}
          className={`inline-flex min-h-11 w-full items-center justify-center whitespace-nowrap rounded-full px-4 py-2 text-sm font-semibold transition-all sm:min-h-0 sm:w-auto ${subTab === "desempenho" ? "bg-primary text-primary-foreground shadow" : "bg-muted text-muted-foreground hover:bg-muted/80"}`}
        >
          <Activity className="mr-1.5 h-4 w-4 shrink-0" />
          Desempenho
        </button>
        <button
          onClick={() => setSubTab("visitas")}
          className={`inline-flex min-h-11 w-full items-center justify-center whitespace-nowrap rounded-full px-4 py-2 text-sm font-semibold transition-all sm:min-h-0 sm:w-auto ${subTab === "visitas" ? "bg-primary text-primary-foreground shadow" : "bg-muted text-muted-foreground hover:bg-muted/80"}`}
        >
          <Eye className="mr-1.5 h-4 w-4 shrink-0" />
          Visitas
        </button>
        <button
          onClick={() => setSubTab("oportunidades")}
          className={`inline-flex min-h-11 w-full items-center justify-center whitespace-nowrap rounded-full px-4 py-2 text-sm font-semibold transition-all sm:min-h-0 sm:w-auto ${subTab === "oportunidades" ? "bg-primary text-primary-foreground shadow" : "bg-muted text-muted-foreground hover:bg-muted/80"}`}
        >
          <Lightbulb className="mr-1.5 h-4 w-4 shrink-0" />
          Oportunidades
        </button>
        <button
          onClick={() => setSubTab("metas")}
          className={`inline-flex min-h-11 w-full items-center justify-center whitespace-nowrap rounded-full px-4 py-2 text-sm font-semibold transition-all sm:min-h-0 sm:w-auto ${subTab === "metas" ? "bg-primary text-primary-foreground shadow" : "bg-muted text-muted-foreground hover:bg-muted/80"}`}
        >
          <Flag className="mr-1.5 h-4 w-4 shrink-0" />
          Metas
        </button>
        <button
          onClick={() => setSubTab("perdidas")}
          className={`col-span-2 inline-flex min-h-11 w-full items-center justify-center whitespace-nowrap rounded-full px-4 py-2 text-sm font-semibold transition-all sm:col-span-1 sm:min-h-0 sm:w-auto ${subTab === "perdidas" ? "bg-destructive text-destructive-foreground shadow" : "bg-muted text-muted-foreground hover:bg-muted/80"}`}
        >
          <XCircle className="mr-1.5 h-4 w-4 shrink-0" />
          Perdidas
        </button>
      </div>

      {/* ═══ VISITAS ═══ */}
      {subTab === "visitas" && (<>

      {/* Week selector for Visitas */}
      <div className="flex items-center gap-2 flex-wrap">
        <Button variant="outline" size="sm" className="h-8 text-xs" onClick={() => setVisitImportOpen(true)}>
          <FileSpreadsheet className="h-3.5 w-3.5 mr-1" /> Importar Planilha
        </Button>
        <Button variant="destructive" size="sm" className="h-8 text-xs" onClick={async () => {
          if (!confirm("Tem certeza que deseja excluir TODAS as visitas importadas? Esta ação não pode ser desfeita.")) return;
          const { error: e1 } = await supabase.from("visitas_importadas" as any).delete().eq("user_id", userId);
          const { error: e2 } = await supabase.from("weekly_visits").delete().eq("user_id", userId);
          if (e1 || e2) { toast.error("Erro ao excluir visitas"); return; }
          toast.success("Todas as visitas importadas e semanais foram excluídas");
          loadImportedVisits();
        }}>
          <Trash2 className="h-3.5 w-3.5 mr-1" /> Excluir Todas
        </Button>
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
                    {isWeekEditMode ? (
                      <Input
                        type="number"
                        min={0}
                        className="w-20 mx-auto text-center h-9"
                        value={row.quantidade || ""}
                        onChange={(e) => handleChange(row.representative_id, e.target.value)}
                        placeholder="0"
                      />
                    ) : (
                      <Badge variant="outline">{row.quantidade}</Badge>
                    )}
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
      {visits.length > 0 && isWeekEditMode && (
        <div className="flex justify-end">
          <Button onClick={handleSave} disabled={saving} size="lg">
            <Save className="h-4 w-4 mr-2" />
            {saving ? "Salvando..." : "Salvar Visitas"}
          </Button>
        </div>
      )}
      <VisitImport userId={userId} reps={reps} open={visitImportOpen} onClose={() => setVisitImportOpen(false)} onImported={handleImported} />

      {/* ═══ DETALHAMENTO DE VISITAS IMPORTADAS ═══ */}
      {importedVisits.length > 0 && (() => {
        const filtered = filterRep === "all" ? importedVisits : importedVisits.filter(v => v.representative_id === filterRep);
        const totalPages = Math.ceil(filtered.length / IMPORTED_PAGE_SIZE);
        const paged = filtered.slice(importedPage * IMPORTED_PAGE_SIZE, (importedPage + 1) * IMPORTED_PAGE_SIZE);
        return (
          <Card className="overflow-hidden">
            <div className="flex items-center justify-between px-4 pt-4 pb-2">
              <div className="flex items-center gap-2">
                <FileSpreadsheet className="h-5 w-5 text-primary" />
                <h3 className="font-semibold text-foreground">Detalhamento de Visitas Importadas</h3>
                <Badge variant="secondary" className="text-xs">{filtered.length} registros</Badge>
              </div>
            </div>
            <div className="overflow-auto max-h-[400px]">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead className="text-xs">Data</TableHead>
                    <TableHead className="text-xs">Cliente</TableHead>
                    <TableHead className="text-xs">CNPJ</TableHead>
                    <TableHead className="text-xs">Assunto</TableHead>
                    {filterRep === "all" && <TableHead className="text-xs">Representante</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paged.map((v) => (
                    <TableRow key={v.id}>
                      <TableCell className="text-xs whitespace-nowrap">{v.data_visita}</TableCell>
                      <TableCell className="text-xs font-medium">{v.cliente}</TableCell>
                      <TableCell className="text-xs">{v.cnpj || "—"}</TableCell>
                      <TableCell className="text-xs max-w-[200px] truncate">{v.assunto || "—"}</TableCell>
                      {filterRep === "all" && <TableCell className="text-xs">{reps.find(r => r.id === v.representative_id)?.nome || "—"}</TableCell>}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-2 py-2">
                <Button variant="ghost" size="sm" disabled={importedPage === 0} onClick={() => setImportedPage(p => p - 1)}>Anterior</Button>
                <span className="text-xs text-muted-foreground">{importedPage + 1} / {totalPages}</span>
                <Button variant="ghost" size="sm" disabled={importedPage >= totalPages - 1} onClick={() => setImportedPage(p => p + 1)}>Próximo</Button>
              </div>
            )}
          </Card>
        );
      })()}
      </>)}

      {/* ═══ OPORTUNIDADES ═══ */}
      {subTab === "oportunidades" && (<>
        <div className="flex items-center gap-2 flex-wrap">
          <Button variant="outline" size="sm" className="h-8 text-xs" onClick={() => setOppImportOpen(true)}>
            <FileSpreadsheet className="h-3.5 w-3.5 mr-1" /> Importar Planilha
          </Button>
        </div>
        <OpportunityImport userId={userId} reps={reps} open={oppImportOpen} onClose={() => setOppImportOpen(false)} onImported={() => setRefreshKey(k => k + 1)} />
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
                      {isMonthMode ? (
                        <Input type="number" min={0} className="w-20 mx-auto text-center h-9" value={row.qty_proprias || ""} onChange={(e) => handleOppChange(row.representative_id, "qty_proprias", e.target.value)} placeholder="0" />
                      ) : (
                        <Badge variant="outline">{row.qty_proprias}</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-center">
                      {isMonthMode ? (
                        <Input type="number" min={0} className="w-20 mx-auto text-center h-9" value={row.qty_sdr || ""} onChange={(e) => handleOppChange(row.representative_id, "qty_sdr", e.target.value)} placeholder="0" />
                      ) : (
                        <Badge variant="outline">{row.qty_sdr}</Badge>
                      )}
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
        {opportunities.length > 0 && isMonthMode && (
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
          <Button variant="outline" size="sm" className="h-8 text-xs" onClick={() => setMetaImportOpen(true)}>
            <FileSpreadsheet className="h-3.5 w-3.5 mr-1" /> Importar Planilha
          </Button>
        </div>
        <GoalImport userId={userId} reps={reps} open={metaImportOpen} onClose={() => setMetaImportOpen(false)} onImported={() => setRefreshKey(k => k + 1)} />
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

        // ── Management alerts computed from perfData ──
        const repsZeroVendas = perfData.filter(r => {
          const closed = allYearClosedDeals.filter(d => {
            if (d.representative_id !== r.id) return false;
            const dt = new Date(d.closed_at);
            if (dt.getFullYear() !== filterYear) return false;
            if (relevantMonths.length > 0) return relevantMonths.includes(dt.getMonth() + 1);
            return true;
          });
          return closed.length === 0;
        });
        const repsAbaixo50 = perfData.filter(r => {
          if (r.metaQtd <= 0) return false;
          const closed = allYearClosedDeals.filter(d => {
            if (d.representative_id !== r.id) return false;
            const dt = new Date(d.closed_at);
            if (dt.getFullYear() !== filterYear) return false;
            if (relevantMonths.length > 0) return relevantMonths.includes(dt.getMonth() + 1);
            return true;
          }).length;
          return closed < r.metaQtd * 0.5 && closed > 0;
        });
        const totalVendasFechadas = allYearClosedDeals.filter(d => {
          if (filterRep !== "all" && d.representative_id !== filterRep) return false;
          const dt = new Date(d.closed_at);
          if (dt.getFullYear() !== filterYear) return false;
          if (relevantMonths.length > 0) return relevantMonths.includes(dt.getMonth() + 1);
          return true;
        }).length;
        const taxaConversaoGeral = totalOpp > 0 ? (totalVendasFechadas / totalOpp) * 100 : 0;
        const melhorVendedor = (() => {
          let best: { nome: string; vendas: number } | null = null;
          for (const r of perfData) {
            const closed = allYearClosedDeals.filter(d => {
              if (d.representative_id !== r.id) return false;
              const dt = new Date(d.closed_at);
              if (dt.getFullYear() !== filterYear) return false;
              if (relevantMonths.length > 0) return relevantMonths.includes(dt.getMonth() + 1);
              return true;
            }).length;
            if (!best || closed > best.vendas) best = { nome: r.nome, vendas: closed };
          }
          return best;
        })();

        // ── Sales result metrics ──
        const pctMetaMaquinas = totalMetaQtd > 0 ? (totalVendasFechadas / totalMetaQtd) * 100 : 0;
        const faltamMaquinas = Math.max(0, totalMetaQtd - totalVendasFechadas);
        const statusLabel = pctMetaMaquinas >= 100 ? "Acima da meta" : pctMetaMaquinas >= 70 ? "No ritmo" : "Abaixo da meta";
        const statusColor = pctMetaMaquinas >= 100 ? "text-green-500" : pctMetaMaquinas >= 70 ? "text-yellow-500" : "text-destructive";
        const statusBg = pctMetaMaquinas >= 100 ? "bg-green-500" : pctMetaMaquinas >= 70 ? "bg-yellow-500" : "bg-destructive";
        const progressColor = pctMetaMaquinas >= 100 ? "from-green-500 to-green-400" : pctMetaMaquinas >= 70 ? "from-yellow-500 to-yellow-400" : "from-red-500 to-red-400";

        // Per-rep sales ranking
        const salesRanking = perfData.map(r => {
          const closed = allYearClosedDeals.filter(d => {
            if (d.representative_id !== r.id) return false;
            const dt = new Date(d.closed_at);
            if (dt.getFullYear() !== filterYear) return false;
            if (relevantMonths.length > 0) return relevantMonths.includes(dt.getMonth() + 1);
            return true;
          }).length;
          const pctRep = r.metaQtd > 0 ? (closed / r.metaQtd) * 100 : 0;
          return { ...r, vendas: closed, pctMeta: pctRep, faltam: Math.max(0, r.metaQtd - closed) };
        }).sort((a, b) => b.vendas - a.vendas);

        return (
          <>
            {/* ═══ RESULTADO COMERCIAL — MÁQUINAS ═══ */}
            <Card className="p-4 sm:p-6 border-l-4 border-l-primary bg-gradient-to-br from-primary/[0.05] to-transparent">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Target className="h-5 w-5 text-primary" />
                  <h3 className="font-heading text-base font-bold text-foreground">Resultado Comercial — Máquinas</h3>
                </div>
                <Badge className={`${statusColor} ${statusBg}/10 border-0 text-xs font-bold`}>{statusLabel}</Badge>
              </div>

              {/* Main KPI cards */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
                <div className="rounded-xl p-3 bg-card border border-border text-center">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1">Vendidas</p>
                  <p className="text-3xl font-black text-foreground">{totalVendasFechadas}</p>
                </div>
                <div className="rounded-xl p-3 bg-card border border-border text-center">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1">Meta</p>
                  <p className="text-3xl font-black text-muted-foreground">{totalMetaQtd}</p>
                </div>
                <div className="rounded-xl p-3 bg-card border border-border text-center">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1">% Atingido</p>
                  <p className={`text-3xl font-black ${statusColor}`}>{pctMetaMaquinas.toFixed(0)}%</p>
                </div>
                <div className="rounded-xl p-3 bg-card border border-border text-center">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1">Faltam</p>
                  <p className={`text-3xl font-black ${faltamMaquinas > 0 ? "text-destructive" : "text-green-500"}`}>{faltamMaquinas}</p>
                </div>
              </div>

              {/* Progress bar */}
              <div className="mb-3">
                <div className="relative h-3 w-full overflow-hidden rounded-full bg-secondary">
                  <div
                    className={`h-full rounded-full transition-all duration-700 bg-gradient-to-r ${progressColor}`}
                    style={{ width: `${Math.min(pctMetaMaquinas, 100)}%` }}
                  />
                </div>
                <div className="flex justify-between mt-1.5 text-[10px] text-muted-foreground">
                  <span>{totalVendasFechadas} de {totalMetaQtd} máquinas</span>
                  <span className={statusColor}>{statusLabel}</span>
                </div>
              </div>

              {/* Top/Bottom summary */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
                <div className="rounded-lg bg-secondary/50 px-3 py-2">
                  <span className="text-muted-foreground">🏆 Melhor: </span>
                  <span className="font-semibold text-foreground">{melhorVendedor?.nome?.split(" ")[0] || "—"} ({melhorVendedor?.vendas || 0})</span>
                </div>
                <div className="rounded-lg bg-secondary/50 px-3 py-2">
                  <span className="text-muted-foreground">📊 Total equipe: </span>
                  <span className="font-semibold text-foreground">{totalVendasFechadas} máquinas</span>
                </div>
                <div className="rounded-lg bg-secondary/50 px-3 py-2">
                  <span className="text-muted-foreground">🎯 Meta período: </span>
                  <span className="font-semibold text-foreground">{totalMetaQtd} máquinas</span>
                </div>
              </div>
            </Card>

            {/* ═══ RANKING POR VENDAS DE MÁQUINAS ═══ */}
            <Card className="p-4 sm:p-6">
              <div className="flex items-center gap-2 mb-4">
                <BarChart3 className="h-5 w-5 text-primary" />
                <h3 className="font-semibold text-foreground">Vendas vs Meta por Vendedor</h3>
              </div>
              <div className="space-y-2.5">
                {salesRanking.map((r, i) => {
                  const pctClamped = Math.min(r.pctMeta, 100);
                  const barColor = r.pctMeta >= 100 ? "from-green-500 to-green-400" : r.pctMeta >= 70 ? "from-yellow-500 to-yellow-400" : "from-red-500 to-red-400";
                  const textColor = r.pctMeta >= 100 ? "text-green-500" : r.pctMeta >= 70 ? "text-yellow-500" : "text-destructive";
                  const medal = i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `#${i + 1}`;
                  return (
                    <div key={r.id} className="flex items-center gap-2">
                      <span className="text-sm font-bold w-8">{medal}</span>
                      <span className="text-xs font-medium w-28 truncate">{r.shortName}</span>
                      <div className="flex-1 h-4 rounded-full bg-muted overflow-hidden">
                        <div className={`h-full rounded-full transition-all duration-500 bg-gradient-to-r ${barColor}`} style={{ width: `${pctClamped}%` }} />
                      </div>
                      <span className="text-xs font-bold w-12 text-right">{r.vendas}/{r.metaQtd}</span>
                      <span className={`text-xs font-bold w-12 text-right ${textColor}`}>{r.pctMeta.toFixed(0)}%</span>
                      {r.faltam > 0 && <span className="text-[10px] text-muted-foreground w-16 text-right">faltam {r.faltam}</span>}
                      {r.faltam === 0 && r.pctMeta >= 100 && <span className="text-[10px] text-green-500 w-16 text-right">✓ Meta</span>}
                    </div>
                  );
                })}
              </div>
            </Card>

            {/* ═══ RESUMO DE GESTÃO ═══ */}
            <Card className="p-4 sm:p-6 border-l-4 border-l-primary bg-primary/[0.03]">
              <div className="flex items-center gap-2 mb-4">
                <AlertTriangle className="h-5 w-5 text-primary" />
                <h3 className="font-heading text-base font-bold text-foreground">Resumo de Gestão do Período</h3>
                <Badge variant="outline" className="text-[10px] ml-auto">{periodLabel}</Badge>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                {/* Vendedores com 0 vendas */}
                <div className={`rounded-xl p-3 border ${repsZeroVendas.length > 0 ? "border-destructive/20 bg-destructive/[0.05]" : "border-green-500/20 bg-green-500/[0.05]"}`}>
                  <div className="flex items-center gap-2 mb-1">
                    <div className={`h-2 w-2 rounded-full ${repsZeroVendas.length > 0 ? "bg-destructive" : "bg-green-500"}`} />
                    <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Sem vendas</span>
                  </div>
                  <p className={`text-2xl font-black ${repsZeroVendas.length > 0 ? "text-destructive" : "text-green-500"}`}>{repsZeroVendas.length}</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">
                    {repsZeroVendas.length > 0 ? repsZeroVendas.slice(0, 2).map(r => r.nome.split(" ")[0]).join(", ") + (repsZeroVendas.length > 2 ? ` +${repsZeroVendas.length - 2}` : "") : "Todos venderam"}
                  </p>
                </div>
                {/* Abaixo de 50% */}
                <div className={`rounded-xl p-3 border ${repsAbaixo50.length > 0 ? "border-yellow-500/20 bg-yellow-500/[0.05]" : "border-green-500/20 bg-green-500/[0.05]"}`}>
                  <div className="flex items-center gap-2 mb-1">
                    <div className={`h-2 w-2 rounded-full ${repsAbaixo50.length > 0 ? "bg-yellow-500" : "bg-green-500"}`} />
                    <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{"< 50% da meta"}</span>
                  </div>
                  <p className={`text-2xl font-black ${repsAbaixo50.length > 0 ? "text-yellow-500" : "text-green-500"}`}>{repsAbaixo50.length}</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">
                    {repsAbaixo50.length > 0 ? repsAbaixo50.slice(0, 2).map(r => r.nome.split(" ")[0]).join(", ") + (repsAbaixo50.length > 2 ? ` +${repsAbaixo50.length - 2}` : "") : "Todos acima de 50%"}
                  </p>
                </div>
                {/* Taxa de conversão */}
                <div className={`rounded-xl p-3 border ${taxaConversaoGeral < 10 ? "border-destructive/20 bg-destructive/[0.05]" : taxaConversaoGeral < 25 ? "border-yellow-500/20 bg-yellow-500/[0.05]" : "border-green-500/20 bg-green-500/[0.05]"}`}>
                  <div className="flex items-center gap-2 mb-1">
                    <div className={`h-2 w-2 rounded-full ${taxaConversaoGeral < 10 ? "bg-destructive" : taxaConversaoGeral < 25 ? "bg-yellow-500" : "bg-green-500"}`} />
                    <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Conversão</span>
                  </div>
                  <p className={`text-2xl font-black ${taxaConversaoGeral < 10 ? "text-destructive" : taxaConversaoGeral < 25 ? "text-yellow-500" : "text-green-500"}`}>{taxaConversaoGeral.toFixed(1)}%</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">{totalVendasFechadas} vendas / {totalOpp} oportunidades</p>
                </div>
                {/* Melhor vendedor */}
                <div className="rounded-xl p-3 border border-green-500/20 bg-green-500/[0.05]">
                  <div className="flex items-center gap-2 mb-1">
                    <div className="h-2 w-2 rounded-full bg-green-500" />
                    <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Melhor vendedor</span>
                  </div>
                  <p className="text-lg font-black text-foreground truncate">{melhorVendedor?.nome || "—"}</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">{melhorVendedor ? `${melhorVendedor.vendas} vendas fechadas` : "Sem dados"}</p>
                </div>
              </div>
            </Card>

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
                      <Badge variant="outline" className={`text-[9px] px-1.5 py-0 ${row.pctVisitas >= 100 ? "border-green-500/30 text-green-500 bg-green-500/5" : row.pctVisitas >= 70 ? "border-yellow-500/30 text-yellow-500 bg-yellow-500/5" : "border-destructive/30 text-destructive bg-destructive/5"}`}>
                        {row.pctVisitas >= 100 ? "Acima" : row.pctVisitas >= 70 ? "No ritmo" : "Abaixo"}
                      </Badge>
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

                  {/* Alert if conversion is low */}
                  {totalVisitas > 0 && vendasFechadas > 0 && (vendasFechadas / totalVisitas) * 100 < 10 && (
                    <div className="mt-4 rounded-lg border border-destructive/20 bg-destructive/[0.05] p-3 flex items-center gap-2">
                      <AlertTriangle className="h-4 w-4 text-destructive shrink-0" />
                      <p className="text-xs font-medium text-destructive">Conversão abaixo do esperado — apenas {((vendasFechadas / totalVisitas) * 100).toFixed(1)}% das visitas resultaram em vendas</p>
                    </div>
                  )}

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

                  {/* Heatmap insights */}
                  {(() => {
                    const lowActivityWeeks = sortedWeeks.filter(w => {
                      const weekTotal = heatData.reduce((s, r) => s + (r.weeks[w] || 0), 0);
                      return weekTotal === 0;
                    });
                    const lowActivityReps = heatData.filter(r => {
                      const total = Object.values(r.weeks).reduce((s, v) => s + v, 0);
                      return total === 0;
                    });
                    if (lowActivityWeeks.length === 0 && lowActivityReps.length === 0) return null;
                    return (
                      <div className="mt-3 space-y-1.5">
                        {lowActivityWeeks.length > 0 && (
                          <div className="flex items-center gap-2 rounded-lg border border-yellow-500/20 bg-yellow-500/[0.05] px-3 py-2">
                            <AlertTriangle className="h-3.5 w-3.5 text-yellow-500 shrink-0" />
                            <p className="text-[11px] text-yellow-600 dark:text-yellow-400 font-medium">Baixa atividade na{lowActivityWeeks.length > 1 ? "s" : ""} semana{lowActivityWeeks.length > 1 ? "s" : ""} {lowActivityWeeks.slice(0, 3).map(w => `S${w}`).join(", ")}{lowActivityWeeks.length > 3 ? ` +${lowActivityWeeks.length - 3}` : ""}</p>
                          </div>
                        )}
                        {lowActivityReps.length > 0 && (
                          <div className="flex items-center gap-2 rounded-lg border border-destructive/20 bg-destructive/[0.05] px-3 py-2">
                            <AlertTriangle className="h-3.5 w-3.5 text-destructive shrink-0" />
                            <p className="text-[11px] text-destructive font-medium">{lowActivityReps.length} rep{lowActivityReps.length > 1 ? "s" : ""} sem nenhuma visita: {lowActivityReps.slice(0, 3).map(r => r.nome).join(", ")}</p>
                          </div>
                        )}
                      </div>
                    );
                  })()}
                </Card>
              );
            })()}

            {/* ── Radar de Performance ── */}
            {(() => {
              const RADAR_COLORS = ["hsl(var(--primary))", "hsl(var(--accent))", "#f59e0b", "#8b5cf6", "#ec4899", "#06b6d4"];
              const radarReps = perfData.map(r => {
                const closedCount = allYearClosedDeals.filter(d => {
                  if (d.representative_id !== r.id) return false;
                  const dt = new Date(d.closed_at);
                  if (dt.getFullYear() !== filterYear) return false;
                  if (relevantMonths.length > 0) return relevantMonths.includes(dt.getMonth() + 1);
                  return true;
                }).length;
                const conversion = r.totalOpp > 0 ? (closedCount / r.totalOpp) * 100 : 0;
                const pctMeta = r.metaQtd > 0 ? (closedCount / r.metaQtd) * 100 : 0;
                return { id: r.id, nome: r.shortName, visitas: r.visitasRealizadas, pctMeta, oportunidades: r.totalOpp, vendas: closedCount, conversao: conversion };
              });
              const maxMap: Record<string, number> = {
                visitas: Math.max(...radarReps.map(r => r.visitas), 1),
                pctMeta: Math.max(...radarReps.map(r => r.pctMeta), 1),
                oportunidades: Math.max(...radarReps.map(r => r.oportunidades), 1),
                vendas: Math.max(...radarReps.map(r => r.vendas), 1),
                conversao: Math.max(...radarReps.map(r => r.conversao), 1),
              };
              const axes = [
                { axis: "Visitas", key: "visitas" as const },
                { axis: "% Meta", key: "pctMeta" as const },
                { axis: "Oportunidades", key: "oportunidades" as const },
                { axis: "Vendas", key: "vendas" as const },
                { axis: "Conversão", key: "conversao" as const },
              ];
              const radarChartData = axes.map(a => {
                const entry: Record<string, any> = { axis: a.axis };
                radarReps.forEach(r => {
                  const raw = r[a.key] as number;
                  entry[r.id] = Math.round((raw / maxMap[a.key]) * 100);
                  entry[`${r.id}_raw`] = a.key === "pctMeta" || a.key === "conversao" ? `${raw.toFixed(0)}%` : String(raw);
                });
                return entry;
              });
              const defaultIds = radarReps.slice(0, 3).map(r => r.id);
              const toggleR = (id: string) => setSelRadar(p => p.includes(id) ? p.filter(x => x !== id) : [...p, id]);
              const vis = radarReps.filter(r => selRadar.includes(r.id));
              return (
                <Card className="p-4 sm:p-6">
                  <div className="flex items-center gap-2 mb-4">
                    <Activity className="h-5 w-5 text-primary" />
                    <h3 className="font-semibold text-foreground">Radar de Performance — {periodLabel}</h3>
                  </div>
                  <div className="flex flex-wrap gap-2 mb-4">
                    {radarReps.map(r => (
                      <button key={r.id} onClick={() => toggleR(r.id)} className={`px-3 py-1 rounded-full text-xs font-medium transition-all border ${selRadar.includes(r.id) ? "border-primary bg-primary/10 text-primary" : "border-border bg-muted text-muted-foreground hover:bg-muted/80"}`}>{r.nome}</button>
                    ))}
                  </div>
                  {vis.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-8">Selecione ao menos um representante.</p>
                  ) : (
                    <div className="w-full" style={{ height: 380 }}>
                      <ResponsiveContainer width="100%" height="100%">
                        <RadarChart data={radarChartData} outerRadius="75%">
                          <PolarGrid stroke="hsl(var(--border))" />
                          <PolarAngleAxis dataKey="axis" tick={{ fill: "hsl(var(--foreground))", fontSize: 12 }} />
                          <PolarRadiusAxis angle={90} domain={[0, 100]} tick={false} axisLine={false} />
                          {vis.map((r, i) => (
                            <Radar key={r.id} name={r.nome} dataKey={r.id} stroke={RADAR_COLORS[i % RADAR_COLORS.length]} fill={RADAR_COLORS[i % RADAR_COLORS.length]} fillOpacity={0.15} strokeWidth={2} />
                          ))}
                          <Legend />
                          <Tooltip content={({ payload, label }) => {
                            if (!payload?.length) return null;
                            return (
                              <div className="rounded-lg border bg-background p-2 text-xs shadow-xl">
                                <p className="font-semibold mb-1">{label}</p>
                                {payload.map((p: any) => {
                                  const rawVal = radarChartData.find(d => d.axis === label)?.[`${p.dataKey}_raw`] ?? p.value;
                                  return <p key={p.dataKey} style={{ color: p.stroke }}>{p.name}: {rawVal}</p>;
                                })}
                              </div>
                            );
                          }} />
                        </RadarChart>
                      </ResponsiveContainer>
                    </div>
                  )}
                </Card>
              );
            })()}
          </>
        );
      })()}

      {/* ═══ NEGOCIAÇÕES PERDIDAS ═══ */}
      {subTab === "perdidas" && (() => {
        const periodFiltered = lostDeals.filter(d => {
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

        const total = periodFiltered.reduce((s, d) => s + ((d as any).quantidade || 1), 0);
        const totalValor = periodFiltered.reduce((s, d) => s + (d.deal_value || 0), 0);

        // Tempo médio da negociação (dias entre data_criacao e data_perda)
        const dealsComTempo = periodFiltered.filter(d => d.data_criacao && d.data_perda);
        const tempoMedio = dealsComTempo.length > 0
          ? dealsComTempo.reduce((s, d) => {
              const inicio = new Date(d.data_criacao! + "T00:00:00");
              const fim = new Date(d.data_perda + "T00:00:00");
              return s + Math.max(0, (fim.getTime() - inicio.getTime()) / (1000 * 60 * 60 * 24));
            }, 0) / dealsComTempo.length
          : null;

        // Cross-filtered data for summary tables
        const crossFiltered = periodFiltered.filter(d => {
          if (lostFilterRep) {
            const repName = reps.find(r => r.id === d.representative_id)?.nome || "Sem Rep";
            if (repName !== lostFilterRep) return false;
          }
          if (lostFilterMotivo && (d.motivo_perda || "Não informado") !== lostFilterMotivo) return false;
          if (lostFilterSubmotivo && (d.motivo_perda_detalhe || "Não informado") !== lostFilterSubmotivo) return false;
          return true;
        });

        const byRep: Record<string, { repId: string | null; count: number }> = {};
        crossFiltered.forEach(d => {
          const repName = reps.find(r => r.id === d.representative_id)?.nome || "Sem Rep";
          if (!byRep[repName]) byRep[repName] = { repId: d.representative_id, count: 0 };
          byRep[repName].count += ((d as any).quantidade || 1);
        });
        const repData = Object.entries(byRep).sort((a, b) => b[1].count - a[1].count).map(([nome, v]) => ({ nome, count: v.count, repId: v.repId }));

        const byMotivo: Record<string, number> = {};
        crossFiltered.forEach(d => {
          const motivo = d.motivo_perda || "Não informado";
          byMotivo[motivo] = (byMotivo[motivo] || 0) + ((d as any).quantidade || 1);
        });
        const crossTotal = crossFiltered.reduce((s, d) => s + ((d as any).quantidade || 1), 0);
        const motivoData = Object.entries(byMotivo).sort((a, b) => b[1] - a[1]).map(([motivo, count]) => ({
          motivo, count, pct: crossTotal > 0 ? (count / crossTotal * 100) : 0,
        }));

        const bySubmotivo: Record<string, number> = {};
        crossFiltered.forEach(d => {
          const sub = d.motivo_perda_detalhe || "Não informado";
          bySubmotivo[sub] = (bySubmotivo[sub] || 0) + ((d as any).quantidade || 1);
        });
        const submotivoData = Object.entries(bySubmotivo).sort((a, b) => b[1] - a[1]).map(([submotivo, count]) => ({ submotivo, count }));

        // Apply interactive filters on detail
        const filtered = periodFiltered.filter(d => {
          if (lostFilterRep) {
            const repName = reps.find(r => r.id === d.representative_id)?.nome || "Sem Rep";
            if (repName !== lostFilterRep) return false;
          }
          if (lostFilterMotivo && (d.motivo_perda || "Não informado") !== lostFilterMotivo) return false;
          if (lostFilterSubmotivo && (d.motivo_perda_detalhe || "Não informado") !== lostFilterSubmotivo) return false;
          return true;
        });

        const hasActiveFilter = lostFilterRep || lostFilterMotivo || lostFilterSubmotivo;

        const formatBrlFull = (v: number) => `R$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
        const SHORT_MONTH_NAMES = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
        const formatDate = (d: string) => { const dt = new Date(d + "T00:00:00"); return `${SHORT_MONTH_NAMES[dt.getMonth()]} ${dt.getFullYear()}`; };
        const periodLabel = periodMode === "mes" ? `${MONTHS[filterMonth - 1]} ${filterYear}` : periodMode === "trimestre" ? `${filterQuarter} ${filterYear}` : `${filterYear}`;

        // Unique values for dropdowns
        const uniqueReps = [...new Set(periodFiltered.map(d => reps.find(r => r.id === d.representative_id)?.nome || "Sem Rep"))].sort();
        const uniqueMotivos = [...new Set(periodFiltered.map(d => d.motivo_perda || "Não informado"))].sort();
        const uniqueSubmotivos = [...new Set(periodFiltered.map(d => d.motivo_perda_detalhe || "Não informado"))].sort();

        return (
          <>
            {/* Action buttons for perdidas */}
            <div className="flex items-center gap-2 flex-wrap">
              <Button variant="outline" size="sm" onClick={() => setLostImportOpen(true)} className="gap-1.5">
                <FileSpreadsheet className="h-4 w-4" /> Importar Planilha
              </Button>
              <Button variant="destructive" size="sm" className="gap-1.5" onClick={async () => {
                if (!confirm("Tem certeza que deseja excluir TODAS as negociações perdidas? Esta ação não pode ser desfeita.")) return;
                const { error } = await supabase.from("negociacoes_perdidas" as any).delete().eq("user_id", userId);
                if (error) { toast.error("Erro ao excluir"); return; }
                toast.success("Todas as negociações perdidas foram excluídas");
                loadLostDeals();
              }}>
                <Trash2 className="h-4 w-4" /> Excluir Todas
              </Button>
              <Button size="sm" onClick={() => { resetLostForm(); setLostFormOpen(true); }} className="gap-1.5">
                <Plus className="h-4 w-4" /> Registrar Perda
              </Button>
            </div>

            {/* Tempo Médio KPI */}
            {tempoMedio !== null && (
              <Card className="p-4 flex items-center gap-4">
                <div className="p-2.5 rounded-lg bg-primary/10">
                  <Clock className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground font-medium">Tempo Médio da Negociação</p>
                  <p className="text-xl font-bold text-foreground">{Math.round(tempoMedio)} dias</p>
                  <p className="text-[10px] text-muted-foreground">{dealsComTempo.length} negociações com data de criação</p>
                </div>
              </Card>
            )}

            {/* Dropdown Filters */}
            <div className="flex items-center gap-3 flex-wrap">
              <div className="flex items-center gap-1.5">
                <SlidersHorizontal className="h-4 w-4 text-muted-foreground" />
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Filtros:</span>
              </div>
              <Select value={lostFilterRep || "__all__"} onValueChange={v => setLostFilterRep(v === "__all__" ? null : v)}>
                <SelectTrigger className="w-[180px] h-8 text-xs">
                  <SelectValue placeholder="Representante" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">Todos Representantes</SelectItem>
                  {uniqueReps.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={lostFilterMotivo || "__all__"} onValueChange={v => setLostFilterMotivo(v === "__all__" ? null : v)}>
                <SelectTrigger className="w-[200px] h-8 text-xs">
                  <SelectValue placeholder="Motivo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">Todos Motivos</SelectItem>
                  {uniqueMotivos.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={lostFilterSubmotivo || "__all__"} onValueChange={v => setLostFilterSubmotivo(v === "__all__" ? null : v)}>
                <SelectTrigger className="w-[200px] h-8 text-xs">
                  <SelectValue placeholder="Submotivo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">Todos Submotivos</SelectItem>
                  {uniqueSubmotivos.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                </SelectContent>
              </Select>
              {hasActiveFilter && (
                <Button variant="ghost" size="sm" className="h-8 text-xs text-muted-foreground gap-1" onClick={() => { setLostFilterRep(null); setLostFilterMotivo(null); setLostFilterSubmotivo(null); }}>
                  <XCircle className="h-3.5 w-3.5" /> Limpar
                </Button>
              )}
            </div>

            {/* Active Filter Badges */}
            {hasActiveFilter && (
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs text-muted-foreground font-medium flex items-center gap-1"><Filter className="h-3 w-3" /> Ativos:</span>
                {lostFilterRep && (
                  <Badge variant="secondary" className="gap-1 cursor-pointer hover:bg-destructive/10" onClick={() => setLostFilterRep(null)}>
                    <Users className="h-3 w-3" /> {lostFilterRep} <XCircle className="h-3 w-3 ml-0.5" />
                  </Badge>
                )}
                {lostFilterMotivo && (
                  <Badge variant="secondary" className="gap-1 cursor-pointer hover:bg-destructive/10" onClick={() => setLostFilterMotivo(null)}>
                    <AlertTriangle className="h-3 w-3" /> {lostFilterMotivo} <XCircle className="h-3 w-3 ml-0.5" />
                  </Badge>
                )}
                {lostFilterSubmotivo && (
                  <Badge variant="secondary" className="gap-1 cursor-pointer hover:bg-destructive/10" onClick={() => setLostFilterSubmotivo(null)}>
                    <Flag className="h-3 w-3" /> {lostFilterSubmotivo} <XCircle className="h-3 w-3 ml-0.5" />
                  </Badge>
                )}
              </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
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
                      <TableRow
                        key={r.nome}
                        className={`cursor-pointer transition-colors hover:bg-primary/5 ${lostFilterRep === r.nome ? "bg-primary/10 border-l-2 border-l-primary" : ""}`}
                        onClick={() => setLostFilterRep(prev => prev === r.nome ? null : r.nome)}
                      >
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
                      <TableRow
                        key={m.motivo}
                        className={`cursor-pointer transition-colors hover:bg-destructive/5 ${lostFilterMotivo === m.motivo ? "bg-destructive/10 border-l-2 border-l-destructive" : ""}`}
                        onClick={() => setLostFilterMotivo(prev => prev === m.motivo ? null : m.motivo)}
                      >
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

              {/* Submotivo da Perda */}
              <Card className="p-4">
                <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
                  <Flag className="h-4 w-4 text-accent" /> Submotivo
                </h3>
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50">
                      <TableHead className="font-semibold">Submotivo</TableHead>
                      <TableHead className="text-center font-semibold w-16">Qtd</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {submotivoData.length > 0 ? submotivoData.map(s => (
                      <TableRow
                        key={s.submotivo}
                        className={`cursor-pointer transition-colors hover:bg-accent/5 ${lostFilterSubmotivo === s.submotivo ? "bg-accent/10 border-l-2 border-l-accent" : ""}`}
                        onClick={() => setLostFilterSubmotivo(prev => prev === s.submotivo ? null : s.submotivo)}
                      >
                        <TableCell className="font-medium text-sm">{s.submotivo}</TableCell>
                        <TableCell className="text-center">{s.count}</TableCell>
                      </TableRow>
                    )) : (
                      <TableRow>
                        <TableCell colSpan={2} className="text-center text-muted-foreground text-xs py-4">Sem submotivos</TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </Card>
            </div>

            {/* Detail Table */}
            <Card className="p-4 overflow-hidden">
              <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
                <XCircle className="h-4 w-4 text-destructive" /> Detalhamento
              </h3>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50">
                      <TableHead className="font-semibold">Criação</TableHead>
                      <TableHead className="font-semibold">Fechamento</TableHead>
                      <TableHead className="font-semibold text-center">Tempo</TableHead>
                      <TableHead className="font-semibold">Cliente</TableHead>
                      <TableHead className="font-semibold">Máquina</TableHead>
                      <TableHead className="font-semibold">Rep</TableHead>
                      <TableHead className="font-semibold">Motivo</TableHead>
                      <TableHead className="text-center font-semibold w-14">Qtd</TableHead>
                      <TableHead className="w-20" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.map(d => {
                      const tempoDias = d.data_criacao && d.data_perda
                        ? Math.max(0, Math.round((new Date(d.data_perda + "T00:00:00").getTime() - new Date(d.data_criacao + "T00:00:00").getTime()) / (1000 * 60 * 60 * 24)))
                        : null;
                      return (
                      <TableRow key={d.id}>
                        <TableCell className="text-sm whitespace-nowrap text-muted-foreground">{d.data_criacao ? formatDate(d.data_criacao) : "—"}</TableCell>
                        <TableCell className="text-sm whitespace-nowrap">{formatDate(d.data_perda)}</TableCell>
                        <TableCell className="text-sm text-center font-mono">{tempoDias !== null ? `${tempoDias}d` : "—"}</TableCell>
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
                      );
                    })}

                    {filtered.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={9} className="text-center text-muted-foreground py-8">Nenhuma negociação perdida no período.</TableCell>
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
            <LostDealImport userId={userId} reps={reps} open={lostImportOpen} onClose={() => setLostImportOpen(false)} onImported={loadLostDeals} />
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
