import { Document, Page, Text, View, Image, StyleSheet } from '@react-pdf/renderer';
import type { Document as Doc, Settings } from '../../types';
import { brandColor, initials } from '../../utils/pdf';
import { renderMarkdownPdf } from '../../utils/markdownPdf';

const DOC_TYPE_LABEL: Record<string, string> = {
  msa: 'Master Services Agreement',
  nda: 'Non-Disclosure Agreement',
  sow: 'Statement of Work',
  proposal: 'Proposal',
  other: 'Document',
};

const c = {
  ink: '#0f172a',
  mid: '#475569',
  mute: '#94a3b8',
  rule: '#e2e8f0',
  accent: '#6366f1',
};

const s = StyleSheet.create({
  page: {
    paddingTop: 0,
    paddingBottom: 64,
    paddingHorizontal: 56,
    fontFamily: 'Helvetica',
    fontSize: 10,
    color: c.ink,
  },
  band: { height: 6, marginHorizontal: -56 },
  logo: { width: 40, height: 40, objectFit: 'contain', objectPositionX: 0, marginBottom: 12 },
  logoMark: { height: 34, width: 34, borderRadius: 7, alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  logoMarkText: { color: '#ffffff', fontSize: 14, fontFamily: 'Helvetica-Bold' },
  header: {
    marginTop: 44,
    marginBottom: 24,
    paddingBottom: 16,
    borderBottomWidth: 2,
    borderBottomColor: c.accent,
  },
  docType: {
    fontSize: 8,
    fontFamily: 'Helvetica-Bold',
    color: c.accent,
    textTransform: 'uppercase',
    letterSpacing: 1.5,
    marginBottom: 4,
  },
  title: {
    fontSize: 18,
    fontFamily: 'Helvetica-Bold',
    color: c.ink,
    marginBottom: 6,
  },
  meta: {
    fontSize: 8.5,
    color: c.mid,
  },
  rule: {
    borderBottomWidth: 1,
    borderBottomColor: c.rule,
    marginVertical: 12,
  },
  paragraph: {
    marginBottom: 10,
  },
  line: {
    fontSize: 10,
    lineHeight: 1.6,
    color: c.ink,
  },
  emptyLine: {
    fontSize: 10,
    lineHeight: 0.8,
  },
  footer: {
    position: 'absolute',
    bottom: 32,
    left: 56,
    right: 56,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  footerText: {
    fontSize: 8,
    color: c.mute,
  },
});

interface Props {
  doc: Doc;
  settings?: Settings | null;
}

export function DocumentPDF({ doc, settings }: Props) {
  const bizName = settings?.businessName ?? '';
  const typeLabel = DOC_TYPE_LABEL[doc.type] ?? 'Document';
  const accent = brandColor(settings);
  const logo = settings?.logo;


  return (
    <Document>
      <Page size="A4" style={s.page}>
        <View style={[s.band, { backgroundColor: accent }]} fixed />

        {/* Header */}
        <View style={[s.header, { borderBottomColor: accent }]}>
          {logo ? (
            <Image src={logo} style={s.logo} />
          ) : bizName ? (
            <View style={[s.logoMark, { backgroundColor: accent }]}>
              <Text style={s.logoMarkText}>{initials(bizName)}</Text>
            </View>
          ) : null}
          <Text style={[s.docType, { color: accent }]}>{typeLabel}</Text>
          <Text style={s.title}>{doc.title}</Text>
          {bizName ? <Text style={s.meta}>{bizName}</Text> : null}
        </View>

        {/* Content (markdown) */}
        {renderMarkdownPdf(doc.content, accent)}

        {/* Footer */}
        <View style={s.footer} fixed>
          <Text style={s.footerText}>{bizName}</Text>
          <Text style={s.footerText} render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`} />
        </View>
      </Page>
    </Document>
  );
}
