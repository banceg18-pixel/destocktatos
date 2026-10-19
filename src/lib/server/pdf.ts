import "server-only";

/**
 * Générateur PDF minimal (texte, lignes, polices standard Helvetica) pour les factures.
 * Encodage WinAnsi : couvre le français (accents, €, apostrophes typographiques).
 */
const WIN_ANSI_EXTRA: Record<string, number> = {
  "€": 0x80, "‚": 0x82, "„": 0x84, "…": 0x85, "‘": 0x91, "’": 0x92, "“": 0x93, "”": 0x94, "•": 0x95, "–": 0x96, "—": 0x97, "œ": 0x9c, "Œ": 0x8c, "™": 0x99,
};

function encodeText(s: string): string {
  let out = "";
  for (const ch of s.normalize("NFC")) {
    let code = WIN_ANSI_EXTRA[ch] ?? ch.charCodeAt(0);
    if (ch === " " || ch === " ") code = 0x20; // espaces insécables (toLocaleString fr-FR)
    if (code > 0xff) code = 0x3f; // « ? » pour les caractères hors WinAnsi
    const c = String.fromCharCode(code);
    out += c === "(" || c === ")" || c === "\\" ? `\\${c}` : c;
  }
  return out;
}

type Op = { kind: "text"; x: number; y: number; size: number; bold: boolean; text: string; color?: [number, number, number] } | { kind: "line"; x1: number; y1: number; x2: number; y2: number } | { kind: "rect"; x: number; y: number; w: number; h: number; color: [number, number, number] };

export class PdfDoc {
  private pages: Op[][] = [[]];
  readonly width = 595.28; // A4
  readonly height = 841.89;

  private get ops() {
    return this.pages[this.pages.length - 1];
  }
  addPage() {
    this.pages.push([]);
  }
  text(x: number, y: number, text: string, size = 10, bold = false, color?: [number, number, number]) {
    this.ops.push({ kind: "text", x, y, size, bold, text, color });
  }
  line(x1: number, y1: number, x2: number, y2: number) {
    this.ops.push({ kind: "line", x1, y1, x2, y2 });
  }
  rect(x: number, y: number, w: number, h: number, color: [number, number, number]) {
    this.ops.push({ kind: "rect", x, y, w, h, color });
  }
  /** Largeur approximative (Helvetica) pour l'alignement à droite. */
  measure(text: string, size: number) {
    return text.length * size * 0.5;
  }

  toBuffer(): Buffer {
    const objects: string[] = [];
    const add = (body: string) => {
      objects.push(body);
      return objects.length;
    };
    const fontRegular = add("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>");
    const fontBold = add("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>");
    const pagesId = objects.length + 1 + this.pages.length * 2;
    const pageIds: number[] = [];
    for (const ops of this.pages) {
      const content = ops
        .map((op) => {
          if (op.kind === "text") {
            const [r, g, b] = op.color ?? [0, 0, 0];
            return `BT ${r} ${g} ${b} rg /${op.bold ? "F2" : "F1"} ${op.size} Tf ${op.x.toFixed(2)} ${op.y.toFixed(2)} Td (${encodeText(op.text)}) Tj ET`;
          }
          if (op.kind === "rect") return `${op.color.join(" ")} rg ${op.x} ${op.y} ${op.w} ${op.h} re f 0 0 0 rg`;
          return `0.8 0.8 0.8 RG 0.5 w ${op.x1} ${op.y1} m ${op.x2} ${op.y2} l S`;
        })
        .join("\n");
      const contentId = add(`<< /Length ${Buffer.byteLength(content, "latin1")} >>\nstream\n${content}\nendstream`);
      pageIds.push(
        add(
          `<< /Type /Page /Parent ${pagesId} 0 R /MediaBox [0 0 ${this.width} ${this.height}] /Resources << /Font << /F1 ${fontRegular} 0 R /F2 ${fontBold} 0 R >> >> /Contents ${contentId} 0 R >>`,
        ),
      );
    }
    add(`<< /Type /Pages /Kids [${pageIds.map((i) => `${i} 0 R`).join(" ")}] /Count ${pageIds.length} >>`);
    const catalogId = add(`<< /Type /Catalog /Pages ${pagesId} 0 R >>`);

    let pdf = "%PDF-1.4\n%\xe2\xe3\xcf\xd3\n";
    const offsets: number[] = [];
    objects.forEach((body, i) => {
      offsets.push(Buffer.byteLength(pdf, "latin1"));
      pdf += `${i + 1} 0 obj\n${body}\nendobj\n`;
    });
    const xref = Buffer.byteLength(pdf, "latin1");
    pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n${offsets.map((o) => `${String(o).padStart(10, "0")} 00000 n \n`).join("")}`;
    pdf += `trailer\n<< /Size ${objects.length + 1} /Root ${catalogId} 0 R >>\nstartxref\n${xref}\n%%EOF`;
    return Buffer.from(pdf, "latin1");
  }
}
