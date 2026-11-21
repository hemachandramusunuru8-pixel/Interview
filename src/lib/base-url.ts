/**
 * The public address of the app, used in emailed links and by the login system.
 * APP_BASE_URL wins; on Netlify, `URL` (the site's main address) is set automatically as a fallback.
 */
export function appBaseUrl(): string {
  const raw = process.env.APP_BASE_URL || process.env.URL || "http://localhost:3000";
  return raw.replace(/\/+$/, "");
}
