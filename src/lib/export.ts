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

/** Saves text as a file via a temporary object URL and a download link. */
export function downloadText(filename: string, text: string, type = "text/markdown"): void {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}
