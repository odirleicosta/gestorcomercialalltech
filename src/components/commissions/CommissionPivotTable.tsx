import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Users } from "lucide-react";

export interface DealCommission {
  id: string;
  client_name: string;
  machine_name: string;
  machine_type: string;
  base_price: number;
  final_price: number;
  fob_cost: number;
  gross_profit: number;
  gross_margin_percent: number;
  seller_commission_pct: number;
  manager_commission_pct: number;
  seller_commission_value: number;
  manager_commission_value: number;
  representative_id: string | null;
  dollar_rate: number;
  status: string;
  closed_at: string | null;
  created_at: string;
}

export interface PivotRow {
  repId: string;
  nome: string;
  months: number[];
  monthDeals: DealCommission[][];
  total: number;
  type: 'seller' | 'manager';
}

interface Props {
  rows: PivotRow[];
  monthColumnTotals: number[];
  grandTotal: number;
  filterYear: number;
  onCellClick: (repName: string, month: string, deals: DealCommission[], type: 'seller' | 'manager') => void;
}

const SHORT_MONTHS = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
const MONTHS = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];

const formatBrl = (v: number) =>
  `R$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const formatBrlShort = (v: number) => {
  if (v >= 1000) return `R$ ${(v / 1000).toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}k`;
  return formatBrl(v);
};

const CommissionPivotTable = ({ rows, monthColumnTotals, grandTotal, filterYear, onCellClick }: Props) => {
  if (rows.length === 0) {
    return (
      <Card className="border-border bg-card p-6 shadow-sm">
        <h3 className="font-heading text-sm sm:text-base font-semibold text-card-foreground mb-4 flex items-center gap-2">
          <Users className="h-4 w-4" /> Comissão por Representante — Mês a Mês ({filterYear})
        </h3>
        <p className="text-muted-foreground text-center py-6 text-sm">Nenhuma comissão registrada neste ano.</p>
      </Card>
    );
  }

  return (
    <Card className="border-border bg-card p-4 sm:p-6 shadow-sm">
      <h3 className="font-heading text-sm sm:text-base font-semibold text-card-foreground mb-4 flex items-center gap-2">
        <Users className="h-4 w-4" /> Comissão por Representante — Mês a Mês ({filterYear})
      </h3>
      <ScrollArea className="max-h-[400px]">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="sticky left-0 bg-card z-10 min-w-[120px] text-xs">Representante</TableHead>
                {SHORT_MONTHS.map(m => (
                  <TableHead key={m} className="text-right text-[10px] sm:text-xs min-w-[70px]">{m}</TableHead>
                ))}
                <TableHead className="text-right font-bold text-[10px] sm:text-xs min-w-[90px]">Total</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map(r => (
                <TableRow key={r.repId} className={r.repId === "__gestor__" ? "border-t-2 border-primary/30 bg-primary/5" : ""}>
                  <TableCell className={`font-medium text-xs sticky left-0 z-10 ${r.repId === "__gestor__" ? "bg-primary/5 text-primary font-bold" : "bg-card"}`}>
                    {r.nome}
                  </TableCell>
                  {r.months.map((v, i) => (
                    <TableCell
                      key={i}
                      className={`text-right text-[10px] sm:text-xs ${v > 0 ? "cursor-pointer hover:bg-primary/10 text-foreground font-medium" : "text-muted-foreground/40"}`}
                      onClick={() => {
                        if (v > 0) onCellClick(r.nome, MONTHS[i], r.monthDeals[i], r.type);
                      }}
                    >
                      {v > 0 ? formatBrlShort(v) : "—"}
                    </TableCell>
                  ))}
                  <TableCell className="text-right text-xs font-bold">{formatBrl(r.total)}</TableCell>
                </TableRow>
              ))}
              <TableRow className="border-t-2 border-primary/30 bg-primary/5 font-bold">
                <TableCell className="font-bold text-xs sticky left-0 bg-primary/5 z-10">TOTAL</TableCell>
                {monthColumnTotals.map((v, i) => (
                  <TableCell key={i} className="text-right text-[10px] sm:text-xs font-bold">
                    {v > 0 ? formatBrlShort(v) : "—"}
                  </TableCell>
                ))}
                <TableCell className="text-right text-xs font-bold">{formatBrl(grandTotal)}</TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </div>
      </ScrollArea>
    </Card>
  );
};

export default CommissionPivotTable;
