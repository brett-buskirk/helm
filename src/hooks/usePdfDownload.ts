import { useState, useCallback } from 'react';
import type { ReactElement } from 'react';
import { pdf } from '@react-pdf/renderer';
import { savePdf } from '../utils/savePdf';

/**
 * Render a @react-pdf document to a blob and save it (native dialog in Tauri,
 * blob download on web). Returns `{ download, busy }`; `busy` disables the
 * trigger while a PDF is generating.
 */
export function usePdfDownload(onError?: (message: string) => void) {
  const [busy, setBusy] = useState(false);

  const download = useCallback(
    async (element: ReactElement, fileName: string) => {
      setBusy(true);
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const blob = await pdf(element as any).toBlob();
        await savePdf(blob, fileName);
      } catch {
        onError?.('Could not generate the PDF.');
      } finally {
        setBusy(false);
      }
    },
    [onError],
  );

  return { download, busy };
}
