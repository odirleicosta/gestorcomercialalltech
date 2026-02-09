import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Trash2, Wrench } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export interface Machine {
  id: string;
  name: string;
  created_at: string;
}

const MACHINES_KEY = "price-calc-machines";

export const loadMachines = (): Machine[] => {
  try {
    return JSON.parse(localStorage.getItem(MACHINES_KEY) || "[]");
  } catch {
    return [];
  }
};

export const saveMachines = (machines: Machine[]) => {
  localStorage.setItem(MACHINES_KEY, JSON.stringify(machines));
};

interface Props {
  machines: Machine[];
  setMachines: React.Dispatch<React.SetStateAction<Machine[]>>;
}

const MachineManager = ({ machines, setMachines }: Props) => {
  const { toast } = useToast();
  const [newName, setNewName] = useState("");

  const handleAdd = () => {
    const trimmed = newName.trim();
    if (!trimmed) return;
    if (machines.some((m) => m.name.toLowerCase() === trimmed.toLowerCase())) {
      toast({ title: "Máquina já cadastrada", variant: "destructive" });
      return;
    }
    const entry: Machine = { id: crypto.randomUUID(), name: trimmed, created_at: new Date().toISOString() };
    const updated = [entry, ...machines];
    setMachines(updated);
    saveMachines(updated);
    setNewName("");
    toast({ title: "Máquina cadastrada!" });
  };

  const handleDelete = (id: string) => {
    const updated = machines.filter((m) => m.id !== id);
    setMachines(updated);
    saveMachines(updated);
  };

  return (
    <div className="space-y-6">
      <Card className="border-border bg-card p-6 shadow-sm">
        <h2 className="font-heading text-lg font-semibold text-card-foreground mb-4 flex items-center gap-2">
          <Wrench className="h-5 w-5" /> Cadastrar Nova Máquina
        </h2>
        <div className="flex gap-3">
          <div className="flex-1">
            <Label className="mb-1.5 text-sm text-muted-foreground">Nome da Máquina</Label>
            <Input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Ex: Torno CNC"
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
        {machines.length === 0 ? (
          <p className="text-muted-foreground text-center py-8">Nenhuma máquina cadastrada ainda.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Máquina</TableHead>
                <TableHead>Data Cadastro</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {machines.map((m) => (
                <TableRow key={m.id}>
                  <TableCell className="font-medium">{m.name}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {new Date(m.created_at).toLocaleDateString("pt-BR")}
                  </TableCell>
                  <TableCell>
                    <Button variant="ghost" size="icon" onClick={() => handleDelete(m.id)}>
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

export default MachineManager;
