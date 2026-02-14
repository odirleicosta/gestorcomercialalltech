import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { LogIn, UserPlus, TrendingUp } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

const Auth = () => {
  const { toast } = useToast();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      const desc = error.message.includes("Invalid login") 
        ? "Email ou senha incorretos. Verifique os dados e tente novamente."
        : error.message;
      toast({ title: "Erro ao entrar", description: desc, variant: "destructive" });
    }
    setLoading(false);
  };

  const handleSignup = async () => {
    setLoading(true);
    const { error } = await supabase.auth.signUp({ email, password });
    if (error) {
      const desc = error.message.includes("already registered")
        ? "Este email já possui uma conta. Tente fazer login."
        : error.message.includes("least 6")
        ? "A senha deve ter no mínimo 6 caracteres."
        : error.message;
      toast({ title: "Erro ao cadastrar", description: desc, variant: "destructive" });
    } else {
      toast({ title: "Conta criada!", description: "Verifique seu email para confirmar." });
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 -right-40 w-96 h-96 rounded-full bg-primary/5 blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-96 h-96 rounded-full bg-accent/5 blur-3xl" />
      </div>
      <Card className="w-full max-w-md p-8 shadow-xl border-border/60 relative animate-fade-in rounded-2xl">
        <div className="flex items-center gap-3 mb-8">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl gradient-accent shadow-lg shadow-accent/20">
            <TrendingUp className="h-6 w-6 text-accent-foreground" />
          </div>
          <div>
            <h1 className="font-heading text-xl font-bold text-foreground">Gestão Comercial</h1>
            <p className="text-xs text-muted-foreground font-medium tracking-wide uppercase">Máquinas Industriais</p>
          </div>
        </div>

        <Tabs defaultValue="login">
          <TabsList className="w-full mb-4">
            <TabsTrigger value="login" className="flex-1"><LogIn className="h-4 w-4 mr-1" /> Entrar</TabsTrigger>
            <TabsTrigger value="signup" className="flex-1"><UserPlus className="h-4 w-4 mr-1" /> Criar Conta</TabsTrigger>
          </TabsList>

          <TabsContent value="login">
            <div className="space-y-4">
              <div>
                <Label className="mb-1.5 text-sm text-muted-foreground">Email</Label>
                <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="seu@email.com" className="bg-secondary/50 border-border" />
              </div>
              <div>
                <Label className="mb-1.5 text-sm text-muted-foreground">Senha</Label>
                <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" className="bg-secondary/50 border-border" onKeyDown={(e) => e.key === "Enter" && handleLogin()} />
              </div>
              <Button className="w-full" onClick={handleLogin} disabled={loading || !email || !password}>
                {loading ? "Entrando..." : "Entrar"}
              </Button>
            </div>
          </TabsContent>

          <TabsContent value="signup">
            <div className="space-y-4">
              <div>
                <Label className="mb-1.5 text-sm text-muted-foreground">Email</Label>
                <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="seu@email.com" className="bg-secondary/50 border-border" />
              </div>
              <div>
                <Label className="mb-1.5 text-sm text-muted-foreground">Senha</Label>
                <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Mínimo 6 caracteres" className="bg-secondary/50 border-border" onKeyDown={(e) => e.key === "Enter" && handleSignup()} />
              </div>
              <Button className="w-full" onClick={handleSignup} disabled={loading || !email || !password}>
                {loading ? "Criando..." : "Criar Conta"}
              </Button>
            </div>
          </TabsContent>
        </Tabs>
      </Card>
    </div>
  );
};

export default Auth;
