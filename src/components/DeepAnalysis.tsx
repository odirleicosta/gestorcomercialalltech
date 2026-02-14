import { useState, useMemo, useEffect, useRef } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  TrendingUp, TrendingDown, AlertTriangle, Target, DollarSign,
  Users, Zap, ArrowLeft, Send, Bot, User, Loader2, BarChart3,
  ShieldAlert, Activity, Flame, CheckCircle2, AlertCircle,
} from "lucide-react";
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, LineChart, Line,
} from "recharts";
import ReactMarkdown from "react-markdown";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

interface Props {
  userId: string;
  onBack: () => void;
}

interface Deal {
  id: string;
  client_name: string;
  machine_name: string;
  machine_type: string;
  base_price: number;
  fob_cost: number;
  net_profit: number;
  net_margin_percent: number;
  gross_profit: number;
  gross_margin_percent: number;
  seller_commission_value: number;
  manager_commission_value: number;
  representative_id: string | null;
  empresa_id: string | null;
  status: string;
  created_at: string;
  closed_at: string | null;
}

interface RepOption { id: string; nome: string; meta_mensal_padrao: number; meta_quantidade: number; }
interface MonthlyGoal { representative_id: string; meta_quantidade: number; meta_valor: number; mes: number; ano: number; machine_type: string; }
interface ChatMsg { role: "user" | "assistant"; content: string; }

const SHORT_MONTHS = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

const formatUsd = (v: number) => `US$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
const formatPct = (v: number) => `${v.toFixed(1)}%`;

const DeepAnalysis = ({ userId, onBack }: Props) => {
  const [deals, setDeals] = useState<Deal[]>([]);
  const [reps, setReps] = useState<RepOption[]>([]);
  const [goals, setGoals] = useState<MonthlyGoal[]>([]);
  const [loading, setLoading] = useState(true);

  const [chatMessages, setChatMessages] = useState<ChatMsg[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const [lastAnalysis, setLastAnalysis] = useState<Date | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
  const fetchData = async () => {
      setLoading(true);
      const [dealsRes, repsRes, goalsRes] = await Promise.all([
        supabase.from("deals" as any).select("*").order("created_at", { ascending: false }),
        supabase.from("representatives" as any).select("id, nome, meta_mensal_padrao, meta_quantidade").eq("status", "ATIVO"),
        supabase.from("monthly_goals" as any).select("*"),
      ]);
      if (dealsRes.data) setDeals(dealsRes.data as unknown as Deal[]);
      if (repsRes.data) setReps(repsRes.data as unknown as RepOption[]);
      if (goalsRes.data) setGoals(goalsRes.data as unknown as MonthlyGoal[]);
      setLoading(false);
      setLastAnalysis(new Date());
    };
    fetchData();
  }, [refreshKey]);

  const handleRefreshAnalysis = () => setRefreshKey(k => k + 1);

  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [chatMessages]);

  const now = new Date();
  const currentMonth = now.getMonth() + 1;
  const currentYear = now.getFullYear();

  const closedDeals = useMemo(() => deals.filter(d => d.status === "closed"), [deals]);

  // ── 6-month trend ──
  const trendData = useMemo(() => {
    const data: { month: string; faturamento: number; lucro: number; margem: number; count: number }[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(currentYear, currentMonth - 1 - i, 1);
      const m = d.getMonth() + 1;
      const y = d.getFullYear();
      const monthDeals = closedDeals.filter(deal => {
        const dt = new Date(deal.created_at);
        return dt.getMonth() + 1 === m && dt.getFullYear() === y;
      });
      const faturamento = monthDeals.reduce((s, d) => s + d.base_price, 0);
      const lucro = monthDeals.reduce((s, d) => s + d.net_profit, 0);
      const margem = monthDeals.length > 0
        ? monthDeals.reduce((s, d) => s + d.net_margin_percent, 0) / monthDeals.length
        : 0;
      data.push({ month: `${SHORT_MONTHS[m - 1]}/${String(y).slice(2)}`, faturamento, lucro, margem, count: monthDeals.length });
    }
    return data;
  }, [closedDeals, currentMonth, currentYear]);

  // ── Current month deals ──
  const currentMonthDeals = useMemo(() =>
    closedDeals.filter(d => {
      const dt = new Date(d.created_at);
      return dt.getMonth() + 1 === currentMonth && dt.getFullYear() === currentYear;
    }), [closedDeals, currentMonth, currentYear]);

  // ── Month status ──
  const monthStatus = useMemo(() => {
    const dayOfMonth = now.getDate();
    const daysInMonth = new Date(currentYear, currentMonth, 0).getDate();
    const currentFob = currentMonthDeals.reduce((s, d) => s + d.base_price, 0);
    const projectedFob = dayOfMonth > 0 ? (currentFob / dayOfMonth) * daysInMonth : 0;
    const metaFob = goals.filter(g => g.mes === currentMonth && g.ano === currentYear).reduce((s, g) => s + g.meta_valor, 0) || reps.reduce((s, r) => s + r.meta_mensal_padrao, 0);
    const pct = metaFob > 0 ? (projectedFob / metaFob) * 100 : 0;
    const achieved = metaFob > 0 ? (currentFob / metaFob) * 100 : 0;

    let level: "green" | "yellow" | "red" = "green";
    let phrase = "";
    if (pct >= 90) {
      level = "green";
      phrase = `Meta saudável — projeção de ${formatPct(pct)} da meta com ${formatUsd(currentFob)} realizado.`;
    } else if (pct >= 60) {
      level = "yellow";
      phrase = `Atenção — ritmo atual projeta ${formatPct(pct)} da meta. Acelere as vendas.`;
    } else {
      level = "red";
      phrase = `Meta comprometida — projeção de apenas ${formatPct(pct)} da meta. Ação imediata necessária.`;
    }

    return { level, phrase, projectedFob, metaFob, currentFob, pct, achieved, dayOfMonth, daysInMonth };
  }, [currentMonthDeals, goals, reps, currentMonth, currentYear, now]);

  // ── Projections ──
  const projections = useMemo(() => {
    const { dayOfMonth, daysInMonth, currentFob } = monthStatus;
    const currentCount = currentMonthDeals.length;
    const currentProfit = currentMonthDeals.reduce((s, d) => s + d.net_profit, 0);

    const conservativeRate = dayOfMonth > 0 ? currentFob / dayOfMonth : 0;
    const conservativeFob = conservativeRate * daysInMonth;
    const conservativeCount = dayOfMonth > 0 ? Math.round((currentCount / dayOfMonth) * daysInMonth) : 0;
    const conservativeProfit = dayOfMonth > 0 ? (currentProfit / dayOfMonth) * daysInMonth : 0;

    const last3 = trendData.slice(-4, -1);
    const avg3Fob = last3.length > 0 ? last3.reduce((s, d) => s + d.faturamento, 0) / last3.length : 0;
    const avg3Count = last3.length > 0 ? Math.round(last3.reduce((s, d) => s + d.count, 0) / last3.length) : 0;
    const avg3Profit = last3.length > 0 ? last3.reduce((s, d) => s + d.lucro, 0) / last3.length : 0;

    const yearDeals = closedDeals.filter(d => new Date(d.created_at).getFullYear() === currentYear);
    const monthBuckets: Record<number, { fob: number; count: number; profit: number }> = {};
    yearDeals.forEach(d => {
      const m = new Date(d.created_at).getMonth() + 1;
      if (!monthBuckets[m]) monthBuckets[m] = { fob: 0, count: 0, profit: 0 };
      monthBuckets[m].fob += d.base_price;
      monthBuckets[m].count += 1;
      monthBuckets[m].profit += d.net_profit;
    });
    let bestMonth = { fob: 0, count: 0, profit: 0 };
    Object.values(monthBuckets).forEach(b => { if (b.fob > bestMonth.fob) bestMonth = b; });

    const { metaFob } = monthStatus;
    const chancePct = (projected: number) => metaFob > 0 ? Math.min(100, (projected / metaFob) * 100) : 0;

    return [
      { label: "Conservador", emoji: "🐢", desc: "Ritmo atual", fob: conservativeFob, count: conservativeCount, profit: conservativeProfit, chance: chancePct(conservativeFob), border: "border-l-yellow-500" },
      { label: "Realista", emoji: "📊", desc: "Média 3 meses", fob: avg3Fob, count: avg3Count, profit: avg3Profit, chance: chancePct(avg3Fob), border: "border-l-blue-500" },
      { label: "Agressivo", emoji: "🔥", desc: "Melhor mês do ano", fob: bestMonth.fob, count: bestMonth.count, profit: bestMonth.profit, chance: chancePct(bestMonth.fob), border: "border-l-green-500" },
    ];
  }, [currentMonthDeals, trendData, closedDeals, monthStatus, currentYear]);

  // ── Strategic Risks ──
  const risks = useMemo(() => {
    const riskList: { level: "high" | "medium"; title: string; desc: string; icon: any }[] = [];
    const last3Deals = closedDeals.filter(d => {
      const dt = new Date(d.created_at);
      const monthsAgo = (currentYear - dt.getFullYear()) * 12 + (currentMonth - (dt.getMonth() + 1));
      return monthsAgo >= 0 && monthsAgo < 3;
    });

    const clientFob: Record<string, number> = {};
    last3Deals.forEach(d => { clientFob[d.client_name] = (clientFob[d.client_name] || 0) + d.base_price; });
    const totalFob3m = last3Deals.reduce((s, d) => s + d.base_price, 0);
    Object.entries(clientFob).forEach(([name, fob]) => {
      const pct = totalFob3m > 0 ? (fob / totalFob3m) * 100 : 0;
      if (pct > 40) {
        riskList.push({ level: "high", title: "Concentração de cliente", desc: `"${name}" = ${pct.toFixed(0)}% do faturamento.`, icon: AlertTriangle });
      }
    });

    const repFob: Record<string, number> = {};
    last3Deals.forEach(d => { if (d.representative_id) repFob[d.representative_id] = (repFob[d.representative_id] || 0) + d.base_price; });
    const avgRepFob = Object.keys(repFob).length > 0 ? Object.values(repFob).reduce((a, b) => a + b, 0) / Object.keys(repFob).length : 0;
    reps.forEach(r => {
      const fob = repFob[r.id] || 0;
      if (fob < avgRepFob * 0.5 && avgRepFob > 0) {
        riskList.push({ level: "medium", title: "Rep. abaixo da média", desc: `${r.nome}: ${formatUsd(fob)} (média: ${formatUsd(avgRepFob)})`, icon: Users });
      }
    });

    const allAvgMargin = closedDeals.length > 0 ? closedDeals.reduce((s, d) => s + d.net_margin_percent, 0) / closedDeals.length : 0;
    const recentAvgMargin = last3Deals.length > 0 ? last3Deals.reduce((s, d) => s + d.net_margin_percent, 0) / last3Deals.length : 0;
    if (recentAvgMargin < allAvgMargin * 0.85 && closedDeals.length >= 5) {
      riskList.push({ level: "medium", title: "Margem em queda", desc: `Recente: ${formatPct(recentAvgMargin)} vs histórica: ${formatPct(allAvgMargin)}`, icon: TrendingDown });
    }

    const { projectedFob, metaFob } = monthStatus;
    if (metaFob > 0 && projectedFob < metaFob * 0.7) {
      riskList.push({ level: "high", title: "Ritmo insuficiente", desc: `Projeção ${formatPct((projectedFob / metaFob) * 100)} da meta`, icon: Activity });
    }

    return riskList;
  }, [closedDeals, reps, monthStatus, currentMonth, currentYear]);

  // ── Proactive Recommendations ──
  const recommendations = useMemo(() => {
    const recs: { emoji: string; title: string; action: string; priority: number }[] = [];

    // 1. Ritmo insuficiente
    const { pct, metaFob, projectedFob, achieved } = monthStatus;
    if (metaFob > 0 && pct < 80) {
      const faltando = metaFob - monthStatus.currentFob;
      const diasRestantes = monthStatus.daysInMonth - monthStatus.dayOfMonth;
      const porDia = diasRestantes > 0 ? faltando / diasRestantes : faltando;
      recs.push({ emoji: "⚡", title: "Acelerar ritmo de vendas", action: `Faltam ${formatUsd(faltando)} para meta. Necessário ${formatUsd(porDia)}/dia nos próximos ${diasRestantes} dias.`, priority: pct < 50 ? 1 : 2 });
    }

    // 2. Margem em queda
    const last3Deals = closedDeals.filter(d => {
      const dt = new Date(d.created_at);
      const monthsAgo = (currentYear - dt.getFullYear()) * 12 + (currentMonth - (dt.getMonth() + 1));
      return monthsAgo >= 0 && monthsAgo < 3;
    });
    const allAvgMargin = closedDeals.length > 0 ? closedDeals.reduce((s, d) => s + d.net_margin_percent, 0) / closedDeals.length : 0;
    const recentAvgMargin = last3Deals.length > 0 ? last3Deals.reduce((s, d) => s + d.net_margin_percent, 0) / last3Deals.length : 0;
    if (recentAvgMargin < allAvgMargin * 0.85 && closedDeals.length >= 5) {
      recs.push({ emoji: "📉", title: "Margem sob pressão", action: `Margem caiu de ${formatPct(allAvgMargin)} para ${formatPct(recentAvgMargin)}. Revisar política de preços e descontos.`, priority: 2 });
    }

    // 3. Representantes abaixo da média
    const repFob: Record<string, number> = {};
    last3Deals.forEach(d => { if (d.representative_id) repFob[d.representative_id] = (repFob[d.representative_id] || 0) + d.base_price; });
    const avgRepFob = Object.keys(repFob).length > 0 ? Object.values(repFob).reduce((a, b) => a + b, 0) / Object.keys(repFob).length : 0;
    const weakReps = reps.filter(r => (repFob[r.id] || 0) < avgRepFob * 0.5 && avgRepFob > 0);
    if (weakReps.length > 0) {
      recs.push({ emoji: "👥", title: "Equipe desbalanceada", action: `${weakReps.map(r => r.nome).join(", ")} abaixo de 50% da média. Cobrar plano de ação individual.`, priority: 3 });
    }

    // 4. Concentração de clientes
    const clientFob: Record<string, number> = {};
    last3Deals.forEach(d => { clientFob[d.client_name] = (clientFob[d.client_name] || 0) + d.base_price; });
    const totalFob3m = last3Deals.reduce((s, d) => s + d.base_price, 0);
    const concentrated = Object.entries(clientFob).filter(([, fob]) => totalFob3m > 0 && (fob / totalFob3m) * 100 > 30);
    if (concentrated.length > 0) {
      recs.push({ emoji: "🎯", title: "Diversificar carteira", action: `${concentrated.map(([n, f]) => `${n} (${((f / totalFob3m) * 100).toFixed(0)}%)`).join(", ")}. Prospectar novos clientes para reduzir risco.`, priority: 3 });
    }

    // 5. Projeção vs meta
    if (metaFob > 0 && pct >= 80 && pct < 100) {
      recs.push({ emoji: "🏁", title: "Meta ao alcance", action: `Projeção de ${formatPct(pct)} da meta. Fechar negociações em andamento para garantir o resultado.`, priority: 4 });
    }

    // 6. Meta batida - manter ritmo
    if (metaFob > 0 && achieved >= 100) {
      recs.push({ emoji: "🏆", title: "Meta batida — superar!", action: `Já atingiu ${formatPct(achieved)} da meta. Aproveitar o momentum para maximizar o resultado do mês.`, priority: 5 });
    }

    // 7. Comparação com mês anterior
    const prevMonthData = trendData.length >= 2 ? trendData[trendData.length - 2] : null;
    const currMonthData = trendData[trendData.length - 1];
    if (prevMonthData && prevMonthData.faturamento > 0 && currMonthData) {
      const variation = ((currMonthData.faturamento - prevMonthData.faturamento) / prevMonthData.faturamento) * 100;
      if (variation < -20) {
        recs.push({ emoji: "📊", title: "Queda vs mês anterior", action: `Faturamento ${formatPct(Math.abs(variation))} abaixo do mês anterior. Investigar causas e reagir.`, priority: 2 });
      }
    }

    return recs.sort((a, b) => a.priority - b.priority).slice(0, 5);
  }, [closedDeals, reps, monthStatus, trendData, currentMonth, currentYear]);

  // ── AI Context ──
  const buildContext = () => {
    const lines: string[] = [];
    lines.push(`Mês: ${SHORT_MONTHS[currentMonth - 1]}/${currentYear}`);
    lines.push(`Vendas fechadas: ${closedDeals.length}`);
    lines.push(`\nTENDÊNCIA 6 MESES:`);
    trendData.forEach(t => lines.push(`${t.month}: Fat ${formatUsd(t.faturamento)}, Lucro ${formatUsd(t.lucro)}, Margem ${formatPct(t.margem)}, ${t.count} vendas`));
    lines.push(`\nPROJEÇÕES:`);
    projections.forEach(p => lines.push(`${p.label}: FOB ${formatUsd(p.fob)}, ${p.count} máq., Lucro ${formatUsd(p.profit)}, Chance ${formatPct(p.chance)}`));
    lines.push(`\nRISCOS:`);
    risks.forEach(r => lines.push(`[${r.level}] ${r.title}: ${r.desc}`));
    lines.push(`\nREPS: ${reps.map(r => r.nome).join(", ")}`);
    const clientFob: Record<string, number> = {};
    closedDeals.forEach(d => { clientFob[d.client_name] = (clientFob[d.client_name] || 0) + d.base_price; });
    const top5 = Object.entries(clientFob).sort((a, b) => b[1] - a[1]).slice(0, 5);
    lines.push(`\nTOP 5 CLIENTES:`);
    top5.forEach(([name, fob]) => lines.push(`- ${name}: ${formatUsd(fob)}`));
    return lines.join("\n");
  };

  // ── AI Chat ──
  const sendMessage = async () => {
    const text = chatInput.trim();
    if (!text || chatLoading) return;
    const userMsg: ChatMsg = { role: "user", content: text };
    const allMessages = [...chatMessages, userMsg];
    setChatMessages(allMessages);
    setChatInput("");
    setChatLoading(true);

    let assistantSoFar = "";
    const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/commercial-assistant`;

    try {
      const resp = await fetch(CHAT_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({
          messages: allMessages.map(m => ({ role: m.role, content: m.content })),
          context: buildContext(),
        }),
      });

      if (!resp.ok || !resp.body) {
        const errBody = await resp.json().catch(() => ({ error: "Erro desconhecido" }));
        setChatMessages(prev => [...prev, { role: "assistant", content: `❌ ${errBody.error || "Erro ao conectar com a IA."}` }]);
        setChatLoading(false);
        return;
      }

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let textBuffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        textBuffer += decoder.decode(value, { stream: true });

        let newlineIndex: number;
        while ((newlineIndex = textBuffer.indexOf("\n")) !== -1) {
          let line = textBuffer.slice(0, newlineIndex);
          textBuffer = textBuffer.slice(newlineIndex + 1);
          if (line.endsWith("\r")) line = line.slice(0, -1);
          if (line.startsWith(":") || line.trim() === "") continue;
          if (!line.startsWith("data: ")) continue;
          const jsonStr = line.slice(6).trim();
          if (jsonStr === "[DONE]") break;
          try {
            const parsed = JSON.parse(jsonStr);
            const content = parsed.choices?.[0]?.delta?.content as string | undefined;
            if (content) {
              assistantSoFar += content;
              setChatMessages(prev => {
                const last = prev[prev.length - 1];
                if (last?.role === "assistant") {
                  return prev.map((m, i) => i === prev.length - 1 ? { ...m, content: assistantSoFar } : m);
                }
                return [...prev, { role: "assistant", content: assistantSoFar }];
              });
            }
          } catch {
            textBuffer = line + "\n" + textBuffer;
            break;
          }
        }
      }
    } catch {
      setChatMessages(prev => [...prev, { role: "assistant", content: "❌ Erro de conexão com o assistente." }]);
    }
    setChatLoading(false);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const statusConfig = {
    green: { bg: "from-green-500/20 to-green-600/5 border-green-500/40", icon: CheckCircle2, iconColor: "text-green-500", label: "META SAUDÁVEL", labelBg: "bg-green-500" },
    yellow: { bg: "from-yellow-500/20 to-yellow-600/5 border-yellow-500/40", icon: AlertCircle, iconColor: "text-yellow-500", label: "ATENÇÃO", labelBg: "bg-yellow-500" },
    red: { bg: "from-red-500/20 to-red-600/5 border-red-500/40", icon: ShieldAlert, iconColor: "text-red-500", label: "META COMPROMETIDA", labelBg: "bg-red-500" },
  };

  const sc = statusConfig[monthStatus.level];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4 bg-foreground/[0.03] rounded-xl px-6 py-4 border border-border/40">
        <Button variant="ghost" size="icon" onClick={onBack} className="h-9 w-9 shrink-0">
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h2 className="font-heading text-2xl font-black text-foreground tracking-tight flex items-center gap-2">
            <Zap className="h-5 w-5 text-primary" />
            ANÁLISE PROFUNDA
          </h2>
          <p className="text-xs text-muted-foreground">Inteligência comercial • {SHORT_MONTHS[currentMonth - 1]}/{currentYear}</p>
        </div>
      </div>

      {/* Botão Atualizar + Timestamp */}
      <div className="flex items-center gap-4 flex-wrap">
        <Button onClick={handleRefreshAnalysis} disabled={loading} className="font-heading font-black tracking-wide">
          {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <span className="mr-2">🔎</span>}
          Atualizar Análise Estratégica
        </Button>
        {lastAnalysis && (
          <span className="text-xs text-muted-foreground">
            Última análise realizada em: {lastAnalysis.toLocaleString("pt-BR")}
          </span>
        )}
      </div>
      <div className={cn("rounded-xl border-2 bg-gradient-to-r p-5", sc.bg)}>
        <div className="flex items-center gap-4 flex-wrap">
          <div className={cn("h-14 w-14 rounded-xl flex items-center justify-center", sc.iconColor, "bg-background/60")}>
            <sc.icon className="h-7 w-7" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <Badge className={cn("text-white border-0 text-[10px] font-black tracking-widest", sc.labelBg)}>{sc.label}</Badge>
              <span className="text-xs text-muted-foreground">Dia {monthStatus.dayOfMonth}/{monthStatus.daysInMonth}</span>
            </div>
            <p className="text-sm font-semibold text-foreground">{monthStatus.phrase}</p>
          </div>
          <div className="flex gap-6 text-center">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Realizado</p>
              <p className="text-lg font-black">{formatUsd(monthStatus.currentFob)}</p>
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Meta</p>
              <p className="text-lg font-black">{formatUsd(monthStatus.metaFob)}</p>
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Projeção</p>
              <p className={cn("text-lg font-black", monthStatus.level === "green" ? "text-green-600" : monthStatus.level === "yellow" ? "text-yellow-600" : "text-red-600")}>
                {formatPct(monthStatus.pct)}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* ── 2. TENDÊNCIA 6 MESES ── */}
      <div>
        <h3 className="font-heading text-sm font-black uppercase tracking-widest text-muted-foreground mb-3 flex items-center gap-2">
          <BarChart3 className="h-4 w-4 text-primary" /> Tendência 6 Meses
        </h3>
        <div className="grid gap-3 lg:grid-cols-3">
          <Card className="border-border/50 bg-card p-4 shadow-sm">
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-2">Faturamento</p>
            <ResponsiveContainer width="100%" height={160}>
              <AreaChart data={trendData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="month" tick={{ fontSize: 9 }} stroke="hsl(var(--muted-foreground))" />
                <YAxis tick={{ fontSize: 9 }} stroke="hsl(var(--muted-foreground))" tickFormatter={v => `${(v / 1000).toFixed(0)}k`} />
                <Tooltip formatter={(v: number) => formatUsd(v)} />
                <Area type="monotone" dataKey="faturamento" stroke="hsl(217, 91%, 60%)" fill="hsl(217, 91%, 60%, 0.12)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </Card>

          <Card className="border-border/50 bg-card p-4 shadow-sm">
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-2">Lucro</p>
            <ResponsiveContainer width="100%" height={160}>
              <BarChart data={trendData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="month" tick={{ fontSize: 9 }} stroke="hsl(var(--muted-foreground))" />
                <YAxis tick={{ fontSize: 9 }} stroke="hsl(var(--muted-foreground))" tickFormatter={v => `${(v / 1000).toFixed(0)}k`} />
                <Tooltip formatter={(v: number) => formatUsd(v)} />
                <Bar dataKey="lucro" fill="hsl(142, 71%, 45%)" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </Card>

          <Card className="border-border/50 bg-card p-4 shadow-sm">
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-2">Margem Média</p>
            <ResponsiveContainer width="100%" height={160}>
              <LineChart data={trendData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="month" tick={{ fontSize: 9 }} stroke="hsl(var(--muted-foreground))" />
                <YAxis tick={{ fontSize: 9 }} stroke="hsl(var(--muted-foreground))" domain={[0, 'auto']} tickFormatter={v => `${v}%`} />
                <Tooltip formatter={(v: number) => formatPct(v)} />
                <Line type="monotone" dataKey="margem" stroke="hsl(25, 95%, 53%)" strokeWidth={2.5} dot={{ fill: "hsl(25, 95%, 53%)", r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          </Card>
        </div>
      </div>

      {/* ── 3. PROJEÇÕES ── */}
      <div>
        <h3 className="font-heading text-sm font-black uppercase tracking-widest text-muted-foreground mb-3 flex items-center gap-2">
          <Target className="h-4 w-4 text-primary" /> Projeção — {SHORT_MONTHS[currentMonth - 1]}/{currentYear}
        </h3>
        <div className="grid gap-3 md:grid-cols-3">
          {projections.map(p => (
            <Card key={p.label} className={cn("border-l-4 border-border/50 shadow-sm rounded-xl px-5 py-4", p.border)}>
              <div className="flex items-center gap-2 mb-3">
                <span className="text-lg">{p.emoji}</span>
                <div>
                  <h4 className="font-heading text-xs font-black uppercase tracking-widest">{p.label}</h4>
                  <p className="text-[10px] text-muted-foreground">{p.desc}</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <p className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground">Máquinas</p>
                  <p className="text-xl font-black">{p.count}</p>
                </div>
                <div>
                  <p className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground">Faturamento</p>
                  <p className="text-sm font-black">{formatUsd(p.fob)}</p>
                </div>
                <div>
                  <p className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground">Lucro</p>
                  <p className="text-sm font-bold text-green-600">{formatUsd(p.profit)}</p>
                </div>
                <div>
                  <p className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground">Chance Meta</p>
                  <div className="flex items-center gap-1.5">
                    <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
                      <div className={cn("h-full rounded-full transition-all", p.chance >= 80 ? "bg-green-500" : p.chance >= 50 ? "bg-yellow-500" : "bg-red-500")} style={{ width: `${Math.min(p.chance, 100)}%` }} />
                    </div>
                    <span className={cn("text-xs font-black", p.chance >= 80 ? "text-green-600" : p.chance >= 50 ? "text-yellow-600" : "text-red-600")}>
                      {formatPct(p.chance)}
                    </span>
                  </div>
                </div>
              </div>
            </Card>
          ))}
        </div>
      </div>

      {/* ── 4. RISCOS ESTRATÉGICOS (only if risks exist) ── */}
      {risks.length > 0 && (
        <div>
          <h3 className="font-heading text-sm font-black uppercase tracking-widest text-muted-foreground mb-3 flex items-center gap-2">
            <ShieldAlert className="h-4 w-4 text-destructive" /> Riscos Detectados
          </h3>
          <div className="grid gap-2 md:grid-cols-2">
            {risks.map((r, i) => (
              <div key={i} className={cn(
                "flex items-center gap-3 rounded-lg border px-4 py-3",
                r.level === "high" ? "border-red-500/30 bg-red-500/[0.05]" : "border-yellow-500/30 bg-yellow-500/[0.05]"
              )}>
                <div className={cn(
                  "h-8 w-8 rounded-lg flex items-center justify-center shrink-0",
                  r.level === "high" ? "bg-red-500/15 text-red-500" : "bg-yellow-500/15 text-yellow-500"
                )}>
                  <r.icon className="h-4 w-4" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-xs font-bold">{r.title}</p>
                    <Badge className={cn("text-white border-0 text-[9px] font-bold h-4", r.level === "high" ? "bg-red-500" : "bg-yellow-500")}>
                      {r.level === "high" ? "ALTO" : "MÉDIO"}
                    </Badge>
                  </div>
                  <p className="text-[11px] text-muted-foreground">{r.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── 5. RECOMENDAÇÕES ESTRATÉGICAS ── */}
      {recommendations.length > 0 && (
        <div>
          <h3 className="font-heading text-sm font-black uppercase tracking-widest text-muted-foreground mb-3 flex items-center gap-2">
            📢 Recomendações Estratégicas
          </h3>
          <div className="space-y-2">
            {recommendations.map((rec, i) => (
              <div key={i} className="flex items-start gap-3 rounded-lg border border-primary/20 bg-primary/[0.03] px-4 py-3">
                <span className="text-lg leading-none mt-0.5">{rec.emoji}</span>
                <div className="min-w-0">
                  <p className="text-xs font-black uppercase tracking-wide">{rec.title}</p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">{rec.action}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── 6. ASSISTENTE IA ── */}
      <div>
        <h3 className="font-heading text-sm font-black uppercase tracking-widest text-muted-foreground mb-3 flex items-center gap-2">
          <Bot className="h-4 w-4 text-primary" /> Assistente Comercial IA
        </h3>
        <Card className="border-border/50 bg-card shadow-sm rounded-xl overflow-hidden">
          <ScrollArea className="h-[300px] p-4">
            {chatMessages.length === 0 && (
              <div className="text-center text-muted-foreground py-10 space-y-3">
                <Bot className="h-8 w-8 mx-auto opacity-25" />
                <p className="text-xs font-medium">Pergunte sobre seus dados</p>
                <div className="flex flex-wrap gap-1.5 justify-center">
                  {["Melhor representante?", "Tendência de margem?", "Onde melhorar?", "Resumo do mês"].map(q => (
                    <Button key={q} variant="outline" size="sm" className="text-[10px] h-6 px-2"
                      onClick={() => { setChatInput(q); }}>
                      {q}
                    </Button>
                  ))}
                </div>
              </div>
            )}
            {chatMessages.map((msg, i) => (
              <div key={i} className={cn("mb-3 flex gap-2", msg.role === "user" ? "justify-end" : "justify-start")}>
                {msg.role === "assistant" && (
                  <div className="h-6 w-6 rounded-full bg-primary/15 flex items-center justify-center shrink-0 mt-0.5">
                    <Bot className="h-3 w-3 text-primary" />
                  </div>
                )}
                <div className={cn(
                  "max-w-[80%] rounded-xl px-3 py-2 text-xs",
                  msg.role === "user" ? "bg-primary text-primary-foreground" : "bg-muted"
                )}>
                  {msg.role === "assistant" ? (
                    <div className="prose prose-xs max-w-none dark:prose-invert [&_p]:text-xs [&_li]:text-xs">
                      <ReactMarkdown>{msg.content}</ReactMarkdown>
                    </div>
                  ) : msg.content}
                </div>
                {msg.role === "user" && (
                  <div className="h-6 w-6 rounded-full bg-foreground/10 flex items-center justify-center shrink-0 mt-0.5">
                    <User className="h-3 w-3" />
                  </div>
                )}
              </div>
            ))}
            {chatLoading && chatMessages[chatMessages.length - 1]?.role !== "assistant" && (
              <div className="flex gap-2 mb-3">
                <div className="h-6 w-6 rounded-full bg-primary/15 flex items-center justify-center shrink-0">
                  <Bot className="h-3 w-3 text-primary" />
                </div>
                <div className="bg-muted rounded-xl px-3 py-2">
                  <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
                </div>
              </div>
            )}
            <div ref={chatEndRef} />
          </ScrollArea>
          <div className="border-t border-border/50 p-2.5 flex gap-2">
            <Input
              value={chatInput}
              onChange={e => setChatInput(e.target.value)}
              placeholder="Pergunte sobre seus dados..."
              className="bg-secondary/50 border-border/50 text-xs h-8"
              onKeyDown={e => e.key === "Enter" && sendMessage()}
              disabled={chatLoading}
            />
            <Button onClick={sendMessage} disabled={!chatInput.trim() || chatLoading} size="icon" className="shrink-0 h-8 w-8">
              {chatLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
            </Button>
          </div>
        </Card>
      </div>
    </div>
  );
};

export default DeepAnalysis;
