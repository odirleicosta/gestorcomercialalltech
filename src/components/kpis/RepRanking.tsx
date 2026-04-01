import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { TrendingUp, TrendingDown, Minus, Trophy } from "lucide-react";

interface RepMetric {
  id: string;
  nome: string;
  closedFobBrl: number;
  closedCount: number;
  metaValor: number;
  pctValor: number;
  winRate: number;
  yearFobBrl: number;
}

interface Props {
  repMetrics: RepMetric[];
  periodLabel: string;
}

const MEDALS = ["🥇", "🥈", "🥉"];
const formatBrl = (v: number) =>
  v >= 1000000 ? `R$ ${(v / 1000000).toFixed(1)}M` : v >= 1000 ? `R$ ${(v / 1000).toFixed(0)}k` : `R$ ${v.toFixed(0)}`;

const getInitials = (name: string) =>
  name.split(" ").slice(0, 2).map(w => w[0]).join("").toUpperCase();

const AVATAR_COLORS = [
  "bg-primary text-primary-foreground",
  "bg-accent text-accent-foreground",
  "bg-[hsl(220,70%,55%)] text-white",
  "bg-[hsl(280,60%,55%)] text-white",
  "bg-[hsl(30,80%,55%)] text-white",
  "bg-[hsl(160,60%,45%)] text-white",
];

const RepRanking = ({ repMetrics, periodLabel }: Props) => {
  const sorted = [...repMetrics].sort((a, b) => b.closedFobBrl - a.closedFobBrl);

  return (
    <Card className="p-4 border-border bg-card">
      <h3 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
        <Trophy className="h-4 w-4 text-primary" />
        Ranking de Representantes — {periodLabel}
      </h3>

      <div className="space-y-3">
        {sorted.map((rep, i) => {
          const medal = i < 3 ? MEDALS[i] : null;
          const pct = rep.pctValor;
          const colorIdx = i % AVATAR_COLORS.length;
          const progressColor = pct >= 100
            ? "[&>div]:bg-accent"
            : pct >= 70
              ? "[&>div]:bg-primary"
              : "[&>div]:bg-destructive";

          return (
            <div
              key={rep.id}
              className={`flex items-center gap-3 p-3 rounded-xl border transition-all ${
                i === 0
                  ? "bg-primary/5 border-primary/30 shadow-sm"
                  : "bg-secondary/20 border-border"
              }`}
            >
              {/* Position */}
              <div className="flex flex-col items-center w-8 shrink-0">
                {medal ? (
                  <span className="text-xl">{medal}</span>
                ) : (
                  <span className="text-sm font-bold text-muted-foreground">#{i + 1}</span>
                )}
              </div>

              {/* Avatar */}
              <div className={`flex h-9 w-9 items-center justify-center rounded-full text-xs font-bold shrink-0 ${AVATAR_COLORS[colorIdx]}`}>
                {getInitials(rep.nome)}
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-sm font-semibold text-foreground truncate">{rep.nome}</span>
                  {rep.pctValor >= 100 && (
                    <Badge className="text-[9px] bg-accent/20 text-accent border-accent/30 shrink-0">
                      Meta Batida
                    </Badge>
                  )}
                  {rep.winRate >= 60 && (
                    <Badge variant="secondary" className="text-[9px] shrink-0">
                      🔥 Top Closer
                    </Badge>
                  )}
                </div>

                {/* Progress bar */}
                <div className="flex items-center gap-2">
                  <Progress value={Math.min(pct, 100)} className={`h-2 flex-1 ${progressColor}`} />
                  <span className={`text-xs font-bold shrink-0 ${pct >= 100 ? "text-accent" : pct >= 70 ? "text-primary" : "text-destructive"}`}>
                    {pct.toFixed(0)}%
                  </span>
                </div>

                {/* Details */}
                <div className="flex items-center gap-3 mt-1 text-[10px] text-muted-foreground">
                  <span>{formatBrl(rep.closedFobBrl)}</span>
                  <span>·</span>
                  <span>{rep.closedCount} máq</span>
                  <span>·</span>
                  <span>Win: {rep.winRate.toFixed(0)}%</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {sorted.length === 0 && (
        <p className="text-xs text-muted-foreground text-center py-4">Nenhum dado disponível</p>
      )}
    </Card>
  );
};

export default RepRanking;
