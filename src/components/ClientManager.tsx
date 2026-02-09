import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Trash2, Building2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export interface Client {
  id: string;
  name: string;
  created_at: string;
}

const CLIENTS_KEY = "price-calc-clients";

export const loadClients = (): Client[] => {
  try {
    return JSON.parse(localStorage.getItem(CLIENTS_KEY) || "[]");
  } catch {
    return [];
  }
};

export const saveClients = (clients: Client[]) => {
  localStorage.setItem(CLIENTS_KEY, JSON.stringify(clients));
};

interface Props {
  clients: Client[];
  setClients: React.Dispatch<React.SetStateAction<Client[]>>;
}

const ClientManager = ({ clients, setClients }: Props) => {
  const { toast } = useToast();
  const [newName, setNewName] = useState("");

  const handleAdd = () => {
    const trimmed = newName.trim();
    if (!trimmed) return;
    if (clients.some((c) => c.name.toLowerCase() === trimmed.toLowerCase())) {
      toast({ title: "Empresa já cadastrada", variant: "destructive" });
      return;
    }
    const entry: Client = { id: crypto.randomUUID(), name: trimmed, created_at: new Date().toISOString() };
    const updated = [entry, ...clients];
    setClients(updated);
    saveClients(updated);
    setNewName("");
    toast({ title: "Empresa cadastrada!" });
  };

  const handleDelete = (id: string) => {
    const updated = clients.filter((c) => c.id !== id);
    setClients(updated);
    saveClients(updated);
  };

  return (
    <div className="space-y-6">
      <Card className="border-border bg-card p-6 shadow-sm">
        <h2 className="font-heading text-lg font-semibold text-card-foreground mb-4 flex items-center gap-2">
          <Building2 className="h-5 w-5" /> Cadastrar Nova Empresa
        </h2>
        <div className="flex gap-3">
          <div className="flex-1">
            <Label className="mb-1.5 text-sm text-muted-foreground">Nome da Empresa</Label>
            <Input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Ex: Empresa ABC"
              className="bg-secondary/50 border-border"
              onKeyDown={(e) => e.key === "Enter" && handleAdd()}
            />
          </div>
          <Button className="self-end" onClick={handleAdd} disabled={!newName.trim()}>
            <Plus className="h-4 w-4 mr-1" /> Adicionar
          </Button>
        </div>
      </Card>

      <Card className="border-border bg-card p-4 shadow-sm overflow-x-auto">
        {clients.length === 0 ? (
          <p className="text-muted-foreground text-center py-8">Nenhuma empresa cadastrada ainda.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Empresa</TableHead>
                <TableHead>Data Cadastro</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {clients.map((c) => (
                <TableRow key={c.id}>
                  <TableCell className="font-medium">{c.name}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {new Date(c.created_at).toLocaleDateString("pt-BR")}
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
        )}
      </Card>
    </div>
  );
};

export default ClientManager;
