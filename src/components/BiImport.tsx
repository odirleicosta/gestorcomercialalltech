import { useState, useCallback, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Upload, FileSpreadsheet, CheckCircle2, AlertTriangle, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import * as XLSX from "xlsx";

interface Props {
  userId: string;
}

interface Rep {
  id: string;
  nome: string;
}

type TabKey = "visitas" | "oportunidades" | "perdas" | "metas";

function getWeekNumber(d: Date): number {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  date.setUTCDate(date.getUTCDate() + 4 - (date.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  return Math.ceil(((date.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
}

function normalize(s: string): string {
  return s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
}

function findRep(name: string, reps: Rep[]): Rep | undefined {
  const n = normalize(name);
  return reps.find(r => normalize(r.nome) === n) || reps.find(r => normalize(r.nome).includes(n) || n.includes(normalize(r.nome)));
}

function parseExcel(file: File): Promise<Record<string, string>[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const wb = XLSX.read(e.target?.result, { type: "array", cellDates: true });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const data = XLSX.utils.sheet_to_json<Record<string, string>>(ws, { defval: "" });
        resolve(data);
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = reject;
    reader.readAsArrayBuffer(file);
  });
}

const LAST_IMPORT_KEY = "bi_import_last_";

const BiImport = ({ userId }: Props) => {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<TabKey>("visitas");
  const [reps, setReps] = useState<Rep[]>([]);
  const [repsLoaded, setRepsLoaded] = useState(false);
  const [data, setData] = useState<Record<string, string>[]>([]);
  const [fileName, setFileName] = useState("");
  const [importing, setImporting] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const [lastImports, setLastImports] = useState<Record<string, string>>(() => {
    const stored: Record<string, string> = {};
    for (const k of ["visitas", "oportunidades", "perdas", "metas"] as TabKey[]) {
      const v = localStorage.getItem(LAST_IMPORT_KEY + k);
      if (v) stored[k] = v;
    }
    return stored;
  });

  const loadReps = useCallback(async () => {
    if (repsLoaded) return;
    const { data: r } = await supabase.from("representatives").select("id, nome").eq("user_id", userId);
    if (r) { setReps(r); setRepsLoaded(true); }
  }, [userId, repsLoaded]);

  const handleFile = async (file: File) => {
    await loadReps();
    try {
      const rows = await parseExcel(file);
      if (!rows.length) { toast({ title: "Arquivo vazio", variant: "destructive" }); return; }
      setData(rows);
      setFileName(file.name);
    } catch {
      toast({ title: "Erro ao ler arquivo", variant: "destructive" });
    }
  };

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) handleFile(f);
    e.target.value = "";
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const f = e.dataTransfer.files?.[0];
    if (f) handleFile(f);
  };

  const clearData = () => { setData([]); setFileName(""); };

  const markImported = (tab: TabKey) => {
    const now = new Date().toLocaleString("pt-BR");
    localStorage.setItem(LAST_IMPORT_KEY + tab, now);
    setLastImports(prev => ({ ...prev, [tab]: now }));
  };

  // ---- VISITAS ----
  const importVisitas = async () => {
    setImporting(true);
    try {
      let ok = 0, skip = 0;
      for (const row of data) {
        const name = row["Proprietario Nome"] || row["proprietario nome"] || "";
        const rep = findRep(name, reps);
        if (!rep) { skip++; continue; }
        const dateVal = row["Data"] || row["data"] || "";
        const d = new Date(dateVal);
        if (isNaN(d.getTime())) { skip++; continue; }
        const qty = parseInt(row["Quantidade"] || row["quantidade"] || "0", 10);
        const ano = d.getFullYear();
        const semana = getWeekNumber(d);
        const { error } = await supabase.from("weekly_visits").upsert(
          { representative_id: rep.id, ano, semana, quantidade: qty, meta: 16, user_id: userId },
          { onConflict: "representative_id,ano,semana" }
        );
        if (!error) ok++; else skip++;
      }
      toast({ title: `Visitas importadas: ${ok} registros${skip ? ` (${skip} ignorados)` : ""}` });
      markImported("visitas");
      clearData();
    } catch { toast({ title: "Erro na importação", variant: "destructive" }); }
    setImporting(false);
  };

  // ---- OPORTUNIDADES ----
  const importOportunidades = async () => {
    setImporting(true);
    try {
      const grouped: Record<string, { rep: Rep; ano: number; mes: number; qty: number }> = {};
      for (const row of data) {
        const name = row["Proprietario Nome"] || row["proprietario nome"] || "";
        const rep = findRep(name, reps);
        if (!rep) continue;
        const dateVal = row["Data Criação"] || row["Data Criacao"] || row["data criação"] || row["data criacao"] || "";
        const d = new Date(dateVal);
        if (isNaN(d.getTime())) continue;
        const qty = parseInt(row["Quantidade"] || row["quantidade"] || "1", 10);
        const key = `${rep.id}-${d.getFullYear()}-${d.getMonth() + 1}`;
        if (!grouped[key]) grouped[key] = { rep, ano: d.getFullYear(), mes: d.getMonth() + 1, qty: 0 };
        grouped[key].qty += qty;
      }
      let ok = 0;
      for (const g of Object.values(grouped)) {
        const { error } = await supabase.from("monthly_opportunities" as any).upsert(
          { representative_id: g.rep.id, ano: g.ano, mes: g.mes, quantidade: g.qty, user_id: userId },
          { onConflict: "user_id,representative_id,ano,mes" }
        );
        if (!error) ok++;
      }
      toast({ title: `Oportunidades importadas: ${ok} registros` });
      markImported("oportunidades");
      clearData();
    } catch { toast({ title: "Erro na importação", variant: "destructive" }); }
    setImporting(false);
  };

  // ---- PERDAS ----
  const importPerdas = async () => {
    setImporting(true);
    try {
      let ok = 0, skip = 0;
      for (const row of data) {
        const name = row["Proprietario Nome"] || row["proprietario nome"] || "";
        const rep = findRep(name, reps);
        const clientName = row["Cliente"] || row["cliente"] || "";
        const machineName = row["Máquina"] || row["Maquina"] || row["máquina"] || row["maquina"] || "";
        const value = parseFloat(String(row["Valor"] || row["valor"] || "0").replace(/[^\d.,\-]/g, "").replace(",", ".")) || 0;

        // Check duplicate
        const { data: existing } = await supabase.from("closing_deals")
          .select("id")
          .eq("user_id", userId)
          .eq("client_name", clientName)
          .eq("machine_name", machineName)
          .eq("deal_value", value)
          .eq("status", "perdida")
          .limit(1);
        if (existing && existing.length > 0) { skip++; continue; }

        const { error } = await supabase.from("closing_deals").insert({
          user_id: userId,
          representative_id: rep?.id || null,
          client_name: clientName,
          machine_name: machineName,
          machine_type: "",
          deal_value: value,
          status: "perdida",
        });
        if (!error) ok++; else skip++;
      }
      toast({ title: `Perdas importadas: ${ok} registros${skip ? ` (${skip} duplicados/ignorados)` : ""}` });
      markImported("perdas");
      clearData();
    } catch { toast({ title: "Erro na importação", variant: "destructive" }); }
    setImporting(false);
  };

  // ---- METAS ----
  const importMetas = async () => {
    setImporting(true);
    try {
      let ok = 0, skip = 0;
      for (const row of data) {
        const name = row["Proprietario Nome"] || row["proprietario nome"] || "";
        const rep = findRep(name, reps);
        if (!rep) { skip++; continue; }
        const mes = parseInt(row["Mês"] || row["Mes"] || row["mes"] || "0", 10);
        const ano = parseInt(row["Ano"] || row["ano"] || "0", 10);
        if (!mes || !ano) { skip++; continue; }
        const metaValor = parseFloat(String(row["Meta Valor"] || row["meta valor"] || "0").replace(/[^\d.,\-]/g, "").replace(",", ".")) || 0;
        const metaQtd = parseInt(row["Meta Quantidade"] || row["meta quantidade"] || "0", 10);

        const { error } = await supabase.from("monthly_goals").upsert(
          { representative_id: rep.id, mes, ano, meta_valor: metaValor, meta_quantidade: metaQtd, machine_type: "all", user_id: userId },
          { onConflict: "representative_id,mes,ano,machine_type" }
        );
        if (!error) ok++; else skip++;
      }
      toast({ title: `Metas importadas: ${ok} registros${skip ? ` (${skip} ignorados)` : ""}` });
      markImported("metas");
      clearData();
    } catch { toast({ title: "Erro na importação", variant: "destructive" }); }
    setImporting(false);
  };

  const importFn: Record<TabKey, () => Promise<void>> = {
    visitas: importVisitas,
    oportunidades: importOportunidades,
    perdas: importPerdas,
    metas: importMetas,
  };

  const expectedColumns: Record<TabKey, string[]> = {
    visitas: ["Proprietario Nome", "Data", "Quantidade"],
    oportunidades: ["Proprietario Nome", "Data Criação", "Quantidade"],
    perdas: ["Proprietario Nome", "Cliente", "Máquina", "Valor", "Data"],
    metas: ["Proprietario Nome", "Mês", "Ano", "Meta Valor", "Meta Quantidade"],
  };

  const previewRows = data.slice(0, 5);
  const columns = data.length ? Object.keys(data[0]) : [];

  // Check unmatched reps in preview
  const unmatchedNames = data.length && reps.length
    ? [...new Set(data.map(r => r["Proprietario Nome"] || r["proprietario nome"] || "").filter(n => n && !findRep(n, reps)))]
    : [];

  const DropZone = () => (
    <div
      onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
      onDragLeave={() => setDragOver(false)}
      onDrop={onDrop}
      onClick={() => fileRef.current?.click()}
      className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors ${dragOver ? "border-primary bg-primary/5" : "border-border hover:border-primary/50"}`}
    >
      <input ref={fileRef} type="file" accept=".xlsx,.csv,.xls" className="hidden" onChange={onFileChange} />
      <Upload className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
      <p className="text-sm font-medium text-foreground">Arraste o arquivo ou clique para selecionar</p>
      <p className="text-xs text-muted-foreground mt-1">.xlsx ou .csv</p>
      <div className="mt-3 flex flex-wrap justify-center gap-1">
        {expectedColumns[activeTab].map(c => <Badge key={c} variant="secondary" className="text-xs">{c}</Badge>)}
      </div>
    </div>
  );

  const Preview = () => (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <FileSpreadsheet className="h-4 w-4 text-primary" />
          <span className="text-sm font-medium">{fileName}</span>
          <Badge variant="outline">{data.length} linhas</Badge>
        </div>
        <Button variant="ghost" size="sm" onClick={clearData}>Limpar</Button>
      </div>

      {unmatchedNames.length > 0 && (
        <div className="flex items-start gap-2 rounded-lg border border-warning/50 bg-warning/10 p-3">
          <AlertTriangle className="h-4 w-4 text-warning shrink-0 mt-0.5" />
          <div className="text-sm text-warning-foreground dark:text-warning">
            <strong>Representantes não encontrados:</strong> {unmatchedNames.join(", ")}
          </div>
        </div>
      )}

      <div className="rounded-lg border overflow-auto max-h-64">
        <Table>
          <TableHeader>
            <TableRow>{columns.map(c => <TableHead key={c} className="text-xs whitespace-nowrap">{c}</TableHead>)}</TableRow>
          </TableHeader>
          <TableBody>
            {previewRows.map((row, i) => (
              <TableRow key={i}>
                {columns.map(c => (
                  <TableCell key={c} className="text-xs whitespace-nowrap">
                    {typeof row[c] === "object" && row[c] !== null && "toLocaleDateString" in (row[c] as any) ? (row[c] as any).toLocaleDateString("pt-BR") : String(row[c] ?? "")}
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <Button onClick={() => importFn[activeTab]()} disabled={importing} className="w-full">
        {importing ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <CheckCircle2 className="h-4 w-4 mr-2" />}
        Confirmar importação ({data.length} registros)
      </Button>
    </div>
  );

  const tabLabel: Record<TabKey, string> = {
    visitas: "Visitas",
    oportunidades: "Oportunidades",
    perdas: "Perdas",
    metas: "Metas",
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10">
          <Upload className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h1 className="font-heading text-xl font-bold text-foreground">Importar BI</h1>
          <p className="text-sm text-muted-foreground">Importe dados do Power BI via Excel</p>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={(v) => { setActiveTab(v as TabKey); clearData(); }}>
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="visitas">Visitas</TabsTrigger>
          <TabsTrigger value="oportunidades">Oportunidades</TabsTrigger>
          <TabsTrigger value="perdas">Perdas</TabsTrigger>
          <TabsTrigger value="metas">Metas</TabsTrigger>
        </TabsList>

        {(["visitas", "oportunidades", "perdas", "metas"] as TabKey[]).map(tab => (
          <TabsContent key={tab} value={tab}>
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">{tabLabel[tab]}</CardTitle>
                  {lastImports[tab] && (
                    <Badge variant="outline" className="text-xs font-normal">
                      Última importação: {lastImports[tab]}
                    </Badge>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                {data.length === 0 ? <DropZone /> : <Preview />}
              </CardContent>
            </Card>
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
};

export default BiImport;
