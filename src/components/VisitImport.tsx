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
      const records = validRows.map((r) => ({
        user_id: userId,
        representative_id: selectedRep,
        data_visita: r.data_visita,
        cliente: r.cliente,
        cnpj: r.cnpj || null,
        assunto: r.assunto || null,
        descricao: r.descricao || null,
        hash_linha: hashRow(r),
      }));
      // Build a set of hashes to track which ones actually get inserted
      const allHashes = records.map(r => r.hash_linha);

      // Insert in batches, skipping duplicates
      let inserted = 0;
      const insertedHashes = new Set<string>();
      const BATCH = 50;
      for (let i = 0; i < records.length; i += BATCH) {
        const batch = records.slice(i, i + BATCH);
        const { data, error } = await supabase
          .from("visitas_importadas" as any)
          .upsert(batch as any, { onConflict: "user_id,hash_linha", ignoreDuplicates: true })
          .select("hash_linha");
        if (error) throw error;
        const returned = (data as any[]) || [];
        inserted += returned.length;
        returned.forEach((r: any) => insertedHashes.add(r.hash_linha));
      }
      const skipped = records.length - inserted;

      // Aggregate ONLY actually inserted visits by week
      const weekGroups: Record<string, number> = {};
      for (let i = 0; i < validRows.length; i++) {
        const hash = allHashes[i];
        if (!insertedHashes.has(hash)) continue; // skip duplicates
        const r = validRows[i];
        const d = new Date(r.data_visita + "T12:00:00");
        const ano = d.getFullYear();
        const semana = getWeekNumber(d);
        const key = `${ano}-${semana}`;
        weekGroups[key] = (weekGroups[key] || 0) + 1;
      }

      for (const [key, qty] of Object.entries(weekGroups)) {
        const [ano, semana] = key.split("-").map(Number);
        const { data: existing } = await supabase
          .from("weekly_visits")
          .select("id, quantidade")
          .eq("user_id", userId)
          .eq("representative_id", selectedRep)
          .eq("ano", ano)
          .eq("semana", semana)
          .maybeSingle();

        if (existing) {
          await supabase
            .from("weekly_visits")
            .update({ quantidade: existing.quantidade + qty })
            .eq("id", existing.id);
        } else {
          await supabase
            .from("weekly_visits")
            .insert({ user_id: userId, representative_id: selectedRep, ano, semana, quantidade: qty, meta: 16 });
        }
      }

      toast.success(`${inserted} visitas importadas${skipped > 0 ? `, ${skipped} duplicadas ignoradas` : ""}`);
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
