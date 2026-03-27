import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Target, Eye, TrendingUp, TrendingDown, XCircle, CheckCircle, BarChart3, Users } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, Legend } from "recharts";

interface Props { userId: string; }
interface Rep { id: string; nome: string; meta_mensal_padrao: number; meta_quantidade: number; }
interface Deal { id: string; representative_id: string | null; status: string; closed_at: string | null; base_price: number; dollar_rate: number; machine_type: string; }
interface ClosingDeal { id: string; representative_id: string | null; status: string; deal_value: number; start_date: string; stage: string; probability: string; }
interface Visit { representative_id: string; semana: number; quantidade: number; meta: number; }
interface MonthlyGoal { representative_id: string; mes: number; meta_valor: number; meta_quantidade: number; machine_type: string; }

const SHORT_MONTHS = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];
const formatBrl = (v: number) => `R$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
const formatPct = (v: number) => `${v.toFixed(1)}%`;

const RepKPIs = ({ userId }: Props) => {
  const [reps, setReps] = useState<Rep[]>([]);
  const [deals, setDeals] = useState<Deal[]>([]);
  const [closingDeals, setClosingDeals] = useState<ClosingDeal[]>([]);
  const [visits, setVisits] = useState<Visit[]>([]);
  const [goals, setGoals] = useState<MonthlyGoal[]>([]);
  const [loading, setLoading] = useState(true);
  const now = new Date();
  const [filterYear, setFilterYear] = useState(now.getFullYear());
  const [filterMonth, setFilterMonth] = useState(now.getMonth() + 1);

  useEffect(() => {
    const fetch = async () => {
      const [repsRes, dealsRes, closingRes, visitsRes, goalsRes] = await Promise.all([
        supabase.from("representatives" as any).select("id, nome, meta_mensal_padrao, meta_quantidade").eq("status", "ATIVO").order("nome"),
        supabase.from("deals" as any).select("id, representative_id, status, closed_at, base_price, dollar_rate, machine_type"),
        supabase.from("closing_deals" as any).select("id, representative_id, status, deal_value, start_date, stage, probability"),
        supabase.from("weekly_visits" as any).select("representative_id, semana, quantidade, meta").eq("ano", filterYear),
        supabase.from("monthly_goals" as any).select("representative_id, mes, meta_valor, meta_quantidade, machine_type").eq("ano", filterYear),
      ]);
      if (repsRes.data) setReps(repsRes.data as any);
      if (dealsRes.data) setDeals(dealsRes.data as any);
      if (closingRes.data) setClosingDeals(closingRes.data as any);
      if (visitsRes.data) setVisits(visitsRes.data as any);
      if (goalsRes.data) setGoals(goalsRes.data as any);
      setLoading(false);
    };
    fetch();
  }, [filterYear]);

  const repMetrics = useMemo(() => {
    return reps.map(rep => {
      // Visits
      const repVisits = visits.filter(v => v.representative_id === rep.id);
      const totalVisits = repVisits.reduce((s, v) => s + v.quantidade, 0);
      const totalVisitMeta = repVisits.reduce((s, v) => s + v.meta, 0);
      const visitPct = totalVisitMeta > 0 ? (totalVisits / totalVisitMeta) * 100 : 0;

      // Opportunities (active closing_deals)
      const activeOpps = closingDeals.filter(c => c.representative_id === rep.id && c.status === "ativa");
      const oppCount = activeOpps.length;
      const oppValue = activeOpps.reduce((s, c) => s + c.deal_value, 0);
      const weightedPipeline = activeOpps.reduce((s, c) => {
        const w = c.probability === "Alta" ? 0.8 : c.probability === "Média" ? 0.5 : 0.2;
        return s + c.deal_value * w;
      }, 0);

      // Lost deals
      const lost = closingDeals.filter(c => c.representative_id === rep.id && c.status === "perdida");
      const lostCount = lost.length;
      const lostValue = lost.reduce((s, c) => s + c.deal_value, 0);

      // Won deals
      const won = closingDeals.filter(c => c.representative_id === rep.id && c.status === "ganha");
      const wonCount = won.length;
      const totalDecided = wonCount + lostCount;
      const winRate = totalDecided > 0 ? (wonCount / totalDecided) * 100 : 0;

      // Closed deals (from deals table) for the filtered month
      const closedDeals = deals.filter(d => {
        if (d.representative_id !== rep.id || d.status !== "closed" || !d.closed_at) return false;
        const dt = new Date(d.closed_at);
        return dt.getFullYear() === filterYear && dt.getMonth() + 1 === filterMonth;
      });
      const closedCount = closedDeals.length;
      const closedFobBrl = closedDeals.reduce((s, d) => s + d.base_price * (d.dollar_rate || 0), 0);

      // Monthly goals
      const monthGoals = goals.filter(g => g.representative_id === rep.id && g.mes === filterMonth);
      const metaValor = monthGoals.reduce((s, g) => s + g.meta_valor, 0) || rep.meta_mensal_padrao;
      const metaQtd = monthGoals.reduce((s, g) => s + g.meta_quantidade, 0) || rep.meta_quantidade;
      const pctValor = metaValor > 0 ? (closedFobBrl / metaValor) * 100 : 0;
      const pctQtd = metaQtd > 0 ? (closedCount / metaQtd) * 100 : 0;

      // Year closed
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
    }).sort((a, b) => b.yearFobBrl - a.yearFobBrl);
  }, [reps, deals, closingDeals, visits, goals, filterYear, filterMonth]);

  // Chart data: meta vs realizado per rep for the month
  const chartData = useMemo(() => {
    return repMetrics.map(r => ({
      nome: r.nome.split(" ")[0],
      meta: r.metaValor,
      realizado: r.closedFobBrl,
    }));
  }, [repMetrics]);

  // Global KPIs
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

  if (loading) return <p className="text-muted-foreground text-center py-8">Carregando...</p>;

  const metaPct = globalKpis.totalMeta > 0 ? (globalKpis.totalRealized / globalKpis.totalMeta) * 100 : 0;

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <h2 className="font-heading text-base sm:text-lg md:text-xl font-bold text-foreground flex items-center gap-2">
          <BarChart3 className="h-4 w-4 sm:h-5 sm:w-5" /> KPIs de Performance
        </h2>
        <div className="flex items-center gap-2 flex-wrap">
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
          <Select value={String(filterMonth)} onValueChange={v => setFilterMonth(parseInt(v))}>
            <SelectTrigger className="w-[90px] bg-secondary/50 border-border text-xs h-8">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {SHORT_MONTHS.map((m, i) => (
                <SelectItem key={i} value={String(i + 1)}>{m}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Global KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <KpiCard icon={<Eye className="h-4 w-4" />} label="Visitas (Ano)" value={String(globalKpis.totalVisits)} color="bg-primary/10 text-primary" />
        <KpiCard icon={<Target className="h-4 w-4" />} label="Oportunidades Ativas" value={String(globalKpis.totalOpps)} sub={formatBrl(globalKpis.totalPipeline)} color="bg-accent/10 text-accent" />
        <KpiCard icon={<XCircle className="h-4 w-4" />} label="Perdidas" value={String(globalKpis.totalLost)} color="bg-destructive/10 text-destructive" />
        <KpiCard icon={<CheckCircle className="h-4 w-4" />} label="Win Rate" value={formatPct(globalKpis.globalWinRate)} sub={`${globalKpis.totalWon}W / ${globalKpis.totalLost}L`} color="bg-[hsl(var(--ca-blue))]/10 text-[hsl(var(--ca-blue))]" />
      </div>

      {/* Meta vs Realizado global */}
      <Card className="p-4 border-border bg-card">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-foreground">Meta vs Realizado — {SHORT_MONTHS[filterMonth - 1]}/{filterYear}</span>
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

      {/* Chart: Meta vs Realizado by Rep */}
      {chartData.length > 0 && (
        <Card className="p-4 border-border bg-card">
          <h3 className="text-sm font-semibold text-foreground mb-3">Meta vs Realizado por Representante</h3>
          <div className="h-[250px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} barGap={2}>
                <XAxis dataKey="nome" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                <YAxis tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} tickFormatter={v => v >= 1000000 ? `${(v/1000000).toFixed(1)}M` : v >= 1000 ? `${(v/1000).toFixed(0)}k` : v} />
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

      {/* Per-rep cards */}
      <div className="space-y-3">
        <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
          <Users className="h-4 w-4" /> Detalhamento por Representante
        </h3>
        {repMetrics.map(r => {
          const metaColor = r.pctValor >= 100 ? "text-accent" : r.pctValor >= 70 ? "text-foreground" : "text-destructive";
          return (
            <Card key={r.id} className="p-4 border-border bg-card">
              <div className="flex items-center justify-between mb-3">
                <h4 className="font-semibold text-sm text-foreground">{r.nome}</h4>
                <div className="flex gap-1.5">
                  {r.winRate >= 60 && <Badge variant="secondary" className="text-[10px]">🔥 Top Closer</Badge>}
                  {r.pctValor >= 100 && <Badge className="text-[10px] bg-accent text-accent-foreground">✅ Meta Batida</Badge>}
                  {r.lostCount > r.wonCount && r.lostCount > 0 && <Badge variant="destructive" className="text-[10px]">⚠️ Atenção</Badge>}
                </div>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                <MetricCell label="Visitas (Ano)" value={String(r.totalVisits)} sub={r.visitPct > 0 ? `${formatPct(r.visitPct)} da meta` : "—"} icon={<Eye className="h-3 w-3" />} />
                <MetricCell label="Oportunidades" value={String(r.oppCount)} sub={formatBrl(r.weightedPipeline) + " pond."} icon={<Target className="h-3 w-3" />} />
                <MetricCell label="Perdidas" value={String(r.lostCount)} sub={formatBrl(r.lostValue)} icon={<XCircle className="h-3 w-3 text-destructive" />} />
                <MetricCell label="Win Rate" value={formatPct(r.winRate)} sub={`${r.wonCount}W / ${r.lostCount}L`} icon={r.winRate >= 50 ? <TrendingUp className="h-3 w-3 text-accent" /> : <TrendingDown className="h-3 w-3 text-destructive" />} />
              </div>
              {/* Meta progress */}
              <div className="mt-3 space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">Meta Valor ({SHORT_MONTHS[filterMonth - 1]})</span>
                  <span className={`font-semibold ${metaColor}`}>{formatPct(r.pctValor)} — {formatBrl(r.closedFobBrl)} / {formatBrl(r.metaValor)}</span>
                </div>
                <Progress value={Math.min(r.pctValor, 100)} className="h-2" />
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">Meta Qtd ({SHORT_MONTHS[filterMonth - 1]})</span>
                  <span className="font-medium text-foreground">{r.closedCount} / {r.metaQtd} máq ({formatPct(r.pctQtd)})</span>
                </div>
                <Progress value={Math.min(r.pctQtd, 100)} className="h-2" />
              </div>
              {/* Year summary */}
              <div className="mt-2 flex gap-4 text-[11px] text-muted-foreground">
                <span>Ano: {r.yearCount} máq</span>
                <span>{formatBrl(r.yearFobBrl)} faturado</span>
              </div>
            </Card>
          );
        })}
      </div>
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
