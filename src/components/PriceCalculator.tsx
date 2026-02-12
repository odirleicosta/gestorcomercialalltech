import { useState, useMemo, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  DollarSign, Percent, TrendingUp, Package, Receipt,
  Save, AlertTriangle, History, Calculator, RotateCcw, User, StickyNote,
  Building2, Plus, Wrench, Copy,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import CalculationHistory from "@/components/CalculationHistory";
import ClientManager, { loadClients, saveClients, type Client } from "@/components/ClientManager";
import MachineManager, { loadMachines, saveMachines, type Machine } from "@/components/MachineManager";
import MachineCatalog, { loadCatalog, saveCatalog, type CatalogMachine } from "@/components/MachineCatalog";
import { seedCatalogIfEmpty } from "@/data/machineCatalogSeed";

export interface SavedCalculation {
  id: string;
  machine_name: string;
  fob_cost: number;
  estimated_tax_percent: number;
  estimated_tax_value: number;
  desired_margin_percent: number;
  selling_price: number;
  estimated_profit: number;
  real_tax_value: number | null;
  real_profit: number | null;
  real_margin_percent: number | null;
  min_acceptable_margin: number;
  observation: string | null;
  created_at: string;
}

const STORAGE_KEY = "price-calc-history";

const loadHistory = (): SavedCalculation[] => {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
  } catch { return []; }
};

const PriceCalculator = () => {
  const { toast } = useToast();

  const [machineName, setMachineName] = useState("");
  const [clientName, setClientName] = useState("");
  const [fobCost, setFobCost] = useState("");
  const [dollarRate, setDollarRate] = useState("");
  const [estimatedTaxPercent, setEstimatedTaxPercent] = useState("");
  const [desiredMargin, setDesiredMargin] = useState("");
  const [minMargin, setMinMargin] = useState("");

  const [realTaxValue, setRealTaxValue] = useState("");
  const [observation, setObservation] = useState("");
  const [notes, setNotes] = useState("");

  const [activeTab, setActiveTab] = useState("simulation");
  const [history, setHistory] = useState<SavedCalculation[]>(loadHistory);
  const [clients, setClients] = useState<Client[]>(loadClients);
  const [showClientSuggestions, setShowClientSuggestions] = useState(false);
  const [machines, setMachines] = useState<Machine[]>(loadMachines);
  const [showMachineSuggestions, setShowMachineSuggestions] = useState(false);
  const [catalog, setCatalog] = useState<CatalogMachine[]>(() => seedCatalogIfEmpty());
  const [showCatalogSuggestions, setShowCatalogSuggestions] = useState(false);

  const filteredClients = clients.filter((c) =>
    c.name.toLowerCase().includes(clientName.toLowerCase())
  );
  const filteredMachines = machines.filter((m) =>
    m.name.toLowerCase().includes(machineName.toLowerCase())
  );
  const filteredCatalog = catalog.filter((m) =>
    m.modelo.toLowerCase().includes(machineName.toLowerCase()) ||
    m.marca.toLowerCase().includes(machineName.toLowerCase()) ||
    m.tipo.toLowerCase().includes(machineName.toLowerCase())
  );

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(history));
  }, [history]);

  const simulation = useMemo(() => {
    const fob = parseFloat(fobCost) || 0;
    const dollar = parseFloat(dollarRate) || 0;
    const taxPct = parseFloat(estimatedTaxPercent) || 0;
    const margin = parseFloat(desiredMargin) || 0;
    if (fob <= 0) return null;

    const t = taxPct / 100;
    const m = margin / 100;
    if (m >= 1) return null;

    // Impostos = repasse (por fora, sem margem)
    const estimatedTaxValue = fob * t;

    // Margem por dentro aplicada SOMENTE sobre o FOB
    const factor = 1 - m;
    const basePrice = fob / factor;         // preço base da máquina
    const profit = basePrice - fob;          // lucro da máquina
    const finalPrice = basePrice + estimatedTaxValue; // preço final ao cliente

    // Margem verificada = lucro / preço base (sem impostos)
    const effectiveMargin = basePrice > 0 ? (profit / basePrice) * 100 : 0;
    const marginCheck = basePrice > 0 ? Math.abs(effectiveMargin - margin) < 0.01 : true;

    // Conversão para BRL
    const hasDollar = dollar > 0;
    const fobBrl = hasDollar ? fob * dollar : fob;
    const estimatedTaxBrl = hasDollar ? estimatedTaxValue * dollar : estimatedTaxValue;
    const basePriceBrl = hasDollar ? basePrice * dollar : basePrice;
    const profitBrl = hasDollar ? profit * dollar : profit;
    const finalPriceBrl = hasDollar ? finalPrice * dollar : finalPrice;

    // Margem mínima
    const minMg = parseFloat(minMargin) || 0;
    const minM = minMg / 100;
    const minFactor = 1 - minM;
    const minBasePrice = minM < 1 ? fob / minFactor : 0;
    const minProfit = minBasePrice - fob;
    const minFinalPrice = minBasePrice + estimatedTaxValue;
    const minBasePriceBrl = hasDollar ? minBasePrice * dollar : minBasePrice;
    const minProfitBrl = hasDollar ? minProfit * dollar : minProfit;
    const minFinalPriceBrl = hasDollar ? minFinalPrice * dollar : minFinalPrice;

    return {
      fob, fobBrl, estimatedTaxValue, estimatedTaxBrl,
      basePrice, basePriceBrl, profit, profitBrl,
      finalPrice, finalPriceBrl,
      effectiveMargin, factor, marginCheck,
      minBasePrice, minBasePriceBrl, minProfit, minProfitBrl,
      minFinalPrice, minFinalPriceBrl, minMarginPct: minMg,
      hasDollar,
    };
  }, [fobCost, dollarRate, estimatedTaxPercent, desiredMargin, minMargin]);

  const nationalized = useMemo(() => {
    if (!simulation) return null;
    const realTaxPct = parseFloat(realTaxValue);
    if (isNaN(realTaxPct) || realTaxPct <= 0) return null;
    const divisor = 1 - realTaxPct / 100;
    const nationalizedPrice = divisor > 0 ? simulation.finalPriceBrl / divisor : simulation.finalPriceBrl;
    const dollar = parseFloat(dollarRate) || 0;
    const nationalizedPriceUsd = dollar > 0 ? nationalizedPrice / dollar : 0;
    const realTaxAbsolute = nationalizedPrice - simulation.finalPriceBrl;
    const realTaxAbsoluteUsd = dollar > 0 ? realTaxAbsolute / dollar : 0;
    const realTotalCost = simulation.fobBrl + realTaxAbsolute;
    const realProfitAdjusted = nationalizedPrice - simulation.fobBrl - realTaxAbsolute;
    const realMarginPct = simulation.basePriceBrl > 0 ? (realProfitAdjusted / simulation.basePriceBrl) * 100 : 0;
    const taxDifference = realTaxAbsolute - simulation.estimatedTaxBrl;
    return { nationalizedPrice, nationalizedPriceUsd, realTotalCost, realProfit: realProfitAdjusted, realMarginPct, taxDifference, realTaxAbsolute, realTaxAbsoluteUsd, realTaxPct, hasDollar: simulation.hasDollar };
  }, [simulation, realTaxValue, dollarRate]);

  const minMarginVal = parseFloat(minMargin) || 0;
  const isBelowMinMargin = nationalized
    ? nationalized.realMarginPct < minMarginVal && minMarginVal > 0
    : false;

  const formatCurrency = (v: number) =>
    v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  const formatUsd = (v: number) =>
    `US$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const formatPct = (v: number) =>
    v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + "%";

  const handleSave = () => {
    if (!simulation) return;
    if (!clientName.trim()) {
      toast({ title: "Cliente obrigatório", description: "Informe o nome do cliente antes de salvar.", variant: "destructive" });
      return;
    }
    if (isBelowMinMargin && !observation.trim()) {
      toast({ title: "Observação obrigatória", description: "A margem está abaixo do mínimo. Informe uma observação.", variant: "destructive" });
      return;
    }

    const entry: SavedCalculation = {
      id: crypto.randomUUID(),
      machine_name: machineName,
      fob_cost: parseFloat(fobCost) || 0,
      estimated_tax_percent: parseFloat(estimatedTaxPercent) || 0,
      estimated_tax_value: simulation.estimatedTaxValue,
      desired_margin_percent: parseFloat(desiredMargin) || 0,
      selling_price: simulation.finalPrice,
      estimated_profit: simulation.profit,
      real_tax_value: nationalized ? nationalized.realTaxAbsolute : null,
      real_profit: nationalized?.realProfit ?? null,
      real_margin_percent: nationalized?.realMarginPct ?? null,
      min_acceptable_margin: minMarginVal,
      observation: observation || null,
      created_at: new Date().toISOString(),
    };

    setHistory((prev) => [entry, ...prev]);
    toast({ title: "Salvo!", description: "Cálculo salvo no histórico local." });
  };

  const handleShareWhatsApp = () => {
    if (!simulation) return;
    const lines: string[] = [];
    lines.push(`📋 *Resumo de Precificação*`);
    if (clientName.trim()) lines.push(`👤 Cliente: ${clientName}`);
    if (machineName.trim()) lines.push(`🔧 Máquina: ${machineName}`);
    lines.push("");
    lines.push(`💵 *FOB + Impostos Internacionais*`);
    lines.push(`  USD: ${formatUsd(simulation.finalPrice)}`);
    if (simulation.hasDollar) {
      lines.push(`  BRL: ${formatCurrency(simulation.finalPriceBrl)}`);
    }
    if (nationalized) {
      lines.push("");
      lines.push(`🇧🇷 *Preço Final Nacionalizada*`);
      if (nationalized.hasDollar) {
        lines.push(`  USD: ${formatUsd(nationalized.nationalizedPriceUsd)}`);
      }
      lines.push(`  BRL: ${formatCurrency(nationalized.nationalizedPrice)}`);
    }
    if (observation?.trim()) {
      lines.push("");
      lines.push(`📝 Obs: ${observation}`);
    }
    const text = lines.join("\n");
    navigator.clipboard.writeText(text).then(() => {
      toast({ title: "Copiado!", description: "Texto copiado para a área de transferência. Cole no WhatsApp." });
    }).catch(() => {
      toast({ title: "Erro", description: "Não foi possível copiar.", variant: "destructive" });
    });
  };

  const handleDelete = (id: string) => {
    setHistory((prev) => prev.filter((c) => c.id !== id));
  };

  return (
    <div className="min-h-screen bg-background px-4 py-8 md:py-12">
      <div className="mx-auto max-w-6xl">
        {/* Header */}
        <div className="mb-8 flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary">
            <TrendingUp className="h-6 w-6 text-primary-foreground" />
          </div>
          <div>
            <h1 className="font-heading text-2xl font-bold tracking-tight text-foreground">
              Preço de Venda
            </h1>
            <p className="text-sm text-muted-foreground">Máquinas Industriais</p>
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="mb-6">
            <TabsTrigger value="simulation">
              <Calculator className="h-4 w-4 mr-1" /> Simulação
            </TabsTrigger>
            <TabsTrigger value="history">
              <History className="h-4 w-4 mr-1" /> Histórico
            </TabsTrigger>
            <TabsTrigger value="registry">
              <Building2 className="h-4 w-4 mr-1" /> Cadastros
            </TabsTrigger>
            <TabsTrigger value="catalog">
              <Package className="h-4 w-4 mr-1" /> Catálogo
            </TabsTrigger>
          </TabsList>

          <TabsContent value="simulation">
            <div className="grid gap-6 lg:grid-cols-5">
              {/* Inputs – 3 cols */}
              <div className="lg:col-span-3 space-y-6">
                <Card className="border-border bg-card p-6 shadow-sm">
                  <h2 className="font-heading text-lg font-semibold text-card-foreground mb-6 flex items-center gap-2">
                    <Package className="h-5 w-5" /> Simulação
                  </h2>
                  <div className="space-y-5">
                    <div className="relative">
                      <Label className="mb-1.5 flex items-center gap-1.5 text-sm text-muted-foreground"><User className="h-4 w-4" />Nome do Cliente</Label>
                      <div className="flex gap-2">
                        <div className="relative flex-1">
                          <Input
                            value={clientName}
                            onChange={(e) => { setClientName(e.target.value); setShowClientSuggestions(true); }}
                            onFocus={() => setShowClientSuggestions(true)}
                            onBlur={() => setTimeout(() => setShowClientSuggestions(false), 150)}
                            placeholder="Ex: Empresa ABC"
                            className="bg-secondary/50 border-border"
                          />
                          {showClientSuggestions && clientName && filteredClients.length > 0 && (
                            <div className="absolute z-10 mt-1 w-full rounded-md border border-border bg-popover shadow-md max-h-40 overflow-y-auto">
                              {filteredClients.map((c) => (
                                <button
                                  key={c.id}
                                  type="button"
                                  className="w-full text-left px-3 py-2 text-sm hover:bg-accent hover:text-accent-foreground"
                                  onMouseDown={() => { setClientName(c.name); setShowClientSuggestions(false); }}
                                >
                                  {c.name}
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                        <Button
                          type="button"
                          size="icon"
                          variant="outline"
                          className="shrink-0"
                          disabled={!clientName.trim() || clients.some((c) => c.name.toLowerCase() === clientName.trim().toLowerCase())}
                          onClick={() => {
                            const trimmed = clientName.trim();
                            if (!trimmed) return;
                            const entry: Client = { id: crypto.randomUUID(), name: trimmed, created_at: new Date().toISOString() };
                            const updated = [entry, ...clients];
                            setClients(updated);
                            saveClients(updated);
                            toast({ title: "Empresa cadastrada!" });
                          }}
                          title="Cadastrar empresa"
                        >
                          <Plus className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                    <div className="relative">
                      <Label className="mb-1.5 flex items-center gap-1.5 text-sm text-muted-foreground"><Package className="h-4 w-4" />Nome da Máquina</Label>
                      <div className="flex gap-2">
                        <div className="relative flex-1">
                          <Input
                            value={machineName}
                            onChange={(e) => { setMachineName(e.target.value); setShowMachineSuggestions(true); setShowCatalogSuggestions(true); }}
                            onFocus={() => { setShowMachineSuggestions(true); setShowCatalogSuggestions(true); }}
                            onBlur={() => setTimeout(() => { setShowMachineSuggestions(false); setShowCatalogSuggestions(false); }, 150)}
                            placeholder="Ex: Torno CNC ou modelo do catálogo"
                            className="bg-secondary/50 border-border"
                          />
                          {(showMachineSuggestions || showCatalogSuggestions) && machineName && (filteredMachines.length > 0 || filteredCatalog.length > 0) && (
                            <div className="absolute z-10 mt-1 w-full rounded-md border border-border bg-popover shadow-md max-h-48 overflow-y-auto">
                              {filteredCatalog.length > 0 && (
                                <>
                                  <div className="px-3 py-1.5 text-xs font-semibold text-muted-foreground bg-muted/50">Catálogo</div>
                                  {filteredCatalog.slice(0, 8).map((m) => (
                                    <button
                                      key={m.id}
                                      type="button"
                                      className="w-full text-left px-3 py-2 text-sm hover:bg-accent hover:text-accent-foreground flex justify-between"
                                      onMouseDown={() => {
                                        setMachineName(`${m.marca} ${m.modelo}`);
                                        if (m.custo_fob > 0) setFobCost(String(m.custo_fob));
                                        setShowMachineSuggestions(false);
                                        setShowCatalogSuggestions(false);
                                      }}
                                    >
                                      <span>{m.marca} {m.modelo} <span className="text-muted-foreground">({m.tipo})</span></span>
                                      {m.custo_fob > 0 && <span className="text-muted-foreground ml-2">$ {m.custo_fob.toLocaleString("pt-BR")}</span>}
                                    </button>
                                  ))}
                                </>
                              )}
                              {filteredMachines.length > 0 && (
                                <>
                                  <div className="px-3 py-1.5 text-xs font-semibold text-muted-foreground bg-muted/50">Cadastros</div>
                                  {filteredMachines.map((m) => (
                                    <button
                                      key={m.id}
                                      type="button"
                                      className="w-full text-left px-3 py-2 text-sm hover:bg-accent hover:text-accent-foreground"
                                      onMouseDown={() => { setMachineName(m.name); setShowMachineSuggestions(false); setShowCatalogSuggestions(false); }}
                                    >
                                      {m.name}
                                    </button>
                                  ))}
                                </>
                              )}
                            </div>
                          )}
                        </div>
                        <Button
                          type="button"
                          size="icon"
                          variant="outline"
                          className="shrink-0"
                          disabled={!machineName.trim() || machines.some((m) => m.name.toLowerCase() === machineName.trim().toLowerCase())}
                          onClick={() => {
                            const trimmed = machineName.trim();
                            if (!trimmed) return;
                            const entry: Machine = { id: crypto.randomUUID(), name: trimmed, created_at: new Date().toISOString() };
                            const updated = [entry, ...machines];
                            setMachines(updated);
                            saveMachines(updated);
                            toast({ title: "Máquina cadastrada!" });
                          }}
                          title="Cadastrar máquina"
                        >
                          <Plus className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                    <InputField label="Custo FOB (USD)" icon={<DollarSign className="h-4 w-4" />} value={fobCost} onChange={setFobCost} placeholder="0,00" prefix="US$" type="number" />
                    <InputField label="Cotação do Dólar" icon={<DollarSign className="h-4 w-4" />} value={dollarRate} onChange={setDollarRate} placeholder="0,00" prefix="R$" type="number" />
                    <InputField label="Impostos Estimados" icon={<Receipt className="h-4 w-4" />} value={estimatedTaxPercent} onChange={setEstimatedTaxPercent} placeholder="0,00" suffix="%" type="number" />
                    <InputField label="Margem Desejada" icon={<TrendingUp className="h-4 w-4" />} value={desiredMargin} onChange={setDesiredMargin} placeholder="0,00" suffix="%" type="number" />
                    <InputField label="Margem Mínima Aceitável" icon={<AlertTriangle className="h-4 w-4" />} value={minMargin} onChange={setMinMargin} placeholder="0,00" suffix="%" type="number" />
                    <div>
                      <Label className="mb-1.5 flex items-center gap-1.5 text-sm text-muted-foreground"><StickyNote className="h-4 w-4" />Anotações</Label>
                      <Textarea
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                        placeholder="Anotações gerais sobre este cálculo..."
                        className="bg-secondary/50 border-border"
                      />
                    </div>
                  </div>
                </Card>

                <Card className="border-border bg-card p-6 shadow-sm">
                  <h2 className="font-heading text-lg font-semibold text-card-foreground mb-6 flex items-center gap-2">
                    <Receipt className="h-5 w-5" /> Venda Nacionalizada
                  </h2>
                  <div className="space-y-5">
                    <InputField label="Impostos Reais da Nacionalização" icon={<Percent className="h-4 w-4" />} value={realTaxValue} onChange={setRealTaxValue} placeholder="0,00" suffix="%" type="number" />

                    {isBelowMinMargin && (
                      <Alert variant="destructive">
                        <AlertTriangle className="h-4 w-4" />
                        <AlertDescription>
                          A margem real ({formatPct(nationalized!.realMarginPct)}) está abaixo do mínimo aceitável ({formatPct(minMarginVal)}). Observação obrigatória.
                        </AlertDescription>
                      </Alert>
                    )}

                    {(isBelowMinMargin || observation) && (
                      <div>
                        <Label className="mb-1.5 text-sm text-muted-foreground">Observação</Label>
                        <Textarea
                          value={observation}
                          onChange={(e) => setObservation(e.target.value)}
                          placeholder="Justifique a margem abaixo do mínimo..."
                          className="bg-secondary/50 border-border"
                        />
                      </div>
                    )}
                  </div>
                </Card>

                <div className="flex gap-3">
                  <Button className="flex-1" onClick={handleSave} disabled={!simulation}>
                    <Save className="h-4 w-4 mr-2" /> Salvar Cálculo
                  </Button>
                  <Button variant="secondary" onClick={handleShareWhatsApp} disabled={!simulation}>
                    <Copy className="h-4 w-4 mr-2" /> Copiar Resumo
                  </Button>
                  <Button variant="outline" onClick={() => {
                    setMachineName(""); setClientName(""); setFobCost(""); setDollarRate("");
                    setEstimatedTaxPercent(""); setDesiredMargin(""); setMinMargin("");
                    setRealTaxValue(""); setObservation(""); setNotes("");
                  }}>
                    <RotateCcw className="h-4 w-4 mr-2" /> Resetar
                  </Button>
                </div>
              </div>

              {/* Results – 2 cols */}
              <div className="lg:col-span-2 space-y-6">
                <Card className="border-border bg-primary p-6 shadow-sm">
                  <p className="text-sm font-medium text-primary-foreground/70">Preço de Venda Sugerido</p>
                  <p className="mt-1 font-heading text-4xl font-bold text-primary-foreground">
                    {simulation ? formatUsd(simulation.finalPrice) : "US$ 0,00"}
                  </p>
                  {simulation && simulation.hasDollar && (
                    <p className="mt-1 text-sm text-primary-foreground/60">
                      {formatCurrency(simulation.finalPriceBrl)}
                    </p>
                  )}
                </Card>

                <Card className="border-border bg-card p-6 shadow-sm">
                  <h2 className="font-heading text-base font-semibold text-card-foreground mb-4">Composição Estimada</h2>
                  <div className="space-y-2.5">
                    <Row label="Custo FOB (USD)" value={simulation ? formatUsd(simulation.fob) : "US$ 0,00"} />
                    {simulation && simulation.hasDollar && (
                      <Row label={`FOB em BRL (×${parseFloat(dollarRate).toLocaleString("pt-BR", { minimumFractionDigits: 2 })})`} value={formatCurrency(simulation.fobBrl)} />
                    )}
                    <Row label="Impostos Estimados (repasse)" value={simulation ? `${formatPct(parseFloat(estimatedTaxPercent) || 0)} = ${formatUsd(simulation.estimatedTaxValue)}` : "US$ 0,00"} color="text-warning" />
                    {simulation && simulation.hasDollar && (
                      <Row label="Impostos em BRL" value={formatCurrency(simulation.estimatedTaxBrl)} color="text-warning" />
                    )}
                    <Separator className="my-2" />
                    <p className="text-xs text-muted-foreground italic mb-1">Margem calculada sobre o preço de venda (margem por dentro), aplicada somente sobre o FOB</p>
                    <h3 className="text-sm font-semibold text-card-foreground">Margem Desejada ({formatPct(parseFloat(desiredMargin) || 0)}) — Fator: {simulation ? simulation.factor.toFixed(4) : "—"}</h3>
                    <Row label="Preço Base da Máquina (USD)" value={simulation ? formatUsd(simulation.basePrice) : "US$ 0,00"} bold />
                    {simulation && simulation.hasDollar && (
                      <Row label="Preço Base (BRL)" value={formatCurrency(simulation.basePriceBrl)} />
                    )}
                    <Row label="Lucro da Máquina (USD)" value={simulation ? formatUsd(simulation.profit) : "US$ 0,00"} color="text-accent" bold />
                    {simulation && simulation.hasDollar && (
                      <Row label="Lucro da Máquina (BRL)" value={formatCurrency(simulation.profitBrl)} color="text-accent" />
                    )}
                    <Row label="Margem Verificada" value={simulation ? formatPct(simulation.effectiveMargin) : "—"} color={simulation && !simulation.marginCheck ? "text-destructive" : "text-accent"} />
                    {simulation && !simulation.marginCheck && (
                      <Alert variant="destructive" className="mt-2">
                        <AlertTriangle className="h-4 w-4" />
                        <AlertDescription>Erro de cálculo: a margem verificada não corresponde à margem informada.</AlertDescription>
                      </Alert>
                    )}
                    <Separator className="my-2" />
                    <h3 className="text-sm font-semibold text-primary">Preço Final ao Cliente</h3>
                    <Row label="Preço Final (USD)" value={simulation ? formatUsd(simulation.finalPrice) : "US$ 0,00"} bold />
                    {simulation && simulation.hasDollar && (
                      <Row label="Preço Final (BRL)" value={formatCurrency(simulation.finalPriceBrl)} />
                    )}

                    {simulation && simulation.minMarginPct > 0 && (
                      <>
                        <Separator className="my-2" />
                        <h3 className="text-sm font-semibold text-warning">Margem Mínima Aceitável ({formatPct(simulation.minMarginPct)})</h3>
                        <Row label="Preço Base Mín. (USD)" value={formatUsd(simulation.minBasePrice)} bold />
                        {simulation.hasDollar && (
                          <Row label="Preço Base Mín. (BRL)" value={formatCurrency(simulation.minBasePriceBrl)} />
                        )}
                        <Row label="Lucro Mín. (USD)" value={formatUsd(simulation.minProfit)} color="text-warning" bold />
                        {simulation.hasDollar && (
                          <Row label="Lucro Mín. (BRL)" value={formatCurrency(simulation.minProfitBrl)} color="text-warning" />
                        )}
                        <Row label="Preço Final Mín. (USD)" value={formatUsd(simulation.minFinalPrice)} />
                        {simulation.hasDollar && (
                          <Row label="Preço Final Mín. (BRL)" value={formatCurrency(simulation.minFinalPriceBrl)} />
                        )}
                      </>
                    )}
                  </div>
                </Card>

                {nationalized && (
                  <Card className={`border-border p-6 shadow-sm ${isBelowMinMargin ? "bg-destructive/10 border-destructive/30" : "bg-card"}`}>
                    <h2 className="font-heading text-base font-semibold text-card-foreground mb-4">Resultado Nacionalizado</h2>
                    <div className="space-y-2.5">
                      {nationalized.hasDollar && (
                        <Row label="Preço de Venda Nacionalizada (USD)" value={formatUsd(nationalized.nationalizedPriceUsd)} color="text-primary" bold />
                      )}
                      <Row label="Preço de Venda Nacionalizada (BRL)" value={formatCurrency(nationalized.nationalizedPrice)} color="text-primary" bold />
                      <Separator className="my-2" />
                      {nationalized.hasDollar && (
                        <Row label={`Impostos Reais (${formatPct(nationalized.realTaxPct)})`} value={formatUsd(nationalized.realTaxAbsoluteUsd)} color="text-warning" />
                      )}
                      <Row label={`Impostos Reais (${formatPct(nationalized.realTaxPct)})`} value={formatCurrency(nationalized.realTaxAbsolute)} color="text-warning" />
                    </div>
                  </Card>
                )}

                {simulation && simulation.finalPrice > 0 && (
                  <Card className="border-primary/30 bg-primary/5 p-6 shadow-sm">
                    <h2 className="font-heading text-base font-semibold text-primary mb-4">
                      Resumo{machineName ? ` — ${machineName}` : ""}
                    </h2>
                    <div className="space-y-2.5">
                      <Row label="FOB + Impostos Internacionais (USD)" value={formatUsd(simulation.finalPrice)} bold />
                      {simulation.hasDollar && (
                        <Row label="FOB + Impostos Internacionais (BRL)" value={formatCurrency(simulation.finalPriceBrl)} bold />
                      )}
                      {nationalized && (
                        <>
                          <Separator className="my-2" />
                          {nationalized.hasDollar && (
                            <Row label="Preço Final Nacionalizada (USD)" value={formatUsd(nationalized.nationalizedPriceUsd)} color="text-primary" bold />
                          )}
                          <Row label="Preço Final Nacionalizada (BRL)" value={formatCurrency(nationalized.nationalizedPrice)} color="text-primary" bold />
                        </>
                      )}
                    </div>
                  </Card>
                )}

                {simulation && simulation.finalPrice > 0 && (
                  <Card className="border-border bg-card p-6 shadow-sm">
                    <h2 className="font-heading text-sm font-semibold text-card-foreground mb-3">Distribuição Visual</h2>
                    <div className="flex h-6 w-full overflow-hidden rounded-lg">
                      <BarSegment percent={simulation.fob / simulation.finalPrice * 100} className="bg-muted-foreground/40" label="FOB" />
                      <BarSegment percent={simulation.estimatedTaxValue / simulation.finalPrice * 100} className="bg-warning" label="Impostos" />
                      <BarSegment percent={simulation.profit / simulation.finalPrice * 100} className="bg-accent" label="Lucro" />
                    </div>
                    <div className="mt-3 flex flex-wrap gap-3 text-xs text-muted-foreground">
                      <Legend color="bg-muted-foreground/40" label="FOB" />
                      <Legend color="bg-warning" label="Impostos" />
                      <Legend color="bg-accent" label="Lucro" />
                    </div>
                  </Card>
                )}
              </div>
            </div>
          </TabsContent>

          <TabsContent value="history">
            <CalculationHistory calculations={history} onDelete={handleDelete} />
          </TabsContent>

          <TabsContent value="registry">
            <div className="space-y-6">
              <ClientManager clients={clients} setClients={setClients} />
              <MachineManager machines={machines} setMachines={setMachines} />
            </div>
          </TabsContent>

          <TabsContent value="catalog">
            <MachineCatalog catalog={catalog} setCatalog={setCatalog} />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

/* Sub-components */

const InputField = ({ label, icon, value, onChange, placeholder, prefix, suffix, type = "text", disabled = false }: {
  label: string; icon: React.ReactNode; value: string; onChange: (v: string) => void;
  placeholder: string; prefix?: string; suffix?: string; type?: string; disabled?: boolean;
}) => (
  <div className={disabled ? "opacity-50" : ""}>
    <Label className="mb-1.5 flex items-center gap-1.5 text-sm text-muted-foreground">{icon}{label}</Label>
    <div className="relative">
      {prefix && <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">{prefix}</span>}
      <Input type={type} step="0.01" min="0" value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} disabled={disabled} className={`bg-secondary/50 border-border ${prefix ? "pl-10" : ""} ${suffix ? "pr-10" : ""}`} />
      {suffix && <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">{suffix}</span>}
    </div>
  </div>
);

const Row = ({ label, value, color, bold }: { label: string; value: string; color?: string; bold?: boolean }) => (
  <div className="flex items-center justify-between">
    <span className={`text-sm ${color || "text-card-foreground"}`}>{label}</span>
    <span className={`text-sm ${bold ? "font-semibold" : ""} ${color || "text-card-foreground"}`}>{value}</span>
  </div>
);

const BarSegment = ({ percent, className, label }: { percent: number; className: string; label: string }) =>
  percent > 0 ? <div className={`${className} transition-all duration-500`} style={{ width: `${percent}%` }} title={`${label}: ${percent.toFixed(1)}%`} /> : null;

const Legend = ({ color, label }: { color: string; label: string }) => (
  <div className="flex items-center gap-1.5"><div className={`h-2.5 w-2.5 rounded-sm ${color}`} /><span>{label}</span></div>
);

export default PriceCalculator;
