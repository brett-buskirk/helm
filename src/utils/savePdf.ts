/**
 * Save a generated PDF blob to disk, cross-platform.
 *
 * In the Tauri desktop app the webview ignores blob `<a download>` saves, so we
 * use the native save dialog + filesystem write. On the web we fall back to the
 * standard blob-URL anchor download.
 */
export async function savePdf(blob: Blob, fileName: string): Promise<void> {
  const isTauri = typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;

  if (isTauri) {
    const [{ save }, { writeFile }, path] = await Promise.all([
      import('@tauri-apps/plugin-dialog'),
      import('@tauri-apps/plugin-fs'),
      import('@tauri-apps/api/path'),
    ]);
    // Default the dialog to the user's Downloads folder (falling back to home),
    // rather than the app's working directory (which is src-tauri during dev).
    let defaultPath = fileName;
    try {
      const dir = await path.downloadDir().catch(() => path.homeDir());
      defaultPath = await path.join(dir, fileName);
    } catch {
      // Keep the bare filename if the path APIs aren't available.
    }
    const target = await save({
      defaultPath,
      filters: [{ name: 'PDF', extensions: ['pdf'] }],
    });
    if (!target) return; // user cancelled the dialog
    await writeFile(target, new Uint8Array(await blob.arrayBuffer()));
    return;
  }

  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
