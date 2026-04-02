import { useState, useEffect, useMemo, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import { Eye, Users, Target, TrendingUp, Save, Calendar } from "lucide-react";

interface Props {
  userId: string;
}

interface Rep {
  id: string;
  nome: string;
}

interface VisitRow {
  representative_id: string;
  nome: string;
  meta: number;
  quantidade: number;
}

const DEFAULT_META = 16;

const getWeekNumber = (d: Date): number => {
  const start = new Date(d.getFullYear(), 0, 1);
  const diff = d.getTime() - start.getTime() + (start.getTimezoneOffset() - d.getTimezoneOffset()) * 60000;
  return Math.ceil((diff / 86400000 + start.getDay() + 1) / 7);
};

const currentYear = new Date().getFullYear();
const currentWeek = getWeekNumber(new Date());

const RepKPIs = ({ userId }: Props) => {
  const [reps, setReps] = useState<Rep[]>([]);
  const [filterYear, setFilterYear] = useState(currentYear);
  const [filterWeek, setFilterWeek] = useState(currentWeek);
  const [visits, setVisits] = useState<VisitRow[]>([]);
  const [saving, setSaving] = useState(false);
  const [loaded, setLoaded] = useState(false);

  // Load reps
  useEffect(() => {
    const load = async () => {
      const { data } = await supabase
        .from("representatives")
        .select("id, nome")
        .eq("user_id", userId)
        .eq("status", "ATIVO")
        .order("nome");
      if (data) setReps(data);
    };
    load();
  }, [userId]);

  // Load visits for selected week
  useEffect(() => {
    if (!reps.length) return;
    const load = async () => {
      const { data } = await supabase
        .from("weekly_visits")
        .select("representative_id, quantidade, meta")
        .eq("user_id", userId)
        .eq("ano", filterYear)
        .eq("semana", filterWeek);

      const rows: VisitRow[] = reps.map((r) => {
        const existing = data?.find((v) => v.representative_id === r.id);
        return {
          representative_id: r.id,
          nome: r.nome,
          meta: existing?.meta ?? DEFAULT_META,
          quantidade: existing?.quantidade ?? 0,
        };
      });
      setVisits(rows);
      setLoaded(true);
    };
    load();
  }, [reps, filterYear, filterWeek, userId]);

  const handleChange = useCallback((repId: string, value: string) => {
    const num = Math.max(0, parseInt(value) || 0);
    setVisits((prev) =>
      prev.map((v) => (v.representative_id === repId ? { ...v, quantidade: num } : v))
    );
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      for (const row of visits) {
        const { error } = await supabase
          .from("weekly_visits")
          .upsert(
            {
              user_id: userId,
              representative_id: row.representative_id,
              ano: filterYear,
              semana: filterWeek,
              quantidade: row.quantidade,
              meta: row.meta,
            },
            { onConflict: "user_id,representative_id,ano,semana" }
          );
        if (error) throw error;
      }
      toast.success("Visitas salvas com sucesso!");
    } catch (e: any) {
      toast.error("Erro ao salvar: " + e.message);
    } finally {
      setSaving(false);
    }
  };

  // KPIs
  const kpis = useMemo(() => {
    const totalVisitas = visits.reduce((s, v) => s + v.quantidade, 0);
    const totalMeta = visits.reduce((s, v) => s + v.meta, 0);
    const pctEquipe = totalMeta > 0 ? (totalVisitas / totalMeta) * 100 : 0;
    const media = visits.length > 0 ? totalVisitas / visits.length : 0;
    return { totalVisitas, totalMeta, pctEquipe, media };
  }, [visits]);

  // Week options (1-52)
  const weekOptions = useMemo(() => {
    const maxWeek = filterYear === currentYear ? currentWeek : 52;
    return Array.from({ length: maxWeek }, (_, i) => i + 1);
  }, [filterYear]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-foreground flex items-center gap-2">
            <Eye className="h-5 w-5 text-primary" />
            Visitas da Semana
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            Controle semanal de visitas por representante
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={String(filterYear)} onValueChange={(v) => setFilterYear(Number(v))}>
            <SelectTrigger className="w-24">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {[currentYear - 1, currentYear, currentYear + 1].map((y) => (
                <SelectItem key={y} value={String(y)}>
                  {y}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={String(filterWeek)} onValueChange={(v) => setFilterWeek(Number(v))}>
            <SelectTrigger className="w-36">
              <Calendar className="h-4 w-4 mr-1" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {weekOptions.map((w) => (
                <SelectItem key={w} value={String(w)}>
                  Semana {w}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KpiCard
          icon={<Eye className="h-5 w-5" />}
          label="Total Visitas"
          value={String(kpis.totalVisitas)}
          color="text-primary"
        />
        <KpiCard
          icon={<Target className="h-5 w-5" />}
          label="Meta Equipe"
          value={String(kpis.totalMeta)}
          color="text-muted-foreground"
        />
        <KpiCard
          icon={<TrendingUp className="h-5 w-5" />}
          label="% Atingimento"
          value={`${kpis.pctEquipe.toFixed(0)}%`}
          color={kpis.pctEquipe >= 80 ? "text-green-500" : kpis.pctEquipe >= 50 ? "text-yellow-500" : "text-destructive"}
        />
        <KpiCard
          icon={<Users className="h-5 w-5" />}
          label="Média / Vendedor"
          value={kpis.media.toFixed(1)}
          color="text-primary"
        />
      </div>

      {/* Table */}
      <Card className="overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50">
              <TableHead className="font-semibold">Representante</TableHead>
              <TableHead className="text-center font-semibold w-28">Meta</TableHead>
              <TableHead className="text-center font-semibold w-36">Visitas Realizadas</TableHead>
              <TableHead className="text-center font-semibold w-40">% Atingido</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {visits.map((row) => {
              const pct = row.meta > 0 ? (row.quantidade / row.meta) * 100 : 0;
              return (
                <TableRow key={row.representative_id}>
                  <TableCell className="font-medium">{row.nome}</TableCell>
                  <TableCell className="text-center">
                    <Badge variant="secondary">{row.meta}</Badge>
                  </TableCell>
                  <TableCell className="text-center">
                    <Input
                      type="number"
                      min={0}
                      className="w-20 mx-auto text-center h-9"
                      value={row.quantidade || ""}
                      onChange={(e) => handleChange(row.representative_id, e.target.value)}
                      placeholder="0"
                    />
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2 justify-center">
                      <Progress
                        value={Math.min(pct, 100)}
                        className="h-2 w-20"
                      />
                      <span
                        className={`text-sm font-semibold min-w-[3rem] text-right ${
                          pct >= 100
                            ? "text-green-500"
                            : pct >= 50
                            ? "text-yellow-500"
                            : "text-destructive"
                        }`}
                      >
                        {pct.toFixed(0)}%
                      </span>
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
            {visits.length === 0 && loaded && (
              <TableRow>
                <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                  Nenhum representante cadastrado. Cadastre na aba "Representantes".
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Card>

      {/* Save button */}
      {visits.length > 0 && (
        <div className="flex justify-end">
          <Button onClick={handleSave} disabled={saving} size="lg">
            <Save className="h-4 w-4 mr-2" />
            {saving ? "Salvando..." : "Salvar Visitas"}
          </Button>
        </div>
      )}
    </div>
  );
};

const KpiCard = ({ icon, label, value, color }: { icon: React.ReactNode; label: string; value: string; color: string }) => (
  <Card className="p-4">
    <div className="flex items-center gap-2 mb-1">
      <span className={color}>{icon}</span>
      <span className="text-xs text-muted-foreground font-medium">{label}</span>
    </div>
    <p className={`text-2xl font-bold ${color}`}>{value}</p>
  </Card>
);

export default RepKPIs;
