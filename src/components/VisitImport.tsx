import React, { useState, useCallback } from "react";
import * as XLSX from "xlsx";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Upload, FileSpreadsheet, AlertTriangle, CheckCircle2 } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";

interface Props {
  userId: string;
  reps: { id: string; nome: string }[];
  open: boolean;
  onClose: () => void;
  onImported: () => void;
}

interface ParsedRow {
  data_visita: string;
  cliente: string;
  cnpj: string;
  assunto: string;
  descricao: string;
  valid: boolean;
  reason?: string;
}

const normalize = (s: string) => s?.toString().trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "") ?? "";

const EXPECTED_COLS = ["data modificação", "data modificacao", "assunto", "cnpj", "cliente", "descrição", "descricao"];

const findCol = (headers: string[], ...names: string[]): number =>
  headers.findIndex((h) => names.some((n) => normalize(h).includes(n)));

const hashRow = (row: ParsedRow): string => {
  const str = `${row.data_visita}|${normalize(row.cliente)}|${normalize(row.assunto)}`;
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash + str.charCodeAt(i)) | 0;
  }
  return Math.abs(hash).toString(36);
};

const parseExcelDate = (v: any): string | null => {
  if (!v) return null;
  if (typeof v === "number") {
    const d = XLSX.SSF.parse_date_code(v);
    if (d) return `${d.y}-${String(d.m).padStart(2, "0")}-${String(d.d).padStart(2, "0")}`;
  }
  const s = String(v).trim();
  const isoMatch = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (isoMatch) return isoMatch[0];
  const brMatch = s.match(/^(\d{2})\/(\d{2})\/(\d{4})/);
  if (brMatch) return `${brMatch[3]}-${brMatch[2]}-${brMatch[1]}`;
  const d = new Date(s);
  if (!isNaN(d.getTime())) return d.toISOString().slice(0, 10);
  return null;
};

const VisitImport = ({ userId, reps, open, onClose, onImported }: Props) => {
  const [rows, setRows] = useState<ParsedRow[]>([]);
  const [selectedRep, setSelectedRep] = useState<string>("");
  const [importing, setImporting] = useState(false);
  const [fileName, setFileName] = useState("");

  const validRows = rows.filter((r) => r.valid);

  const handleFile = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);

    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const wb = XLSX.read(ev.target?.result, { type: "array", cellDates: false });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const raw: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "" });
        if (raw.length < 2) { toast.error("Planilha vazia ou sem dados"); return; }

        const headers = raw[0].map((h: any) => String(h));
        const iData = findCol(headers, "data modifica");
        const iAssunto = findCol(headers, "assunto");
        const iCnpj = findCol(headers, "cnpj");
        const iCliente = findCol(headers, "cliente");
        const iDesc = findCol(headers, "descri");

        if (iData < 0 || iCliente < 0) {
          toast.error("Planilha fora do padrão. Colunas obrigatórias: 'Data Modificação' e 'Cliente'");
          return;
        }

        const parsed: ParsedRow[] = [];
        for (let i = 1; i < raw.length; i++) {
          const r = raw[i];
          if (!r || r.every((c: any) => !c && c !== 0)) continue;

          const dataStr = parseExcelDate(r[iData]);
          const cliente = String(r[iCliente] ?? "").trim();
          const cnpj = iCnpj >= 0 ? String(r[iCnpj] ?? "").trim() : "";
          const assunto = iAssunto >= 0 ? String(r[iAssunto] ?? "").trim() : "";
          const descricao = iDesc >= 0 ? String(r[iDesc] ?? "").trim() : "";

          let valid = true;
          let reason = "";
          if (!dataStr) { valid = false; reason = "Data inválida"; }
          else if (!cliente) { valid = false; reason = "Cliente vazio"; }

          parsed.push({ data_visita: dataStr || "", cliente, cnpj, assunto, descricao, valid, reason });
        }

        if (parsed.length === 0) { toast.error("Nenhum registro encontrado na planilha"); return; }
        setRows(parsed);
        toast.success(`${parsed.length} registros lidos, ${parsed.filter((r) => r.valid).length} válidos`);
      } catch {
        toast.error("Erro ao ler o arquivo. Verifique se é um .xlsx válido");
      }
    };
    reader.readAsArrayBuffer(file);
    e.target.value = "";
  }, []);

  const getWeekNumber = (d: Date): number => {
    const start = new Date(d.getFullYear(), 0, 1);
    const diff = d.getTime() - start.getTime() + (start.getTimezoneOffset() - d.getTimezoneOffset()) * 60000;
    return Math.ceil((diff / 86400000 + start.getDay() + 1) / 7);
  };

  const handleImport = async () => {
    if (!selectedRep) { toast.error("Selecione o representante"); return; }
    if (validRows.length === 0) { toast.error("Nenhuma linha válida para importar"); return; }

    setImporting(true);
    try {
      // 1. Build records and deduplicate within the file itself
      const seen = new Set<string>();
      const uniqueRecords: { user_id: string; representative_id: string; data_visita: string; cliente: string; cnpj: string | null; assunto: string | null; descricao: string | null; hash_linha: string }[] = [];
      let dupsInFile = 0;

      for (const r of validRows) {
        const hash = hashRow(r);
        if (seen.has(hash)) { dupsInFile++; continue; }
        seen.add(hash);
        uniqueRecords.push({
          user_id: userId,
          representative_id: selectedRep,
          data_visita: r.data_visita,
          cliente: r.cliente,
          cnpj: r.cnpj || null,
          assunto: r.assunto || null,
          descricao: r.descricao || null,
          hash_linha: hash,
        });
      }

      // 2. Fetch existing hashes for this user+rep to skip already-imported rows
      const { data: existingRows, error: fetchErr } = await supabase
        .from("visitas_importadas" as any)
        .select("hash_linha")
        .eq("user_id", userId)
        .eq("representative_id", selectedRep);
      if (fetchErr) throw fetchErr;

      const existingHashes = new Set((existingRows as any[] || []).map((r: any) => r.hash_linha));
      const newRecords = uniqueRecords.filter((r) => !existingHashes.has(r.hash_linha));
      const alreadyExisted = uniqueRecords.length - newRecords.length;

      // 3. Insert only truly new records in batches
      let inserted = 0;
      const BATCH = 50;
      for (let i = 0; i < newRecords.length; i += BATCH) {
        const batch = newRecords.slice(i, i + BATCH);
        const { data, error } = await supabase
          .from("visitas_importadas" as any)
          .insert(batch as any)
          .select("id");
        if (error) {
          // Handle rare race condition where constraint catches a duplicate
          if (error.code === "23505") {
            continue; // skip batch with conflict, move on
          }
          throw error;
        }
        inserted += (data as any[] || []).length;
      }

      // 4. ALWAYS recalculate weekly_visits from the full source of truth
      const { data: allVisits } = await supabase
        .from("visitas_importadas" as any)
        .select("data_visita")
        .eq("user_id", userId)
        .eq("representative_id", selectedRep);

      // Delete existing weekly_visits for this rep
      await supabase
        .from("weekly_visits")
        .delete()
        .eq("user_id", userId)
        .eq("representative_id", selectedRep);

      if (allVisits && allVisits.length > 0) {
        const weekTotals: Record<string, number> = {};
        for (const v of allVisits as any[]) {
          const d = new Date(v.data_visita + "T12:00:00");
          const ano = d.getFullYear();
          const semana = getWeekNumber(d);
          const key = `${ano}-${semana}`;
          weekTotals[key] = (weekTotals[key] || 0) + 1;
        }

        const weekRecords = Object.entries(weekTotals).map(([key, qty]) => {
          const [ano, semana] = key.split("-").map(Number);
          return { user_id: userId, representative_id: selectedRep, ano, semana, quantidade: qty, meta: 16 };
        });
        if (weekRecords.length > 0) {
          await supabase.from("weekly_visits").insert(weekRecords);
        }
      }

      // 5. Clear feedback
      const parts: string[] = [];
      if (inserted > 0) parts.push(`${inserted} visitas importadas`);
      if (alreadyExisted > 0) parts.push(`${alreadyExisted} já existentes`);
      if (dupsInFile > 0) parts.push(`${dupsInFile} duplicadas no arquivo`);
      if (inserted === 0 && alreadyExisted > 0) {
        toast.info(parts.join(", ") + " — weekly_visits recalculado");
      } else {
        toast.success(parts.join(", "));
      }

      setRows([]);
      setFileName("");
      onImported();
      onClose();
    } catch (err: any) {
      toast.error("Erro na importação: " + (err.message || "erro desconhecido"));
    } finally {
      setImporting(false);
    }
  };

  const handleClose = () => {
    setRows([]);
    setFileName("");
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && handleClose()}>
      <DialogContent className="max-w-3xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5 text-primary" />
            Importar Visitas por Planilha
            <Badge variant="outline" className="text-[10px] ml-2 font-mono">v3-insert</Badge>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 flex-1 overflow-hidden flex flex-col">
          {/* File upload */}
          {rows.length === 0 && (
            <div className="border-2 border-dashed border-muted-foreground/30 rounded-lg p-8 text-center">
              <Upload className="h-10 w-10 mx-auto mb-3 text-muted-foreground" />
              <p className="text-sm text-muted-foreground mb-3">
                Arraste ou selecione o arquivo .xlsx com as colunas:<br />
                <strong>Data Modificação, Assunto, CNPJ, Cliente, Descrição</strong>
              </p>
              <label className="cursor-pointer">
                <Button variant="outline" asChild>
                  <span>Selecionar Arquivo</span>
                </Button>
                <input type="file" accept=".xlsx,.xls" className="hidden" onChange={handleFile} />
              </label>
            </div>
          )}

          {/* Rep selector + stats */}
          {rows.length > 0 && (
            <>
              <div className="flex flex-wrap items-end gap-4">
                <div className="space-y-1.5">
                  <Label className="text-xs">Representante</Label>
                  <Select value={selectedRep} onValueChange={setSelectedRep}>
                    <SelectTrigger className="w-[220px] h-9">
                      <SelectValue placeholder="Selecione o representante" />
                    </SelectTrigger>
                    <SelectContent>
                      {reps.map((r) => (
                        <SelectItem key={r.id} value={r.id}>{r.nome}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex gap-2">
                  <Badge variant="secondary" className="text-xs">
                    <CheckCircle2 className="h-3 w-3 mr-1" /> {validRows.length} válidos
                  </Badge>
                  {rows.length - validRows.length > 0 && (
                    <Badge variant="destructive" className="text-xs">
                      <AlertTriangle className="h-3 w-3 mr-1" /> {rows.length - validRows.length} inválidos
                    </Badge>
                  )}
                </div>
                <p className="text-xs text-muted-foreground ml-auto">{fileName}</p>
              </div>

              {/* Preview table */}
              <ScrollArea className="flex-1 border rounded-md max-h-[400px]">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-xs w-8">#</TableHead>
                      <TableHead className="text-xs">Data</TableHead>
                      <TableHead className="text-xs">Cliente</TableHead>
                      <TableHead className="text-xs">CNPJ</TableHead>
                      <TableHead className="text-xs">Assunto</TableHead>
                      <TableHead className="text-xs">Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rows.slice(0, 100).map((r, i) => (
                      <TableRow key={i} className={!r.valid ? "opacity-50" : ""}>
                        <TableCell className="text-xs text-muted-foreground">{i + 1}</TableCell>
                        <TableCell className="text-xs">{r.data_visita || "—"}</TableCell>
                        <TableCell className="text-xs font-medium">{r.cliente || "—"}</TableCell>
                        <TableCell className="text-xs">{r.cnpj || "—"}</TableCell>
                        <TableCell className="text-xs max-w-[200px] truncate">{r.assunto || "—"}</TableCell>
                        <TableCell>
                          {r.valid ? (
                            <Badge variant="outline" className="text-xs text-green-600">OK</Badge>
                          ) : (
                            <Badge variant="destructive" className="text-xs">{r.reason}</Badge>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                {rows.length > 100 && (
                  <p className="text-xs text-muted-foreground text-center py-2">
                    Mostrando 100 de {rows.length} registros
                  </p>
                )}
              </ScrollArea>
            </>
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={handleClose}>Cancelar</Button>
          {rows.length > 0 && (
            <Button onClick={handleImport} disabled={importing || !selectedRep || validRows.length === 0}>
              {importing ? "Importando..." : `Importar ${validRows.length} registros`}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default VisitImport;
