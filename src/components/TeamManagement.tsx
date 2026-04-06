import React, { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import FilterBar from "@/components/FilterBar";
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  Eye,
  Lightbulb,
  Target,
  TrendingDown,
  TrendingUp,
  Users,
  XCircle,
  Zap,
} from "lucide-react";

interface Props {
  userId: string;
}

interface Rep {
  id: string;
  nome: string;
  meta_quantidade: number;
}

interface Deal {
  id: string;
  representative_id: string | null;
  status: string;
  closed_at: string | null;
  created_at: string;
  machine_type: string;
}

interface Goal {
  representative_id: string;
  mes: number;
  ano: number;
  meta_quantidade: number;
}

interface Opportunity {
  representative_id: string;
  mes: number;
  ano: number;
  quantidade: number;
}

interface Visit {
  representative_id: string;
  semana: number;
  ano: number;
  quantidade: number;
  meta: number;
}

interface ClosingDeal {
  id: string;
  representative_id: string | null;
  status: string;
}

const QUARTER_MONTHS: Record<string, number[]> = {
  T1: [1, 2, 3],
  T2: [4, 5, 6],
  T3: [7, 8, 9],
  T4: [10, 11, 12],
};

type PeriodMode = "month" | "quarter" | "year" | "week";

const TeamManagement = ({ userId }: Props) => {
  const [reps, setReps] = useState<Rep[]>([]);
  const [deals, setDeals] = useState<Deal[]>([]);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [visits, setVisits] = useState<Visit[]>([]);
  const [closingDeals, setClosingDeals] = useState<ClosingDeal[]>([]);
  const [loading, setLoading] = useState(true);

  const [filterYear, setFilterYear] = useState(new Date().getFullYear());
  const [filterMonth, setFilterMonth] = useState(new Date().getMonth() + 1);
  const [filterQuarter, setFilterQuarter] = useState(`T${Math.ceil((new Date().getMonth() + 1) / 3)}`);
  const [periodMode, setPeriodMode] = useState<PeriodMode>("month");
  const [filterRep, setFilterRep] = useState("all");

  const activeMonths = useMemo(() => {
    if (periodMode === "month") return [filterMonth];
    if (periodMode === "quarter") return QUARTER_MONTHS[filterQuarter] || [filterMonth];
    return [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
  }, [periodMode, filterMonth, filterQuarter]);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const [repsRes, dealsRes, goalsRes, oppsRes, visitsRes, closingRes] = await Promise.all([
        supabase.from("representatives").select("id, nome, meta_quantidade").eq("user_id", userId).eq("status", "ativo"),
        supabase.from("deals").select("id, representative_id, status, closed_at, created_at, machine_type").eq("user_id", userId),
        supabase.from("monthly_goals").select("representative_id, mes, ano, meta_quantidade").eq("user_id", userId),
        supabase.from("monthly_opportunities").select("representative_id, mes, ano, quantidade").eq("user_id", userId),
        supabase.from("weekly_visits").select("representative_id, semana, ano, quantidade, meta").eq("user_id", userId).eq("ano", filterYear),
        supabase.from("closing_deals").select("id, representative_id, status").eq("user_id", userId),
      ]);
      setReps((repsRes.data as Rep[]) || []);
      setDeals((dealsRes.data as Deal[]) || []);
      setGoals((goalsRes.data as Goal[]) || []);
      setOpportunities((oppsRes.data as Opportunity[]) || []);
      setVisits((visitsRes.data as Visit[]) || []);
      setClosingDeals((closingRes.data as ClosingDeal[]) || []);
      setLoading(false);
    };
    load();
  }, [userId, filterYear]);

  // Team-level meta fallback: 8 machines/month divided equally
  const TEAM_META_MONTHLY = 8;

  const repData = useMemo(() => {
    const now = new Date();
    const currentDay = now.getDate();
    const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    const daysInPeriod = daysInMonth * activeMonths.length;
    const elapsedDays = periodMode === "month"
      ? currentDay
      : (() => {
          // For quarter/year, sum full past months + current month days
          const currentMonth = now.getMonth() + 1;
          let elapsed = 0;
          for (const m of activeMonths) {
            if (m < currentMonth) elapsed += new Date(filterYear, m, 0).getDate();
            else if (m === currentMonth) elapsed += currentDay;
          }
          return elapsed;
        })();
    const remainingDays = Math.max(1, daysInPeriod - elapsedDays);
    const remainingWeeks = Math.max(1, Math.ceil(remainingDays / 7));
    const totalWeeks = Math.max(1, Math.ceil(daysInPeriod / 7));

    const activeReps = reps.filter((r) => filterRep === "all" || r.id === filterRep);
    const repCount = reps.length || 1; // always divide by total team size

    return activeReps
      .map((rep) => {
        // Meta: 1) monthly_goals table, 2) rep.meta_quantidade, 3) team split
        const repGoals = goals.filter(
          (g) => g.representative_id === rep.id && g.ano === filterYear && activeMonths.includes(g.mes)
        );
        const goalsSum = repGoals.reduce((s, g) => s + g.meta_quantidade, 0);
        const repDefault = rep.meta_quantidade * activeMonths.length;
        const teamSplit = Math.ceil((TEAM_META_MONTHLY * activeMonths.length) / repCount);
        const meta = goalsSum > 0 ? goalsSum : repDefault > 0 ? repDefault : teamSplit;

        // Meta semanal
        const metaSemanal = Math.ceil(meta / totalWeeks);

        // Vendas fechadas
        const closedDeals = deals.filter((d) => {
          if (d.representative_id !== rep.id || d.status !== "fechado") return false;
          if (!d.closed_at) return false;
          const dt = new Date(d.closed_at);
          return dt.getFullYear() === filterYear && activeMonths.includes(dt.getMonth() + 1);
        });
        const sold = closedDeals.length;

        // % meta
        const pct = meta > 0 ? Math.round((sold / meta) * 100) : 0;
        const remaining = Math.max(0, meta - sold);
        const perWeek = remainingWeeks > 0 ? Math.ceil(remaining / remainingWeeks) : remaining;

        // Status
        let status: "abaixo" | "ritmo" | "acima" = "abaixo";
        if (pct >= 100) status = "acima";
        else if (pct >= 70) status = "ritmo";

        // Visitas
        const repVisits = visits.filter((v) => v.representative_id === rep.id);
        const totalVisits = repVisits.reduce((s, v) => s + v.quantidade, 0);

        // Oportunidades
        const repOpps = opportunities.filter(
          (o) => o.representative_id === rep.id && o.ano === filterYear && activeMonths.includes(o.mes)
        );
        const totalOpps = repOpps.reduce((s, o) => s + o.quantidade, 0);

        // Negociações ativas
        const activeNeg = closingDeals.filter(
          (c) => c.representative_id === rep.id && c.status === "ativa"
        ).length;

        // Conversão
        const totalProposals = closedDeals.length + closingDeals.filter(
          (c) => c.representative_id === rep.id
        ).length;
        const conversion = totalProposals > 0 ? Math.round((sold / totalProposals) * 100) : 0;

        // Ação recomendada
        let action = "Manter ritmo";
        let actionIcon = <CheckCircle2 className="h-4 w-4" />;
        let actionColor = "text-emerald-400";

        if (totalVisits === 0 && totalOpps === 0) {
          action = "Aumentar visitas urgente";
          actionIcon = <AlertTriangle className="h-4 w-4" />;
          actionColor = "text-red-400";
        } else if (totalOpps === 0) {
          action = "Gerar oportunidades";
          actionIcon = <Lightbulb className="h-4 w-4" />;
          actionColor = "text-amber-400";
        } else if (conversion < 20 && totalOpps > 0) {
          action = "Melhorar fechamento";
          actionIcon = <Target className="h-4 w-4" />;
          actionColor = "text-amber-400";
        } else if (totalVisits < 10) {
          action = "Aumentar visitas";
          actionIcon = <Eye className="h-4 w-4" />;
          actionColor = "text-amber-400";
        } else if (pct >= 100) {
          action = "Manter ritmo 🔥";
          actionIcon = <Zap className="h-4 w-4" />;
          actionColor = "text-emerald-400";
        }

        return {
          ...rep,
          sold,
          meta,
          metaSemanal,
          pct,
          remaining,
          perWeek,
          status,
          totalVisits,
          totalOpps,
          activeNeg,
          conversion,
          action,
          actionIcon,
          actionColor,
        };
      })
      .sort((a, b) => {
        const order = { abaixo: 0, ritmo: 1, acima: 2 };
        return order[a.status] - order[b.status] || a.pct - b.pct;
      });
  }, [reps, deals, goals, opportunities, visits, closingDeals, filterYear, activeMonths, filterRep]);

  // Critical reps (0 sales or 0 opps or lowest pct)
  const criticalReps = useMemo(() => {
    const ids = new Set<string>();
    repData.forEach((r) => {
      if (r.sold === 0 || r.totalOpps === 0 || r.pct < 30) ids.add(r.id);
    });
    // Also add the 3 worst by pct if not already critical
    const sorted = [...repData].sort((a, b) => a.pct - b.pct);
    sorted.slice(0, 3).forEach((r) => ids.add(r.id));
    return ids;
  }, [repData]);

  // Team status counts
  const teamStatus = useMemo(() => {
    const abaixo = repData.filter((r) => r.status === "abaixo").length;
    const ritmo = repData.filter((r) => r.status === "ritmo").length;
    const acima = repData.filter((r) => r.status === "acima").length;
    return { abaixo, ritmo, acima };
  }, [repData]);

  const statusConfig = {
    abaixo: { label: "Abaixo da meta", color: "bg-red-500/20 text-red-400 border-red-500/30", dotColor: "bg-red-500" },
    ritmo: { label: "No ritmo", color: "bg-amber-500/20 text-amber-400 border-amber-500/30", dotColor: "bg-amber-500" },
    acima: { label: "Acima da meta", color: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30", dotColor: "bg-emerald-500" },
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-2">
        <h1 className="font-heading text-xl font-bold text-foreground flex items-center gap-2">
          <Users className="h-6 w-6 text-primary" />
          Gestão da Equipe
        </h1>
        <p className="text-sm text-muted-foreground">Acompanhamento e cobrança de performance</p>
      </div>

      {/* Filters */}
      <FilterBar
        year={filterYear}
        onYearChange={setFilterYear}
        periodMode={periodMode}
        onPeriodModeChange={setPeriodMode}
        month={filterMonth}
        onMonthChange={setFilterMonth}
        quarter={filterQuarter}
        onQuarterChange={setFilterQuarter}
        showRep
        rep={filterRep}
        onRepChange={setFilterRep}
        reps={reps}
      />

      {/* 1. Status da Equipe */}
      <div className="grid grid-cols-3 gap-3">
        {([
          { key: "abaixo" as const, icon: <TrendingDown className="h-5 w-5" />, count: teamStatus.abaixo, bg: "from-red-500/10 to-red-500/5 border-red-500/20", textColor: "text-red-400", numColor: "text-red-300" },
          { key: "ritmo" as const, icon: <Clock className="h-5 w-5" />, count: teamStatus.ritmo, bg: "from-amber-500/10 to-amber-500/5 border-amber-500/20", textColor: "text-amber-400", numColor: "text-amber-300" },
          { key: "acima" as const, icon: <TrendingUp className="h-5 w-5" />, count: teamStatus.acima, bg: "from-emerald-500/10 to-emerald-500/5 border-emerald-500/20", textColor: "text-emerald-400", numColor: "text-emerald-300" },
        ]).map((item) => (
          <Card key={item.key} className={`bg-gradient-to-br ${item.bg} border p-4 text-center transition-all hover:scale-[1.02]`}>
            <div className={`flex justify-center mb-2 ${item.textColor}`}>{item.icon}</div>
            <div className={`text-3xl font-bold ${item.numColor}`}>{item.count}</div>
            <div className={`text-xs font-medium mt-1 ${item.textColor}`}>{statusConfig[item.key].label}</div>
          </Card>
        ))}
      </div>

      {/* 2. Críticos do Período */}
      {(() => {
        const critical = repData.filter((r) => criticalReps.has(r.id));
        if (critical.length === 0) return null;
        return (
          <Card className="border-red-500/40 bg-red-500/5 p-4 space-y-3">
            <h2 className="text-sm font-bold text-red-400 flex items-center gap-2">
              <XCircle className="h-4 w-4" />
              Críticos do Período — Ação Imediata
            </h2>
            <div className="space-y-2">
              {critical.map((r) => {
                const reasons: string[] = [];
                if (r.sold === 0) reasons.push("0 vendas");
                if (r.totalOpps === 0) reasons.push("0 oportunidades");
                if (r.totalVisits === 0) reasons.push("0 visitas");
                if (reasons.length === 0 && r.pct < 30) reasons.push(`${r.pct}% da meta`);
                return (
                  <div key={r.id} className="flex items-center justify-between bg-red-500/10 rounded-lg px-3 py-2">
                    <div className="flex items-center gap-2">
                      <div className="h-7 w-7 rounded-full bg-red-500/20 text-red-400 flex items-center justify-center text-[10px] font-bold">
                        {r.nome.split(" ").map((n) => n[0]).slice(0, 2).join("")}
                      </div>
                      <span className="text-sm font-semibold text-foreground">{r.nome}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-red-400">{reasons.join(" · ")}</span>
                      <Badge className="bg-red-500/20 text-red-300 border-red-500/30 text-[10px]">{r.action}</Badge>
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>
        );
      })()}

      {/* 3. Lista de Vendedores */}
      <div className="space-y-3">
        {repData.map((rep) => {
          const cfg = statusConfig[rep.status];
          const isCritical = criticalReps.has(rep.id);
          return (
            <Card
              key={rep.id}
              className={`p-4 transition-all hover:shadow-md ${
                isCritical
                  ? "border-red-500/50 bg-red-500/5 hover:border-red-500/70"
                  : "border-border/40 bg-card hover:border-border/80"
              }`}
            >
              {/* Header do card */}
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className={`h-9 w-9 rounded-full flex items-center justify-center text-xs font-bold ${
                    rep.status === "acima" ? "bg-emerald-500/20 text-emerald-400" :
                    rep.status === "ritmo" ? "bg-amber-500/20 text-amber-400" :
                    "bg-red-500/20 text-red-400"
                  }`}>
                    {rep.nome.split(" ").map((n) => n[0]).slice(0, 2).join("")}
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-foreground">{rep.nome}</h3>
                    <Badge className={`text-[10px] ${cfg.color} border`}>{cfg.label}</Badge>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-2xl font-bold text-foreground">{rep.sold}<span className="text-sm text-muted-foreground font-normal"> / {rep.meta}</span></div>
                  <div className={`text-xs font-semibold ${
                    rep.pct >= 100 ? "text-emerald-400" : rep.pct >= 70 ? "text-amber-400" : "text-red-400"
                  }`}>{rep.pct}% da meta</div>
                </div>
              </div>

              {/* Barra de progresso */}
              <div className="mb-3">
                <div className="relative h-2.5 w-full overflow-hidden rounded-full bg-secondary">
                  <div
                    className={`h-full rounded-full transition-all duration-700 ${
                      rep.pct >= 100
                        ? "bg-gradient-to-r from-emerald-500 to-emerald-400"
                        : rep.pct >= 70
                        ? "bg-gradient-to-r from-amber-500 to-amber-400"
                        : "bg-gradient-to-r from-red-500 to-red-400"
                    }`}
                    style={{ width: `${Math.min(rep.pct, 100)}%` }}
                  />
                </div>
              </div>

              {/* Meta restante + por semana */}
              {rep.remaining > 0 && (
                <div className="flex gap-4 mb-3 text-xs">
                  <span className="text-muted-foreground">
                    Faltam <span className="font-semibold text-foreground">{rep.remaining}</span> máquinas
                  </span>
                  <span className="text-muted-foreground">
                    Necessário/semana: <span className="font-semibold text-foreground">{rep.perWeek}</span>
                  </span>
                </div>
              )}

              {/* KPIs inline — simplified */}
              <div className="grid grid-cols-3 gap-2 mb-3">
                {([
                  { label: "Visitas", value: rep.totalVisits, icon: <Eye className="h-3.5 w-3.5" /> },
                  { label: "Oportunidades", value: rep.totalOpps, icon: <Lightbulb className="h-3.5 w-3.5" /> },
                  { label: "Conversão", value: `${rep.conversion}%`, icon: <TrendingUp className="h-3.5 w-3.5" /> },
                ]).map((kpi, idx) => (
                  <div key={idx} className="bg-secondary/50 rounded-lg px-2 py-1.5 text-center">
                    <div className="flex items-center justify-center gap-1 text-muted-foreground mb-0.5">{kpi.icon}</div>
                    <div className="text-sm font-bold text-foreground">{kpi.value}</div>
                    <div className="text-[10px] text-muted-foreground">{kpi.label}</div>
                  </div>
                ))}
              </div>

              {/* Ação recomendada — more prominent */}
              <div className={`flex items-center gap-2 rounded-lg px-3 py-2.5 font-semibold text-xs ${
                rep.status === "abaixo"
                  ? "bg-red-500/15 border border-red-500/30"
                  : rep.status === "ritmo"
                  ? "bg-amber-500/10 border border-amber-500/20"
                  : "bg-emerald-500/10 border border-emerald-500/20"
              }`}>
                <Badge className={`${rep.actionColor} bg-transparent border-0 p-0`}>
                  {rep.actionIcon}
                </Badge>
                <span className={rep.actionColor}>{rep.action}</span>
              </div>
            </Card>
          );
        })}

        {repData.length === 0 && (
          <Card className="border-border/40 bg-card p-8 text-center">
            <Users className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">Nenhum vendedor encontrado para o período selecionado.</p>
          </Card>
        )}
      </div>
    </div>
  );
};

export default TeamManagement;
