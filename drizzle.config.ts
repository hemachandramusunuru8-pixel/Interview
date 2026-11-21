import "dotenv/config";
import { defineConfig } from "drizzle-kit";

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dbCredentials: {
    // Migrations use the direct/session connection.
    url: process.env.DIRECT_URL ?? process.env.DATABASE_URL!,
  },
});
