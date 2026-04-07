import React, { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import FilterBar from "@/components/FilterBar";
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  Eye,
  Flame,
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
type RepStatus = "critico" | "abaixo" | "atencao" | "ritmo" | "acima";

const STATUS_ORDER: Record<RepStatus, number> = {
  critico: 0,
  abaixo: 1,
  atencao: 2,
  ritmo: 3,
  acima: 4,
};

const STATUS_CONFIG: Record<RepStatus, { label: string; color: string; dotColor: string; bg: string; border: string; avatarBg: string; avatarText: string }> = {
  critico: {
    label: "Crítico",
    color: "bg-red-600/20 text-red-400 border-red-500/50",
    dotColor: "bg-red-500",
    bg: "border-red-500/40 bg-card",
    border: "border-red-500/40",
    avatarBg: "bg-red-500/20",
    avatarText: "text-red-400",
  },
  abaixo: {
    label: "Abaixo da meta",
    color: "bg-red-500/15 text-red-400 border-red-500/30",
    dotColor: "bg-red-400",
    bg: "border-red-500/25 bg-card",
    border: "border-red-500/25",
    avatarBg: "bg-red-500/15",
    avatarText: "text-red-400",
  },
  atencao: {
    label: "Atenção",
    color: "bg-amber-500/15 text-amber-400 border-amber-500/30",
    dotColor: "bg-amber-500",
    bg: "border-amber-500/25 bg-card",
    border: "border-amber-500/25",
    avatarBg: "bg-amber-500/15",
    avatarText: "text-amber-400",
  },
  ritmo: {
    label: "No ritmo",
    color: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
    dotColor: "bg-emerald-500",
    bg: "border-border/40 bg-card",
    border: "border-border/40",
    avatarBg: "bg-emerald-500/15",
    avatarText: "text-emerald-400",
  },
  acima: {
    label: "Acima da meta",
    color: "bg-emerald-500/15 text-emerald-400 border-emerald-500/40",
    dotColor: "bg-emerald-400",
    bg: "border-emerald-500/25 bg-card",
    border: "border-emerald-500/25",
    avatarBg: "bg-emerald-500/15",
    avatarText: "text-emerald-400",
  },
};

function getStatus(pct: number): RepStatus {
  if (pct === 0) return "critico";
  if (pct < 50) return "abaixo";
  if (pct < 80) return "atencao";
  if (pct <= 100) return "ritmo";
  return "acima";
}

function getProgressGradient(status: RepStatus) {
  switch (status) {
    case "critico": return "bg-gradient-to-r from-red-600 to-red-500";
    case "abaixo": return "bg-gradient-to-r from-red-500 to-red-400";
    case "atencao": return "bg-gradient-to-r from-amber-500 to-amber-400";
    case "ritmo": return "bg-gradient-to-r from-emerald-500 to-emerald-400";
    case "acima": return "bg-gradient-to-r from-emerald-400 to-emerald-300";
  }
}

function getPctColor(status: RepStatus) {
  switch (status) {
    case "critico":
    case "abaixo": return "text-red-400";
    case "atencao": return "text-amber-400";
    case "ritmo":
    case "acima": return "text-emerald-400";
  }
}

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
        supabase.from("representatives").select("id, nome, meta_quantidade").eq("user_id", userId).ilike("status", "ativo"),
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

  const TEAM_META_MONTHLY = 8;

  const repData = useMemo(() => {
    const now = new Date();
    const currentDay = now.getDate();
    const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    const daysInPeriod = daysInMonth * activeMonths.length;
    const elapsedDays = periodMode === "month"
      ? currentDay
      : (() => {
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
    const repCount = reps.length || 1;

    return activeReps
      .map((rep) => {
        const repGoals = goals.filter(
          (g) => g.representative_id === rep.id && g.ano === filterYear && activeMonths.includes(g.mes)
        );
        const goalsSum = repGoals.reduce((s, g) => s + g.meta_quantidade, 0);
        const repDefault = rep.meta_quantidade * activeMonths.length;
        const teamSplit = Math.ceil((TEAM_META_MONTHLY * activeMonths.length) / repCount);
        const meta = goalsSum > 0 ? goalsSum : repDefault > 0 ? repDefault : teamSplit;

        const metaSemanal = Math.ceil(meta / totalWeeks);

        const closedDeals = deals.filter((d) => {
          if (d.representative_id !== rep.id || d.status !== "closed") return false;
          if (!d.closed_at) return false;
          const dt = new Date(d.closed_at);
          return dt.getFullYear() === filterYear && activeMonths.includes(dt.getMonth() + 1);
        });
        const sold = closedDeals.length;

        const pct = meta > 0 ? Math.round((sold / meta) * 100) : 0;
        const remaining = Math.max(0, meta - sold);
        const perWeek = remainingWeeks > 0 ? Math.ceil(remaining / remainingWeeks) : remaining;

        const status = getStatus(pct);

        // Urgência: máquinas para fechar nos próximos 7 dias
        const urgencia7d = remaining > 0 ? Math.min(remaining, perWeek) : 0;

        const repVisits = visits.filter((v) => v.representative_id === rep.id);
        const totalVisits = repVisits.reduce((s, v) => s + v.quantidade, 0);

        const repOpps = opportunities.filter(
          (o) => o.representative_id === rep.id && o.ano === filterYear && activeMonths.includes(o.mes)
        );
        const totalOpps = repOpps.reduce((s, o) => s + o.quantidade, 0);

        const activeNeg = closingDeals.filter(
          (c) => c.representative_id === rep.id && c.status === "ativa"
        ).length;

        const totalProposals = closedDeals.length + closingDeals.filter(
          (c) => c.representative_id === rep.id
        ).length;
        const conversion = totalProposals > 0 ? Math.round((sold / totalProposals) * 100) : 0;

        let action = "Manter ritmo";
        let actionIcon = <CheckCircle2 className="h-4 w-4" />;
        let actionColor = "text-emerald-400";

        if (sold === 0 && totalOpps === 0 && totalVisits === 0) {
          action = "Sem atividade — contato urgente";
          actionIcon = <Flame className="h-4 w-4" />;
          actionColor = "text-red-300";
        } else if (totalVisits === 0 && totalOpps === 0) {
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
          urgencia7d,
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
        return STATUS_ORDER[a.status] - STATUS_ORDER[b.status] || a.pct - b.pct;
      });
  }, [reps, deals, goals, opportunities, visits, closingDeals, filterYear, activeMonths, filterRep]);

  // Team totals
  const teamTotals = useMemo(() => {
    const totalSold = repData.reduce((s, r) => s + r.sold, 0);
    const totalMeta = repData.reduce((s, r) => s + r.meta, 0);
    const pct = totalMeta > 0 ? Math.round((totalSold / totalMeta) * 100) : 0;
    const remaining = Math.max(0, totalMeta - totalSold);
    const status = getStatus(pct);
    const bestRep = [...repData].sort((a, b) => b.sold - a.sold)[0];
    return { totalSold, totalMeta, pct, remaining, status, bestRep };
  }, [repData]);

  // Team status counts (5-tier)
  const teamStatus = useMemo(() => {
    const critico = repData.filter((r) => r.status === "critico").length;
    const abaixo = repData.filter((r) => r.status === "abaixo").length;
    const atencao = repData.filter((r) => r.status === "atencao").length;
    const ritmo = repData.filter((r) => r.status === "ritmo").length;
    const acima = repData.filter((r) => r.status === "acima").length;
    return { critico, abaixo, atencao, ritmo, acima };
  }, [repData]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  const statusMsg = teamTotals.pct >= 100
    ? "Equipe acima da meta! 🔥"
    : teamTotals.pct >= 80
    ? "Equipe no ritmo"
    : teamTotals.pct >= 50
    ? "Equipe precisa acelerar"
    : "Equipe em situação crítica";

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

      {/* META DA EQUIPE — TOPO */}
      <Card className={`p-5 ${STATUS_CONFIG[teamTotals.status].border} bg-card`}>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-bold text-foreground flex items-center gap-2">
            <Target className="h-4 w-4 text-primary" />
            Meta da Equipe
          </h2>
          <Badge className={`text-xs ${STATUS_CONFIG[teamTotals.status].color} border`}>
            {statusMsg}
          </Badge>
        </div>

        <div className="grid grid-cols-4 gap-3 mb-4">
          <div className="text-center">
            <div className="text-2xl font-bold text-foreground">{teamTotals.totalSold}</div>
            <div className="text-[10px] text-muted-foreground">Vendidas</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-foreground">{teamTotals.totalMeta}</div>
            <div className="text-[10px] text-muted-foreground">Meta</div>
          </div>
          <div className="text-center">
            <div className={`text-2xl font-bold ${getPctColor(teamTotals.status)}`}>{teamTotals.pct}%</div>
            <div className="text-[10px] text-muted-foreground">Atingido</div>
          </div>
          <div className="text-center">
            <div className={`text-2xl font-bold ${teamTotals.remaining > 0 ? "text-red-400" : "text-emerald-400"}`}>{teamTotals.remaining}</div>
            <div className="text-[10px] text-muted-foreground">Faltam</div>
          </div>
        </div>

        <div className="relative h-3 w-full overflow-hidden rounded-full bg-secondary">
          <div
            className={`h-full rounded-full transition-all duration-700 ${getProgressGradient(teamTotals.status)}`}
            style={{ width: `${Math.min(teamTotals.pct, 100)}%` }}
          />
        </div>

        {teamTotals.bestRep && (
          <div className="mt-3 text-xs text-muted-foreground">
            🏆 Melhor vendedor: <span className="font-semibold text-foreground">{teamTotals.bestRep.nome}</span> — {teamTotals.bestRep.sold} máquinas
          </div>
        )}
      </Card>

      {/* Status counts — 5-tier */}
      <div className="grid grid-cols-5 gap-2">
        {([
          { key: "critico" as RepStatus, icon: <XCircle className="h-4 w-4" />, count: teamStatus.critico, borderColor: "border-red-500/40", textColor: "text-red-400", numColor: "text-foreground" },
          { key: "abaixo" as RepStatus, icon: <TrendingDown className="h-4 w-4" />, count: teamStatus.abaixo, borderColor: "border-red-500/30", textColor: "text-red-400", numColor: "text-foreground" },
          { key: "atencao" as RepStatus, icon: <AlertTriangle className="h-4 w-4" />, count: teamStatus.atencao, borderColor: "border-amber-500/30", textColor: "text-amber-400", numColor: "text-foreground" },
          { key: "ritmo" as RepStatus, icon: <Clock className="h-4 w-4" />, count: teamStatus.ritmo, borderColor: "border-emerald-500/30", textColor: "text-emerald-400", numColor: "text-foreground" },
          { key: "acima" as RepStatus, icon: <TrendingUp className="h-4 w-4" />, count: teamStatus.acima, borderColor: "border-emerald-500/40", textColor: "text-emerald-400", numColor: "text-foreground" },
        ]).map((item) => (
          <Card key={item.key} className={`bg-card ${item.borderColor} border p-3 text-center`}>
            <div className={`flex justify-center mb-1 ${item.textColor}`}>{item.icon}</div>
            <div className={`text-2xl font-bold ${item.numColor}`}>{item.count}</div>
            <div className={`text-[9px] font-medium mt-0.5 ${item.textColor}`}>{STATUS_CONFIG[item.key].label}</div>
          </Card>
        ))}
      </div>

      {/* Críticos — destaque forte */}
      {(() => {
        const critical = repData.filter((r) => r.status === "critico");
        if (critical.length === 0) return null;
        return (
          <Card className="border-red-500/40 bg-card p-4 space-y-3">
            <h2 className="text-sm font-bold text-red-400 flex items-center gap-2">
              <Flame className="h-4 w-4" />
              Vendedores Críticos — Ação Imediata
            </h2>
            <div className="space-y-2">
              {critical.map((r) => {
                const reasons: string[] = [];
                if (r.sold === 0) reasons.push("0 vendas");
                if (r.totalOpps === 0) reasons.push("0 oportunidades");
                if (r.totalVisits === 0) reasons.push("0 visitas");
                return (
                  <div key={r.id} className="flex items-center justify-between bg-secondary/50 rounded-lg px-3 py-2.5 border border-red-500/30">
                    <div className="flex items-center gap-2">
                      <div className="h-7 w-7 rounded-full bg-red-500/30 text-red-300 flex items-center justify-center text-[10px] font-bold">
                        {r.nome.split(" ").map((n) => n[0]).slice(0, 2).join("")}
                      </div>
                      <span className="text-sm font-semibold text-foreground">{r.nome}</span>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap justify-end">
                      <span className="text-xs text-red-300">{reasons.join(" · ")}</span>
                      <Badge className="bg-red-600/30 text-red-200 border-red-500/40 text-[10px]">{r.action}</Badge>
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>
        );
      })()}

      {/* Lista de Vendedores — priorizada */}
      <div className="space-y-3">
        {repData.map((rep) => {
          const cfg = STATUS_CONFIG[rep.status];
          return (
            <Card
              key={rep.id}
              className={`p-4 transition-all hover:shadow-md ${cfg.bg} ${
                rep.status === "critico" ? "ring-1 ring-red-500/30" : ""
              }`}
            >
              {/* Header */}
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className={`h-9 w-9 rounded-full flex items-center justify-center text-xs font-bold ${cfg.avatarBg} ${cfg.avatarText}`}>
                    {rep.nome.split(" ").map((n) => n[0]).slice(0, 2).join("")}
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-foreground">{rep.nome}</h3>
                    <Badge className={`text-[10px] ${cfg.color} border`}>{cfg.label}</Badge>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-2xl font-bold text-foreground">{rep.sold}<span className="text-sm text-muted-foreground font-normal"> / {rep.meta}</span></div>
                  <div className={`text-xs font-semibold ${getPctColor(rep.status)}`}>{rep.pct}% da meta</div>
                </div>
              </div>

              {/* Progress bar */}
              <div className="mb-3">
                <div className="relative h-2.5 w-full overflow-hidden rounded-full bg-secondary">
                  <div
                    className={`h-full rounded-full transition-all duration-700 ${getProgressGradient(rep.status)}`}
                    style={{ width: `${Math.min(rep.pct, 100)}%` }}
                  />
                </div>
              </div>

              {/* Urgência de ação */}
              {rep.remaining > 0 && (
                <div className={`text-xs font-semibold mb-3 px-2 py-1.5 rounded-md ${
                  rep.status === "critico"
                    ? "bg-red-600/20 text-red-300 border border-red-500/30"
                    : rep.status === "abaixo"
                    ? "bg-red-500/15 text-red-400 border border-red-500/20"
                    : rep.status === "atencao"
                    ? "bg-amber-500/10 text-amber-400 border border-amber-500/20"
                    : "bg-secondary/50 text-muted-foreground"
                }`}>
                  ⚡ Precisa fechar <span className="font-bold text-foreground">{rep.urgencia7d}</span> máquinas nos próximos 7 dias
                  {rep.remaining > rep.urgencia7d && (
                    <span className="ml-1 text-muted-foreground">({rep.remaining} restantes no total)</span>
                  )}
                </div>
              )}
              {rep.remaining === 0 && rep.pct >= 100 && (
                <div className="text-xs font-semibold mb-3 px-2 py-1.5 rounded-md bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  ✓ Meta atingida!
                </div>
              )}

              {/* KPIs */}
              <div className="grid grid-cols-4 gap-2 mb-3">
                {([
                  { label: "Visitas", value: rep.totalVisits, icon: <Eye className="h-3.5 w-3.5" /> },
                  { label: "Oportunidades", value: rep.totalOpps, icon: <Lightbulb className="h-3.5 w-3.5" /> },
                  { label: "Negociações", value: rep.activeNeg, icon: <Target className="h-3.5 w-3.5" /> },
                  { label: "Conversão", value: `${rep.conversion}%`, icon: <TrendingUp className="h-3.5 w-3.5" /> },
                ]).map((kpi, idx) => (
                  <div key={idx} className="bg-secondary/50 rounded-lg px-2 py-1.5 text-center">
                    <div className="flex items-center justify-center gap-1 text-muted-foreground mb-0.5">{kpi.icon}</div>
                    <div className="text-sm font-bold text-foreground">{kpi.value}</div>
                    <div className="text-[10px] text-muted-foreground">{kpi.label}</div>
                  </div>
                ))}
              </div>

              {/* Ação recomendada */}
              <div className={`flex items-center gap-2 rounded-lg px-3 py-2.5 font-semibold text-xs ${
                rep.status === "critico"
                  ? "bg-red-600/20 border border-red-500/40"
                  : rep.status === "abaixo"
                  ? "bg-red-500/15 border border-red-500/30"
                  : rep.status === "atencao"
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
