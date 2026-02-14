import { useState, useMemo, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  DollarSign, Users, TrendingUp, Percent, BarChart3, Award, Target, Lightbulb,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface DealCommission {
  id: string;
  client_name: string;
  machine_name: string;
  machine_type: string;
  base_price: number;
  final_price: number;
  fob_cost: number;
  gross_profit: number;
  gross_margin_percent: number;
  seller_commission_pct: number;
  manager_commission_pct: number;
  seller_commission_value: number;
  manager_commission_value: number;
  representative_id: string | null;
  dollar_rate: number;
  status: string;
  closed_at: string | null;
  created_at: string;
}

interface RepOption {
  id: string;
  nome: string;
}

interface Props {
  userId: string;
}

const MONTHS = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
const SHORT_MONTHS = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

const CommissionsTab = ({ userId }: Props) => {
  const [deals, setDeals] = useState<DealCommission[]>([]);
  const [reps, setReps] = useState<RepOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalData, setModalData] = useState<{ repName: string; month: string; deals: DealCommission[] } | null>(null);

  const now = new Date();
  const [filterYear, setFilterYear] = useState(now.getFullYear());

  useEffect(() => {
    const fetchData = async () => {
      const [dealsRes, repsRes] = await Promise.all([
        supabase
          .from("deals" as any)
          .select("id, client_name, machine_name, machine_type, base_price, final_price, fob_cost, gross_profit, gross_margin_percent, seller_commission_pct, manager_commission_pct, seller_commission_value, manager_commission_value, representative_id, dollar_rate, status, closed_at, created_at")
          .order("closed_at", { ascending: false }),
        supabase
          .from("representatives" as any)
          .select("id, nome")
          .order("nome"),
      ]);
      if (dealsRes.data) setDeals(dealsRes.data as unknown as DealCommission[]);
      if (repsRes.data) setReps(repsRes.data as unknown as RepOption[]);
      setLoading(false);
    };
    fetchData();
  }, []);

  const getRepName = (id: string | null) => {
    if (!id) return "Sem representante";
    return reps.find((r) => r.id === id)?.nome || "Desconhecido";
  };

  const closedDeals = useMemo(() => {
    return deals.filter((d) => {
      if (d.status !== "closed" || !d.closed_at) return false;
      return new Date(d.closed_at).getFullYear() === filterYear;
    });
  }, [deals, filterYear]);

  // Year totals
  const yearTotals = useMemo(() => {
    const sellerTotal = closedDeals.reduce((s, d) => s + d.seller_commission_value, 0);
    const managerTotal = closedDeals.reduce((s, d) => s + d.manager_commission_value, 0);
    const totalComm = sellerTotal + managerTotal;
    const totalVendas = closedDeals.reduce((s, d) => s + d.base_price, 0);
    const count = closedDeals.length;
    const commPerMachine = count > 0 ? totalComm / count : 0;
    const pctFaturamento = totalVendas > 0 ? (totalComm / totalVendas) * 100 : 0;
    return { sellerTotal, managerTotal, totalComm, totalVendas, count, commPerMachine, pctFaturamento };
  }, [closedDeals]);

  // Rep x Month pivot
  const repMonthPivot = useMemo(() => {
    const pivot = new Map<string, { repId: string; nome: string; months: number[]; monthDeals: DealCommission[][]; total: number }>();

    reps.forEach(r => {
      pivot.set(r.id, { repId: r.id, nome: r.nome, months: Array(12).fill(0), monthDeals: Array.from({ length: 12 }, () => []), total: 0 });
    });

    closedDeals.forEach(d => {
      const key = d.representative_id || "__none__";
      if (!pivot.has(key)) {
        pivot.set(key, { repId: key, nome: getRepName(d.representative_id), months: Array(12).fill(0), monthDeals: Array.from({ length: 12 }, () => []), total: 0 });
      }
      const entry = pivot.get(key)!;
      const m = new Date(d.closed_at!).getMonth();
      const comm = d.seller_commission_value + d.manager_commission_value;
      entry.months[m] += comm;
      entry.monthDeals[m].push(d);
      entry.total += comm;
    });

    return Array.from(pivot.values()).filter(r => r.total > 0).sort((a, b) => b.total - a.total);
  }, [closedDeals, reps]);

  // Monthly column totals
  const monthColumnTotals = useMemo(() => {
    const totals = Array(12).fill(0);
    repMonthPivot.forEach(r => r.months.forEach((v, i) => totals[i] += v));
    return totals;
  }, [repMonthPivot]);

  // Insights
  const insights = useMemo(() => {
    if (closedDeals.length === 0) return null;

    // Maior comissão individual
    const maxDeal = closedDeals.reduce((best, d) => {
      const comm = d.seller_commission_value + d.manager_commission_value;
      return comm > (best.seller_commission_value + best.manager_commission_value) ? d : best;
    }, closedDeals[0]);

    // Ranking por comissão (rep)
    const repCommMap = new Map<string, { nome: string; total: number; count: number; grossProfit: number; vendas: number }>();
    closedDeals.forEach(d => {
      const key = d.representative_id || "__none__";
      const existing = repCommMap.get(key) || { nome: getRepName(d.representative_id), total: 0, count: 0, grossProfit: 0, vendas: 0 };
      existing.total += d.seller_commission_value + d.manager_commission_value;
      existing.count += 1;
      existing.grossProfit += d.gross_profit;
      existing.vendas += d.base_price;
      repCommMap.set(key, existing);
    });
    const ranking = Array.from(repCommMap.values()).sort((a, b) => b.total - a.total);

    return { maxDeal, ranking };
  }, [closedDeals, reps]);

  const formatUsd = (v: number) =>
    `US$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const formatPct = (v: number) =>
    v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + "%";
  const formatUsdShort = (v: number) => {
    if (v >= 1000) return `US$ ${(v / 1000).toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}k`;
    return formatUsd(v);
  };

  if (loading) return <p className="text-muted-foreground text-center py-8">Carregando...</p>;

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h2 className="font-heading text-xl font-bold text-foreground flex items-center gap-2">
          <DollarSign className="h-5 w-5" /> Comissões
        </h2>
        <div className="flex items-center gap-2">
          <Label className="text-xs text-muted-foreground">Ano</Label>
          <Select value={String(filterYear)} onValueChange={(v) => setFilterYear(parseInt(v))}>
            <SelectTrigger className="w-[100px] bg-secondary/50 border-border text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {[2024, 2025, 2026, 2027].map((y) => (
                <SelectItem key={y} value={String(y)}>{y}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* 1) Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card className="p-4 border-border bg-card shadow-sm">
          <div className="flex items-center gap-2 mb-1">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
              <DollarSign className="h-4 w-4 text-primary" />
            </div>
            <span className="text-xs text-muted-foreground">Total Comissões</span>
          </div>
          <p className="text-lg font-bold text-foreground">{formatUsd(yearTotals.totalComm)}</p>
        </Card>
        <Card className="p-4 border-border bg-card shadow-sm">
          <div className="flex items-center gap-2 mb-1">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#22C55E]/10">
              <Users className="h-4 w-4 text-[#22C55E]" />
            </div>
            <span className="text-xs text-muted-foreground">Com. Vendedores</span>
          </div>
          <p className="text-lg font-bold text-foreground">{formatUsd(yearTotals.sellerTotal)}</p>
        </Card>
        <Card className="p-4 border-border bg-card shadow-sm">
          <div className="flex items-center gap-2 mb-1">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#3B82F6]/10">
              <TrendingUp className="h-4 w-4 text-[#3B82F6]" />
            </div>
            <span className="text-xs text-muted-foreground">Com. Gestor</span>
          </div>
          <p className="text-lg font-bold text-foreground">{formatUsd(yearTotals.managerTotal)}</p>
        </Card>
        <Card className="p-4 border-border bg-card shadow-sm">
          <div className="flex items-center gap-2 mb-1">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#8B5CF6]/10">
              <Percent className="h-4 w-4 text-[#8B5CF6]" />
            </div>
            <span className="text-xs text-muted-foreground">% s/ Faturamento</span>
          </div>
          <p className="text-lg font-bold text-foreground">{yearTotals.count > 0 ? formatPct(yearTotals.pctFaturamento) : "—"}</p>
        </Card>
        <Card className="p-4 border-border bg-card shadow-sm">
          <div className="flex items-center gap-2 mb-1">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#F97316]/10">
              <BarChart3 className="h-4 w-4 text-[#F97316]" />
            </div>
            <span className="text-xs text-muted-foreground">Com. Média/Máq</span>
          </div>
          <p className="text-lg font-bold text-foreground">{yearTotals.count > 0 ? formatUsd(yearTotals.commPerMachine) : "—"}</p>
        </Card>
      </div>

      {/* 2) Rep x Month Pivot Table */}
      <Card className="border-border bg-card p-6 shadow-sm">
        <h3 className="font-heading text-base font-semibold text-card-foreground mb-4 flex items-center gap-2">
          <Users className="h-4 w-4" /> Comissão por Representante — Mês a Mês ({filterYear})
        </h3>
        {repMonthPivot.length === 0 ? (
          <p className="text-muted-foreground text-center py-6 text-sm">Nenhuma comissão registrada neste ano.</p>
        ) : (
          <ScrollArea className="max-h-[500px]">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="sticky left-0 bg-card z-10 min-w-[140px]">Representante</TableHead>
                    {SHORT_MONTHS.map(m => (
                      <TableHead key={m} className="text-right text-xs min-w-[85px]">{m}</TableHead>
                    ))}
                    <TableHead className="text-right font-bold min-w-[100px]">Total Anual</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {repMonthPivot.map(r => (
                    <TableRow key={r.repId}>
                      <TableCell className="font-medium text-sm sticky left-0 bg-card z-10">{r.nome}</TableCell>
                      {r.months.map((v, i) => (
                        <TableCell
                          key={i}
                          className={`text-right text-xs ${v > 0 ? "cursor-pointer hover:bg-primary/10 text-foreground font-medium" : "text-muted-foreground/40"}`}
                          onClick={() => {
                            if (v > 0) setModalData({ repName: r.nome, month: MONTHS[i], deals: r.monthDeals[i] });
                          }}
                        >
                          {v > 0 ? formatUsdShort(v) : "—"}
                        </TableCell>
                      ))}
                      <TableCell className="text-right text-sm font-bold">{formatUsd(r.total)}</TableCell>
                    </TableRow>
                  ))}
                  {/* Total row */}
                  <TableRow className="border-t-2 border-primary/30 bg-primary/5 font-bold">
                    <TableCell className="font-bold text-sm sticky left-0 bg-primary/5 z-10">TOTAL</TableCell>
                    {monthColumnTotals.map((v, i) => (
                      <TableCell key={i} className="text-right text-xs font-bold">
                        {v > 0 ? formatUsdShort(v) : "—"}
                      </TableCell>
                    ))}
                    <TableCell className="text-right text-sm font-bold">{formatUsd(yearTotals.totalComm)}</TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>
          </ScrollArea>
        )}
      </Card>

      {/* 4) Insights Automáticos */}
      {insights && (
        <Card className="border-border bg-card p-6 shadow-sm">
          <h3 className="font-heading text-base font-semibold text-card-foreground mb-4 flex items-center gap-2">
            <Lightbulb className="h-4 w-4 text-[#F97316]" /> Insights Automáticos
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Maior comissão */}
            <div className="rounded-lg border border-border p-4 bg-secondary/30">
              <div className="flex items-center gap-2 mb-2">
                <Award className="h-4 w-4 text-[#F97316]" />
                <span className="text-sm font-semibold text-foreground">Maior Comissão do Ano</span>
              </div>
              <p className="text-lg font-bold text-foreground">
                {formatUsd(insights.maxDeal.seller_commission_value + insights.maxDeal.manager_commission_value)}
              </p>
              <p className="text-xs text-muted-foreground">
                {insights.maxDeal.client_name} — {insights.maxDeal.machine_name} — {getRepName(insights.maxDeal.representative_id)}
              </p>
            </div>

            {/* Comissão média por máquina */}
            <div className="rounded-lg border border-border p-4 bg-secondary/30">
              <div className="flex items-center gap-2 mb-2">
                <Target className="h-4 w-4 text-[#3B82F6]" />
                <span className="text-sm font-semibold text-foreground">Comissão Média por Máquina</span>
              </div>
              <p className="text-lg font-bold text-foreground">{formatUsd(yearTotals.commPerMachine)}</p>
              <p className="text-xs text-muted-foreground">{yearTotals.count} máquinas vendidas no ano</p>
            </div>

            {/* Ranking por comissão */}
            <div className="rounded-lg border border-border p-4 bg-secondary/30 md:col-span-1">
              <div className="flex items-center gap-2 mb-2">
                <BarChart3 className="h-4 w-4 text-[#22C55E]" />
                <span className="text-sm font-semibold text-foreground">Ranking por Comissão</span>
              </div>
              <div className="space-y-1.5">
                {insights.ranking.slice(0, 5).map((r, i) => (
                  <div key={i} className="flex items-center justify-between text-sm">
                    <span className="flex items-center gap-2">
                      <Badge variant={i === 0 ? "default" : "secondary"} className="text-[10px] px-1.5 py-0">
                        {i + 1}º
                      </Badge>
                      <span className="text-foreground">{r.nome}</span>
                    </span>
                    <span className="font-semibold text-foreground">{formatUsd(r.total)}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Margem média por representante */}
            <div className="rounded-lg border border-border p-4 bg-secondary/30 md:col-span-1">
              <div className="flex items-center gap-2 mb-2">
                <Percent className="h-4 w-4 text-[#8B5CF6]" />
                <span className="text-sm font-semibold text-foreground">Margem Média por Representante</span>
              </div>
              <div className="space-y-1.5">
                {insights.ranking.map((r, i) => {
                  const margin = r.vendas > 0 ? (r.grossProfit / r.vendas) * 100 : 0;
                  return (
                    <div key={i} className="flex items-center justify-between text-sm">
                      <span className="text-foreground">{r.nome}</span>
                      <span className="font-semibold text-[#8B5CF6]">{formatPct(margin)}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </Card>
      )}

      {/* 3) Modal – deal details */}
      <Dialog open={!!modalData} onOpenChange={(open) => { if (!open) setModalData(null); }}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="text-base">
              Comissões — {modalData?.repName} — {modalData?.month}/{filterYear}
            </DialogTitle>
          </DialogHeader>
          {modalData && (
            <ScrollArea className="max-h-[400px]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Cliente</TableHead>
                    <TableHead>Máquina</TableHead>
                    <TableHead className="text-right">FOB (USD)</TableHead>
                    <TableHead className="text-right">% Com.</TableHead>
                    <TableHead className="text-right">Comissão</TableHead>
                    <TableHead className="text-right">Dólar</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {modalData.deals.map(d => {
                    const totalComm = d.seller_commission_value + d.manager_commission_value;
                    const totalPct = d.seller_commission_pct + d.manager_commission_pct;
                    return (
                      <TableRow key={d.id}>
                        <TableCell className="text-sm">{d.client_name}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">{d.machine_name || "—"}</TableCell>
                        <TableCell className="text-right text-sm">{formatUsd(d.fob_cost)}</TableCell>
                        <TableCell className="text-right text-sm">{formatPct(totalPct)}</TableCell>
                        <TableCell className="text-right text-sm font-semibold">{formatUsd(totalComm)}</TableCell>
                        <TableCell className="text-right text-sm text-muted-foreground">
                          R$ {d.dollar_rate.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                  <TableRow className="border-t-2 border-primary/30 bg-primary/5 font-bold">
                    <TableCell colSpan={4} className="font-bold text-sm">TOTAL</TableCell>
                    <TableCell className="text-right font-bold text-sm">
                      {formatUsd(modalData.deals.reduce((s, d) => s + d.seller_commission_value + d.manager_commission_value, 0))}
                    </TableCell>
                    <TableCell />
                  </TableRow>
                </TableBody>
              </Table>
            </ScrollArea>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default CommissionsTab;
