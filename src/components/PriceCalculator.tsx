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
  Save, AlertTriangle, History, Calculator,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import CalculationHistory from "@/components/CalculationHistory";

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
  const [fobCost, setFobCost] = useState("");
  const [dollarRate, setDollarRate] = useState("");
  const [estimatedTaxPercent, setEstimatedTaxPercent] = useState("");
  const [desiredMargin, setDesiredMargin] = useState("");
  const [minMargin, setMinMargin] = useState("");

  const [realTaxValue, setRealTaxValue] = useState("");
  const [observation, setObservation] = useState("");

  const [activeTab, setActiveTab] = useState("simulation");
  const [history, setHistory] = useState<SavedCalculation[]>(loadHistory);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(history));
  }, [history]);

  const simulation = useMemo(() => {
    const fob = parseFloat(fobCost) || 0;
    const dollar = parseFloat(dollarRate) || 0;
    const taxPct = parseFloat(estimatedTaxPercent) || 0;
    const margin = parseFloat(desiredMargin) || 0;
    if (fob <= 0) return null;
    const fobBrl = dollar > 0 ? fob * dollar : fob;
    const estimatedTaxValue = fobBrl * (taxPct / 100);
    const totalCost = fobBrl + estimatedTaxValue;
    const sellingPrice = totalCost * (1 + margin / 100);
    const estimatedProfit = sellingPrice - totalCost;
    const effectiveMargin = totalCost > 0 ? (estimatedProfit / totalCost) * 100 : 0;
    return { fobBrl, estimatedTaxValue, totalCost, sellingPrice, estimatedProfit, effectiveMargin };
  }, [fobCost, dollarRate, estimatedTaxPercent, desiredMargin]);

  const nationalized = useMemo(() => {
    if (!simulation) return null;
    const realTax = parseFloat(realTaxValue);
    if (isNaN(realTax) || realTax <= 0) return null;
    const realTotalCost = simulation.fobBrl + realTax;
    const realProfit = simulation.sellingPrice - realTotalCost;
    const realMarginPct = realTotalCost > 0 ? (realProfit / realTotalCost) * 100 : 0;
    const taxDifference = realTax - simulation.estimatedTaxValue;
    return { realTotalCost, realProfit, realMarginPct, taxDifference };
  }, [simulation, realTaxValue]);

  const minMarginVal = parseFloat(minMargin) || 0;
  const isBelowMinMargin = nationalized
    ? nationalized.realMarginPct < minMarginVal && minMarginVal > 0
    : false;

  const formatCurrency = (v: number) =>
    v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  const formatPct = (v: number) =>
    v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + "%";

  const handleSave = () => {
    if (!simulation) return;
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
      selling_price: simulation.sellingPrice,
      estimated_profit: simulation.estimatedProfit,
      real_tax_value: nationalized ? parseFloat(realTaxValue) : null,
      real_profit: nationalized?.realProfit ?? null,
      real_margin_percent: nationalized?.realMarginPct ?? null,
      min_acceptable_margin: minMarginVal,
      observation: observation || null,
      created_at: new Date().toISOString(),
    };

    setHistory((prev) => [entry, ...prev]);
    toast({ title: "Salvo!", description: "Cálculo salvo no histórico local." });
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
                    <InputField label="Nome da Máquina" icon={<Package className="h-4 w-4" />} value={machineName} onChange={setMachineName} placeholder="Ex: Torno CNC" />
                    <InputField label="Custo FOB (USD)" icon={<DollarSign className="h-4 w-4" />} value={fobCost} onChange={setFobCost} placeholder="0,00" prefix="US$" type="number" />
                    <InputField label="Cotação do Dólar" icon={<DollarSign className="h-4 w-4" />} value={dollarRate} onChange={setDollarRate} placeholder="0,00" prefix="R$" type="number" />
                    <InputField label="Impostos Estimados" icon={<Receipt className="h-4 w-4" />} value={estimatedTaxPercent} onChange={setEstimatedTaxPercent} placeholder="0,00" suffix="%" type="number" />
                    <InputField label="Margem Desejada" icon={<TrendingUp className="h-4 w-4" />} value={desiredMargin} onChange={setDesiredMargin} placeholder="0,00" suffix="%" type="number" />
                    <InputField label="Margem Mínima Aceitável" icon={<AlertTriangle className="h-4 w-4" />} value={minMargin} onChange={setMinMargin} placeholder="0,00" suffix="%" type="number" />
                  </div>
                </Card>

                <Card className="border-border bg-card p-6 shadow-sm">
                  <h2 className="font-heading text-lg font-semibold text-card-foreground mb-6 flex items-center gap-2">
                    <Receipt className="h-5 w-5" /> Venda Nacionalizada
                  </h2>
                  <div className="space-y-5">
                    <InputField label="Impostos Reais da Nacionalização" icon={<DollarSign className="h-4 w-4" />} value={realTaxValue} onChange={setRealTaxValue} placeholder="0,00" prefix="R$" type="number" />

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

                <Button className="w-full" onClick={handleSave} disabled={!simulation}>
                  <Save className="h-4 w-4 mr-2" /> Salvar Cálculo
                </Button>
              </div>

              {/* Results – 2 cols */}
              <div className="lg:col-span-2 space-y-6">
                <Card className="border-border bg-primary p-6 shadow-sm">
                  <p className="text-sm font-medium text-primary-foreground/70">Preço de Venda Sugerido</p>
                  <p className="mt-1 font-heading text-4xl font-bold text-primary-foreground">
                    {simulation ? formatCurrency(simulation.sellingPrice) : "R$ 0,00"}
                  </p>
                </Card>

                <Card className="border-border bg-card p-6 shadow-sm">
                  <h2 className="font-heading text-base font-semibold text-card-foreground mb-4">Composição Estimada</h2>
                  <div className="space-y-2.5">
                    <Row label="Custo FOB (USD)" value={`US$ ${(parseFloat(fobCost) || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`} />
                    {simulation && parseFloat(dollarRate) > 0 && (
                      <Row label={`FOB em BRL (×${parseFloat(dollarRate).toLocaleString("pt-BR", { minimumFractionDigits: 2 })})`} value={formatCurrency(simulation.fobBrl)} />
                    )}
                    <Row label="Impostos Estimados" value={simulation ? `${formatPct(parseFloat(estimatedTaxPercent) || 0)} = ${formatCurrency(simulation.estimatedTaxValue)}` : "R$ 0,00"} color="text-warning" />
                    <Row label="Custo Total Estimado" value={simulation ? formatCurrency(simulation.totalCost) : "R$ 0,00"} />
                    <Separator className="my-2" />
                    <Row label="Margem Desejada" value={formatPct(parseFloat(desiredMargin) || 0)} color="text-accent" />
                    <Row label="Lucro Estimado" value={simulation ? formatCurrency(simulation.estimatedProfit) : "R$ 0,00"} color="text-accent" bold />
                    <Separator className="my-2" />
                    <Row label="Preço de Venda" value={simulation ? formatCurrency(simulation.sellingPrice) : "R$ 0,00"} bold />
                  </div>
                </Card>

                {nationalized && (
                  <Card className={`border-border p-6 shadow-sm ${isBelowMinMargin ? "bg-destructive/10 border-destructive/30" : "bg-card"}`}>
                    <h2 className="font-heading text-base font-semibold text-card-foreground mb-4">Resultado Nacionalizado</h2>
                    <div className="space-y-2.5">
                      <Row label="Impostos Reais" value={formatCurrency(parseFloat(realTaxValue))} color="text-warning" />
                      <Row label="Diferença Impostos" value={formatCurrency(nationalized.taxDifference)} color={nationalized.taxDifference > 0 ? "text-destructive" : "text-accent"} />
                      <Separator className="my-2" />
                      <Row label="Custo Total Real" value={formatCurrency(nationalized.realTotalCost)} />
                      <Row label="Lucro Real" value={formatCurrency(nationalized.realProfit)} color={nationalized.realProfit >= 0 ? "text-accent" : "text-destructive"} bold />
                      <Row label="Margem Real" value={formatPct(nationalized.realMarginPct)} color={isBelowMinMargin ? "text-destructive" : "text-accent"} bold />
                    </div>
                  </Card>
                )}

                {simulation && simulation.sellingPrice > 0 && (
                  <Card className="border-border bg-card p-6 shadow-sm">
                    <h2 className="font-heading text-sm font-semibold text-card-foreground mb-3">Distribuição Visual</h2>
                    <div className="flex h-6 w-full overflow-hidden rounded-lg">
                      <BarSegment percent={simulation.fobBrl / simulation.sellingPrice * 100} className="bg-muted-foreground/40" label="FOB" />
                      <BarSegment percent={simulation.estimatedTaxValue / simulation.sellingPrice * 100} className="bg-warning" label="Impostos" />
                      <BarSegment percent={simulation.estimatedProfit / simulation.sellingPrice * 100} className="bg-accent" label="Lucro" />
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
        </Tabs>
      </div>
    </div>
  );
};

/* Sub-components */

const InputField = ({ label, icon, value, onChange, placeholder, prefix, suffix, type = "text" }: {
  label: string; icon: React.ReactNode; value: string; onChange: (v: string) => void;
  placeholder: string; prefix?: string; suffix?: string; type?: string;
}) => (
  <div>
    <Label className="mb-1.5 flex items-center gap-1.5 text-sm text-muted-foreground">{icon}{label}</Label>
    <div className="relative">
      {prefix && <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">{prefix}</span>}
      <Input type={type} step="0.01" min="0" value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className={`bg-secondary/50 border-border ${prefix ? "pl-10" : ""} ${suffix ? "pr-10" : ""}`} />
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
