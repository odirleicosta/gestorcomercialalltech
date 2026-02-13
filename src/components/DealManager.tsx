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
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList,
} from "@/components/ui/command";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  DollarSign, Percent, TrendingUp, TrendingDown, Package, Receipt,
  Save, Lock, Unlock, Trash2, Search, Eye, EyeOff, Users, History, Clock,
  ChevronsUpDown, Check, Plus,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";


export const MACHINE_TYPES = ["Centro de Usinagem", "Torno CNC", "Plu.go"] as const;
export type MachineType = typeof MACHINE_TYPES[number];

export interface Deal {
  id: string;
  user_id: string;
  client_name: string;
  machine_name: string;
  machine_type: string;
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
  representative_id: string | null;
  empresa_id: string | null;
  modelo_id: string | null;
  created_at: string;
  updated_at: string;
}

interface RepOption {
  id: string;
  nome: string;
  comissao_padrao_pct: number;
  comissao_gestor_pct: number;
}

interface Empresa {
  id: string;
  nome: string;
  cidade: string | null;
}

interface Modelo {
  id: string;
  marca: string;
  modelo: string;
  tipo: string;
  custo_fob: number;
  preco_venda_fob: number;
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

  // Structured data sources
  const [empresas, setEmpresas] = useState<Empresa[]>([]);
  const [modelos, setModelos] = useState<Modelo[]>([]);
  const [repOptions, setRepOptions] = useState<RepOption[]>([]);

  // Form state for new deal
  const [empresaId, setEmpresaId] = useState("");
  const [modeloId, setModeloId] = useState("");
  const [machineType, setMachineType] = useState("");
  const [fobCost, setFobCost] = useState("");
  const [precoVendaFob, setPrecoVendaFob] = useState("");
  const [dollarRate, setDollarRate] = useState("");
  const [sellerPct, setSellerPct] = useState("");
  const [managerPct, setManagerPct] = useState("");
  const [observation, setObservation] = useState("");
  const [representativeId, setRepresentativeId] = useState("");
  const [showForm, setShowForm] = useState(false);

  // Combobox open states
  const [empresaOpen, setEmpresaOpen] = useState(false);
  const [modeloOpen, setModeloOpen] = useState(false);
  const [repOpen, setRepOpen] = useState(false);

  // New empresa dialog
  const [showNewEmpresa, setShowNewEmpresa] = useState(false);
  const [newEmpresaNome, setNewEmpresaNome] = useState("");
  const [newEmpresaCidade, setNewEmpresaCidade] = useState("");

  // Edit commission state
  const [editingCommission, setEditingCommission] = useState<string | null>(null);
  const [editSellerPct, setEditSellerPct] = useState("");
  const [editManagerPct, setEditManagerPct] = useState("");

  // Commission history
  const [commissionLogs, setCommissionLogs] = useState<CommissionLog[]>([]);
  const [showLogsForDeal, setShowLogsForDeal] = useState<string | null>(null);

  // Prompt to save sale price to catalog
  const [showSavePricePrompt, setShowSavePricePrompt] = useState(false);
  const [pendingSavePriceData, setPendingSavePriceData] = useState<{ modeloId: string; basePrice: number } | null>(null);

  // Load profile defaults and data sources
  useEffect(() => {
    const loadData = async () => {
      const [profileRes, repsRes, empresasRes, modelosRes] = await Promise.all([
        supabase.from("profiles" as any).select("default_seller_commission_pct, default_manager_commission_pct").eq("id", userId).single(),
        supabase.from("representatives" as any).select("id, nome, comissao_padrao_pct, comissao_gestor_pct").eq("status", "ATIVO").order("nome"),
        supabase.from("empresas" as any).select("id, nome, cidade").order("nome"),
        supabase.from("machine_catalog" as any).select("id, marca, modelo, tipo, custo_fob, preco_venda_fob").order("marca"),
      ]);
      if (profileRes.data) {
        const d = profileRes.data as any;
        setDefaultSellerPct(d.default_seller_commission_pct ?? 3);
        setDefaultManagerPct(d.default_manager_commission_pct ?? 1);
      }
      if (repsRes.data) setRepOptions(repsRes.data as unknown as RepOption[]);
      if (empresasRes.data) setEmpresas(empresasRes.data as unknown as Empresa[]);
      if (modelosRes.data) setModelos((modelosRes.data as any[]).map((c: any) => ({
        id: c.id,
        marca: c.marca,
        modelo: c.modelo,
        tipo: c.tipo,
        custo_fob: c.custo_fob,
        preco_venda_fob: c.preco_venda_fob || 0,
      })));
    };
    loadData();
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
    setShowForm(true);
  };

  // Auto-fill when selecting a model
  const handleModeloSelect = (id: string) => {
    setModeloId(id);
    setModeloOpen(false);
    const modelo = modelos.find(m => m.id === id);
    if (modelo) {
      setMachineType(modelo.tipo);
      setFobCost(String(modelo.custo_fob));
      if (modelo.preco_venda_fob > 0) {
        setPrecoVendaFob(String(modelo.preco_venda_fob));
      }
    }
  };

  // Auto-fill commission when selecting a representative
  const handleRepSelect = (id: string) => {
    setRepresentativeId(id);
    setRepOpen(false);
    if (id && id !== "none") {
      const rep = repOptions.find(r => r.id === id);
      if (rep) {
        setSellerPct(String(rep.comissao_padrao_pct));
        setManagerPct(String(rep.comissao_gestor_pct));
      }
    }
  };

  // Create new empresa
  const handleCreateEmpresa = async () => {
    if (!newEmpresaNome.trim()) return;
    const { data, error } = await supabase
      .from("empresas" as any)
      .insert({ user_id: userId, nome: newEmpresaNome.trim(), cidade: newEmpresaCidade.trim() || null } as any)
      .select("id, nome, cidade")
      .single();
    if (error) {
      toast({ title: "Erro ao criar empresa", description: error.message, variant: "destructive" });
      return;
    }
    if (data) {
      const newEmp = data as unknown as Empresa;
      setEmpresas(prev => [...prev, newEmp].sort((a, b) => a.nome.localeCompare(b.nome)));
      setEmpresaId(newEmp.id);
    }
    setNewEmpresaNome("");
    setNewEmpresaCidade("");
    setShowNewEmpresa(false);
    toast({ title: "Empresa cadastrada!" });
  };

  const selectedEmpresa = empresas.find(e => e.id === empresaId);
  const selectedModelo = modelos.find(m => m.id === modeloId);
  const selectedRep = repOptions.find(r => r.id === representativeId);

  const simulation = useMemo(() => {
    const fob = parseFloat(fobCost) || 0;
    const vendaFob = parseFloat(precoVendaFob) || 0;
    const sPct = parseFloat(sellerPct) || 0;
    const mPct = parseFloat(managerPct) || 0;
    if (fob <= 0 || vendaFob <= 0) return null;

    const basePrice = vendaFob;
    const grossProfit = basePrice - fob;
    const grossMargin = basePrice > 0 ? (grossProfit / basePrice) * 100 : 0;

    // Commission based on preço venda FOB
    const sellerComm = basePrice * (sPct / 100);
    const managerComm = basePrice * (mPct / 100);
    const netProfit = grossProfit - sellerComm - managerComm;
    const netMargin = basePrice > 0 ? (netProfit / basePrice) * 100 : 0;

    const dollar = parseFloat(dollarRate) || 0;
    const hasDollar = dollar > 0;

    // Commission in BRL
    const sellerCommBrl = sellerComm * dollar;
    const managerCommBrl = managerComm * dollar;

    return {
      fob, basePrice, finalPrice: basePrice, grossProfit, grossMargin,
      sellerComm, managerComm, netProfit, netMargin,
      dollar, hasDollar,
      sellerCommBrl, managerCommBrl,
      basePriceBrl: hasDollar ? basePrice * dollar : 0,
      finalPriceBrl: hasDollar ? basePrice * dollar : 0,
    };
  }, [fobCost, precoVendaFob, sellerPct, managerPct, dollarRate]);

  const handleSave = async () => {
    if (!simulation || !empresaId) {
      toast({ title: "Selecione uma empresa e preencha os dados", variant: "destructive" });
      return;
    }

    const machineName = selectedModelo ? `${selectedModelo.marca} ${selectedModelo.modelo}` : "";

    const insert = {
      user_id: userId,
      client_name: selectedEmpresa?.nome || "",
      machine_name: machineName,
      machine_type: machineType,
      fob_cost: simulation.fob,
      dollar_rate: simulation.dollar,
      estimated_tax_percent: 0,
      estimated_tax_value: 0,
      desired_margin_percent: simulation.grossMargin,
      base_price: simulation.basePrice,
      final_price: simulation.finalPrice,
      gross_profit: simulation.grossProfit,
      gross_margin_percent: simulation.grossMargin,
      commission_base: "FOB",
      seller_commission_pct: parseFloat(sellerPct) || 0,
      manager_commission_pct: parseFloat(managerPct) || 0,
      seller_commission_value: simulation.sellerComm,
      manager_commission_value: simulation.managerComm,
      net_profit: simulation.netProfit,
      net_margin_percent: simulation.netMargin,
      observation: observation.trim() || null,
      representative_id: representativeId && representativeId !== "none" ? representativeId : null,
      empresa_id: empresaId,
      modelo_id: modeloId || null,
    };

    const { error } = await supabase.from("deals" as any).insert(insert as any);
    if (error) {
      toast({ title: "Erro ao salvar", description: error.message, variant: "destructive" });
      return;
    }

    // Check if selected model has no sale price and offer to save it
    if (selectedModelo && (!selectedModelo.preco_venda_fob || selectedModelo.preco_venda_fob === 0) && simulation.basePrice > 0) {
      setPendingSavePriceData({ modeloId: selectedModelo.id, basePrice: simulation.basePrice });
      setShowSavePricePrompt(true);
    }

    toast({ title: "Negociação salva!" });
    resetForm();
    fetchDeals();
  };

  const resetForm = () => {
    setEmpresaId(""); setModeloId(""); setMachineType(""); setFobCost(""); setPrecoVendaFob(""); setDollarRate("");
    setSellerPct(""); setManagerPct(""); setObservation(""); setRepresentativeId(""); setShowForm(false);
  };

  const handleConfirmSavePrice = async () => {
    if (!pendingSavePriceData) return;
    const { error } = await supabase
      .from("machine_catalog" as any)
      .update({ preco_venda_fob: pendingSavePriceData.basePrice } as any)
      .eq("id", pendingSavePriceData.modeloId);
    if (!error) {
      setModelos(prev => prev.map(m => m.id === pendingSavePriceData.modeloId ? { ...m, preco_venda_fob: pendingSavePriceData.basePrice } : m));
      toast({ title: "Preço de venda atualizado no catálogo!" });
    }
    setShowSavePricePrompt(false);
    setPendingSavePriceData(null);
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
    // Always use base_price (preço_venda_fob) as commission base
    const sellerComm = deal.base_price * (sPct / 100);
    const managerComm = deal.base_price * (mPct / 100);
    const netProfit = deal.gross_profit - sellerComm - managerComm;
    const netMargin = deal.base_price > 0 ? (netProfit / deal.base_price) * 100 : 0;

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
        commission_base: "FOB",
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

  const handleSaveDefaults = async () => {
    const { error } = await supabase
      .from("profiles" as any)
      .update({
        default_seller_commission_pct: defaultSellerPct,
        default_manager_commission_pct: defaultManagerPct,
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
      {/* Header */}
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
            <div className="flex items-center h-8 px-3 text-xs bg-muted/50 border border-border rounded-md text-muted-foreground">FOB (fixo)</div>
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
            {/* Empresa (searchable combobox) */}
            <div>
              <Label className="mb-1.5 text-sm text-muted-foreground">Empresa *</Label>
              <div className="flex gap-1.5">
                <Popover open={empresaOpen} onOpenChange={setEmpresaOpen}>
                  <PopoverTrigger asChild>
                    <Button variant="outline" role="combobox" aria-expanded={empresaOpen}
                      className="flex-1 justify-between bg-secondary/50 border-border font-normal text-sm h-10">
                      {selectedEmpresa ? `${selectedEmpresa.nome}${selectedEmpresa.cidade ? ` - ${selectedEmpresa.cidade}` : ''}` : "Selecionar empresa..."}
                      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[300px] p-0 bg-popover border-border z-50" align="start">
                    <Command>
                      <CommandInput placeholder="Buscar empresa..." />
                      <CommandList>
                        <CommandEmpty>Nenhuma empresa encontrada.</CommandEmpty>
                        <CommandGroup>
                          {empresas.map(e => (
                            <CommandItem key={e.id} value={e.nome} onSelect={() => { setEmpresaId(e.id); setEmpresaOpen(false); }}>
                            <Check className={cn("mr-2 h-4 w-4", empresaId === e.id ? "opacity-100" : "opacity-0")} />
                              <div className="flex flex-col">
                                <span className="text-sm">{e.nome}</span>
                                {e.cidade && <span className="text-xs text-muted-foreground">{e.cidade}</span>}
                              </div>
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
                <Button variant="outline" size="icon" className="h-10 w-10 shrink-0" onClick={() => setShowNewEmpresa(true)} title="Nova empresa">
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {/* Modelo (searchable combobox) */}
            <div>
              <Label className="mb-1.5 text-sm text-muted-foreground">Máquina *</Label>
              <Popover open={modeloOpen} onOpenChange={setModeloOpen}>
                <PopoverTrigger asChild>
                  <Button variant="outline" role="combobox" aria-expanded={modeloOpen}
                    className="w-full justify-between bg-secondary/50 border-border font-normal text-sm h-10">
                    {selectedModelo ? `${selectedModelo.marca} ${selectedModelo.modelo}` : "Selecionar modelo..."}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[350px] p-0 bg-popover border-border z-50" align="start">
                  <Command>
                    <CommandInput placeholder="Buscar marca ou modelo..." />
                    <CommandList>
                      <CommandEmpty>Nenhum modelo encontrado.</CommandEmpty>
                      <CommandGroup>
                        {modelos.map(m => (
                          <CommandItem key={m.id} value={`${m.marca} ${m.modelo} ${m.tipo}`} onSelect={() => handleModeloSelect(m.id)}>
                            <Check className={cn("mr-2 h-4 w-4", modeloId === m.id ? "opacity-100" : "opacity-0")} />
                            <div className="flex flex-col">
                              <span className="text-sm font-medium">{m.marca} {m.modelo}</span>
                              <span className="text-xs text-muted-foreground">{m.tipo} · FOB US$ {m.custo_fob.toLocaleString("pt-BR")}</span>
                            </div>
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>

            {/* Tipo da Máquina (auto-filled) */}
            <div>
              <Label className="mb-1.5 text-sm text-muted-foreground">Tipo da Máquina</Label>
              <Input value={machineType} readOnly placeholder="Preenchido automaticamente" className="bg-muted/50 border-border text-muted-foreground" />
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
              <Label className="mb-1.5 text-sm text-muted-foreground">Preço de Venda FOB (USD) *</Label>
              <Input type="number" step="0.01" min="0" value={precoVendaFob} onChange={(e) => setPrecoVendaFob(e.target.value)} placeholder="0,00" className="bg-secondary/50 border-border" />
            </div>

            {/* Representante (searchable combobox with auto-fill) */}
            <div>
              <Label className="mb-1.5 text-sm text-muted-foreground">Representante</Label>
              <Popover open={repOpen} onOpenChange={setRepOpen}>
                <PopoverTrigger asChild>
                  <Button variant="outline" role="combobox" aria-expanded={repOpen}
                    className="w-full justify-between bg-secondary/50 border-border font-normal text-sm h-10">
                    {selectedRep ? selectedRep.nome : "Selecionar representante..."}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[280px] p-0 bg-popover border-border z-50" align="start">
                  <Command>
                    <CommandInput placeholder="Buscar representante..." />
                    <CommandList>
                      <CommandEmpty>Nenhum representante encontrado.</CommandEmpty>
                      <CommandGroup>
                        <CommandItem value="nenhum" onSelect={() => { setRepresentativeId("none"); setRepOpen(false); }}>
                          <Check className={cn("mr-2 h-4 w-4", !representativeId || representativeId === "none" ? "opacity-100" : "opacity-0")} />
                          Nenhum
                        </CommandItem>
                        {repOptions.map(r => (
                          <CommandItem key={r.id} value={r.nome} onSelect={() => handleRepSelect(r.id)}>
                            <Check className={cn("mr-2 h-4 w-4", representativeId === r.id ? "opacity-100" : "opacity-0")} />
                            <div className="flex flex-col">
                              <span className="text-sm">{r.nome}</span>
                              <span className="text-xs text-muted-foreground">Vend: {r.comissao_padrao_pct}% · Gest: {r.comissao_gestor_pct}%</span>
                            </div>
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>

            <div>
              <Label className="mb-1.5 text-sm text-muted-foreground">Comissão Vendedor (%)</Label>
              <Input type="number" step="0.01" min="0" value={sellerPct} onChange={(e) => setSellerPct(e.target.value)} placeholder="0,00" className="bg-secondary/50 border-border" />
              {simulation && (
                <p className="text-xs text-accent mt-1 font-medium">
                  = US$ {simulation.sellerComm.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                  {simulation.hasDollar && ` (${simulation.sellerCommBrl.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })})`}
                </p>
              )}
            </div>
            <div>
              <Label className="mb-1.5 text-sm text-muted-foreground">Comissão Gestor (%)</Label>
              <Input type="number" step="0.01" min="0" value={managerPct} onChange={(e) => setManagerPct(e.target.value)} placeholder="0,00" className="bg-secondary/50 border-border" />
              {simulation && (
                <p className="text-xs text-accent mt-1 font-medium">
                  = US$ {simulation.managerComm.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                  {simulation.hasDollar && ` (${simulation.managerCommBrl.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })})`}
                </p>
              )}
            </div>

            <div className="md:col-span-2 lg:col-span-2">
              <Label className="mb-1.5 text-sm text-muted-foreground">Observação</Label>
              <Textarea value={observation} onChange={(e) => setObservation(e.target.value)} placeholder="Observações sobre a negociação..." className="bg-secondary/50 border-border" />
            </div>
          </div>

          {/* Live simulation preview */}
          {simulation && (
            <Card className="mt-4 border-primary/20 bg-primary/5 p-4">
              <h4 className="font-heading text-sm font-semibold text-primary mb-3">Prévia da Simulação</h4>
              <div className="grid gap-2 md:grid-cols-2 lg:grid-cols-4 text-sm">
                <div><span className="text-muted-foreground">Preço Venda FOB:</span> <span className="font-semibold">{formatUsd(simulation.basePrice)}</span></div>
                <div><span className="text-muted-foreground">Lucro Bruto:</span> <span className="font-semibold text-accent">{formatUsd(simulation.grossProfit)}</span></div>
                <div><span className="text-muted-foreground">Margem Bruta:</span> <span className="font-semibold">{formatPct(simulation.grossMargin)}</span></div>
                <div><span className="text-muted-foreground">Com. Vendedor ({formatPct(parseFloat(sellerPct) || 0)}):</span> <span className="font-semibold text-warning">{formatUsd(simulation.sellerComm)}{simulation.hasDollar && ` (${simulation.sellerCommBrl.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })})`}</span></div>
                <div><span className="text-muted-foreground">Com. Gestor ({formatPct(parseFloat(managerPct) || 0)}):</span> <span className="font-semibold text-warning">{formatUsd(simulation.managerComm)}{simulation.hasDollar && ` (${simulation.managerCommBrl.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })})`}</span></div>
                <div className="bg-accent/10 rounded px-2 py-1 -mx-2"><span className="text-muted-foreground">Lucro Líquido:</span> <span className={`font-bold text-base ${simulation.netProfit < 0 ? "text-destructive" : "text-accent"}`}>{formatUsd(simulation.netProfit)}</span></div>
                <div className="bg-accent/10 rounded px-2 py-1 -mx-2"><span className="text-muted-foreground">Margem Líquida:</span> <span className={`font-bold text-base ${simulation.netMargin < 0 ? "text-destructive" : "text-accent"}`}>{formatPct(simulation.netMargin)}</span></div>
              </div>
              {simulation.hasDollar && (
                <div className="mt-2 text-xs text-muted-foreground">
                  Venda FOB BRL: {simulation.basePriceBrl.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                </div>
              )}
            </Card>
          )}

          <div className="flex gap-3 mt-4">
            <Button onClick={handleSave} disabled={!simulation || !empresaId}>
              <Save className="h-4 w-4 mr-2" /> Salvar Negociação
            </Button>
            <Button variant="outline" onClick={resetForm}>Cancelar</Button>
          </div>
        </Card>
      )}

      {/* New Empresa Dialog */}
      <Dialog open={showNewEmpresa} onOpenChange={setShowNewEmpresa}>
        <DialogContent className="bg-card border-border">
          <DialogHeader>
            <DialogTitle>Nova Empresa</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-sm text-muted-foreground">Nome da Empresa *</Label>
              <Input value={newEmpresaNome} onChange={(e) => setNewEmpresaNome(e.target.value)} placeholder="Nome da empresa" className="bg-secondary/50 border-border" />
            </div>
            <div>
              <Label className="text-sm text-muted-foreground">Cidade</Label>
              <Input value={newEmpresaCidade} onChange={(e) => setNewEmpresaCidade(e.target.value)} placeholder="Ex: Curitiba" className="bg-secondary/50 border-border" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNewEmpresa(false)}>Cancelar</Button>
            <Button onClick={handleCreateEmpresa} disabled={!newEmpresaNome.trim()}>
              <Plus className="h-4 w-4 mr-2" /> Cadastrar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar cliente ou máquina..." className="pl-9 bg-secondary/50 border-border text-sm" />
        </div>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-[160px] bg-secondary/50 border-border text-sm"><SelectValue /></SelectTrigger>
          <SelectContent className="bg-popover border-border z-50">
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
                      {deal.machine_type && <Badge variant="outline" className="text-[10px] h-4">{deal.machine_type}</Badge>}
                      {deal.representative_id && repOptions.find(r => r.id === deal.representative_id) && (
                        <Badge variant="outline" className="text-[10px] h-4 ml-1">{repOptions.find(r => r.id === deal.representative_id)!.nome}</Badge>
                      )}
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
                    <div className="grid grid-cols-2 gap-3">
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

      {/* Prompt to save sale price to catalog */}
      <AlertDialog open={showSavePricePrompt} onOpenChange={setShowSavePricePrompt}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Salvar preço de venda no catálogo?</AlertDialogTitle>
            <AlertDialogDescription>
              O modelo selecionado não possui preço de venda FOB cadastrado no catálogo.
              Deseja salvar o valor de <strong>US$ {pendingSavePriceData?.basePrice?.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</strong> como preço de venda padrão?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => { setShowSavePricePrompt(false); setPendingSavePriceData(null); }}>
              Não
            </AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmSavePrice}>
              Sim, salvar no catálogo
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default DealManager;
