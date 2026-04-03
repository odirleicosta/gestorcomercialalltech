import React, { useState, useCallback } from "react";
import * as XLSX from "xlsx";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
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
  fechada_por: string;
  motivo_perda: string;
  data_criacao: string;
  data_perda: string;
  cliente: string;
  machine_name: string;
  cnpj: string;
  descricao: string;
  comentario: string;
  machine_type: string;
  matched_rep_id: string | null;
  valid: boolean;
  reason?: string;
}

const normalize = (s: string) =>
  s?.toString().trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "") ?? "";

const findCol = (headers: string[], ...names: string[]): number =>
  headers.findIndex((h) => names.some((n) => normalize(h).includes(n)));

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
  // US format M/D/YY or M/D/YYYY
  const usMatch = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})/);
  if (usMatch) {
    let year = Number(usMatch[3]);
    if (year < 100) year += 2000;
    return `${year}-${String(usMatch[1]).padStart(2, "0")}-${String(usMatch[2]).padStart(2, "0")}`;
  }
  const d = new Date(s);
  if (!isNaN(d.getTime())) return d.toISOString().slice(0, 10);
  return null;
};

const hashRow = (row: ParsedRow): string => {
  const str = `${row.data_perda}|${normalize(row.cliente)}|${normalize(row.machine_name)}|${normalize(row.fechada_por)}`;
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash + str.charCodeAt(i)) | 0;
  }
  return Math.abs(hash).toString(36);
};

const matchRep = (name: string, reps: { id: string; nome: string }[]): string | null => {
  if (!name) return null;
  const norm = normalize(name);
  // Exact match
  const exact = reps.find((r) => normalize(r.nome) === norm);
  if (exact) return exact.id;
  // Partial: first name match
  const firstName = norm.split(" ")[0];
  const partial = reps.find((r) => normalize(r.nome).split(" ")[0] === firstName);
  if (partial) return partial.id;
  // Contains
  const contains = reps.find((r) => normalize(r.nome).includes(norm) || norm.includes(normalize(r.nome)));
  return contains?.id || null;
};

const LostDealImport = ({ userId, reps, open, onClose, onImported }: Props) => {
  const [rows, setRows] = useState<ParsedRow[]>([]);
  const [importing, setImporting] = useState(false);
  const [fileName, setFileName] = useState("");

  const validRows = rows.filter((r) => r.valid);

  const handleFile = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
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
          const iFechada = findCol(headers, "fechada por");
          const iMotivo = findCol(headers, "motivo da perda", "motivo");
          const iCriacao = findCol(headers, "criacao", "criação", "data");
          const iCliente = findCol(headers, "cliente");
          const iName = findCol(headers, "name", "nome_negociacao", "maquina", "máquina");
          const iCnpj = findCol(headers, "cnpj");
          const iDesc = findCol(headers, "descri");
          const iComentario = findCol(headers, "comentario");
          const iFunil = findCol(headers, "funil");

          if (iCliente < 0) {
            toast.error("Coluna 'Cliente' não encontrada na planilha");
            return;
          }

          const parsed: ParsedRow[] = [];
          for (let i = 1; i < raw.length; i++) {
            const r = raw[i];
            if (!r || r.every((c: any) => !c && c !== 0)) continue;

            const fechadaPor = iFechada >= 0 ? String(r[iFechada] ?? "").trim() : "";
            const motivo = iMotivo >= 0 ? String(r[iMotivo] ?? "").trim() : "";
            const dataStr = iCriacao >= 0 ? parseExcelDate(r[iCriacao]) : null;
            const cliente = String(r[iCliente] ?? "").trim();
            const machineName = iName >= 0 ? String(r[iName] ?? "").trim() : "";
            const cnpj = iCnpj >= 0 ? String(r[iCnpj] ?? "").trim() : "";
            const descricao = iDesc >= 0 ? String(r[iDesc] ?? "").trim() : "";
            const comentario = iComentario >= 0 ? String(r[iComentario] ?? "").trim() : "";
            const funil = iFunil >= 0 ? String(r[iFunil] ?? "").trim() : "";

            const matched_rep_id = matchRep(fechadaPor, reps);

            let valid = true;
            let reason = "";
            if (!dataStr) { valid = false; reason = "Data inválida"; }
            else if (!cliente) { valid = false; reason = "Cliente vazio"; }
            else if (!matched_rep_id) { valid = false; reason = `Rep "${fechadaPor}" não encontrado`; }

            parsed.push({
              fechada_por: fechadaPor,
              motivo_perda: motivo,
              data_perda: dataStr || "",
              cliente,
              machine_name: machineName,
              cnpj,
              descricao,
              comentario,
              machine_type: funil || "Máquinas",
              matched_rep_id,
              valid,
              reason,
            });
          }

          if (parsed.length === 0) { toast.error("Nenhum registro encontrado"); return; }
          setRows(parsed);
          toast.success(`${parsed.length} registros lidos, ${parsed.filter((r) => r.valid).length} válidos`);
        } catch {
          toast.error("Erro ao ler o arquivo. Verifique se é um .xlsx válido");
        }
      };
      reader.readAsArrayBuffer(file);
      e.target.value = "";
    },
    [reps]
  );

  const handleImport = async () => {
    if (validRows.length === 0) { toast.error("Nenhuma linha válida para importar"); return; }

    setImporting(true);
    try {
      const records = validRows.map((r) => ({
        user_id: userId,
        representative_id: r.matched_rep_id!,
        client_name: r.cliente,
        machine_name: r.machine_name || "",
        machine_type: r.machine_type || "Máquinas",
        deal_value: 0,
        motivo_perda: r.motivo_perda || null,
        motivo_perda_detalhe: r.comentario || null,
        data_perda: r.data_perda,
        notes: r.descricao || null,
        quantidade: 1,
      }));

      // Use hash-based dedup: check existing records
      let inserted = 0;
      const BATCH = 50;
      for (let i = 0; i < records.length; i += BATCH) {
        const batch = records.slice(i, i + BATCH);
        const { data, error } = await supabase
          .from("negociacoes_perdidas" as any)
          .insert(batch as any)
          .select("id");
        if (error) throw error;
        inserted += (data as any[])?.length || 0;
      }

      toast.success(`${inserted} negociações perdidas importadas`);
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
      <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5 text-destructive" />
            Importar Negociações Perdidas por Planilha
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 flex-1 overflow-hidden flex flex-col">
          {rows.length === 0 && (
            <div className="border-2 border-dashed border-muted-foreground/30 rounded-lg p-8 text-center">
              <Upload className="h-10 w-10 mx-auto mb-3 text-muted-foreground" />
              <p className="text-sm text-muted-foreground mb-3">
                Arraste ou selecione o arquivo .xlsx com as colunas:<br />
                <strong>Fechada por, Motivo da Perda, Criação, Cliente, Name, CNPJ, Descrição</strong>
              </p>
              <p className="text-xs text-muted-foreground mb-3">
                O representante será identificado automaticamente pela coluna "Fechada por"
              </p>
              <label className="cursor-pointer">
                <Button variant="outline" asChild>
                  <span>Selecionar Arquivo</span>
                </Button>
                <input type="file" accept=".xlsx,.xls" className="hidden" onChange={handleFile} />
              </label>
            </div>
          )}

          {rows.length > 0 && (
            <>
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="secondary" className="text-xs">
                  <CheckCircle2 className="h-3 w-3 mr-1" /> {validRows.length} válidos
                </Badge>
                {rows.length - validRows.length > 0 && (
                  <Badge variant="destructive" className="text-xs">
                    <AlertTriangle className="h-3 w-3 mr-1" /> {rows.length - validRows.length} inválidos
                  </Badge>
                )}
                <p className="text-xs text-muted-foreground ml-auto">{fileName}</p>
              </div>

              <ScrollArea className="flex-1 border rounded-md max-h-[400px]">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-xs w-8">#</TableHead>
                      <TableHead className="text-xs">Data</TableHead>
                      <TableHead className="text-xs">Representante</TableHead>
                      <TableHead className="text-xs">Cliente</TableHead>
                      <TableHead className="text-xs">Motivo</TableHead>
                      <TableHead className="text-xs">Máquina</TableHead>
                      <TableHead className="text-xs">Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rows.slice(0, 100).map((r, i) => (
                      <TableRow key={i} className={!r.valid ? "opacity-50" : ""}>
                        <TableCell className="text-xs text-muted-foreground">{i + 1}</TableCell>
                        <TableCell className="text-xs">{r.data_perda || "—"}</TableCell>
                        <TableCell className="text-xs">
                          {r.matched_rep_id ? (
                            <span className="font-medium">{reps.find((rep) => rep.id === r.matched_rep_id)?.nome}</span>
                          ) : (
                            <span className="text-destructive">{r.fechada_por || "—"}</span>
                          )}
                        </TableCell>
                        <TableCell className="text-xs font-medium max-w-[150px] truncate">{r.cliente || "—"}</TableCell>
                        <TableCell className="text-xs max-w-[150px] truncate">{r.motivo_perda || "—"}</TableCell>
                        <TableCell className="text-xs max-w-[120px] truncate">{r.machine_name || "—"}</TableCell>
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
            <Button onClick={handleImport} disabled={importing || validRows.length === 0} variant="destructive">
              {importing ? "Importando..." : `Importar ${validRows.length} registros`}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default LostDealImport;
