import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

const COLORS = {
  primary: [37, 99, 235] as [number, number, number],
  muted: [100, 116, 139] as [number, number, number],
  dark: [15, 23, 42] as [number, number, number],
  light: [241, 245, 249] as [number, number, number],
  accent: [16, 185, 129] as [number, number, number],
  destructive: [239, 68, 68] as [number, number, number],
};

function addHeader(doc: jsPDF, title: string, period: string) {
  doc.setFillColor(...COLORS.primary);
  doc.rect(0, 0, doc.internal.pageSize.getWidth(), 28, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(16);
  doc.setFont("helvetica", "bold");
  doc.text(title, 14, 12);
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text(period, 14, 20);
  doc.text(`Gerado em ${new Date().toLocaleDateString("pt-BR")}`, doc.internal.pageSize.getWidth() - 14, 20, { align: "right" });
  doc.setTextColor(...COLORS.dark);
}

function addKpiRow(doc: jsPDF, y: number, items: { label: string; value: string }[]) {
  const w = (doc.internal.pageSize.getWidth() - 28) / items.length;
  items.forEach((item, i) => {
    const x = 14 + i * w;
    doc.setFillColor(...COLORS.light);
    doc.roundedRect(x, y, w - 4, 18, 3, 3, "F");
    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...COLORS.muted);
    doc.text(item.label, x + (w - 4) / 2, y + 6, { align: "center" });
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...COLORS.dark);
    doc.text(item.value, x + (w - 4) / 2, y + 14, { align: "center" });
  });
}

interface OppRow {
  nome: string;
  qty_proprias: number;
  qty_sdr: number;
}

export function exportOpportunitiesPdf(
  rows: OppRow[],
  period: string,
) {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  addHeader(doc, "Relatório de Oportunidades", period);

  const totalProprias = rows.reduce((s, r) => s + r.qty_proprias, 0);
  const totalSdr = rows.reduce((s, r) => s + r.qty_sdr, 0);
  const total = totalProprias + totalSdr;
  const pctProprias = total > 0 ? ((totalProprias / total) * 100).toFixed(1) + "%" : "—";

  addKpiRow(doc, 34, [
    { label: "Total Abertas", value: String(total) },
    { label: "Próprias Rep.", value: String(totalProprias) },
    { label: "SDR / Interno", value: String(totalSdr) },
    { label: "% Geração Própria", value: pctProprias },
  ]);

  const tableData = rows.map(r => {
    const t = r.qty_proprias + r.qty_sdr;
    const pct = t > 0 ? ((r.qty_proprias / t) * 100).toFixed(1) + "%" : "0%";
    return [r.nome, String(r.qty_proprias), String(r.qty_sdr), String(t), pct];
  });

  // Total row
  const totalRow = ["TOTAL", String(totalProprias), String(totalSdr), String(total), pctProprias];

  autoTable(doc, {
    startY: 58,
    head: [["Representante", "Próprias", "SDR/Interno", "Total", "% Próprias"]],
    body: [...tableData, totalRow],
    headStyles: { fillColor: COLORS.primary, fontSize: 9, fontStyle: "bold" },
    bodyStyles: { fontSize: 9 },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    columnStyles: {
      1: { halign: "center" },
      2: { halign: "center" },
      3: { halign: "center", fontStyle: "bold" },
      4: { halign: "center" },
    },
    willDrawCell: (data) => {
      if (data.row.index === tableData.length) {
        data.cell.styles.fillColor = COLORS.light;
        data.cell.styles.fontStyle = "bold";
      }
    },
    margin: { left: 14, right: 14 },
  });

  doc.save(`oportunidades_${period.replace(/\s/g, "_")}.pdf`);
}

interface LostDeal {
  client_name: string;
  machine_type: string;
  machine_name: string;
  motivo_perda: string | null;
  data_perda: string;
  data_criacao: string | null;
  representative_id: string | null;
  quantidade?: number;
}

interface Rep {
  id: string;
  nome: string;
}

export function exportLostDealsPdf(
  deals: LostDeal[],
  reps: Rep[],
  period: string,
) {
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  addHeader(doc, "Relatório de Negociações Perdidas", period);

  const total = deals.reduce((s, d) => s + (d.quantidade || 1), 0);

  // Tempo médio
  const dealsComTempo = deals.filter(d => d.data_criacao && d.data_perda);
  const tempoMedio = dealsComTempo.length > 0
    ? dealsComTempo.reduce((s, d) => {
        const inicio = new Date(d.data_criacao! + "T00:00:00");
        const fim = new Date(d.data_perda + "T00:00:00");
        return s + Math.max(0, (fim.getTime() - inicio.getTime()) / (1000 * 60 * 60 * 24));
      }, 0) / dealsComTempo.length
    : null;

  // By motivo
  const byMotivo: Record<string, number> = {};
  deals.forEach(d => {
    const m = d.motivo_perda || "Não informado";
    byMotivo[m] = (byMotivo[m] || 0) + (d.quantidade || 1);
  });
  const topMotivo = Object.entries(byMotivo).sort((a, b) => b[1] - a[1])[0];

  addKpiRow(doc, 34, [
    { label: "Total Perdidas", value: String(total) },
    { label: "Tempo Médio (dias)", value: tempoMedio !== null ? String(Math.round(tempoMedio)) : "—" },
    { label: "Com Data Criação", value: `${dealsComTempo.length}/${deals.length}` },
    { label: "Principal Motivo", value: topMotivo ? topMotivo[0].substring(0, 20) : "—" },
  ]);

  // Summary by motivo
  const motivoTable = Object.entries(byMotivo)
    .sort((a, b) => b[1] - a[1])
    .map(([motivo, count]) => [motivo, String(count), total > 0 ? ((count / total) * 100).toFixed(1) + "%" : "0%"]);

  let currentY = 58;

  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...COLORS.dark);
  doc.text("Resumo por Motivo", 14, currentY);
  currentY += 2;

  autoTable(doc, {
    startY: currentY,
    head: [["Motivo", "Quantidade", "%"]],
    body: motivoTable,
    headStyles: { fillColor: COLORS.destructive, fontSize: 9, fontStyle: "bold" },
    bodyStyles: { fontSize: 9 },
    alternateRowStyles: { fillColor: [254, 242, 242] },
    columnStyles: { 1: { halign: "center" }, 2: { halign: "center" } },
    margin: { left: 14, right: 14 },
    tableWidth: 120,
  });

  currentY = (doc as any).lastAutoTable.finalY + 8;

  // Detail table
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.text("Detalhamento", 14, currentY);
  currentY += 2;

  const SHORT_MONTHS = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
  const fmtDate = (d: string) => {
    const dt = new Date(d + "T00:00:00");
    return `${SHORT_MONTHS[dt.getMonth()]} ${dt.getFullYear()}`;
  };

  const detailData = deals.map(d => {
    const repName = reps.find(r => r.id === d.representative_id)?.nome || "—";
    const tempoDias = d.data_criacao && d.data_perda
      ? Math.max(0, Math.round((new Date(d.data_perda + "T00:00:00").getTime() - new Date(d.data_criacao + "T00:00:00").getTime()) / (1000 * 60 * 60 * 24)))
      : null;
    return [
      d.data_criacao ? fmtDate(d.data_criacao) : "—",
      fmtDate(d.data_perda),
      tempoDias !== null ? `${tempoDias}d` : "—",
      d.client_name,
      d.machine_type ? `${d.machine_type}` : "",
      repName,
      d.motivo_perda || "—",
      String(d.quantidade || 1),
    ];
  });

  autoTable(doc, {
    startY: currentY,
    head: [["Criação", "Fechamento", "Tempo", "Cliente", "Tipo", "Representante", "Motivo", "Qtd"]],
    body: detailData,
    headStyles: { fillColor: COLORS.primary, fontSize: 8, fontStyle: "bold" },
    bodyStyles: { fontSize: 8 },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    columnStyles: {
      2: { halign: "center", fontStyle: "bold" },
      7: { halign: "center" },
    },
    margin: { left: 14, right: 14 },
  });

  doc.save(`negociacoes_perdidas_${period.replace(/\s/g, "_")}.pdf`);
}
