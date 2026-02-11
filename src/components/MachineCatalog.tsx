import { useState, useEffect, useMemo } from "react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Plus, Trash2, Search, Package, Hash, Pencil, X, Check, DollarSign } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export interface CatalogMachine {
  id: string;
  tipo: string;
  marca: string;
  modelo: string;
  custo_fob: number;
  informado_por?: string;
  created_at: string;
  updated_at: string;
}

const CATALOG_KEY = "price-calc-machine-catalog";

export const loadCatalog = (): CatalogMachine[] => {
  try {
    return JSON.parse(localStorage.getItem(CATALOG_KEY) || "[]");
  } catch {
    return [];
  }
};

export const saveCatalog = (catalog: CatalogMachine[]) => {
  localStorage.setItem(CATALOG_KEY, JSON.stringify(catalog));
};

interface Props {
  catalog: CatalogMachine[];
  setCatalog: React.Dispatch<React.SetStateAction<CatalogMachine[]>>;
}

const TIPOS = ["Centro de Usinagem", "Torno CNC", "4º eixo"];
const MARCAS = ["HARTFORD", "SINO", "DMTG", "Feiya", "Timeway", "TAKISAWA", "ZMAT", "GSA"];

const MachineCatalog = ({ catalog, setCatalog }: Props) => {
  const { toast } = useToast();

  const [newTipo, setNewTipo] = useState("");
  const [newMarca, setNewMarca] = useState("");
  const [newModelo, setNewModelo] = useState("");
  const [newFob, setNewFob] = useState("");
  const [newInformadoPor, setNewInformadoPor] = useState("");

  const [search, setSearch] = useState("");
  const [filterTipo, setFilterTipo] = useState("all");
  const [filterMarca, setFilterMarca] = useState("all");

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editFob, setEditFob] = useState("");

  // Derive unique tipos/marcas from data
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

  const formatUsd = (v: number) =>
    `$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  const handleAdd = () => {
    const tipo = newTipo.trim();
    const marca = newMarca.trim();
    const modelo = newModelo.trim();
    const fob = parseFloat(newFob) || 0;
    if (!tipo || !marca || !modelo) {
      toast({ title: "Preencha Tipo, Marca e Modelo", variant: "destructive" });
      return;
    }
    if (catalog.some((m) => m.modelo.toLowerCase() === modelo.toLowerCase() && m.marca.toLowerCase() === marca.toLowerCase())) {
      toast({ title: "Modelo já cadastrado para esta marca", variant: "destructive" });
      return;
    }
    const now = new Date().toISOString();
    const entry: CatalogMachine = {
      id: crypto.randomUUID(),
      tipo,
      marca,
      modelo,
      custo_fob: fob,
      informado_por: newInformadoPor.trim() || undefined,
      created_at: now,
      updated_at: now,
    };
    const updated = [entry, ...catalog];
    setCatalog(updated);
    saveCatalog(updated);
    setNewTipo("");
    setNewMarca("");
    setNewModelo("");
    setNewFob("");
    setNewInformadoPor("");
    toast({ title: "Máquina cadastrada no catálogo!" });
  };

  const handleDelete = (id: string) => {
    const updated = catalog.filter((m) => m.id !== id);
    setCatalog(updated);
    saveCatalog(updated);
  };

  const handleEditSave = (id: string) => {
    const fob = parseFloat(editFob) || 0;
    const updated = catalog.map((m) =>
      m.id === id ? { ...m, custo_fob: fob, updated_at: new Date().toISOString() } : m
    );
    setCatalog(updated);
    saveCatalog(updated);
    setEditingId(null);
    toast({ title: "Custo FOB atualizado!" });
  };

  return (
    <Card className="border-border bg-card p-6 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-heading text-lg font-semibold text-card-foreground flex items-center gap-2">
          <Package className="h-5 w-5" /> Catálogo de Máquinas
        </h2>
        <Badge variant="secondary" className="gap-1">
          <Hash className="h-3 w-3" /> {catalog.length} modelo{catalog.length !== 1 ? "s" : ""}
        </Badge>
      </div>

      {/* Add form */}
      <div className="grid grid-cols-2 md:grid-cols-6 gap-3 mb-5">
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
          <Label className="mb-1 text-xs text-muted-foreground">Informado por</Label>
          <Input value={newInformadoPor} onChange={(e) => setNewInformadoPor(e.target.value)} placeholder="Nome" className="bg-secondary/50 border-border text-sm" />
        </div>
        <div className="flex items-end">
          <Button className="w-full" onClick={handleAdd} disabled={!newTipo.trim() || !newMarca.trim() || !newModelo.trim()}>
            <Plus className="h-4 w-4 mr-1" /> Adicionar
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
                <TableHead>Informado por</TableHead>
                <TableHead>Atualização</TableHead>
                <TableHead className="w-20"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((m, i) => (
                <TableRow key={m.id}>
                  <TableCell className="text-xs text-muted-foreground">{i + 1}</TableCell>
                  <TableCell className="text-sm">{m.tipo}</TableCell>
                  <TableCell className="text-sm font-medium">{m.marca}</TableCell>
                  <TableCell className="text-sm font-medium">{m.modelo}</TableCell>
                  <TableCell className="text-right">
                    {editingId === m.id ? (
                      <div className="flex items-center gap-1 justify-end">
                        <Input
                          type="number"
                          step="0.01"
                          min="0"
                          value={editFob}
                          onChange={(e) => setEditFob(e.target.value)}
                          className="w-28 h-7 text-sm bg-secondary/50 border-border"
                          autoFocus
                          onKeyDown={(e) => {
                            if (e.key === "Enter") handleEditSave(m.id);
                            if (e.key === "Escape") setEditingId(null);
                          }}
                        />
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleEditSave(m.id)}>
                          <Check className="h-3.5 w-3.5 text-accent" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setEditingId(null)}>
                          <X className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    ) : (
                      <span
                        className="cursor-pointer hover:text-primary transition-colors text-sm"
                        onClick={() => { setEditingId(m.id); setEditFob(String(m.custo_fob)); }}
                        title="Clique para editar"
                      >
                        {m.custo_fob > 0 ? formatUsd(m.custo_fob) : "—"}
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">{m.informado_por || "—"}</TableCell>
                  <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                    {new Date(m.updated_at).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" })}
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => { setEditingId(m.id); setEditFob(String(m.custo_fob)); }}>
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleDelete(m.id)}>
                        <Trash2 className="h-3.5 w-3.5 text-destructive" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </ScrollArea>
      )}
    </Card>
  );
};

export default MachineCatalog;
