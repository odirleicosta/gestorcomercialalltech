import { useMemo } from "react";
import {
  TrendingUp, TrendingDown, DollarSign, BarChart3, Zap, Users, Minus,
  Target, Award, FileText, Activity,
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  Legend as RechartLegend, Cell, AreaChart, Area,
} from "recharts";
import type { Deal } from "@/components/DealManager";

interface RepWithGoals { id: string; nome: string; meta_mensal_padrao: number; meta_quantidade: number; }
interface MonthlyGoal { representative_id: string; meta_quantidade: number; meta_valor: number; machine_type: string; mes: number; }

interface Props {
  repId: string;
  repName: string;
  deals: Deal[];
  repsWithGoals: RepWithGoals[];
  monthlyGoals: MonthlyGoal[];
  filterYear: number;
}

const MONTHS = ["Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];
const SHORT_MONTHS = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];

const RepHistoryPanel = ({ repId, repName, deals, repsWithGoals, monthlyGoals, filterYear }: Props) => {
  const rep = repsWithGoals.find(r => r.id === repId);

  const getMonthClosed = (month: number, year: number) =>
    deals.filter(d => {
      if (d.status !== "closed" || !d.closed_at) return false;
      const dt = new Date(d.closed_at);
      return (dt.getMonth()+1) === month && dt.getFullYear() === year && d.representative_id === repId;
    });

  const getRepMetaMonth = (month: number) => {
    const goal = monthlyGoals.find(g => g.representative_id === repId && g.mes === month);
    if (goal) return goal.meta_quantidade;
    return rep?.meta_quantidade || 0;
  };

  // ── 1) Evolução 6 meses: Meta x Vendido ──
  const now = new Date();
  const currentMonth = now.getMonth() + 1;
  const evo6m = useMemo(() => {
    const data: { name: string; month: number; year: number; Meta: number; Vendido: number; pct: number }[] = [];
    for (let i = 5; i >= 0; i--) {
      let m = currentMonth - i, y = filterYear;
      while (m <= 0) { m += 12; y--; }
      const closed = getMonthClosed(m, y);
      const meta = getRepMetaMonth(m);
      const vendido = closed.length;
      const pct = meta > 0 ? (vendido / meta) * 100 : 0;
      data.push({ name: `${SHORT_MONTHS[m-1]}/${String(y).slice(2)}`, month: m, year: y, Meta: meta, Vendido: vendido, pct });
    }
    return data;
  }, [deals, repId, filterYear, monthlyGoals, currentMonth]);

  // ── 2) Indicadores automáticos ──
  const indicators = useMemo(() => {
    const last6 = evo6m.map(e => e.Vendido);
    const last3 = last6.slice(3);
    const avg3 = last3.reduce((s,v) => s+v, 0) / 3;
    const avg6 = last6.reduce((s,v) => s+v, 0) / 6;
    const current = last6[5] || 0;

    let trend: "up" | "stable" | "down" = "stable";
    if (current > avg3 * 1.1) trend = "up";
    else if (current < avg3 * 0.9) trend = "down";

    return { avg3, avg6, trend, current };
  }, [evo6m]);

  // ── 3) Indicadores financeiros (ano inteiro) ──
  const financials = useMemo(() => {
    const yearDeals = deals.filter(d => {
      if (d.status !== "closed" || !d.closed_at) return false;
      const dt = new Date(d.closed_at);
      return dt.getFullYear() === filterYear && d.representative_id === repId;
    });
    const count = yearDeals.length;
    const fob = yearDeals.reduce((s,d) => s+d.base_price, 0);
    const ticket = count > 0 ? fob / count : 0;
    const netProfit = yearDeals.reduce((s,d) => s+d.net_profit, 0);
    const margem = fob > 0 ? (netProfit / fob) * 100 : 0;
    const comm = yearDeals.reduce((s,d) => s+d.seller_commission_value + d.manager_commission_value, 0);
    return { count, fob, ticket, margem, comm };
  }, [deals, repId, filterYear]);

  // ── 4) Score de Performance (0-100) ──
  const score = useMemo(() => {
    // % meta atingida (peso 40) — based on year total
    const yearMeta = Array.from({ length: 12 }, (_, i) => getRepMetaMonth(i+1)).reduce((s,v) => s+v, 0);
    const metaPct = yearMeta > 0 ? Math.min((financials.count / yearMeta) * 100, 150) : 0;
    const metaScore = Math.min(40, (metaPct / 100) * 40);

    // Crescimento (peso 20) — compare last 3 months trend
    let growthScore = 10; // stable baseline
    if (indicators.trend === "up") growthScore = 20;
    else if (indicators.trend === "down") growthScore = 0;

    // Constância (peso 20) — low variance = high consistency
    const last6 = evo6m.map(e => e.Vendido);
    const avg = last6.reduce((s,v) => s+v, 0) / 6;
    const variance = avg > 0
      ? Math.sqrt(last6.reduce((s,v) => s + Math.pow(v - avg, 2), 0) / 6) / avg
      : 1;
    const constancyScore = Math.max(0, Math.min(20, 20 * (1 - variance)));

    // Volume (peso 20) — relative to team avg
    const teamTotal = deals.filter(d => d.status === "closed" && d.closed_at && new Date(d.closed_at).getFullYear() === filterYear).length;
    const teamAvg = repsWithGoals.length > 0 ? teamTotal / repsWithGoals.length : 0;
    const volumeRatio = teamAvg > 0 ? Math.min(financials.count / teamAvg, 2) : 0;
    const volumeScore = Math.min(20, volumeRatio * 10);

    const total = Math.round(metaScore + growthScore + constancyScore + volumeScore);
    return { total: Math.min(100, total), metaScore: Math.round(metaScore), growthScore: Math.round(growthScore), constancyScore: Math.round(constancyScore), volumeScore: Math.round(volumeScore) };
  }, [financials, indicators, evo6m, deals, filterYear, repsWithGoals, monthlyGoals]);

  // ── 5) Resumo Automático ──
  const resumo = useMemo(() => {
    const lines: string[] = [];

    // Performance geral
    if (score.total >= 80) {
      lines.push(`🏆 ${repName} está com performance excelente (Score ${score.total}/100). Representante de alto desempenho.`);
    } else if (score.total >= 60) {
      lines.push(`📊 ${repName} apresenta performance satisfatória (Score ${score.total}/100) com oportunidades de melhoria.`);
    } else if (score.total >= 40) {
      lines.push(`⚠️ ${repName} está com performance abaixo do esperado (Score ${score.total}/100). Necessita acompanhamento.`);
    } else {
      lines.push(`🔴 ${repName} está com performance crítica (Score ${score.total}/100). Intervenção urgente recomendada.`);
    }

    // Tendência
    if (indicators.trend === "up") {
      lines.push(`✅ Tendência positiva: vendas acima da média dos últimos 3 meses (${indicators.avg3.toFixed(1)}/mês).`);
    } else if (indicators.trend === "down") {
      lines.push(`🔴 Tendência de queda: vendas abaixo da média recente. Média 3M: ${indicators.avg3.toFixed(1)}/mês.`);
    } else {
      lines.push(`➡️ Vendas estáveis em relação à média recente (${indicators.avg3.toFixed(1)}/mês).`);
    }

    // Financeiro
    if (financials.margem > 15) {
      lines.push(`💰 Margem média saudável de ${financials.margem.toFixed(1)}% com ticket médio de ${formatCompact(financials.ticket)}.`);
    } else if (financials.margem > 0) {
      lines.push(`💰 Margem média de ${financials.margem.toFixed(1)}%. Ticket médio: ${formatCompact(financials.ticket)}.`);
    }

    return lines;
  }, [repName, score, indicators, financials]);

  const formatUsd = (v: number) => `US$ ${v.toLocaleString("pt-BR",{minimumFractionDigits:2,maximumFractionDigits:2})}`;
  const formatPct = (v: number) => v.toLocaleString("pt-BR",{minimumFractionDigits:1,maximumFractionDigits:1})+"%";
  const formatCompact = (v: number) => v >= 1000 ? `US$ ${(v/1000).toLocaleString("pt-BR",{minimumFractionDigits:1,maximumFractionDigits:1})}k` : formatUsd(v);

  const scoreColor = score.total >= 80 ? "#22C55E" : score.total >= 60 ? "#3B82F6" : score.total >= 40 ? "#F97316" : "#EF4444";
  const scoreLabel = score.total >= 80 ? "Excelente" : score.total >= 60 ? "Bom" : score.total >= 40 ? "Regular" : "Crítico";

  return (
    <section className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="bg-gradient-to-r from-[#3B82F6] to-[#2563EB] rounded-2xl p-6 text-white shadow-lg shadow-[#3B82F6]/20 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full -translate-y-8 translate-x-8" />
        <div className="relative flex items-center gap-4">
          <div className="h-16 w-16 rounded-full bg-white/20 flex items-center justify-center text-3xl font-black">
            {repName.charAt(0)}
          </div>
          <div className="flex-1">
            <p className="text-xs font-bold uppercase tracking-wider text-white/60">Histórico Individual</p>
            <h3 className="font-heading text-2xl font-bold">{repName}</h3>
            <p className="text-white/70 text-sm">{filterYear} · {financials.count} vendas no ano</p>
          </div>
          {/* Score circle */}
          <div className="flex flex-col items-center">
            <div className="h-20 w-20 rounded-full border-4 flex items-center justify-center" style={{ borderColor: scoreColor }}>
              <div className="text-center">
                <p className="font-heading text-2xl font-black">{score.total}</p>
                <p className="text-[10px] text-white/60 -mt-0.5">/ 100</p>
              </div>
            </div>
            <span className="text-xs font-bold mt-1 px-2 py-0.5 rounded-full" style={{ backgroundColor: `${scoreColor}30`, color: scoreColor }}>{scoreLabel}</span>
          </div>
        </div>
      </div>

      {/* ── 1) Evolução 6 meses: Meta x Vendido ── */}
      <div className="bg-white rounded-xl border border-border p-6 shadow-sm">
        <h4 className="text-xs font-semibold text-muted-foreground uppercase mb-4 flex items-center gap-2">
          <BarChart3 className="h-4 w-4 text-[#3B82F6]" /> Evolução Meta x Vendido (6 Meses)
        </h4>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={evo6m} barGap={4}>
            <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
            <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#6B7280' }} />
            <YAxis tick={{ fontSize: 11, fill: '#6B7280' }} allowDecimals={false} />
            <Tooltip contentStyle={{ fontSize: 12, borderRadius: 12, background: '#fff', border: '1px solid #E5E7EB', boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }} />
            <Bar dataKey="Meta" fill="#E5E7EB" radius={[4,4,0,0]} />
            <Bar dataKey="Vendido" radius={[4,4,0,0]}>
              {evo6m.map((entry, idx) => (
                <Cell key={idx} fill={entry.pct >= 100 ? "#22C55E" : entry.pct >= 70 ? "#F97316" : "#EF4444"} />
              ))}
            </Bar>
            <RechartLegend wrapperStyle={{ fontSize: 12 }} />
          </BarChart>
        </ResponsiveContainer>
        {/* % atingido por mês */}
        <div className="flex gap-2 mt-3 flex-wrap">
          {evo6m.map(e => (
            <div key={e.name} className="text-center flex-1 min-w-[60px]">
              <p className="text-[10px] text-muted-foreground">{e.name}</p>
              <p className={`text-xs font-bold ${e.pct >= 100 ? "text-[#22C55E]" : e.pct >= 70 ? "text-[#F97316]" : "text-[#EF4444]"}`}>
                {e.Meta > 0 ? formatPct(e.pct) : "—"}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* ── 2) Indicadores automáticos + 3) Financeiros ── */}
      <div className="grid gap-4 grid-cols-1 md:grid-cols-2">
        {/* Indicadores */}
        <div className="bg-white rounded-xl border border-border p-5 shadow-sm">
          <h4 className="text-xs font-semibold text-muted-foreground uppercase mb-4 flex items-center gap-2">
            <Activity className="h-4 w-4 text-[#8B5CF6]" /> Indicadores de Vendas
          </h4>
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Média últimos 3 meses</span>
              <span className="text-sm font-bold text-foreground">{indicators.avg3.toFixed(1)} vendas/mês</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Média últimos 6 meses</span>
              <span className="text-sm font-bold text-foreground">{indicators.avg6.toFixed(1)} vendas/mês</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Tendência</span>
              <span className={`inline-flex items-center gap-1 text-sm font-bold px-2 py-0.5 rounded-full ${
                indicators.trend === "up" ? "bg-[#22C55E]/10 text-[#22C55E]" :
                indicators.trend === "down" ? "bg-[#EF4444]/10 text-[#EF4444]" :
                "bg-[#F97316]/10 text-[#F97316]"
              }`}>
                {indicators.trend === "up" ? <TrendingUp className="h-3.5 w-3.5" /> :
                 indicators.trend === "down" ? <TrendingDown className="h-3.5 w-3.5" /> :
                 <Minus className="h-3.5 w-3.5" />}
                {indicators.trend === "up" ? "Crescendo" : indicators.trend === "down" ? "Em queda" : "Estável"}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Mês atual</span>
              <span className="text-sm font-black text-foreground">{indicators.current} vendas</span>
            </div>
          </div>
        </div>

        {/* Financeiros */}
        <div className="bg-white rounded-xl border border-border p-5 shadow-sm">
          <h4 className="text-xs font-semibold text-muted-foreground uppercase mb-4 flex items-center gap-2">
            <DollarSign className="h-4 w-4 text-[#22C55E]" /> Financeiro {filterYear}
          </h4>
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">FOB Acumulado Ano</span>
              <span className="text-sm font-bold text-foreground">{formatCompact(financials.fob)}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Ticket Médio</span>
              <span className="text-sm font-bold text-foreground">{financials.count > 0 ? formatCompact(financials.ticket) : "—"}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Margem Média</span>
              <span className={`text-sm font-bold ${financials.margem >= 0 ? "text-[#22C55E]" : "text-[#EF4444]"}`}>
                {financials.count > 0 ? formatPct(financials.margem) : "—"}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Comissão Acumulada</span>
              <span className="text-sm font-bold text-[#F97316]">{formatCompact(financials.comm)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* ── 4) Score de Performance ── */}
      <div className="bg-white rounded-xl border border-border p-6 shadow-sm">
        <h4 className="text-xs font-semibold text-muted-foreground uppercase mb-4 flex items-center gap-2">
          <Award className="h-4 w-4" style={{ color: scoreColor }} /> Score de Performance
        </h4>
        {/* Score bar */}
        <div className="w-full h-4 bg-muted rounded-full overflow-hidden mb-4">
          <div className="h-full rounded-full transition-all duration-1000" style={{ width: `${score.total}%`, backgroundColor: scoreColor }} />
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <ScoreBreakdown label="Meta Atingida" value={score.metaScore} max={40} color="#3B82F6" />
          <ScoreBreakdown label="Crescimento" value={score.growthScore} max={20} color="#22C55E" />
          <ScoreBreakdown label="Constância" value={score.constancyScore} max={20} color="#8B5CF6" />
          <ScoreBreakdown label="Volume" value={score.volumeScore} max={20} color="#F97316" />
        </div>
      </div>

      {/* ── 5) Resumo Automático ── */}
      <div className="bg-gradient-to-br from-[#1E293B] to-[#334155] rounded-2xl p-6 text-white shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-40 h-40 bg-white/[0.03] rounded-full -translate-y-16 translate-x-16" />
        <div className="relative">
          <div className="flex items-center gap-2 mb-4">
            <FileText className="h-5 w-5 text-[#3B82F6]" />
            <h4 className="font-heading text-base font-bold uppercase tracking-wider">Resumo do Representante</h4>
          </div>
          <div className="space-y-2">
            {resumo.map((line, i) => (
              <p key={i} className="text-sm leading-relaxed text-white/90">{line}</p>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};

const ScoreBreakdown = ({ label, value, max, color }: { label: string; value: number; max: number; color: string }) => (
  <div className="text-center">
    <div className="w-full h-2 bg-muted rounded-full overflow-hidden mb-1.5">
      <div className="h-full rounded-full transition-all" style={{ width: `${(value/max)*100}%`, backgroundColor: color }} />
    </div>
    <p className="font-heading text-lg font-black text-foreground">{value}<span className="text-xs text-muted-foreground font-normal">/{max}</span></p>
    <p className="text-[10px] text-muted-foreground uppercase">{label}</p>
  </div>
);

export default RepHistoryPanel;
