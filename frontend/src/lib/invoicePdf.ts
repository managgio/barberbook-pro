import type { AppointmentInvoice } from '@/data/types';

type InvoicePdfResult = {
  blob: Blob;
  fileName: string;
};

const PAGE_WIDTH = 210;
const PAGE_HEIGHT = 297;
const MARGIN = 16;

const parseHexColor = (value?: string | null): [number, number, number] => {
  const normalized = value?.trim().replace(/^#/, '') || '';
  const expanded = normalized.length === 3
    ? normalized.split('').map((character) => `${character}${character}`).join('')
    : normalized;
  if (!/^[0-9a-f]{6}$/i.test(expanded)) return [33, 47, 61];
  return [
    Number.parseInt(expanded.slice(0, 2), 16),
    Number.parseInt(expanded.slice(2, 4), 16),
    Number.parseInt(expanded.slice(4, 6), 16),
  ];
};

const sanitizeFilePart = (value: string) => value
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .replace(/[^a-zA-Z0-9_-]/g, '-')
  .replace(/-+/g, '-')
  .replace(/^-|-$/g, '')
  .toLowerCase();

export const buildInvoiceFileName = (invoiceNumber: string) =>
  `factura-${sanitizeFilePart(invoiceNumber) || 'documento'}.pdf`;

const loadLogoAsPng = async (source: string) => {
  const response = await fetch(source, { mode: 'cors', credentials: 'omit' });
  if (!response.ok) throw new Error('Logo unavailable');
  const blob = await response.blob();
  const objectUrl = URL.createObjectURL(blob);
  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const element = new Image();
      element.onload = () => resolve(element);
      element.onerror = () => reject(new Error('Logo decode failed'));
      element.src = objectUrl;
    });
    const maxSide = 800;
    const scale = Math.min(1, maxSide / Math.max(image.naturalWidth, image.naturalHeight));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Canvas unavailable');
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    return {
      dataUrl: canvas.toDataURL('image/png'),
      width: canvas.width,
      height: canvas.height,
    };
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
};

export const generateAppointmentInvoicePdf = async (
  invoice: AppointmentInvoice,
  language = 'es',
): Promise<InvoicePdfResult> => {
  const [{ jsPDF }, { default: autoTable }] = await Promise.all([
    import('jspdf'),
    import('jspdf-autotable'),
  ]);
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4', compress: true });
  const primary = parseHexColor(invoice.branding.primaryColor);
  const isEnglish = language.toLowerCase().startsWith('en');
  const locale = isEnglish ? 'en-GB' : 'es-ES';
  const labels = isEnglish
    ? {
        invoice: 'INVOICE', number: 'Invoice number', issueDate: 'Issue date', seller: 'Issued by',
        customer: 'Billed to', taxId: 'Tax ID', description: 'Description', serviceDate: 'Service date',
        net: 'Net amount', tax: 'VAT', total: 'Total', professional: 'Professional', location: 'Location',
        contact: 'Contact', legal: 'This invoice was generated electronically and records the service shown above.',
      }
    : {
        invoice: 'FACTURA', number: 'Número de factura', issueDate: 'Fecha de emisión', seller: 'Emisor',
        customer: 'Cliente', taxId: 'NIF/CIF', description: 'Concepto', serviceDate: 'Fecha del servicio',
        net: 'Base imponible', tax: 'IVA', total: 'Total', professional: 'Profesional', location: 'Local',
        contact: 'Contacto', legal: 'Esta factura se ha generado electrónicamente y acredita el servicio indicado.',
      };
  const money = new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: invoice.currency,
    minimumFractionDigits: 2,
  });
  const date = (value: string) => new Intl.DateTimeFormat(locale, { dateStyle: 'medium' }).format(new Date(value));

  doc.setFillColor(255, 255, 255);
  doc.rect(0, 0, PAGE_WIDTH, PAGE_HEIGHT, 'F');
  doc.setFillColor(...primary);
  doc.rect(0, 0, PAGE_WIDTH, 7, 'F');

  let logoDrawn = false;
  if (invoice.branding.logoUrl) {
    try {
      const logo = await loadLogoAsPng(invoice.branding.logoUrl);
      const maxWidth = 42;
      const maxHeight = 20;
      const ratio = Math.min(maxWidth / logo.width, maxHeight / logo.height);
      doc.addImage(
        logo.dataUrl,
        'PNG',
        MARGIN,
        16,
        Math.max(8, logo.width * ratio),
        Math.max(8, logo.height * ratio),
        undefined,
        'FAST',
      );
      logoDrawn = true;
    } catch {
      logoDrawn = false;
    }
  }

  if (!logoDrawn) {
    doc.setFillColor(246, 248, 250);
    doc.roundedRect(MARGIN, 16, 18, 18, 4, 4, 'F');
    doc.setTextColor(...primary);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.text(invoice.seller.name.slice(0, 2).toUpperCase(), MARGIN + 9, 27.5, { align: 'center' });
  }

  doc.setTextColor(25, 31, 38);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(24);
  doc.text(labels.invoice, PAGE_WIDTH - MARGIN, 22, { align: 'right' });
  doc.setFontSize(9);
  doc.setTextColor(92, 103, 115);
  doc.setFont('helvetica', 'normal');
  doc.text(`${labels.number}: ${invoice.number}`, PAGE_WIDTH - MARGIN, 29, { align: 'right' });
  doc.text(`${labels.issueDate}: ${date(invoice.issuedAt)}`, PAGE_WIDTH - MARGIN, 34, { align: 'right' });

  const cardTop = 48;
  const cardWidth = (PAGE_WIDTH - (MARGIN * 2) - 7) / 2;
  const drawPartyCard = (
    x: number,
    title: string,
    lines: Array<{ value: string | null; strong?: boolean }>,
  ) => {
    doc.setFillColor(248, 249, 251);
    doc.setDrawColor(225, 229, 234);
    doc.roundedRect(x, cardTop, cardWidth, 49, 3, 3, 'FD');
    doc.setTextColor(...primary);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.text(title.toUpperCase(), x + 5, cardTop + 8);
    let y = cardTop + 16;
    lines.filter((line) => Boolean(line.value)).forEach((line) => {
      doc.setFont('helvetica', line.strong ? 'bold' : 'normal');
      doc.setFontSize(line.strong ? 10 : 8.2);
      doc.setTextColor(line.strong ? 30 : 88, line.strong ? 37 : 99, line.strong ? 45 : 110);
      const wrapped = doc.splitTextToSize(line.value as string, cardWidth - 10) as string[];
      doc.text(wrapped.slice(0, 2), x + 5, y);
      y += Math.min(2, wrapped.length) * (line.strong ? 4.6 : 4.1) + 1;
    });
  };

  drawPartyCard(MARGIN, labels.seller, [
    { value: invoice.seller.name, strong: true },
    { value: `${labels.taxId}: ${invoice.seller.taxId}` },
    { value: invoice.seller.address },
    { value: [invoice.seller.email, invoice.seller.phone].filter(Boolean).join(' · ') || null },
  ]);
  drawPartyCard(MARGIN + cardWidth + 7, labels.customer, [
    { value: invoice.customer.name, strong: true },
    { value: invoice.customer.email },
    { value: invoice.customer.phone },
  ]);

  const serviceDetails = [
    invoice.service.professionalName ? `${labels.professional}: ${invoice.service.professionalName}` : null,
    `${labels.location}: ${invoice.service.locationName}`,
  ].filter(Boolean).join('\n');

  autoTable(doc, {
    startY: 108,
    margin: { left: MARGIN, right: MARGIN },
    theme: 'plain',
    head: [[labels.description, labels.serviceDate, labels.net, `${labels.tax} ${invoice.amounts.taxRate}%`, labels.total]],
    body: [[
      `${invoice.service.name}\n${serviceDetails}`,
      date(invoice.service.date),
      money.format(invoice.amounts.subtotal),
      money.format(invoice.amounts.taxAmount),
      money.format(invoice.amounts.total),
    ]],
    styles: {
      font: 'helvetica',
      fontSize: 8.5,
      cellPadding: 4,
      textColor: [48, 58, 68],
      lineColor: [225, 229, 234],
      lineWidth: 0.2,
      valign: 'top',
    },
    headStyles: {
      fillColor: primary,
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      halign: 'left',
    },
    bodyStyles: { fillColor: [255, 255, 255] },
    columnStyles: {
      0: { cellWidth: 66 },
      1: { cellWidth: 31 },
      2: { cellWidth: 27, halign: 'right' },
      3: { cellWidth: 27, halign: 'right' },
      4: { cellWidth: 27, halign: 'right', fontStyle: 'bold' },
    },
  });

  const tableEnd = (doc as typeof doc & { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? 142;
  const totalsX = 122;
  let totalsY = tableEnd + 12;
  const totalRows: Array<[string, string, boolean]> = [
    [labels.net, money.format(invoice.amounts.subtotal), false],
    [`${labels.tax} (${invoice.amounts.taxRate}%)`, money.format(invoice.amounts.taxAmount), false],
    [labels.total, money.format(invoice.amounts.total), true],
  ];
  totalRows.forEach(([label, value, strong]) => {
    if (strong) {
      doc.setFillColor(...primary);
      doc.roundedRect(totalsX - 4, totalsY - 5.5, PAGE_WIDTH - MARGIN - totalsX + 4, 10, 2, 2, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(11);
    } else {
      doc.setTextColor(79, 89, 100);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
    }
    doc.text(label, totalsX, totalsY);
    doc.text(value, PAGE_WIDTH - MARGIN, totalsY, { align: 'right' });
    totalsY += strong ? 12 : 8;
  });

  doc.setDrawColor(225, 229, 234);
  doc.line(MARGIN, PAGE_HEIGHT - 29, PAGE_WIDTH - MARGIN, PAGE_HEIGHT - 29);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.8);
  doc.setTextColor(105, 115, 125);
  const footer = doc.splitTextToSize(labels.legal, PAGE_WIDTH - (MARGIN * 2)) as string[];
  doc.text(footer, MARGIN, PAGE_HEIGHT - 21);
  doc.text(`${invoice.seller.name} · ${invoice.number}`, PAGE_WIDTH - MARGIN, PAGE_HEIGHT - 10, { align: 'right' });

  return {
    blob: doc.output('blob'),
    fileName: buildInvoiceFileName(invoice.number),
  };
};

export const downloadInvoicePdf = ({ blob, fileName }: InvoicePdfResult) => {
  const objectUrl = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = objectUrl;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1_000);
};

export const shareInvoicePdf = async (result: InvoicePdfResult, title: string) => {
  const file = new File([result.blob], result.fileName, { type: 'application/pdf' });
  const sharePayload = { files: [file], title };
  if (navigator.share && (!navigator.canShare || navigator.canShare(sharePayload))) {
    await navigator.share(sharePayload);
    return 'shared' as const;
  }
  downloadInvoicePdf(result);
  return 'downloaded' as const;
};
