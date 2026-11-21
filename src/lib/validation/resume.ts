export const MAX_RESUME_BYTES = 5 * 1024 * 1024;

type Kind = { ext: "pdf" | "doc" | "docx"; contentType: string };

const KINDS: Record<string, Kind> = {
  pdf: { ext: "pdf", contentType: "application/pdf" },
  doc: { ext: "doc", contentType: "application/msword" },
  docx: {
    ext: "docx",
    contentType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  },
};

function startsWith(bytes: Uint8Array, signature: number[]) {
  return signature.every((b, i) => bytes[i] === b);
}

// File signatures ("magic bytes"): the start of the file must match the claimed type.
const SIGNATURES: Record<Kind["ext"], number[]> = {
  pdf: [0x25, 0x50, 0x44, 0x46, 0x2d], // %PDF-
  docx: [0x50, 0x4b, 0x03, 0x04], // ZIP container
  doc: [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1], // legacy Office (OLE2)
};

export type ResumeCheck =
  | { ok: true; ext: Kind["ext"]; contentType: string }
  | { ok: false; error: string };

/** Checks the file name, size and the real content type. Does not trust the browser-supplied type. */
export function checkResume(name: string, size: number, bytes: Uint8Array): ResumeCheck {
  if (size === 0 || bytes.length === 0) return { ok: false, error: "The resume file is empty." };
  if (size > MAX_RESUME_BYTES || bytes.length > MAX_RESUME_BYTES) {
    return { ok: false, error: "The resume is larger than 5 MB." };
  }
  const ext = name.includes(".") ? name.split(".").pop()!.toLowerCase() : "";
  const kind = KINDS[ext];
  if (!kind) return { ok: false, error: "Upload a PDF, DOC or DOCX file." };
  if (!startsWith(bytes, SIGNATURES[kind.ext])) {
    return { ok: false, error: "The file content does not match its type. Upload a real PDF, DOC or DOCX." };
  }
  return { ok: true, ext: kind.ext, contentType: kind.contentType };
}
