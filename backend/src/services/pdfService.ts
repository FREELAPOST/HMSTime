import fs from "node:fs";
import path from "node:path";
import PDFDocument from "pdfkit";
import { minutesToClock } from "../utils/date.js";
import type { buildMonthlyReport } from "./reportService.js";

type MonthlyReport = Awaited<ReturnType<typeof buildMonthlyReport>>;

function entryLabel(type: string) {
  return type === "IN" ? "Entrada" : "Saida";
}

function statusLabel(status: string) {
  if (status === "APPROVED") return "aprovado";
  if (status === "PENDING") return "pendente";
  return "rejeitado";
}

function logoAbsolutePath(logoPath?: string | null) {
  if (!logoPath) return null;
  const clean = logoPath.replace(/^\/+/, "");
  const absolute = path.join(process.cwd(), clean);
  return fs.existsSync(absolute) ? absolute : null;
}

export async function generateMonthlyReportPdf(report: MonthlyReport) {
  return new Promise<Buffer>((resolve, reject) => {
    const doc = new PDFDocument({ margin: 42, size: "A4", bufferPages: true });
    const chunks: Buffer[] = [];

    doc.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    const logo = logoAbsolutePath(report.company.logoPath);
    if (logo) {
      doc.image(logo, 42, 34, { width: 74, height: 42, fit: [74, 42] });
      doc.x = 128;
    }

    doc.fontSize(15).font("Helvetica-Bold").text(report.company.legalName || "Relatorio de Ponto", {
      align: "left"
    });
    doc.fontSize(9).font("Helvetica").text(`CNPJ: ${report.company.cnpj || "-"}`);
    doc.text(`Endereco: ${report.company.address || "-"}`);
    doc.text(`Periodo: ${report.month}`);
    doc.moveDown(1.2);
    doc.x = 42;

    for (const employee of report.employees) {
      if (doc.y > 650) doc.addPage();

      doc.fontSize(12).font("Helvetica-Bold").text(`${employee.user.code} - ${employee.user.name}`);
      doc.fontSize(9).font("Helvetica").text(
        `Horas esperadas: ${minutesToClock(employee.balance.expectedMinutes)} | Horas trabalhadas: ${minutesToClock(
          employee.balance.workedMinutes
        )} | Saldo mensal: ${minutesToClock(employee.balance.balanceMinutes)}`
      );
      doc.moveDown(0.5);

      for (const day of employee.days) {
        if (doc.y > 735) {
          doc.addPage();
        }

        const entries = day.entries
          .map((entry) => {
            const hh = String(entry.occurredAt.getHours()).padStart(2, "0");
            const mm = String(entry.occurredAt.getMinutes()).padStart(2, "0");
            const edited = entry.isEdited ? " editado" : "";
            const suffix = entry.reason ? ` (${entry.reason})` : "";
            return `${hh}:${mm} ${entryLabel(entry.type)} ${statusLabel(entry.status)}${edited}${suffix}`;
          })
          .join(" | ");

        const line = `${day.date}  Esperado ${minutesToClock(day.expectedMinutes)}  Trabalhado ${minutesToClock(
          day.workedMinutes
        )}  Saldo ${minutesToClock(day.balanceMinutes)}  ${entries || "Sem ponto"}`;

        const hasPending = day.entries.some((entry) => entry.status === "PENDING");
        const hasRejected = day.entries.some((entry) => entry.status === "REJECTED");

        doc
          .fontSize(8)
          .font(hasPending || hasRejected ? "Helvetica-Bold" : "Helvetica")
          .fillColor(hasRejected ? "#991b1b" : hasPending ? "#92400e" : "#111111")
          .text(line, { width: 510 });
      }

      doc.fillColor("#111111").moveDown(1);
    }

    const footer = `Gerado em ${new Date(report.generatedAt).toLocaleString("pt-BR")}`;
    const pageCount = doc.bufferedPageRange().count;
    for (let index = 0; index < pageCount; index += 1) {
      doc.switchToPage(index);
      doc.fontSize(8).fillColor("#555555").text(footer, 42, 800, { align: "center", width: 510 });
    }

    doc.end();
  });
}
