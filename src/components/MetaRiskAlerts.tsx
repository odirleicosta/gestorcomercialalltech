import { AlertTriangle, AlertCircle } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import type { MetaRisco } from "@/lib/metaRisk";

interface Props {
  riscos: MetaRisco[];
}

const MetaRiskAlerts = ({ riscos }: Props) => {
  if (riscos.length === 0) return null;

  return (
    <div className="space-y-3">
      {riscos.map((r) => {
        const isCritico = r.risco === "critico";
        return (
          <Card
            key={r.id}
            className={`p-4 border ${
              isCritico
                ? "border-destructive/40 bg-destructive/10"
                : "border-yellow-500/40 bg-yellow-500/10"
            }`}
          >
            <div className="flex items-start gap-3">
              {isCritico ? (
                <AlertTriangle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
              ) : (
                <AlertCircle className="h-5 w-5 text-yellow-500 shrink-0 mt-0.5" />
              )}
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2 mb-1">
                  <span className="font-semibold text-sm text-foreground truncate">
                    {r.nome}
                  </span>
                  <span
                    className={`text-xs font-bold shrink-0 ${
                      isCritico ? "text-destructive" : "text-yellow-600"
                    }`}
                  >
                    {r.pct.toFixed(1)}%
                  </span>
                </div>
                <p className="text-xs text-muted-foreground mb-2">
                  {isCritico
                    ? "Meta em risco crítico — abaixo de 70% após dia 20"
                    : "Atenção — abaixo de 50% após dia 15"}
                </p>
                <Progress
                  value={Math.min(r.pct, 100)}
                  className={`h-2 ${isCritico ? "[&>div]:bg-destructive" : "[&>div]:bg-yellow-500"}`}
                />
                <p className="text-[10px] text-muted-foreground mt-1">
                  {r.vendido} / {r.metaValor} máquinas
                </p>
              </div>
            </div>
          </Card>
        );
      })}
    </div>
  );
};

export default MetaRiskAlerts;
