import { useState, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Upload, FileSpreadsheet, AlertTriangle, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import * as XLSX from "xlsx";

interface Props {
  userId: string;
  reps: { id: string; nome: string }[];
  open: boolean;
  onClose: () => void;
  onImported: () => void;
}

const MONTH_NAMES: Record<string, number> = {
  janeiro: 1, fevereiro: 2, marco: 3, abril: 4, maio: 5, junho: 6,
  julho: 7, agosto: 8, setembro: 9, outubro: 10, novembro: 11, dezembro: 12,
};

function normalize(s: string): string {
  return s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
}

function parseMonthName(s: string): number {
  const n = normalize(s);
  return MONTH_NAMES[n] || parseInt(s, 10) || 0;
}

function findRep(name: string, reps: { id: string; nome: string }[]) {
  const n = normalize(name);
  return reps.find(r => normalize(r.nome) === n) || reps.find(r => normalize(r.nome).includes(n) || n.includes(normalize(r.nome)));
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

const GoalImport = ({ userId, reps, open, onClose, onImported }: Props) => {
  const { toast } = useToast();
  const [data, setData] = useState<Record<string, string>[]>([]);
  const [fileName, setFileName] = useState("");
  const [importing, setImporting] = useState(false);
  const [metaYear, setMetaYear] = useState(new Date().getFullYear());
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFile = async (file: File) => {
    try {
      const reader = new FileReader();
      reader.onload = (e) => {
        const wb = XLSX.read(e.target?.result, { type: "array", cellDates: true });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json<Record<string, string>>(ws, { defval: "" });
        if (!rows.length) { toast({ title: "Arquivo vazio", variant: "destructive" }); return; }
        setData(rows);
        setFileName(file.name);
      };
      reader.readAsArrayBuffer(file);
    } catch { toast({ title: "Erro ao ler arquivo", variant: "destructive" }); }
  };

  const handleImport = async () => {
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
      setData([]);
      setFileName("");
      onImported();
      onClose();
    } catch { toast({ title: "Erro na importação", variant: "destructive" }); }
    setImporting(false);
  };

  const columns = data.length ? Object.keys(data[0]) : [];
  const previewRows = data.slice(0, 5);
  const unmatchedNames = data.length && reps.length
    ? [...new Set(data.map(r => getFieldCI(r, "Representante")).filter(n => n && !findRep(n, reps)))]
    : [];

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) { onClose(); setData([]); setFileName(""); } }}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Importar Metas via Planilha</DialogTitle>
        </DialogHeader>

        {!data.length ? (
          <div
            onClick={() => fileRef.current?.click()}
            className="border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors border-border hover:border-primary/50"
          >
            <input ref={fileRef} type="file" accept=".xlsx,.csv,.xls" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = ""; }} />
            <Upload className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
            <p className="text-sm font-medium text-foreground">Arraste o arquivo ou clique para selecionar</p>
            <p className="text-xs text-muted-foreground mt-1">.xlsx ou .csv</p>
            <div className="mt-3 flex flex-wrap justify-center gap-1">
              {["Representante", "Tipo Produto", "Meta", "Nome Mês"].map(c => <Badge key={c} variant="secondary" className="text-xs">{c}</Badge>)}
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileSpreadsheet className="h-4 w-4 text-primary" />
                <span className="text-sm font-medium">{fileName}</span>
                <Badge variant="outline">{data.length} linhas</Badge>
              </div>
              <Button variant="ghost" size="sm" onClick={() => { setData([]); setFileName(""); }}>Limpar</Button>
            </div>

            {unmatchedNames.length > 0 && (
              <div className="flex items-start gap-2 rounded-lg border border-destructive/50 bg-destructive/10 p-3">
                <AlertTriangle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
                <div className="text-sm text-destructive">
                  <strong>Representantes não encontrados:</strong> {unmatchedNames.join(", ")}
                </div>
              </div>
            )}

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

            <div className="rounded-lg border overflow-auto max-h-48">
              <Table>
                <TableHeader>
                  <TableRow>{columns.map(c => <TableHead key={c} className="text-xs whitespace-nowrap">{c}</TableHead>)}</TableRow>
                </TableHeader>
                <TableBody>
                  {previewRows.map((row, i) => (
                    <TableRow key={i}>
                      {columns.map(c => <TableCell key={c} className="text-xs whitespace-nowrap">{String(row[c] ?? "")}</TableCell>)}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => { onClose(); setData([]); setFileName(""); }}>Cancelar</Button>
          <Button onClick={handleImport} disabled={!data.length || importing}>
            {importing && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Importar {data.length} linhas
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default GoalImport;
