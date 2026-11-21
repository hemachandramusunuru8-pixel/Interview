// Runs the scheduled jobs once against a running app: closes finished interviews,
// asks for feedback and sends reminders. Usage: npm run tick
import "dotenv/config";

const base = process.env.APP_BASE_URL ?? "http://localhost:3000";
const secret = process.env.CRON_SECRET;
if (!secret) {
  console.error("CRON_SECRET is not set in .env");
  process.exit(1);
}

const res = await fetch(`${base}/api/cron/tick`, {
  method: "POST",
  headers: { Authorization: `Bearer ${secret}` },
});
console.log(res.status, await res.text());
process.exit(res.ok ? 0 : 1);
