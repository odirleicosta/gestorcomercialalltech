import { Card } from "@/components/ui/card";
import { DollarSign, Users, TrendingUp, Percent, BarChart3 } from "lucide-react";

interface Props {
  totalComm: number;
  sellerTotal: number;
  managerTotal: number;
  pctFaturamento: number;
  commPerMachine: number;
  count: number;
}

const formatBrl = (v: number) =>
  `R$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const formatPct = (v: number) =>
  v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + "%";

const kpiConfig = [
  { key: "totalComm", label: "Total Comissões", icon: DollarSign, color: "bg-primary/10 text-primary" },
  { key: "sellerTotal", label: "Com. Vendedores", icon: Users, color: "bg-accent/10 text-accent" },
  { key: "managerTotal", label: "Com. Gestor", icon: TrendingUp, color: "bg-[hsl(var(--ca-blue))]/10 text-[hsl(var(--ca-blue))]" },
  { key: "pctFaturamento", label: "% s/ Faturamento", icon: Percent, color: "bg-[hsl(var(--ca-orange))]/10 text-[hsl(var(--ca-orange))]" },
  { key: "commPerMachine", label: "Com. Média/Máq", icon: BarChart3, color: "bg-[hsl(var(--ca-orange))]/10 text-[hsl(var(--ca-orange))]" },
] as const;

const CommissionKPIs = ({ totalComm, sellerTotal, managerTotal, pctFaturamento, commPerMachine, count }: Props) => {
  const values: Record<string, string> = {
    totalComm: formatBrl(totalComm),
    sellerTotal: formatBrl(sellerTotal),
    managerTotal: formatBrl(managerTotal),
    pctFaturamento: count > 0 ? formatPct(pctFaturamento) : "—",
    commPerMachine: count > 0 ? formatBrl(commPerMachine) : "—",
  };

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
      {kpiConfig.map(({ key, label, icon: Icon, color }) => (
        <Card key={key} className="p-3 sm:p-4 border-border bg-card shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center gap-2 mb-1.5">
            <div className={`flex h-7 w-7 sm:h-8 sm:w-8 items-center justify-center rounded-lg ${color}`}>
              <Icon className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
            </div>
            <span className="text-[10px] sm:text-xs text-muted-foreground leading-tight">{label}</span>
          </div>
          <p className="text-sm sm:text-lg font-bold text-foreground truncate">{values[key]}</p>
        </Card>
      ))}
    </div>
  );
};

export default CommissionKPIs;
