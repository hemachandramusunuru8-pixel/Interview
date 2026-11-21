-- Every table is private to the server. With RLS on and no policies, the Supabase
-- Data API roles (anon, authenticated) can read nothing. The app connects with a
-- server-side role that bypasses RLS.
ALTER TABLE "user" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "session" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "account" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "verification" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "rate_limit" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "activity_log" ENABLE ROW LEVEL SECURITY;
