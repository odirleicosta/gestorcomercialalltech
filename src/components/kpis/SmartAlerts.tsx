import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, AlertCircle, Clock, TrendingDown, Users, ShieldAlert } from "lucide-react";

interface Deal {
  representative_id: string | null;
  status: string;
  closed_at: string | null;
  base_price: number;
  dollar_rate: number;
  client_name?: string;
}

interface ClosingDeal {
  id: string;
  representative_id: string | null;
  status: string;
  deal_value: number;
  updated_at?: string;
  client_name?: string;
}

interface Visit {
  representative_id: string;
  semana: number;
  quantidade: number;
  ano: number;
}

interface Rep {
  id: string;
  nome: string;
}

interface Props {
  deals: Deal[];
  closingDeals: ClosingDeal[];
  visits: Visit[];
  reps: Rep[];
  filterYear: number;
  activeMonths: number[];
}

interface Alert {
  type: "critical" | "warning" | "info";
  icon: React.ReactNode;
  title: string;
  description: string;
}

const SmartAlerts = ({ deals, closingDeals, visits, reps, filterYear, activeMonths }: Props) => {
  const now = new Date();
  const currentWeek = Math.ceil(((now.getTime() - new Date(now.getFullYear(), 0, 1).getTime()) / 86400000 + 1) / 7);
  const alerts: Alert[] = [];


  // 2. Pipeline estagnado (negociações sem update há 7+ dias)
  const stagnatedDeals = closingDeals.filter(c => {
    if (c.status !== "ativa" || !c.updated_at) return false;
    const daysSince = Math.floor((now.getTime() - new Date(c.updated_at).getTime()) / 86400000);
    return daysSince >= 7;
  });
  if (stagnatedDeals.length > 0) {
    alerts.push({
      type: stagnatedDeals.length >= 5 ? "critical" : "warning",
      icon: <AlertTriangle className="h-4 w-4" />,
      title: `${stagnatedDeals.length} negociação(ões) estagnada(s)`,
      description: "Sem atualização há mais de 7 dias. Risco de perda por inatividade.",
    });
  }

  // 3. Concentração de vendas
  const closedDeals = deals.filter(d => {
    if (d.status !== "closed" || !d.closed_at) return false;
    const dt = new Date(d.closed_at);
    return dt.getFullYear() === filterYear && activeMonths.includes(dt.getMonth() + 1);
  });
  const totalRevenue = closedDeals.reduce((s, d) => s + d.base_price * (d.dollar_rate || 0), 0);
  if (totalRevenue > 0) {
    const clientRevenue: Record<string, number> = {};
    closedDeals.forEach(d => {
      const client = (d as any).client_name || "Desconhecido";
      clientRevenue[client] = (clientRevenue[client] || 0) + d.base_price * (d.dollar_rate || 0);
    });
    const topClient = Object.entries(clientRevenue).sort((a, b) => b[1] - a[1])[0];
    if (topClient) {
      const concentration = (topClient[1] / totalRevenue) * 100;
      if (concentration >= 30) {
        alerts.push({
          type: concentration >= 50 ? "critical" : "warning",
          icon: <ShieldAlert className="h-4 w-4" />,
          title: `Concentração: ${topClient[0]} = ${concentration.toFixed(0)}% do faturamento`,
          description: "Risco de dependência excessiva de um único cliente.",
        });
      }
    }
  }

  // 4. Queda de conversão (comparando meses)
  const currentMonthIdx = now.getMonth();
  const prevMonthIdx = currentMonthIdx - 1;
  if (prevMonthIdx >= 0 && filterYear === now.getFullYear()) {
    const getMonthWinRate = (monthIdx: number) => {
      const monthClosing = closingDeals.filter(c => {
        const dt = new Date(c.updated_at || "");
        return dt.getFullYear() === filterYear && dt.getMonth() === monthIdx;
      });
      const won = monthClosing.filter(c => c.status === "ganha").length;
      const lost = monthClosing.filter(c => c.status === "perdida").length;
      const total = won + lost;
      return total > 0 ? (won / total) * 100 : -1;
    };
    const currentWR = getMonthWinRate(currentMonthIdx);
    const prevWR = getMonthWinRate(prevMonthIdx);
    if (currentWR >= 0 && prevWR >= 0 && prevWR > 0) {
      const drop = prevWR - currentWR;
      if (drop >= 15) {
        alerts.push({
          type: drop >= 30 ? "critical" : "warning",
          icon: <TrendingDown className="h-4 w-4" />,
          title: `Taxa de conversão caiu ${drop.toFixed(0)}pp`,
          description: `De ${prevWR.toFixed(0)}% para ${currentWR.toFixed(0)}% em relação ao mês anterior.`,
        });
      }
    }
  }

  if (alerts.length === 0) return null;

  // Sort: critical first
  alerts.sort((a, b) => (a.type === "critical" ? -1 : a.type === "warning" ? 0 : 1) - (b.type === "critical" ? -1 : b.type === "warning" ? 0 : 1));

  return (
    <Card className="p-4 border-border bg-card">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
          <AlertCircle className="h-4 w-4 text-destructive" />
          Alertas Inteligentes
        </h3>
        <Badge variant="destructive" className="text-xs">
          {alerts.length} alerta{alerts.length > 1 ? "s" : ""}
        </Badge>
      </div>

      <div className="space-y-2">
        {alerts.map((alert, i) => (
          <div
            key={i}
            className={`flex items-start gap-3 p-3 rounded-lg border ${
              alert.type === "critical"
                ? "bg-destructive/10 border-destructive/30"
                : "bg-[hsl(var(--ca-orange))]/10 border-[hsl(var(--ca-orange))]/30"
            }`}
          >
            <div className={`shrink-0 mt-0.5 ${alert.type === "critical" ? "text-destructive" : "text-[hsl(var(--ca-orange))]"}`}>
              {alert.icon}
            </div>
            <div>
              <p className={`text-xs font-semibold ${alert.type === "critical" ? "text-destructive" : "text-foreground"}`}>
                {alert.title}
              </p>
              <p className="text-[10px] text-muted-foreground mt-0.5">{alert.description}</p>
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
};

export default SmartAlerts;
