import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { MapPin, Users } from "lucide-react";

interface Deal {
  representative_id: string | null;
  status: string;
  closed_at: string | null;
  base_price: number;
  dollar_rate: number;
}

interface Rep {
  id: string;
  nome: string;
  regiao?: string | null;
}

interface Props {
  deals: Deal[];
  reps: Rep[];
  filterYear: number;
  activeMonths: number[];
}

const formatBrl = (v: number) =>
  v >= 1000000 ? `R$ ${(v / 1000000).toFixed(1)}M` : v >= 1000 ? `R$ ${(v / 1000).toFixed(0)}k` : `R$ ${v.toFixed(0)}`;

const HEAT_LEVELS = [
  { min: 0, bg: "bg-muted", text: "text-muted-foreground", border: "border-border" },
  { min: 1, bg: "bg-primary/10", text: "text-primary", border: "border-primary/20" },
  { min: 3, bg: "bg-primary/20", text: "text-primary", border: "border-primary/30" },
  { min: 6, bg: "bg-primary/30", text: "text-primary", border: "border-primary/40" },
  { min: 10, bg: "bg-primary/50", text: "text-primary-foreground", border: "border-primary/60" },
];

const getHeatLevel = (count: number) => {
  for (let i = HEAT_LEVELS.length - 1; i >= 0; i--) {
    if (count >= HEAT_LEVELS[i].min) return HEAT_LEVELS[i];
  }
  return HEAT_LEVELS[0];
};

const RegionHeatmap = ({ deals, reps, filterYear, activeMonths }: Props) => {
  const closedDeals = deals.filter(d => {
    if (d.status !== "closed" || !d.closed_at) return false;
    const dt = new Date(d.closed_at);
    return dt.getFullYear() === filterYear && activeMonths.includes(dt.getMonth() + 1);
  });

  // Group by region
  const regionMap: Record<string, { count: number; value: number; reps: string[] }> = {};

  reps.forEach(rep => {
    const region = rep.regiao || "Sem Região";
    if (!regionMap[region]) regionMap[region] = { count: 0, value: 0, reps: [] };
    regionMap[region].reps.push(rep.nome.split(" ")[0]);

    const repDeals = closedDeals.filter(d => d.representative_id === rep.id);
    regionMap[region].count += repDeals.length;
    regionMap[region].value += repDeals.reduce((s, d) => s + d.base_price * (d.dollar_rate || 0), 0);
  });

  const regions = Object.entries(regionMap)
    .map(([name, data]) => ({ name, ...data }))
    .sort((a, b) => b.value - a.value);

  const maxValue = Math.max(...regions.map(r => r.value), 1);

  return (
    <Card className="p-4 border-border bg-card">
      <h3 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
        <MapPin className="h-4 w-4 text-primary" />
        Vendas por Região
      </h3>

      {regions.length === 0 ? (
        <p className="text-xs text-muted-foreground text-center py-4">Nenhum dado disponível</p>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {regions.map(region => {
            const heat = getHeatLevel(region.count);
            const pct = (region.value / maxValue) * 100;
            return (
              <div
                key={region.name}
                className={`p-3 rounded-xl border ${heat.bg} ${heat.border} transition-all hover:scale-[1.02]`}
              >
                <div className="flex items-center gap-1.5 mb-2">
                  <MapPin className={`h-3.5 w-3.5 ${heat.text}`} />
                  <span className={`text-xs font-bold ${heat.text}`}>{region.name}</span>
                </div>

                <p className={`text-lg font-bold ${heat.text}`}>{formatBrl(region.value)}</p>

                <div className="h-1.5 w-full bg-background/50 rounded-full overflow-hidden mt-2 mb-2">
                  <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${pct}%` }} />
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-muted-foreground">{region.count} máq</span>
                  <div className="flex items-center gap-1">
                    <Users className="h-3 w-3 text-muted-foreground" />
                    <span className="text-[10px] text-muted-foreground">{region.reps.join(", ")}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Legend */}
      <div className="flex items-center gap-3 mt-4 pt-3 border-t border-border">
        <span className="text-[10px] text-muted-foreground">Intensidade:</span>
        <div className="flex items-center gap-1">
          {["bg-muted", "bg-primary/10", "bg-primary/20", "bg-primary/30", "bg-primary/50"].map((bg, i) => (
            <div key={i} className={`h-3 w-6 rounded ${bg}`} />
          ))}
        </div>
        <span className="text-[10px] text-muted-foreground">Baixa → Alta</span>
      </div>
    </Card>
  );
};

export default RegionHeatmap;
