import "server-only";
import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";

export const RESUME_BUCKET = process.env.SUPABASE_STORAGE_BUCKET ?? "resumes";
const SIGNED_URL_SECONDS = 60;

let client: ReturnType<typeof createClient> | null = null;

// Server-only client using the secret key. It bypasses security rules, so it must never reach the browser.
function storage() {
  if (!client) {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SECRET_KEY;
    if (!url || !key) throw new Error("SUPABASE_URL and SUPABASE_SECRET_KEY must be set");
    client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  }
  return client.storage;
}

/** Uploads a resume under a random name and returns its object path. */
export async function uploadResume(jobId: string, file: { bytes: Uint8Array; ext: string; contentType: string }) {
  const path = `${jobId}/${randomUUID()}.${file.ext}`;
  const { error } = await storage()
    .from(RESUME_BUCKET)
    .upload(path, file.bytes, { contentType: file.contentType, upsert: false });
  if (error) throw new Error(`Resume upload failed: ${error.message}`);
  return path;
}

export async function deleteResume(path: string) {
  const { error } = await storage().from(RESUME_BUCKET).remove([path]);
  if (error) console.error("Resume delete failed:", error.message);
}

/** A link that stops working after 60 seconds. Call only after checking the user's role. */
export async function signedResumeUrl(path: string) {
  const { data, error } = await storage().from(RESUME_BUCKET).createSignedUrl(path, SIGNED_URL_SECONDS);
  if (error || !data) throw new Error(`Could not create resume link: ${error?.message}`);
  return data.signedUrl;
}
