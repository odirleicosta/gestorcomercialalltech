import {
  BarChart3,
  Building2,
  Calculator,
  DollarSign,
  Package,
  Settings,
  Target,
  UserPlus,
  Users,
  Zap,
} from "lucide-react";

export type AppTabId =
  | "dashboard"
  | "rep-kpis"
  | "team-management"
  | "registry"
  | "settings"
  | "deals"
  | "commissions"
  | "simulation"
  | "reps"
  | "catalog"
  | "deep-analysis";

export interface AppTabItem {
  value: AppTabId;
  icon: typeof BarChart3;
  label: string;
}

/** 5 main navigation groups — shown in sidebar (desktop) */
export const PRIMARY_APP_TABS: AppTabItem[] = [
  { value: "dashboard", icon: BarChart3, label: "Dashboard" },
  { value: "rep-kpis", icon: Target, label: "KPIs" },
  { value: "registry", icon: Building2, label: "Cadastros" },
  { value: "settings", icon: Settings, label: "Configurações" },
];

/** Hidden tabs — still functional, accessible through hub pages */
export const HIDDEN_APP_TABS: AppTabItem[] = [
  { value: "deals", icon: Users, label: "Vendas" },
  { value: "commissions", icon: DollarSign, label: "Comissões" },
  { value: "simulation", icon: Calculator, label: "Simulação" },
  { value: "reps", icon: UserPlus, label: "Representantes" },
  { value: "catalog", icon: Package, label: "Catálogo" },
  { value: "deep-analysis", icon: Zap, label: "Análise Profunda" },
];

/** Bottom nav shows first 3 primary tabs */
export const BOTTOM_NAV_TABS: AppTabItem[] = PRIMARY_APP_TABS.slice(0, 3);

/** "Mais" sheet on mobile — remaining primary tabs */
export const SECONDARY_APP_TABS: AppTabItem[] = PRIMARY_APP_TABS.slice(3);

/** Sidebar shows all 5 primary tabs */
export const SIDEBAR_APP_TABS: AppTabItem[] = PRIMARY_APP_TABS;

/** All valid tab IDs (primary + hidden) for validation */
export const ALL_APP_TABS: AppTabItem[] = [...PRIMARY_APP_TABS, ...HIDDEN_APP_TABS];

export const DEFAULT_APP_TAB: AppTabId = "dashboard";

export const isAppTab = (value: string): value is AppTabId =>
  ALL_APP_TABS.some((tab) => tab.value === value);

/** Maps hidden tab IDs to their parent primary tab for nav highlighting */
export const TAB_PARENT_MAP: Partial<Record<AppTabId, AppTabId>> = {
  deals: "rep-kpis",
  commissions: "rep-kpis",
  "deep-analysis": "rep-kpis",
  simulation: "settings",
  reps: "registry",
  catalog: "registry",
};

/** Returns the primary nav tab that should be highlighted for a given active tab */
export const getActiveNavTab = (tab: AppTabId): AppTabId =>
  TAB_PARENT_MAP[tab] ?? tab;
