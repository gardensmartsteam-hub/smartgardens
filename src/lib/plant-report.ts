import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { METRICS, range, statusOf, type Alert, type Plant, type Reading } from "./garden";

const INK: [number, number, number] = [27, 42, 32];
const GREEN: [number, number, number] = [47, 107, 63];
const CLAY: [number, number, number] = [201, 111, 74];
const MUTED: [number, number, number] = [120, 124, 112];

const fmt = (n: number) => (Math.round(n * 10) / 10).toString().replace(".", ",");

function stats(values: number[]) {
  if (values.length === 0) return { min: 0, max: 0, avg: 0 };
  const sum = values.reduce((a, b) => a + b, 0);
  return { min: Math.min(...values), max: Math.max(...values), avg: sum / values.length };
}

export function buildPlantReport(input: {
  plant: Plant;
  readings: Reading[];
  alerts: Alert[];
  recommendation: string;
}) {
  const { plant, readings, alerts, recommendation } = input;
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 48;
  const last = readings[readings.length - 1];
  const first = readings[0];
  const generatedAt = new Date().toLocaleString("pt-BR");

  // Cabeçalho
  doc.setFillColor(...GREEN);
  doc.rect(0, 0, pageWidth, 92, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(20);
  doc.text(plant.name, margin, 44);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text(
    `${plant.species.common_name} · ${plant.species.scientific_name} · ${plant.location}`,
    margin,
    62,
  );
  doc.text(`Smart Garden · relatório gerado em ${generatedAt}`, margin, 78);

  let y = 124;
  doc.setTextColor(...INK);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.text("Leituras do sensor", margin, y);
  y += 8;

  const period =
    first && last
      ? `${new Date(first.recorded_at).toLocaleString("pt-BR")} até ${new Date(last.recorded_at).toLocaleString("pt-BR")} · ${readings.length} leituras`
      : "Nenhuma leitura registrada.";
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(...MUTED);
  doc.text(period, margin, y + 12);
  y += 26;

  autoTable(doc, {
    startY: y,
    head: [["Métrica", "Atual", "Faixa ideal", "Mín. 24h", "Média 24h", "Máx. 24h", "Situação"]],
    body: METRICS.map((m) => {
      const bounds = range(plant.species, m.key);
      const values = readings.map((r) => r[m.key]);
      const s = stats(values);
      const current = last ? last[m.key] : undefined;
      return [
        m.label,
        current === undefined ? "—" : `${fmt(current)}${m.unit}`,
        `${bounds[0]}–${bounds[1]}${m.unit}`,
        `${fmt(s.min)}${m.unit}`,
        `${fmt(s.avg)}${m.unit}`,
        `${fmt(s.max)}${m.unit}`,
        current === undefined ? "—" : statusOf(current, bounds),
      ];
    }),
    theme: "grid",
    margin: { left: margin, right: margin },
    styles: { font: "helvetica", fontSize: 9, cellPadding: 6, textColor: INK },
    headStyles: { fillColor: GREEN, textColor: [255, 255, 255], fontStyle: "bold" },
    alternateRowStyles: { fillColor: [244, 243, 234] },
    didParseCell: (data) => {
      if (data.section === "body" && data.column.index === 6) {
        const value = String(data.cell.raw);
        if (value !== "ideal" && value !== "—") {
          data.cell.styles.textColor = CLAY;
          data.cell.styles.fontStyle = "bold";
        }
      }
    },
  });

  y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 32;

  // Alertas
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.setTextColor(...INK);
  doc.text("Alertas em aberto", margin, y);
  y += 12;

  if (alerts.length === 0) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(...MUTED);
    doc.text("Nenhum alerta em aberto — a planta está dentro das faixas ideais.", margin, y + 12);
    y += 34;
  } else {
    autoTable(doc, {
      startY: y,
      head: [["Quando", "Métrica", "Severidade", "Mensagem"]],
      body: alerts.map((a) => [
        new Date(a.created_at).toLocaleString("pt-BR"),
        a.metric,
        a.severity,
        a.message,
      ]),
      theme: "grid",
      margin: { left: margin, right: margin },
      styles: { font: "helvetica", fontSize: 9, cellPadding: 6, textColor: INK },
      headStyles: { fillColor: CLAY, textColor: [255, 255, 255], fontStyle: "bold" },
      alternateRowStyles: { fillColor: [249, 240, 235] },
      columnStyles: { 0: { cellWidth: 96 }, 1: { cellWidth: 66 }, 2: { cellWidth: 66 } },
    });
    y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 32;
  }

  // Recomendações
  const body = doc.splitTextToSize(
    recommendation.trim() || "Sem recomendações disponíveis no momento.",
    pageWidth - margin * 2 - 24,
  ) as string[];
  const tipLines = doc.splitTextToSize(
    `Dica da espécie: ${plant.species.care_tip}`,
    pageWidth - margin * 2 - 24,
  ) as string[];
  const blockHeight = 46 + body.length * 14 + 12 + tipLines.length * 12;

  if (y + blockHeight > doc.internal.pageSize.getHeight() - margin) {
    doc.addPage();
    y = margin;
  }

  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.setTextColor(...INK);
  doc.text("Recomendações do jardineiro virtual", margin, y);
  y += 12;

  doc.setFillColor(237, 240, 228);
  doc.roundedRect(margin, y, pageWidth - margin * 2, blockHeight - 24, 8, 8, "F");
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10.5);
  doc.setTextColor(...INK);
  doc.text(body, margin + 12, y + 24);

  doc.setFontSize(9);
  doc.setTextColor(...MUTED);
  doc.text(tipLines, margin + 12, y + 24 + body.length * 14 + 10);

  // Rodapé
  const pages = doc.getNumberOfPages();
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(...MUTED);
    doc.text(
      `Smart Garden · ${plant.name} · página ${i} de ${pages}`,
      margin,
      doc.internal.pageSize.getHeight() - 24,
    );
  }

  return doc;
}

export function slugify(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase();
}
