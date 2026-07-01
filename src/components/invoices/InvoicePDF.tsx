import { Document, Page, Text, View, Image, StyleSheet } from '@react-pdf/renderer';
import type { Client, Invoice, Settings } from '../../types';
import { formatCurrency, formatDate } from '../../utils/format';
import { brandColor, initials } from '../../utils/pdf';

const c = {
  ink: '#0f172a',
  mid: '#475569',
  mute: '#94a3b8',
  rule: '#e2e8f0',
  accent: '#6366f1',
  tint: '#f8fafc',
};

const s = StyleSheet.create({
  page: {
    paddingTop: 0,
    paddingBottom: 64,
    paddingHorizontal: 52,
    fontFamily: 'Helvetica',
    fontSize: 10,
    color: c.ink,
  },
  // ── Brand band ───────────────────────────────────────
  band: { height: 6, marginHorizontal: -52 },
  // ── Header ───────────────────────────────────────────
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 42, marginBottom: 28 },
  logo: { width: 48, height: 48, objectFit: 'contain', objectPositionX: 0, marginBottom: 8 },
  logoMark: { height: 40, width: 40, borderRadius: 8, alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  logoMarkText: { color: '#ffffff', fontSize: 16, fontFamily: 'Helvetica-Bold' },
  bizName: { fontSize: 15, fontFamily: 'Helvetica-Bold', marginBottom: 4 },
  bizDetail: { fontSize: 9, color: c.mid, marginBottom: 2 },
  invoiceTitle: { fontSize: 26, fontFamily: 'Helvetica-Bold', color: c.accent, marginBottom: 6, textAlign: 'right' },
  invoiceNumber: { fontSize: 11, fontFamily: 'Helvetica-Bold', marginBottom: 6, textAlign: 'right' },
  dateRow: { flexDirection: 'row', justifyContent: 'flex-end', marginBottom: 2 },
  dateLabel: { fontSize: 9, color: c.mute, marginRight: 4 },
  dateValue: { fontSize: 9, color: c.ink },
  // ── Divider ──────────────────────────────────────────
  rule: { borderBottomWidth: 1, borderBottomColor: c.rule, marginVertical: 16 },
  // ── Bill To ──────────────────────────────────────────
  billRow: { flexDirection: 'row', marginBottom: 24 },
  sectionLabel: {
    fontSize: 7.5,
    fontFamily: 'Helvetica-Bold',
    color: c.mute,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 5,
  },
  billName: { fontSize: 11, fontFamily: 'Helvetica-Bold', marginBottom: 2 },
  billDetail: { fontSize: 9, color: c.mid, marginBottom: 2 },
  // ── Table ────────────────────────────────────────────
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: c.tint,
    borderBottomWidth: 1,
    borderBottomColor: c.rule,
    paddingVertical: 6,
    paddingHorizontal: 8,
  },
  tableRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: c.rule,
    paddingVertical: 8,
    paddingHorizontal: 8,
  },
  thText: { fontSize: 8, fontFamily: 'Helvetica-Bold', color: c.mute, textTransform: 'uppercase', letterSpacing: 0.5 },
  tdText: { fontSize: 9, color: c.ink },
  tdMid: { fontSize: 9, color: c.mid },
  colDesc: { flex: 3 },
  colNum: { flex: 1, textAlign: 'right' },
  // ── Totals ───────────────────────────────────────────
  totalsWrap: { alignItems: 'flex-end', marginTop: 8, marginBottom: 24 },
  totalRow: { flexDirection: 'row', width: 256, marginBottom: 3 },
  totLabel: { flex: 1, textAlign: 'right', paddingRight: 16, fontSize: 9, color: c.mid },
  totValue: { width: 88, textAlign: 'right', fontSize: 9, color: c.ink },
  totLabelBold: { flex: 1, textAlign: 'right', paddingRight: 16, fontSize: 10, fontFamily: 'Helvetica-Bold' },
  totValueBold: { width: 88, textAlign: 'right', fontSize: 10, fontFamily: 'Helvetica-Bold' },
  totalsRule: { borderTopWidth: 1, borderTopColor: c.rule, width: 256, marginVertical: 4 },
  balanceBox: {
    marginTop: 6,
    width: 256,
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  balanceLabel: { color: '#ffffff', fontSize: 9.5, fontFamily: 'Helvetica-Bold', textTransform: 'uppercase', letterSpacing: 1 },
  balanceValue: { color: '#ffffff', fontSize: 14, fontFamily: 'Helvetica-Bold' },
  // ── Footer ───────────────────────────────────────────
  footer: { marginTop: 16 },
  footerText: { fontSize: 9, color: c.mid, lineHeight: 1.6 },
  footerNote: { fontSize: 9, color: c.mid, fontStyle: 'italic' },
});

interface Props {
  invoice: Invoice;
  client: Client;
  settings: Settings | null | undefined;
}

export function InvoicePDF({ invoice, client, settings }: Props) {
  const bizName = settings?.businessName ?? 'Your Business';
  const ownerName = settings?.ownerName ?? '';
  const bizAddress = settings?.address ?? '';
  const bizEmail = settings?.email ?? '';
  const bizPhone = settings?.phone ?? '';
  const paymentInstructions = settings?.paymentInstructions ?? '';
  const accent = brandColor(settings);
  const logo = settings?.logo;

  return (
    <Document>
      <Page size="A4" style={s.page}>
        {/* ── Brand band ── */}
        <View style={[s.band, { backgroundColor: accent }]} fixed />

        {/* ── Header ── */}
        <View style={s.headerRow}>
          <View>
            {logo ? (
              <Image src={logo} style={s.logo} />
            ) : (
              <View style={[s.logoMark, { backgroundColor: accent }]}>
                <Text style={s.logoMarkText}>{initials(bizName)}</Text>
              </View>
            )}
            <Text style={s.bizName}>{bizName}</Text>
            {ownerName && ownerName !== bizName && (
              <Text style={s.bizDetail}>{ownerName}</Text>
            )}
            {bizAddress.split('\n').map((line, i) => (
              <Text key={i} style={s.bizDetail}>{line.trim()}</Text>
            ))}
            {bizEmail ? <Text style={s.bizDetail}>{bizEmail}</Text> : null}
            {bizPhone ? <Text style={s.bizDetail}>{bizPhone}</Text> : null}
          </View>

          <View>
            <Text style={[s.invoiceTitle, { color: accent }]}>INVOICE</Text>
            <Text style={s.invoiceNumber}>{invoice.invoiceNumber}</Text>
            <View style={s.dateRow}>
              <Text style={s.dateLabel}>Issued</Text>
              <Text style={s.dateValue}>{formatDate(invoice.issueDate as unknown as Date)}</Text>
            </View>
            <View style={s.dateRow}>
              <Text style={s.dateLabel}>Due</Text>
              <Text style={s.dateValue}>{formatDate(invoice.dueDate as unknown as Date)}</Text>
            </View>
          </View>
        </View>

        <View style={s.rule} />

        {/* ── Bill To ── */}
        <View style={s.billRow}>
          <View style={{ flex: 1 }}>
            <Text style={s.sectionLabel}>Bill To</Text>
            <Text style={s.billName}>{client.company}</Text>
            <Text style={s.billDetail}>{client.contactName}</Text>
            {client.email ? <Text style={s.billDetail}>{client.email}</Text> : null}
            {client.address
              ? client.address.split('\n').map((line, i) => (
                  <Text key={i} style={s.billDetail}>{line.trim()}</Text>
                ))
              : null}
          </View>
          {invoice.paymentTerms ? (
            <View style={{ alignItems: 'flex-end' }}>
              <Text style={s.sectionLabel}>Payment Terms</Text>
              <Text style={{ fontSize: 9 }}>{invoice.paymentTerms}</Text>
            </View>
          ) : null}
        </View>

        {/* ── Line items ── */}
        <View>
          <View style={s.tableHeader}>
            <Text style={[s.thText, s.colDesc]}>Description</Text>
            <Text style={[s.thText, s.colNum]}>Qty</Text>
            <Text style={[s.thText, s.colNum]}>Rate</Text>
            <Text style={[s.thText, s.colNum]}>Amount</Text>
          </View>
          {invoice.lineItems.map((item, i) => (
            <View key={i} style={s.tableRow}>
              <Text style={[s.tdText, s.colDesc]}>{item.description}</Text>
              <Text style={[s.tdMid, s.colNum]}>
                {item.quantity % 1 === 0 ? String(item.quantity) : item.quantity.toFixed(2)}
              </Text>
              <Text style={[s.tdMid, s.colNum]}>{formatCurrency(item.unitPrice)}</Text>
              <Text style={[s.tdText, s.colNum]}>{formatCurrency(item.amount)}</Text>
            </View>
          ))}
        </View>

        {/* ── Totals ── */}
        <View style={s.totalsWrap}>
          <View style={s.totalRow}>
            <Text style={s.totLabel}>Subtotal</Text>
            <Text style={s.totValue}>{formatCurrency(invoice.subtotal)}</Text>
          </View>
          {invoice.taxRate > 0 && (
            <View style={s.totalRow}>
              <Text style={s.totLabel}>Tax ({invoice.taxRate}%)</Text>
              <Text style={s.totValue}>{formatCurrency(invoice.taxAmount)}</Text>
            </View>
          )}
          <View style={s.totalsRule} />
          <View style={s.totalRow}>
            <Text style={s.totLabelBold}>Total</Text>
            <Text style={s.totValueBold}>{formatCurrency(invoice.total)}</Text>
          </View>
          {invoice.amountPaid > 0 && (
            <View style={s.totalRow}>
              <Text style={s.totLabel}>Amount Paid</Text>
              <Text style={s.totValue}>({formatCurrency(invoice.amountPaid)})</Text>
            </View>
          )}
          <View style={[s.balanceBox, { backgroundColor: accent }]}>
            <Text style={s.balanceLabel}>Balance Due</Text>
            <Text style={s.balanceValue}>{formatCurrency(invoice.balanceDue)}</Text>
          </View>
        </View>

        {/* ── Footer ── */}
        {(paymentInstructions || invoice.notes) && (
          <View style={s.footer}>
            <View style={s.rule} />
            {paymentInstructions ? (
              <View style={{ marginBottom: 10 }}>
                <Text style={[s.sectionLabel, { marginBottom: 4 }]}>Payment Instructions</Text>
                <Text style={s.footerText}>{paymentInstructions}</Text>
              </View>
            ) : null}
            {invoice.notes ? (
              <View>
                <Text style={[s.sectionLabel, { marginBottom: 4 }]}>Notes</Text>
                <Text style={s.footerNote}>{invoice.notes}</Text>
              </View>
            ) : null}
          </View>
        )}
      </Page>
    </Document>
  );
}
