import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';
import type { Document as Doc, Settings } from '../../types';

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
    paddingTop: 52,
    paddingBottom: 64,
    paddingHorizontal: 56,
    fontFamily: 'Helvetica',
    fontSize: 10,
    color: c.ink,
  },
  header: {
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

  // Split content into paragraphs (double newline), then lines within each
  const paragraphs = doc.content.split(/\n\n+/);

  return (
    <Document>
      <Page size="A4" style={s.page}>
        {/* Header */}
        <View style={s.header}>
          <Text style={s.docType}>{typeLabel}</Text>
          <Text style={s.title}>{doc.title}</Text>
          {bizName ? <Text style={s.meta}>{bizName}</Text> : null}
        </View>

        {/* Content */}
        {paragraphs.map((para, pi) => {
          const lines = para.split('\n');
          return (
            <View key={pi} style={s.paragraph}>
              {lines.map((line, li) =>
                line.trim() === '' ? (
                  <Text key={li} style={s.emptyLine}> </Text>
                ) : (
                  <Text key={li} style={s.line}>
                    {line}
                  </Text>
                ),
              )}
            </View>
          );
        })}

        {/* Footer */}
        <View style={s.footer} fixed>
          <Text style={s.footerText}>{bizName}</Text>
          <Text style={s.footerText} render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`} />
        </View>
      </Page>
    </Document>
  );
}
