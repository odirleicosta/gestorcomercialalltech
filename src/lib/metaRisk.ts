export interface RepMeta {
  id: string;
  nome: string;
  metaValor: number;
  vendido: number;
}

export interface MetaRisco {
  id: string;
  nome: string;
  metaValor: number;
  vendido: number;
  pct: number;
  risco: "critico" | "atencao";
}

export function calcularRiscoMeta(reps: RepMeta[], diaAtual: number): MetaRisco[] {
  const result: MetaRisco[] = [];

  for (const rep of reps) {
    if (rep.metaValor <= 0) continue;
    const pct = (rep.vendido / rep.metaValor) * 100;

    if (diaAtual >= 20 && pct < 70) {
      result.push({ ...rep, pct, risco: "critico" });
    } else if (diaAtual >= 15 && pct < 50) {
      result.push({ ...rep, pct, risco: "atencao" });
    }
  }

  return result;
}
