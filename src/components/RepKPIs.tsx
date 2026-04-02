import { useState, useEffect, useMemo, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import { Eye, Users, Target, TrendingUp, Save, Calendar, BarChart3, Lightbulb, Flag, Filter, Activity } from "lucide-react";
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell, ReferenceLine, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar } from "recharts";

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
  const [subTab, setSubTab] = useState<"visitas" | "oportunidades" | "metas" | "desempenho">("visitas");
  const [filterRep, setFilterRep] = useState<string>("all");
  const [reps, setReps] = useState<Rep[]>([]);
  const [filterYear, setFilterYear] = useState(currentYear);
  const [filterWeek, setFilterWeek] = useState(currentWeek);
  const [periodMode, setPeriodMode] = useState<PeriodMode>("semana");
  const [filterMonth, setFilterMonth] = useState(new Date().getMonth() + 1);
  const [filterQuarter, setFilterQuarter] = useState<string>(`T${Math.ceil((new Date().getMonth() + 1) / 3)}`);
  const [visits, setVisits] = useState<VisitRow[]>([]);
  const [saving, setSaving] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [weeklyHistory, setWeeklyHistory] = useState<{ semana: number; total: number; meta: number }[]>([]);
  const [opportunities, setOpportunities] = useState<{ representative_id: string; nome: string; qty_proprias: number; qty_sdr: number }[]>([]);
  const [savingOpp, setSavingOpp] = useState(false);
  const [goals, setGoals] = useState<{ representative_id: string; nome: string; meta_quantidade: number; byType: Record<string, number> }[]>([]);
  const [allYearVisits, setAllYearVisits] = useState<{ representative_id: string; semana: number; quantidade: number; meta: number }[]>([]);
  const [allYearOpps, setAllYearOpps] = useState<{ representative_id: string; semana: number; qty_proprias: number; qty_sdr: number }[]>([]);
  const [allYearGoals, setAllYearGoals] = useState<{ representative_id: string; mes: number; meta_quantidade: number; machine_type: string }[]>([]);


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

  // Load weekly opportunities for selected week
  useEffect(() => {
    if (!reps.length) return;
    const load = async () => {
      const { data } = await supabase
        .from("weekly_opportunities")
        .select("representative_id, qty_proprias, qty_sdr")
        .eq("user_id", userId)
        .eq("ano", filterYear)
        .eq("semana", filterWeek);

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
  }, [reps, filterYear, filterWeek, userId]);

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

  // Load ALL year data for Desempenho aggregation
  useEffect(() => {
    if (!reps.length) return;
    const load = async () => {
      const [visRes, oppRes, goalRes] = await Promise.all([
        supabase.from("weekly_visits").select("representative_id, semana, quantidade, meta").eq("user_id", userId).eq("ano", filterYear),
        supabase.from("weekly_opportunities").select("representative_id, semana, qty_proprias, qty_sdr").eq("user_id", userId).eq("ano", filterYear),
        supabase.from("monthly_goals").select("representative_id, mes, meta_quantidade, machine_type").eq("user_id", userId).eq("ano", filterYear),
      ]);
      setAllYearVisits(visRes.data || []);
      setAllYearOpps(oppRes.data || []);
      setAllYearGoals(goalRes.data || []);
    };
    load();
  }, [reps, filterYear, userId]);

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
          .from("weekly_opportunities")
          .upsert(
            {
              user_id: userId,
              representative_id: row.representative_id,
              ano: filterYear,
              semana: filterWeek,
              qty_proprias: row.qty_proprias,
              qty_sdr: row.qty_sdr,
            },
            { onConflict: "user_id,representative_id,ano,semana" }
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

  const formatBrl = (v: number) => v >= 1_000_000 ? `${(v / 1_000_000).toFixed(1)}M` : v >= 1_000 ? `${(v / 1_000).toFixed(0)}k` : String(v);

  return (
    <div className="space-y-6">
      {/* Top row: Period mode + Year/Week + Rep filter */}
      <div className="flex flex-col gap-3">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1 bg-secondary/50 rounded-full p-0.5">
              {(["semana", "mes", "trimestre", "ano"] as PeriodMode[]).map((mode) => {
                const labels: Record<PeriodMode, string> = { semana: "Semana", mes: "Mês", trimestre: "Trimestre", ano: "Ano" };
                return (
                  <button
                    key={mode}
                    onClick={() => setPeriodMode(mode)}
                    className={`px-3 py-1 rounded-full text-xs font-medium transition-all ${
                      periodMode === mode
                        ? "bg-primary text-primary-foreground shadow-sm"
                        : "bg-transparent text-muted-foreground hover:bg-secondary/80"
                    }`}
                  >
                    {labels[mode]}
                  </button>
                );
              })}
            </div>
            {periodMode === "trimestre" && (
              <div className="flex items-center gap-1 bg-secondary/50 rounded-full p-0.5">
                {["T1", "T2", "T3", "T4"].map((q) => (
                  <button
                    key={q}
                    onClick={() => setFilterQuarter(q)}
                    className={`px-3 py-1 rounded-full text-xs font-medium transition-all ${
                      filterQuarter === q
                        ? "bg-primary text-primary-foreground shadow-sm"
                        : "bg-transparent text-muted-foreground hover:bg-secondary/80"
                    }`}
                  >
                    {q}
                  </button>
                ))}
              </div>
            )}
            {periodMode === "mes" && (
              <div className="flex items-center gap-1 flex-wrap">
                {MONTHS.map((m, i) => (
                  <button
                    key={m}
                    onClick={() => setFilterMonth(i + 1)}
                    className={`px-3 py-1 rounded-full text-xs font-medium transition-all ${
                      filterMonth === i + 1
                        ? "bg-primary text-primary-foreground shadow-sm"
                        : "bg-transparent text-muted-foreground hover:bg-secondary/80"
                    }`}
                  >
                    {m}
                  </button>
                ))}
              </div>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Select value={filterRep} onValueChange={setFilterRep}>
              <SelectTrigger className="w-[140px] text-xs h-8">
                <Users className="h-3.5 w-3.5 mr-1" /><SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Equipe</SelectItem>
                {reps.map((r) => (
                  <SelectItem key={r.id} value={r.id}>{r.nome}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={String(filterYear)} onValueChange={(v) => setFilterYear(Number(v))}>
              <SelectTrigger className="w-24 text-xs h-8"><SelectValue /></SelectTrigger>
              <SelectContent>
                {[currentYear - 1, currentYear, currentYear + 1].map((y) => (
                  <SelectItem key={y} value={String(y)}>{y}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={String(filterWeek)} onValueChange={(v) => setFilterWeek(Number(v))}>
              <SelectTrigger className="w-36 text-xs h-8">
                <Calendar className="h-4 w-4 mr-1" /><SelectValue />
              </SelectTrigger>
              <SelectContent>
                {weekOptions.map((w) => (
                  <SelectItem key={w} value={String(w)}>Semana {w}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* Sub-tabs */}
      <div className="flex items-center gap-2">
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
          onClick={() => setSubTab("desempenho")}
          className={`px-4 py-2 rounded-full text-sm font-semibold transition-all ${subTab === "desempenho" ? "bg-primary text-primary-foreground shadow" : "bg-muted text-muted-foreground hover:bg-muted/80"}`}
        >
          <Activity className="inline h-4 w-4 mr-1.5 -mt-0.5" />
          Desempenho
        </button>
      </div>

      {/* ═══ VISITAS ═══ */}
      {subTab === "visitas" && (<>

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

        {/* Goals KPI Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <KpiCard icon={<Flag className="h-5 w-5" />} label="Meta Qtd Total" value={String(goalsKpis.totalQtd)} color="text-primary" />
          <KpiCard icon={<Users className="h-5 w-5" />} label="Reps com Meta" value={`${goalsKpis.repsComMeta}/${filteredGoals.length}`} color="text-muted-foreground" />
          {goalsKpis.byType.map(bt => (
            <KpiCard key={bt.type} icon={<Target className="h-5 w-5" />} label={bt.type} value={String(bt.total)} color="text-primary" />
          ))}
        </div>

        <p className="text-xs text-muted-foreground">As metas são cadastradas na aba Representantes e exibidas aqui por mês.</p>

        {/* Goals Table (read-only) */}
        <Card className="overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead className="font-semibold">Representante</TableHead>
                {MACHINE_TYPES.map(mt => (
                  <TableHead key={mt} className="text-center font-semibold w-28">{mt}</TableHead>
                ))}
                <TableHead className="text-center font-semibold w-24">Total</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredGoals.map((row) => (
                <TableRow key={row.representative_id}>
                  <TableCell className="font-medium">{row.nome}</TableCell>
                  {MACHINE_TYPES.map(mt => (
                    <TableCell key={mt} className="text-center font-medium">
                      {(row.byType[mt] || 0) > 0 ? row.byType[mt] : "—"}
                    </TableCell>
                  ))}
                  <TableCell className="text-center font-bold">
                    {row.meta_quantidade > 0 ? row.meta_quantidade : "—"}
                  </TableCell>
                </TableRow>
              ))}
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

            const repOpps = allYearOpps.filter(o => o.representative_id === r.id && uniqueWeeks.has(o.semana));
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
            const wO = allYearOpps.filter(o => o.semana === w && (filterRep === "all" || o.representative_id === filterRep));
            return { label: `S${w}`, visitas: wV.reduce((s, v) => s + v.quantidade, 0), meta: wV.reduce((s, v) => s + v.meta, 0), opp: wO.reduce((s, o) => s + o.qty_proprias + o.qty_sdr, 0) };
          });
        } else {
          const mList = periodMode === "trimestre" ? relevantMonths : Array.from({ length: 12 }, (_, i) => i + 1);
          evolutionData = mList.map(m => {
            const mWeekSet = new Set(getWeeksForMonth(m, filterYear));
            const mV = allYearVisits.filter(v => mWeekSet.has(v.semana) && (filterRep === "all" || v.representative_id === filterRep));
            const mO = allYearOpps.filter(o => mWeekSet.has(o.semana) && (filterRep === "all" || o.representative_id === filterRep));
            return { label: MONTHS[m - 1], visitas: mV.reduce((s, v) => s + v.quantidade, 0), meta: mV.reduce((s, v) => s + v.meta, 0), opp: mO.reduce((s, o) => s + o.qty_proprias + o.qty_sdr, 0) };
          });
        }

        const metaByType = MACHINE_TYPES.map(mt => ({
          type: mt, total: perfData.reduce((s, r) => s + (r.byType[mt] || 0), 0),
        }));

        return (
          <>
            {/* Period badge */}
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="text-xs px-3 py-1">
                <Calendar className="h-3 w-3 mr-1.5" />{periodLabel}
              </Badge>
              <Badge variant="secondary" className="text-xs">
                {filterRep === "all" ? "Equipe" : reps.find(r => r.id === filterRep)?.nome}
              </Badge>
            </div>

            {/* Summary KPIs */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <KpiCard icon={<Eye className="h-5 w-5" />} label="Visitas Realizadas" value={String(totalVisitas)} color="text-primary" />
              <KpiCard icon={<Lightbulb className="h-5 w-5" />} label="Oportunidades" value={String(totalOpp)} color="text-accent" />
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
                  <Lightbulb className="h-5 w-5 text-accent" />
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
                    <Bar dataKey="sdr" name="SDR / Interno" stackId="a" fill="hsl(var(--accent))" radius={[6, 6, 0, 0]} maxBarSize={40} />
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
        // Consolidate per-rep performance data
        const perfData = reps.map((r) => {
          const v = visits.find(x => x.representative_id === r.id);
          const o = opportunities.find(x => x.representative_id === r.id);
          const g = goals.find(x => x.representative_id === r.id);
          const visitasRealizadas = v?.quantidade ?? 0;
          const visitasMeta = v?.meta ?? 0;
          const pctVisitas = visitasMeta > 0 ? (visitasRealizadas / visitasMeta) * 100 : 0;
          const totalOpp = (o?.qty_proprias ?? 0) + (o?.qty_sdr ?? 0);
          const metaQtd = g?.meta_quantidade ?? 0;
          return {
            id: r.id,
            nome: r.nome,
            shortName: r.nome.split(" ").slice(0, 2).join(" "),
            visitasRealizadas,
            visitasMeta,
            pctVisitas,
            oppProprias: o?.qty_proprias ?? 0,
            oppSdr: o?.qty_sdr ?? 0,
            totalOpp,
            metaQtd,
          };
        }).filter(x => filterRep === "all" || x.id === filterRep);

        const totalVisitas = perfData.reduce((s, r) => s + r.visitasRealizadas, 0);
        const totalMeta = perfData.reduce((s, r) => s + r.visitasMeta, 0);
        const totalOpp = perfData.reduce((s, r) => s + r.totalOpp, 0);
        const totalMetaQtd = perfData.reduce((s, r) => s + r.metaQtd, 0);
        const pctGeral = totalMeta > 0 ? (totalVisitas / totalMeta) * 100 : 0;

        // Radar data for team overview
        const radarData = perfData.map(r => ({
          nome: r.shortName,
          visitas: r.pctVisitas,
          oportunidades: r.totalOpp * 10, // scale for visibility
          metas: r.metaQtd,
        }));

        // Comparative bar chart
        const compData = perfData.map(r => ({
          nome: r.shortName,
          visitas: r.visitasRealizadas,
          meta: r.visitasMeta,
          oportunidades: r.totalOpp,
          metaQtd: r.metaQtd,
        }));

        // Performance ranking sorted by % visitas
        const ranking = [...perfData].sort((a, b) => b.pctVisitas - a.pctVisitas);

        return (
          <>
            {/* Summary KPIs */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <KpiCard icon={<Eye className="h-5 w-5" />} label="Visitas Realizadas" value={String(totalVisitas)} color="text-primary" />
              <KpiCard icon={<Lightbulb className="h-5 w-5" />} label="Oportunidades Abertas" value={String(totalOpp)} color="text-green-500" />
              <KpiCard icon={<Flag className="h-5 w-5" />} label="Meta Qtd Máquinas" value={String(totalMetaQtd)} color="text-yellow-500" />
              <KpiCard icon={<TrendingUp className="h-5 w-5" />} label="% Ating. Visitas" value={`${pctGeral.toFixed(0)}%`} color={pctGeral >= 80 ? "text-green-500" : pctGeral >= 50 ? "text-yellow-500" : "text-destructive"} />
            </div>

            {/* Comparative: Visitas x Meta */}
            <Card className="p-4 sm:p-6">
              <div className="flex items-center gap-2 mb-4">
                <BarChart3 className="h-5 w-5 text-primary" />
                <h3 className="font-semibold text-foreground">Visitas vs Meta por Representante</h3>
              </div>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={compData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis dataKey="nome" tick={{ fontSize: 11 }} className="fill-muted-foreground" interval={0} angle={-25} textAnchor="end" height={60} />
                  <YAxis allowDecimals={false} className="fill-muted-foreground" tick={{ fontSize: 12 }} />
                  <Tooltip contentStyle={{ borderRadius: 8, border: "1px solid hsl(var(--border))", background: "hsl(var(--card))" }} />
                  <Legend />
                  <Bar dataKey="visitas" name="Visitas" fill="hsl(var(--primary))" radius={[6, 6, 0, 0]} maxBarSize={40} />
                  <Bar dataKey="meta" name="Meta" fill="hsl(var(--muted-foreground))" radius={[6, 6, 0, 0]} maxBarSize={40} opacity={0.5} />
                </BarChart>
              </ResponsiveContainer>
            </Card>

            {/* Oportunidades por Rep */}
            <Card className="p-4 sm:p-6">
              <div className="flex items-center gap-2 mb-4">
                <Lightbulb className="h-5 w-5 text-green-500" />
                <h3 className="font-semibold text-foreground">Oportunidades por Representante</h3>
              </div>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={compData.filter(c => c.oportunidades > 0)} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis dataKey="nome" tick={{ fontSize: 11 }} className="fill-muted-foreground" interval={0} angle={-25} textAnchor="end" height={60} />
                  <YAxis allowDecimals={false} className="fill-muted-foreground" tick={{ fontSize: 12 }} />
                  <Tooltip contentStyle={{ borderRadius: 8, border: "1px solid hsl(var(--border))", background: "hsl(var(--card))" }} />
                  <Legend />
                  <Bar dataKey="oportunidades" name="Oportunidades" fill="hsl(142 71% 45%)" radius={[6, 6, 0, 0]} maxBarSize={40} />
                </BarChart>
              </ResponsiveContainer>
            </Card>

            {/* Metas por Rep */}
            {perfData.some(r => r.metaQtd > 0) && (
              <Card className="p-4 sm:p-6">
                <div className="flex items-center gap-2 mb-4">
                  <Flag className="h-5 w-5 text-yellow-500" />
                  <h3 className="font-semibold text-foreground">Metas de Máquinas por Representante</h3>
                </div>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={compData.filter(c => c.metaQtd > 0)} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                    <XAxis dataKey="nome" tick={{ fontSize: 11 }} className="fill-muted-foreground" interval={0} angle={-25} textAnchor="end" height={60} />
                    <YAxis allowDecimals={false} className="fill-muted-foreground" tick={{ fontSize: 12 }} />
                    <Tooltip contentStyle={{ borderRadius: 8, border: "1px solid hsl(var(--border))", background: "hsl(var(--card))" }} />
                    <Bar dataKey="metaQtd" name="Meta Qtd" fill="hsl(48 96% 53%)" radius={[6, 6, 0, 0]} maxBarSize={40} />
                  </BarChart>
                </ResponsiveContainer>
              </Card>
            )}

            {/* Ranking de Desempenho */}
            <Card className="p-4 sm:p-6">
              <div className="flex items-center gap-2 mb-4">
                <Activity className="h-5 w-5 text-primary" />
                <h3 className="font-semibold text-foreground">Ranking de Desempenho</h3>
              </div>
              <div className="space-y-3">
                {ranking.map((row, i) => {
                  const color = row.pctVisitas >= 100 ? "bg-green-500" : row.pctVisitas >= 70 ? "bg-yellow-500" : "bg-destructive";
                  const textColor = row.pctVisitas >= 100 ? "text-green-600" : row.pctVisitas >= 70 ? "text-yellow-600" : "text-destructive";
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

            {/* Evolução Semanal */}
            {weeklyHistory.length > 1 && (
              <Card className="p-4 sm:p-6">
                <div className="flex items-center gap-2 mb-4">
                  <TrendingUp className="h-5 w-5 text-primary" />
                  <h3 className="font-semibold text-foreground">Evolução Semanal — Equipe {filterYear}</h3>
                </div>
                <ResponsiveContainer width="100%" height={260}>
                  <LineChart data={weeklyHistory} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                    <XAxis dataKey="semana" tickFormatter={(v) => `S${v}`} className="fill-muted-foreground" tick={{ fontSize: 11 }} />
                    <YAxis allowDecimals={false} className="fill-muted-foreground" tick={{ fontSize: 12 }} />
                    <Tooltip contentStyle={{ borderRadius: 8, border: "1px solid hsl(var(--border))", background: "hsl(var(--card))" }} labelFormatter={(v) => `Semana ${v}`} formatter={(value: number, name: string) => [value, name === "total" ? "Visitas" : "Meta"]} />
                    <Line type="monotone" dataKey="total" stroke="hsl(var(--primary))" strokeWidth={2.5} dot={{ r: 4 }} activeDot={{ r: 6 }} name="total" />
                    <Line type="monotone" dataKey="meta" stroke="hsl(var(--muted-foreground))" strokeWidth={1.5} strokeDasharray="5 5" dot={false} name="meta" />
                  </LineChart>
                </ResponsiveContainer>
              </Card>
            )}
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
