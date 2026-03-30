import {
  BarChart3,
  Building2,
  Calculator,
  DollarSign,
  Package,
  Target,
  Upload,
  UserPlus,
  Users,
  Zap,
} from "lucide-react";

export type AppTabId =
  | "dashboard"
  | "deals"
  | "commissions"
  | "rep-kpis"
  | "simulation"
  | "reps"
  | "registry"
  | "catalog"
  | "deep-analysis"
  | "bi-import";

export interface AppTabItem {
  value: AppTabId;
  icon: typeof BarChart3;
  label: string;
}

export const PRIMARY_APP_TABS: AppTabItem[] = [
  { value: "dashboard", icon: BarChart3, label: "Dashboard" },
  { value: "deals", icon: Users, label: "Vendas" },
  { value: "commissions", icon: DollarSign, label: "Comissões" },
  { value: "rep-kpis", icon: Target, label: "KPIs" },
];

export const SECONDARY_APP_TABS: AppTabItem[] = [
  { value: "simulation", icon: Calculator, label: "Simulação" },
  { value: "reps", icon: UserPlus, label: "Representantes" },
  { value: "registry", icon: Building2, label: "Cadastros" },
  { value: "catalog", icon: Package, label: "Catálogo" },
  { value: "deep-analysis", icon: Zap, label: "Análise Profunda" },
  { value: "bi-import", icon: Upload, label: "Importar BI" },
];

export const SIDEBAR_APP_TABS: AppTabItem[] = [
  ...PRIMARY_APP_TABS,
  ...SECONDARY_APP_TABS,
];

export const ALL_APP_TABS = SIDEBAR_APP_TABS;

export const DEFAULT_APP_TAB: AppTabId = "dashboard";

export const isAppTab = (value: string): value is AppTabId =>
  ALL_APP_TABS.some((tab) => tab.value === value);