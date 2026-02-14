import { useState, useMemo, useEffect, useRef } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  TrendingUp, TrendingDown, AlertTriangle, Target, DollarSign,
  Users, Zap, ArrowLeft, Send, Bot, User, Loader2, BarChart3,
  ShieldAlert, Activity, Flame,
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

  // AI Chat
  const [chatMessages, setChatMessages] = useState<ChatMsg[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const fetchData = async () => {
      const [dealsRes, repsRes, goalsRes] = await Promise.all([
        supabase.from("deals" as any).select("*").order("created_at", { ascending: false }),
        supabase.from("representatives" as any).select("id, nome, meta_mensal_padrao, meta_quantidade").eq("status", "ATIVO"),
        supabase.from("monthly_goals" as any).select("*"),
      ]);
      if (dealsRes.data) setDeals(dealsRes.data as unknown as Deal[]);
      if (repsRes.data) setReps(repsRes.data as unknown as RepOption[]);
      if (goalsRes.data) setGoals(goalsRes.data as unknown as MonthlyGoal[]);
      setLoading(false);
    };
    fetchData();
  }, []);

  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [chatMessages]);

  const now = new Date();
  const currentMonth = now.getMonth() + 1;
  const currentYear = now.getFullYear();

  // Closed deals only
  const closedDeals = useMemo(() => deals.filter(d => d.status === "closed"), [deals]);

  // ── 6-month trend data ──
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
      data.push({
        month: `${SHORT_MONTHS[m - 1]}/${String(y).slice(2)}`,
        faturamento, lucro, margem, count: monthDeals.length,
      });
    }
    return data;
  }, [closedDeals, currentMonth, currentYear]);

  // ── Current month deals ──
  const currentMonthDeals = useMemo(() =>
    closedDeals.filter(d => {
      const dt = new Date(d.created_at);
      return dt.getMonth() + 1 === currentMonth && dt.getFullYear() === currentYear;
    }), [closedDeals, currentMonth, currentYear]);

  // ── Projections ──
  const projections = useMemo(() => {
    const dayOfMonth = now.getDate();
    const daysInMonth = new Date(currentYear, currentMonth, 0).getDate();
    const currentFob = currentMonthDeals.reduce((s, d) => s + d.base_price, 0);
    const currentCount = currentMonthDeals.length;
    const currentProfit = currentMonthDeals.reduce((s, d) => s + d.net_profit, 0);

    // Conservative: current pace
    const conservativeRate = dayOfMonth > 0 ? currentFob / dayOfMonth : 0;
    const conservativeFob = conservativeRate * daysInMonth;
    const conservativeCount = dayOfMonth > 0 ? Math.round((currentCount / dayOfMonth) * daysInMonth) : 0;
    const conservativeProfit = dayOfMonth > 0 ? (currentProfit / dayOfMonth) * daysInMonth : 0;

    // Realistic: avg last 3 months
    const last3 = trendData.slice(-4, -1); // exclude current month
    const avg3Fob = last3.length > 0 ? last3.reduce((s, d) => s + d.faturamento, 0) / last3.length : 0;
    const avg3Count = last3.length > 0 ? Math.round(last3.reduce((s, d) => s + d.count, 0) / last3.length) : 0;
    const avg3Profit = last3.length > 0 ? last3.reduce((s, d) => s + d.lucro, 0) / last3.length : 0;

    // Aggressive: best month this year
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

    // Meta
    const totalGoalValue = goals
      .filter(g => g.mes === currentMonth && g.ano === currentYear)
      .reduce((s, g) => s + g.meta_valor, 0);
    const totalGoalQtd = goals
      .filter(g => g.mes === currentMonth && g.ano === currentYear)
      .reduce((s, g) => s + g.meta_quantidade, 0);
    const metaFob = totalGoalValue > 0 ? totalGoalValue : reps.reduce((s, r) => s + r.meta_mensal_padrao, 0);

    const chancePct = (projected: number) => metaFob > 0 ? Math.min(100, (projected / metaFob) * 100) : 0;

    return [
      { label: "Conservador", emoji: "🐢", desc: "Ritmo atual", fob: conservativeFob, count: conservativeCount, profit: conservativeProfit, chance: chancePct(conservativeFob), color: "border-yellow-400/40 bg-yellow-500/[0.04]" },
      { label: "Realista", emoji: "📊", desc: "Média 3 meses", fob: avg3Fob, count: avg3Count, profit: avg3Profit, chance: chancePct(avg3Fob), color: "border-blue-400/40 bg-blue-500/[0.04]" },
      { label: "Agressivo", emoji: "🔥", desc: "Melhor mês do ano", fob: bestMonth.fob, count: bestMonth.count, profit: bestMonth.profit, chance: chancePct(bestMonth.fob), color: "border-green-400/40 bg-green-500/[0.04]" },
    ];
  }, [currentMonthDeals, trendData, closedDeals, goals, reps, currentMonth, currentYear, now]);

  // ── Strategic Risks ──
  const risks = useMemo(() => {
    const riskList: { level: "high" | "medium" | "low"; title: string; desc: string; icon: any }[] = [];
    const last3Deals = closedDeals.filter(d => {
      const dt = new Date(d.created_at);
      const monthsAgo = (currentYear - dt.getFullYear()) * 12 + (currentMonth - (dt.getMonth() + 1));
      return monthsAgo >= 0 && monthsAgo < 3;
    });

    // Client concentration
    const clientFob: Record<string, number> = {};
    last3Deals.forEach(d => { clientFob[d.client_name] = (clientFob[d.client_name] || 0) + d.base_price; });
    const totalFob3m = last3Deals.reduce((s, d) => s + d.base_price, 0);
    Object.entries(clientFob).forEach(([name, fob]) => {
      const pct = totalFob3m > 0 ? (fob / totalFob3m) * 100 : 0;
      if (pct > 40) {
        riskList.push({ level: "high", title: "Dependência de cliente", desc: `"${name}" representa ${pct.toFixed(0)}% do faturamento dos últimos 3 meses.`, icon: AlertTriangle });
      }
    });

    // Reps below average
    const repFob: Record<string, number> = {};
    last3Deals.forEach(d => { if (d.representative_id) repFob[d.representative_id] = (repFob[d.representative_id] || 0) + d.base_price; });
    const avgRepFob = Object.keys(repFob).length > 0 ? Object.values(repFob).reduce((a, b) => a + b, 0) / Object.keys(repFob).length : 0;
    reps.forEach(r => {
      const fob = repFob[r.id] || 0;
      if (fob < avgRepFob * 0.5 && avgRepFob > 0) {
        riskList.push({ level: "medium", title: "Representante abaixo da média", desc: `${r.nome}: ${formatUsd(fob)} (média: ${formatUsd(avgRepFob)}).`, icon: Users });
      }
    });

    // Margin below historical average
    const allAvgMargin = closedDeals.length > 0 ? closedDeals.reduce((s, d) => s + d.net_margin_percent, 0) / closedDeals.length : 0;
    const recentAvgMargin = last3Deals.length > 0 ? last3Deals.reduce((s, d) => s + d.net_margin_percent, 0) / last3Deals.length : 0;
    if (recentAvgMargin < allAvgMargin * 0.85 && closedDeals.length >= 5) {
      riskList.push({ level: "medium", title: "Margem abaixo da média histórica", desc: `Média recente: ${formatPct(recentAvgMargin)} vs histórica: ${formatPct(allAvgMargin)}.`, icon: TrendingDown });
    }

    // Insufficient pace
    const dayOfMonth = now.getDate();
    const daysInMonth = new Date(currentYear, currentMonth, 0).getDate();
    const currentFob = currentMonthDeals.reduce((s, d) => s + d.base_price, 0);
    const projectedFob = dayOfMonth > 0 ? (currentFob / dayOfMonth) * daysInMonth : 0;
    const metaFob = goals.filter(g => g.mes === currentMonth && g.ano === currentYear).reduce((s, g) => s + g.meta_valor, 0) || reps.reduce((s, r) => s + r.meta_mensal_padrao, 0);
    if (metaFob > 0 && projectedFob < metaFob * 0.7) {
      riskList.push({ level: "high", title: "Ritmo insuficiente", desc: `Projeção: ${formatUsd(projectedFob)} vs Meta: ${formatUsd(metaFob)} (${formatPct((projectedFob / metaFob) * 100)}).`, icon: Activity });
    }

    if (riskList.length === 0) {
      riskList.push({ level: "low", title: "Nenhum risco crítico detectado", desc: "Os indicadores estão dentro dos parâmetros normais.", icon: Target });
    }

    return riskList;
  }, [closedDeals, currentMonthDeals, reps, goals, currentMonth, currentYear, now]);

  // ── AI Context builder ──
  const buildContext = () => {
    const lines: string[] = [];
    lines.push(`Mês atual: ${SHORT_MONTHS[currentMonth - 1]}/${currentYear}`);
    lines.push(`Total de vendas fechadas: ${closedDeals.length}`);
    lines.push(`\nTENDÊNCIA 6 MESES:`);
    trendData.forEach(t => lines.push(`${t.month}: Faturamento ${formatUsd(t.faturamento)}, Lucro ${formatUsd(t.lucro)}, Margem ${formatPct(t.margem)}, ${t.count} vendas`));
    lines.push(`\nPROJEÇÕES:`);
    projections.forEach(p => lines.push(`${p.label}: FOB ${formatUsd(p.fob)}, ${p.count} máq., Lucro ${formatUsd(p.profit)}, Chance ${formatPct(p.chance)}`));
    lines.push(`\nRISCOS:`);
    risks.forEach(r => lines.push(`[${r.level}] ${r.title}: ${r.desc}`));
    lines.push(`\nREPRESENTANTES ATIVOS: ${reps.map(r => r.nome).join(", ")}`);

    // Top 5 clients
    const clientFob: Record<string, number> = {};
    closedDeals.forEach(d => { clientFob[d.client_name] = (clientFob[d.client_name] || 0) + d.base_price; });
    const top5 = Object.entries(clientFob).sort((a, b) => b[1] - a[1]).slice(0, 5);
    lines.push(`\nTOP 5 CLIENTES (FOB total):`);
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
    } catch (e) {
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

  const riskColor = (level: string) => {
    if (level === "high") return "border-red-500/40 bg-red-500/[0.06] text-red-700";
    if (level === "medium") return "border-yellow-500/40 bg-yellow-500/[0.06] text-yellow-700";
    return "border-green-500/40 bg-green-500/[0.06] text-green-700";
  };

  const riskBadge = (level: string) => {
    if (level === "high") return <Badge className="bg-red-500 text-white border-0 text-[10px] font-bold">ALTO</Badge>;
    if (level === "medium") return <Badge className="bg-yellow-500 text-white border-0 text-[10px] font-bold">MÉDIO</Badge>;
    return <Badge className="bg-green-500 text-white border-0 text-[10px] font-bold">BAIXO</Badge>;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3 bg-foreground/[0.03] rounded-xl px-6 py-5 border border-border/40">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={onBack} className="h-10 w-10">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h2 className="font-heading text-3xl font-black text-foreground tracking-tight flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-primary/15 flex items-center justify-center">
                <Zap className="h-5 w-5 text-primary" />
              </div>
              ANÁLISE PROFUNDA
            </h2>
            <p className="text-sm text-muted-foreground mt-1 ml-[52px]">Inteligência comercial e projeções estratégicas</p>
          </div>
        </div>
      </div>

      {/* ── 1. TENDÊNCIA 6 MESES ── */}
      <div>
        <h3 className="font-heading text-lg font-black uppercase tracking-wider text-foreground mb-4 flex items-center gap-2">
          <BarChart3 className="h-5 w-5 text-primary" /> Tendência 6 Meses
        </h3>
        <div className="grid gap-4 lg:grid-cols-3">
          {/* Faturamento */}
          <Card className="border-border bg-card p-5 shadow-sm">
            <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3">Faturamento (FOB)</p>
            <ResponsiveContainer width="100%" height={180}>
              <AreaChart data={trendData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="month" tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
                <YAxis tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" tickFormatter={v => `${(v / 1000).toFixed(0)}k`} />
                <Tooltip formatter={(v: number) => formatUsd(v)} />
                <Area type="monotone" dataKey="faturamento" stroke="hsl(217, 91%, 60%)" fill="hsl(217, 91%, 60%, 0.15)" strokeWidth={2} name="Faturamento" />
              </AreaChart>
            </ResponsiveContainer>
          </Card>

          {/* Lucro */}
          <Card className="border-border bg-card p-5 shadow-sm">
            <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3">Lucro Líquido</p>
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={trendData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="month" tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
                <YAxis tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" tickFormatter={v => `${(v / 1000).toFixed(0)}k`} />
                <Tooltip formatter={(v: number) => formatUsd(v)} />
                <Bar dataKey="lucro" fill="hsl(142, 71%, 45%)" radius={[4, 4, 0, 0]} name="Lucro" />
              </BarChart>
            </ResponsiveContainer>
          </Card>

          {/* Margem */}
          <Card className="border-border bg-card p-5 shadow-sm">
            <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3">Margem Média</p>
            <ResponsiveContainer width="100%" height={180}>
              <LineChart data={trendData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="month" tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
                <YAxis tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" domain={[0, 'auto']} tickFormatter={v => `${v}%`} />
                <Tooltip formatter={(v: number) => formatPct(v)} />
                <Line type="monotone" dataKey="margem" stroke="hsl(25, 95%, 53%)" strokeWidth={2.5} dot={{ fill: "hsl(25, 95%, 53%)", r: 4 }} name="Margem" />
              </LineChart>
            </ResponsiveContainer>
          </Card>
        </div>
      </div>

      {/* ── 2. PROJEÇÕES ── */}
      <div>
        <h3 className="font-heading text-lg font-black uppercase tracking-wider text-foreground mb-4 flex items-center gap-2">
          <Target className="h-5 w-5 text-primary" /> Projeção Automática — {SHORT_MONTHS[currentMonth - 1]}/{currentYear}
        </h3>
        <div className="grid gap-4 md:grid-cols-3">
          {projections.map(p => (
            <Card key={p.label} className={cn("border-2 shadow-sm rounded-xl px-6 py-5", p.color)}>
              <div className="flex items-center gap-2 mb-4">
                <span className="text-xl">{p.emoji}</span>
                <div>
                  <h4 className="font-heading text-sm font-black uppercase tracking-widest">{p.label}</h4>
                  <p className="text-[10px] text-muted-foreground">{p.desc}</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Máquinas</p>
                  <p className="text-xl font-black">{p.count}</p>
                </div>
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Faturamento</p>
                  <p className="text-base font-black">{formatUsd(p.fob)}</p>
                </div>
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Lucro</p>
                  <p className="text-base font-bold text-green-600">{formatUsd(p.profit)}</p>
                </div>
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Chance Meta</p>
                  <p className={cn("text-xl font-black", p.chance >= 80 ? "text-green-600" : p.chance >= 50 ? "text-yellow-600" : "text-red-600")}>
                    {formatPct(p.chance)}
                  </p>
                </div>
              </div>
            </Card>
          ))}
        </div>
      </div>

      {/* ── 3. RISCOS ESTRATÉGICOS ── */}
      <div>
        <h3 className="font-heading text-lg font-black uppercase tracking-wider text-foreground mb-4 flex items-center gap-2">
          <ShieldAlert className="h-5 w-5 text-destructive" /> Riscos Estratégicos
        </h3>
        <div className="grid gap-3 md:grid-cols-2">
          {risks.map((r, i) => (
            <Card key={i} className={cn("border-2 rounded-xl px-5 py-4 flex items-start gap-4", riskColor(r.level))}>
              <div className="h-10 w-10 rounded-lg bg-background/80 flex items-center justify-center shrink-0 mt-0.5">
                <r.icon className="h-5 w-5" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <p className="font-bold text-sm">{r.title}</p>
                  {riskBadge(r.level)}
                </div>
                <p className="text-xs opacity-80">{r.desc}</p>
              </div>
            </Card>
          ))}
        </div>
      </div>

      {/* ── 4. ASSISTENTE COMERCIAL IA ── */}
      <div>
        <h3 className="font-heading text-lg font-black uppercase tracking-wider text-foreground mb-4 flex items-center gap-2">
          <Bot className="h-5 w-5 text-primary" /> Assistente Comercial IA
        </h3>
        <Card className="border-border bg-card shadow-sm rounded-xl overflow-hidden">
          <ScrollArea className="h-[350px] p-4">
            {chatMessages.length === 0 && (
              <div className="text-center text-muted-foreground py-12 space-y-3">
                <Bot className="h-10 w-10 mx-auto opacity-30" />
                <p className="text-sm font-medium">Pergunte sobre seus dados comerciais</p>
                <div className="flex flex-wrap gap-2 justify-center">
                  {[
                    "Qual meu melhor representante?",
                    "Qual a tendência de margem?",
                    "Onde posso melhorar?",
                    "Resumo do mês atual",
                  ].map(q => (
                    <Button key={q} variant="outline" size="sm" className="text-xs h-7"
                      onClick={() => { setChatInput(q); }}>
                      {q}
                    </Button>
                  ))}
                </div>
              </div>
            )}
            {chatMessages.map((msg, i) => (
              <div key={i} className={cn("mb-4 flex gap-3", msg.role === "user" ? "justify-end" : "justify-start")}>
                {msg.role === "assistant" && (
                  <div className="h-7 w-7 rounded-full bg-primary/15 flex items-center justify-center shrink-0 mt-1">
                    <Bot className="h-3.5 w-3.5 text-primary" />
                  </div>
                )}
                <div className={cn(
                  "max-w-[80%] rounded-xl px-4 py-3 text-sm",
                  msg.role === "user"
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted"
                )}>
                  {msg.role === "assistant" ? (
                    <div className="prose prose-sm max-w-none dark:prose-invert">
                      <ReactMarkdown>{msg.content}</ReactMarkdown>
                    </div>
                  ) : msg.content}
                </div>
                {msg.role === "user" && (
                  <div className="h-7 w-7 rounded-full bg-foreground/10 flex items-center justify-center shrink-0 mt-1">
                    <User className="h-3.5 w-3.5" />
                  </div>
                )}
              </div>
            ))}
            {chatLoading && chatMessages[chatMessages.length - 1]?.role !== "assistant" && (
              <div className="flex gap-3 mb-4">
                <div className="h-7 w-7 rounded-full bg-primary/15 flex items-center justify-center shrink-0 mt-1">
                  <Bot className="h-3.5 w-3.5 text-primary" />
                </div>
                <div className="bg-muted rounded-xl px-4 py-3">
                  <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                </div>
              </div>
            )}
            <div ref={chatEndRef} />
          </ScrollArea>
          <div className="border-t border-border p-3 flex gap-2">
            <Input
              value={chatInput}
              onChange={e => setChatInput(e.target.value)}
              placeholder="Pergunte sobre seus dados comerciais..."
              className="bg-secondary/50 border-border text-sm"
              onKeyDown={e => e.key === "Enter" && sendMessage()}
              disabled={chatLoading}
            />
            <Button onClick={sendMessage} disabled={!chatInput.trim() || chatLoading} size="icon" className="shrink-0">
              {chatLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            </Button>
          </div>
        </Card>
      </div>
    </div>
  );
};

export default DeepAnalysis;
