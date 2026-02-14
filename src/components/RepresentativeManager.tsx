import { useState, useMemo, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Progress } from "@/components/ui/progress";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  UserPlus, Edit2, Trash2, Save, X, Target, TrendingUp, DollarSign,
  Percent, Users, MapPin, CheckCircle, XCircle,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface Representative {
  id: string;
  user_id: string;
  nome: string;
  regiao: string | null;
  meta_mensal_padrao: number;
  meta_quantidade: number;
  comissao_padrao_pct: number;
  status: string;
  observacoes: string | null;
  created_at: string;
}

interface MonthlyGoal {
  id: string;
  representative_id: string;
  mes: number;
  ano: number;
  meta_valor: number;
  meta_quantidade: number;
  machine_type: string;
}

interface DealRow {
  id: string;
  representative_id: string | null;
  final_price: number;
  gross_profit: number;
  net_profit: number;
  gross_margin_percent: number;
  net_margin_percent: number;
  seller_commission_value: number;
  manager_commission_value: number;
  status: string;
  closed_at: string | null;
  machine_type: string;
}

interface Props {
  userId: string;
}

const MONTHS = ["Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];
const MACHINE_TYPES = ["Centro de Usinagem", "Torno CNC", "Plu.go"];

const RepresentativeManager = ({ userId }: Props) => {
  const { toast } = useToast();
  const [reps, setReps] = useState<Representative[]>([]);
  const [goals, setGoals] = useState<MonthlyGoal[]>([]);
  const [deals, setDeals] = useState<DealRow[]>([]);
  const [loading, setLoading] = useState(true);

  // Filter
  const now = new Date();
  const [filterMonth, setFilterMonth] = useState(now.getMonth() + 1);
  const [filterYear, setFilterYear] = useState(now.getFullYear());

  // Form
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [nome, setNome] = useState("");
  const [regiao, setRegiao] = useState("");
  const [metaPadrao, setMetaPadrao] = useState("");
  const [metaQtd, setMetaQtd] = useState("");
  const [comissaoPct, setComissaoPct] = useState("3");
  const [status, setStatus] = useState("ATIVO");
  const [observacoes, setObservacoes] = useState("");

  // Goal editing
  const [editingGoal, setEditingGoal] = useState<string | null>(null);
  const [goalByType, setGoalByType] = useState<Record<string, string>>({});

  const fetchAll = async () => {
    const [repsRes, goalsRes, dealsRes] = await Promise.all([
      supabase.from("representatives" as any).select("*").order("nome"),
      supabase.from("monthly_goals" as any).select("*"),
      supabase.from("deals" as any).select("id, representative_id, final_price, gross_profit, net_profit, gross_margin_percent, net_margin_percent, seller_commission_value, manager_commission_value, status, closed_at, machine_type"),
    ]);
    if (repsRes.data) setReps(repsRes.data as unknown as Representative[]);
    if (goalsRes.data) setGoals(goalsRes.data as unknown as MonthlyGoal[]);
    if (dealsRes.data) setDeals(dealsRes.data as unknown as DealRow[]);
    setLoading(false);
  };

  useEffect(() => { fetchAll(); }, []);

  const resetForm = () => {
    setNome(""); setRegiao(""); setMetaPadrao(""); setMetaQtd(""); setComissaoPct("3");
    setStatus("ATIVO"); setObservacoes(""); setEditingId(null); setShowForm(false);
  };

  const handleSave = async () => {
    if (!nome.trim()) {
      toast({ title: "Nome obrigatório", description: "Informe o nome do representante para continuar.", variant: "destructive" });
      return;
    }
    const payload = {
      user_id: userId,
      nome: nome.trim(),
      regiao: regiao.trim() || null,
      meta_mensal_padrao: parseFloat(metaPadrao) || 0,
      meta_quantidade: parseInt(metaQtd) || 0,
      comissao_padrao_pct: parseFloat(comissaoPct) || 3,
      status,
      observacoes: observacoes.trim() || null,
    };

    if (editingId) {
      const { error } = await supabase.from("representatives" as any).update(payload as any).eq("id", editingId);
      if (error) { toast({ title: "Erro ao atualizar representante", description: error.message, variant: "destructive" }); return; }
      toast({ title: "Representante atualizado!" });
    } else {
      const { error } = await supabase.from("representatives" as any).insert(payload as any);
      if (error) { toast({ title: "Erro ao cadastrar representante", description: error.message, variant: "destructive" }); return; }
      toast({ title: "Representante cadastrado!" });
    }
    resetForm();
    fetchAll();
  };

  const handleEdit = (r: Representative) => {
    setEditingId(r.id);
    setNome(r.nome);
    setRegiao(r.regiao || "");
    setMetaPadrao(String(r.meta_mensal_padrao));
    setMetaQtd(String(r.meta_quantidade || 0));
    setComissaoPct(String(r.comissao_padrao_pct));
    setStatus(r.status);
    setObservacoes(r.observacoes || "");
    setShowForm(true);
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from("representatives" as any).delete().eq("id", id);
    if (error) { toast({ title: "Erro ao excluir representante", description: error.message, variant: "destructive" }); return; }
    fetchAll();
  };

  const handleSaveGoals = async (repId: string) => {
    for (const mt of MACHINE_TYPES) {
      const qtd = parseInt(goalByType[mt] || "0") || 0;
      if (qtd <= 0) continue;
      const existing = goals.find(g => g.representative_id === repId && g.mes === filterMonth && g.ano === filterYear && g.machine_type === mt);
      if (existing) {
        await supabase.from("monthly_goals" as any).update({ meta_quantidade: qtd } as any).eq("id", existing.id);
      } else {
        await supabase.from("monthly_goals" as any).insert({ user_id: userId, representative_id: repId, mes: filterMonth, ano: filterYear, meta_valor: 0, meta_quantidade: qtd, machine_type: mt } as any);
      }
    }
    toast({ title: "Metas salvas!" });
    setEditingGoal(null);
    fetchAll();
  };

  // Compute performance per representative for selected month/year
  const performance = useMemo(() => {
    return reps.map(rep => {
      const repGoals = goals.filter(g => g.representative_id === rep.id && g.mes === filterMonth && g.ano === filterYear);

      // Goals by machine type
      const goalsByType = MACHINE_TYPES.map(mt => {
        const g = repGoals.find(g => g.machine_type === mt);
        const metaQtd = g ? g.meta_quantidade : 0;

        const closedDeals = deals.filter(d => {
          if (d.representative_id !== rep.id || d.status !== "closed" || !d.closed_at) return false;
          const dt = new Date(d.closed_at);
          return (dt.getMonth() + 1) === filterMonth && dt.getFullYear() === filterYear && d.machine_type === mt;
        });
        const vendido = closedDeals.length;
        const pct = metaQtd > 0 ? (vendido / metaQtd) * 100 : 0;
        return { type: mt, metaQtd, vendido, pct };
      });

      // Totals
      const totalMeta = goalsByType.reduce((s, g) => s + g.metaQtd, 0);
      const totalVendido = goalsByType.reduce((s, g) => s + g.vendido, 0);
      const totalPct = totalMeta > 0 ? (totalVendido / totalMeta) * 100 : 0;

      const repDeals = deals.filter(d => {
        if (d.representative_id !== rep.id || d.status !== "closed" || !d.closed_at) return false;
        const dt = new Date(d.closed_at);
        return (dt.getMonth() + 1) === filterMonth && dt.getFullYear() === filterYear;
      });

      const allCount = deals.filter(d => d.representative_id === rep.id && ((d.closed_at && (() => { const dt = new Date(d.closed_at!); return (dt.getMonth() + 1) === filterMonth && dt.getFullYear() === filterYear; })()) || (d.status === "open"))).length;
      const closedCount = repDeals.length;

      const vendido = repDeals.reduce((s, d) => s + d.final_price, 0);
      const lucroBruto = repDeals.reduce((s, d) => s + d.gross_profit, 0);
      const lucroLiquido = repDeals.reduce((s, d) => s + d.net_profit, 0);
      const comissaoTotal = repDeals.reduce((s, d) => s + d.seller_commission_value + d.manager_commission_value, 0);
      const avgGrossMargin = closedCount > 0 ? repDeals.reduce((s, d) => s + d.gross_margin_percent, 0) / closedCount : 0;
      const avgNetMargin = closedCount > 0 ? repDeals.reduce((s, d) => s + d.net_margin_percent, 0) / closedCount : 0;
      const closingRate = allCount > 0 ? (closedCount / allCount) * 100 : 0;

      return { rep, goalsByType, totalMeta, totalVendido, totalPct, vendido, lucroBruto, lucroLiquido, comissaoTotal, avgGrossMargin, avgNetMargin, closingRate, closedCount };
    });
  }, [reps, goals, deals, filterMonth, filterYear]);

  const formatUsd = (v: number) => `US$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const formatPct = (v: number) => v.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + "%";

  const getMetaColor = (pct: number) => {
    if (pct >= 100) return "text-green-600";
    if (pct >= 70) return "text-yellow-600";
    return "text-destructive";
  };
  const getMetaBg = (pct: number) => {
    if (pct >= 100) return "bg-green-500";
    if (pct >= 70) return "bg-yellow-500";
    return "bg-destructive";
  };

  if (loading) return <p className="text-muted-foreground text-center py-8">Carregando...</p>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h2 className="font-heading text-lg font-semibold text-foreground flex items-center gap-2">
          <Users className="h-5 w-5" /> Representantes
        </h2>
        <Button onClick={() => showForm ? resetForm() : setShowForm(true)} variant={showForm ? "secondary" : "default"}>
          <UserPlus className="h-4 w-4 mr-2" /> {showForm ? "Fechar" : "Novo Representante"}
        </Button>
      </div>

      {/* Form */}
      {showForm && (
        <Card className="border-border bg-card p-6 shadow-sm">
          <h3 className="font-heading text-base font-semibold text-card-foreground mb-4">
            {editingId ? "Editar Representante" : "Novo Representante"}
          </h3>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            <div>
              <Label className="mb-1.5 text-sm text-muted-foreground">Nome *</Label>
              <Input value={nome} onChange={e => setNome(e.target.value)} placeholder="Nome do representante" className="bg-secondary/50 border-border" />
            </div>
            <div>
              <Label className="mb-1.5 text-sm text-muted-foreground">Região</Label>
              <Input value={regiao} onChange={e => setRegiao(e.target.value)} placeholder="Ex: Sul, Sudeste" className="bg-secondary/50 border-border" />
            </div>
            <div>
              <Label className="mb-1.5 text-sm text-muted-foreground">Meta Mensal Padrão (US$)</Label>
              <Input type="number" step="0.01" min="0" value={metaPadrao} onChange={e => setMetaPadrao(e.target.value)} placeholder="0,00" className="bg-secondary/50 border-border" />
            </div>
            <div>
              <Label className="mb-1.5 text-sm text-muted-foreground">Meta Quantidade (máquinas/mês)</Label>
              <Input type="number" step="1" min="0" value={metaQtd} onChange={e => setMetaQtd(e.target.value)} placeholder="0" className="bg-secondary/50 border-border" />
            </div>
            <div>
              <Label className="mb-1.5 text-sm text-muted-foreground">Comissão Padrão (%)</Label>
              <Input type="number" step="0.01" min="0" value={comissaoPct} onChange={e => setComissaoPct(e.target.value)} placeholder="3" className="bg-secondary/50 border-border" />
            </div>
            <div>
              <Label className="mb-1.5 text-sm text-muted-foreground">Status</Label>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger className="bg-secondary/50 border-border"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ATIVO">Ativo</SelectItem>
                  <SelectItem value="INATIVO">Inativo</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="md:col-span-2 lg:col-span-3">
              <Label className="mb-1.5 text-sm text-muted-foreground">Observações</Label>
              <Textarea value={observacoes} onChange={e => setObservacoes(e.target.value)} placeholder="Observações..." className="bg-secondary/50 border-border" />
            </div>
          </div>
          <div className="flex gap-3 mt-4">
            <Button onClick={handleSave}><Save className="h-4 w-4 mr-2" /> Salvar</Button>
            <Button variant="outline" onClick={resetForm}>Cancelar</Button>
          </div>
        </Card>
      )}

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-end">
        <div>
          <Label className="text-xs text-muted-foreground">Mês</Label>
          <Select value={String(filterMonth)} onValueChange={v => setFilterMonth(parseInt(v))}>
            <SelectTrigger className="w-[150px] bg-secondary/50 border-border text-sm"><SelectValue /></SelectTrigger>
            <SelectContent>
              {MONTHS.map((m, i) => <SelectItem key={i} value={String(i + 1)}>{m}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-xs text-muted-foreground">Ano</Label>
          <Select value={String(filterYear)} onValueChange={v => setFilterYear(parseInt(v))}>
            <SelectTrigger className="w-[100px] bg-secondary/50 border-border text-sm"><SelectValue /></SelectTrigger>
            <SelectContent>
              {[2024, 2025, 2026, 2027].map(y => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Performance cards */}
      {performance.length === 0 ? (
        <p className="text-muted-foreground text-center py-8">Nenhum representante cadastrado.</p>
      ) : (
        <ScrollArea className="h-[700px]">
          <div className="space-y-3">
            {performance.map(({ rep, goalsByType, totalMeta, totalVendido, totalPct, vendido, lucroBruto, lucroLiquido, comissaoTotal, avgGrossMargin, avgNetMargin, closingRate, closedCount }) => (
              <Card key={rep.id} className={`border-border p-4 shadow-sm ${rep.status === "INATIVO" ? "bg-muted/30 opacity-60" : "bg-card"}`}>
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-2">
                      <Badge variant={rep.status === "ATIVO" ? "default" : "secondary"} className="text-xs">
                        {rep.status === "ATIVO" ? <CheckCircle className="h-3 w-3 mr-1" /> : <XCircle className="h-3 w-3 mr-1" />}
                        {rep.status}
                      </Badge>
                      <span className="font-semibold text-sm">{rep.nome}</span>
                      {rep.regiao && (
                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                          <MapPin className="h-3 w-3" /> {rep.regiao}
                        </span>
                      )}
                    </div>

                    {/* Meta por tipo de máquina */}
                    <div className="mb-3">
                      <div className="flex items-center justify-between text-xs mb-2">
                        <span className="text-muted-foreground flex items-center gap-1">
                          <Target className="h-3 w-3" /> Meta Total: {totalMeta} máquinas
                        </span>
                        <div className="flex items-center gap-2">
                          <span className={`font-bold ${getMetaColor(totalPct)}`}>{formatPct(totalPct)}</span>
                          <span className="text-muted-foreground">({totalVendido}/{totalMeta})</span>
                          <Button variant="ghost" size="icon" className="h-5 w-5" onClick={() => {
                            if (editingGoal === rep.id) { setEditingGoal(null); } else {
                              setEditingGoal(rep.id);
                              const byType: Record<string, string> = {};
                              MACHINE_TYPES.forEach(mt => {
                                const g = goals.find(g => g.representative_id === rep.id && g.mes === filterMonth && g.ano === filterYear && g.machine_type === mt);
                                byType[mt] = String(g ? g.meta_quantidade : 0);
                              });
                              setGoalByType(byType);
                            }
                          }}>
                            <Edit2 className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                      <Progress value={Math.min(totalPct, 100)} className={`h-2 ${getMetaBg(totalPct)}`} />

                      {/* Breakdown by type */}
                      <div className="mt-2 grid grid-cols-3 gap-2 text-xs">
                        {goalsByType.map(({ type, metaQtd, vendido: v, pct }) => (
                          <div key={type} className="rounded border border-border p-1.5 bg-secondary/20">
                            <div className="font-medium truncate">{type}</div>
                            <div className="flex items-center justify-between mt-0.5">
                              <span className="text-muted-foreground">{v}/{metaQtd}</span>
                              {metaQtd > 0 && <span className={`font-bold ${getMetaColor(pct)}`}>{formatPct(pct)}</span>}
                            </div>
                            {metaQtd > 0 && <Progress value={Math.min(pct, 100)} className={`h-1 mt-1 ${getMetaBg(pct)}`} />}
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Edit goals inline */}
                    {editingGoal === rep.id && (
                      <div className="mb-3 p-2 rounded border border-border bg-secondary/30">
                        <Label className="text-xs text-muted-foreground mb-2 block">Metas {MONTHS[filterMonth - 1]}/{filterYear} por tipo:</Label>
                        <div className="grid grid-cols-3 gap-2">
                          {MACHINE_TYPES.map(mt => (
                            <div key={mt}>
                              <Label className="text-xs text-muted-foreground">{mt}</Label>
                              <Input type="number" step="1" min="0" value={goalByType[mt] || "0"} onChange={e => setGoalByType(prev => ({ ...prev, [mt]: e.target.value }))} className="h-7 text-xs bg-background" />
                            </div>
                          ))}
                        </div>
                        <div className="flex gap-2 mt-2">
                          <Button size="sm" className="h-7 text-xs" onClick={() => handleSaveGoals(rep.id)}><Save className="h-3 w-3 mr-1" /> Salvar</Button>
                          <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setEditingGoal(null)}><X className="h-3 w-3" /></Button>
                        </div>
                      </div>
                    )}

                    {/* KPIs grid */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-x-4 gap-y-1 text-xs">
                      <div><span className="text-muted-foreground">Faturamento:</span> <span className="font-medium">{formatUsd(vendido)}</span></div>
                      <div><span className="text-muted-foreground">Lucro Bruto:</span> <span className="font-medium text-accent">{formatUsd(lucroBruto)}</span></div>
                      <div className="bg-accent/10 rounded px-1"><span className="text-muted-foreground">Lucro Líquido:</span> <span className={`font-bold ${lucroLiquido < 0 ? "text-destructive" : "text-accent"}`}>{formatUsd(lucroLiquido)}</span></div>
                      <div><span className="text-muted-foreground">Comissão Total:</span> <span className="font-medium">{formatUsd(comissaoTotal)}</span></div>
                      <div><span className="text-muted-foreground">Taxa Fechamento:</span> <span className="font-medium">{formatPct(closingRate)}</span></div>
                      <div><span className="text-muted-foreground">M. Bruta Média:</span> <span className="font-medium">{formatPct(avgGrossMargin)}</span></div>
                      <div className="bg-accent/10 rounded px-1"><span className="text-muted-foreground">M. Líquida Média:</span> <span className={`font-bold ${avgNetMargin < 0 ? "text-destructive" : "text-accent"}`}>{formatPct(avgNetMargin)}</span></div>
                      <div><span className="text-muted-foreground">Vendas:</span> <span className="font-medium">{closedCount}</span></div>
                    </div>
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleEdit(rep)}>
                      <Edit2 className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleDelete(rep.id)}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </ScrollArea>
      )}
    </div>
  );
};

export default RepresentativeManager;
