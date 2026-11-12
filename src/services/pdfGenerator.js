// src/services/pdfGenerator.js
//
// PDF generation utilities for ERP documents.
// Uses jsPDF + autoTable for professional-looking documents.

import { jsPDF } from 'jspdf';
import 'jspdf-autotable';

// Company header
const COMPANY_NAME = 'STARIUM RAFA DETERGENTS LTD';
const COMPANY_ADDRESS = 'Plot 45, Industrial Estate, Ota, Ogun State, Nigeria';
const COMPANY_PHONE = '+234-800-STARIUM';
const COMPANY_EMAIL = 'procurement@starium.com';

// Colors
const PRIMARY_COLOR = [16, 185, 129]; // Emerald
const DARK_COLOR = [30, 41, 59];
const LIGHT_GRAY = [241, 245, 249];
const BORDER_COLOR = [203, 213, 225];

function addHeader(doc, title, docNumber, date) {
  // Top bar
  doc.setFillColor(...PRIMARY_COLOR);
  doc.rect(0, 0, 210, 25, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text(title, 14, 16);

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.text(`${docNumber}`, 180, 10, { align: 'right' });
  doc.text(`${date}`, 180, 17, { align: 'right' });

  // Company info
  doc.setTextColor(...DARK_COLOR);
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.text(COMPANY_NAME, 14, 33);
  doc.text(COMPANY_ADDRESS, 14, 38);
  doc.text(`Tel: ${COMPANY_PHONE} | Email: ${COMPANY_EMAIL}`, 14, 43);

  // Separator line
  doc.setDrawColor(...PRIMARY_COLOR);
  doc.setLineWidth(0.5);
  doc.line(14, 47, 196, 47);

  return 52; // y position after header
}

function addSectionTitle(doc, title, y) {
  doc.setFillColor(...PRIMARY_COLOR);
  doc.rect(14, y, 182, 8, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text(title, 16, y + 5.5);
  return y + 12;
}

function addKeyValuePairs(doc, pairs, startY, col1Width = 50) {
  let y = startY;
  doc.setFontSize(9);
  pairs.forEach(([key, value]) => {
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...DARK_COLOR);
    doc.text(key, 16, y);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100, 116, 139);
    doc.text(String(value), 16 + col1Width, y);
    y += 6;
  });
  return y;
}

function addTable(doc, headers, rows, startY, options = {}) {
  const { columnStyles, styles = {}, margin = { left: 14, right: 14 } } = options;

  doc.autoTable({
    startY,
    head: [headers],
    body: rows,
    margin,
    styles: {
      fontSize: 8,
      cellPadding: 2,
      textColor: DARK_COLOR,
      lineColor: BORDER_COLOR,
      lineWidth: 0.2,
      ...styles,
    },
    headStyles: {
      fillColor: PRIMARY_COLOR,
      textColor: 255,
      fontStyle: 'bold',
      fontSize: 8,
    },
    alternateRowStyles: {
      fillColor: LIGHT_GRAY,
    },
    columnStyles,
    didDrawPage: (data) => {
      // Add page number
      const pageCount = doc.internal.getNumberOfPages();
      doc.setFontSize(7);
      doc.setTextColor(148, 163, 184);
      doc.text(
        `Page ${data.pageNumber} of ${pageCount}`,
        data.settings.margin.left,
        doc.internal.pageSize.height - 10
      );
    },
  });

  return doc.lastAutoTable.finalY + 5;
}

function addFooter(doc, preparedBy, approvedBy = '') {
  const pageCount = doc.internal.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    const y = doc.internal.pageSize.height - 25;

    // Signature lines
    doc.setDrawColor(...BORDER_COLOR);
    doc.setLineWidth(0.3);
    doc.line(14, y, 80, y);
    doc.line(110, y, 176, y);

    doc.setFontSize(7);
    doc.setTextColor(148, 163, 184);
    doc.setFont('helvetica', 'normal');
    doc.text('Prepared By', 14, y + 4);
    doc.text('Authorized By', 110, y + 4);

    if (i === pageCount) {
      doc.setFontSize(8);
      doc.setTextColor(...DARK_COLOR);
      doc.setFont('helvetica', 'normal');
      doc.text(preparedBy, 14, y - 4);
      if (approvedBy) doc.text(approvedBy, 110, y - 4);
    }

    // Page number
    doc.setFontSize(7);
    doc.setTextColor(148, 163, 184);
    doc.text(`Page ${i} of ${pageCount}`, 196, doc.internal.pageSize.height - 8, { align: 'right' });
  }
}

// ─── EXPORT FUNCTIONS ──────────────────────────────────────────────

/**
 * Generate Purchase Order PDF
 */
export function generatePOPdf(po) {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });

  const date = po.requestedAt ? new Date(po.requestedAt.seconds * 1000).toLocaleDateString() : new Date().toLocaleDateString();
  let y = addHeader(doc, 'PURCHASE ORDER', po.poNumber, date);

  // Vendor & PO Details
  y = addSectionTitle(doc, 'VENDOR & ORDER DETAILS', y);
  y = addKeyValuePairs(doc, [
    ['Vendor:', po.vendorName],
    ['PO Number:', po.poNumber],
    ['Date:', date],
    ['Expected Delivery:', po.expectedDeliveryDate || 'N/A'],
    ['Status:', po.status],
    ['Warehouse:', po.destinationWarehouseId],
  ], y);

  // Line Items
  y = addSectionTitle(doc, 'LINE ITEMS', y);
  const poHeaders = ['#', 'Item', 'Code', 'Qty', 'Unit', 'Unit Price (₦)', 'Tax %', 'Line Total (₦)'];
  const poRows = po.lines.map((line, i) => [
    String(i + 1),
    line.itemName,
    line.itemCode,
    String(line.orderedQty),
    line.unitOfMeasure,
    Number(line.unitPrice).toLocaleString(),
    String(line.taxRate || 7.5),
    Number(line.orderedQty * line.unitPrice).toLocaleString(),
  ]);
  y = addTable(doc, poHeaders, poRows, y, {
    columnStyles: {
      0: { cellWidth: 10, halign: 'center' },
      1: { cellWidth: 40 },
      2: { cellWidth: 20, halign: 'center' },
      3: { cellWidth: 15, halign: 'right' },
      4: { cellWidth: 15, halign: 'center' },
      5: { cellWidth: 25, halign: 'right' },
      6: { cellWidth: 15, halign: 'center' },
      7: { cellWidth: 25, halign: 'right' },
    },
  });

  // Totals
  const subtotal = po.lines.reduce((s, l) => s + l.orderedQty * l.unitPrice, 0);
  const tax = po.lines.reduce((s, l) => s + l.orderedQty * l.unitPrice * (l.taxRate || 7.5) / 100, 0);
  const total = subtotal + tax;

  y = addKeyValuePairs(doc, [
    ['Subtotal (₦):', subtotal.toLocaleString()],
    ['Tax (₦):', tax.toLocaleString()],
    ['TOTAL (₦):', total.toLocaleString()],
  ], y, 60);

  // Approval chain
  if (po.approvalState?.steps?.length) {
    y = addSectionTitle(doc, 'APPROVAL CHAIN', y);
    const approveHeaders = ['Step', 'Role', 'Status', 'Approved By', 'Date'];
    const approveRows = po.approvalState.steps.map(s => [
      String(s.step),
      s.label,
      s.status,
      s.approvedByName || '—',
      s.approvedAt ? new Date(s.approvedAt.seconds * 1000).toLocaleDateString() : '—',
    ]);
    y = addTable(doc, approveHeaders, approveRows, y);
  }

  // Notes
  if (po.notes) {
    y = addSectionTitle(doc, 'NOTES', y);
    doc.setFontSize(9);
    doc.setTextColor(...DARK_COLOR);
    doc.setFont('helvetica', 'normal');
    const lines = doc.splitTextToSize(po.notes, 180);
    doc.text(lines, 16, y);
    y += lines.length * 5;
  }

  addFooter(doc, po.requestedByName || po.requestedBy, 'Plant Manager');
  return doc;
}

/**
 * Generate Goods Receipt Note PDF
 */
export function generateGRNPdf(grn) {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });

  const date = grn.receivedAt ? new Date(grn.receivedAt.seconds * 1000).toLocaleDateString() : new Date().toLocaleDateString();
  let y = addHeader(doc, 'GOODS RECEIPT NOTE (GRN)', grn.grnNumber, date);

  // PO & Vendor Details
  y = addSectionTitle(doc, 'PURCHASE ORDER & VENDOR', y);
  y = addKeyValuePairs(doc, [
    ['GRN Number:', grn.grnNumber],
    ['PO Number:', grn.poNumber],
    ['Vendor:', grn.vendorName],
    ['Date Received:', date],
    ['Received By:', grn.postedByName || grn.postedBy],
    ['Warehouse:', grn.warehouseId],
    ['Invoice #:', grn.invoiceNumber || 'N/A'],
    ['Invoice Status:', grn.invoiceStatus],
  ], y);

  // Received Items
  y = addSectionTitle(doc, 'RECEIVED ITEMS', y);
  const grnHeaders = ['#', 'Item', 'Code', 'Ordered', 'Received', 'Unit', 'Lot #', 'Expiry', 'Bin', 'Condition', 'Match'];
  const grnRows = grn.lines.map((line, i) => [
    String(i + 1),
    line.itemName,
    line.itemCode,
    String(line.orderedQty),
    String(line.receivedQty),
    line.unitOfMeasure,
    line.lotNumber,
    line.expiryDate || '—',
    line.binId,
    line.condition,
    line.matchStatus,
  ]);
  y = addTable(doc, grnHeaders, grnRows, y, {
    columnStyles: {
      0: { cellWidth: 10, halign: 'center' },
      1: { cellWidth: 30 },
      2: { cellWidth: 18, halign: 'center' },
      3: { cellWidth: 15, halign: 'right' },
      4: { cellWidth: 15, halign: 'right' },
      5: { cellWidth: 12, halign: 'center' },
      6: { cellWidth: 25 },
      7: { cellWidth: 20, halign: 'center' },
      8: { cellWidth: 25 },
      9: { cellWidth: 18, halign: 'center' },
      10: { cellWidth: 18, halign: 'center' },
    },
  });

  // Totals
  y = addKeyValuePairs(doc, [
    ['Total Ordered:', String(grn.totalOrdered)],
    ['Total Received:', String(grn.totalReceived)],
    ['Shortfall:', String(grn.totalOrdered - grn.totalReceived)],
  ], y, 50);

  // Credit Note
  if (grn.creditNoteCreated) {
    y = addSectionTitle(doc, 'CREDIT NOTE GENERATED', y);
    y = addKeyValuePairs(doc, [
      ['Credit Note #:', grn.creditNoteId || 'N/A'],
      ['Status:', 'Auto-drafted for shortfall'],
    ], y, 50);
  }

  // Notes
  if (grn.notes) {
    y = addSectionTitle(doc, 'NOTES', y);
    doc.setFontSize(9);
    doc.setTextColor(...DARK_COLOR);
    doc.setFont('helvetica', 'normal');
    const lines = doc.splitTextToSize(grn.notes, 180);
    doc.text(lines, 16, y);
    y += lines.length * 5;
  }

  addFooter(doc, grn.postedByName || grn.postedBy, 'Warehouse Manager');
  return doc;
}

/**
 * Generate Credit Note PDF
 */
export function generateCNPdf(cn) {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });

  const date = cn.createdAt ? new Date(cn.createdAt.seconds * 1000).toLocaleDateString() : new Date().toLocaleDateString();
  let y = addHeader(doc, 'CREDIT NOTE', cn.cnNumber, date);

  // References
  y = addSectionTitle(doc, 'REFERENCES', y);
  y = addKeyValuePairs(doc, [
    ['Credit Note #:', cn.cnNumber],
    ['GRN #:', cn.grnNumber],
    ['PO #:', cn.poNumber],
    ['Vendor:', cn.vendorName],
    ['Date:', date],
    ['Status:', cn.status],
  ], y);

  // Line Items
  y = addSectionTitle(doc, 'CREDIT ITEMS', y);
  const cnHeaders = ['#', 'Item', 'Code', 'Short Qty', 'Unit', 'Unit Price (₦)', 'Tax %', 'Line Total (₦)', 'Tax (₦)', 'Total (₦)', 'Reason'];
  const cnRows = cn.lines.map((line, i) => [
    String(i + 1),
    line.itemName,
    line.itemCode,
    String(line.shortQty),
    line.unitOfMeasure,
    Number(line.unitPrice).toLocaleString(),
    String(line.taxRate),
    Number(line.lineTotal).toLocaleString(),
    Number(line.taxTotal).toLocaleString(),
    Number(line.total).toLocaleString(),
    line.reason,
  ]);
  y = addTable(doc, cnHeaders, cnRows, y);

  // Totals
  y = addKeyValuePairs(doc, [
    ['Subtotal (₦):', Number(cn.subTotal).toLocaleString()],
    ['Tax (₦):', Number(cn.taxTotal).toLocaleString()],
    ['GRAND TOTAL (₦):', Number(cn.grandTotal).toLocaleString()],
  ], y, 60);

  // Lifecycle
  y = addSectionTitle(doc, 'LIFECYCLE', y);
  const lifecycle = [
    ['Created:', cn.createdAt ? new Date(cn.createdAt.seconds * 1000).toLocaleDateString() : '—', 'By:', cn.createdByName || cn.createdBy],
    ['Sent:', cn.sentAt ? new Date(cn.sentAt.seconds * 1000).toLocaleDateString() : '—', 'By:', cn.sentByName || '—'],
    ['Accepted:', cn.acceptedAt ? new Date(cn.acceptedAt.seconds * 1000).toLocaleDateString() : '—', 'By:', cn.acceptedByName || '—'],
    ['Applied:', cn.appliedAt ? new Date(cn.appliedAt.seconds * 1000).toLocaleDateString() : '—', 'By:', cn.appliedByName || '—'],
  ];
  const lifeHeaders = ['Event', 'Date', '', 'By'];
  y = addTable(doc, lifeHeaders, lifecycle, y);

  if (cn.notes) {
    y = addSectionTitle(doc, 'NOTES', y);
    doc.setFontSize(9);
    doc.setTextColor(...DARK_COLOR);
    const lines = doc.splitTextToSize(cn.notes, 180);
    doc.text(lines, 16, y);
  }

  addFooter(doc, cn.createdByName || cn.createdBy, 'Finance Manager');
  return doc;
}

/**
 * Generate Stock Transfer PDF
 */
export function generateTransferPdf(transfer) {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });

  const date = transfer.requestedAt ? new Date(transfer.requestedAt.seconds * 1000).toLocaleDateString() : new Date().toLocaleDateString();
  let y = addHeader(doc, 'STOCK TRANSFER NOTE', transfer.transferNumber, date);

  // Transfer Details
  y = addSectionTitle(doc, 'TRANSFER DETAILS', y);
  y = addKeyValuePairs(doc, [
    ['Transfer #:', transfer.transferNumber],
    ['From Warehouse:', transfer.fromWarehouseName],
    ['To Warehouse:', transfer.toWarehouseName],
    ['Requested By:', transfer.requestedByName || transfer.requestedBy],
    ['Date Requested:', date],
    ['Status:', transfer.status],
    ...(transfer.issuedAt ? [{ 'Issued By:', transfer.issuedByName || transfer.issuedBy, 'Date:', new Date(transfer.issuedAt.seconds * 1000).toLocaleDateString() }] : []),
    ...(transfer.receivedAt ? [{ 'Received By:', transfer.receivedByName || transfer.receivedBy, 'Date:', new Date(transfer.receivedAt.seconds * 1000).toLocaleDateString() }] : []),
  ], y);

  // Line Items
  y = addSectionTitle(doc, 'TRANSFER ITEMS', y);
  const tHeaders = ['#', 'Item', 'Code', 'Qty', 'Unit', 'Lot #', 'From Bin', 'To Bin'];
  const tRows = transfer.lines.map((line, i) => [
    String(i + 1),
    line.itemName,
    line.itemCode,
    String(line.requestedQty),
    line.unitOfMeasure,
    line.lotId || '—',
    line.fromBinId || '—',
    line.toBinId || '—',
  ]);
  y = addTable(doc, tHeaders, tRows, y);

  // Approval chain
  if (transfer.approvalState?.steps?.length) {
    y = addSectionTitle(doc, 'APPROVAL CHAIN', y);
    const aHeaders = ['Step', 'Role', 'Status', 'Approved By', 'Date'];
    const aRows = transfer.approvalState.steps.map(s => [
      String(s.step),
      s.label,
      s.status,
      s.approvedByName || '—',
      s.approvedAt ? new Date(s.approvedAt.seconds * 1000).toLocaleDateString() : '—',
    ]);
    y = addTable(doc, aHeaders, aRows, y);
  }

  if (transfer.notes) {
    y = addSectionTitle(doc, 'NOTES', y);
    doc.setFontSize(9);
    doc.setTextColor(...DARK_COLOR);
    const lines = doc.splitTextToSize(transfer.notes, 180);
    doc.text(lines, 16, y);
  }

  addFooter(doc, transfer.requestedByName || transfer.requestedBy, transfer.issuedByName || transfer.issuedBy);
  return doc;
}

/**
 * Download PDF with proper filename
 */
export function downloadPdf(doc, baseFilename) {
  const filename = `${baseFilename}_${new Date().toISOString().slice(0, 10)}.pdf`;
  doc.save(filename);
}