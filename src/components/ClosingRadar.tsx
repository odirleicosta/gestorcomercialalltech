import { useState, useEffect, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Plus, Crosshair, Search, Filter, Edit2, Trash2, Trophy, XCircle,
  Calendar, MapPin, User, Package, DollarSign, TrendingUp, AlertTriangle,
  ArrowRight, Repeat2, Clock, ImagePlus, Loader2,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface ClosingDeal {
  id: string;
  user_id: string;
  client_name: string;
  city: string | null;
  representative_id: string | null;
  empresa_id: string | null;
  machine_name: string;
  machine_type: string;
  quantity: number;
  deal_value: number;
  sale_type: "Rentall" | "Venda Direta";
  stage: "Proposta Enviada" | "Negociação Ativa" | "Decisão Próxima";
  probability: "Baixa" | "Média" | "Alta";
  start_date: string;
  expected_close_date: string | null;
  competitor: string | null;
  trade_in: boolean;
  main_objection: string | null;
  risk_reason: string | null;
  next_step: string | null;
  notes: string | null;
  status: "ativa" | "ganha" | "perdida";
  created_at: string;
  updated_at: string;
}

type FormData = Omit<ClosingDeal, "id" | "user_id" | "created_at" | "updated_at">;

const emptyForm: FormData = {
  client_name: "",
  city: null,
  representative_id: null,
  empresa_id: null,
  machine_name: "",
  machine_type: "",
  quantity: 1,
  deal_value: 0,
  sale_type: "Venda Direta",
  stage: "Proposta Enviada",
  probability: "Média",
  start_date: new Date().toISOString().split("T")[0],
  expected_close_date: null,
  competitor: null,
  trade_in: false,
  main_objection: null,
  risk_reason: null,
  next_step: null,
  notes: null,
  status: "ativa",
};

const probColor: Record<string, string> = {
  Alta: "border-l-green-500",
  Média: "border-l-yellow-500",
  Baixa: "border-l-red-500",
};

const probBadge: Record<string, string> = {
  Alta: "bg-green-500/15 text-green-400 border-green-500/30",
  Média: "bg-yellow-500/15 text-yellow-400 border-yellow-500/30",
  Baixa: "bg-red-500/15 text-red-400 border-red-500/30",
};

const stageBadge: Record<string, string> = {
  "Proposta Enviada": "bg-blue-500/15 text-blue-400 border-blue-500/30",
  "Negociação Ativa": "bg-purple-500/15 text-purple-400 border-purple-500/30",
  "Decisão Próxima": "bg-orange-500/15 text-orange-400 border-orange-500/30",
};

const statusBadge: Record<string, string> = {
  ativa: "bg-primary/15 text-primary border-primary/30",
  ganha: "bg-green-500/15 text-green-400 border-green-500/30",
  perdida: "bg-red-500/15 text-red-400 border-red-500/30",
};

function daysOpen(start: string) {
  return Math.floor((Date.now() - new Date(start).getTime()) / 86400000);
}

function formatCurrency(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "USD" }).replace("US$", "US$ ");
}

interface Props {
  userId: string;
}

const ClosingRadar = ({ userId }: Props) => {
  const { toast } = useToast();
  const [deals, setDeals] = useState<ClosingDeal[]>([]);
  const [loading, setLoading] = useState(true);
  const [reps, setReps] = useState<{ id: string; nome: string }[]>([]);
  const [clients, setClients] = useState<{ id: string; nome: string; cidade: string | null }[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormData>({ ...emptyForm });
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [imageLoading, setImageLoading] = useState(false);

  // Filters
  const [fRep, setFRep] = useState("all");
  const [fStage, setFStage] = useState("all");
  const [fProb, setFProb] = useState("all");
  const [fSaleType, setFSaleType] = useState("all");
  const [fStatus, setFStatus] = useState("ativa");
  const [fTradeIn, setFTradeIn] = useState("all");
  const [showFilters, setShowFilters] = useState(false);

  useEffect(() => {
    fetchAll();
  }, [userId]);

  async function fetchAll() {
    setLoading(true);
    const [dRes, rRes, cRes] = await Promise.all([
      supabase.from("closing_deals").select("*").order("created_at", { ascending: false }),
      supabase.from("representatives").select("id, nome").eq("status", "ATIVO"),
      supabase.from("empresas").select("id, nome, cidade"),
    ]);
    if (dRes.data) setDeals(dRes.data as unknown as ClosingDeal[]);
    if (rRes.data) setReps(rRes.data);
    if (cRes.data) setClients(cRes.data);
    setLoading(false);
  }

  const filtered = useMemo(() => {
    return deals.filter((d) => {
      if (fStatus !== "all" && d.status !== fStatus) return false;
      if (fRep !== "all" && d.representative_id !== fRep) return false;
      if (fStage !== "all" && d.stage !== fStage) return false;
      if (fProb !== "all" && d.probability !== fProb) return false;
      if (fSaleType !== "all" && d.sale_type !== fSaleType) return false;
      if (fTradeIn !== "all") {
        if (fTradeIn === "sim" && !d.trade_in) return false;
        if (fTradeIn === "nao" && d.trade_in) return false;
      }
      if (search) {
        const s = search.toLowerCase();
        return (
          d.client_name.toLowerCase().includes(s) ||
          d.machine_name.toLowerCase().includes(s) ||
          (d.competitor || "").toLowerCase().includes(s) ||
          (d.city || "").toLowerCase().includes(s)
        );
      }
      return true;
    });
  }, [deals, fRep, fStage, fProb, fSaleType, fStatus, fTradeIn, search]);

  function openNew() {
    setEditingId(null);
    setForm({ ...emptyForm, start_date: new Date().toISOString().split("T")[0] });
    setDialogOpen(true);
  }

  function openEdit(deal: ClosingDeal) {
    setEditingId(deal.id);
    setForm({
      client_name: deal.client_name,
      city: deal.city,
      representative_id: deal.representative_id,
      empresa_id: deal.empresa_id,
      machine_name: deal.machine_name,
      machine_type: deal.machine_type,
      quantity: deal.quantity,
      deal_value: deal.deal_value,
      sale_type: deal.sale_type,
      stage: deal.stage,
      probability: deal.probability,
      start_date: deal.start_date,
      expected_close_date: deal.expected_close_date,
      competitor: deal.competitor,
      trade_in: deal.trade_in,
      main_objection: deal.main_objection,
      risk_reason: deal.risk_reason,
      next_step: deal.next_step,
      notes: deal.notes,
      status: deal.status,
    });
    setDialogOpen(true);
  }

  async function handleSave() {
    if (!form.client_name.trim()) {
      toast({ title: "Informe o nome do cliente", variant: "destructive" });
      return;
    }
    const payload = { ...form, user_id: userId } as any;

    if (editingId) {
      const { error } = await supabase.from("closing_deals").update(payload).eq("id", editingId);
      if (error) { toast({ title: "Erro ao salvar", description: error.message, variant: "destructive" }); return; }
      toast({ title: "Negociação atualizada!" });
    } else {
      const { error } = await supabase.from("closing_deals").insert(payload);
      if (error) { toast({ title: "Erro ao cadastrar", description: error.message, variant: "destructive" }); return; }
      toast({ title: "Negociação cadastrada!" });
    }
    setDialogOpen(false);
    fetchAll();
  }

  async function markAs(id: string, status: "ganha" | "perdida") {
    await supabase.from("closing_deals").update({ status } as any).eq("id", id);
    toast({ title: status === "ganha" ? "Negociação marcada como ganha!" : "Negociação marcada como perdida!" });
    fetchAll();
  }

  async function handleDelete() {
    if (!deleteId) return;
    await supabase.from("closing_deals").delete().eq("id", deleteId);
    toast({ title: "Negociação excluída" });
    setDeleteId(null);
    fetchAll();
  }

  function selectClient(id: string) {
    const c = clients.find((x) => x.id === id);
    if (c) {
      setForm((f) => ({ ...f, client_name: c.nome, city: c.cidade, empresa_id: c.id }));
    }
  }

  async function handleImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast({ title: "Selecione um arquivo de imagem", variant: "destructive" });
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      toast({ title: "Imagem muito grande (máx 10MB)", variant: "destructive" });
      return;
    }

    setImageLoading(true);
    try {
      const reader = new FileReader();
      const base64 = await new Promise<string>((resolve, reject) => {
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });

      const { data, error } = await supabase.functions.invoke("parse-closing-image", {
        body: { imageBase64: base64 },
      });

      if (error) throw new Error(error.message || "Erro ao processar imagem");
      if (data?.error) throw new Error(data.error);

      const extracted = data?.data;
      if (!extracted) throw new Error("Nenhum dado extraído da imagem");

      // Match representative by name
      let repId: string | null = null;
      if (extracted.representative_name) {
        const repNameLower = extracted.representative_name.toLowerCase();
        const matchedRep = reps.find((r) => r.nome.toLowerCase().includes(repNameLower) || repNameLower.includes(r.nome.toLowerCase()));
        if (matchedRep) repId = matchedRep.id;
      }

      // Match client by name
      let empresaId: string | null = null;
      if (extracted.client_name) {
        const clientLower = extracted.client_name.toLowerCase();
        const matchedClient = clients.find((c) => c.nome.toLowerCase().includes(clientLower) || clientLower.includes(c.nome.toLowerCase()));
        if (matchedClient) {
          empresaId = matchedClient.id;
          if (!extracted.city && matchedClient.cidade) extracted.city = matchedClient.cidade;
        }
      }

      setEditingId(null);
      setForm({
        ...emptyForm,
        start_date: new Date().toISOString().split("T")[0],
        client_name: extracted.client_name || "",
        city: extracted.city || null,
        machine_name: extracted.machine_name || "",
        machine_type: extracted.machine_type || "",
        quantity: extracted.quantity || 1,
        deal_value: extracted.deal_value || 0,
        sale_type: extracted.sale_type === "Rentall" ? "Rentall" : "Venda Direta",
        stage: ["Proposta Enviada", "Negociação Ativa", "Decisão Próxima"].includes(extracted.stage) ? extracted.stage : "Proposta Enviada",
        probability: ["Alta", "Média", "Baixa"].includes(extracted.probability) ? extracted.probability : "Média",
        competitor: extracted.competitor || null,
        trade_in: extracted.trade_in || false,
        main_objection: extracted.main_objection || null,
        next_step: extracted.next_step || null,
        notes: extracted.notes || null,
        representative_id: repId,
        empresa_id: empresaId,
        expected_close_date: null,
        status: "ativa",
      });
      setDialogOpen(true);
      toast({ title: "Dados extraídos com sucesso!", description: "Revise e confirme os dados antes de salvar." });
    } catch (err: any) {
      toast({ title: "Erro ao processar imagem", description: err.message, variant: "destructive" });
    } finally {
      setImageLoading(false);
      e.target.value = "";
    }
  }

  const repName = (id: string | null) => reps.find((r) => r.id === id)?.nome || "—";

  // Stats
  const activeDeals = deals.filter((d) => d.status === "ativa");
  const totalValue = activeDeals.reduce((s, d) => s + d.deal_value, 0);
  const totalMachines = activeDeals.reduce((s, d) => s + d.quantity, 0);

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="icon-bubble icon-bubble--primary">
            <Crosshair className="h-5 w-5" />
          </div>
          <div>
            <h2 className="font-heading text-xl font-bold text-foreground">Radar de Fechamento</h2>
            <p className="text-sm text-muted-foreground">
              {activeDeals.length} negociações ativas · {formatCurrency(totalValue)} em pipeline · {totalMachines} máquinas
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setShowFilters(!showFilters)}>
            <Filter className="h-4 w-4 mr-1" /> Filtros
          </Button>
          <Button size="sm" onClick={openNew}>
            <Plus className="h-4 w-4 mr-1" /> Nova Negociação
          </Button>
        </div>
      </div>

      {/* Search + Filters */}
      <div className="space-y-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por cliente, máquina, cidade ou concorrente..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10 bg-secondary/50 border-border"
          />
        </div>

        {showFilters && (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 p-3 bg-card rounded-xl border border-border">
            <Select value={fStatus} onValueChange={setFStatus}>
              <SelectTrigger className="h-9 text-xs"><SelectValue placeholder="Status" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos Status</SelectItem>
                <SelectItem value="ativa">Ativa</SelectItem>
                <SelectItem value="ganha">Ganha</SelectItem>
                <SelectItem value="perdida">Perdida</SelectItem>
              </SelectContent>
            </Select>
            <Select value={fRep} onValueChange={setFRep}>
              <SelectTrigger className="h-9 text-xs"><SelectValue placeholder="Vendedor" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos Vendedores</SelectItem>
                {reps.map((r) => <SelectItem key={r.id} value={r.id}>{r.nome}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={fStage} onValueChange={setFStage}>
              <SelectTrigger className="h-9 text-xs"><SelectValue placeholder="Estágio" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos Estágios</SelectItem>
                <SelectItem value="Proposta Enviada">Proposta Enviada</SelectItem>
                <SelectItem value="Negociação Ativa">Negociação Ativa</SelectItem>
                <SelectItem value="Decisão Próxima">Decisão Próxima</SelectItem>
              </SelectContent>
            </Select>
            <Select value={fProb} onValueChange={setFProb}>
              <SelectTrigger className="h-9 text-xs"><SelectValue placeholder="Probabilidade" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas Prob.</SelectItem>
                <SelectItem value="Alta">Alta</SelectItem>
                <SelectItem value="Média">Média</SelectItem>
                <SelectItem value="Baixa">Baixa</SelectItem>
              </SelectContent>
            </Select>
            <Select value={fSaleType} onValueChange={setFSaleType}>
              <SelectTrigger className="h-9 text-xs"><SelectValue placeholder="Tipo Venda" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos Tipos</SelectItem>
                <SelectItem value="Rentall">Rentall</SelectItem>
                <SelectItem value="Venda Direta">Venda Direta</SelectItem>
              </SelectContent>
            </Select>
            <Select value={fTradeIn} onValueChange={setFTradeIn}>
              <SelectTrigger className="h-9 text-xs"><SelectValue placeholder="Usado" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Com/Sem Usado</SelectItem>
                <SelectItem value="sim">Com Usado</SelectItem>
                <SelectItem value="nao">Sem Usado</SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}
      </div>

      {/* Deal Cards */}
      {loading ? (
        <div className="text-center py-12 text-muted-foreground">Carregando...</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          Nenhuma negociação encontrada.
        </div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {filtered.map((deal) => {
            const days = daysOpen(deal.start_date);
            return (
              <Card key={deal.id} className={`border-l-4 ${probColor[deal.probability]} hover:shadow-lg transition-shadow`}>
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <h3 className="font-heading text-sm font-bold text-foreground truncate">{deal.client_name}</h3>
                      {deal.city && (
                        <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                          <MapPin className="h-3 w-3" /> {deal.city}
                        </p>
                      )}
                    </div>
                    <div className="flex gap-1 shrink-0">
                      <Badge variant="outline" className={`text-[10px] ${statusBadge[deal.status]}`}>
                        {deal.status}
                      </Badge>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-xs">
                    <div className="flex items-center gap-1 text-muted-foreground">
                      <User className="h-3 w-3" /> {repName(deal.representative_id)}
                    </div>
                    <div className="flex items-center gap-1 text-muted-foreground">
                      <Package className="h-3 w-3" /> {deal.machine_name || deal.machine_type}
                    </div>
                    <div className="flex items-center gap-1 text-muted-foreground">
                      <DollarSign className="h-3 w-3" /> {formatCurrency(deal.deal_value)}
                    </div>
                    <div className="flex items-center gap-1 text-muted-foreground">
                      Qtd: {deal.quantity}
                    </div>
                    <div className="flex items-center gap-1 text-muted-foreground">
                      <Clock className="h-3 w-3" /> {days}d aberto
                    </div>
                    {deal.expected_close_date && (
                      <div className="flex items-center gap-1 text-muted-foreground">
                        <Calendar className="h-3 w-3" /> {new Date(deal.expected_close_date).toLocaleDateString("pt-BR")}
                      </div>
                    )}
                  </div>

                  <div className="flex flex-wrap gap-1.5">
                    <Badge variant="outline" className={`text-[10px] ${probBadge[deal.probability]}`}>
                      {deal.probability}
                    </Badge>
                    <Badge variant="outline" className={`text-[10px] ${stageBadge[deal.stage]}`}>
                      {deal.stage}
                    </Badge>
                    <Badge variant="outline" className="text-[10px]">{deal.sale_type}</Badge>
                    {deal.trade_in && (
                      <Badge variant="outline" className="text-[10px] bg-orange-500/15 text-orange-400 border-orange-500/30">
                        <Repeat2 className="h-3 w-3 mr-0.5" /> Usado
                      </Badge>
                    )}
                    {deal.competitor && (
                      <Badge variant="outline" className="text-[10px]">
                        vs {deal.competitor}
                      </Badge>
                    )}
                  </div>

                  {deal.next_step && (
                    <p className="text-xs text-muted-foreground flex items-center gap-1">
                      <ArrowRight className="h-3 w-3 text-primary" /> {deal.next_step}
                    </p>
                  )}

                  {/* Actions */}
                  {deal.status === "ativa" && (
                    <div className="flex gap-1.5 pt-1 border-t border-border">
                      <Button size="sm" variant="ghost" className="h-7 text-xs flex-1" onClick={() => openEdit(deal)}>
                        <Edit2 className="h-3 w-3 mr-1" /> Editar
                      </Button>
                      <Button size="sm" variant="ghost" className="h-7 text-xs text-green-400 hover:text-green-300" onClick={() => markAs(deal.id, "ganha")}>
                        <Trophy className="h-3 w-3 mr-1" /> Ganha
                      </Button>
                      <Button size="sm" variant="ghost" className="h-7 text-xs text-red-400 hover:text-red-300" onClick={() => markAs(deal.id, "perdida")}>
                        <XCircle className="h-3 w-3 mr-1" /> Perdida
                      </Button>
                      <Button size="sm" variant="ghost" className="h-7 text-xs text-destructive" onClick={() => setDeleteId(deal.id)}>
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Form Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-heading">
              {editingId ? "Editar Negociação" : "Nova Negociação"}
            </DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Cliente */}
            <div className="sm:col-span-2">
              <Label className="text-xs text-muted-foreground mb-1">Cliente (selecionar existente)</Label>
              <Select value={form.empresa_id || ""} onValueChange={selectClient}>
                <SelectTrigger><SelectValue placeholder="Selecionar empresa cadastrada..." /></SelectTrigger>
                <SelectContent>
                  {clients.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.nome}{c.cidade ? ` — ${c.cidade}` : ""}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground mb-1">Nome do Cliente *</Label>
              <Input value={form.client_name} onChange={(e) => setForm((f) => ({ ...f, client_name: e.target.value }))} />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground mb-1">Cidade</Label>
              <Input value={form.city || ""} onChange={(e) => setForm((f) => ({ ...f, city: e.target.value || null }))} />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground mb-1">Vendedor</Label>
              <Select value={form.representative_id || ""} onValueChange={(v) => setForm((f) => ({ ...f, representative_id: v || null }))}>
                <SelectTrigger><SelectValue placeholder="Selecionar..." /></SelectTrigger>
                <SelectContent>
                  {reps.map((r) => <SelectItem key={r.id} value={r.id}>{r.nome}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground mb-1">Máquina / Modelo</Label>
              <Input value={form.machine_name} onChange={(e) => setForm((f) => ({ ...f, machine_name: e.target.value }))} />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground mb-1">Tipo da Máquina</Label>
              <Input value={form.machine_type} onChange={(e) => setForm((f) => ({ ...f, machine_type: e.target.value }))} placeholder="Ex: Escavadeira" />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground mb-1">Quantidade</Label>
              <Input type="number" min={1} value={form.quantity} onChange={(e) => setForm((f) => ({ ...f, quantity: parseInt(e.target.value) || 1 }))} />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground mb-1">Valor da Negociação (USD)</Label>
              <Input type="number" step="0.01" min={0} value={form.deal_value} onChange={(e) => setForm((f) => ({ ...f, deal_value: parseFloat(e.target.value) || 0 }))} />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground mb-1">Tipo de Venda</Label>
              <Select value={form.sale_type} onValueChange={(v: any) => setForm((f) => ({ ...f, sale_type: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Venda Direta">Venda Direta</SelectItem>
                  <SelectItem value="Rentall">Rentall</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground mb-1">Estágio</Label>
              <Select value={form.stage} onValueChange={(v: any) => setForm((f) => ({ ...f, stage: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Proposta Enviada">Proposta Enviada</SelectItem>
                  <SelectItem value="Negociação Ativa">Negociação Ativa</SelectItem>
                  <SelectItem value="Decisão Próxima">Decisão Próxima</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground mb-1">Probabilidade</Label>
              <Select value={form.probability} onValueChange={(v: any) => setForm((f) => ({ ...f, probability: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Alta">Alta</SelectItem>
                  <SelectItem value="Média">Média</SelectItem>
                  <SelectItem value="Baixa">Baixa</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground mb-1">Data de Início</Label>
              <Input type="date" value={form.start_date} onChange={(e) => setForm((f) => ({ ...f, start_date: e.target.value }))} />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground mb-1">Data Prevista de Fechamento</Label>
              <Input type="date" value={form.expected_close_date || ""} onChange={(e) => setForm((f) => ({ ...f, expected_close_date: e.target.value || null }))} />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground mb-1">Concorrente</Label>
              <Input value={form.competitor || ""} onChange={(e) => setForm((f) => ({ ...f, competitor: e.target.value || null }))} />
            </div>
            <div className="flex items-center gap-3 pt-5">
              <input type="checkbox" id="tradeIn" checked={form.trade_in} onChange={(e) => setForm((f) => ({ ...f, trade_in: e.target.checked }))} className="h-4 w-4 rounded border-border" />
              <Label htmlFor="tradeIn" className="text-xs text-muted-foreground">Tem máquina usada?</Label>
            </div>
            <div className="sm:col-span-2">
              <Label className="text-xs text-muted-foreground mb-1">Objeção Principal</Label>
              <Input value={form.main_objection || ""} onChange={(e) => setForm((f) => ({ ...f, main_objection: e.target.value || null }))} />
            </div>
            <div className="sm:col-span-2">
              <Label className="text-xs text-muted-foreground mb-1">Motivo de Risco</Label>
              <Input value={form.risk_reason || ""} onChange={(e) => setForm((f) => ({ ...f, risk_reason: e.target.value || null }))} />
            </div>
            <div className="sm:col-span-2">
              <Label className="text-xs text-muted-foreground mb-1">Próximo Passo</Label>
              <Input value={form.next_step || ""} onChange={(e) => setForm((f) => ({ ...f, next_step: e.target.value || null }))} />
            </div>
            <div className="sm:col-span-2">
              <Label className="text-xs text-muted-foreground mb-1">Observações</Label>
              <Textarea value={form.notes || ""} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value || null }))} rows={2} />
            </div>
            {editingId && (
              <div>
                <Label className="text-xs text-muted-foreground mb-1">Status</Label>
                <Select value={form.status} onValueChange={(v: any) => setForm((f) => ({ ...f, status: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ativa">Ativa</SelectItem>
                    <SelectItem value="ganha">Ganha</SelectItem>
                    <SelectItem value="perdida">Perdida</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleSave}>{editingId ? "Salvar" : "Cadastrar"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <AlertDialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir negociação?</AlertDialogTitle>
            <AlertDialogDescription>Esta ação não pode ser desfeita.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>Excluir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default ClosingRadar;
