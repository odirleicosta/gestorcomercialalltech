import { useState, useMemo, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  DollarSign, Percent, TrendingUp, TrendingDown, Package, Receipt,
  Save, Lock, Unlock, Trash2, Search, Eye, EyeOff, Users, History, Clock,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

export interface Deal {
  id: string;
  user_id: string;
  client_name: string;
  machine_name: string;
  fob_cost: number;
  dollar_rate: number;
  estimated_tax_percent: number;
  estimated_tax_value: number;
  desired_margin_percent: number;
  base_price: number;
  final_price: number;
  gross_profit: number;
  gross_margin_percent: number;
  commission_base: "FOB" | "PRECO_VENDA";
  seller_commission_pct: number;
  manager_commission_pct: number;
  seller_commission_value: number;
  manager_commission_value: number;
  net_profit: number;
  net_margin_percent: number;
  status: "open" | "closed";
  closed_at: string | null;
  observation: string | null;
  created_at: string;
  updated_at: string;
}

interface CommissionLog {
  id: string;
  deal_id: string;
  field_changed: string;
  old_value: number;
  new_value: number;
  changed_at: string;
}

interface Props {
  userId: string;
}

const DealManager = ({ userId }: Props) => {
  const { toast } = useToast();
  const [deals, setDeals] = useState<Deal[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState<string>("all");

  // Default commission from profile
  const [defaultSellerPct, setDefaultSellerPct] = useState(3);
  const [defaultManagerPct, setDefaultManagerPct] = useState(1);
  const [defaultCommBase, setDefaultCommBase] = useState<"FOB" | "PRECO_VENDA">("FOB");

  // Form state for new deal
  const [clientName, setClientName] = useState("");
  const [machineName, setMachineName] = useState("");
  const [fobCost, setFobCost] = useState("");
  const [dollarRate, setDollarRate] = useState("");
  const [estimatedTaxPercent, setEstimatedTaxPercent] = useState("");
  const [desiredMargin, setDesiredMargin] = useState("");
  const [commissionBase, setCommissionBase] = useState<"FOB" | "PRECO_VENDA">("FOB");
  const [sellerPct, setSellerPct] = useState("");
  const [managerPct, setManagerPct] = useState("");
  const [observation, setObservation] = useState("");
  const [showForm, setShowForm] = useState(false);

  // Edit commission state
  const [editingCommission, setEditingCommission] = useState<string | null>(null);
  const [editSellerPct, setEditSellerPct] = useState("");
  const [editManagerPct, setEditManagerPct] = useState("");
  const [editCommissionBase, setEditCommissionBase] = useState<"FOB" | "PRECO_VENDA">("FOB");

  // Commission history
  const [commissionLogs, setCommissionLogs] = useState<CommissionLog[]>([]);
  const [showLogsForDeal, setShowLogsForDeal] = useState<string | null>(null);

  // Load profile defaults
  useEffect(() => {
    const loadDefaults = async () => {
      const { data } = await supabase
        .from("profiles" as any)
        .select("default_seller_commission_pct, default_manager_commission_pct, default_commission_base")
        .eq("id", userId)
        .single();
      if (data) {
        const d = data as any;
        setDefaultSellerPct(d.default_seller_commission_pct ?? 3);
        setDefaultManagerPct(d.default_manager_commission_pct ?? 1);
        setDefaultCommBase(d.default_commission_base ?? "FOB");
      }
    };
    loadDefaults();
  }, [userId]);

  const fetchDeals = async () => {
    const { data, error } = await supabase
      .from("deals" as any)
      .select("*")
      .order("created_at", { ascending: false });
    if (!error && data) setDeals(data as unknown as Deal[]);
    setLoading(false);
  };

  useEffect(() => { fetchDeals(); }, []);

  const fetchCommissionLogs = async (dealId: string) => {
    const { data } = await supabase
      .from("commission_history" as any)
      .select("*")
      .eq("deal_id", dealId)
      .order("changed_at", { ascending: false });
    if (data) setCommissionLogs(data as unknown as CommissionLog[]);
  };

  // Pre-fill defaults when opening form
  const openForm = () => {
    setSellerPct(String(defaultSellerPct));
    setManagerPct(String(defaultManagerPct));
    setCommissionBase(defaultCommBase);
    setShowForm(true);
  };

  const simulation = useMemo(() => {
    const fob = parseFloat(fobCost) || 0;
    const taxPct = parseFloat(estimatedTaxPercent) || 0;
    const margin = parseFloat(desiredMargin) || 0;
    const sPct = parseFloat(sellerPct) || 0;
    const mPct = parseFloat(managerPct) || 0;
    if (fob <= 0 || margin >= 100) return null;

    const taxValue = fob * (taxPct / 100);
    const basePrice = fob / (1 - margin / 100);
    const finalPrice = basePrice + taxValue;
    const grossProfit = basePrice - fob;
    const grossMargin = (grossProfit / basePrice) * 100;

    const commBase = commissionBase === "FOB" ? fob : basePrice;
    const sellerComm = commBase * (sPct / 100);
    const managerComm = commBase * (mPct / 100);
    const netProfit = grossProfit - sellerComm - managerComm;
    const netMargin = basePrice > 0 ? (netProfit / basePrice) * 100 : 0;

    const dollar = parseFloat(dollarRate) || 0;
    const hasDollar = dollar > 0;

    return {
      fob, taxValue, basePrice, finalPrice, grossProfit, grossMargin,
      sellerComm, managerComm, netProfit, netMargin, commBase,
      dollar, hasDollar,
      basePriceBrl: hasDollar ? basePrice * dollar : 0,
      finalPriceBrl: hasDollar ? finalPrice * dollar : 0,
    };
  }, [fobCost, estimatedTaxPercent, desiredMargin, sellerPct, managerPct, commissionBase, dollarRate]);

  const handleSave = async () => {
    if (!simulation || !clientName.trim()) {
      toast({ title: "Preencha cliente e dados da simulação", variant: "destructive" });
      return;
    }

    const insert = {
      user_id: userId,
      client_name: clientName.trim(),
      machine_name: machineName.trim(),
      fob_cost: simulation.fob,
      dollar_rate: simulation.dollar,
      estimated_tax_percent: parseFloat(estimatedTaxPercent) || 0,
      estimated_tax_value: simulation.taxValue,
      desired_margin_percent: parseFloat(desiredMargin) || 0,
      base_price: simulation.basePrice,
      final_price: simulation.finalPrice,
      gross_profit: simulation.grossProfit,
      gross_margin_percent: simulation.grossMargin,
      commission_base: commissionBase,
      seller_commission_pct: parseFloat(sellerPct) || 0,
      manager_commission_pct: parseFloat(managerPct) || 0,
      seller_commission_value: simulation.sellerComm,
      manager_commission_value: simulation.managerComm,
      net_profit: simulation.netProfit,
      net_margin_percent: simulation.netMargin,
      observation: observation.trim() || null,
    };

    const { error } = await supabase.from("deals" as any).insert(insert as any);
    if (error) {
      toast({ title: "Erro ao salvar", description: error.message, variant: "destructive" });
      return;
    }

    toast({ title: "Negociação salva!" });
    resetForm();
    fetchDeals();
  };

  const resetForm = () => {
    setClientName(""); setMachineName(""); setFobCost(""); setDollarRate("");
    setEstimatedTaxPercent(""); setDesiredMargin(""); setSellerPct("");
    setManagerPct(""); setObservation(""); setShowForm(false);
  };

  const handleClose = async (deal: Deal) => {
    if (deal.status === "closed") return;
    const { error } = await supabase
      .from("deals" as any)
      .update({ status: "closed", closed_at: new Date().toISOString() } as any)
      .eq("id", deal.id);
    if (error) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Venda fechada!" });
    fetchDeals();
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from("deals" as any).delete().eq("id", id);
    if (error) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
      return;
    }
    fetchDeals();
  };

  const handleUpdateCommission = async (deal: Deal) => {
    const sPct = parseFloat(editSellerPct) || 0;
    const mPct = parseFloat(editManagerPct) || 0;
    const commBase = editCommissionBase === "FOB" ? deal.fob_cost : deal.base_price;
    const sellerComm = commBase * (sPct / 100);
    const managerComm = commBase * (mPct / 100);
    const netProfit = deal.gross_profit - sellerComm - managerComm;
    const netMargin = deal.base_price > 0 ? (netProfit / deal.base_price) * 100 : 0;

    // Log changes
    const logs: any[] = [];
    if (deal.seller_commission_pct !== sPct) {
      logs.push({ deal_id: deal.id, user_id: userId, field_changed: "seller_commission_pct", old_value: deal.seller_commission_pct, new_value: sPct });
    }
    if (deal.manager_commission_pct !== mPct) {
      logs.push({ deal_id: deal.id, user_id: userId, field_changed: "manager_commission_pct", old_value: deal.manager_commission_pct, new_value: mPct });
    }

    if (logs.length > 0) {
      await supabase.from("commission_history" as any).insert(logs as any);
    }

    const { error } = await supabase
      .from("deals" as any)
      .update({
        commission_base: editCommissionBase,
        seller_commission_pct: sPct,
        manager_commission_pct: mPct,
        seller_commission_value: sellerComm,
        manager_commission_value: managerComm,
        net_profit: netProfit,
        net_margin_percent: netMargin,
      } as any)
      .eq("id", deal.id);

    if (error) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Comissões atualizadas! Histórico registrado." });
    setEditingCommission(null);
    fetchDeals();
  };

  // Save default commission settings
  const handleSaveDefaults = async () => {
    const { error } = await supabase
      .from("profiles" as any)
      .update({
        default_seller_commission_pct: defaultSellerPct,
        default_manager_commission_pct: defaultManagerPct,
        default_commission_base: defaultCommBase,
      } as any)
      .eq("id", userId);
    if (error) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Padrões de comissão salvos!" });
    }
  };

  const filtered = useMemo(() => {
    return deals.filter((d) => {
      const matchSearch = !search ||
        d.client_name.toLowerCase().includes(search.toLowerCase()) ||
        d.machine_name.toLowerCase().includes(search.toLowerCase());
      const matchStatus = filterStatus === "all" || d.status === filterStatus;
      return matchSearch && matchStatus;
    });
  }, [deals, search, filterStatus]);

  const formatUsd = (v: number) =>
    `US$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const formatPct = (v: number) =>
    v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + "%";

  return (
    <div className="space-y-6">
      {/* Header + defaults */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h2 className="font-heading text-lg font-semibold text-foreground flex items-center gap-2">
          <Users className="h-5 w-5" /> Negociações
        </h2>
        <Button onClick={() => showForm ? resetForm() : openForm()} variant={showForm ? "secondary" : "default"}>
          {showForm ? "Fechar Formulário" : "Nova Negociação"}
        </Button>
      </div>

      {/* Default commission settings */}
      <Card className="border-border bg-card p-4 shadow-sm">
        <h3 className="text-sm font-semibold text-card-foreground mb-3 flex items-center gap-2">
          <Percent className="h-4 w-4" /> Comissões Padrão
        </h3>
        <div className="flex flex-wrap gap-3 items-end">
          <div>
            <Label className="text-xs text-muted-foreground">Base</Label>
            <Select value={defaultCommBase} onValueChange={(v) => setDefaultCommBase(v as "FOB" | "PRECO_VENDA")}>
              <SelectTrigger className="w-[140px] h-8 text-xs bg-secondary/50 border-border"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="FOB">FOB</SelectItem>
                <SelectItem value="PRECO_VENDA">Preço Venda</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">Vendedor (%)</Label>
            <Input type="number" step="0.01" value={defaultSellerPct} onChange={(e) => setDefaultSellerPct(parseFloat(e.target.value) || 0)} className="w-24 h-8 text-xs bg-secondary/50 border-border" />
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">Gestor (%)</Label>
            <Input type="number" step="0.01" value={defaultManagerPct} onChange={(e) => setDefaultManagerPct(parseFloat(e.target.value) || 0)} className="w-24 h-8 text-xs bg-secondary/50 border-border" />
          </div>
          <Button size="sm" variant="outline" className="h-8 text-xs" onClick={handleSaveDefaults}>
            <Save className="h-3 w-3 mr-1" /> Salvar Padrões
          </Button>
        </div>
      </Card>

      {/* New deal form */}
      {showForm && (
        <Card className="border-border bg-card p-6 shadow-sm">
          <h3 className="font-heading text-base font-semibold text-card-foreground mb-4">Nova Negociação</h3>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            <div>
              <Label className="mb-1.5 text-sm text-muted-foreground">Cliente *</Label>
              <Input value={clientName} onChange={(e) => setClientName(e.target.value)} placeholder="Nome do cliente" className="bg-secondary/50 border-border" />
            </div>
            <div>
              <Label className="mb-1.5 text-sm text-muted-foreground">Máquina</Label>
              <Input value={machineName} onChange={(e) => setMachineName(e.target.value)} placeholder="Nome da máquina" className="bg-secondary/50 border-border" />
            </div>
            <div>
              <Label className="mb-1.5 text-sm text-muted-foreground">Custo FOB (USD) *</Label>
              <Input type="number" step="0.01" min="0" value={fobCost} onChange={(e) => setFobCost(e.target.value)} placeholder="0,00" className="bg-secondary/50 border-border" />
            </div>
            <div>
              <Label className="mb-1.5 text-sm text-muted-foreground">Cotação do Dólar</Label>
              <Input type="number" step="0.01" min="0" value={dollarRate} onChange={(e) => setDollarRate(e.target.value)} placeholder="0,00" className="bg-secondary/50 border-border" />
            </div>
            <div>
              <Label className="mb-1.5 text-sm text-muted-foreground">Impostos Estimados (%)</Label>
              <Input type="number" step="0.01" min="0" value={estimatedTaxPercent} onChange={(e) => setEstimatedTaxPercent(e.target.value)} placeholder="0,00" className="bg-secondary/50 border-border" />
            </div>
            <div>
              <Label className="mb-1.5 text-sm text-muted-foreground">Margem Desejada (%)</Label>
              <Input type="number" step="0.01" min="0" value={desiredMargin} onChange={(e) => setDesiredMargin(e.target.value)} placeholder="0,00" className="bg-secondary/50 border-border" />
            </div>
            <div>
              <Label className="mb-1.5 text-sm text-muted-foreground">Base da Comissão</Label>
              <Select value={commissionBase} onValueChange={(v) => setCommissionBase(v as "FOB" | "PRECO_VENDA")}>
                <SelectTrigger className="bg-secondary/50 border-border"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="FOB">FOB (Custo)</SelectItem>
                  <SelectItem value="PRECO_VENDA">Preço de Venda (Base)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="mb-1.5 text-sm text-muted-foreground">Comissão Vendedor (%)</Label>
              <Input type="number" step="0.01" min="0" value={sellerPct} onChange={(e) => setSellerPct(e.target.value)} placeholder="0,00" className="bg-secondary/50 border-border" />
            </div>
            <div>
              <Label className="mb-1.5 text-sm text-muted-foreground">Comissão Gestor (%)</Label>
              <Input type="number" step="0.01" min="0" value={managerPct} onChange={(e) => setManagerPct(e.target.value)} placeholder="0,00" className="bg-secondary/50 border-border" />
            </div>
            <div className="md:col-span-2 lg:col-span-3">
              <Label className="mb-1.5 text-sm text-muted-foreground">Observação</Label>
              <Textarea value={observation} onChange={(e) => setObservation(e.target.value)} placeholder="Observações sobre a negociação..." className="bg-secondary/50 border-border" />
            </div>
          </div>

          {/* Live simulation preview */}
          {simulation && (
            <Card className="mt-4 border-primary/20 bg-primary/5 p-4">
              <h4 className="font-heading text-sm font-semibold text-primary mb-3">Prévia da Simulação</h4>
              <div className="grid gap-2 md:grid-cols-2 lg:grid-cols-4 text-sm">
                <div><span className="text-muted-foreground">Preço Base:</span> <span className="font-semibold">{formatUsd(simulation.basePrice)}</span></div>
                <div><span className="text-muted-foreground">Preço Final:</span> <span className="font-semibold">{formatUsd(simulation.finalPrice)}</span></div>
                <div><span className="text-muted-foreground">Lucro Bruto:</span> <span className="font-semibold text-accent">{formatUsd(simulation.grossProfit)}</span></div>
                <div><span className="text-muted-foreground">Margem Bruta:</span> <span className="font-semibold">{formatPct(simulation.grossMargin)}</span></div>
                <div><span className="text-muted-foreground">Com. Vendedor ({formatPct(parseFloat(sellerPct) || 0)}):</span> <span className="font-semibold text-warning">{formatUsd(simulation.sellerComm)}</span></div>
                <div><span className="text-muted-foreground">Com. Gestor ({formatPct(parseFloat(managerPct) || 0)}):</span> <span className="font-semibold text-warning">{formatUsd(simulation.managerComm)}</span></div>
                <div className="bg-accent/10 rounded px-2 py-1 -mx-2"><span className="text-muted-foreground">Lucro Líquido:</span> <span className={`font-bold text-base ${simulation.netProfit < 0 ? "text-destructive" : "text-accent"}`}>{formatUsd(simulation.netProfit)}</span></div>
                <div className="bg-accent/10 rounded px-2 py-1 -mx-2"><span className="text-muted-foreground">Margem Líquida:</span> <span className={`font-bold text-base ${simulation.netMargin < 0 ? "text-destructive" : "text-accent"}`}>{formatPct(simulation.netMargin)}</span></div>
              </div>
              {simulation.hasDollar && (
                <div className="mt-2 text-xs text-muted-foreground">
                  Base BRL: {simulation.basePriceBrl.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })} | Final BRL: {simulation.finalPriceBrl.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                </div>
              )}
            </Card>
          )}

          <div className="flex gap-3 mt-4">
            <Button onClick={handleSave} disabled={!simulation || !clientName.trim()}>
              <Save className="h-4 w-4 mr-2" /> Salvar Negociação
            </Button>
            <Button variant="outline" onClick={resetForm}>Cancelar</Button>
          </div>
        </Card>
      )}

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar cliente ou máquina..." className="pl-9 bg-secondary/50 border-border text-sm" />
        </div>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-[160px] bg-secondary/50 border-border text-sm"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="open">Abertas</SelectItem>
            <SelectItem value="closed">Fechadas</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Deals list */}
      {loading ? (
        <p className="text-muted-foreground text-center py-8">Carregando...</p>
      ) : filtered.length === 0 ? (
        <p className="text-muted-foreground text-center py-8">Nenhuma negociação encontrada.</p>
      ) : (
        <ScrollArea className="h-[600px]">
          <div className="space-y-3">
            {filtered.map((deal) => (
              <Card key={deal.id} className={`border-border p-4 shadow-sm ${deal.status === "closed" ? "bg-muted/30" : "bg-card"}`}>
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <Badge variant={deal.status === "closed" ? "secondary" : "default"} className="text-xs">
                        {deal.status === "closed" ? <Lock className="h-3 w-3 mr-1" /> : <Unlock className="h-3 w-3 mr-1" />}
                        {deal.status === "closed" ? "Fechada" : "Aberta"}
                      </Badge>
                      <span className="font-semibold text-sm truncate">{deal.client_name}</span>
                      {deal.machine_name && <span className="text-xs text-muted-foreground truncate">— {deal.machine_name}</span>}
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-x-4 gap-y-1 text-xs">
                      <div><span className="text-muted-foreground">Preço Base:</span> <span className="font-medium">{formatUsd(deal.base_price)}</span></div>
                      <div><span className="text-muted-foreground">Preço Final:</span> <span className="font-medium">{formatUsd(deal.final_price)}</span></div>
                      <div><span className="text-muted-foreground">Lucro Bruto:</span> <span className="font-medium text-accent">{formatUsd(deal.gross_profit)}</span></div>
                      <div><span className="text-muted-foreground">M. Bruta:</span> <span className="font-medium">{formatPct(deal.gross_margin_percent)}</span></div>
                      <div><span className="text-muted-foreground">Com. Vend. ({formatPct(deal.seller_commission_pct)}):</span> <span className="font-medium text-warning">{formatUsd(deal.seller_commission_value)}</span></div>
                      <div><span className="text-muted-foreground">Com. Gest. ({formatPct(deal.manager_commission_pct)}):</span> <span className="font-medium text-warning">{formatUsd(deal.manager_commission_value)}</span></div>
                      <div className="bg-accent/10 rounded px-1"><span className="text-muted-foreground">Lucro Líq.:</span> <span className={`font-bold ${deal.net_profit < 0 ? "text-destructive" : "text-accent"}`}>{formatUsd(deal.net_profit)}</span></div>
                      <div className="bg-accent/10 rounded px-1"><span className="text-muted-foreground">M. Líquida:</span> <span className={`font-bold ${deal.net_margin_percent < 0 ? "text-destructive" : "text-accent"}`}>{formatPct(deal.net_margin_percent)}</span></div>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setExpandedId(expandedId === deal.id ? null : deal.id)}>
                      {expandedId === deal.id ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => {
                      if (showLogsForDeal === deal.id) { setShowLogsForDeal(null); } else { setShowLogsForDeal(deal.id); fetchCommissionLogs(deal.id); }
                    }} title="Histórico de comissões">
                      <Clock className="h-4 w-4" />
                    </Button>
                    {deal.status === "open" && (
                      <>
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => {
                          setEditingCommission(deal.id);
                          setEditSellerPct(String(deal.seller_commission_pct));
                          setEditManagerPct(String(deal.manager_commission_pct));
                          setEditCommissionBase(deal.commission_base as "FOB" | "PRECO_VENDA");
                        }}>
                          <Percent className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleClose(deal)} title="Fechar venda">
                          <Lock className="h-4 w-4 text-primary" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleDelete(deal.id)}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </>
                    )}
                  </div>
                </div>

                {/* Commission history logs */}
                {showLogsForDeal === deal.id && (
                  <div className="mt-3 p-3 border border-border rounded-md bg-muted/30">
                    <p className="text-xs font-semibold text-muted-foreground mb-2 flex items-center gap-1"><History className="h-3 w-3" /> Histórico de Alterações</p>
                    {commissionLogs.length === 0 ? (
                      <p className="text-xs text-muted-foreground">Nenhuma alteração registrada.</p>
                    ) : (
                      <div className="space-y-1">
                        {commissionLogs.map((log) => (
                          <div key={log.id} className="text-xs flex items-center gap-2">
                            <span className="text-muted-foreground">{new Date(log.changed_at).toLocaleString("pt-BR")}</span>
                            <Badge variant="outline" className="text-[10px] h-5">
                              {log.field_changed === "seller_commission_pct" ? "Vendedor" : "Gestor"}
                            </Badge>
                            <span className="text-destructive line-through">{formatPct(log.old_value)}</span>
                            <span>→</span>
                            <span className="text-accent font-medium">{formatPct(log.new_value)}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Edit commission inline */}
                {editingCommission === deal.id && deal.status === "open" && (
                  <div className="mt-3 p-3 border border-border rounded-md bg-secondary/30">
                    <p className="text-xs font-semibold text-muted-foreground mb-2">Editar Comissões</p>
                    <div className="grid grid-cols-3 gap-3">
                      <div>
                        <Label className="text-xs text-muted-foreground">Base</Label>
                        <Select value={editCommissionBase} onValueChange={(v) => setEditCommissionBase(v as "FOB" | "PRECO_VENDA")}>
                          <SelectTrigger className="h-8 text-xs bg-background"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="FOB">FOB</SelectItem>
                            <SelectItem value="PRECO_VENDA">Preço Venda</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label className="text-xs text-muted-foreground">Vendedor (%)</Label>
                        <Input type="number" step="0.01" value={editSellerPct} onChange={(e) => setEditSellerPct(e.target.value)} className="h-8 text-xs bg-background" />
                      </div>
                      <div>
                        <Label className="text-xs text-muted-foreground">Gestor (%)</Label>
                        <Input type="number" step="0.01" value={editManagerPct} onChange={(e) => setEditManagerPct(e.target.value)} className="h-8 text-xs bg-background" />
                      </div>
                    </div>
                    <div className="flex gap-2 mt-2">
                      <Button size="sm" className="h-7 text-xs" onClick={() => handleUpdateCommission(deal)}>Salvar</Button>
                      <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setEditingCommission(null)}>Cancelar</Button>
                    </div>
                  </div>
                )}

                {/* Expanded details */}
                {expandedId === deal.id && (
                  <div className="mt-3 pt-3 border-t border-border text-xs space-y-1 text-muted-foreground">
                    <div>FOB: {formatUsd(deal.fob_cost)} | Impostos: {formatPct(deal.estimated_tax_percent)} = {formatUsd(deal.estimated_tax_value)}</div>
                    <div>Margem: {formatPct(deal.desired_margin_percent)} | Base Comissão: {deal.commission_base === "FOB" ? "FOB" : "Preço Venda"}</div>
                    <div>Com. Vendedor: {formatPct(deal.seller_commission_pct)} = {formatUsd(deal.seller_commission_value)} | Com. Gestor: {formatPct(deal.manager_commission_pct)} = {formatUsd(deal.manager_commission_value)}</div>
                    {deal.observation && <div>Obs: {deal.observation}</div>}
                    <div>Criado: {new Date(deal.created_at).toLocaleString("pt-BR")} {deal.closed_at && `| Fechado: ${new Date(deal.closed_at).toLocaleString("pt-BR")}`}</div>
                  </div>
                )}
              </Card>
            ))}
          </div>
        </ScrollArea>
      )}
    </div>
  );
};

export default DealManager;
