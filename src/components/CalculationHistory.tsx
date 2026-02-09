import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface Calculation {
  id: string;
  machine_name: string;
  fob_cost: number;
  estimated_tax_percent: number;
  estimated_tax_value: number;
  desired_margin_percent: number;
  selling_price: number;
  estimated_profit: number;
  real_tax_value: number | null;
  real_profit: number | null;
  real_margin_percent: number | null;
  min_acceptable_margin: number;
  observation: string | null;
  created_at: string;
}

const CalculationHistory = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [calculations, setCalculations] = useState<Calculation[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchCalculations = async () => {
    if (!user) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("calculations")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    } else {
      setCalculations(data || []);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchCalculations();
  }, [user]);

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from("calculations").delete().eq("id", id);
    if (error) {
      toast({ title: "Erro ao excluir", description: error.message, variant: "destructive" });
    } else {
      setCalculations((prev) => prev.filter((c) => c.id !== id));
    }
  };

  const fmt = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  const fmtPct = (v: number) => v.toFixed(2) + "%";

  if (loading) return <p className="text-muted-foreground text-center py-8">Carregando...</p>;

  if (calculations.length === 0)
    return <p className="text-muted-foreground text-center py-8">Nenhum cálculo salvo ainda.</p>;

  return (
    <Card className="border-border bg-card p-4 shadow-sm overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Data</TableHead>
            <TableHead>Máquina</TableHead>
            <TableHead className="text-right">FOB</TableHead>
            <TableHead className="text-right">Imp. Est.</TableHead>
            <TableHead className="text-right">Preço Venda</TableHead>
            <TableHead className="text-right">Lucro Est.</TableHead>
            <TableHead className="text-right">Imp. Real</TableHead>
            <TableHead className="text-right">Lucro Real</TableHead>
            <TableHead className="text-right">Margem Real</TableHead>
            <TableHead></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {calculations.map((c) => {
            const belowMin = c.real_margin_percent !== null && c.min_acceptable_margin > 0 && c.real_margin_percent < c.min_acceptable_margin;
            return (
              <TableRow key={c.id} className={belowMin ? "bg-destructive/5" : ""}>
                <TableCell className="text-xs whitespace-nowrap">
                  {new Date(c.created_at).toLocaleDateString("pt-BR")}
                </TableCell>
                <TableCell className="font-medium">{c.machine_name || "—"}</TableCell>
                <TableCell className="text-right">{fmt(c.fob_cost)}</TableCell>
                <TableCell className="text-right">{fmtPct(c.estimated_tax_percent)}</TableCell>
                <TableCell className="text-right font-semibold">{fmt(c.selling_price)}</TableCell>
                <TableCell className="text-right text-accent">{fmt(c.estimated_profit)}</TableCell>
                <TableCell className="text-right">{c.real_tax_value !== null ? fmt(c.real_tax_value) : "—"}</TableCell>
                <TableCell className={`text-right ${c.real_profit !== null && c.real_profit < 0 ? "text-destructive" : "text-accent"}`}>
                  {c.real_profit !== null ? fmt(c.real_profit) : "—"}
                </TableCell>
                <TableCell className={`text-right font-semibold ${belowMin ? "text-destructive" : ""}`}>
                  {c.real_margin_percent !== null ? fmtPct(c.real_margin_percent) : "—"}
                </TableCell>
                <TableCell>
                  <Button variant="ghost" size="icon" onClick={() => handleDelete(c.id)}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </Card>
  );
};

export default CalculationHistory;
