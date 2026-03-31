import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { DollarSign, Users, TrendingUp } from "lucide-react";

interface Negotiation {
  id: string;
  representative_id: string | null;
  deal_value: number;
  status: string;
  probability: string;
}

interface Props {
  negotiations: Negotiation[];
  reps: { id: string; nome: string }[];
}

const formatBrl = (v: number) =>
  `R$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;

const PipelineValue = ({ negotiations, reps }: Props) => {
  const active = negotiations.filter((n) => n.status === "ativa");
  const totalPipeline = active.reduce((s, n) => s + n.deal_value, 0);
  const ticketMedio = active.length > 0 ? totalPipeline / active.length : 0;

  const weightedPipeline = active.reduce((s, n) => {
    const w = n.probability === "Alta" ? 0.8 : n.probability === "Média" ? 0.5 : 0.2;
    return s + n.deal_value * w;
  }, 0);

  // Per rep
  const perRep = reps
    .map((r) => {
      const repDeals = active.filter((n) => n.representative_id === r.id);
      const value = repDeals.reduce((s, n) => s + n.deal_value, 0);
      return { nome: r.nome, value, count: repDeals.length };
    })
    .filter((r) => r.count > 0)
    .sort((a, b) => b.value - a.value);

  const maxRepVal = Math.max(...perRep.map((r) => r.value), 1);

  return (
    <Card className="p-4 border-border bg-card">
      <h3 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
        <DollarSign className="h-4 w-4 text-primary" />
        Pipeline Comercial (R$)
      </h3>

      {/* KPI summary */}
      <div className="grid grid-cols-3 gap-3 mb-4">
        <div className="p-3 rounded-lg bg-primary/10 text-center">
          <p className="text-[10px] text-muted-foreground mb-1">Pipeline Total</p>
          <p className="text-sm font-bold text-primary">{formatBrl(totalPipeline)}</p>
        </div>
        <div className="p-3 rounded-lg bg-accent/10 text-center">
          <p className="text-[10px] text-muted-foreground mb-1">Ponderado</p>
          <p className="text-sm font-bold text-accent">{formatBrl(weightedPipeline)}</p>
        </div>
        <div className="p-3 rounded-lg bg-secondary text-center">
          <p className="text-[10px] text-muted-foreground mb-1">Ticket Médio</p>
          <p className="text-sm font-bold text-foreground">{formatBrl(ticketMedio)}</p>
        </div>
      </div>

      {/* Per rep breakdown */}
      {perRep.length > 0 && (
        <>
          <p className="text-[10px] text-muted-foreground mb-2 uppercase tracking-wide font-semibold flex items-center gap-1">
            <Users className="h-3 w-3" /> Por Representante
          </p>
          <div className="space-y-2">
            {perRep.map((r) => {
              const pct = (r.value / maxRepVal) * 100;
              return (
                <div key={r.nome}>
                  <div className="flex items-center justify-between mb-0.5">
                    <span className="text-xs text-foreground">{r.nome.split(" ")[0]}</span>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-[10px]">
                        {r.count} neg.
                      </Badge>
                      <span className="text-xs font-bold text-foreground">{formatBrl(r.value)}</span>
                    </div>
                  </div>
                  <div className="h-2 w-full bg-secondary rounded-full overflow-hidden">
                    <div
                      className="h-full bg-primary rounded-full transition-all"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      {active.length === 0 && (
        <p className="text-xs text-muted-foreground text-center py-4">
          Nenhuma negociação ativa no pipeline
        </p>
      )}
    </Card>
  );
};

export default PipelineValue;
