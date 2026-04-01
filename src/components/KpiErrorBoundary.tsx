import React from "react";
import { Card } from "@/components/ui/card";
import { AlertTriangle, RefreshCcw } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Props {
  children: React.ReactNode;
  fallbackTitle?: string;
}

interface State {
  hasError: boolean;
  error?: Error;
}

class KpiErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error("ErrorBoundary caught:", error, info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      return (
        <Card className="p-8 border-border bg-card text-center space-y-4 min-h-[300px] flex flex-col items-center justify-center">
          <AlertTriangle className="h-10 w-10 text-destructive mx-auto" />
          <h3 className="text-sm font-semibold text-foreground">
            {this.props.fallbackTitle || "Erro ao carregar"}
          </h3>
          <p className="text-xs text-muted-foreground">
            Ocorreu um erro inesperado. Tente recarregar.
          </p>
          <div className="flex gap-2 justify-center">
            <Button
              size="sm"
              variant="outline"
              onClick={() => this.setState({ hasError: false, error: undefined })}
            >
              <RefreshCcw className="h-3.5 w-3.5 mr-1.5" />
              Tentar novamente
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => window.location.reload()}
            >
              Recarregar página
            </Button>
          </div>
        </Card>
      );
    }
    return this.props.children;
  }
}

export default KpiErrorBoundary;
