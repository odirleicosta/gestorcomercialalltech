import { useState, useMemo, useEffect } from "react";
import FilterBar from "@/components/FilterBar";
import { DollarSign } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import CommissionKPIs from "./commissions/CommissionKPIs";
import CommissionChart from "./commissions/CommissionChart";
import CommissionPivotTable, { type DealCommission, type PivotRow } from "./commissions/CommissionPivotTable";
import CommissionRanking from "./commissions/CommissionRanking";
import CommissionDetailModal from "./commissions/CommissionDetailModal";

interface RepOption { id: string; nome: string; is_gestor?: boolean; }
interface Props { userId: string; }

const SHORT_MONTHS = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
const QUARTER_MONTHS: Record<string, number[]> = {
  T1: [0, 1, 2], T2: [3, 4, 5], T3: [6, 7, 8], T4: [9, 10, 11],
};

type PeriodMode = "year" | "quarter" | "month";

const CommissionsTab = ({ userId }: Props) => {
  const [deals, setDeals] = useState<DealCommission[]>([]);
  const [reps, setReps] = useState<RepOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalData, setModalData] = useState<{ repName: string; month: string; deals: DealCommission[]; type: 'seller' | 'manager' } | null>(null);
  const now = new Date();
  const [filterYear, setFilterYear] = useState(now.getFullYear());
  const [filterRep, setFilterRep] = useState<string>("all");
  const [periodMode, setPeriodMode] = useState<PeriodMode>("year");
  const [filterMonth, setFilterMonth] = useState(now.getMonth()); // 0-indexed
  const [filterQuarter, setFilterQuarter] = useState<string>(`T${Math.floor(now.getMonth() / 3) + 1}`);

  useEffect(() => {
    const fetchData = async () => {
      const [dealsRes, repsRes] = await Promise.all([
        supabase
          .from("deals" as any)
          .select("id, client_name, machine_name, machine_type, base_price, final_price, fob_cost, gross_profit, gross_margin_percent, seller_commission_pct, manager_commission_pct, seller_commission_value, manager_commission_value, representative_id, dollar_rate, status, closed_at, created_at")
          .order("closed_at", { ascending: false }),
        supabase
          .from("representatives" as any)
          .select("id, nome, is_gestor")
          .order("nome"),
      ]);
      if (dealsRes.data) setDeals(dealsRes.data as unknown as DealCommission[]);
      if (repsRes.data) setReps(repsRes.data as unknown as RepOption[]);
      setLoading(false);
    };
    fetchData();
  }, []);

  const getRepName = (id: string | null) => {
    if (!id) return "Sem representante";
    return reps.find(r => r.id === id)?.nome || "Desconhecido";
  };

  const activeMonths = useMemo(() => {
    if (periodMode === "year") return [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];
    if (periodMode === "quarter") return QUARTER_MONTHS[filterQuarter];
    return [filterMonth];
  }, [periodMode, filterMonth, filterQuarter]);

  const closedDeals = useMemo(() => {
    return deals.filter(d => {
      if (d.status !== "closed" || !d.closed_at) return false;
      const dt = new Date(d.closed_at);
      if (dt.getFullYear() !== filterYear) return false;
      if (!activeMonths.includes(dt.getMonth())) return false;
      if (filterRep !== "all" && d.representative_id !== filterRep) return false;
      return true;
    });
  }, [deals, filterYear, filterRep, activeMonths]);

  // Year totals
  const yearTotals = useMemo(() => {
    const sellerTotal = closedDeals.reduce((s, d) => s + d.seller_commission_value * (d.dollar_rate || 0), 0);
    const managerTotal = closedDeals.reduce((s, d) => s + d.manager_commission_value * (d.dollar_rate || 0), 0);
    const totalComm = sellerTotal + managerTotal;
    const totalVendasBrl = closedDeals.reduce((s, d) => s + d.base_price * (d.dollar_rate || 0), 0);
    const count = closedDeals.length;
    const commPerMachine = count > 0 ? totalComm / count : 0;
    const pctFaturamento = totalVendasBrl > 0 ? (totalComm / totalVendasBrl) * 100 : 0;
    return { sellerTotal, managerTotal, totalComm, totalVendasBrl, count, commPerMachine, pctFaturamento };
  }, [closedDeals]);

  // Chart data (respects period filter, ignores filterRep)
  const chartData = useMemo(() => {
    const allClosed = deals.filter(d => d.status === "closed" && d.closed_at && new Date(d.closed_at).getFullYear() === filterYear);
    return SHORT_MONTHS.map((month, i) => {
      if (!activeMonths.includes(i)) return { month, vendedor: 0, gestor: 0 };
      const monthDeals = allClosed.filter(d => new Date(d.closed_at!).getMonth() === i);
      return {
        month,
        vendedor: monthDeals.reduce((s, d) => s + d.seller_commission_value * (d.dollar_rate || 0), 0),
        gestor: monthDeals.reduce((s, d) => s + d.manager_commission_value * (d.dollar_rate || 0), 0),
      };
    });
  }, [deals, filterYear, activeMonths]);

  // Pivot table data
  const { repMonthPivot, monthColumnTotals } = useMemo(() => {
    const allClosed = deals.filter(d => d.status === "closed" && d.closed_at && new Date(d.closed_at).getFullYear() === filterYear);
    const pivot = new Map<string, PivotRow>();

    reps.forEach(r => {
      pivot.set(r.id, { repId: r.id, nome: r.nome, months: Array(12).fill(0), monthDeals: Array.from({ length: 12 }, () => []), total: 0, type: 'seller' });
    });
    const gestor = reps.find(r => r.is_gestor);
    const gestorLabel = gestor ? `🏢 ${gestor.nome} (Gestor)` : "🏢 Gestor Comercial";
    pivot.set("__gestor__", { repId: "__gestor__", nome: gestorLabel, months: Array(12).fill(0), monthDeals: Array.from({ length: 12 }, () => []), total: 0, type: 'manager' });

    allClosed.forEach(d => {
      const m = new Date(d.closed_at!).getMonth();
      if (!activeMonths.includes(m)) return;
      const rate = d.dollar_rate || 0;
      const key = d.representative_id || "__none__";
      if (!pivot.has(key)) {
        pivot.set(key, { repId: key, nome: getRepName(d.representative_id), months: Array(12).fill(0), monthDeals: Array.from({ length: 12 }, () => []), total: 0, type: 'seller' });
      }
      const se = pivot.get(key)!;
      se.months[m] += d.seller_commission_value * rate;
      se.monthDeals[m].push(d);
      se.total += d.seller_commission_value * rate;

      const ge = pivot.get("__gestor__")!;
      ge.months[m] += d.manager_commission_value * rate;
      ge.monthDeals[m].push(d);
      ge.total += d.manager_commission_value * rate;
    });

    const rows = Array.from(pivot.values()).filter(r => r.total > 0);
    const gestorRow = rows.find(r => r.repId === "__gestor__");
    const sellerRows = rows.filter(r => r.repId !== "__gestor__").sort((a, b) => b.total - a.total);
    const finalRows = gestorRow ? [...sellerRows, gestorRow] : sellerRows;

    const totals = Array(12).fill(0);
    finalRows.forEach(r => r.months.forEach((v, i) => totals[i] += v));

    return { repMonthPivot: finalRows, monthColumnTotals: totals };
  }, [deals, filterYear, reps, activeMonths]);

  // Insights / ranking
  const insights = useMemo(() => {
    if (closedDeals.length === 0) return null;
    const maxDeal = closedDeals.reduce((best, d) => {
      const comm = (d.seller_commission_value + d.manager_commission_value) * (d.dollar_rate || 0);
      const bestComm = (best.seller_commission_value + best.manager_commission_value) * (best.dollar_rate || 0);
      return comm > bestComm ? d : best;
    }, closedDeals[0]);

    const repCommMap = new Map<string, { nome: string; total: number; count: number; grossProfit: number; vendas: number }>();
    closedDeals.forEach(d => {
      const key = d.representative_id || "__none__";
      const rate = d.dollar_rate || 0;
      const existing = repCommMap.get(key) || { nome: getRepName(d.representative_id), total: 0, count: 0, grossProfit: 0, vendas: 0 };
      existing.total += (d.seller_commission_value + d.manager_commission_value) * rate;
      existing.count += 1;
      existing.grossProfit += d.gross_profit * rate;
      existing.vendas += d.base_price * rate;
      repCommMap.set(key, existing);
    });
    const ranking = Array.from(repCommMap.values()).sort((a, b) => b.total - a.total);
    return { maxDeal, ranking };
  }, [closedDeals, reps]);

  if (loading) return <p className="text-muted-foreground text-center py-8">Carregando...</p>;

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Header + Filters */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <h2 className="font-heading text-base sm:text-lg md:text-xl font-bold text-foreground flex items-center gap-2">
          <DollarSign className="h-4 w-4 sm:h-5 sm:w-5" /> Comissões
        </h2>
      </div>

      <FilterBar
        year={filterYear}
        onYearChange={setFilterYear}
        periodMode={periodMode}
        onPeriodModeChange={setPeriodMode}
        month={filterMonth + 1}
        onMonthChange={(m) => setFilterMonth(m - 1)}
        quarter={filterQuarter}
        onQuarterChange={setFilterQuarter}
        showRep
        rep={filterRep}
        onRepChange={setFilterRep}
        reps={reps}
        yearOptions={[2024, 2025, 2026, 2027]}
      />

      {/* KPIs */}
      <CommissionKPIs {...yearTotals} />

      {/* Chart */}
      <CommissionChart data={chartData} filterYear={filterYear} />

      {/* Main content: Pivot + Ranking sidebar */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_280px] gap-4 sm:gap-5">
        <CommissionPivotTable
          rows={repMonthPivot}
          monthColumnTotals={monthColumnTotals}
          grandTotal={yearTotals.totalComm}
          filterYear={filterYear}
          onCellClick={(repName, month, deals, type) => setModalData({ repName, month, deals, type })}
        />
        {insights && (
          <CommissionRanking
            ranking={insights.ranking}
            maxDeal={insights.maxDeal}
            commPerMachine={yearTotals.commPerMachine}
            count={yearTotals.count}
            getRepName={getRepName}
          />
        )}
      </div>

      {/* Detail Modal */}
      <CommissionDetailModal
        data={modalData}
        filterYear={filterYear}
        onClose={() => setModalData(null)}
      />
    </div>
  );
};

export default CommissionsTab;
