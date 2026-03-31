import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, Clock, User } from "lucide-react";

interface Negotiation {
  id: string;
  client_name?: string;
  representative_id: string | null;
  updated_at: string;
  next_step?: string | null;
  stage: string;
  status: string;
}

interface Props {
  negotiations: Negotiation[];
  reps: { id: string; nome: string }[];
}

const FollowUps = ({ negotiations, reps }: Props) => {
  const now = new Date();

  const followUps = negotiations
    .filter((n) => n.status === "ativa")
    .map((n) => {
      const lastUpdate = new Date(n.updated_at);
      const diffMs = now.getTime() - lastUpdate.getTime();
      const daysSince = Math.floor(diffMs / (1000 * 60 * 60 * 24));
      const needsFollowUp = daysSince >= 3 || !n.next_step;
      const repName = reps.find((r) => r.id === n.representative_id)?.nome || "—";
      return { ...n, daysSince, needsFollowUp, repName };
    })
    .filter((n) => n.needsFollowUp)
    .sort((a, b) => b.daysSince - a.daysSince);

  // Count per rep
  const perRep: Record<string, number> = {};
  followUps.forEach((f) => {
    perRep[f.repName] = (perRep[f.repName] || 0) + 1;
  });

  if (followUps.length === 0) {
    return (
      <Card className="p-4 border-border bg-card">
        <h3 className="text-sm font-semibold text-foreground mb-2 flex items-center gap-2">
          <Clock className="h-4 w-4 text-primary" />
          Ações Comerciais — Follow-ups
        </h3>
        <p className="text-xs text-muted-foreground text-center py-4">
          ✅ Nenhum follow-up pendente
        </p>
      </Card>
    );
  }

  return (
    <Card className="p-4 border-border bg-card">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
          <Clock className="h-4 w-4 text-primary" />
          Ações Comerciais — Follow-ups
        </h3>
        <Badge variant="destructive" className="text-xs">
          {followUps.length} pendente{followUps.length > 1 ? "s" : ""}
        </Badge>
      </div>

      {/* Per rep summary */}
      <div className="flex flex-wrap gap-2 mb-3">
        {Object.entries(perRep).map(([rep, count]) => (
          <Badge key={rep} variant="outline" className="text-[10px] gap-1">
            <User className="h-3 w-3" />
            {rep.split(" ")[0]}: {count}
          </Badge>
        ))}
      </div>

      {/* List */}
      <div className="space-y-2 max-h-[300px] overflow-y-auto">
        {followUps.map((f) => {
          const isCritical = f.daysSince >= 5;
          return (
            <div
              key={f.id}
              className={`flex items-center justify-between gap-2 p-2 rounded-lg border ${
                isCritical
                  ? "bg-destructive/10 border-destructive/30"
                  : "bg-secondary/30 border-border"
              }`}
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs font-semibold text-foreground">
                    {f.client_name || "—"}
                  </span>
                  <Badge variant="outline" className="text-[10px]">
                    {f.repName.split(" ")[0]}
                  </Badge>
                  <Badge variant="secondary" className="text-[10px]">
                    {f.stage}
                  </Badge>
                </div>
                {!f.next_step && (
                  <p className="text-[10px] text-destructive mt-0.5">
                    ⚠ Sem próxima ação definida
                  </p>
                )}
              </div>
              <div className="flex items-center gap-1 shrink-0">
                {isCritical && <AlertTriangle className="h-3.5 w-3.5 text-destructive" />}
                <span
                  className={`text-xs font-bold ${
                    isCritical ? "text-destructive" : "text-[hsl(var(--ca-orange))]"
                  }`}
                >
                  {f.daysSince}d
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
};

export default FollowUps;
