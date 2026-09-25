import { Document, Page, Text, View, Image, StyleSheet } from '@react-pdf/renderer';
import type { Client, Project, Settings, TimeEntry } from '../../types';
import { formatDate } from '../../utils/format';
import { brandColor, initials } from '../../utils/pdf';
import { formatHours, sortEntriesByDate, totalHours } from '../../utils/timeReport';

const c = {
  ink: '#0f172a',
  mid: '#475569',
  mute: '#94a3b8',
  rule: '#e2e8f0',
  tint: '#f8fafc',
};

const s = StyleSheet.create({
  // paddingTop gives every page (including continuations) the same top margin;
  // the brand band sits above it via absolute positioning. Matches InvoicePDF.
  page: {
    paddingTop: 48,
    paddingBottom: 64,
    paddingHorizontal: 52,
    fontFamily: 'Helvetica',
    fontSize: 10,
    color: c.ink,
  },
  band: { position: 'absolute', top: 0, left: 0, right: 0, height: 6 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 28 },
  logo: { width: 48, height: 48, objectFit: 'contain', objectPositionX: 0, marginBottom: 8 },
  logoMark: {
    height: 40,
    width: 40,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  logoMarkText: { color: '#ffffff', fontSize: 16, fontFamily: 'Helvetica-Bold' },
  bizName: { fontSize: 15, fontFamily: 'Helvetica-Bold', marginBottom: 4 },
  bizDetail: { fontSize: 9, color: c.mid, marginBottom: 2 },
  title: { fontSize: 22, fontFamily: 'Helvetica-Bold', marginBottom: 6, textAlign: 'right' },
  period: { fontSize: 10, fontFamily: 'Helvetica-Bold', marginBottom: 4, textAlign: 'right' },
  metaRow: { flexDirection: 'row', justifyContent: 'flex-end', marginBottom: 2 },
  metaLabel: { fontSize: 9, color: c.mute, marginRight: 4 },
  metaValue: { fontSize: 9, color: c.ink },
  rule: { borderBottomWidth: 1, borderBottomColor: c.rule, marginVertical: 16 },
  sectionLabel: {
    fontSize: 7.5,
    fontFamily: 'Helvetica-Bold',
    color: c.mute,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 5,
  },
  forRow: { flexDirection: 'row', marginBottom: 24 },
  forName: { fontSize: 11, fontFamily: 'Helvetica-Bold', marginBottom: 2 },
  forDetail: { fontSize: 9, color: c.mid, marginBottom: 2 },
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
  thText: {
    fontSize: 8,
    fontFamily: 'Helvetica-Bold',
    color: c.mute,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  tdText: { fontSize: 9, color: c.ink, lineHeight: 1.4 },
  tdMid: { fontSize: 9, color: c.mid },
  colDate: { width: 78 },
  colDesc: { flex: 1, paddingRight: 12 },
  colHours: { width: 58, textAlign: 'right' },
  totalBox: {
    marginTop: 14,
    alignSelf: 'flex-end',
    width: 220,
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  totalLabel: {
    color: '#ffffff',
    fontSize: 9.5,
    fontFamily: 'Helvetica-Bold',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  totalValue: { color: '#ffffff', fontSize: 14, fontFamily: 'Helvetica-Bold' },
  empty: { fontSize: 9.5, color: c.mute, fontStyle: 'italic', paddingVertical: 20, textAlign: 'center' },
  pageNumber: {
    position: 'absolute',
    bottom: 28,
    left: 52,
    right: 52,
    fontSize: 8,
    color: c.mute,
    textAlign: 'center',
  },
});

interface Props {
  project: Project;
  client: Client;
  entries: TimeEntry[];
  from: Date;
  to: Date;
  settings: Settings | null | undefined;
}

/**
 * A client-facing record of hours worked on one project over a date range.
 *
 * Hours only — no rates and no amounts. This documents the work; the invoice is
 * what carries the money, and putting rates on both invites the two to disagree.
 */
export function TimeReportPDF({ project, client, entries, from, to, settings }: Props) {
  const bizName = settings?.businessName ?? 'Your Business';
  const ownerName = settings?.ownerName ?? '';
  const bizAddress = settings?.address ?? '';
  const bizEmail = settings?.email ?? '';
  const bizPhone = settings?.phone ?? '';
  const accent = brandColor(settings);
  const logo = settings?.logo;

  const rows = sortEntriesByDate(entries);
  const total = totalHours(entries);

  return (
    <Document>
      <Page size="A4" style={s.page}>
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
            {ownerName && ownerName !== bizName && <Text style={s.bizDetail}>{ownerName}</Text>}
            {bizAddress
              .split('\n')
              .filter((line) => line.trim())
              .map((line, i) => (
                <Text key={i} style={s.bizDetail}>
                  {line.trim()}
                </Text>
              ))}
            {bizEmail ? <Text style={s.bizDetail}>{bizEmail}</Text> : null}
            {bizPhone ? <Text style={s.bizDetail}>{bizPhone}</Text> : null}
          </View>

          <View>
            <Text style={[s.title, { color: accent }]}>TIME REPORT</Text>
            <Text style={s.period}>
              {formatDate(from)} – {formatDate(to)}
            </Text>
            <View style={s.metaRow}>
              <Text style={s.metaLabel}>Prepared</Text>
              <Text style={s.metaValue}>{formatDate(new Date())}</Text>
            </View>
          </View>
        </View>

        <View style={s.rule} />

        {/* ── Who and what ── */}
        <View style={s.forRow}>
          <View style={{ flex: 1 }}>
            <Text style={s.sectionLabel}>Prepared For</Text>
            <Text style={s.forName}>{client.company}</Text>
            {client.contactName ? <Text style={s.forDetail}>{client.contactName}</Text> : null}
            {client.address
              ? client.address
                  .split('\n')
                  .filter((line) => line.trim())
                  .map((line, i) => (
                    <Text key={i} style={s.forDetail}>
                      {line.trim()}
                    </Text>
                  ))
              : null}
          </View>
          <View style={{ flex: 1, alignItems: 'flex-end' }}>
            <Text style={s.sectionLabel}>Project</Text>
            <Text style={s.forName}>{project.name}</Text>
            <Text style={s.forDetail}>
              {rows.length} {rows.length === 1 ? 'entry' : 'entries'}
            </Text>
          </View>
        </View>

        {/* ── Entries ── */}
        <View>
          {/* `fixed` repeats the header on every continuation page */}
          <View style={s.tableHeader} fixed>
            <Text style={[s.thText, s.colDate]}>Date</Text>
            <Text style={[s.thText, s.colDesc]}>Work</Text>
            <Text style={[s.thText, s.colHours]}>Hours</Text>
          </View>
          {rows.length === 0 ? (
            <Text style={s.empty}>No time recorded in this period.</Text>
          ) : (
            rows.map((entry, i) => (
              // wrap={false} keeps a single entry from splitting across pages
              <View key={entry.id ?? i} style={s.tableRow} wrap={false}>
                <Text style={[s.tdMid, s.colDate]}>
                  {formatDate(entry.date as unknown as Date)}
                </Text>
                <Text style={[s.tdText, s.colDesc]}>{entry.description}</Text>
                <Text style={[s.tdText, s.colHours]}>{formatHours(entry.hours)}</Text>
              </View>
            ))
          )}
        </View>

        {/* ── Total ── */}
        <View style={[s.totalBox, { backgroundColor: accent }]} wrap={false}>
          <Text style={s.totalLabel}>Total Hours</Text>
          <Text style={s.totalValue}>{formatHours(total)}</Text>
        </View>

        <Text
          style={s.pageNumber}
          render={({ pageNumber, totalPages }) =>
            totalPages > 1 ? `Page ${pageNumber} of ${totalPages}` : ''
          }
          fixed
        />
      </Page>
    </Document>
  );
}
