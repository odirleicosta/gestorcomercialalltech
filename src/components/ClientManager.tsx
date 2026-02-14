import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Trash2, Building2, Hash, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

export interface Client {
  id: string;
  name: string;
  cidade: string | null;
  created_at: string;
}

interface Props {
  clients: Client[];
  setClients: React.Dispatch<React.SetStateAction<Client[]>>;
}

export const fetchClients = async (): Promise<Client[]> => {
  const { data, error } = await supabase
    .from("empresas")
    .select("id, nome, cidade, created_at")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data || []).map((e: any) => ({ id: e.id, name: e.nome, cidade: e.cidade, created_at: e.created_at }));
};

const ClientManager = ({ clients, setClients }: Props) => {
  const { toast } = useToast();
  const [newName, setNewName] = useState("");
  const [newCidade, setNewCidade] = useState("");
  const [loading, setLoading] = useState(false);

  const handleAdd = async () => {
    const trimmed = newName.trim();
    if (!trimmed) {
      toast({ title: "Nome obrigatório", description: "Informe o nome da empresa para cadastrar.", variant: "destructive" });
      return;
    }
    if (clients.some((c) => c.name.toLowerCase() === trimmed.toLowerCase())) {
      toast({ title: "Empresa duplicada", description: `A empresa "${trimmed}" já está cadastrada no sistema.`, variant: "destructive" });
      return;
    }
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setLoading(false); return; }

    const { data, error } = await supabase
      .from("empresas")
      .insert({ nome: trimmed, cidade: newCidade.trim() || null, user_id: user.id } as any)
      .select("id, nome, cidade, created_at")
      .single();

    setLoading(false);
    if (error) {
      toast({ title: "Erro ao cadastrar empresa", description: error.message, variant: "destructive" });
      return;
    }
    const entry: Client = { id: (data as any).id, name: (data as any).nome, cidade: (data as any).cidade, created_at: (data as any).created_at };
    setClients((prev) => [entry, ...prev]);
    setNewName("");
    setNewCidade("");
    toast({ title: "Empresa cadastrada!" });
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from("empresas").delete().eq("id", id);
    if (error) {
      toast({ title: "Erro ao excluir empresa", description: error.message, variant: "destructive" });
      return;
    }
    setClients((prev) => prev.filter((c) => c.id !== id));
  };

  return (
    <Card className="border-border bg-card p-6 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-heading text-lg font-semibold text-card-foreground flex items-center gap-2">
          <Building2 className="h-5 w-5" /> Empresas
        </h2>
        <Badge variant="secondary" className="gap-1">
          <Hash className="h-3 w-3" /> {clients.length} cadastrada{clients.length !== 1 ? "s" : ""}
        </Badge>
      </div>

      <div className="flex gap-3 mb-5 flex-wrap">
        <div className="flex-1 min-w-[180px]">
          <Label className="mb-1.5 text-sm text-muted-foreground">Nome da Empresa</Label>
          <Input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Ex: Empresa ABC"
            className="bg-secondary/50 border-border"
            onKeyDown={(e) => e.key === "Enter" && handleAdd()}
          />
        </div>
        <div className="flex-1 min-w-[140px]">
          <Label className="mb-1.5 text-sm text-muted-foreground">Cidade</Label>
          <Input
            value={newCidade}
            onChange={(e) => setNewCidade(e.target.value)}
            placeholder="Ex: Curitiba"
            className="bg-secondary/50 border-border"
            onKeyDown={(e) => e.key === "Enter" && handleAdd()}
          />
        </div>
        <Button className="self-end" onClick={handleAdd} disabled={!newName.trim() || loading}>
          {loading ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Plus className="h-4 w-4 mr-1" />} Adicionar
        </Button>
      </div>

      {clients.length === 0 ? (
        <p className="text-muted-foreground text-center py-6 text-sm">Nenhuma empresa cadastrada ainda.</p>
      ) : (
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-8">#</TableHead>
                <TableHead>Empresa</TableHead>
                <TableHead>Cidade</TableHead>
                <TableHead>Data Cadastro</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {clients.map((c, i) => (
                <TableRow key={c.id}>
                  <TableCell className="text-xs text-muted-foreground">{i + 1}</TableCell>
                  <TableCell className="font-medium">{c.name}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{c.cidade || "—"}</TableCell>
                  <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                    {new Date(c.created_at).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                  </TableCell>
                  <TableCell>
                    <Button variant="ghost" size="icon" onClick={() => handleDelete(c.id)}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </Card>
  );
};

export default ClientManager;
