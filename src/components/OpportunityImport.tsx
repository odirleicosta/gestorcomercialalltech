import { useState, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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

function normalize(s: string): string {
  return s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
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

const OpportunityImport = ({ userId, reps, open, onClose, onImported }: Props) => {
  const { toast } = useToast();
  const [data, setData] = useState<Record<string, string>[]>([]);
  const [fileName, setFileName] = useState("");
  const [importing, setImporting] = useState(false);
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
      const grouped: Record<string, { repId: string; ano: number; mes: number; qty: number }> = {};
      let skip = 0;
      for (const row of data) {
        const name = getFieldCI(row, "Proprietario Nome", "Proprietário Nome");
        const rep = findRep(name, reps);
        if (!rep) { skip++; continue; }
        const dateVal = getFieldCI(row, "Data Criação", "Data Criacao", "Data");
        const d = new Date(dateVal);
        if (isNaN(d.getTime())) { skip++; continue; }
        const key = `${rep.id}-${d.getFullYear()}-${d.getMonth() + 1}`;
        if (!grouped[key]) grouped[key] = { repId: rep.id, ano: d.getFullYear(), mes: d.getMonth() + 1, qty: 0 };
        grouped[key].qty += 1;
      }
      let ok = 0;
      for (const g of Object.values(grouped)) {
        const { error } = await supabase.from("monthly_opportunities").upsert(
          { representative_id: g.repId, ano: g.ano, mes: g.mes, quantidade: g.qty, user_id: userId },
          { onConflict: "user_id,representative_id,ano,mes" }
        );
        if (!error) ok++; else skip++;
      }
      toast({ title: `Oportunidades importadas: ${ok} registros${skip ? ` (${skip} ignorados)` : ""}` });
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
    ? [...new Set(data.map(r => getFieldCI(r, "Proprietario Nome", "Proprietário Nome")).filter(n => n && !findRep(n, reps)))]
    : [];

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) { onClose(); setData([]); setFileName(""); } }}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Importar Oportunidades via Planilha</DialogTitle>
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
              {["Proprietario Nome", "Data Criação"].map(c => <Badge key={c} variant="secondary" className="text-xs">{c}</Badge>)}
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

            <div className="rounded-lg border overflow-auto max-h-48">
              <Table>
                <TableHeader>
                  <TableRow>{columns.map(c => <TableHead key={c} className="text-xs whitespace-nowrap">{c}</TableHead>)}</TableRow>
                </TableHeader>
                <TableBody>
                  {previewRows.map((row, i) => (
                    <TableRow key={i}>
                      {columns.map(c => <TableCell key={c} className="text-xs whitespace-nowrap">{typeof row[c] === "object" && row[c] !== null ? String(row[c]) : String(row[c] ?? "")}</TableCell>)}
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

export default OpportunityImport;
