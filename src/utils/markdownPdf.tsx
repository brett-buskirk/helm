import { Text, View, Link, StyleSheet } from '@react-pdf/renderer';
import { marked, type Token, type Tokens } from 'marked';

/**
 * marked HTML-escapes the `.text` fields of its tokens (`"` → `&quot;`, `&` →
 * `&amp;`, `<`/`>` → `&lt;`/`&gt;`, `'` → `&#39;`) because it's built to emit
 * HTML. We render that text into @react-pdf `<Text>`, which is NOT HTML — so the
 * entities would show up literally (e.g. `&quot;SOW&quot;`). Decode them back to
 * real characters. `&amp;` is decoded last so a literal `&quot;` in the source
 * (escaped by marked to `&amp;quot;`) round-trips correctly.
 */
export function decode(text: string): string {
  return text
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#x([0-9a-fA-F]+);/g, (_, n: string) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&#(\d+);/g, (_, n: string) => String.fromCodePoint(Number(n)))
    .replace(/&amp;/g, '&');
}

function makeStyles(accent: string) {
  return StyleSheet.create({
    h1: { fontSize: 15, fontFamily: 'Helvetica-Bold', color: '#0f172a', marginTop: 12, marginBottom: 6 },
    h2: { fontSize: 12.5, fontFamily: 'Helvetica-Bold', color: '#0f172a', marginTop: 10, marginBottom: 5 },
    h3: { fontSize: 11, fontFamily: 'Helvetica-Bold', color: '#1e293b', marginTop: 8, marginBottom: 4 },
    paragraph: { fontSize: 10, color: '#334155', lineHeight: 1.5, marginBottom: 8 },
    listItem: { flexDirection: 'row', marginBottom: 3 },
    bullet: { width: 16, fontSize: 10, color: '#334155' },
    listText: { flex: 1, fontSize: 10, color: '#334155', lineHeight: 1.5 },
    quote: { borderLeftWidth: 2, borderLeftColor: '#cbd5e1', paddingLeft: 8, marginBottom: 8 },
    quoteText: { fontSize: 10, color: '#64748b', lineHeight: 1.5 },
    code: { fontFamily: 'Courier', fontSize: 9, backgroundColor: '#f1f5f9', color: '#0f172a', padding: 8, marginBottom: 8 },
    hr: { borderBottomWidth: 1, borderBottomColor: '#e2e8f0', marginVertical: 8 },
    tableHeader: { fontSize: 10, fontFamily: 'Helvetica-Bold', color: '#0f172a', marginBottom: 2 },
    link: { color: accent, textDecoration: 'none' },
    bold: { fontFamily: 'Helvetica-Bold' },
    italic: { fontFamily: 'Helvetica-Oblique' },
    mono: { fontFamily: 'Courier' },
  });
}

type Styles = ReturnType<typeof makeStyles>;

/** Render inline tokens (bold/italic/code/links) as nested <Text>. */
function inline(tokens: Token[] | undefined, s: Styles, key: string): React.ReactNode {
  if (!tokens) return null;
  return tokens.map((t, i) => {
    const k = `${key}-${i}`;
    switch (t.type) {
      case 'strong':
        return <Text key={k} style={s.bold}>{inline((t as Tokens.Strong).tokens, s, k)}</Text>;
      case 'em':
        return <Text key={k} style={s.italic}>{inline((t as Tokens.Em).tokens, s, k)}</Text>;
      case 'codespan':
        return <Text key={k} style={s.mono}>{decode((t as Tokens.Codespan).text)}</Text>;
      case 'link': {
        const lt = t as Tokens.Link;
        return <Link key={k} src={lt.href} style={s.link}>{inline(lt.tokens, s, k)}</Link>;
      }
      case 'br':
        return <Text key={k}>{'\n'}</Text>;
      case 'text': {
        const tt = t as Tokens.Text;
        return tt.tokens ? <Text key={k}>{inline(tt.tokens, s, k)}</Text> : <Text key={k}>{decode(tt.text)}</Text>;
      }
      default:
        return <Text key={k}>{(t as { raw?: string }).raw ?? ''}</Text>;
    }
  });
}

/**
 * Parse a markdown string and return @react-pdf block elements. Covers the
 * document/proposal cases: headings, paragraphs, lists, bold/italic/code, links,
 * blockquotes, code blocks, rules, and (simply) tables.
 */
export function renderMarkdownPdf(content: string, accent = '#6366f1'): React.ReactElement[] {
  const s = makeStyles(accent);
  const tokens = marked.lexer(content ?? '');
  const out: React.ReactElement[] = [];

  tokens.forEach((tok, i) => {
    const key = `b-${i}`;
    switch (tok.type) {
      case 'heading': {
        const h = tok as Tokens.Heading;
        const style = h.depth === 1 ? s.h1 : h.depth === 2 ? s.h2 : s.h3;
        out.push(<Text key={key} style={style}>{inline(h.tokens, s, key)}</Text>);
        break;
      }
      case 'paragraph':
        out.push(<Text key={key} style={s.paragraph}>{inline((tok as Tokens.Paragraph).tokens, s, key)}</Text>);
        break;
      case 'list': {
        const l = tok as Tokens.List;
        const start = typeof l.start === 'number' ? l.start : 1;
        l.items.forEach((item, j) => {
          out.push(
            <View key={`${key}-${j}`} style={s.listItem}>
              <Text style={s.bullet}>{l.ordered ? `${start + j}.` : '•'}</Text>
              <Text style={s.listText}>{inline(item.tokens, s, `${key}-${j}`)}</Text>
            </View>,
          );
        });
        break;
      }
      case 'blockquote':
        out.push(
          <View key={key} style={s.quote}>
            <Text style={s.quoteText}>{decode((tok as Tokens.Blockquote).text)}</Text>
          </View>,
        );
        break;
      case 'code':
        out.push(<Text key={key} style={s.code}>{decode((tok as Tokens.Code).text)}</Text>);
        break;
      case 'hr':
        out.push(<View key={key} style={s.hr} />);
        break;
      case 'table': {
        const tb = tok as Tokens.Table;
        out.push(
          <Text key={`${key}-h`} style={s.tableHeader}>
            {tb.header.map((c) => decode(c.text)).join('   |   ')}
          </Text>,
        );
        tb.rows.forEach((row, r) => {
          out.push(
            <Text key={`${key}-${r}`} style={s.paragraph}>
              {row.map((c) => decode(c.text)).join('   |   ')}
            </Text>,
          );
        });
        break;
      }
      case 'space':
        break;
      default: {
        const raw = (tok as { raw?: string }).raw?.trim();
        if (raw) out.push(<Text key={key} style={s.paragraph}>{raw}</Text>);
      }
    }
  });

  return out;
}
