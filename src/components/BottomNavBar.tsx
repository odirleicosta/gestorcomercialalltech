import { LogOut, Moon, MoreHorizontal, Sun } from "lucide-react";
import { useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { AppTabId, BOTTOM_NAV_TABS, SECONDARY_APP_TABS, getActiveNavTab } from "@/lib/app-tabs";

interface BottomNavBarProps {
  activeTab: string;
  onTabChange: (tab: AppTabId) => void;
  onLogout: () => void;
  theme?: "light" | "dark";
  onToggleTheme?: () => void;
}

const BottomNavBar = ({ activeTab, onTabChange, onLogout, theme, onToggleTheme }: BottomNavBarProps) => {
  const [moreOpen, setMoreOpen] = useState(false);

  const navTab = getActiveNavTab(activeTab as AppTabId);
  const isMoreActive = !BOTTOM_NAV_TABS.some((t) => t.value === navTab);

  return (
    <>
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-card border-t border-border shadow-[0_-2px_10px_rgba(0,0,0,0.08)]">
        <div className="flex items-center justify-around px-1 py-1.5 safe-area-bottom">
          {BOTTOM_NAV_TABS.map(({ value, icon: Icon, label }) => {
            const isActive = navTab === value;
            return (
              <button
                key={value}
                onClick={() => onTabChange(value)}
                className={`flex flex-col items-center gap-0.5 px-2 py-1.5 rounded-lg min-w-[60px] transition-all duration-200 ${
                  isActive
                    ? "text-primary"
                    : "text-muted-foreground"
                }`}
              >
                <div className={`flex h-7 w-7 items-center justify-center rounded-lg transition-all duration-200 ${
                  isActive ? "bg-primary/10" : ""
                }`}>
                  <Icon className="h-5 w-5" strokeWidth={isActive ? 2.5 : 2} />
                </div>
                <span className={`text-[10px] leading-tight font-medium ${isActive ? "font-semibold" : ""}`}>
                  {label}
                </span>
              </button>
            );
          })}

          {/* More button */}
          <button
            onClick={() => setMoreOpen(true)}
            className={`flex flex-col items-center gap-0.5 px-2 py-1.5 rounded-lg min-w-[60px] transition-all duration-200 ${
              isMoreActive ? "text-primary" : "text-muted-foreground"
            }`}
          >
            <div className={`flex h-7 w-7 items-center justify-center rounded-lg transition-all duration-200 ${
              isMoreActive ? "bg-primary/10" : ""
            }`}>
              <MoreHorizontal className="h-5 w-5" strokeWidth={isMoreActive ? 2.5 : 2} />
            </div>
            <span className={`text-[10px] leading-tight font-medium ${isMoreActive ? "font-semibold" : ""}`}>
              Mais
            </span>
          </button>
        </div>
      </nav>

      {/* More sheet */}
      <Sheet open={moreOpen} onOpenChange={setMoreOpen}>
        <SheetContent side="bottom" className="rounded-t-2xl pb-8">
          <SheetHeader>
            <SheetTitle className="text-base font-heading">Mais opções</SheetTitle>
          </SheetHeader>
          <div className="grid grid-cols-2 gap-3 mt-4">
            {SECONDARY_APP_TABS.map(({ value, icon: Icon, label }) => {
              const isActive = navTab === value;
              return (
                <button
                  key={value}
                  onClick={() => {
                    onTabChange(value);
                    setMoreOpen(false);
                  }}
                  className={`flex items-center gap-3 rounded-xl px-4 py-3.5 text-sm font-medium transition-all ${
                    isActive
                      ? "bg-primary/10 text-primary border border-primary/20"
                      : "bg-secondary/50 text-foreground hover:bg-secondary border border-transparent"
                  }`}
                >
                  <Icon className="h-5 w-5 shrink-0" />
                  {label}
                </button>
              );
            })}
          </div>
          {onToggleTheme && (
            <button
              onClick={() => {
                onToggleTheme();
              }}
              className="flex items-center gap-3 rounded-xl px-4 py-3.5 text-sm font-medium bg-secondary/50 text-foreground hover:bg-secondary border border-transparent transition-all w-full mt-3"
            >
              {theme === "dark" ? <Sun className="h-5 w-5 shrink-0" /> : <Moon className="h-5 w-5 shrink-0" />}
              {theme === "dark" ? "Modo Claro" : "Modo Escuro"}
            </button>
          )}
          <button
            onClick={() => {
              onLogout();
              setMoreOpen(false);
            }}
            className="flex items-center gap-3 rounded-xl px-4 py-3.5 text-sm font-medium text-destructive bg-destructive/5 hover:bg-destructive/10 border border-transparent transition-all w-full mt-3"
          >
            <LogOut className="h-5 w-5 shrink-0" />
            Sair
          </button>
        </SheetContent>
      </Sheet>
    </>
  );
};

export default BottomNavBar;
