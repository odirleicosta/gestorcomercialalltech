import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Lock, Eye, EyeOff, Settings } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";

interface Props {
  userId: string;
  children: React.ReactNode;
}

const SESSION_KEY = "commission_unlocked";

const CommissionGate = ({ userId, children }: Props) => {
  const [unlocked, setUnlocked] = useState(false);
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(true);
  const [hasPassword, setHasPassword] = useState(false);
  const [error, setError] = useState("");
  const { toast } = useToast();

  // Config dialog state
  const [configOpen, setConfigOpen] = useState(false);
  const [newPw, setNewPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const check = async () => {
      // Check session
      if (sessionStorage.getItem(SESSION_KEY) === "true") {
        setUnlocked(true);
        setLoading(false);
        return;
      }
      // Check if password is set
      const { data } = await supabase
        .from("profiles")
        .select("commission_password")
        .eq("id", userId)
        .single();
      const pw = (data as any)?.commission_password;
      setHasPassword(!!pw);
      if (!pw) {
        // No password set — unlock directly
        setUnlocked(true);
        sessionStorage.setItem(SESSION_KEY, "true");
      }
      setLoading(false);
    };
    check();
  }, [userId]);

  const handleUnlock = async () => {
    setError("");
    const { data } = await supabase
      .from("profiles")
      .select("commission_password")
      .eq("id", userId)
      .single();
    const storedPw = (data as any)?.commission_password;
    if (password === storedPw) {
      setUnlocked(true);
      sessionStorage.setItem(SESSION_KEY, "true");
    } else {
      setError("Senha incorreta");
    }
  };

  const handleSavePassword = async () => {
    if (newPw.length < 4) {
      toast({ title: "Senha deve ter no mínimo 4 caracteres", variant: "destructive" });
      return;
    }
    if (newPw !== confirmPw) {
      toast({ title: "As senhas não conferem", variant: "destructive" });
      return;
    }
    setSaving(true);
    await supabase
      .from("profiles")
      .update({ commission_password: newPw } as any)
      .eq("id", userId);
    setSaving(false);
    setHasPassword(true);
    setConfigOpen(false);
    toast({ title: "Senha das comissões atualizada!" });
  };

  if (loading) return <p className="text-muted-foreground text-center py-8">Carregando...</p>;

  if (!unlocked) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-4 animate-fade-in">
        <div className="bg-primary/10 p-4 rounded-full">
          <Lock className="h-8 w-8 text-primary" />
        </div>
        <h3 className="text-lg font-heading font-bold text-foreground">Acesso Restrito</h3>
        <p className="text-sm text-muted-foreground text-center max-w-xs">
          Digite a senha para acessar a aba de Comissões
        </p>
        <div className="flex items-center gap-2 w-full max-w-xs">
          <div className="relative flex-1">
            <Input
              type={showPw ? "text" : "password"}
              placeholder="Senha"
              value={password}
              onChange={e => { setPassword(e.target.value); setError(""); }}
              onKeyDown={e => e.key === "Enter" && handleUnlock()}
              className="pr-10"
            />
            <button
              type="button"
              onClick={() => setShowPw(!showPw)}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground"
            >
              {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
          <Button onClick={handleUnlock} size="sm">Entrar</Button>
        </div>
        {error && <p className="text-destructive text-xs">{error}</p>}
      </div>
    );
  }

  return (
    <div>
      {/* Config button to set/change password */}
      <div className="flex justify-end mb-2">
        <Dialog open={configOpen} onOpenChange={setConfigOpen}>
          <DialogTrigger asChild>
            <Button variant="ghost" size="sm" className="text-xs gap-1 text-muted-foreground">
              <Settings className="h-3.5 w-3.5" />
              {hasPassword ? "Alterar senha" : "Definir senha"}
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle>{hasPassword ? "Alterar senha das Comissões" : "Definir senha das Comissões"}</DialogTitle>
            </DialogHeader>
            <div className="space-y-3 pt-2">
              <div>
                <Label>Nova senha</Label>
                <Input type="password" value={newPw} onChange={e => setNewPw(e.target.value)} placeholder="Mínimo 4 caracteres" />
              </div>
              <div>
                <Label>Confirmar senha</Label>
                <Input type="password" value={confirmPw} onChange={e => setConfirmPw(e.target.value)} placeholder="Repita a senha" />
              </div>
              <Button onClick={handleSavePassword} disabled={saving} className="w-full">
                {saving ? "Salvando..." : "Salvar"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
      {children}
    </div>
  );
};

export default CommissionGate;
