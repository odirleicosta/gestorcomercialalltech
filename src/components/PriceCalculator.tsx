import { useState, useMemo } from "react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { DollarSign, Percent, TrendingUp, Package, Receipt, BarChart3 } from "lucide-react";

const PriceCalculator = () => {
  const [custoProduto, setCustoProduto] = useState<string>("");
  const [margemLucro, setMargemLucro] = useState<string>("");
  const [impostos, setImpostos] = useState<string>("");
  const [despesasFixas, setDespesasFixas] = useState<string>("");
  const [comissao, setComissao] = useState<string>("");

  const resultado = useMemo(() => {
    const custo = parseFloat(custoProduto) || 0;
    const margem = parseFloat(margemLucro) || 0;
    const imposto = parseFloat(impostos) || 0;
    const despesas = parseFloat(despesasFixas) || 0;
    const comissaoVal = parseFloat(comissao) || 0;

    const totalPercentual = margem + imposto + despesas + comissaoVal;

    if (totalPercentual >= 100) {
      return null;
    }

    const precoVenda = custo / (1 - totalPercentual / 100);
    const lucroValor = precoVenda * (margem / 100);
    const impostoValor = precoVenda * (imposto / 100);
    const despesasValor = precoVenda * (despesas / 100);
    const comissaoValor = precoVenda * (comissaoVal / 100);

    return {
      precoVenda,
      lucroValor,
      impostoValor,
      despesasValor,
      comissaoValor,
      markup: custo > 0 ? ((precoVenda - custo) / custo) * 100 : 0,
    };
  }, [custoProduto, margemLucro, impostos, despesasFixas, comissao]);

  const formatCurrency = (value: number) =>
    value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  const formatPercent = (value: number) =>
    value.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + "%";

  return (
    <div className="min-h-screen bg-background px-4 py-8 md:py-12">
      <div className="mx-auto max-w-5xl">
        {/* Header */}
        <div className="mb-8 text-center md:mb-12">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary">
            <TrendingUp className="h-7 w-7 text-primary-foreground" />
          </div>
          <h1 className="font-heading text-3xl font-bold tracking-tight text-foreground md:text-4xl">
            Preço de Venda
          </h1>
          <p className="mt-2 text-muted-foreground">
            Calcule o preço ideal para seus produtos
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          {/* Input Section */}
          <Card className="border-border bg-card p-6 shadow-sm">
            <h2 className="font-heading text-lg font-semibold text-card-foreground mb-6">
              Dados do Produto
            </h2>

            <div className="space-y-5">
              <InputField
                label="Custo do Produto"
                icon={<Package className="h-4 w-4" />}
                value={custoProduto}
                onChange={setCustoProduto}
                placeholder="0,00"
                prefix="R$"
              />
              <InputField
                label="Margem de Lucro"
                icon={<TrendingUp className="h-4 w-4" />}
                value={margemLucro}
                onChange={setMargemLucro}
                placeholder="0,00"
                suffix="%"
              />
              <InputField
                label="Impostos"
                icon={<Receipt className="h-4 w-4" />}
                value={impostos}
                onChange={setImpostos}
                placeholder="0,00"
                suffix="%"
              />
              <InputField
                label="Despesas Fixas"
                icon={<BarChart3 className="h-4 w-4" />}
                value={despesasFixas}
                onChange={setDespesasFixas}
                placeholder="0,00"
                suffix="%"
              />
              <InputField
                label="Comissão"
                icon={<Percent className="h-4 w-4" />}
                value={comissao}
                onChange={setComissao}
                placeholder="0,00"
                suffix="%"
              />
            </div>
          </Card>

          {/* Result Section */}
          <div className="space-y-6">
            {/* Main result */}
            <Card className="border-border bg-primary p-6 shadow-sm">
              <p className="text-sm font-medium text-primary-foreground/70">Preço de Venda</p>
              <p className="mt-1 font-heading text-4xl font-bold text-primary-foreground">
                {resultado ? formatCurrency(resultado.precoVenda) : "R$ 0,00"}
              </p>
              {resultado && resultado.markup > 0 && (
                <p className="mt-2 text-sm text-primary-foreground/70">
                  Markup: {formatPercent(resultado.markup)}
                </p>
              )}
            </Card>

            {/* Breakdown */}
            <Card className="border-border bg-card p-6 shadow-sm">
              <h2 className="font-heading text-lg font-semibold text-card-foreground mb-4">
                Composição do Preço
              </h2>

              <div className="space-y-3">
                <BreakdownRow
                  label="Custo do Produto"
                  value={formatCurrency(parseFloat(custoProduto) || 0)}
                  color="bg-muted"
                />
                <BreakdownRow
                  label="Lucro"
                  value={resultado ? formatCurrency(resultado.lucroValor) : "R$ 0,00"}
                  color="bg-accent/15"
                  textColor="text-accent"
                />
                <BreakdownRow
                  label="Impostos"
                  value={resultado ? formatCurrency(resultado.impostoValor) : "R$ 0,00"}
                  color="bg-warning/15"
                  textColor="text-warning"
                />
                <BreakdownRow
                  label="Despesas Fixas"
                  value={resultado ? formatCurrency(resultado.despesasValor) : "R$ 0,00"}
                  color="bg-info/15"
                  textColor="text-info"
                />
                <BreakdownRow
                  label="Comissão"
                  value={resultado ? formatCurrency(resultado.comissaoValor) : "R$ 0,00"}
                  color="bg-destructive/15"
                  textColor="text-destructive"
                />

                <Separator className="my-3" />

                <div className="flex items-center justify-between font-semibold text-card-foreground">
                  <span>Total</span>
                  <span>{resultado ? formatCurrency(resultado.precoVenda) : "R$ 0,00"}</span>
                </div>
              </div>
            </Card>

            {/* Visual bar */}
            {resultado && resultado.precoVenda > 0 && (
              <Card className="border-border bg-card p-6 shadow-sm">
                <h2 className="font-heading text-sm font-semibold text-card-foreground mb-3">
                  Distribuição Visual
                </h2>
                <div className="flex h-6 w-full overflow-hidden rounded-lg">
                  <BarSegment
                    percent={(parseFloat(custoProduto) || 0) / resultado.precoVenda * 100}
                    className="bg-muted-foreground/40"
                    label="Custo"
                  />
                  <BarSegment
                    percent={resultado.lucroValor / resultado.precoVenda * 100}
                    className="bg-accent"
                    label="Lucro"
                  />
                  <BarSegment
                    percent={resultado.impostoValor / resultado.precoVenda * 100}
                    className="bg-warning"
                    label="Impostos"
                  />
                  <BarSegment
                    percent={resultado.despesasValor / resultado.precoVenda * 100}
                    className="bg-info"
                    label="Despesas"
                  />
                  <BarSegment
                    percent={resultado.comissaoValor / resultado.precoVenda * 100}
                    className="bg-destructive"
                    label="Comissão"
                  />
                </div>
                <div className="mt-3 flex flex-wrap gap-3 text-xs text-muted-foreground">
                  <Legend color="bg-muted-foreground/40" label="Custo" />
                  <Legend color="bg-accent" label="Lucro" />
                  <Legend color="bg-warning" label="Impostos" />
                  <Legend color="bg-info" label="Despesas" />
                  <Legend color="bg-destructive" label="Comissão" />
                </div>
              </Card>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

const InputField = ({
  label,
  icon,
  value,
  onChange,
  placeholder,
  prefix,
  suffix,
}: {
  label: string;
  icon: React.ReactNode;
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  prefix?: string;
  suffix?: string;
}) => (
  <div>
    <Label className="mb-1.5 flex items-center gap-1.5 text-sm text-muted-foreground">
      {icon}
      {label}
    </Label>
    <div className="relative">
      {prefix && (
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
          {prefix}
        </span>
      )}
      <Input
        type="number"
        step="0.01"
        min="0"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={`bg-secondary/50 border-border ${prefix ? "pl-10" : ""} ${suffix ? "pr-10" : ""}`}
      />
      {suffix && (
        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
          {suffix}
        </span>
      )}
    </div>
  </div>
);

const BreakdownRow = ({
  label,
  value,
  color,
  textColor,
}: {
  label: string;
  value: string;
  color: string;
  textColor?: string;
}) => (
  <div className={`flex items-center justify-between rounded-lg px-3 py-2.5 ${color}`}>
    <span className={`text-sm ${textColor || "text-card-foreground"}`}>{label}</span>
    <span className={`text-sm font-semibold ${textColor || "text-card-foreground"}`}>{value}</span>
  </div>
);

const BarSegment = ({
  percent,
  className,
  label,
}: {
  percent: number;
  className: string;
  label: string;
}) =>
  percent > 0 ? (
    <div
      className={`${className} transition-all duration-500`}
      style={{ width: `${percent}%` }}
      title={`${label}: ${percent.toFixed(1)}%`}
    />
  ) : null;

const Legend = ({ color, label }: { color: string; label: string }) => (
  <div className="flex items-center gap-1.5">
    <div className={`h-2.5 w-2.5 rounded-sm ${color}`} />
    <span>{label}</span>
  </div>
);

export default PriceCalculator;
