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
import { Eye, Users, Target, TrendingUp, Save, Calendar, BarChart3, Lightbulb, Flag, Filter } from "lucide-react";
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell, ReferenceLine } from "recharts";

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
  const [subTab, setSubTab] = useState<"visitas" | "oportunidades" | "metas">("visitas");
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
  const [goals, setGoals] = useState<{ representative_id: string; nome: string; meta_valor: number; meta_quantidade: number }[]>([]);
  const [savingGoals, setSavingGoals] = useState(false);

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

  // Load monthly goals
  useEffect(() => {
    if (!reps.length) return;
    const load = async () => {
      const { data } = await supabase
        .from("monthly_goals")
        .select("representative_id, meta_valor, meta_quantidade")
        .eq("user_id", userId)
        .eq("ano", filterYear)
        .eq("mes", filterMonth)
        .eq("machine_type", "all");

      const rows = reps.map((r) => {
        const existing = (data || []).find((d: any) => d.representative_id === r.id);
        return {
          representative_id: r.id,
          nome: r.nome,
          meta_valor: existing?.meta_valor ?? 0,
          meta_quantidade: existing?.meta_quantidade ?? 0,
        };
      });
      setGoals(rows);
    };
    load();
  }, [reps, filterYear, filterMonth, userId]);

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
    visits.map((v) => ({
      nome: v.nome.split(" ").slice(0, 2).join(" "),
      quantidade: v.quantidade,
      meta: v.meta,
    })),
    [visits]
  );

  // Week options (1-52)
  const weekOptions = useMemo(() => {
    const maxWeek = filterYear === currentYear ? currentWeek : 52;
    return Array.from({ length: maxWeek }, (_, i) => i + 1);
  }, [filterYear]);

  // Opportunities KPIs
  const oppKpis = useMemo(() => {
    const totalProprias = opportunities.reduce((s, o) => s + o.qty_proprias, 0);
    const totalSdr = opportunities.reduce((s, o) => s + o.qty_sdr, 0);
    const totalAberto = totalProprias + totalSdr;
    const pctProprias = totalAberto > 0 ? (totalProprias / totalAberto) * 100 : 0;
    return { totalAberto, totalProprias, totalSdr, pctProprias };
  }, [opportunities]);

  const oppChartData = useMemo(() =>
    opportunities
      .filter((o) => o.qty_proprias + o.qty_sdr > 0)
      .map((o) => ({
        nome: o.nome.split(" ").slice(0, 2).join(" "),
        proprias: o.qty_proprias,
        sdr: o.qty_sdr,
      })),
    [opportunities]
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

  const handleGoalChange = useCallback((repId: string, field: "meta_valor" | "meta_quantidade", value: string) => {
    const num = Math.max(0, parseFloat(value) || 0);
    setGoals((prev) => prev.map((g) => (g.representative_id === repId ? { ...g, [field]: num } : g)));
  }, []);

  const handleSaveGoals = async () => {
    setSavingGoals(true);
    try {
      for (const row of goals) {
        const { error } = await supabase
          .from("monthly_goals")
          .upsert(
            {
              user_id: userId,
              representative_id: row.representative_id,
              ano: filterYear,
              mes: filterMonth,
              meta_valor: row.meta_valor,
              meta_quantidade: row.meta_quantidade,
              machine_type: "all",
            },
            { onConflict: "representative_id,mes,ano,machine_type" }
          );
        if (error) throw error;
      }
      toast.success("Metas salvas com sucesso!");
    } catch (e: any) {
      toast.error("Erro ao salvar: " + e.message);
    } finally {
      setSavingGoals(false);
    }
  };

  const MONTHS = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];

  const goalsKpis = useMemo(() => {
    const totalValor = goals.reduce((s, g) => s + g.meta_valor, 0);
    const totalQtd = goals.reduce((s, g) => s + g.meta_quantidade, 0);
    const repsComMeta = goals.filter((g) => g.meta_valor > 0 || g.meta_quantidade > 0).length;
    return { totalValor, totalQtd, repsComMeta };
  }, [goals]);

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
            {visits.map((row) => {
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
              {opportunities.map((row) => {
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
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          <KpiCard icon={<Flag className="h-5 w-5" />} label="Meta Valor Total" value={`R$ ${formatBrl(goalsKpis.totalValor)}`} color="text-primary" />
          <KpiCard icon={<Target className="h-5 w-5" />} label="Meta Qtd Total" value={String(goalsKpis.totalQtd)} color="text-primary" />
          <KpiCard icon={<Users className="h-5 w-5" />} label="Reps com Meta" value={`${goalsKpis.repsComMeta}/${goals.length}`} color="text-muted-foreground" />
        </div>

        {/* Goals Table */}
        <Card className="overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead className="font-semibold">Representante</TableHead>
                <TableHead className="text-center font-semibold w-40">Meta Valor (R$)</TableHead>
                <TableHead className="text-center font-semibold w-36">Meta Quantidade</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {goals.map((row) => (
                <TableRow key={row.representative_id}>
                  <TableCell className="font-medium">{row.nome}</TableCell>
                  <TableCell className="text-center">
                    <Input type="number" min={0} className="w-28 mx-auto text-center h-9" value={row.meta_valor || ""} onChange={(e) => handleGoalChange(row.representative_id, "meta_valor", e.target.value)} placeholder="0" />
                  </TableCell>
                  <TableCell className="text-center">
                    <Input type="number" min={0} className="w-20 mx-auto text-center h-9" value={row.meta_quantidade || ""} onChange={(e) => handleGoalChange(row.representative_id, "meta_quantidade", e.target.value)} placeholder="0" />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>

        {/* Save Goals button */}
        {goals.length > 0 && (
          <div className="flex justify-end">
            <Button onClick={handleSaveGoals} disabled={savingGoals} size="lg">
              <Save className="h-4 w-4 mr-2" />
              {savingGoals ? "Salvando..." : "Salvar Metas"}
            </Button>
          </div>
        )}
      </>)}
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
