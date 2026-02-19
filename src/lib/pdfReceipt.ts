import jsPDF from 'jspdf';

// ── Colour Palette ─────────────────────────────────────────────────────
const BRAND_GREEN = [16, 185, 129];   // #10b981  (primary)
const BRAND_DARK = [15, 23, 42];     // #0f172a  (secondary / text)
const TEXT_SOFT = [100, 116, 139];   // #64748b
const TEXT_MUTED = [148, 163, 184];   // #94a3b8
const SUCCESS = [16, 185, 129];
const WARNING = [245, 158, 11];
const ERROR = [239, 68, 68];
const BG_LIGHT = [248, 250, 252];   // #f8fafc
const BORDER = [226, 232, 240];   // #e2e8f0
const WHITE: [number, number, number] = [255, 255, 255];

// ── Helpers ────────────────────────────────────────────────────────────
function setColor(doc: jsPDF, rgb: number[]) {
    doc.setTextColor(rgb[0], rgb[1], rgb[2]);
}

function drawHr(doc: jsPDF, y: number, margin: number, width: number) {
    doc.setDrawColor(BORDER[0], BORDER[1], BORDER[2]);
    doc.setLineWidth(0.3);
    doc.line(margin, y, margin + width, y);
}

function drawDashedHr(doc: jsPDF, y: number, margin: number, width: number) {
    doc.setDrawColor(BORDER[0], BORDER[1], BORDER[2]);
    doc.setLineWidth(0.3);
    const dashLen = 3;
    const gapLen = 2;
    let x = margin;
    while (x < margin + width) {
        const end = Math.min(x + dashLen, margin + width);
        doc.line(x, y, end, y);
        x += dashLen + gapLen;
    }
}

function roundedRect(
    doc: jsPDF,
    x: number, y: number, w: number, h: number, r: number,
    fill: number[], stroke?: number[]
) {
    doc.setFillColor(fill[0], fill[1], fill[2]);
    if (stroke) {
        doc.setDrawColor(stroke[0], stroke[1], stroke[2]);
        doc.setLineWidth(0.3);
        doc.roundedRect(x, y, w, h, r, r, 'FD');
    } else {
        doc.roundedRect(x, y, w, h, r, r, 'F');
    }
}

function formatDate(dateStr: string) {
    try {
        return new Date(dateStr).toLocaleDateString('en-US', {
            month: 'long', day: '2-digit', year: 'numeric'
        });
    } catch { return dateStr; }
}

function formatTime(dateStr: string) {
    try {
        return new Date(dateStr).toLocaleTimeString('en-US', {
            hour: '2-digit', minute: '2-digit'
        });
    } catch { return ''; }
}

// ── Header used by all receipts ────────────────────────────────────────
function drawBrandHeader(doc: jsPDF, margin: number, pageW: number, title: string) {
    const contentW = pageW - margin * 2;

    // Brand bar
    doc.setFillColor(BRAND_DARK[0], BRAND_DARK[1], BRAND_DARK[2]);
    doc.roundedRect(margin, margin, contentW, 28, 4, 4, 'F');

    // Logo text
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(16);
    doc.setTextColor(255, 255, 255);
    doc.text('🌾 CropStack', margin + 8, margin + 11);

    // Title
    doc.setFontSize(9);
    doc.setTextColor(BRAND_GREEN[0], BRAND_GREEN[1], BRAND_GREEN[2]);
    doc.text(title.toUpperCase(), margin + 8, margin + 20);

    // Timestamp
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(200, 200, 210);
    const now = new Date().toLocaleString('en-US', {
        month: 'short', day: '2-digit', year: 'numeric',
        hour: '2-digit', minute: '2-digit'
    });
    doc.text(`Generated: ${now}`, margin + contentW - 4, margin + 11, { align: 'right' });

    return margin + 36; // y after header
}

// ── Footer ─────────────────────────────────────────────────────────────
function drawFooter(doc: jsPDF, margin: number, pageW: number, pageH: number) {
    const y = pageH - margin - 8;
    drawHr(doc, y, margin, pageW - margin * 2);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    setColor(doc, TEXT_MUTED);
    doc.text('This is a digitally generated receipt by CropStack.', margin, y + 5);
    doc.text('For support visit cropstack.app', margin + (pageW - margin * 2), y + 5, { align: 'right' });
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 1. BUYER ORDER RECEIPT
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
export interface BuyerReceiptData {
    orderId: string;
    productName: string;
    category: string;
    quantity: number;
    unit: string;
    pricePerUnit: number;
    totalPrice: number;
    status: string;
    pickupCode: string;
    sellerName: string;
    buyerName: string;
    createdAt: string;
    paidAt?: string;
    reservationExpiry?: string;
    currencySymbol: string;
    reservation_fee?: number;
}

export function generateBuyerOrderPdf(data: BuyerReceiptData, action: 'download' | 'print' = 'download') {
    const doc = new jsPDF({ unit: 'mm', format: 'a4' });
    const pageW = doc.internal.pageSize.getWidth();
    const margin = 20;
    const contentW = pageW - margin * 2;
    let y = margin;

    // ─ 1. Header (Company & Logo) ───────────────────────────────────────
    // Top Left: Company Info
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    setColor(doc, BRAND_DARK);
    doc.text('CropStack Inc.', margin, y);
    y += 6;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    setColor(doc, TEXT_SOFT);
    doc.text('124 Warehouse Hub, Silicon Silo', margin, y);
    y += 4.5;
    doc.text('Agri-Tech Zone, IN 560001', margin, y);

    // Top Right: Logo Placeholder
    const logoW = 60;
    const logoH = 18;
    roundedRect(doc, margin + contentW - logoW, margin - 2, logoW, logoH, 2, WHITE, BORDER);
    doc.setFontSize(10);
    setColor(doc, BRAND_GREEN);
    doc.setFont('helvetica', 'bold');
    doc.text('🌾 CropStack', margin + contentW - (logoW / 2), margin + (logoH / 2), { align: 'center' });

    y = margin + 35;

    // ─ 2. Title & Metadata ──────────────────────────────────────────────
    doc.setFontSize(32);
    doc.setFont('times', 'bold');
    setColor(doc, BRAND_DARK);
    doc.text('RECEIPT', margin + contentW, y, { align: 'right' });

    y += 15;

    // Billed To (Left) & Receipt Meta (Right)
    const midX = margin + contentW / 2;

    // Billed To
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    setColor(doc, [50, 100, 200]); // Blue accent like in image, but we can use BRAND_GREEN
    doc.text('Billed To', margin, y);
    y += 6;
    doc.setFontSize(14);
    setColor(doc, BRAND_DARK);
    doc.text(data.buyerName || 'Customer Name', margin, y);
    y += 5;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    setColor(doc, TEXT_SOFT);
    doc.text('Buyer ID: ' + data.orderId.slice(0, 8).toUpperCase(), margin, y);

    // Receipt Meta (aligned right)
    let metaY = y - 11;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    setColor(doc, [50, 100, 200]);
    doc.text('Receipt #', margin + contentW - 35, metaY, { align: 'right' });
    setColor(doc, BRAND_DARK);
    doc.setFont('helvetica', 'normal');
    doc.text(data.orderId.slice(-6).toUpperCase(), margin + contentW, metaY, { align: 'right' });

    metaY += 6;
    doc.setFont('helvetica', 'bold');
    setColor(doc, [50, 100, 200]);
    doc.text('Receipt date', margin + contentW - 35, metaY, { align: 'right' });
    setColor(doc, BRAND_DARK);
    doc.setFont('helvetica', 'normal');
    doc.text(formatDate(data.createdAt), margin + contentW, metaY, { align: 'right' });

    y += 15;

    // ─ 3. Items Table ──────────────────────────────────────────────────
    const tableHeaderY = y;
    const tableH = 10;
    doc.setFillColor(BRAND_DARK[0], BRAND_DARK[1], BRAND_DARK[2]);
    doc.rect(margin, tableHeaderY, contentW, tableH, 'F');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(255, 255, 255);
    doc.text('QTY', margin + 5, tableHeaderY + 6.5);
    doc.text('Description', margin + 25, tableHeaderY + 6.5);
    doc.text('Unit Price', margin + contentW - 45, tableHeaderY + 6.5, { align: 'right' });
    doc.text('Amount', margin + contentW - 5, tableHeaderY + 6.5, { align: 'right' });

    y += tableH + 8;

    // Table Row (Single Item for this receipt type)
    doc.setFont('helvetica', 'normal');
    setColor(doc, BRAND_DARK);
    doc.text(String(data.quantity), margin + 5, y);
    doc.text(`${data.productName} (${data.category})`, margin + 25, y);
    doc.text(`${data.pricePerUnit.toFixed(2)}`, margin + contentW - 45, y, { align: 'right' });
    doc.text(`${data.totalPrice.toFixed(2)}`, margin + contentW - 5, y, { align: 'right' });

    y += 8;
    drawHr(doc, y, margin, contentW);
    y += 10;

    // ─ 4. Summary Section ──────────────────────────────────────────────
    const summaryX = margin + contentW - 80;
    const summaryW = 80;

    doc.setFontSize(10);
    // Subtotal
    setColor(doc, TEXT_SOFT);
    doc.text('Subtotal', summaryX, y);
    setColor(doc, BRAND_DARK);
    doc.text(`${data.currencySymbol}${data.totalPrice.toFixed(2)}`, margin + contentW - 5, y, { align: 'right' });

    y += 8;
    // Reservation Fee
    if ((data as any).reservation_fee) {
        setColor(doc, TEXT_SOFT);
        doc.text('Reservation Fee (5%)', summaryX, y);
        setColor(doc, BRAND_DARK);
        doc.text(`${data.currencySymbol}${(data as any).reservation_fee.toFixed(2)}`, margin + contentW - 5, y, { align: 'right' });
        y += 8;
    }

    // Total
    doc.setDrawColor(50, 100, 200);
    doc.setLineWidth(0.5);
    doc.line(summaryX, y - 4, margin + contentW, y - 4);

    doc.setFont('helvetica', 'bold');
    setColor(doc, [50, 100, 200]);
    doc.text(`Total (${data.currencySymbol === '₹' ? 'INR' : 'USD'})`, summaryX, y + 2);
    doc.setFontSize(12);
    doc.text(`${data.currencySymbol}${data.totalPrice.toFixed(2)}`, margin + contentW - 5, y + 2, { align: 'right' });

    doc.line(summaryX, y + 6, margin + contentW, y + 6);

    y += 30;

    // ─ 5. Notes ────────────────────────────────────────────────────────
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    setColor(doc, [50, 100, 200]);
    doc.text('Notes', margin, y);
    y += 6;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    setColor(doc, TEXT_SOFT);
    doc.text('Thank you for your purchase! Your pickup code is ' + data.pickupCode + '.', margin, y); y += 4.5;
    doc.text('Please verify your goods at the warehouse before handover.', margin, y); y += 4.5;
    doc.text('For questions or support, contact us at support@cropstack.app.', margin, y);

    // Footer at very bottom
    doc.setFontSize(7);
    setColor(doc, TEXT_MUTED);
    doc.text('Digitally generated by CropStack Node Governance System', pageW / 2, 285, { align: 'center' });

    // Output
    if (action === 'print') {
        doc.autoPrint();
        window.open(doc.output('bloburl'), '_blank');
    } else {
        doc.save(`CropStack-Receipt-${data.orderId.slice(0, 8).toUpperCase()}.pdf`);
    }
}


// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 2. SELLER WITHDRAWAL RECEIPT
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
export interface WithdrawalReceiptData {
    referenceId: string;
    amount: number;
    date: string;
    sellerName: string;
    currencySymbol: string;
}

export function generateWithdrawalPdf(data: WithdrawalReceiptData, action: 'download' | 'print' = 'download') {
    const doc = new jsPDF({ unit: 'mm', format: 'a4' });
    const pageW = doc.internal.pageSize.getWidth();
    const margin = 20;
    const contentW = pageW - margin * 2;
    let y = margin;

    // ─ 1. Header (Company & Logo) ───────────────────────────────────────
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    setColor(doc, BRAND_DARK);
    doc.text('CropStack Inc.', margin, y);
    y += 6;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    setColor(doc, TEXT_SOFT);
    doc.text('Financial Clearing Division', margin, y);
    y += 4.5;
    doc.text('Agri-Tech Zone, IN 560001', margin, y);

    const logoW = 60;
    const logoH = 18;
    roundedRect(doc, margin + contentW - logoW, margin - 2, logoW, logoH, 2, WHITE, BORDER);
    doc.setFontSize(10);
    setColor(doc, BRAND_GREEN);
    doc.setFont('helvetica', 'bold');
    doc.text('🌾 CropStack', margin + contentW - (logoW / 2), margin + (logoH / 2), { align: 'center' });

    y = margin + 35;

    // ─ 2. Title & Metadata ──────────────────────────────────────────────
    doc.setFontSize(32);
    doc.setFont('times', 'bold');
    setColor(doc, BRAND_DARK);
    doc.text('PAYMENT ADVICE', margin + contentW, y, { align: 'right' });

    y += 15;

    // Billed To (Payee) & Metadata
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    setColor(doc, [50, 100, 200]);
    doc.text('Payee', margin, y);
    y += 6;
    doc.setFontSize(14);
    setColor(doc, BRAND_DARK);
    doc.text(data.sellerName, margin, y);
    y += 5;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    setColor(doc, TEXT_SOFT);
    doc.text('Account: Seller Clearance Node', margin, y);

    let metaY = y - 11;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    setColor(doc, [50, 100, 200]);
    doc.text('Reference #', margin + contentW - 35, metaY, { align: 'right' });
    setColor(doc, BRAND_DARK);
    doc.setFont('helvetica', 'normal');
    doc.text(data.referenceId, margin + contentW, metaY, { align: 'right' });

    metaY += 6;
    doc.setFont('helvetica', 'bold');
    setColor(doc, [50, 100, 200]);
    doc.text('Payment date', margin + contentW - 35, metaY, { align: 'right' });
    setColor(doc, BRAND_DARK);
    doc.setFont('helvetica', 'normal');
    doc.text(formatDate(data.date), margin + contentW, metaY, { align: 'right' });

    y += 15;

    // ─ 3. Items Table ──────────────────────────────────────────────────
    const tableHeaderY = y;
    const tableH = 10;
    doc.setFillColor(BRAND_DARK[0], BRAND_DARK[1], BRAND_DARK[2]);
    doc.rect(margin, tableHeaderY, contentW, tableH, 'F');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(255, 255, 255);
    doc.text('QTY', margin + 5, tableHeaderY + 6.5);
    doc.text('Description', margin + 25, tableHeaderY + 6.5);
    doc.text('Amount', margin + contentW - 5, tableHeaderY + 6.5, { align: 'right' });

    y += tableH + 8;

    doc.setFont('helvetica', 'normal');
    setColor(doc, BRAND_DARK);
    doc.text('1', margin + 5, y);
    doc.text(`Earnings Withdrawal - Ref: ${data.referenceId}`, margin + 25, y);
    doc.text(`${data.amount.toFixed(2)}`, margin + contentW - 5, y, { align: 'right' });

    y += 8;
    drawHr(doc, y, margin, contentW);
    y += 10;

    // ─ 4. Summary Section ──────────────────────────────────────────────
    const summaryX = margin + contentW - 80;

    doc.setFontSize(10);
    setColor(doc, TEXT_SOFT);
    doc.text('Subtotal', summaryX, y);
    setColor(doc, BRAND_DARK);
    doc.text(`${data.currencySymbol}${data.amount.toFixed(2)}`, margin + contentW - 5, y, { align: 'right' });

    y += 8;
    doc.setDrawColor(50, 100, 200);
    doc.setLineWidth(0.5);
    doc.line(summaryX, y - 4, margin + contentW, y - 4);

    doc.setFont('helvetica', 'bold');
    setColor(doc, [50, 100, 200]);
    doc.text(`Total Disbursed`, summaryX, y + 2);
    doc.setFontSize(12);
    doc.text(`${data.currencySymbol}${data.amount.toFixed(2)}`, margin + contentW - 5, y + 2, { align: 'right' });

    doc.line(summaryX, y + 6, margin + contentW, y + 6);

    y += 35;

    // ─ 5. Notes ────────────────────────────────────────────────────────
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    setColor(doc, [50, 100, 200]);
    doc.text('Notes', margin, y);
    y += 6;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    setColor(doc, TEXT_SOFT);
    doc.text('Your withdrawal has been processed and and is being transferred to your local node.', margin, y); y += 4.5;
    doc.text('Expected completion: 1-3 business days depending on network congestion.', margin, y); y += 4.5;
    doc.text('For questions or support, contact clearing@cropstack.app.', margin, y);

    doc.setFontSize(7);
    setColor(doc, TEXT_MUTED);
    doc.text('Digitally generated by CropStack Clearing Division', pageW / 2, 285, { align: 'center' });

    if (action === 'print') {
        doc.autoPrint();
        window.open(doc.output('bloburl'), '_blank');
    } else {
        doc.save(`CropStack-Withdrawal-${data.referenceId}.pdf`);
    }
}


// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 3. SELLER PAYMENT HISTORY EXPORT
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
export interface PaymentHistoryItem {
    date: string;
    orderId: string;
    amount: number;
    status: string;
}

export interface PaymentHistoryData {
    sellerName: string;
    currencySymbol: string;
    transactions: PaymentHistoryItem[];
    availableBalance: number;
    pendingPayments: number;
}

export function generatePaymentHistoryPdf(data: PaymentHistoryData) {
    const doc = new jsPDF({ unit: 'mm', format: 'a4' });
    const pageW = doc.internal.pageSize.getWidth();
    const pageH = doc.internal.pageSize.getHeight();
    const margin = 20;
    const contentW = pageW - margin * 2;
    let y = margin;

    // ─ 1. Header (Company & Logo) ───────────────────────────────────────
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    setColor(doc, BRAND_DARK);
    doc.text('CropStack Inc.', margin, y);
    y += 6;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    setColor(doc, TEXT_SOFT);
    doc.text('Accounts & Ledger Division', margin, y);
    y += 4.5;
    doc.text('Financial Report #CS-HIST-' + new Date().getFullYear(), margin, y);

    const logoW = 60;
    const logoH = 18;
    roundedRect(doc, margin + contentW - logoW, margin - 2, logoW, logoH, 2, WHITE, BORDER);
    doc.setFontSize(10);
    setColor(doc, BRAND_GREEN);
    doc.setFont('helvetica', 'bold');
    doc.text('🌾 CropStack', margin + contentW - (logoW / 2), margin + (logoH / 2), { align: 'center' });

    y = margin + 35;

    // ─ 2. Title & User Info ──────────────────────────────────────────
    doc.setFontSize(28);
    doc.setFont('times', 'bold');
    setColor(doc, BRAND_DARK);
    doc.text('LEDGER STATEMENT', margin + contentW, y, { align: 'right' });

    y += 15;

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    setColor(doc, [50, 100, 200]);
    doc.text('Statement For', margin, y);
    y += 6;
    doc.setFontSize(14);
    setColor(doc, BRAND_DARK);
    doc.text(data.sellerName, margin, y);

    let metaY = y - 6;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    setColor(doc, [50, 100, 200]);
    doc.text('Report date', margin + contentW - 35, metaY, { align: 'right' });
    setColor(doc, BRAND_DARK);
    doc.setFont('helvetica', 'normal');
    doc.text(formatDate(new Date().toISOString()), margin + contentW, metaY, { align: 'right' });

    y += 15;

    // ─ 3. Summary Summary ──────────────────────────────────────────
    const summaryBoxW = (contentW - 8) / 2;
    roundedRect(doc, margin, y, summaryBoxW, 20, 3, BG_LIGHT, BORDER);
    doc.setFontSize(8);
    setColor(doc, TEXT_SOFT);
    doc.text('AVAILABLE BALANCE', margin + 6, y + 7);
    doc.setFontSize(14);
    setColor(doc, SUCCESS);
    doc.text(`${data.currencySymbol}${data.availableBalance.toFixed(2)}`, margin + 6, y + 16);

    roundedRect(doc, margin + summaryBoxW + 8, y, summaryBoxW, 20, 3, BG_LIGHT, BORDER);
    doc.setFontSize(8);
    setColor(doc, TEXT_SOFT);
    doc.text('PENDING TRANSIT', margin + summaryBoxW + 14, y + 7);
    doc.setFontSize(14);
    setColor(doc, WARNING);
    doc.text(`${data.currencySymbol}${data.pendingPayments.toFixed(2)}`, margin + summaryBoxW + 14, y + 16);

    y += 32;

    // ─ 4. Table ────────────────────────────────────────────────────────
    doc.setFillColor(BRAND_DARK[0], BRAND_DARK[1], BRAND_DARK[2]);
    doc.rect(margin, y, contentW, 10, 'F');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(255, 255, 255);

    const cols = [
        { label: 'DATE', x: margin + 6 },
        { label: 'ORDER ID', x: margin + 46 },
        { label: 'AMOUNT', x: margin + 100 },
        { label: 'STATUS', x: margin + 140 },
    ];
    cols.forEach(col => doc.text(col.label, col.x, y + 6.5));
    y += 12;

    // Data rows
    data.transactions.forEach((txn, i) => {
        // Zebra stripe
        if (i % 2 === 0) {
            roundedRect(doc, margin, y - 3, contentW, 10, 0, BG_LIGHT);
        }

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8.5);
        setColor(doc, BRAND_DARK);
        doc.text(formatDate(txn.date), cols[0].x, y + 3);

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(8);
        setColor(doc, TEXT_SOFT);
        doc.text(`#${txn.orderId.slice(0, 8).toUpperCase()}`, cols[1].x, y + 3);

        const isNeg = txn.amount < 0;
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(9);
        setColor(doc, isNeg ? ERROR : BRAND_DARK);
        doc.text(
            `${isNeg ? '-' : ''}${data.currencySymbol}${Math.abs(txn.amount).toFixed(2)}`,
            cols[2].x, y + 3
        );

        // Status badge
        const statusColor = (txn.status === 'cleared' || txn.status === 'released') ? SUCCESS : WARNING;
        const statusLabel = (txn.status === 'cleared' || txn.status === 'released')
            ? (isNeg ? 'Withdrawn' : 'Paid') : 'Pending';

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(7);
        setColor(doc, statusColor);
        doc.text(statusLabel, cols[3].x, y + 3);

        y += 10;

        // Page break check
        if (y > pageH - 30) {
            drawFooter(doc, margin, pageW, pageH);
            doc.addPage();
            y = margin + 10;
        }
    });

    if (data.transactions.length === 0) {
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(10);
        setColor(doc, TEXT_MUTED);
        doc.text('No transactions recorded yet.', pageW / 2, y + 10, { align: 'center' });
    }

    drawFooter(doc, margin, pageW, pageH);
    doc.save(`CropStack-PaymentHistory-${new Date().toISOString().slice(0, 10)}.pdf`);
}
