import { useState, useMemo, useEffect, useCallback } from "react";
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
  Sheet, SheetContent, SheetHeader, SheetTitle,
} from "@/components/ui/sheet";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  DollarSign, Percent, TrendingUp, TrendingDown, Package, Receipt,
  Save, Lock, Unlock, Trash2, Search, Eye, EyeOff, Users, History, Clock,
  ChevronsUpDown, Check, Plus, Pencil, X, ArrowUpDown, ArrowUp, ArrowDown,
  Building2, Wrench, ChevronDown, CalendarIcon, FileUp,
} from "lucide-react";
import { format } from "date-fns";
import { Calendar } from "@/components/ui/calendar";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import PdfOrderImport, { type ExtractedOrder } from "@/components/PdfOrderImport";


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

interface DealItem {
  modeloId: string;
  machineName: string;
  machineType: string;
  fobCost: string;
  precoVendaFob: string;
  quantity: string;
  modeloOpen: boolean;
}

interface DealItemDb {
  id: string;
  deal_id: string;
  modelo_id: string | null;
  machine_name: string;
  machine_type: string;
  fob_cost: number;
  preco_venda_fob: number;
  gross_profit: number;
  gross_margin_percent: number;
  quantity: number;
}

interface Props {
  userId: string;
}

type SortField = "created_at" | "client_name" | "machine_name" | "machine_type" | "base_price" | "final_price" | "net_margin_percent" | "net_profit" | "seller_commission_value" | "manager_commission_value" | "representative_id" | "cidade";
type SortDir = "asc" | "desc";

const emptyItem = (): DealItem => ({
  modeloId: "", machineName: "", machineType: "", fobCost: "", precoVendaFob: "", quantity: "1", modeloOpen: false,
});

const DealManager = ({ userId }: Props) => {
  const { toast } = useToast();
  const [deals, setDeals] = useState<Deal[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [filterYear, setFilterYear] = useState<string>(String(new Date().getFullYear()));
  const [filterMonth, setFilterMonth] = useState<string>(String(new Date().getMonth() + 1));
  const [filterRepId, setFilterRepId] = useState<string>("all");
  const [sortField, setSortField] = useState<SortField>("created_at");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  // Drawer state
  const [drawerDeal, setDrawerDeal] = useState<Deal | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [pendingEditDeal, setPendingEditDeal] = useState<Deal | null>(null);
  const [editForm, setEditForm] = useState<Record<string, any>>({});
  const [drawerItems, setDrawerItems] = useState<DealItemDb[]>([]);

  // Default commission from profile
  const [defaultSellerPct, setDefaultSellerPct] = useState(3);
  const [defaultManagerPct, setDefaultManagerPct] = useState(1);

  // Structured data sources
  const [empresas, setEmpresas] = useState<Empresa[]>([]);
  const [modelos, setModelos] = useState<Modelo[]>([]);
  const [repOptions, setRepOptions] = useState<RepOption[]>([]);

  // Form state for new deal
  const [empresaId, setEmpresaId] = useState("");
  const [items, setItems] = useState<DealItem[]>([emptyItem()]);
  const [dollarRate, setDollarRate] = useState("");
  const [sellerPct, setSellerPct] = useState("");
  const [managerPct, setManagerPct] = useState("");
  const [observation, setObservation] = useState("");
  const [representativeId, setRepresentativeId] = useState("");
  const [saleDate, setSaleDate] = useState<Date | undefined>(undefined);
  const [saleDateOpen, setSaleDateOpen] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [showPdfImport, setShowPdfImport] = useState(false);

  // Combobox open states
  const [empresaOpen, setEmpresaOpen] = useState(false);
  const [repOpen, setRepOpen] = useState(false);

  // New empresa dialog
  const [showNewEmpresa, setShowNewEmpresa] = useState(false);
  const [newEmpresaNome, setNewEmpresaNome] = useState("");
  const [newEmpresaCidade, setNewEmpresaCidade] = useState("");

  // New modelo dialog
  const [showNewModelo, setShowNewModelo] = useState(false);
  const [newModeloItemIdx, setNewModeloItemIdx] = useState<number>(0);
  const [newModeloTipo, setNewModeloTipo] = useState<string>("");
  const [newModeloMarca, setNewModeloMarca] = useState("");
  const [newModeloModelo, setNewModeloModelo] = useState("");
  const [newModeloCustoFob, setNewModeloCustoFob] = useState("");
  const [newModeloPrecoVenda, setNewModeloPrecoVenda] = useState("");

  // Commission history
  const [commissionLogs, setCommissionLogs] = useState<CommissionLog[]>([]);
  const [showLogsInDrawer, setShowLogsInDrawer] = useState(false);

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
        id: c.id, marca: c.marca, modelo: c.modelo, tipo: c.tipo, custo_fob: c.custo_fob, preco_venda_fob: c.preco_venda_fob || 0,
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

  const [drawerItemsLoaded, setDrawerItemsLoaded] = useState(false);

  const fetchDealItems = async (dealId: string) => {
    setDrawerItemsLoaded(false);
    const { data } = await supabase
      .from("deal_items" as any)
      .select("*")
      .eq("deal_id", dealId)
      .order("created_at", { ascending: true });
    if (data) setDrawerItems(data as unknown as DealItemDb[]);
    else setDrawerItems([]);
    setDrawerItemsLoaded(true);
  };

  // Pre-fill defaults when opening form
  const openForm = () => {
    setSellerPct(String(defaultSellerPct));
    setManagerPct(String(defaultManagerPct));
    setItems([emptyItem()]);
    setShowForm(true);
  };

  // Item management
  const updateItem = (index: number, updates: Partial<DealItem>) => {
    setItems(prev => prev.map((item, i) => i === index ? { ...item, ...updates } : item));
  };

  const addItem = () => {
    setItems(prev => [...prev, emptyItem()]);
  };

  const removeItem = (index: number) => {
    if (items.length <= 1) return;
    setItems(prev => prev.filter((_, i) => i !== index));
  };

  const handleItemModeloSelect = (index: number, id: string) => {
    const modelo = modelos.find(m => m.id === id);
    if (modelo) {
      updateItem(index, {
        modeloId: id,
        modeloOpen: false,
        machineName: `${modelo.marca} ${modelo.modelo}`,
        machineType: modelo.tipo,
        fobCost: String(modelo.custo_fob),
        precoVendaFob: modelo.preco_venda_fob > 0 ? String(modelo.preco_venda_fob) : "",
      });
    }
  };

  // Auto-fill commission when selecting a representative
  const handleRepSelect = (id: string) => {
    setRepresentativeId(id);
    setRepOpen(false);
    if (id && id !== "none") {
      const rep = repOptions.find(r => r.id === id);
      if (rep) {
        const isOdirlei = rep.nome.trim().toLowerCase() === "odirlei costa";
        setSellerPct(String(rep.comissao_padrao_pct));
        setManagerPct(isOdirlei ? "0" : String(rep.comissao_gestor_pct));
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

  // Create new modelo in catalog
  const handleCreateModelo = async () => {
    if (!newModeloMarca.trim() || !newModeloModelo.trim() || !newModeloTipo) return;
    const custoFob = parseFloat(newModeloCustoFob) || 0;
    const precoVenda = parseFloat(newModeloPrecoVenda) || 0;
    const { data, error } = await supabase
      .from("machine_catalog" as any)
      .insert({
        user_id: userId,
        tipo: newModeloTipo,
        marca: newModeloMarca.trim(),
        modelo: newModeloModelo.trim(),
        custo_fob: custoFob,
        preco_venda_fob: precoVenda,
      } as any)
      .select("id, marca, modelo, tipo, custo_fob, preco_venda_fob")
      .single();
    if (error) {
      toast({ title: "Erro ao cadastrar produto", description: error.message, variant: "destructive" });
      return;
    }
    if (data) {
      const newMod = data as unknown as Modelo;
      setModelos(prev => [...prev, newMod].sort((a, b) => a.marca.localeCompare(b.marca)));
      // Auto-select in the item
      handleItemModeloSelect(newModeloItemIdx, newMod.id);
    }
    setNewModeloTipo(""); setNewModeloMarca(""); setNewModeloModelo("");
    setNewModeloCustoFob(""); setNewModeloPrecoVenda("");
    setShowNewModelo(false);
    toast({ title: "Produto cadastrado no catálogo!" });
  };

  const selectedEmpresa = empresas.find(e => e.id === empresaId);
  const selectedRep = repOptions.find(r => r.id === representativeId);

  const simulation = useMemo(() => {
    const sPct = parseFloat(sellerPct) || 0;
    const mPct = parseFloat(managerPct) || 0;
    const dollar = parseFloat(dollarRate) || 0;
    const hasDollar = dollar > 0;

    let totalFob = 0;
    let totalVenda = 0;
    const itemSims: { fob: number; venda: number; qty: number; grossProfit: number; grossMargin: number }[] = [];

    for (const item of items) {
      const fob = parseFloat(item.fobCost) || 0;
      const venda = parseFloat(item.precoVendaFob) || 0;
      const qty = parseInt(item.quantity) || 1;
      if (venda <= 0) continue;
      const itemFobTotal = fob * qty;
      const itemVendaTotal = venda * qty;
      const gp = itemVendaTotal - itemFobTotal;
      const gm = itemVendaTotal > 0 ? (gp / itemVendaTotal) * 100 : 0;
      totalFob += itemFobTotal;
      totalVenda += itemVendaTotal;
      itemSims.push({ fob: itemFobTotal, venda: itemVendaTotal, qty, grossProfit: gp, grossMargin: gm });
    }

    if (totalVenda <= 0) return null;

    const grossProfit = totalVenda - totalFob;
    const grossMargin = totalVenda > 0 ? (grossProfit / totalVenda) * 100 : 0;
    const sellerComm = totalVenda * (sPct / 100);
    const managerComm = totalVenda * (mPct / 100);
    const netProfit = grossProfit - sellerComm - managerComm;
    const netMargin = totalVenda > 0 ? (netProfit / totalVenda) * 100 : 0;

    return {
      totalFob, totalVenda, grossProfit, grossMargin,
      sellerComm, managerComm, netProfit, netMargin,
      dollar, hasDollar,
      sellerCommBrl: sellerComm * dollar,
      managerCommBrl: managerComm * dollar,
      basePriceBrl: hasDollar ? totalVenda * dollar : 0,
      itemSims,
    };
  }, [items, sellerPct, managerPct, dollarRate]);

  const handleSave = async () => {
    if (!empresaId) {
      toast({ title: "Empresa obrigatória", description: "Selecione uma empresa para registrar a venda.", variant: "destructive" });
      return;
    }

    const itemsWithoutModel = items.filter(it => !it.machineName);
    if (itemsWithoutModel.length > 0) {
      toast({ title: "Produto sem modelo", description: "Selecione um modelo do catálogo para cada produto.", variant: "destructive" });
      return;
    }

    const itemsWithoutPrice = items.filter(it => (parseFloat(it.precoVendaFob) || 0) <= 0);
    if (itemsWithoutPrice.length > 0) {
      toast({ title: "Preço de venda obrigatório", description: "Informe o Preço Venda FOB para todos os produtos. Valor deve ser maior que zero.", variant: "destructive" });
      return;
    }

    if (!simulation) {
      toast({ title: "Simulação inválida", description: "Verifique os dados dos produtos. Pelo menos um produto precisa ter Preço Venda FOB preenchido.", variant: "destructive" });
      return;
    }

    // Build machine name from items
    const validItems = items.filter(it => (parseFloat(it.precoVendaFob) || 0) > 0);
    if (validItems.length === 0) {
      toast({ title: "Nenhum produto válido", description: "Adicione pelo menos um produto com Preço Venda FOB maior que zero.", variant: "destructive" });
      return;
    }

    const machineNames = validItems.map(it => {
      const qty = parseInt(it.quantity) || 1;
      return qty > 1 ? `${qty}x ${it.machineName}` : it.machineName;
    });
    const machineName = machineNames.join(", ");
    const machineType = validItems.map(it => it.machineType).filter(Boolean).join(", ");

    const insert = {
      user_id: userId,
      client_name: selectedEmpresa?.nome || "",
      machine_name: machineName,
      machine_type: machineType,
      fob_cost: simulation.totalFob,
      dollar_rate: simulation.dollar,
      estimated_tax_percent: 0,
      estimated_tax_value: 0,
      desired_margin_percent: simulation.grossMargin,
      base_price: simulation.totalVenda,
      final_price: simulation.totalVenda,
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
      modelo_id: validItems.length === 1 ? (validItems[0].modeloId || null) : null,
      ...(saleDate ? { created_at: saleDate.toISOString() } : {}),
    };

    const { data: dealData, error } = await supabase.from("deals" as any).insert(insert as any).select("id").single();
    if (error || !dealData) {
      toast({ title: "Erro ao salvar", description: error?.message, variant: "destructive" });
      return;
    }

    const dealId = (dealData as any).id;

    // Insert deal items
    const dealItems = validItems.map(it => {
      const fob = parseFloat(it.fobCost) || 0;
      const venda = parseFloat(it.precoVendaFob) || 0;
      const qty = parseInt(it.quantity) || 1;
      const totalFob = fob * qty;
      const totalVenda = venda * qty;
      const gp = totalVenda - totalFob;
      const gm = totalVenda > 0 ? (gp / totalVenda) * 100 : 0;
      return {
        deal_id: dealId,
        user_id: userId,
        modelo_id: it.modeloId || null,
        machine_name: it.machineName,
        machine_type: it.machineType,
        fob_cost: totalFob,
        preco_venda_fob: totalVenda,
        gross_profit: gp,
        gross_margin_percent: gm,
        quantity: qty,
      };
    });

    await supabase.from("deal_items" as any).insert(dealItems as any);

    toast({ title: "Negociação salva!" });
    resetForm();
    fetchDeals();
  };

  const resetForm = () => {
    setEmpresaId(""); setItems([emptyItem()]); setDollarRate("");
    setSellerPct(""); setManagerPct(""); setObservation(""); setRepresentativeId(""); setSaleDate(undefined); setShowForm(false);
  };

  // ── PDF Import Handler ──
  const handlePdfImportComplete = useCallback((order: ExtractedOrder) => {
    // Pre-fill empresa
    if (order.matchedEmpresaId) setEmpresaId(order.matchedEmpresaId);

    // Pre-fill representative
    if (order.matchedRepId) {
      const rep = repOptions.find(r => r.id === order.matchedRepId);
      if (rep) {
        setRepresentativeId(rep.id);
        setSellerPct(String(rep.comissao_padrao_pct));
        const isOdirlei = rep.nome.trim().toLowerCase() === "odirlei costa";
        setManagerPct(isOdirlei ? "0" : String(rep.comissao_gestor_pct));
      }
    } else {
      setSellerPct(String(defaultSellerPct));
      setManagerPct(String(defaultManagerPct));
    }

    // Pre-fill items
    if (order.itens.length > 0) {
      const importedItems: DealItem[] = order.itens.map(item => ({
        modeloId: item.matchedModeloId || "",
        machineName: item.matchedMachineName || item.descricao || "",
        machineType: item.matchedMachineType || item.tipo_maquina || "",
        fobCost: item.matchedFobCost != null ? String(item.matchedFobCost) : "",
        precoVendaFob: String(item.valor_fob_usd),
        quantity: String(item.quantidade || 1),
        modeloOpen: false,
      }));
      setItems(importedItems);
    }

    // Pre-fill date
    if (order.data_pedido) {
      const parsed = new Date(order.data_pedido);
      if (!isNaN(parsed.getTime())) setSaleDate(parsed);
    }

    // Pre-fill observation with notes
    const notes: string[] = [];
    if (order.numero_proposta) notes.push(`Proposta: ${order.numero_proposta}`);
    if (order.tipo_venda) notes.push(`Tipo: ${order.tipo_venda}`);
    if (order.notas_comerciais) notes.push(order.notas_comerciais);
    if (order.comando) notes.push(`Comando: ${order.comando}`);
    if (notes.length > 0) setObservation(notes.join(" | "));

    setShowForm(true);
    toast({ title: "Formulário preenchido!", description: "Revise os dados e ajuste o que for necessário antes de salvar." });
  }, [repOptions, defaultSellerPct, defaultManagerPct, toast]);

  const handleClose = async (deal: Deal) => {
    if (deal.status === "closed") return;
    // Use the sale date (created_at) as closed_at so the deal appears in the correct month
    const closedAt = deal.created_at || new Date().toISOString();
    const { error } = await supabase
      .from("deals" as any)
      .update({ status: "closed", closed_at: closedAt } as any)
      .eq("id", deal.id);
    if (error) { toast({ title: "Erro", description: error.message, variant: "destructive" }); return; }
    toast({ title: "Venda fechada!" });
    fetchDeals();
    if (drawerDeal?.id === deal.id) {
      setDrawerDeal({ ...deal, status: "closed", closed_at: closedAt });
    }
  };

  const handleReopen = async (deal: Deal) => {
    if (deal.status !== "closed") return;
    const { error } = await supabase
      .from("deals" as any)
      .update({ status: "open", closed_at: null } as any)
      .eq("id", deal.id);
    if (error) { toast({ title: "Erro", description: error.message, variant: "destructive" }); return; }
    toast({ title: "Venda reaberta!" });
    fetchDeals();
    if (drawerDeal?.id === deal.id) {
      setDrawerDeal({ ...deal, status: "open", closed_at: null });
    }
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from("deals" as any).delete().eq("id", id);
    if (error) { toast({ title: "Erro", description: error.message, variant: "destructive" }); return; }
    fetchDeals();
    if (drawerDeal?.id === id) { setDrawerOpen(false); setDrawerDeal(null); }
  };

  const handleSaveDefaults = async () => {
    const { error } = await supabase
      .from("profiles" as any)
      .update({ default_seller_commission_pct: defaultSellerPct, default_manager_commission_pct: defaultManagerPct } as any)
      .eq("id", userId);
    if (error) { toast({ title: "Erro", description: error.message, variant: "destructive" }); }
    else { toast({ title: "Padrões de comissão salvos!" }); }
  };

  // ── Drawer Edit Logic ──
  const [editItems, setEditItems] = useState<DealItem[]>([]);
  const [editEmpresaId, setEditEmpresaId] = useState("");
  const [editRepId, setEditRepId] = useState("");
  const [editDate, setEditDate] = useState<Date | undefined>(undefined);
  const [editDateOpen, setEditDateOpen] = useState(false);
  const [editEmpresaOpen, setEditEmpresaOpen] = useState(false);
  const [editRepOpen, setEditRepOpen] = useState(false);

  const startEditing = (deal: Deal) => {
    setEditForm({
      fob_cost: deal.fob_cost,
      base_price: deal.base_price,
      dollar_rate: deal.dollar_rate,
      seller_commission_pct: deal.seller_commission_pct,
      manager_commission_pct: deal.manager_commission_pct,
      observation: deal.observation || "",
    });
    setEditEmpresaId(deal.empresa_id || "");
    setEditRepId(deal.representative_id || "");
    setEditDate(new Date(deal.created_at));
    // Convert drawerItems to editable DealItem[]
    if (drawerItems.length > 0) {
      setEditItems(drawerItems.map(di => ({
        modeloId: di.modelo_id || "",
        machineName: di.machine_name,
        machineType: di.machine_type,
        fobCost: String(di.quantity > 1 ? di.fob_cost / di.quantity : di.fob_cost),
        precoVendaFob: String(di.quantity > 1 ? di.preco_venda_fob / di.quantity : di.preco_venda_fob),
        quantity: String(di.quantity),
        modeloOpen: false,
      })));
    } else {
      setEditItems([{
        modeloId: deal.modelo_id || "",
        machineName: deal.machine_name,
        machineType: deal.machine_type,
        fobCost: String(deal.fob_cost),
        precoVendaFob: String(deal.base_price),
        quantity: "1",
        modeloOpen: false,
      }]);
    }
    setEditing(true);
  };

  const updateEditItem = (index: number, updates: Partial<DealItem>) => {
    setEditItems(prev => prev.map((item, i) => i === index ? { ...item, ...updates } : item));
  };
  const addEditItem = () => setEditItems(prev => [...prev, emptyItem()]);
  const removeEditItem = (index: number) => {
    if (editItems.length <= 1) return;
    setEditItems(prev => prev.filter((_, i) => i !== index));
  };
  const handleEditItemModeloSelect = (index: number, id: string) => {
    const modelo = modelos.find(m => m.id === id);
    if (modelo) {
      updateEditItem(index, {
        modeloId: id, modeloOpen: false,
        machineName: `${modelo.marca} ${modelo.modelo}`,
        machineType: modelo.tipo,
        fobCost: String(modelo.custo_fob),
        precoVendaFob: modelo.preco_venda_fob > 0 ? String(modelo.preco_venda_fob) : "",
      });
    }
  };
  const handleEditRepSelect = (id: string) => {
    setEditRepId(id);
    setEditRepOpen(false);
    if (id && id !== "none") {
      const rep = repOptions.find(r => r.id === id);
      if (rep) {
        setEditForm((f: any) => ({ ...f, seller_commission_pct: String(rep.comissao_padrao_pct), manager_commission_pct: String(rep.comissao_gestor_pct) }));
      }
    }
  };

  const editSimulation = useMemo(() => {
    if (!editing) return null;
    const sPct = parseFloat(editForm.seller_commission_pct) || 0;
    const mPct = parseFloat(editForm.manager_commission_pct) || 0;
    const dollar = parseFloat(editForm.dollar_rate) || 0;

    let totalFob = 0;
    let totalVenda = 0;
    for (const item of editItems) {
      const fob = parseFloat(item.fobCost) || 0;
      const venda = parseFloat(item.precoVendaFob) || 0;
      const qty = parseInt(item.quantity) || 1;
      if (fob <= 0 || venda <= 0) continue;
      totalFob += fob * qty;
      totalVenda += venda * qty;
    }
    if (totalVenda <= 0) return null;

    const grossProfit = totalVenda - totalFob;
    const grossMargin = totalVenda > 0 ? (grossProfit / totalVenda) * 100 : 0;
    const sellerComm = totalVenda * (sPct / 100);
    const managerComm = totalVenda * (mPct / 100);
    const netProfit = grossProfit - sellerComm - managerComm;
    const netMargin = totalVenda > 0 ? (netProfit / totalVenda) * 100 : 0;

    return { totalFob, totalVenda, grossProfit, grossMargin, sellerComm, managerComm, netProfit, netMargin, dollar };
  }, [editForm, editing, editItems]);

  const handleSaveEdit = async () => {
    if (!drawerDeal || !editSimulation) return;
    if (!editEmpresaId) {
      toast({ title: "Selecione uma empresa", variant: "destructive" });
      return;
    }
    const validItems = editItems.filter(it => (parseFloat(it.fobCost) || 0) > 0 && (parseFloat(it.precoVendaFob) || 0) > 0);
    if (validItems.length === 0) {
      toast({ title: "Adicione pelo menos um produto válido", variant: "destructive" });
      return;
    }

    const sPct = parseFloat(editForm.seller_commission_pct) || 0;
    const mPct = parseFloat(editForm.manager_commission_pct) || 0;

    // Log commission changes
    const logs: any[] = [];
    if (drawerDeal.seller_commission_pct !== sPct) {
      logs.push({ deal_id: drawerDeal.id, user_id: userId, field_changed: "seller_commission_pct", old_value: drawerDeal.seller_commission_pct, new_value: sPct });
    }
    if (drawerDeal.manager_commission_pct !== mPct) {
      logs.push({ deal_id: drawerDeal.id, user_id: userId, field_changed: "manager_commission_pct", old_value: drawerDeal.manager_commission_pct, new_value: mPct });
    }
    if (logs.length > 0) {
      await supabase.from("commission_history" as any).insert(logs as any);
    }

    const machineNames = validItems.map(it => {
      const qty = parseInt(it.quantity) || 1;
      return qty > 1 ? `${qty}x ${it.machineName}` : it.machineName;
    });
    const machineName = machineNames.join(", ");
    const machineType = validItems.map(it => it.machineType).filter(Boolean).join(", ");
    const editedEmpresa = empresas.find(e => e.id === editEmpresaId);

    const update = {
      client_name: editedEmpresa?.nome || drawerDeal.client_name,
      empresa_id: editEmpresaId,
      representative_id: editRepId && editRepId !== "none" ? editRepId : null,
      modelo_id: validItems.length === 1 ? (validItems[0].modeloId || null) : null,
      machine_name: machineName,
      machine_type: machineType,
      fob_cost: editSimulation.totalFob,
      base_price: editSimulation.totalVenda,
      final_price: editSimulation.totalVenda,
      dollar_rate: parseFloat(editForm.dollar_rate) || 0,
      gross_profit: editSimulation.grossProfit,
      gross_margin_percent: editSimulation.grossMargin,
      desired_margin_percent: editSimulation.grossMargin,
      commission_base: "FOB",
      seller_commission_pct: sPct,
      manager_commission_pct: mPct,
      seller_commission_value: editSimulation.sellerComm,
      manager_commission_value: editSimulation.managerComm,
      net_profit: editSimulation.netProfit,
      net_margin_percent: editSimulation.netMargin,
      observation: editForm.observation?.trim() || null,
      ...(editDate ? { created_at: editDate.toISOString() } : {}),
    };

    const { error } = await supabase.from("deals" as any).update(update as any).eq("id", drawerDeal.id);
    if (error) { toast({ title: "Erro", description: error.message, variant: "destructive" }); return; }

    // Replace deal_items: delete old, insert new
    await supabase.from("deal_items" as any).delete().eq("deal_id", drawerDeal.id);
    const dealItems = validItems.map(it => {
      const fob = parseFloat(it.fobCost) || 0;
      const venda = parseFloat(it.precoVendaFob) || 0;
      const qty = parseInt(it.quantity) || 1;
      const totalFob = fob * qty;
      const totalVenda = venda * qty;
      const gp = totalVenda - totalFob;
      const gm = totalVenda > 0 ? (gp / totalVenda) * 100 : 0;
      return {
        deal_id: drawerDeal.id, user_id: userId, modelo_id: it.modeloId || null,
        machine_name: it.machineName, machine_type: it.machineType,
        fob_cost: totalFob, preco_venda_fob: totalVenda,
        gross_profit: gp, gross_margin_percent: gm, quantity: qty,
      };
    });
    await supabase.from("deal_items" as any).insert(dealItems as any);

    toast({ title: "Negociação atualizada!" });
    setEditing(false);
    fetchDeals();
    const updatedDeal = { ...drawerDeal, ...update } as Deal;
    setDrawerDeal(updatedDeal);
    fetchDealItems(drawerDeal.id);
  };

  // ── Filtering & Sorting ──
  const years = useMemo(() => {
    const s = new Set(deals.map(d => new Date(d.created_at).getFullYear()));
    return Array.from(s).sort((a, b) => b - a);
  }, [deals]);

  const filtered = useMemo(() => {
    return deals.filter((d) => {
      const matchSearch = !search ||
        d.client_name.toLowerCase().includes(search.toLowerCase()) ||
        d.machine_name.toLowerCase().includes(search.toLowerCase()) ||
        d.machine_type.toLowerCase().includes(search.toLowerCase());
      const matchStatus = filterStatus === "all" || d.status === filterStatus;
      const dt = new Date(d.created_at);
      const matchYear = filterYear === "all" || dt.getFullYear() === parseInt(filterYear);
      const matchMonth = filterMonth === "all" || (dt.getMonth() + 1) === parseInt(filterMonth);
      const matchRep = filterRepId === "all" || d.representative_id === filterRepId;
      return matchSearch && matchStatus && matchYear && matchMonth && matchRep;
    });
  }, [deals, search, filterStatus, filterYear, filterMonth, filterRepId]);

  const sorted = useMemo(() => {
    const arr = [...filtered];
    arr.sort((a, b) => {
      let va: any;
      let vb: any;
      if (sortField === "cidade") {
        va = getEmpresaCidade(a).toLowerCase();
        vb = getEmpresaCidade(b).toLowerCase();
      } else if (sortField === "representative_id") {
        va = getRepName(a).toLowerCase();
        vb = getRepName(b).toLowerCase();
      } else if (sortField === "seller_commission_value") {
        va = a.seller_commission_value * a.dollar_rate;
        vb = b.seller_commission_value * b.dollar_rate;
      } else if (sortField === "manager_commission_value") {
        va = a.manager_commission_value * a.dollar_rate;
        vb = b.manager_commission_value * b.dollar_rate;
      } else {
        va = a[sortField as keyof Deal];
        vb = b[sortField as keyof Deal];
      }
      if (typeof va === "string") { va = va.toLowerCase(); vb = (vb || "").toLowerCase(); }
      if (va < vb) return sortDir === "asc" ? -1 : 1;
      if (va > vb) return sortDir === "asc" ? 1 : -1;
      return 0;
    });
    return arr;
  }, [filtered, sortField, sortDir, empresas, repOptions]);

  const toggleSort = (field: SortField) => {
    if (sortField === field) { setSortDir(d => d === "asc" ? "desc" : "asc"); }
    else { setSortField(field); setSortDir("asc"); }
  };

  const getEmpresaCidade = (deal: Deal) => {
    const emp = empresas.find(e => e.id === deal.empresa_id);
    return emp?.cidade || "—";
  };

  const getRepName = (deal: Deal) => {
    const rep = repOptions.find(r => r.id === deal.representative_id);
    return rep?.nome || "—";
  };

  const formatUsd = (v: number) =>
    `US$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const formatBrl = (v: number) =>
    v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  const formatPct = (v: number) =>
    v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + "%";

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return <ArrowUpDown className="h-3 w-3 opacity-30" />;
    return sortDir === "asc" ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />;
  };

  const getMarginBadge = (margin: number, large?: boolean) => {
    const sz = large ? "text-sm px-3 py-1" : "text-xs px-2.5 py-1";
    if (margin >= 30) return <Badge className={cn("bg-green-600 text-white border-0 font-black shadow-sm", sz)}>{formatPct(margin)}</Badge>;
    if (margin >= 20) return <Badge className={cn("bg-yellow-500 text-white border-0 font-black shadow-sm", sz)}>{formatPct(margin)}</Badge>;
    return <Badge className={cn("bg-red-500 text-white border-0 font-black shadow-sm", sz)}>{formatPct(margin)}</Badge>;
  };

  const openDrawer = (deal: Deal, editMode = false) => {
    setDrawerDeal(deal);
    setDrawerOpen(true);
    setShowLogsInDrawer(false);
    setEditing(false);
    if (editMode) {
      setPendingEditDeal(deal);
    } else {
      setPendingEditDeal(null);
    }
    fetchCommissionLogs(deal.id);
    fetchDealItems(deal.id);
  };

  // Trigger edit mode after drawer items are loaded
  useEffect(() => {
    if (pendingEditDeal && drawerItemsLoaded) {
      startEditing(pendingEditDeal);
      setPendingEditDeal(null);
    }
  }, [pendingEditDeal, drawerItemsLoaded]);

  const MONTHS_PT = ["", "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];

  // Find max base_price deal for highlighting
  const maxFobDealId = useMemo(() => {
    if (sorted.length === 0) return null;
    let max = sorted[0];
    for (const d of sorted) { if (d.base_price > max.base_price) max = d; }
    return max.id;
  }, [sorted]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3 bg-foreground/[0.03] rounded-xl px-4 sm:px-6 py-4 sm:py-5 border border-border/40">
        <div>
          <h2 className="font-heading text-xl sm:text-3xl font-black text-foreground tracking-tight flex items-center gap-2 sm:gap-3">
            <div className="h-8 w-8 sm:h-10 sm:w-10 rounded-lg bg-primary/15 flex items-center justify-center">
              <TrendingUp className="h-4 w-4 sm:h-5 sm:w-5 text-primary" />
            </div>
            VENDAS REALIZADAS
          </h2>
          <p className="text-xs sm:text-sm text-muted-foreground mt-1 ml-10 sm:ml-[52px]">Performance comercial do período</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => setShowPdfImport(true)} variant="outline" className="font-semibold text-sm w-full sm:w-auto">
            <FileUp className="h-4 w-4 mr-1" />
            Importar PDF
          </Button>
          <Button onClick={() => showForm ? resetForm() : openForm()} variant={showForm ? "secondary" : "default"} className="font-semibold text-sm w-full sm:w-auto">
            {showForm ? "Fechar Formulário" : "Nova Negociação"}
          </Button>
        </div>
      </div>

      {/* New deal form */}
      {showForm && (
        <Card className="border-border bg-card p-6 shadow-sm">
          <h3 className="font-heading text-base font-semibold text-card-foreground mb-4">Nova Negociação</h3>
          
          {/* Deal-level fields */}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 mb-6">
            {/* Empresa */}
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

            {/* Representante */}
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
              <Label className="mb-1.5 text-sm text-muted-foreground">Cotação do Dólar</Label>
              <Input type="number" step="0.01" min="0" value={dollarRate} onChange={(e) => setDollarRate(e.target.value)} placeholder="0,00" className="bg-secondary/50 border-border" />
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

            {/* Data da Venda */}
            <div>
              <Label className="mb-1.5 text-sm text-muted-foreground">Data da Venda</Label>
              <Popover open={saleDateOpen} onOpenChange={setSaleDateOpen}>
                <PopoverTrigger asChild>
                  <Button variant="outline" className={cn("w-full justify-start text-left font-normal h-10 bg-secondary/50 border-border", !saleDate && "text-muted-foreground")}>
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {saleDate ? format(saleDate, "dd/MM/yyyy") : "Hoje (automático)"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0 bg-popover border-border z-50" align="start">
                  <Calendar mode="single" selected={saleDate} onSelect={(d) => { setSaleDate(d); setSaleDateOpen(false); }} initialFocus className={cn("p-3 pointer-events-auto")} />
                </PopoverContent>
              </Popover>
            </div>
          </div>

          {/* Products / Items */}
          <Separator className="mb-4" />
          <div className="mb-4">
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-sm font-semibold text-card-foreground flex items-center gap-2">
                <Package className="h-4 w-4" /> Produtos ({items.length})
              </h4>
              <Button variant="outline" size="sm" onClick={addItem} className="h-7 text-xs">
                <Plus className="h-3 w-3 mr-1" /> Adicionar Produto
              </Button>
            </div>

            <div className="space-y-3">
              {items.map((item, idx) => (
                <Card key={idx} className="border-border bg-muted/20 p-4 relative">
                  {items.length > 1 && (
                    <Button
                      variant="ghost" size="icon"
                      className="absolute top-2 right-2 h-6 w-6"
                      onClick={() => removeItem(idx)}
                      title="Remover produto"
                    >
                      <X className="h-3.5 w-3.5 text-destructive" />
                    </Button>
                  )}
                  <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-5">
                    {/* Modelo */}
                    <div className="lg:col-span-2">
                      <Label className="mb-1 text-xs text-muted-foreground">Máquina *</Label>
                      <div className="flex gap-1.5">
                        <Popover open={item.modeloOpen} onOpenChange={(open) => updateItem(idx, { modeloOpen: open })}>
                          <PopoverTrigger asChild>
                            <Button variant="outline" role="combobox"
                              className="flex-1 justify-between bg-secondary/50 border-border font-normal text-sm h-9">
                              {item.machineName || "Selecionar modelo..."}
                              <ChevronsUpDown className="ml-2 h-3.5 w-3.5 shrink-0 opacity-50" />
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-[350px] p-0 bg-popover border-border z-50" align="start">
                            <Command>
                              <CommandInput placeholder="Buscar marca ou modelo..." />
                              <CommandList>
                                <CommandEmpty>Nenhum modelo encontrado.</CommandEmpty>
                                <CommandGroup>
                                  {modelos.map(m => (
                                    <CommandItem key={m.id} value={`${m.marca} ${m.modelo} ${m.tipo}`} onSelect={() => handleItemModeloSelect(idx, m.id)}>
                                      <Check className={cn("mr-2 h-4 w-4", item.modeloId === m.id ? "opacity-100" : "opacity-0")} />
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
                        <Button variant="outline" size="icon" className="h-9 w-9 shrink-0" onClick={() => { setNewModeloItemIdx(idx); setShowNewModelo(true); }} title="Novo produto">
                          <Plus className="h-4 w-4" />
                        </Button>
                      </div>
                      {item.machineType && (
                        <p className="text-[10px] text-muted-foreground mt-0.5">{item.machineType}</p>
                      )}
                    </div>

                    <div>
                      <Label className="mb-1 text-xs text-muted-foreground">Custo FOB (USD) *</Label>
                      <Input type="number" step="0.01" min="0" value={item.fobCost}
                        onChange={(e) => updateItem(idx, { fobCost: e.target.value })}
                        placeholder="0,00" className="bg-secondary/50 border-border h-9 text-sm" />
                    </div>

                    <div>
                      <Label className="mb-1 text-xs text-muted-foreground">Preço Venda FOB *</Label>
                      <Input type="number" step="0.01" min="0" value={item.precoVendaFob}
                        onChange={(e) => updateItem(idx, { precoVendaFob: e.target.value })}
                        placeholder="0,00" className="bg-secondary/50 border-border h-9 text-sm" />
                    </div>

                    <div>
                      <Label className="mb-1 text-xs text-muted-foreground">Qtd</Label>
                      <Input type="number" step="1" min="1" value={item.quantity}
                        onChange={(e) => updateItem(idx, { quantity: e.target.value })}
                        placeholder="1" className="bg-secondary/50 border-border h-9 text-sm" />
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          </div>

          <div className="md:col-span-2 lg:col-span-2 mb-4">
            <Label className="mb-1.5 text-sm text-muted-foreground">Observação</Label>
            <Textarea value={observation} onChange={(e) => setObservation(e.target.value)} placeholder="Observações sobre a negociação..." className="bg-secondary/50 border-border" />
          </div>

          {/* Live simulation preview */}
          {simulation && (
            <Card className="mt-4 border-primary/20 bg-primary/5 p-4">
              <h4 className="font-heading text-sm font-semibold text-primary mb-3">Prévia da Simulação</h4>
              <div className="grid gap-2 md:grid-cols-2 lg:grid-cols-4 text-sm">
                <div><span className="text-muted-foreground">Total FOB Venda:</span> <span className="font-semibold">{formatUsd(simulation.totalVenda)}</span></div>
                <div><span className="text-muted-foreground">Lucro Bruto:</span> <span className="font-semibold text-accent">{formatUsd(simulation.grossProfit)}</span></div>
                <div><span className="text-muted-foreground">Margem Bruta:</span> <span className="font-semibold">{formatPct(simulation.grossMargin)}</span></div>
                <div><span className="text-muted-foreground">Com. Vendedor ({formatPct(parseFloat(sellerPct) || 0)}):</span> <span className="font-semibold text-warning">{formatUsd(simulation.sellerComm)}{simulation.hasDollar && ` (${simulation.sellerCommBrl.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })})`}</span></div>
                <div><span className="text-muted-foreground">Com. Gestor ({formatPct(parseFloat(managerPct) || 0)}):</span> <span className="font-semibold text-warning">{formatUsd(simulation.managerComm)}{simulation.hasDollar && ` (${simulation.managerCommBrl.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })})`}</span></div>
                <div className="bg-accent/10 rounded px-2 py-1 -mx-2"><span className="text-muted-foreground">Lucro Líquido:</span> <span className={`font-bold text-base ${simulation.netProfit < 0 ? "text-destructive" : "text-accent"}`}>{formatUsd(simulation.netProfit)}</span></div>
                <div className="bg-accent/10 rounded px-2 py-1 -mx-2"><span className="text-muted-foreground">Margem Líquida:</span> <span className={`font-bold text-base ${simulation.netMargin < 0 ? "text-destructive" : "text-accent"}`}>{formatPct(simulation.netMargin)}</span></div>
              </div>
              {simulation.hasDollar && (
                <div className="mt-2 text-xs text-muted-foreground">
                  Total FOB BRL: {simulation.basePriceBrl.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
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
          <DialogHeader><DialogTitle>Nova Empresa</DialogTitle></DialogHeader>
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

      {/* New Modelo Dialog */}
      <Dialog open={showNewModelo} onOpenChange={setShowNewModelo}>
        <DialogContent className="bg-card border-border">
          <DialogHeader><DialogTitle>Novo Produto no Catálogo</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-sm text-muted-foreground">Tipo *</Label>
              <Select value={newModeloTipo} onValueChange={setNewModeloTipo}>
                <SelectTrigger className="bg-secondary/50 border-border">
                  <SelectValue placeholder="Selecionar tipo..." />
                </SelectTrigger>
                <SelectContent>
                  {MACHINE_TYPES.map(t => (
                    <SelectItem key={t} value={t}>{t}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-sm text-muted-foreground">Marca *</Label>
              <Input value={newModeloMarca} onChange={(e) => setNewModeloMarca(e.target.value)} placeholder="Ex: DMTG" className="bg-secondary/50 border-border" />
            </div>
            <div>
              <Label className="text-sm text-muted-foreground">Modelo *</Label>
              <Input value={newModeloModelo} onChange={(e) => setNewModeloModelo(e.target.value)} placeholder="Ex: OKM-850D" className="bg-secondary/50 border-border" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-sm text-muted-foreground">Custo FOB (USD)</Label>
                <Input type="number" step="0.01" min="0" value={newModeloCustoFob} onChange={(e) => setNewModeloCustoFob(e.target.value)} placeholder="0,00" className="bg-secondary/50 border-border" />
              </div>
              <div>
                <Label className="text-sm text-muted-foreground">Preço Venda FOB (USD)</Label>
                <Input type="number" step="0.01" min="0" value={newModeloPrecoVenda} onChange={(e) => setNewModeloPrecoVenda(e.target.value)} placeholder="0,00" className="bg-secondary/50 border-border" />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNewModelo(false)}>Cancelar</Button>
            <Button onClick={handleCreateModelo} disabled={!newModeloMarca.trim() || !newModeloModelo.trim() || !newModeloTipo}>
              <Plus className="h-4 w-4 mr-2" /> Cadastrar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Card className="border-border bg-card p-3 sm:p-4 shadow-sm">
        <div className="flex flex-col sm:flex-row flex-wrap gap-2 sm:gap-3 items-stretch sm:items-center">
          <div className="relative flex-1 min-w-0">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar empresa, máquina ou tipo..." className="pl-9 bg-secondary/50 border-border text-sm" />
          </div>
          <div className="grid grid-cols-2 sm:flex gap-2">
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="w-full sm:w-[130px] bg-secondary/50 border-border text-xs sm:text-sm h-9"><SelectValue placeholder="Status" /></SelectTrigger>
              <SelectContent className="bg-popover border-border z-50">
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="open">Abertas</SelectItem>
                <SelectItem value="closed">Fechadas</SelectItem>
              </SelectContent>
            </Select>
            <Select value={filterYear} onValueChange={setFilterYear}>
              <SelectTrigger className="w-full sm:w-[110px] bg-secondary/50 border-border text-xs sm:text-sm h-9"><SelectValue placeholder="Ano" /></SelectTrigger>
              <SelectContent className="bg-popover border-border z-50">
                <SelectItem value="all">Todo Ano</SelectItem>
                {years.map(y => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={filterMonth} onValueChange={setFilterMonth}>
              <SelectTrigger className="w-full sm:w-[130px] bg-secondary/50 border-border text-xs sm:text-sm h-9"><SelectValue placeholder="Mês" /></SelectTrigger>
              <SelectContent className="bg-popover border-border z-50">
                <SelectItem value="all">Todo Mês</SelectItem>
                {Array.from({ length: 12 }, (_, i) => (
                  <SelectItem key={i + 1} value={String(i + 1)}>{MONTHS_PT[i + 1]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={filterRepId} onValueChange={setFilterRepId}>
              <SelectTrigger className="w-full sm:w-[160px] bg-secondary/50 border-border text-xs sm:text-sm h-9"><SelectValue placeholder="Representante" /></SelectTrigger>
              <SelectContent className="bg-popover border-border z-50">
                <SelectItem value="all">Todos Reps</SelectItem>
                {repOptions.map(r => <SelectItem key={r.id} value={r.id}>{r.nome}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <Badge variant="outline" className="text-xs self-start sm:self-center">{filtered.length} registros</Badge>
        </div>
      </Card>

      {/* ── KPI TOTALS ── */}
      {!loading && filtered.length > 0 && (() => {
        const totalFob = filtered.reduce((s, d) => s + d.base_price, 0);
        const totalNetProfit = filtered.reduce((s, d) => s + d.net_profit, 0);
        const totalCommission = filtered.reduce((s, d) => s + ((d.seller_commission_value + d.manager_commission_value) * (d.dollar_rate || 1)), 0);
        const avgMargin = filtered.length > 0 ? filtered.reduce((s, d) => s + d.net_margin_percent, 0) / filtered.length : 0;
        const formatCompact = (v: number) => {
          if (Math.abs(v) >= 1_000_000) return (v / 1_000_000).toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + "M";
          if (Math.abs(v) >= 1_000) return (v / 1_000).toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + "K";
          return v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        };
        const kpis = [
          { label: "FOB TOTAL", desc: "Faturamento bruto no período", value: formatUsd(totalFob), compactValue: `US$ ${formatCompact(totalFob)}`, icon: <DollarSign className="h-5 w-5" />, accent: "bg-blue-600/15 text-blue-700 border-blue-300/60", iconBg: "bg-blue-600/20" },
          { label: "LUCRO LÍQUIDO", desc: "Após comissões descontadas", value: formatUsd(totalNetProfit), compactValue: `US$ ${formatCompact(totalNetProfit)}`, icon: <TrendingUp className="h-5 w-5" />, accent: "bg-emerald-600/15 text-emerald-700 border-emerald-300/60", iconBg: "bg-emerald-600/20", negative: totalNetProfit < 0 },
          { label: "COMISSÃO TOTAL", desc: "Representante + Gestor (BRL)", value: formatBrl(totalCommission), compactValue: `R$ ${formatCompact(totalCommission)}`, icon: <Receipt className="h-5 w-5" />, accent: "bg-purple-600/15 text-purple-700 border-purple-300/60", iconBg: "bg-purple-600/20" },
          { label: "MARGEM MÉDIA", desc: "Média líquida do período", value: formatPct(avgMargin), compactValue: formatPct(avgMargin), icon: <Percent className="h-5 w-5" />, accent: "bg-orange-600/15 text-orange-700 border-orange-300/60", iconBg: "bg-orange-600/20", badge: true, margin: avgMargin },
        ];
        return (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            {kpis.map((k) => (
              <Card key={k.label} className={cn("px-3 py-4 sm:px-5 sm:py-5 shadow-md border-2 overflow-hidden", k.accent)}>
                <div className="flex items-center gap-2 mb-2 sm:mb-3">
                  <div className={cn("h-7 w-7 sm:h-8 sm:w-8 rounded-lg flex items-center justify-center shrink-0", k.iconBg)}>
                    {k.icon}
                  </div>
                  <span className="text-[10px] sm:text-[11px] font-black uppercase tracking-wider leading-tight">{k.label}</span>
                </div>
                {k.badge ? (
                  <div className="mb-1.5">{getMarginBadge(k.margin!, true)}</div>
                ) : (
                  <>
                    <p className={cn(
                      "text-lg sm:text-2xl lg:text-3xl font-black tabular-nums leading-none tracking-tight break-all sm:break-normal hidden sm:block",
                      k.negative ? "text-destructive" : ""
                    )}>
                      {k.value}
                    </p>
                    <p className={cn(
                      "text-xl font-black tabular-nums leading-none tracking-tight sm:hidden",
                      k.negative ? "text-destructive" : ""
                    )}>
                      {k.compactValue}
                    </p>
                  </>
                )}
                <p className="text-[10px] sm:text-[11px] opacity-50 mt-1.5 sm:mt-2 font-semibold leading-tight">{k.desc}</p>
              </Card>
            ))}
          </div>
        );
      })()}

      {/* ── STRATEGIC BLOCK: HIGHLIGHT DEAL + MARGIN INDICATOR ── */}
      {!loading && filtered.length > 0 && (() => {
        const totalFob = filtered.reduce((s, d) => s + d.base_price, 0);
        const avgMargin = filtered.reduce((s, d) => s + d.net_margin_percent, 0) / filtered.length;
        const topDeal = filtered.reduce((best, d) => d.base_price > best.base_price ? d : best, filtered[0]);
        const impactPct = totalFob > 0 ? (topDeal.base_price / totalFob) * 100 : 0;
        const topRep = repOptions.find(r => r.id === topDeal.representative_id);
        const topEmp = empresas.find(e => e.id === topDeal.empresa_id);

        const marginIndicator = avgMargin >= 30
          ? { emoji: "🟢", text: "Performance saudável", color: "text-green-600" }
          : avgMargin >= 20
          ? { emoji: "🟡", text: "Atenção à margem", color: "text-yellow-600" }
          : { emoji: "🔴", text: "Margem em risco", color: "text-red-600" };

        return (
          <div className="space-y-3">
            {/* Margin health indicator */}
            <div className={cn("flex items-center gap-2 px-1", marginIndicator.color)}>
              <span className="text-lg">{marginIndicator.emoji}</span>
              <span className="text-sm font-bold">{marginIndicator.text}</span>
              <span className="text-xs opacity-70">— margem média {formatPct(avgMargin)}</span>
            </div>

            {/* Top deal card */}
            <Card className="border-2 border-blue-400/40 bg-blue-500/[0.04] shadow-md rounded-xl px-4 sm:px-6 py-4 sm:py-5">
              <div className="flex items-center gap-2 mb-4">
                <span className="text-lg">🔥</span>
                <h3 className="font-heading text-sm font-black uppercase tracking-widest text-blue-700">Venda Destaque do Período</h3>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-4">
                {[
                  { label: "Empresa", value: topDeal.client_name },
                  { label: "Cidade", value: topEmp?.cidade || "—" },
                  { label: "Modelo", value: topDeal.machine_name || "—" },
                  { label: "Representante", value: topRep?.nome || "—" },
                  { label: "FOB Venda", value: formatUsd(topDeal.base_price) },
                  { label: "Margem Líq.", value: null, badge: topDeal.net_margin_percent },
                  { label: "Impacto no Mês", value: `${impactPct.toFixed(1)}%` },
                ].map((item) => (
                  <div key={item.label}>
                    <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1">{item.label}</p>
                    {item.badge !== undefined && item.badge !== null ? (
                      getMarginBadge(item.badge, true)
                    ) : (
                      <p className="text-sm font-bold text-foreground truncate">{item.value}</p>
                    )}
                  </div>
                ))}
              </div>
            </Card>
          </div>
        );
      })()}

      {/* ── DATA TABLE ── */}
      {loading ? (
        <p className="text-muted-foreground text-center py-8">Carregando...</p>
      ) : sorted.length === 0 ? (
        <p className="text-muted-foreground text-center py-8">Nenhuma negociação encontrada.</p>
      ) : (
        <Card className="border-border/60 bg-card shadow-md overflow-hidden rounded-xl">
          <div className="overflow-x-auto max-h-[calc(100vh-400px)] scrollbar-thin scrollbar-thumb-muted-foreground/15 scrollbar-track-transparent">
            <Table>
              <TableHeader className="sticky top-0 z-10">
                <TableRow className="bg-foreground/[0.08] hover:bg-foreground/[0.08] border-b-2 border-border/60">
                  {[
                    { label: "Data", field: "created_at" as SortField, align: "" },
                    { label: "Empresa", field: "client_name" as SortField, align: "" },
                    { label: "Cidade/UF", field: "cidade" as SortField, align: "" },
                    { label: "Tipo", field: "machine_type" as SortField, align: "" },
                    { label: "Modelo", field: "machine_name" as SortField, align: "" },
                    { label: "Representante", field: "representative_id" as SortField, align: "" },
                    { label: "FOB Venda", field: "base_price" as SortField, align: "text-right" },
                    { label: "CIF Venda", field: "final_price" as SortField, align: "text-right" },
                    { label: "Impacto %", field: "base_price" as SortField, align: "text-right" },
                    { label: "Margem Líq.", field: "net_margin_percent" as SortField, align: "text-right" },
                    { label: "Lucro Líq.", field: "net_profit" as SortField, align: "text-right" },
                    { label: "Com. Rep.", field: "seller_commission_value" as SortField, align: "text-right" },
                    { label: "Com. Gest.", field: "manager_commission_value" as SortField, align: "text-right" },
                  ].map((col) => (
                    <TableHead key={col.label} className={cn("text-[11px] font-black uppercase tracking-wider whitespace-nowrap cursor-pointer select-none h-12 text-foreground/80", col.align)} onClick={() => toggleSort(col.field)}>
                      <span className={cn("flex items-center gap-1", col.align === "text-right" ? "justify-end" : "")}>{col.label} <SortIcon field={col.field} /></span>
                    </TableHead>
                  ))}
                  <TableHead className="text-[11px] font-black uppercase tracking-wider whitespace-nowrap text-center w-[80px] h-12 text-foreground/80">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(() => {
                  const periodTotalFob = filtered.reduce((s, d) => s + d.base_price, 0);
                  return sorted.map((deal, idx) => {
                    const sellerBrl = deal.seller_commission_value * deal.dollar_rate;
                    const managerBrl = deal.manager_commission_value * deal.dollar_rate;
                    const impactPct = periodTotalFob > 0 ? (deal.base_price / periodTotalFob) * 100 : 0;
                    const isBiggest = deal.id === maxFobDealId;
                    return (
                      <TableRow
                        key={deal.id}
                        className={cn(
                          "cursor-pointer transition-all duration-150 border-0",
                          idx % 2 === 0 ? "bg-card" : "bg-foreground/[0.025]",
                          "hover:bg-primary/10 hover:shadow-sm",
                          isBiggest && "bg-blue-500/[0.06] hover:bg-blue-500/[0.1] ring-1 ring-inset ring-blue-400/20"
                        )}
                        onClick={() => openDrawer(deal, true)}
                      >
                        <TableCell className="text-[13px] whitespace-nowrap py-3.5">
                          {new Date(deal.created_at).toLocaleDateString("pt-BR")}
                        </TableCell>
                        <TableCell className="text-[13px] font-bold max-w-[160px] truncate py-3.5">{deal.client_name}</TableCell>
                        <TableCell className="text-[13px] text-muted-foreground whitespace-nowrap py-3.5">{getEmpresaCidade(deal)}</TableCell>
                        <TableCell className="text-[13px] text-muted-foreground max-w-[120px] truncate py-3.5">{deal.machine_type || "—"}</TableCell>
                        <TableCell className="text-[13px] max-w-[180px] truncate py-3.5">{deal.machine_name || "—"}</TableCell>
                        <TableCell className="text-[13px] whitespace-nowrap py-3.5">{getRepName(deal)}</TableCell>
                        <TableCell className="text-[13px] text-right font-semibold tabular-nums py-3.5">{formatUsd(deal.base_price)}</TableCell>
                        <TableCell className="text-[13px] text-right font-semibold tabular-nums py-3.5">{formatUsd(deal.final_price)}</TableCell>
                        <TableCell className="text-[13px] text-right tabular-nums font-semibold py-3.5">
                          {impactPct.toFixed(1)}%
                        </TableCell>
                        <TableCell className="text-right py-3.5">
                          {getMarginBadge(deal.net_margin_percent, true)}
                        </TableCell>
                        <TableCell className={cn("text-[13px] text-right font-bold tabular-nums py-3.5", deal.net_profit < 0 ? "text-destructive" : "text-accent")}>
                          {formatUsd(deal.net_profit)}
                        </TableCell>
                        <TableCell className="text-[13px] text-right tabular-nums text-muted-foreground py-3.5">
                          {deal.dollar_rate > 0 ? formatBrl(sellerBrl) : formatUsd(deal.seller_commission_value)}
                        </TableCell>
                        <TableCell className="text-[13px] text-right tabular-nums text-muted-foreground py-3.5">
                          {deal.dollar_rate > 0 ? formatBrl(managerBrl) : formatUsd(deal.manager_commission_value)}
                        </TableCell>
                        <TableCell onClick={(e) => e.stopPropagation()} className="py-3.5">
                          <div className="flex gap-0.5 justify-center">
                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openDrawer(deal)} title="Ver detalhes">
                              <Eye className="h-3.5 w-3.5" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openDrawer(deal, true)} title="Editar">
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  });
                })()}
              </TableBody>
            </Table>
          </div>
        </Card>
      )}

      {/* ── DETAIL POPUP ── */}
      <Dialog open={drawerOpen} onOpenChange={(open) => { setDrawerOpen(open); if (!open) { setEditing(false); setDrawerDeal(null); } }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto bg-card border-border p-0 sm:rounded-xl">
          {drawerDeal && (() => {
            const deal = drawerDeal;
            const emp = empresas.find(e => e.id === deal.empresa_id);
            const rep = repOptions.find(r => r.id === deal.representative_id);
            const dollar = editing ? (parseFloat(editForm.dollar_rate) || 0) : deal.dollar_rate;
            const hasDollar = dollar > 0;

            return (
              <div className="flex flex-col h-full">
                {/* Drawer Header */}
                <div className="p-5 border-b border-border bg-muted/20">
                  <DialogTitle className="text-lg font-heading font-bold text-foreground flex items-center gap-2">
                    <Building2 className="h-5 w-5 text-primary" />
                    {deal.client_name}
                  </DialogTitle>
                  <div className="flex items-center gap-2 mt-1.5">
                    <Badge variant={deal.status === "closed" ? "secondary" : "default"} className="text-xs">
                      {deal.status === "closed" ? "Fechada" : "Aberta"}
                    </Badge>
                    {!editing && getMarginBadge(deal.net_margin_percent)}
                  </div>
                  <div className="flex gap-2 mt-3 flex-wrap">
                    {!editing && (
                      <Button size="sm" variant="outline" onClick={() => startEditing(deal)}>
                        <Pencil className="h-3.5 w-3.5 mr-1.5" /> Editar
                      </Button>
                    )}
                    {deal.status === "open" && !editing && (
                      <Button size="sm" variant="outline" onClick={() => handleClose(deal)}>
                        <Lock className="h-3.5 w-3.5 mr-1.5" /> Fechar Venda
                      </Button>
                    )}
                    {deal.status === "closed" && !editing && (
                      <Button size="sm" variant="outline" onClick={() => handleReopen(deal)}>
                        <Unlock className="h-3.5 w-3.5 mr-1.5" /> Reabrir
                      </Button>
                    )}
                    {!editing && (
                      <Button size="sm" variant="outline" className="text-destructive hover:text-destructive" onClick={() => handleDelete(deal.id)}>
                        <Trash2 className="h-3.5 w-3.5 mr-1.5" /> Excluir
                      </Button>
                    )}
                    {editing && (
                      <>
                        <Button size="sm" onClick={handleSaveEdit} disabled={!editSimulation}>
                          <Save className="h-3.5 w-3.5 mr-1.5" /> Salvar
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => setEditing(false)}>
                          <X className="h-3.5 w-3.5 mr-1.5" /> Cancelar
                        </Button>
                      </>
                    )}
                  </div>
                </div>

                {/* Drawer Body */}
                <ScrollArea className="flex-1">
                  <div className="p-5 space-y-5">

                    {/* ─── A) Identificação ─── */}
                    <DrawerSection title="Identificação" icon={<Building2 className="h-4 w-4 text-primary" />}>
                      {editing ? (
                        <div className="space-y-3">
                          <div>
                            <Label className="text-xs text-muted-foreground">Empresa *</Label>
                            <Popover open={editEmpresaOpen} onOpenChange={setEditEmpresaOpen}>
                              <PopoverTrigger asChild>
                                <Button variant="outline" role="combobox" className="w-full justify-between bg-secondary/50 border-border font-normal text-sm h-9">
                                  {empresas.find(e => e.id === editEmpresaId)?.nome || "Selecionar empresa..."}
                                  <ChevronsUpDown className="ml-2 h-3.5 w-3.5 shrink-0 opacity-50" />
                                </Button>
                              </PopoverTrigger>
                              <PopoverContent className="w-[300px] p-0 bg-popover border-border z-[60]" align="start">
                                <Command>
                                  <CommandInput placeholder="Buscar empresa..." />
                                  <CommandList>
                                    <CommandEmpty>Nenhuma empresa encontrada.</CommandEmpty>
                                    <CommandGroup>
                                      {empresas.map(e => (
                                        <CommandItem key={e.id} value={e.nome} onSelect={() => { setEditEmpresaId(e.id); setEditEmpresaOpen(false); }}>
                                          <Check className={cn("mr-2 h-4 w-4", editEmpresaId === e.id ? "opacity-100" : "opacity-0")} />
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
                          </div>
                          <div>
                            <Label className="text-xs text-muted-foreground">Data da Venda</Label>
                            <Popover open={editDateOpen} onOpenChange={setEditDateOpen}>
                              <PopoverTrigger asChild>
                                <Button variant="outline" className={cn("w-full justify-start text-left font-normal h-9 bg-secondary/50 border-border text-sm")}>
                                  <CalendarIcon className="mr-2 h-3.5 w-3.5" />
                                  {editDate ? format(editDate, "dd/MM/yyyy") : "Selecionar data"}
                                </Button>
                              </PopoverTrigger>
                              <PopoverContent className="w-auto p-0 bg-popover border-border z-[60]" align="start">
                                <Calendar mode="single" selected={editDate} onSelect={(d) => { setEditDate(d); setEditDateOpen(false); }} initialFocus className={cn("p-3 pointer-events-auto")} />
                              </PopoverContent>
                            </Popover>
                          </div>
                          <div>
                            <Label className="text-xs text-muted-foreground">Representante</Label>
                            <Popover open={editRepOpen} onOpenChange={setEditRepOpen}>
                              <PopoverTrigger asChild>
                                <Button variant="outline" role="combobox" className="w-full justify-between bg-secondary/50 border-border font-normal text-sm h-9">
                                  {repOptions.find(r => r.id === editRepId)?.nome || "Nenhum"}
                                  <ChevronsUpDown className="ml-2 h-3.5 w-3.5 shrink-0 opacity-50" />
                                </Button>
                              </PopoverTrigger>
                              <PopoverContent className="w-[280px] p-0 bg-popover border-border z-[60]" align="start">
                                <Command>
                                  <CommandInput placeholder="Buscar representante..." />
                                  <CommandList>
                                    <CommandEmpty>Nenhum encontrado.</CommandEmpty>
                                    <CommandGroup>
                                      <CommandItem value="nenhum" onSelect={() => { setEditRepId("none"); setEditRepOpen(false); }}>
                                        <Check className={cn("mr-2 h-4 w-4", !editRepId || editRepId === "none" ? "opacity-100" : "opacity-0")} />
                                        Nenhum
                                      </CommandItem>
                                      {repOptions.map(r => (
                                        <CommandItem key={r.id} value={r.nome} onSelect={() => handleEditRepSelect(r.id)}>
                                          <Check className={cn("mr-2 h-4 w-4", editRepId === r.id ? "opacity-100" : "opacity-0")} />
                                          {r.nome}
                                        </CommandItem>
                                      ))}
                                    </CommandGroup>
                                  </CommandList>
                                </Command>
                              </PopoverContent>
                            </Popover>
                          </div>
                        </div>
                      ) : (
                        <div className="grid grid-cols-[auto,1fr] gap-x-4 gap-y-1.5">
                          <span className="text-sm text-muted-foreground">Empresa</span>
                          <span className="text-sm font-medium text-foreground">{deal.client_name}</span>
                          <span className="text-sm text-muted-foreground">Cidade/UF</span>
                          <span className="text-sm font-medium text-foreground">{emp?.cidade || "—"}</span>
                          <span className="text-sm text-muted-foreground">Data da Venda</span>
                          <span className="text-sm font-medium text-foreground">{new Date(deal.created_at).toLocaleDateString("pt-BR")}</span>
                          {deal.closed_at && (
                            <>
                              <span className="text-sm text-muted-foreground">Fechada em</span>
                              <span className="text-sm font-medium text-foreground">{new Date(deal.closed_at).toLocaleDateString("pt-BR")}</span>
                            </>
                          )}
                          <span className="text-sm text-muted-foreground">Representante</span>
                          <span className="text-sm font-medium text-foreground">{rep?.nome || "—"}</span>
                        </div>
                      )}
                    </DrawerSection>

                    <Separator />

                    {/* ─── B) Máquina / Produtos ─── */}
                    <DrawerSection title={`Máquina${drawerItems.length > 1 || editItems.length > 1 ? 's' : ''} (${editing ? editItems.length : (drawerItems.length || 1)})`} icon={<Wrench className="h-4 w-4 text-primary" />}>
                      {editing ? (
                        <div className="space-y-3">
                          {editItems.map((item, idx) => (
                            <Card key={idx} className="border-border bg-muted/20 p-3 relative">
                              {editItems.length > 1 && (
                                <Button variant="ghost" size="icon" className="absolute top-1 right-1 h-6 w-6" onClick={() => removeEditItem(idx)}>
                                  <X className="h-3 w-3 text-destructive" />
                                </Button>
                              )}
                              <div className="space-y-2">
                                <div>
                                  <Label className="text-[11px] text-muted-foreground">Modelo</Label>
                                  <Popover open={item.modeloOpen} onOpenChange={(open) => updateEditItem(idx, { modeloOpen: open })}>
                                    <PopoverTrigger asChild>
                                      <Button variant="outline" role="combobox" className="w-full justify-between bg-secondary/50 border-border font-normal text-xs h-8">
                                        {item.machineName || "Selecionar modelo..."}
                                        <ChevronsUpDown className="ml-2 h-3 w-3 shrink-0 opacity-50" />
                                      </Button>
                                    </PopoverTrigger>
                                    <PopoverContent className="w-[300px] p-0 bg-popover border-border z-[60]" align="start">
                                      <Command>
                                        <CommandInput placeholder="Buscar..." />
                                        <CommandList>
                                          <CommandEmpty>Nenhum modelo.</CommandEmpty>
                                          <CommandGroup>
                                            {modelos.map(m => (
                                              <CommandItem key={m.id} value={`${m.marca} ${m.modelo} ${m.tipo}`} onSelect={() => handleEditItemModeloSelect(idx, m.id)}>
                                                <Check className={cn("mr-2 h-3 w-3", item.modeloId === m.id ? "opacity-100" : "opacity-0")} />
                                                <span className="text-xs">{m.marca} {m.modelo} <span className="text-muted-foreground">({m.tipo})</span></span>
                                              </CommandItem>
                                            ))}
                                          </CommandGroup>
                                        </CommandList>
                                      </Command>
                                    </PopoverContent>
                                  </Popover>
                                </div>
                                <div className="grid grid-cols-3 gap-2">
                                  <div>
                                    <Label className="text-[11px] text-muted-foreground">Custo FOB</Label>
                                    <Input type="number" step="0.01" value={item.fobCost} onChange={(e) => updateEditItem(idx, { fobCost: e.target.value })} className="h-7 text-xs bg-secondary/50 border-border" />
                                  </div>
                                  <div>
                                    <Label className="text-[11px] text-muted-foreground">Venda FOB</Label>
                                    <Input type="number" step="0.01" value={item.precoVendaFob} onChange={(e) => updateEditItem(idx, { precoVendaFob: e.target.value })} className="h-7 text-xs bg-secondary/50 border-border" />
                                  </div>
                                  <div>
                                    <Label className="text-[11px] text-muted-foreground">Qtd</Label>
                                    <Input type="number" min="1" value={item.quantity} onChange={(e) => updateEditItem(idx, { quantity: e.target.value })} className="h-7 text-xs bg-secondary/50 border-border" />
                                  </div>
                                </div>
                              </div>
                            </Card>
                          ))}
                          <Button variant="outline" size="sm" onClick={addEditItem} className="w-full h-7 text-xs">
                            <Plus className="h-3 w-3 mr-1" /> Adicionar Produto
                          </Button>
                        </div>
                      ) : drawerItems.length > 0 ? (
                        <div className="space-y-2">
                          {drawerItems.map((item) => (
                            <div key={item.id} className="bg-muted/30 rounded-md p-3">
                              <div className="flex justify-between items-start">
                                <div>
                                  <p className="text-sm font-semibold text-foreground">{item.machine_name || "—"}</p>
                                  <p className="text-xs text-muted-foreground">{item.machine_type}</p>
                                </div>
                                {item.quantity > 1 && (
                                  <Badge variant="outline" className="text-[10px]">{item.quantity}x</Badge>
                                )}
                              </div>
                              <div className="grid grid-cols-[auto,1fr] gap-x-4 gap-y-0.5 text-xs mt-2">
                                <span className="text-muted-foreground">Custo FOB:</span>
                                <span className="text-right font-medium">{formatUsd(item.fob_cost)}</span>
                                <span className="text-muted-foreground">Venda FOB:</span>
                                <span className="text-right font-medium">{formatUsd(item.preco_venda_fob)}</span>
                                <span className="text-muted-foreground">Margem Bruta:</span>
                                <span className="text-right font-medium">{formatPct(item.gross_margin_percent)}</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="grid grid-cols-[auto,1fr] gap-x-4 gap-y-1.5">
                          <span className="text-sm text-muted-foreground">Tipo</span>
                          <span className="text-sm font-medium text-foreground">{deal.machine_type || "—"}</span>
                          <span className="text-sm text-muted-foreground">Modelo</span>
                          <span className="text-sm font-medium text-foreground">{deal.machine_name || "—"}</span>
                        </div>
                      )}
                    </DrawerSection>

                    <Separator />

                    {/* ─── C) Valores ─── */}
                    <DrawerSection title="Valores" icon={<DollarSign className="h-4 w-4 text-accent" />}>
                      {editing ? (
                        <div className="space-y-3">
                          {editSimulation && (
                            <div className="bg-muted/30 rounded-md p-3">
                              <div className="grid grid-cols-[auto,1fr] gap-x-4 gap-y-1">
                                <span className="text-xs text-muted-foreground">FOB Venda Total</span>
                                <span className="text-xs text-right font-semibold">{formatUsd(editSimulation.totalVenda)}</span>
                                <span className="text-xs text-muted-foreground">Custo FOB Total</span>
                                <span className="text-xs text-right font-semibold">{formatUsd(editSimulation.totalFob)}</span>
                              </div>
                            </div>
                          )}
                          <div>
                            <Label className="text-xs text-muted-foreground">Cotação do Dólar</Label>
                            <Input type="number" step="0.01" value={editForm.dollar_rate} onChange={(e) => setEditForm((f: any) => ({ ...f, dollar_rate: e.target.value }))} className="h-8 text-sm bg-secondary/50 border-border" />
                          </div>
                          <div>
                            <Label className="text-xs text-muted-foreground">Observação</Label>
                            <Textarea value={editForm.observation} onChange={(e) => setEditForm((f: any) => ({ ...f, observation: e.target.value }))} className="text-sm bg-secondary/50 border-border" rows={2} />
                          </div>
                        </div>
                      ) : (
                        <div className="grid grid-cols-[auto,1fr] gap-x-4 gap-y-1.5">
                          <span className="text-sm text-muted-foreground">FOB Venda (USD)</span>
                          <span className="text-sm font-semibold text-foreground text-right">{formatUsd(deal.base_price)}</span>
                          <span className="text-sm text-muted-foreground">CIF Venda (USD)</span>
                          <span className="text-sm font-semibold text-foreground text-right">{formatUsd(deal.final_price)}</span>
                          <span className="text-sm text-muted-foreground">Dólar Utilizado</span>
                          <span className="text-sm font-medium text-foreground text-right">{hasDollar ? `R$ ${dollar.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}` : "—"}</span>
                          {hasDollar && (
                            <>
                              <span className="text-sm text-muted-foreground">FOB Venda (BRL)</span>
                              <span className="text-sm font-medium text-foreground text-right">{formatBrl(deal.base_price * dollar)}</span>
                            </>
                          )}
                          {deal.observation && (
                            <>
                              <span className="text-sm text-muted-foreground">Observações</span>
                              <span className="text-sm text-foreground text-right">{deal.observation}</span>
                            </>
                          )}
                        </div>
                      )}
                    </DrawerSection>

                    <Separator />

                    {/* ─── D) Comissão ─── */}
                    <DrawerSection title="Comissão" icon={<Percent className="h-4 w-4 text-warning" />}>
                      {editing ? (
                        <div className="space-y-3">
                          <div>
                            <Label className="text-xs text-muted-foreground">% Representante</Label>
                            <Input type="number" step="0.01" value={editForm.seller_commission_pct} onChange={(e) => setEditForm(f => ({ ...f, seller_commission_pct: e.target.value }))} className="h-8 text-sm bg-secondary/50 border-border" />
                            {editSimulation && (
                              <p className="text-xs text-accent mt-1">
                                = {formatUsd(editSimulation.sellerComm)}
                                {editSimulation.dollar > 0 && ` (${formatBrl(editSimulation.sellerComm * editSimulation.dollar)})`}
                              </p>
                            )}
                          </div>
                          <div>
                            <Label className="text-xs text-muted-foreground">% Gestor</Label>
                            <Input type="number" step="0.01" value={editForm.manager_commission_pct} onChange={(e) => setEditForm(f => ({ ...f, manager_commission_pct: e.target.value }))} className="h-8 text-sm bg-secondary/50 border-border" />
                            {editSimulation && (
                              <p className="text-xs text-accent mt-1">
                                = {formatUsd(editSimulation.managerComm)}
                                {editSimulation.dollar > 0 && ` (${formatBrl(editSimulation.managerComm * editSimulation.dollar)})`}
                              </p>
                            )}
                          </div>
                        </div>
                      ) : (
                        <div className="grid grid-cols-[auto,1fr] gap-x-4 gap-y-1.5">
                          <span className="text-sm text-muted-foreground">% Representante</span>
                          <span className="text-sm font-medium text-foreground text-right">{formatPct(deal.seller_commission_pct)}</span>
                          <span className="text-sm text-muted-foreground">% Gestor</span>
                          <span className="text-sm font-medium text-foreground text-right">{formatPct(deal.manager_commission_pct)}</span>
                          <span className="text-sm text-muted-foreground">Comissão Rep. (USD)</span>
                          <span className="text-sm font-semibold text-foreground text-right">{formatUsd(deal.seller_commission_value)}</span>
                          {hasDollar && (
                            <>
                              <span className="text-sm text-muted-foreground">Comissão Rep. (BRL)</span>
                              <span className="text-sm font-semibold text-foreground text-right">{formatBrl(deal.seller_commission_value * dollar)}</span>
                            </>
                          )}
                          <span className="text-sm text-muted-foreground">Comissão Gestor (USD)</span>
                          <span className="text-sm font-semibold text-foreground text-right">{formatUsd(deal.manager_commission_value)}</span>
                          {hasDollar && (
                            <>
                              <span className="text-sm text-muted-foreground">Comissão Gestor (BRL)</span>
                              <span className="text-sm font-semibold text-foreground text-right">{formatBrl(deal.manager_commission_value * dollar)}</span>
                            </>
                          )}
                        </div>
                      )}
                    </DrawerSection>

                    <Separator />

                    {/* ─── E) Resultado ─── */}
                    <DrawerSection title="Resultado" icon={<TrendingUp className="h-4 w-4 text-accent" />}>
                      {editing && editSimulation ? (
                        <div className="bg-muted/30 rounded-md p-3">
                          <div className="grid grid-cols-[auto,1fr] gap-x-4 gap-y-1.5">
                            <span className="text-sm text-muted-foreground">Lucro Bruto</span>
                            <span className="text-sm font-bold text-accent text-right">{formatUsd(editSimulation.grossProfit)}</span>
                            <span className="text-sm text-muted-foreground">Margem Bruta</span>
                            <span className="text-sm font-bold text-foreground text-right">{formatPct(editSimulation.grossMargin)}</span>
                            <span className="text-sm text-muted-foreground">Lucro Líquido</span>
                            <span className={cn("text-sm font-bold text-right", editSimulation.netProfit < 0 ? "text-destructive" : "text-accent")}>{formatUsd(editSimulation.netProfit)}</span>
                            <span className="text-sm text-muted-foreground">Margem Líquida</span>
                            <span className="text-right">{getMarginBadge(editSimulation.netMargin)}</span>
                          </div>
                        </div>
                      ) : (
                        <div className="grid grid-cols-[auto,1fr] gap-x-4 gap-y-1.5">
                          <span className="text-sm text-muted-foreground">Lucro Bruto</span>
                          <span className="text-sm font-bold text-accent text-right">{formatUsd(deal.gross_profit)}</span>
                          <span className="text-sm text-muted-foreground">Margem Bruta</span>
                          <span className="text-sm font-bold text-foreground text-right">{formatPct(deal.gross_margin_percent)}</span>
                          <span className="text-sm text-muted-foreground">Lucro Líquido</span>
                          <span className={cn("text-sm font-bold text-right", deal.net_profit < 0 ? "text-destructive" : "text-accent")}>{formatUsd(deal.net_profit)}</span>
                          <span className="text-sm text-muted-foreground">Margem Líquida</span>
                          <span className="text-right">{getMarginBadge(deal.net_margin_percent)}</span>
                        </div>
                      )}
                    </DrawerSection>

                    <Separator />

                    {/* Commission History */}
                    <div>
                      <button
                        onClick={() => setShowLogsInDrawer(!showLogsInDrawer)}
                        className="flex items-center gap-2 text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors"
                      >
                        <History className="h-3.5 w-3.5" />
                        Histórico de Alterações
                        <ChevronDown className={cn("h-3 w-3 transition-transform", showLogsInDrawer && "rotate-180")} />
                      </button>
                      {showLogsInDrawer && (
                        <div className="mt-2 p-3 rounded-md border border-border bg-muted/20 space-y-1">
                          {commissionLogs.length === 0 ? (
                            <p className="text-xs text-muted-foreground">Nenhuma alteração registrada.</p>
                          ) : (
                            commissionLogs.map((log) => (
                              <div key={log.id} className="text-xs flex items-center gap-2">
                                <span className="text-muted-foreground">{new Date(log.changed_at).toLocaleString("pt-BR")}</span>
                                <Badge variant="outline" className="text-[10px] h-5">
                                  {log.field_changed === "seller_commission_pct" ? "Vendedor" : "Gestor"}
                                </Badge>
                                <span className="text-destructive line-through">{formatPct(log.old_value)}</span>
                                <span>→</span>
                                <span className="text-accent font-medium">{formatPct(log.new_value)}</span>
                              </div>
                            ))
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </ScrollArea>
              </div>
            );
          })()}
        </DialogContent>
      </Dialog>

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
            <AlertDialogCancel onClick={() => { setShowSavePricePrompt(false); setPendingSavePriceData(null); }}>Não</AlertDialogCancel>
            <AlertDialogAction onClick={async () => {
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
            }}>Sim, salvar no catálogo</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* PDF Import Dialog */}
      <PdfOrderImport
        open={showPdfImport}
        onClose={() => setShowPdfImport(false)}
        userId={userId}
        empresas={empresas}
        repOptions={repOptions}
        modelos={modelos}
        onImportComplete={handlePdfImportComplete}
      />
    </div>
  );
};

// ── Drawer Helper Components ──
const DrawerSection = ({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) => (
  <div>
    <div className="flex items-center gap-2 mb-4">
      {icon}
      <h4 className="text-sm font-bold text-foreground uppercase tracking-wide">{title}</h4>
    </div>
    <div className="space-y-2 pl-1">{children}</div>
  </div>
);

const DrawerRow = ({ label, value, accent, danger }: { label: string; value: string; accent?: boolean; danger?: boolean }) => (
  <div className="flex justify-between items-start gap-4">
    <span className="text-sm text-muted-foreground shrink-0">{label}</span>
    <span className={cn(
      "text-sm font-medium text-right",
      danger ? "text-destructive font-bold" : accent ? "text-accent font-bold" : "text-foreground"
    )}>{value}</span>
  </div>
);

export default DealManager;
