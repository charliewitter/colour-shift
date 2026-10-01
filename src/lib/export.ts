// Browser side of Export: putting text on the clipboard and saving a file.

/** Copies text; true if it worked. Falls back to the old execCommand route when the
 *  Clipboard API is missing or blocked (e.g. no permission, or not a secure context). */
export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const field = document.createElement("textarea");
    field.value = text;
    field.setAttribute("readonly", "");
    field.style.position = "fixed";
    field.style.opacity = "0";
    document.body.append(field);
    field.select();
    // Deprecated, but still the only fallback that works everywhere.
    const copied = document.execCommand("copy");
    field.remove();
    return copied;
  }
}

export type ShareResult = "shared" | "cancelled" | "unsupported";

/** Opens the device's share sheet with the link and the Markdown file (one call: the browser only
 *  allows it straight after a tap). Tries the file as Markdown, then as plain text (some browsers
 *  refuse unfamiliar types), then the link alone. "unsupported" means show our own options instead. */
export async function shareLink({
  url,
  filename,
  markdown,
}: {
  url: string;
  filename: string;
  markdown: string;
}): Promise<ShareResult> {
  if (typeof navigator.share !== "function") return "unsupported";
  const files = ["text/markdown", "text/plain"].map((type) => new File([markdown], filename, { type }));
  const file = files.find((candidate) => navigator.canShare?.({ files: [candidate] }));
  try {
    await navigator.share(file ? { files: [file], url } : { url });
    return "shared";
  } catch (error) {
    // AbortError: the person closed the sheet. Anything else (e.g. no permission): fall back.
    return error instanceof DOMException && error.name === "AbortError" ? "cancelled" : "unsupported";
  }
}

/** Saves text as a file via a temporary object URL and a download link. */
export function downloadText(filename: string, text: string, type = "text/markdown"): void {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}
