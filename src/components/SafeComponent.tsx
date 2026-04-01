import { Card } from "@/components/ui/card";
import { AlertTriangle, Inbox } from "lucide-react";
import { Button } from "@/components/ui/button";

interface SafeComponentProps {
  loading?: boolean;
  error?: string | null;
  isEmpty?: boolean;
  emptyMessage?: string;
  loadingMessage?: string;
  onRetry?: () => void;
  children: React.ReactNode;
}

const SafeComponent = ({
  loading,
  error,
  isEmpty,
  emptyMessage = "Sem dados disponíveis",
  loadingMessage = "Carregando...",
  onRetry,
  children,
}: SafeComponentProps) => {
  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="flex flex-col items-center gap-3 animate-fade-in">
          <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center animate-pulse">
            <div className="h-4 w-4 rounded-full border-2 border-primary border-t-transparent animate-spin" />
          </div>
          <p className="text-muted-foreground text-sm font-medium">{loadingMessage}</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <Card className="p-6 border-border bg-card text-center space-y-3">
        <AlertTriangle className="h-8 w-8 text-destructive mx-auto" />
        <p className="text-sm font-semibold text-foreground">Erro ao carregar</p>
        <p className="text-xs text-muted-foreground">{error}</p>
        {onRetry && (
          <Button size="sm" variant="outline" onClick={onRetry}>
            Tentar novamente
          </Button>
        )}
      </Card>
    );
  }

  if (isEmpty) {
    return (
      <Card className="p-6 border-border bg-card text-center space-y-3">
        <Inbox className="h-8 w-8 text-muted-foreground mx-auto" />
        <p className="text-sm text-muted-foreground">{emptyMessage}</p>
      </Card>
    );
  }

  return <>{children}</>;
};

export default SafeComponent;
