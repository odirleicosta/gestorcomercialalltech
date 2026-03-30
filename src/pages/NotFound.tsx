import { useLocation, useNavigate } from "react-router-dom";
import { useEffect } from "react";
import { TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

const NotFound = () => {
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    console.error("404 Error: User attempted to access non-existent route:", location.pathname);
  }, [location.pathname]);

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 -right-40 w-96 h-96 rounded-full bg-primary/5 blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-96 h-96 rounded-full bg-accent/5 blur-3xl" />
      </div>
      <Card className="w-full max-w-md p-8 shadow-xl border-border/60 relative animate-fade-in rounded-2xl text-center">
        <div className="flex items-center gap-3 mb-8 justify-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl gradient-accent shadow-lg shadow-accent/20">
            <TrendingUp className="h-6 w-6 text-accent-foreground" />
          </div>
          <div className="text-left">
            <h1 className="font-heading text-xl font-bold text-foreground">Gestão Comercial</h1>
            <p className="text-xs text-muted-foreground font-medium tracking-wide uppercase">Máquinas Industriais</p>
          </div>
        </div>

        <p className="text-7xl font-bold text-foreground mb-2">404</p>
        <p className="text-xl font-semibold text-foreground mb-2">Página não encontrada</p>
        <p className="text-sm text-muted-foreground mb-8">
          A página que você tentou acessar não existe ou foi removida.
        </p>

        <Button className="w-full" onClick={() => navigate("/")}>
          Voltar ao início
        </Button>
      </Card>
    </div>
  );
};

export default NotFound;
