import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { DealCommission } from "./CommissionPivotTable";

interface ModalData {
  repName: string;
  month: string;
  deals: DealCommission[];
  type: 'seller' | 'manager';
}

interface Props {
  data: ModalData | null;
  filterYear: number;
  onClose: () => void;
}

const formatUsd = (v: number) =>
  `US$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const formatPct = (v: number) =>
  v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + "%";

const CommissionDetailModal = ({ data, filterYear, onClose }: Props) => {
  return (
    <Dialog open={!!data} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="text-base">
            Comissões — {data?.repName} — {data?.month}/{filterYear}
          </DialogTitle>
        </DialogHeader>
        {data && (
          <ScrollArea className="max-h-[400px]">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Máquina</TableHead>
                  <TableHead className="text-right">FOB (USD)</TableHead>
                  <TableHead className="text-right">% Vend.</TableHead>
                  <TableHead className="text-right">% Gestor</TableHead>
                  <TableHead className="text-right">Com. Vend.</TableHead>
                  <TableHead className="text-right">Com. Gestor</TableHead>
                  <TableHead className="text-right">Dólar</TableHead>
                  <TableHead className="text-right">Pago (R$)</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.deals.map(d => {
                  const relevantComm = data.type === 'manager' ? d.manager_commission_value : d.seller_commission_value;
                  const commBrl = relevantComm * (d.dollar_rate || 0);
                  return (
                    <TableRow key={d.id}>
                      <TableCell className="text-sm">{d.client_name}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{d.machine_name || "—"}</TableCell>
                      <TableCell className="text-right text-sm">{formatUsd(d.fob_cost)}</TableCell>
                      <TableCell className="text-right text-sm">{formatPct(d.seller_commission_pct)}</TableCell>
                      <TableCell className="text-right text-sm">{formatPct(d.manager_commission_pct)}</TableCell>
                      <TableCell className={`text-right text-sm ${data.type === 'seller' ? 'font-semibold' : 'text-muted-foreground'}`}>{formatUsd(d.seller_commission_value)}</TableCell>
                      <TableCell className={`text-right text-sm ${data.type === 'manager' ? 'font-semibold text-primary' : 'text-muted-foreground'}`}>{formatUsd(d.manager_commission_value)}</TableCell>
                      <TableCell className="text-right text-sm text-muted-foreground">
                        R$ {d.dollar_rate.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                      </TableCell>
                      <TableCell className="text-right text-sm font-semibold text-accent">
                        R$ {commBrl.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </TableCell>
                    </TableRow>
                  );
                })}
                <TableRow className="border-t-2 border-primary/30 bg-primary/5 font-bold">
                  <TableCell colSpan={7} className="font-bold text-sm">TOTAL</TableCell>
                  <TableCell />
                  <TableCell className="text-right font-bold text-sm text-accent">
                    R$ {data.deals.reduce((s, d) => {
                      const comm = data.type === 'manager' ? d.manager_commission_value : d.seller_commission_value;
                      return s + comm * (d.dollar_rate || 0);
                    }, 0).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </ScrollArea>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default CommissionDetailModal;
