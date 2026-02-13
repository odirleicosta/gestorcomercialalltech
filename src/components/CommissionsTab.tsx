import { useState, useMemo, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  DollarSign, Users, TrendingUp, Calendar, Percent, BarChart3,
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

  const now = new Date();
  const [filterYear, setFilterYear] = useState(now.getFullYear());
  const [filterRep, setFilterRep] = useState("all");
  const [viewMode, setViewMode] = useState<"monthly" | "yearly">("monthly");

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

  // Filter closed deals by year and rep
  const closedDeals = useMemo(() => {
    return deals.filter((d) => {
      if (d.status !== "closed" || !d.closed_at) return false;
      const dt = new Date(d.closed_at);
      const matchYear = dt.getFullYear() === filterYear;
      const matchRep = filterRep === "all" || d.representative_id === filterRep;
      return matchYear && matchRep;
    });
  }, [deals, filterYear, filterRep]);

  // Monthly breakdown
  const monthlyData = useMemo(() => {
    return MONTHS.map((name, i) => {
      const monthNum = i + 1;
      const monthDeals = closedDeals.filter((d) => {
        const dt = new Date(d.closed_at!);
        return dt.getMonth() + 1 === monthNum;
      });

      const sellerTotal = monthDeals.reduce((s, d) => s + d.seller_commission_value, 0);
      const managerTotal = monthDeals.reduce((s, d) => s + d.manager_commission_value, 0);
      const totalComm = sellerTotal + managerTotal;
      const totalVendas = monthDeals.reduce((s, d) => s + d.base_price, 0);
      const totalGrossProfit = monthDeals.reduce((s, d) => s + d.gross_profit, 0);
      const avgGrossMargin = totalVendas > 0 ? (totalGrossProfit / totalVendas) * 100 : 0;
      const count = monthDeals.length;

      return { name, shortName: SHORT_MONTHS[i], monthNum, sellerTotal, managerTotal, totalComm, totalVendas, totalGrossProfit, avgGrossMargin, count, deals: monthDeals };
    });
  }, [closedDeals]);

  // Yearly totals
  const yearTotals = useMemo(() => {
    const sellerTotal = closedDeals.reduce((s, d) => s + d.seller_commission_value, 0);
    const managerTotal = closedDeals.reduce((s, d) => s + d.manager_commission_value, 0);
    const totalComm = sellerTotal + managerTotal;
    const totalVendas = closedDeals.reduce((s, d) => s + d.base_price, 0);
    const totalGrossProfit = closedDeals.reduce((s, d) => s + d.gross_profit, 0);
    const avgGrossMargin = totalVendas > 0 ? (totalGrossProfit / totalVendas) * 100 : 0;
    const count = closedDeals.length;
    return { sellerTotal, managerTotal, totalComm, totalVendas, totalGrossProfit, avgGrossMargin, count };
  }, [closedDeals]);

  // Per-representative breakdown for yearly view
  const repBreakdown = useMemo(() => {
    if (filterRep !== "all") return [];
    const repMap = new Map<string, { repId: string | null; nome: string; seller: number; manager: number; total: number; vendas: number; grossProfit: number; count: number }>();

    closedDeals.forEach((d) => {
      const key = d.representative_id || "__none__";
      const existing = repMap.get(key) || {
        repId: d.representative_id,
        nome: getRepName(d.representative_id),
        seller: 0, manager: 0, total: 0, vendas: 0, grossProfit: 0, count: 0,
      };
      existing.seller += d.seller_commission_value;
      existing.manager += d.manager_commission_value;
      existing.total += d.seller_commission_value + d.manager_commission_value;
      existing.vendas += d.base_price;
      existing.grossProfit += d.gross_profit;
      existing.count += 1;
      repMap.set(key, existing);
    });

    return Array.from(repMap.values()).sort((a, b) => b.total - a.total);
  }, [closedDeals, reps, filterRep]);

  const formatUsd = (v: number) =>
    `US$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const formatPct = (v: number) =>
    v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + "%";

  if (loading) return <p className="text-muted-foreground text-center py-8">Carregando...</p>;

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h2 className="font-heading text-xl font-bold text-foreground flex items-center gap-2">
          <DollarSign className="h-5 w-5" /> Comissões
        </h2>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-end">
        <div>
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
        <div>
          <Label className="text-xs text-muted-foreground">Representante</Label>
          <Select value={filterRep} onValueChange={setFilterRep}>
            <SelectTrigger className="w-[200px] bg-secondary/50 border-border text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              {reps.map((r) => (
                <SelectItem key={r.id} value={r.id}>{r.nome}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-xs text-muted-foreground">Visão</Label>
          <Select value={viewMode} onValueChange={(v) => setViewMode(v as "monthly" | "yearly")}>
            <SelectTrigger className="w-[140px] bg-secondary/50 border-border text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="monthly">Mensal</SelectItem>
              <SelectItem value="yearly">Anual</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Summary Cards */}
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
            <span className="text-xs text-muted-foreground">Com. Vendedor</span>
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
            <span className="text-xs text-muted-foreground">Margem Bruta Média</span>
          </div>
          <p className="text-lg font-bold text-foreground">{yearTotals.count > 0 ? formatPct(yearTotals.avgGrossMargin) : "—"}</p>
        </Card>
        <Card className="p-4 border-border bg-card shadow-sm">
          <div className="flex items-center gap-2 mb-1">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#F97316]/10">
              <BarChart3 className="h-4 w-4 text-[#F97316]" />
            </div>
            <span className="text-xs text-muted-foreground">Vendas Fechadas</span>
          </div>
          <p className="text-lg font-bold text-foreground">{yearTotals.count}</p>
          <p className="text-xs text-muted-foreground">{formatUsd(yearTotals.totalVendas)} FOB</p>
        </Card>
      </div>

      {/* Monthly View */}
      {viewMode === "monthly" && (
        <Card className="border-border bg-card p-6 shadow-sm">
          <h3 className="font-heading text-base font-semibold text-card-foreground mb-4 flex items-center gap-2">
            <Calendar className="h-4 w-4" /> Comissões Mês a Mês — {filterYear}
          </h3>
          <ScrollArea className="max-h-[500px]">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Mês</TableHead>
                  <TableHead className="text-center">Vendas</TableHead>
                  <TableHead className="text-right">Faturamento FOB</TableHead>
                  <TableHead className="text-right">Margem Bruta</TableHead>
                  <TableHead className="text-right">Com. Vendedor</TableHead>
                  <TableHead className="text-right">Com. Gestor</TableHead>
                  <TableHead className="text-right">Total Comissões</TableHead>
                  <TableHead className="text-right">% s/ Faturamento</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {monthlyData.map((m) => {
                  const pct = m.totalVendas > 0 ? (m.totalComm / m.totalVendas) * 100 : 0;
                  return (
                    <TableRow key={m.monthNum} className={m.count === 0 ? "opacity-40" : ""}>
                      <TableCell className="font-medium text-sm">{m.name}</TableCell>
                      <TableCell className="text-center text-sm">{m.count}</TableCell>
                      <TableCell className="text-right text-sm">{m.count > 0 ? formatUsd(m.totalVendas) : "—"}</TableCell>
                      <TableCell className="text-right text-sm text-[#8B5CF6] font-medium">{m.count > 0 ? formatPct(m.avgGrossMargin) : "—"}</TableCell>
                      <TableCell className="text-right text-sm text-[#22C55E]">{m.count > 0 ? formatUsd(m.sellerTotal) : "—"}</TableCell>
                      <TableCell className="text-right text-sm text-[#3B82F6]">{m.count > 0 ? formatUsd(m.managerTotal) : "—"}</TableCell>
                      <TableCell className="text-right text-sm font-semibold">{m.count > 0 ? formatUsd(m.totalComm) : "—"}</TableCell>
                      <TableCell className="text-right text-sm text-muted-foreground">{m.count > 0 ? formatPct(pct) : "—"}</TableCell>
                    </TableRow>
                  );
                })}
                {/* Total row */}
                <TableRow className="border-t-2 border-primary/30 bg-primary/5 font-bold">
                  <TableCell className="font-bold text-sm">TOTAL {filterYear}</TableCell>
                  <TableCell className="text-center font-bold text-sm">{yearTotals.count}</TableCell>
                  <TableCell className="text-right font-bold text-sm">{formatUsd(yearTotals.totalVendas)}</TableCell>
                  <TableCell className="text-right font-bold text-sm text-[#8B5CF6]">{yearTotals.count > 0 ? formatPct(yearTotals.avgGrossMargin) : "—"}</TableCell>
                  <TableCell className="text-right font-bold text-sm text-[#22C55E]">{formatUsd(yearTotals.sellerTotal)}</TableCell>
                  <TableCell className="text-right font-bold text-sm text-[#3B82F6]">{formatUsd(yearTotals.managerTotal)}</TableCell>
                  <TableCell className="text-right font-bold text-sm">{formatUsd(yearTotals.totalComm)}</TableCell>
                  <TableCell className="text-right font-bold text-sm text-muted-foreground">
                    {yearTotals.totalVendas > 0 ? formatPct((yearTotals.totalComm / yearTotals.totalVendas) * 100) : "—"}
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </ScrollArea>

          {/* Monthly detail: deals per month */}
          {monthlyData.filter((m) => m.count > 0).map((m) => (
            <div key={m.monthNum} className="mt-6">
              <h4 className="text-sm font-semibold text-foreground mb-2 flex items-center gap-2">
                <Badge variant="outline" className="text-xs">{m.name}</Badge>
                <span className="text-muted-foreground font-normal">{m.count} venda{m.count !== 1 ? "s" : ""}</span>
              </h4>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Cliente</TableHead>
                    <TableHead>Máquina</TableHead>
                    <TableHead>Representante</TableHead>
                    <TableHead className="text-right">Preço Venda FOB</TableHead>
                    <TableHead className="text-right">Margem Bruta</TableHead>
                    <TableHead className="text-right">Com. Vendedor</TableHead>
                    <TableHead className="text-right">Com. Gestor</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {m.deals.map((d) => (
                    <TableRow key={d.id}>
                      <TableCell className="text-sm">{d.client_name}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{d.machine_name || "—"}</TableCell>
                      <TableCell className="text-sm">
                        <Badge variant="secondary" className="text-xs">{getRepName(d.representative_id)}</Badge>
                      </TableCell>
                      <TableCell className="text-right text-sm">{formatUsd(d.base_price)}</TableCell>
                      <TableCell className="text-right text-sm text-[#8B5CF6] font-medium">{formatPct(d.gross_margin_percent)}</TableCell>
                      <TableCell className="text-right text-sm text-[#22C55E]">
                        {formatUsd(d.seller_commission_value)}
                        <span className="text-xs text-muted-foreground ml-1">({formatPct(d.seller_commission_pct)})</span>
                      </TableCell>
                      <TableCell className="text-right text-sm text-[#3B82F6]">
                        {formatUsd(d.manager_commission_value)}
                        <span className="text-xs text-muted-foreground ml-1">({formatPct(d.manager_commission_pct)})</span>
                      </TableCell>
                      <TableCell className="text-right text-sm font-semibold">
                        {formatUsd(d.seller_commission_value + d.manager_commission_value)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ))}
        </Card>
      )}

      {/* Yearly View — per representative breakdown */}
      {viewMode === "yearly" && (
        <Card className="border-border bg-card p-6 shadow-sm">
          <h3 className="font-heading text-base font-semibold text-card-foreground mb-4 flex items-center gap-2">
            <BarChart3 className="h-4 w-4" /> Resumo Anual {filterYear}
            {filterRep !== "all" && (
              <Badge variant="secondary" className="text-xs ml-2">{reps.find((r) => r.id === filterRep)?.nome}</Badge>
            )}
          </h3>

          {/* Per-rep breakdown (only when "all") */}
          {filterRep === "all" && repBreakdown.length > 0 && (
            <>
              <h4 className="text-sm font-semibold text-muted-foreground mb-3 flex items-center gap-2">
                <Users className="h-4 w-4" /> Por Representante
              </h4>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Representante</TableHead>
                    <TableHead className="text-center">Vendas</TableHead>
                    <TableHead className="text-right">Faturamento FOB</TableHead>
                    <TableHead className="text-right">Margem Bruta</TableHead>
                    <TableHead className="text-right">Com. Vendedor</TableHead>
                    <TableHead className="text-right">Com. Gestor</TableHead>
                    <TableHead className="text-right">Total Comissões</TableHead>
                    <TableHead className="text-right">% s/ Faturamento</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {repBreakdown.map((r) => {
                    const pct = r.vendas > 0 ? (r.total / r.vendas) * 100 : 0;
                    const grossMarginPct = r.vendas > 0 ? (r.grossProfit / r.vendas) * 100 : 0;
                    return (
                      <TableRow key={r.repId || "__none__"}>
                        <TableCell className="font-medium text-sm">{r.nome}</TableCell>
                        <TableCell className="text-center text-sm">{r.count}</TableCell>
                        <TableCell className="text-right text-sm">{formatUsd(r.vendas)}</TableCell>
                        <TableCell className="text-right text-sm text-[#8B5CF6] font-medium">{formatPct(grossMarginPct)}</TableCell>
                        <TableCell className="text-right text-sm text-[#22C55E]">{formatUsd(r.seller)}</TableCell>
                        <TableCell className="text-right text-sm text-[#3B82F6]">{formatUsd(r.manager)}</TableCell>
                        <TableCell className="text-right text-sm font-semibold">{formatUsd(r.total)}</TableCell>
                        <TableCell className="text-right text-sm text-muted-foreground">{formatPct(pct)}</TableCell>
                      </TableRow>
                    );
                  })}
                  <TableRow className="border-t-2 border-primary/30 bg-primary/5 font-bold">
                    <TableCell className="font-bold text-sm">TOTAL</TableCell>
                    <TableCell className="text-center font-bold text-sm">{yearTotals.count}</TableCell>
                    <TableCell className="text-right font-bold text-sm">{formatUsd(yearTotals.totalVendas)}</TableCell>
                    <TableCell className="text-right font-bold text-sm text-[#8B5CF6]">{yearTotals.count > 0 ? formatPct(yearTotals.avgGrossMargin) : "—"}</TableCell>
                    <TableCell className="text-right font-bold text-sm text-[#22C55E]">{formatUsd(yearTotals.sellerTotal)}</TableCell>
                    <TableCell className="text-right font-bold text-sm text-[#3B82F6]">{formatUsd(yearTotals.managerTotal)}</TableCell>
                    <TableCell className="text-right font-bold text-sm">{formatUsd(yearTotals.totalComm)}</TableCell>
                    <TableCell className="text-right font-bold text-sm text-muted-foreground">
                      {yearTotals.totalVendas > 0 ? formatPct((yearTotals.totalComm / yearTotals.totalVendas) * 100) : "—"}
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
              <Separator className="my-6" />
            </>
          )}

          {/* All deals of the year */}
          <h4 className="text-sm font-semibold text-muted-foreground mb-3">Todas as Vendas — {filterYear}</h4>
          {closedDeals.length === 0 ? (
            <p className="text-muted-foreground text-center py-6 text-sm">Nenhuma venda fechada neste período.</p>
          ) : (
            <ScrollArea className="max-h-[500px]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data</TableHead>
                    <TableHead>Cliente</TableHead>
                    <TableHead>Máquina</TableHead>
                    <TableHead>Representante</TableHead>
                    <TableHead className="text-right">Preço Venda FOB</TableHead>
                    <TableHead className="text-right">Margem Bruta</TableHead>
                    <TableHead className="text-right">Com. Vendedor</TableHead>
                    <TableHead className="text-right">Com. Gestor</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {closedDeals.map((d) => (
                    <TableRow key={d.id}>
                      <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                        {d.closed_at ? new Date(d.closed_at).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }) : "—"}
                      </TableCell>
                      <TableCell className="text-sm">{d.client_name}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{d.machine_name || "—"}</TableCell>
                      <TableCell className="text-sm">
                        <Badge variant="secondary" className="text-xs">{getRepName(d.representative_id)}</Badge>
                      </TableCell>
                      <TableCell className="text-right text-sm">{formatUsd(d.base_price)}</TableCell>
                      <TableCell className="text-right text-sm text-[#8B5CF6] font-medium">{formatPct(d.gross_margin_percent)}</TableCell>
                      <TableCell className="text-right text-sm text-[#22C55E]">
                        {formatUsd(d.seller_commission_value)}
                        <span className="text-xs text-muted-foreground ml-1">({formatPct(d.seller_commission_pct)})</span>
                      </TableCell>
                      <TableCell className="text-right text-sm text-[#3B82F6]">
                        {formatUsd(d.manager_commission_value)}
                        <span className="text-xs text-muted-foreground ml-1">({formatPct(d.manager_commission_pct)})</span>
                      </TableCell>
                      <TableCell className="text-right text-sm font-semibold">
                        {formatUsd(d.seller_commission_value + d.manager_commission_value)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollArea>
          )}
        </Card>
      )}
    </div>
  );
};

export default CommissionsTab;
