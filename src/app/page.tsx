import { redirect } from "next/navigation";
import { getSession, ROLE_HOME } from "@/lib/dal";

// Sends each signed-in user to the area for their role.
export default async function Home() {
  const s = await getSession();
  if (!s) redirect("/login");
  redirect(ROLE_HOME[s.user.role]);
}
