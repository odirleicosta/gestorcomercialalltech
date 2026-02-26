import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Award, BarChart3, Percent, Target } from "lucide-react";

interface RankingItem {
  nome: string;
  total: number;
  count: number;
  grossProfit: number;
  vendas: number;
}

interface MaxDeal {
  client_name: string;
  machine_name: string;
  seller_commission_value: number;
  manager_commission_value: number;
  dollar_rate: number;
  representative_id: string | null;
}

interface Props {
  ranking: RankingItem[];
  maxDeal: MaxDeal;
  commPerMachine: number;
  count: number;
  getRepName: (id: string | null) => string;
}

const formatBrl = (v: number) =>
  `R$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const formatPct = (v: number) =>
  v.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + "%";

const CommissionRanking = ({ ranking, maxDeal, commPerMachine, count, getRepName }: Props) => {
  const maxCommBrl = (maxDeal.seller_commission_value + maxDeal.manager_commission_value) * (maxDeal.dollar_rate || 0);

  return (
    <div className="space-y-4">
      {/* Maior comissão */}
      <Card className="p-4 border-border bg-card shadow-sm">
        <div className="flex items-center gap-2 mb-2">
          <Award className="h-4 w-4 text-[hsl(var(--ca-orange))]" />
          <span className="text-xs font-semibold text-foreground">Maior Comissão</span>
        </div>
        <p className="text-lg font-bold text-foreground">{formatBrl(maxCommBrl)}</p>
        <p className="text-[10px] text-muted-foreground mt-1 leading-tight">
          {maxDeal.client_name} — {maxDeal.machine_name}
        </p>
        <p className="text-[10px] text-muted-foreground">{getRepName(maxDeal.representative_id)}</p>
      </Card>

      {/* Média por máquina */}
      <Card className="p-4 border-border bg-card shadow-sm">
        <div className="flex items-center gap-2 mb-2">
          <Target className="h-4 w-4 text-primary" />
          <span className="text-xs font-semibold text-foreground">Média/Máquina</span>
        </div>
        <p className="text-lg font-bold text-foreground">{count > 0 ? formatBrl(commPerMachine) : "—"}</p>
        <p className="text-[10px] text-muted-foreground">{count} máquinas</p>
      </Card>

      {/* Ranking */}
      <Card className="p-4 border-border bg-card shadow-sm">
        <div className="flex items-center gap-2 mb-3">
          <BarChart3 className="h-4 w-4 text-accent" />
          <span className="text-xs font-semibold text-foreground">Ranking Comissão</span>
        </div>
        <div className="space-y-2">
          {ranking.slice(0, 5).map((r, i) => {
            const maxTotal = ranking[0]?.total || 1;
            const pct = (r.total / maxTotal) * 100;
            return (
              <div key={i}>
                <div className="flex items-center justify-between text-xs mb-0.5">
                  <span className="flex items-center gap-1.5">
                    <Badge variant={i === 0 ? "default" : "secondary"} className="text-[9px] px-1 py-0 h-4">
                      {i + 1}º
                    </Badge>
                    <span className="text-foreground truncate max-w-[100px]">{r.nome}</span>
                  </span>
                  <span className="font-semibold text-foreground text-[10px]">{formatBrl(r.total)}</span>
                </div>
                <div className="w-full bg-secondary rounded-full h-1.5">
                  <div className="bg-accent rounded-full h-1.5 transition-all" style={{ width: `${pct}%` }} />
                </div>
              </div>
            );
          })}
        </div>
      </Card>

      {/* Margem por rep */}
      <Card className="p-4 border-border bg-card shadow-sm">
        <div className="flex items-center gap-2 mb-3">
          <Percent className="h-4 w-4 text-[hsl(var(--ca-orange))]" />
          <span className="text-xs font-semibold text-foreground">Margem por Rep</span>
        </div>
        <div className="space-y-1.5">
          {ranking.map((r, i) => {
            const margin = r.vendas > 0 ? (r.grossProfit / r.vendas) * 100 : 0;
            return (
              <div key={i} className="flex items-center justify-between text-xs">
                <span className="text-foreground truncate max-w-[100px]">{r.nome}</span>
                <span className="font-semibold text-[hsl(var(--ca-orange))]">{formatPct(margin)}</span>
              </div>
            );
          })}
        </div>
      </Card>
    </div>
  );
};

export default CommissionRanking;
