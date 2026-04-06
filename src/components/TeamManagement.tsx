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

type PeriodMode = "mes" | "trimestre" | "ano";

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
  const [periodMode, setPeriodMode] = useState<PeriodMode>("mes");
  const [filterRep, setFilterRep] = useState("all");

  const activeMonths = useMemo(() => {
    if (periodMode === "mes") return [filterMonth];
    if (periodMode === "trimestre") return QUARTER_MONTHS[filterQuarter] || [filterMonth];
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

  const repData = useMemo(() => {
    const now = new Date();
    const currentDay = now.getDate();
    const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    const remainingDays = daysInMonth - currentDay;
    const remainingWeeks = Math.max(1, Math.ceil(remainingDays / 7));

    return reps
      .filter((r) => filterRep === "all" || r.id === filterRep)
      .map((rep) => {
        // Meta
        const repGoals = goals.filter(
          (g) => g.representative_id === rep.id && g.ano === filterYear && activeMonths.includes(g.mes)
        );
        const meta = repGoals.reduce((s, g) => s + g.meta_quantidade, 0) || rep.meta_quantidade * activeMonths.length;

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

  // Alerts
  const alerts = useMemo(() => {
    const items: { type: "critical" | "warning" | "info"; text: string; icon: React.ReactNode }[] = [];

    const zeroSales = repData.filter((r) => r.sold === 0);
    if (zeroSales.length > 0) {
      items.push({
        type: "critical",
        text: `${zeroSales.length} vendedor(es) com 0 vendas: ${zeroSales.map((r) => r.nome.split(" ")[0]).join(", ")}`,
        icon: <XCircle className="h-4 w-4" />,
      });
    }

    const zeroOpps = repData.filter((r) => r.totalOpps === 0);
    if (zeroOpps.length > 0) {
      items.push({
        type: "critical",
        text: `${zeroOpps.length} vendedor(es) com 0 oportunidades: ${zeroOpps.map((r) => r.nome.split(" ")[0]).join(", ")}`,
        icon: <AlertTriangle className="h-4 w-4" />,
      });
    }

    const lowActivity = repData.filter((r) => r.totalVisits < 5 && r.totalVisits > 0);
    if (lowActivity.length > 0) {
      items.push({
        type: "warning",
        text: `${lowActivity.length} vendedor(es) com baixa atividade de visitas`,
        icon: <Clock className="h-4 w-4" />,
      });
    }

    const totalSold = repData.reduce((s, r) => s + r.sold, 0);
    const totalProposals = repData.reduce((s, r) => s + r.sold + r.activeNeg, 0);
    const generalConversion = totalProposals > 0 ? Math.round((totalSold / totalProposals) * 100) : 0;
    if (generalConversion < 25 && totalProposals > 0) {
      items.push({
        type: "warning",
        text: `Conversão geral baixa: ${generalConversion}%`,
        icon: <TrendingDown className="h-4 w-4" />,
      });
    }

    return items;
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
        filterYear={filterYear}
        setFilterYear={setFilterYear}
        periodMode={periodMode}
        setPeriodMode={setPeriodMode}
        filterMonth={filterMonth}
        setFilterMonth={setFilterMonth}
        filterQuarter={filterQuarter}
        setFilterQuarter={setFilterQuarter}
        filterRep={filterRep}
        setFilterRep={setFilterRep}
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

      {/* 2. Alertas */}
      {alerts.length > 0 && (
        <Card className="border-border/60 bg-card p-4 space-y-2">
          <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-400" />
            Alertas Automáticos
          </h2>
          <div className="space-y-2">
            {alerts.map((alert, i) => (
              <div
                key={i}
                className={`flex items-start gap-2 text-sm rounded-lg px-3 py-2 ${
                  alert.type === "critical"
                    ? "bg-red-500/10 text-red-400"
                    : alert.type === "warning"
                    ? "bg-amber-500/10 text-amber-400"
                    : "bg-blue-500/10 text-blue-400"
                }`}
              >
                {alert.icon}
                <span>{alert.text}</span>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* 3. Lista de Vendedores */}
      <div className="space-y-3">
        {repData.map((rep) => {
          const cfg = statusConfig[rep.status];
          return (
            <Card
              key={rep.id}
              className="border-border/40 bg-card p-4 transition-all hover:border-border/80 hover:shadow-md"
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

              {/* KPIs inline */}
              <div className="grid grid-cols-4 gap-2 mb-3">
                {([
                  { label: "Visitas", value: rep.totalVisits, icon: <Eye className="h-3.5 w-3.5" /> },
                  { label: "Oportunid.", value: rep.totalOpps, icon: <Lightbulb className="h-3.5 w-3.5" /> },
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
              <div className={`flex items-center gap-2 text-xs font-medium ${rep.actionColor} bg-secondary/30 rounded-lg px-3 py-2`}>
                {rep.actionIcon}
                <span>Ação recomendada: {rep.action}</span>
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
