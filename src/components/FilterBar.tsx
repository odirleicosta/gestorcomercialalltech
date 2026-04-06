import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "lucide-react";

const SHORT_MONTHS = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

interface Rep {
  id: string;
  nome: string;
}

interface FilterBarProps {
  year: number;
  onYearChange: (y: number) => void;
  periodMode: "month" | "quarter" | "year" | "week";
  onPeriodModeChange: (m: "month" | "quarter" | "year" | "week") => void;
  month: number; // 1-indexed
  onMonthChange: (m: number) => void;
  quarter: string; // "T1"-"T4"
  onQuarterChange: (q: string) => void;
  showRep?: boolean;
  rep?: string;
  onRepChange?: (r: string) => void;
  reps?: Rep[];
  showWeek?: boolean;
  week?: number;
  onWeekChange?: (w: number) => void;
  maxWeek?: number;
  yearOptions?: number[];
}

const PillBtn = ({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) => (
  <button
    onClick={onClick}
    className={`px-2.5 py-1 rounded-full text-[10px] sm:text-xs font-medium transition-all whitespace-nowrap ${
      active
        ? "bg-primary text-primary-foreground shadow-sm"
        : "bg-secondary/70 text-muted-foreground hover:bg-secondary border border-border"
    }`}
  >
    {children}
  </button>
);

const FilterBar = ({
  year,
  onYearChange,
  periodMode,
  onPeriodModeChange,
  month,
  onMonthChange,
  quarter,
  onQuarterChange,
  showRep = false,
  rep = "all",
  onRepChange,
  reps = [],
  showWeek = false,
  week,
  onWeekChange,
  maxWeek = 52,
  yearOptions,
}: FilterBarProps) => {
  const years = yearOptions || [year - 1, year, year + 1];

  return (
    <div className="flex items-center gap-2 flex-wrap rounded-xl border border-border bg-card/80 backdrop-blur-sm px-3 py-2">
      <Calendar className="h-3.5 w-3.5 text-muted-foreground shrink-0 hidden sm:block" />

      {/* Year */}
      <Select value={String(year)} onValueChange={v => onYearChange(parseInt(v))}>
        <SelectTrigger className="w-[72px] h-7 text-xs bg-secondary/50 border-border">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {years.map(y => (
            <SelectItem key={y} value={String(y)}>{y}</SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Separator */}
      <div className="w-px h-5 bg-border hidden sm:block" />

      {/* Period mode pills */}
      <div className="flex items-center gap-1">
        <PillBtn active={periodMode === "month"} onClick={() => onPeriodModeChange("month")}>Mês</PillBtn>
        {["T1", "T2", "T3", "T4"].map(q => (
          <PillBtn
            key={q}
            active={periodMode === "quarter" && quarter === q}
            onClick={() => { onPeriodModeChange("quarter"); onQuarterChange(q); }}
          >
            {q}
          </PillBtn>
        ))}
        <PillBtn active={periodMode === "year"} onClick={() => onPeriodModeChange("year")}>Ano</PillBtn>
      </div>

      {/* Month selector (only in month mode) */}
      {periodMode === "month" && (
        <>
          <div className="w-px h-5 bg-border hidden sm:block" />
          <Select value={String(month)} onValueChange={v => onMonthChange(parseInt(v))}>
            <SelectTrigger className="w-[72px] h-7 text-xs bg-secondary/50 border-border">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {SHORT_MONTHS.map((m, i) => (
                <SelectItem key={i} value={String(i + 1)}>{m}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </>
      )}

      {/* Week selector */}
      {showWeek && periodMode === "month" && week !== undefined && onWeekChange && (
        <>
          <div className="w-px h-5 bg-border hidden sm:block" />
          <Select value={String(week)} onValueChange={v => onWeekChange(parseInt(v))}>
            <SelectTrigger className="w-[90px] h-7 text-xs bg-secondary/50 border-border">
              <SelectValue placeholder="Semana" />
            </SelectTrigger>
            <SelectContent>
              {Array.from({ length: maxWeek }, (_, i) => i + 1).map(w => (
                <SelectItem key={w} value={String(w)}>Sem {w}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </>
      )}

      {/* Rep selector */}
      {showRep && reps.length > 0 && onRepChange && (
        <>
          <div className="w-px h-5 bg-border hidden sm:block" />
          <Select value={rep} onValueChange={onRepChange}>
            <SelectTrigger className="w-[120px] h-7 text-xs bg-secondary/50 border-border">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              {reps.map(r => (
                <SelectItem key={r.id} value={r.id}>{r.nome}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </>
      )}
    </div>
  );
};

export default FilterBar;
