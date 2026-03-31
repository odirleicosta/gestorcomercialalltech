import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Eye, Target, FileText, CheckCircle, XCircle, ArrowRight } from "lucide-react";

interface Props {
  visits: number;
  opportunities: number;
  proposals: number;
  won: number;
  lost: number;
}

const formatPct = (a: number, b: number) =>
  b > 0 ? `${((a / b) * 100).toFixed(1)}%` : "—";

const SalesFunnel = ({ visits, opportunities, proposals, won, lost }: Props) => {
  const steps = [
    { label: "Visitas", value: visits, icon: Eye, color: "bg-primary/15 text-primary" },
    { label: "Oportunidades", value: opportunities, icon: Target, color: "bg-accent/15 text-accent" },
    { label: "Propostas", value: proposals, icon: FileText, color: "bg-[hsl(var(--ca-blue))]/15 text-[hsl(var(--ca-blue))]" },
    { label: "Ganhas", value: won, icon: CheckCircle, color: "bg-accent/15 text-accent" },
    { label: "Perdidas", value: lost, icon: XCircle, color: "bg-destructive/15 text-destructive" },
  ];

  const conversions = [
    { from: "Visitas", to: "Oportunidades", pct: formatPct(opportunities, visits) },
    { from: "Oportunidades", to: "Propostas", pct: formatPct(proposals, opportunities) },
    { from: "Propostas", to: "Ganhas", pct: formatPct(won, proposals) },
  ];

  const maxVal = Math.max(visits, opportunities, proposals, won + lost, 1);

  return (
    <Card className="p-4 border-border bg-card">
      <h3 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
        <Target className="h-4 w-4 text-primary" />
        Funil de Vendas — Período Selecionado
      </h3>

      <div className="space-y-3">
        {steps.map((step, i) => {
          const pct = maxVal > 0 ? (step.value / maxVal) * 100 : 0;
          const Icon = step.icon;
          return (
            <div key={step.label}>
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-2">
                  <div className={`flex h-6 w-6 items-center justify-center rounded-md ${step.color}`}>
                    <Icon className="h-3.5 w-3.5" />
                  </div>
                  <span className="text-xs font-medium text-foreground">{step.label}</span>
                </div>
                <span className="text-sm font-bold text-foreground">{step.value}</span>
              </div>
              <Progress value={Math.min(pct, 100)} className="h-2" />
            </div>
          );
        })}
      </div>

      {/* Conversion rates */}
      <div className="mt-4 pt-3 border-t border-border">
        <p className="text-[10px] text-muted-foreground mb-2 uppercase tracking-wide font-semibold">Taxas de Conversão</p>
        <div className="grid grid-cols-3 gap-2">
          {conversions.map((c) => (
            <div key={c.from + c.to} className="text-center p-2 rounded-lg bg-secondary/40">
              <p className="text-[10px] text-muted-foreground">{c.from}</p>
              <div className="flex items-center justify-center gap-1 my-0.5">
                <ArrowRight className="h-3 w-3 text-muted-foreground" />
              </div>
              <p className="text-[10px] text-muted-foreground">{c.to}</p>
              <p className="text-sm font-bold text-primary mt-0.5">{c.pct}</p>
            </div>
          ))}
        </div>
      </div>
    </Card>
  );
};

export default SalesFunnel;
