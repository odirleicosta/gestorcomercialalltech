import { useState, useCallback, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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

const MONTH_NAMES: Record<string, number> = {
  janeiro: 1, fevereiro: 2, marco: 3, abril: 4, maio: 5, junho: 6,
  julho: 7, agosto: 8, setembro: 9, outubro: 10, novembro: 11, dezembro: 12,
};

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

function parseMonthName(s: string): number {
  const n = normalize(s);
  return MONTH_NAMES[n] || parseInt(s, 10) || 0;
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

function getFieldCI(row: Record<string, string>, ...names: string[]): string {
  for (const name of names) {
    if (row[name] !== undefined && row[name] !== "") return String(row[name]);
    const lower = name.toLowerCase();
    for (const key of Object.keys(row)) {
      if (key.toLowerCase() === lower && row[key] !== undefined && row[key] !== "") return String(row[key]);
    }
  }
  return "";
}

const LAST_IMPORT_KEY = "bi_import_last_";
const IMPORTED_FILES_KEY = "bi_import_files_";

interface ImportedFile {
  name: string;
  tab: TabKey;
  date: string;
  rows: number;
}

function loadImportedFiles(): ImportedFile[] {
  try {
    const stored = localStorage.getItem(IMPORTED_FILES_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch { return []; }
}

function saveImportedFile(file: ImportedFile) {
  const files = loadImportedFiles();
  files.unshift(file);
  localStorage.setItem(IMPORTED_FILES_KEY, JSON.stringify(files.slice(0, 100)));
}

const BiImport = ({ userId }: Props) => {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<TabKey>("visitas");
  const [reps, setReps] = useState<Rep[]>([]);
  const [repsLoaded, setRepsLoaded] = useState(false);
  const [data, setData] = useState<Record<string, string>[]>([]);
  const [fileName, setFileName] = useState("");
  const [importing, setImporting] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [metaYear, setMetaYear] = useState(new Date().getFullYear());
  const fileRef = useRef<HTMLInputElement>(null);
  const [importedFiles, setImportedFiles] = useState<ImportedFile[]>(loadImportedFiles);

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
    // Check if this file was already imported for this tab
    const alreadyImported = importedFiles.find(f => f.name === file.name && f.tab === activeTab);
    if (alreadyImported) {
      toast({ 
        title: "Arquivo já importado", 
        description: `"${file.name}" já foi importado em ${activeTab} em ${alreadyImported.date}. Selecione outro arquivo ou continue se deseja reimportar.`,
        variant: "destructive" 
      });
    }
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
    if (fileName) {
      const entry: ImportedFile = { name: fileName, tab, date: now, rows: data.length };
      saveImportedFile(entry);
      setImportedFiles(loadImportedFiles());
    }
  };

  // ---- VISITAS ----
  const importVisitas = async () => {
    setImporting(true);
    try {
      // Group by rep + week
      const grouped: Record<string, { repId: string; ano: number; semana: number; qty: number }> = {};
      let skip = 0;
      for (const row of data) {
        const name = getFieldCI(row, "Proprietario Nome");
        const rep = findRep(name, reps);
        if (!rep) { skip++; continue; }
        const dateVal = getFieldCI(row, "Data");
        const d = new Date(dateVal);
        if (isNaN(d.getTime())) { skip++; continue; }
        const qty = parseInt(getFieldCI(row, "Quantidade") || "0", 10);
        const ano = d.getFullYear();
        const semana = getWeekNumber(d);
        const key = `${rep.id}-${ano}-${semana}`;
        if (!grouped[key]) grouped[key] = { repId: rep.id, ano, semana, qty: 0 };
        grouped[key].qty += qty;
      }
      let ok = 0;
      for (const g of Object.values(grouped)) {
        const { error } = await supabase.from("weekly_visits").upsert(
          { representative_id: g.repId, ano: g.ano, semana: g.semana, quantidade: g.qty, meta: 0, user_id: userId },
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
        const name = getFieldCI(row, "Proprietario Nome");
        const rep = findRep(name, reps);
        if (!rep) continue;
        const dateVal = getFieldCI(row, "Data Criação", "Data Criacao");
        const d = new Date(dateVal);
        if (isNaN(d.getTime())) continue;
        const key = `${rep.id}-${d.getFullYear()}-${d.getMonth() + 1}`;
        if (!grouped[key]) grouped[key] = { rep, ano: d.getFullYear(), mes: d.getMonth() + 1, qty: 0 };
        grouped[key].qty += 1;
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
        const name = getFieldCI(row, "Fechado por");
        const rep = findRep(name, reps);
        const clientName = getFieldCI(row, "Cliente");
        const lostReason = getFieldCI(row, "Motivo_da_Perda", "Motivo da Perda");
        const lostDetail = getFieldCI(row, "Submotivo_da_Perda", "Submotivo da Perda");
        const dateVal = getFieldCI(row, "Criação", "Criacao");
        const d = new Date(dateVal);
        const startDate = isNaN(d.getTime()) ? new Date().toISOString().slice(0, 10) : d.toISOString().slice(0, 10);

        // Check duplicate by client_name + lost_reason + start_date
        const { data: existing } = await supabase.from("closing_deals")
          .select("id")
          .eq("user_id", userId)
          .eq("client_name", clientName)
          .eq("lost_reason", lostReason)
          .eq("start_date", startDate)
          .eq("status", "perdida")
          .limit(1);
        if (existing && existing.length > 0) { skip++; continue; }

        const { error } = await supabase.from("closing_deals").insert({
          user_id: userId,
          representative_id: rep?.id || null,
          client_name: clientName,
          machine_name: "",
          machine_type: "",
          deal_value: 0,
          status: "perdida",
          lost_reason: lostReason,
          lost_reason_detail: lostDetail,
          start_date: startDate,
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
        const name = getFieldCI(row, "Representante");
        const rep = findRep(name, reps);
        if (!rep) { skip++; continue; }
        const mesStr = getFieldCI(row, "Nome Mês", "Nome Mes");
        const mes = parseMonthName(mesStr);
        if (!mes) { skip++; continue; }
        const metaQtd = parseInt(getFieldCI(row, "Meta") || "0", 10);
        const machineType = getFieldCI(row, "Tipo Produto") || "all";

        const { error } = await supabase.from("monthly_goals").upsert(
          { representative_id: rep.id, mes, ano: metaYear, meta_quantidade: metaQtd, meta_valor: 0, machine_type: machineType, user_id: userId },
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
    oportunidades: ["Proprietario Nome", "Data Criação", "Nome da Oportunidade"],
    perdas: ["Fechado por", "Cliente", "Motivo_da_Perda", "Submotivo_da_Perda", "Criação"],
    metas: ["Representante", "Tipo Produto", "Meta", "Realizado", "Nome Mês"],
  };

  const previewRows = data.slice(0, 5);
  const columns = data.length ? Object.keys(data[0]) : [];

  // Get the name field based on current tab
  const nameField = activeTab === "perdas" ? "Fechado por" : activeTab === "metas" ? "Representante" : "Proprietario Nome";
  const unmatchedNames = data.length && reps.length
    ? [...new Set(data.map(r => getFieldCI(r, nameField)).filter(n => n && !findRep(n, reps)))]
    : [];

  const renderDropZone = () => (
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

  const renderPreview = () => (
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
        <div className="flex items-start gap-2 rounded-lg border border-destructive/50 bg-destructive/10 p-3">
          <AlertTriangle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
          <div className="text-sm text-destructive">
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
            {previewRows.map((row, i) => {
              const rowName = getFieldCI(row, nameField);
              const isUnmatched = rowName && !findRep(rowName, reps);
              return (
                <TableRow key={i} className={isUnmatched ? "bg-accent/30" : ""}>
                  {columns.map(c => (
                    <TableCell key={c} className="text-xs whitespace-nowrap">
                      {typeof row[c] === "object" && row[c] !== null && "toLocaleDateString" in (row[c] as any) ? (row[c] as any).toLocaleDateString("pt-BR") : String(row[c] ?? "")}
                    </TableCell>
                  ))}
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      {activeTab === "metas" && (
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Ano:</span>
          <Select value={String(metaYear)} onValueChange={(v) => setMetaYear(Number(v))}>
            <SelectTrigger className="w-28"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="2024">2024</SelectItem>
              <SelectItem value="2025">2025</SelectItem>
              <SelectItem value="2026">2026</SelectItem>
            </SelectContent>
          </Select>
        </div>
      )}

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
          <TabsTrigger value="perdas">Perdas</TabsTrigger>
          <TabsTrigger value="metas">Metas</TabsTrigger>
          <TabsTrigger value="oportunidades">Oportunidades</TabsTrigger>
        </TabsList>

        {(["visitas", "perdas", "metas", "oportunidades"] as TabKey[]).map(tab => (
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
                {data.length === 0 ? renderDropZone() : renderPreview()}
              </CardContent>
            </Card>
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
};

export default BiImport;
