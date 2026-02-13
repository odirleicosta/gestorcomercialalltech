import { useState, useMemo, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Plus, Trash2, Search, Package, Hash, Pencil, X, Check, Download, Upload, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import * as XLSX from "xlsx";

export interface CatalogMachine {
  id: string;
  tipo: string;
  marca: string;
  modelo: string;
  custo_fob: number;
  preco_venda_fob: number;
  informado_por?: string | null;
  created_at: string;
  updated_at: string;
  user_id?: string;
}

// Supabase-based fetch
export const fetchCatalog = async (): Promise<CatalogMachine[]> => {
  const { data, error } = await supabase
    .from("machine_catalog")
    .select("*")
    .order("marca", { ascending: true });
  if (error) throw error;
  return (data || []).map((m: any) => ({
    id: m.id,
    tipo: m.tipo,
    marca: m.marca,
    modelo: m.modelo,
    custo_fob: m.custo_fob,
    preco_venda_fob: m.preco_venda_fob,
    informado_por: m.informado_por,
    created_at: m.created_at,
    updated_at: m.updated_at,
    user_id: m.user_id,
  }));
};

// Keep legacy localStorage helpers for migration only
const CATALOG_KEY = "price-calc-machine-catalog";
export const loadCatalog = (): CatalogMachine[] => {
  try { return JSON.parse(localStorage.getItem(CATALOG_KEY) || "[]"); } catch { return []; }
};
export const saveCatalog = (catalog: CatalogMachine[]) => {
  localStorage.setItem(CATALOG_KEY, JSON.stringify(catalog));
};

interface Props {
  catalog: CatalogMachine[];
  setCatalog: React.Dispatch<React.SetStateAction<CatalogMachine[]>>;
  userId: string;
}

const TIPOS = ["Centro de Usinagem", "Torno CNC", "4º eixo"];
const MARCAS = ["HARTFORD", "SINO", "DMTG", "Feiya", "Timeway", "TAKISAWA", "ZMAT", "GSA"];

interface EditState {
  tipo: string;
  marca: string;
  modelo: string;
  custo_fob: string;
  preco_venda_fob: string;
  informado_por: string;
}

const MachineCatalog = ({ catalog, setCatalog, userId }: Props) => {
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);

  const [newTipo, setNewTipo] = useState("");
  const [newMarca, setNewMarca] = useState("");
  const [newModelo, setNewModelo] = useState("");
  const [newFob, setNewFob] = useState("");
  const [newPrecoVenda, setNewPrecoVenda] = useState("");
  const [newInformadoPor, setNewInformadoPor] = useState("");

  const [search, setSearch] = useState("");
  const [filterTipo, setFilterTipo] = useState("all");
  const [filterMarca, setFilterMarca] = useState("all");

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editState, setEditState] = useState<EditState>({ tipo: "", marca: "", modelo: "", custo_fob: "", preco_venda_fob: "", informado_por: "" });

  // Import preview state
  const [pendingImport, setPendingImport] = useState<CatalogMachine[] | null>(null);
  const [importStats, setImportStats] = useState({ total: 0, new: 0, updated: 0, skipped: 0 });

  const tipos = useMemo(() => {
    const set = new Set(catalog.map((m) => m.tipo));
    TIPOS.forEach((t) => set.add(t));
    return Array.from(set).sort();
  }, [catalog]);

  const marcas = useMemo(() => {
    const set = new Set(catalog.map((m) => m.marca));
    MARCAS.forEach((m) => set.add(m));
    return Array.from(set).sort();
  }, [catalog]);

  const filtered = useMemo(() => {
    return catalog.filter((m) => {
      const matchSearch =
        !search ||
        m.tipo.toLowerCase().includes(search.toLowerCase()) ||
        m.marca.toLowerCase().includes(search.toLowerCase()) ||
        m.modelo.toLowerCase().includes(search.toLowerCase());
      const matchTipo = filterTipo === "all" || m.tipo === filterTipo;
      const matchMarca = filterMarca === "all" || m.marca === filterMarca;
      return matchSearch && matchTipo && matchMarca;
    });
  }, [catalog, search, filterTipo, filterMarca]);

  const calcMargin = (custo: number, venda: number) => {
    if (venda <= 0) return null;
    return ((venda - custo) / venda) * 100;
  };

  const marginColor = (pct: number | null) => {
    if (pct === null) return "text-muted-foreground";
    if (pct >= 30) return "text-[#22C55E]";
    if (pct >= 20) return "text-[#EAB308]";
    return "text-[#EF4444]";
  };

  const formatMargin = (pct: number | null) => {
    if (pct === null) return "—";
    return pct.toFixed(1) + "%";
  };

  const formatUsd = (v: number) =>
    `$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  const handleAdd = async () => {
    const tipo = newTipo.trim();
    const marca = newMarca.trim();
    const modelo = newModelo.trim();
    const fob = parseFloat(newFob) || 0;
    const precoVenda = parseFloat(newPrecoVenda) || 0;
    if (!tipo || !marca || !modelo) {
      toast({ title: "Preencha Tipo, Marca e Modelo", variant: "destructive" });
      return;
    }
    if (fob < 0 || precoVenda < 0) {
      toast({ title: "Preços não podem ser negativos", variant: "destructive" });
      return;
    }
    if (precoVenda <= 0) {
      toast({ title: "Preço de Venda FOB é obrigatório", variant: "destructive" });
      return;
    }
    if (precoVenda < fob) {
      toast({ title: "Preço de venda não pode ser menor que o custo", variant: "destructive" });
      return;
    }
    if (catalog.some((m) => m.modelo.toLowerCase() === modelo.toLowerCase() && m.marca.toLowerCase() === marca.toLowerCase())) {
      toast({ title: "Modelo já cadastrado para esta marca", variant: "destructive" });
      return;
    }

    setSaving(true);
    const { data, error } = await supabase
      .from("machine_catalog")
      .insert({
        user_id: userId,
        tipo,
        marca,
        modelo,
        custo_fob: fob,
        preco_venda_fob: precoVenda,
        informado_por: newInformadoPor.trim() || null,
      } as any)
      .select("*")
      .single();
    setSaving(false);

    if (error) {
      toast({ title: "Erro ao cadastrar", description: error.message, variant: "destructive" });
      return;
    }

    const entry: CatalogMachine = {
      id: (data as any).id,
      tipo: (data as any).tipo,
      marca: (data as any).marca,
      modelo: (data as any).modelo,
      custo_fob: (data as any).custo_fob,
      preco_venda_fob: (data as any).preco_venda_fob,
      informado_por: (data as any).informado_por,
      created_at: (data as any).created_at,
      updated_at: (data as any).updated_at,
    };
    setCatalog(prev => [entry, ...prev]);
    setNewTipo(""); setNewMarca(""); setNewModelo(""); setNewFob(""); setNewPrecoVenda(""); setNewInformadoPor("");
    toast({ title: "Máquina cadastrada no catálogo!" });
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from("machine_catalog").delete().eq("id", id);
    if (error) {
      toast({ title: "Erro ao excluir", description: error.message, variant: "destructive" });
      return;
    }
    setCatalog(prev => prev.filter((m) => m.id !== id));
  };

  const startEditing = (m: CatalogMachine) => {
    setEditingId(m.id);
    setEditState({
      tipo: m.tipo,
      marca: m.marca,
      modelo: m.modelo,
      custo_fob: String(m.custo_fob),
      preco_venda_fob: String(m.preco_venda_fob || 0),
      informado_por: m.informado_por || "",
    });
  };

  const handleEditSave = async (id: string) => {
    const tipo = editState.tipo.trim();
    const marca = editState.marca.trim();
    const modelo = editState.modelo.trim();
    const fob = parseFloat(editState.custo_fob) || 0;
    const precoVenda = parseFloat(editState.preco_venda_fob) || 0;

    if (!tipo || !marca || !modelo) {
      toast({ title: "Tipo, Marca e Modelo são obrigatórios", variant: "destructive" });
      return;
    }
    if (fob < 0 || precoVenda < 0) {
      toast({ title: "Preços não podem ser negativos", variant: "destructive" });
      return;
    }
    if (precoVenda <= 0) {
      toast({ title: "Preço de Venda FOB é obrigatório", variant: "destructive" });
      return;
    }
    if (precoVenda < fob) {
      toast({ title: "Preço de venda não pode ser menor que o custo", variant: "destructive" });
      return;
    }
    if (catalog.some((m) => m.id !== id && m.modelo.toLowerCase() === modelo.toLowerCase() && m.marca.toLowerCase() === marca.toLowerCase())) {
      toast({ title: "Modelo já cadastrado para esta marca", variant: "destructive" });
      return;
    }

    const { error } = await supabase
      .from("machine_catalog")
      .update({
        tipo,
        marca,
        modelo,
        custo_fob: fob,
        preco_venda_fob: precoVenda,
        informado_por: editState.informado_por.trim() || null,
      } as any)
      .eq("id", id);

    if (error) {
      toast({ title: "Erro ao atualizar", description: error.message, variant: "destructive" });
      return;
    }

    setCatalog(prev => prev.map((m) =>
      m.id === id
        ? { ...m, tipo, marca, modelo, custo_fob: fob, preco_venda_fob: precoVenda, informado_por: editState.informado_por.trim() || undefined, updated_at: new Date().toISOString() }
        : m
    ));
    setEditingId(null);
    toast({ title: "Máquina atualizada!" });
  };

  const editInputClass = "h-7 text-sm bg-secondary/50 border-border";

  const handleExportExcel = () => {
    const rows = catalog.map((m) => ({
      Tipo: m.tipo,
      Marca: m.marca,
      Modelo: m.modelo,
      "Custo FOB (USD)": m.custo_fob,
      "Preço Venda FOB (USD)": m.preco_venda_fob || 0,
      "Informado por": m.informado_por || "",
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    ws["!cols"] = [
      { wch: 22 }, { wch: 14 }, { wch: 30 }, { wch: 16 }, { wch: 22 }, { wch: 16 },
    ];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Catálogo");
    XLSX.writeFile(wb, "catalogo_maquinas.xlsx");
    toast({ title: "Excel exportado!" });
  };

  const handleImportExcel = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const data = new Uint8Array(evt.target?.result as ArrayBuffer);
        const wb = XLSX.read(data, { type: "array" });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json<Record<string, any>>(ws);

        let newCount = 0;
        let updatedCount = 0;
        let skipped = 0;

        for (const row of rows) {
          const tipo = String(row["Tipo"] || "").trim();
          const marca = String(row["Marca"] || "").trim();
          const modelo = String(row["Modelo"] || "").trim();
          const custoFob = parseFloat(row["Custo FOB (USD)"]) || 0;
          const precoVenda = parseFloat(row["Preço Venda FOB (USD)"]) || 0;
          const informadoPor = String(row["Informado por"] || "").trim();

          if (!tipo || !marca || !modelo) { skipped++; continue; }
          if (precoVenda < 0 || custoFob < 0) { skipped++; continue; }

          const existing = catalog.find(
            (m) => m.modelo.toLowerCase() === modelo.toLowerCase() && m.marca.toLowerCase() === marca.toLowerCase()
          );

          if (existing) {
            await supabase.from("machine_catalog").update({
              tipo, custo_fob: custoFob, preco_venda_fob: precoVenda, informado_por: informadoPor || null,
            } as any).eq("id", existing.id);
            updatedCount++;
          } else {
            await supabase.from("machine_catalog").insert({
              user_id: userId, tipo, marca, modelo, custo_fob: custoFob, preco_venda_fob: precoVenda, informado_por: informadoPor || null,
            } as any);
            newCount++;
          }
        }

        // Reload from DB
        const refreshed = await fetchCatalog();
        setCatalog(refreshed);

        toast({ title: `Importação concluída: ${newCount} novos, ${updatedCount} atualizados, ${skipped} ignorados` });
      } catch {
        toast({ title: "Erro ao ler o arquivo Excel", variant: "destructive" });
      }
    };
    reader.readAsArrayBuffer(file);
    e.target.value = "";
  };

  return (
    <>
    <Card className="border-border bg-card p-6 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-heading text-lg font-semibold text-card-foreground flex items-center gap-2">
          <Package className="h-5 w-5" /> Catálogo de Máquinas
        </h2>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleExportExcel}>
            <Download className="h-4 w-4 mr-1" /> Exportar Excel
          </Button>
          <Button variant="outline" size="sm" asChild>
            <label className="cursor-pointer">
              <Upload className="h-4 w-4 mr-1" /> Importar Excel
              <input type="file" accept=".xlsx,.xls" className="hidden" onChange={handleImportExcel} />
            </label>
          </Button>
          <Badge variant="secondary" className="gap-1">
            <Hash className="h-3 w-3" /> {catalog.length} modelo{catalog.length !== 1 ? "s" : ""}
          </Badge>
        </div>
      </div>

      {/* Add form */}
      <div className="grid grid-cols-2 md:grid-cols-8 gap-3 mb-5">
        <div>
          <Label className="mb-1 text-xs text-muted-foreground">Tipo</Label>
          <Input value={newTipo} onChange={(e) => setNewTipo(e.target.value)} placeholder="Ex: Torno CNC" className="bg-secondary/50 border-border text-sm" list="tipos-list" />
          <datalist id="tipos-list">
            {tipos.map((t) => <option key={t} value={t} />)}
          </datalist>
        </div>
        <div>
          <Label className="mb-1 text-xs text-muted-foreground">Marca</Label>
          <Input value={newMarca} onChange={(e) => setNewMarca(e.target.value)} placeholder="Ex: SINO" className="bg-secondary/50 border-border text-sm" list="marcas-list" />
          <datalist id="marcas-list">
            {marcas.map((m) => <option key={m} value={m} />)}
          </datalist>
        </div>
        <div>
          <Label className="mb-1 text-xs text-muted-foreground">Modelo</Label>
          <Input value={newModelo} onChange={(e) => setNewModelo(e.target.value)} placeholder="Ex: OKM650S" className="bg-secondary/50 border-border text-sm" />
        </div>
        <div>
          <Label className="mb-1 text-xs text-muted-foreground">Custo FOB (USD)</Label>
          <Input type="number" step="0.01" min="0" value={newFob} onChange={(e) => setNewFob(e.target.value)} placeholder="0,00" className="bg-secondary/50 border-border text-sm" />
        </div>
        <div>
          <Label className="mb-1 text-xs text-muted-foreground">Preço Venda FOB (USD)</Label>
          <Input type="number" step="0.01" min="0" value={newPrecoVenda} onChange={(e) => setNewPrecoVenda(e.target.value)} placeholder="0,00" className="bg-secondary/50 border-border text-sm" />
        </div>
        <div>
          <Label className="mb-1 text-xs text-muted-foreground">Margem</Label>
          <div className="flex items-center h-10 px-3 rounded-md border border-border bg-muted/50">
            {(() => {
              const mg = calcMargin(parseFloat(newFob) || 0, parseFloat(newPrecoVenda) || 0);
              return <span className={`text-sm font-semibold ${marginColor(mg)}`}>{formatMargin(mg)}</span>;
            })()}
          </div>
        </div>
        <div>
          <Label className="mb-1 text-xs text-muted-foreground">Informado por</Label>
          <Input value={newInformadoPor} onChange={(e) => setNewInformadoPor(e.target.value)} placeholder="Nome" className="bg-secondary/50 border-border text-sm" />
        </div>
        <div className="flex items-end">
          <Button className="w-full" onClick={handleAdd} disabled={!newTipo.trim() || !newMarca.trim() || !newModelo.trim() || saving}>
            {saving ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Plus className="h-4 w-4 mr-1" />} Adicionar
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-4">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar tipo, marca ou modelo..." className="pl-9 bg-secondary/50 border-border text-sm" />
        </div>
        <Select value={filterTipo} onValueChange={setFilterTipo}>
          <SelectTrigger className="w-[180px] bg-secondary/50 border-border text-sm">
            <SelectValue placeholder="Tipo" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os Tipos</SelectItem>
            {tipos.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filterMarca} onValueChange={setFilterMarca}>
          <SelectTrigger className="w-[180px] bg-secondary/50 border-border text-sm">
            <SelectValue placeholder="Marca" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas as Marcas</SelectItem>
            {marcas.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      {filtered.length === 0 ? (
        <p className="text-muted-foreground text-center py-8 text-sm">Nenhuma máquina encontrada.</p>
      ) : (
        <ScrollArea className="h-[500px]">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-8">#</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Marca</TableHead>
                <TableHead>Modelo</TableHead>
                <TableHead className="text-right">Custo FOB (USD)</TableHead>
                <TableHead className="text-right">Preço Venda FOB (USD)</TableHead>
                <TableHead className="text-right">Margem Padrão</TableHead>
                <TableHead>Informado por</TableHead>
                <TableHead>Atualização</TableHead>
                <TableHead className="w-20"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((m, i) => (
                <TableRow key={m.id}>
                  <TableCell className="text-xs text-muted-foreground">{i + 1}</TableCell>

                  {editingId === m.id ? (
                    <>
                      <TableCell>
                        <Input value={editState.tipo} onChange={(e) => setEditState(s => ({ ...s, tipo: e.target.value }))} className={editInputClass} list="tipos-list-edit" />
                        <datalist id="tipos-list-edit">{tipos.map((t) => <option key={t} value={t} />)}</datalist>
                      </TableCell>
                      <TableCell>
                        <Input value={editState.marca} onChange={(e) => setEditState(s => ({ ...s, marca: e.target.value }))} className={editInputClass} list="marcas-list-edit" />
                        <datalist id="marcas-list-edit">{marcas.map((m) => <option key={m} value={m} />)}</datalist>
                      </TableCell>
                      <TableCell>
                        <Input value={editState.modelo} onChange={(e) => setEditState(s => ({ ...s, modelo: e.target.value }))} className={editInputClass} />
                      </TableCell>
                      <TableCell>
                        <Input type="number" step="0.01" min="0" value={editState.custo_fob} onChange={(e) => setEditState(s => ({ ...s, custo_fob: e.target.value }))} className={`${editInputClass} w-28 text-right`} />
                      </TableCell>
                      <TableCell>
                        <Input type="number" step="0.01" min="0" value={editState.preco_venda_fob} onChange={(e) => setEditState(s => ({ ...s, preco_venda_fob: e.target.value }))} className={`${editInputClass} w-28 text-right`} />
                      </TableCell>
                      <TableCell className="text-right">
                        {(() => {
                          const mg = calcMargin(parseFloat(editState.custo_fob) || 0, parseFloat(editState.preco_venda_fob) || 0);
                          return <span className={`text-sm font-semibold ${marginColor(mg)}`}>{formatMargin(mg)}</span>;
                        })()}
                      </TableCell>
                      <TableCell>
                        <Input value={editState.informado_por} onChange={(e) => setEditState(s => ({ ...s, informado_por: e.target.value }))} className={editInputClass} />
                      </TableCell>
                    </>
                  ) : (
                    <>
                      <TableCell className="text-sm">{m.tipo}</TableCell>
                      <TableCell className="text-sm font-medium">{m.marca}</TableCell>
                      <TableCell className="text-sm font-medium">{m.modelo}</TableCell>
                      <TableCell className="text-right text-sm">{m.custo_fob > 0 ? formatUsd(m.custo_fob) : "—"}</TableCell>
                      <TableCell className="text-right text-sm">{(m.preco_venda_fob || 0) > 0 ? formatUsd(m.preco_venda_fob) : "—"}</TableCell>
                      <TableCell className="text-right">
                        {(() => {
                          const mg = calcMargin(m.custo_fob, m.preco_venda_fob || 0);
                          return <span className={`text-sm font-semibold ${marginColor(mg)}`}>{formatMargin(mg)}</span>;
                        })()}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">{m.informado_por || "—"}</TableCell>
                    </>
                  )}

                  <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                    {new Date(m.updated_at).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" })}
                  </TableCell>
                  <TableCell>
                    {editingId === m.id ? (
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleEditSave(m.id)}>
                          <Check className="h-3.5 w-3.5 text-accent" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setEditingId(null)}>
                          <X className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    ) : (
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => startEditing(m)}>
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleDelete(m.id)}>
                          <Trash2 className="h-3.5 w-3.5 text-destructive" />
                        </Button>
                      </div>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </ScrollArea>
      )}
    </Card>
    </>
  );
};

export default MachineCatalog;
