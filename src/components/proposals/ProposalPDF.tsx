import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';
import type { Proposal, Client, Project, Settings } from '../../types';
import { formatCurrency, formatDate } from '../../utils/format';

const styles = StyleSheet.create({
  page: { fontFamily: 'Helvetica', fontSize: 10, color: '#1e293b', padding: 48, lineHeight: 1.5 },
  header: { marginBottom: 32 },
  label: { fontSize: 8, fontFamily: 'Helvetica-Bold', color: '#6366f1', letterSpacing: 1.2, textTransform: 'uppercase', marginBottom: 4 },
  title: { fontSize: 18, fontFamily: 'Helvetica-Bold', color: '#0f172a', marginBottom: 4 },
  meta: { fontSize: 9, color: '#64748b' },
  divider: { borderBottomWidth: 1, borderBottomColor: '#e2e8f0', marginVertical: 16 },
  row: { flexDirection: 'row', gap: 32, marginBottom: 24 },
  col: { flex: 1 },
  sectionTitle: { fontSize: 8, fontFamily: 'Helvetica-Bold', color: '#6366f1', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 6 },
  body: { fontSize: 10, color: '#334155', lineHeight: 1.6 },
  pricingBox: { backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 4, padding: 16, marginBottom: 24 },
  pricingAmount: { fontSize: 22, fontFamily: 'Helvetica-Bold', color: '#0f172a', marginBottom: 4 },
  pricingNote: { fontSize: 9, color: '#64748b' },
  sigRow: { flexDirection: 'row', gap: 32, marginTop: 48 },
  sigBlock: { flex: 1, borderTopWidth: 1, borderTopColor: '#cbd5e1', paddingTop: 8 },
  sigLabel: { fontSize: 8, color: '#94a3b8' },
  footer: { position: 'absolute', bottom: 32, left: 48, right: 48, flexDirection: 'row', justifyContent: 'space-between' },
  footerText: { fontSize: 8, color: '#94a3b8' },
});

interface Props {
  proposal: Proposal;
  client?: Client | null;
  project?: Project | null;
  settings?: Settings | null;
}

export function ProposalPDF({ proposal, client, project, settings }: Props) {
  const isExpired = proposal.validUntil
    ? new Date(proposal.validUntil) < new Date()
    : false;

  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.label}>Proposal</Text>
          <Text style={styles.title}>{proposal.title}</Text>
          <Text style={styles.meta}>
            {settings?.businessName ?? ''}{project ? `  ·  ${project.name}` : ''}
          </Text>
        </View>

        <View style={styles.divider} />

        {/* From / To / Date row */}
        <View style={styles.row}>
          <View style={styles.col}>
            <Text style={styles.sectionTitle}>From</Text>
            <Text style={styles.body}>{settings?.ownerName ?? ''}</Text>
            <Text style={styles.body}>{settings?.businessName ?? ''}</Text>
            {settings?.email ? <Text style={styles.body}>{settings.email}</Text> : null}
          </View>
          <View style={styles.col}>
            <Text style={styles.sectionTitle}>Prepared For</Text>
            <Text style={styles.body}>{client?.company ?? ''}</Text>
            {client?.contactName ? <Text style={styles.body}>{client.contactName}</Text> : null}
            {client?.email ? <Text style={styles.body}>{client.email}</Text> : null}
          </View>
          <View style={styles.col}>
            <Text style={styles.sectionTitle}>Date</Text>
            <Text style={styles.body}>{formatDate(proposal.createdAt)}</Text>
            {proposal.validUntil ? (
              <>
                <Text style={[styles.sectionTitle, { marginTop: 8 }]}>Valid Until</Text>
                <Text style={[styles.body, isExpired ? { color: '#ef4444' } : {}]}>
                  {formatDate(proposal.validUntil as unknown as Date)}
                  {isExpired ? ' (Expired)' : ''}
                </Text>
              </>
            ) : null}
          </View>
        </View>

        {/* Scope */}
        <View style={{ marginBottom: 20 }}>
          <Text style={styles.sectionTitle}>Scope of Work</Text>
          <Text style={styles.body}>{proposal.scope}</Text>
        </View>

        {/* Deliverables */}
        <View style={{ marginBottom: 20 }}>
          <Text style={styles.sectionTitle}>Deliverables</Text>
          <Text style={styles.body}>{proposal.deliverables}</Text>
        </View>

        {/* Pricing */}
        <View style={styles.pricingBox}>
          <Text style={styles.sectionTitle}>Investment</Text>
          <Text style={styles.pricingAmount}>{formatCurrency(proposal.pricing)}</Text>
          {proposal.pricingNote ? (
            <Text style={styles.pricingNote}>{proposal.pricingNote}</Text>
          ) : null}
        </View>

        {/* Notes */}
        {proposal.notes ? (
          <View style={{ marginBottom: 20 }}>
            <Text style={styles.sectionTitle}>Additional Notes</Text>
            <Text style={styles.body}>{proposal.notes}</Text>
          </View>
        ) : null}

        {/* Signatures */}
        <View style={styles.sigRow}>
          <View style={styles.sigBlock}>
            <Text style={styles.body}>{settings?.ownerName ?? ''}</Text>
            <Text style={styles.sigLabel}>{settings?.businessName ?? 'Service Provider'}</Text>
          </View>
          <View style={styles.sigBlock}>
            <Text style={styles.body}>{client?.contactName ?? ''}</Text>
            <Text style={styles.sigLabel}>{client?.company ?? 'Client'}</Text>
          </View>
        </View>

        {/* Footer */}
        <View style={styles.footer} fixed>
          <Text style={styles.footerText}>{settings?.businessName ?? ''}</Text>
          <Text style={styles.footerText} render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`} />
        </View>
      </Page>
    </Document>
  );
}
