import { useState, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import {
  FileUp, Loader2, AlertTriangle, CheckCircle2, X, Pencil,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

// ── Types ──

export interface ExtractedOrderItem {
  descricao: string;
  tipo_maquina: string | null;
  marca: string | null;
  modelo: string | null;
  valor_fob_usd: number;
  quantidade: number;
  prazo_entrega: string | null;
  // Match fields (filled after matching)
  matchedModeloId?: string;
  matchedMachineName?: string;
  matchedMachineType?: string;
  matchedFobCost?: number;
}

export interface ExtractedOrder {
  numero_proposta: string | null;
  cliente_nome: string;
  cliente_contato: string | null;
  cliente_cnpj: string | null;
  representante_nome: string | null;
  data_pedido: string | null;
  tipo_venda: string | null;
  itens: ExtractedOrderItem[];
  valor_total_brl: number | null;
  valor_entrada_brl: number | null;
  parcelas: number | null;
  valor_parcela_brl: number | null;
  atma_valor: number | null;
  notas_comerciais: string | null;
  comando: string | null;
  // Match fields
  matchedEmpresaId?: string;
  matchedRepId?: string;
}

interface Props {
  userId: string;
  empresas: { id: string; nome: string; cidade: string | null }[];
  repOptions: { id: string; nome: string; comissao_padrao_pct: number; comissao_gestor_pct: number }[];
  modelos: { id: string; marca: string; modelo: string; tipo: string; custo_fob: number; preco_venda_fob: number }[];
  onImportComplete: (order: ExtractedOrder) => void;
  onClose: () => void;
  open: boolean;
}

// ── PDF Text Extraction (browser) ──

async function extractTextFromPdf(file: File): Promise<string> {
  const pdfjsLib = await import("pdfjs-dist");
  const { version } = pdfjsLib;
  pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${version}/pdf.worker.min.mjs`;

  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

  let fullText = "";
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const textContent = await page.getTextContent();
    const pageText = textContent.items
      .map((item: any) => item.str)
      .join(" ");
    fullText += pageText + "\n";
  }

  return fullText;
}

// ── Fuzzy match helpers ──

function normalize(s: string): string {
  return s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
}

function fuzzyMatch(needle: string, haystack: string): boolean {
  const n = normalize(needle);
  const h = normalize(haystack);
  return h.includes(n) || n.includes(h);
}

// ── Component ──

const PdfOrderImport = ({ userId, empresas, repOptions, modelos, onImportComplete, onClose, open }: Props) => {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [step, setStep] = useState<"upload" | "processing" | "preview">("upload");
  const [extractedOrder, setExtractedOrder] = useState<ExtractedOrder | null>(null);
  const [pdfFileName, setPdfFileName] = useState("");

  const resetState = () => {
    setStep("upload");
    setExtractedOrder(null);
    setPdfFileName("");
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleClose = () => {
    resetState();
    onClose();
  };

  // Match extracted data with existing database records
  const matchWithDatabase = useCallback((order: ExtractedOrder): ExtractedOrder => {
    const matched = { ...order };

    // Match empresa by name
    if (order.cliente_nome) {
      const emp = empresas.find(e => fuzzyMatch(order.cliente_nome, e.nome));
      if (emp) matched.matchedEmpresaId = emp.id;
    }

    // Match representante by name
    if (order.representante_nome) {
      const rep = repOptions.find(r => fuzzyMatch(order.representante_nome!, r.nome));
      if (rep) matched.matchedRepId = rep.id;
    }

    // Match items with catalog
    matched.itens = order.itens.map(item => {
      const matchedItem = { ...item };

      // Try matching by modelo name
      if (item.modelo) {
        const mod = modelos.find(m =>
          fuzzyMatch(item.modelo!, m.modelo) ||
          (item.marca && fuzzyMatch(item.marca, m.marca) && fuzzyMatch(item.modelo!, m.modelo))
        );
        if (mod) {
          matchedItem.matchedModeloId = mod.id;
          matchedItem.matchedMachineName = `${mod.marca} ${mod.modelo}`;
          matchedItem.matchedMachineType = mod.tipo;
          matchedItem.matchedFobCost = mod.custo_fob;
        }
      }

      return matchedItem;
    });

    return matched;
  }, [empresas, repOptions, modelos]);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.type !== "application/pdf") {
      toast({ title: "Formato inválido", description: "Selecione um arquivo PDF.", variant: "destructive" });
      return;
    }

    if (file.size > 20 * 1024 * 1024) {
      toast({ title: "Arquivo muito grande", description: "O PDF deve ter no máximo 20MB.", variant: "destructive" });
      return;
    }

    setPdfFileName(file.name);
    setStep("processing");

    try {
      // Step 1: Extract text from PDF in browser
      const pdfText = await extractTextFromPdf(file);

      if (pdfText.trim().length < 50) {
        toast({ title: "PDF sem texto", description: "O PDF parece ser uma imagem escaneada. Use um PDF com texto selecionável.", variant: "destructive" });
        setStep("upload");
        return;
      }

      // Step 2: Send to edge function for AI extraction
      const { data: fnData, error: fnError } = await supabase.functions.invoke("parse-order-pdf", {
        body: { pdfText },
      });

      if (fnError) {
        throw new Error(fnError.message || "Erro na extração");
      }

      if (fnData?.error) {
        throw new Error(fnData.error);
      }

      const order = fnData?.data as ExtractedOrder;
      if (!order || !order.itens || order.itens.length === 0) {
        throw new Error("Nenhum item encontrado no pedido.");
      }

      // Step 3: Match with database
      const matchedOrder = matchWithDatabase(order);
      setExtractedOrder(matchedOrder);
      setStep("preview");

      toast({ title: "PDF processado!", description: `${matchedOrder.itens.length} item(ns) extraído(s). Revise antes de importar.` });
    } catch (err: any) {
      console.error("PDF import error:", err);
      toast({
        title: "Erro ao processar PDF",
        description: err.message || "Erro desconhecido",
        variant: "destructive",
      });
      setStep("upload");
    }
  };

  const handleConfirmImport = () => {
    if (!extractedOrder) return;
    onImportComplete(extractedOrder);
    handleClose();
  };

  const formatUsd = (v: number) => `$ ${v.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const formatBrl = (v: number) => `R$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && handleClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileUp className="h-5 w-5 text-primary" />
            Importar Pedido via PDF
          </DialogTitle>
          <DialogDescription>
            Faça upload do PDF do pedido para preencher automaticamente a negociação.
          </DialogDescription>
        </DialogHeader>

        {/* STEP: Upload */}
        {step === "upload" && (
          <div className="flex flex-col items-center gap-4 py-8">
            <div className="w-24 h-24 rounded-2xl bg-primary/10 flex items-center justify-center">
              <FileUp className="h-10 w-10 text-primary" />
            </div>
            <p className="text-sm text-muted-foreground text-center max-w-sm">
              Selecione o PDF do pedido. O sistema irá extrair automaticamente os dados do cliente, máquina e valores.
            </p>
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf"
              className="hidden"
              onChange={handleFileSelect}
            />
            <Button onClick={() => fileInputRef.current?.click()} size="lg" className="font-semibold">
              <FileUp className="h-4 w-4 mr-2" />
              Selecionar PDF
            </Button>
          </div>
        )}

        {/* STEP: Processing */}
        {step === "processing" && (
          <div className="flex flex-col items-center gap-4 py-12">
            <Loader2 className="h-12 w-12 text-primary animate-spin" />
            <div className="text-center">
              <p className="font-medium text-foreground">Processando PDF...</p>
              <p className="text-sm text-muted-foreground mt-1">{pdfFileName}</p>
              <p className="text-xs text-muted-foreground mt-2">Extraindo texto e analisando com IA</p>
            </div>
          </div>
        )}

        {/* STEP: Preview */}
        {step === "preview" && extractedOrder && (
          <ScrollArea className="flex-1 max-h-[60vh] pr-4">
            <div className="space-y-4">
              {/* Header Info */}
              <div className="grid grid-cols-2 gap-3">
                <InfoField label="Nº Proposta" value={extractedOrder.numero_proposta} />
                <InfoField label="Data" value={extractedOrder.data_pedido} />
                <InfoField label="Tipo Venda" value={extractedOrder.tipo_venda} />
                <InfoField label="Comando" value={extractedOrder.comando} />
              </div>

              <Separator />

              {/* Cliente */}
              <div>
                <h4 className="text-sm font-semibold text-foreground mb-2">Cliente</h4>
                <div className="grid grid-cols-2 gap-3">
                  <InfoField label="Nome" value={extractedOrder.cliente_nome} />
                  <MatchBadge
                    label="Match no sistema"
                    matched={!!extractedOrder.matchedEmpresaId}
                    matchedName={empresas.find(e => e.id === extractedOrder.matchedEmpresaId)?.nome}
                  />
                  <InfoField label="CNPJ" value={extractedOrder.cliente_cnpj} />
                  <InfoField label="Contato" value={extractedOrder.cliente_contato} />
                </div>
              </div>

              <Separator />

              {/* Representante */}
              <div>
                <h4 className="text-sm font-semibold text-foreground mb-2">Representante</h4>
                <div className="grid grid-cols-2 gap-3">
                  <InfoField label="Nome" value={extractedOrder.representante_nome} />
                  <MatchBadge
                    label="Match no sistema"
                    matched={!!extractedOrder.matchedRepId}
                    matchedName={repOptions.find(r => r.id === extractedOrder.matchedRepId)?.nome}
                  />
                </div>
              </div>

              <Separator />

              {/* Items */}
              <div>
                <h4 className="text-sm font-semibold text-foreground mb-2">
                  Itens ({extractedOrder.itens.length})
                </h4>
                <div className="space-y-3">
                  {extractedOrder.itens.map((item, idx) => (
                    <Card key={idx} className="p-3 bg-secondary/30 border-border/50">
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <div>
                          <p className="text-sm font-medium text-foreground">{item.descricao}</p>
                          {item.marca && item.modelo && (
                            <p className="text-xs text-muted-foreground">{item.marca} — {item.modelo}</p>
                          )}
                        </div>
                        <Badge variant="secondary" className="text-xs shrink-0">
                          Qty: {item.quantidade}
                        </Badge>
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div>
                          <span className="text-muted-foreground">Valor FOB: </span>
                          <span className="font-medium">{formatUsd(item.valor_fob_usd)}</span>
                        </div>
                        {item.prazo_entrega && (
                          <div>
                            <span className="text-muted-foreground">Entrega: </span>
                            <span className="font-medium">{item.prazo_entrega}</span>
                          </div>
                        )}
                        <div className="col-span-2">
                          <MatchBadge
                            label="Catálogo"
                            matched={!!item.matchedModeloId}
                            matchedName={item.matchedMachineName}
                          />
                        </div>
                      </div>
                    </Card>
                  ))}
                </div>
              </div>

              <Separator />

              {/* Financial summary */}
              <div>
                <h4 className="text-sm font-semibold text-foreground mb-2">Resumo Financeiro</h4>
                <div className="grid grid-cols-2 gap-3">
                  {extractedOrder.valor_total_brl != null && (
                    <InfoField label="Total BRL" value={formatBrl(extractedOrder.valor_total_brl)} />
                  )}
                  {extractedOrder.valor_entrada_brl != null && (
                    <InfoField label="Entrada" value={formatBrl(extractedOrder.valor_entrada_brl)} />
                  )}
                  {extractedOrder.parcelas != null && extractedOrder.valor_parcela_brl != null && (
                    <InfoField label="Parcelas" value={`${extractedOrder.parcelas}x de ${formatBrl(extractedOrder.valor_parcela_brl)}`} />
                  )}
                  {extractedOrder.atma_valor != null && (
                    <InfoField label="ATMA" value={formatBrl(extractedOrder.atma_valor)} />
                  )}
                </div>
              </div>

              {extractedOrder.notas_comerciais && (
                <>
                  <Separator />
                  <div>
                    <h4 className="text-sm font-semibold text-foreground mb-1">Notas</h4>
                    <p className="text-xs text-muted-foreground">{extractedOrder.notas_comerciais}</p>
                  </div>
                </>
              )}
            </div>
          </ScrollArea>
        )}

        {/* Footer */}
        {step === "preview" && (
          <DialogFooter className="mt-4 flex gap-2">
            <Button variant="outline" onClick={resetState}>
              <X className="h-4 w-4 mr-1" />
              Novo PDF
            </Button>
            <Button onClick={handleConfirmImport} className="font-semibold">
              <Pencil className="h-4 w-4 mr-1" />
              Preencher Formulário
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
};

// ── Small sub-components ──

const InfoField = ({ label, value }: { label: string; value: string | null | undefined }) => (
  <div>
    <span className="text-xs text-muted-foreground">{label}</span>
    <p className="text-sm font-medium text-foreground">{value || "—"}</p>
  </div>
);

const MatchBadge = ({ label, matched, matchedName }: { label: string; matched: boolean; matchedName?: string }) => (
  <div>
    <span className="text-xs text-muted-foreground">{label}</span>
    <div className="flex items-center gap-1.5 mt-0.5">
      {matched ? (
        <>
          <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />
          <span className="text-xs text-green-600 font-medium">{matchedName}</span>
        </>
      ) : (
        <>
          <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />
          <span className="text-xs text-amber-600">Não encontrado</span>
        </>
      )}
    </div>
  </div>
);

export default PdfOrderImport;
