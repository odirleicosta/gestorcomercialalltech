import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import KpiErrorBoundary from "@/components/KpiErrorBoundary";
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";

const App = () => (
  <KpiErrorBoundary fallbackTitle="Erro inesperado na aplicação">
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Index />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </KpiErrorBoundary>
);

export default App;
