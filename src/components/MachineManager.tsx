import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Trash2, Wrench, Hash } from "lucide-react";
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
    <Card className="border-border bg-card p-6 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-heading text-lg font-semibold text-card-foreground flex items-center gap-2">
          <Wrench className="h-5 w-5" /> Máquinas
        </h2>
        <Badge variant="secondary" className="gap-1">
          <Hash className="h-3 w-3" /> {machines.length} cadastrada{machines.length !== 1 ? "s" : ""}
        </Badge>
      </div>

      <div className="flex gap-3 mb-5">
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

      {machines.length === 0 ? (
        <p className="text-muted-foreground text-center py-6 text-sm">Nenhuma máquina cadastrada ainda.</p>
      ) : (
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-8">#</TableHead>
                <TableHead>Máquina</TableHead>
                <TableHead>Data Cadastro</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {machines.map((m, i) => (
                <TableRow key={m.id}>
                  <TableCell className="text-xs text-muted-foreground">{i + 1}</TableCell>
                  <TableCell className="font-medium">{m.name}</TableCell>
                  <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                    {new Date(m.created_at).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" })}
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
        </div>
      )}
    </Card>
  );
};

export default MachineManager;
