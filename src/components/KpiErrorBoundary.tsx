import React from "react";
import { Card } from "@/components/ui/card";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";

interface State {
  hasError: boolean;
  error?: Error;
}

class KpiErrorBoundary extends React.Component<{ children: React.ReactNode }, State> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error("KPI Error:", error, info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      return (
        <Card className="p-8 border-border bg-card text-center space-y-4">
          <AlertTriangle className="h-10 w-10 text-destructive mx-auto" />
          <h3 className="text-sm font-semibold text-foreground">Erro ao carregar KPIs</h3>
          <p className="text-xs text-muted-foreground">
            Ocorreu um erro inesperado. Tente recarregar.
          </p>
          <Button
            size="sm"
            variant="outline"
            onClick={() => this.setState({ hasError: false, error: undefined })}
          >
            Tentar novamente
          </Button>
        </Card>
      );
    }
    return this.props.children;
  }
}

export default KpiErrorBoundary;
