import "server-only";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { notifications, user } from "@/db/schema";
import { waitingCandidateMail } from "@/lib/emails";
import { sendMail } from "@/lib/graph";

type Notice = {
  userId: string;
  email: string;
  subject: string;
  html: string;
  title: string; // short in-app text
  body: string;
  link?: string;
};

/** Saves an in-app notification and sends the matching email. A failed email never blocks the action. */
export async function notifyUser(n: Notice) {
  await db.insert(notifications).values({ userId: n.userId, title: n.title, body: n.body, link: n.link ?? null });
  try {
    await sendMail({ to: n.email, subject: n.subject, html: n.html });
  } catch (err) {
    console.error("Notification email failed:", err);
  }
}

type Broadcast = Omit<Notice, "userId" | "email" | "subject" | "html"> & {
  mailFor: (panelistName: string) => { subject: string; html: string };
};

/** Notifies every active panelist (in-app and email). One failure never stops the others. */
export async function notifyAllPanelists(b: Broadcast) {
  const panelists = await db
    .select({ id: user.id, name: user.name, email: user.email })
    .from(user)
    .where(and(eq(user.role, "panelist"), eq(user.banned, false)));
  await Promise.allSettled(
    panelists.map((p) => {
      const mail = b.mailFor(p.name);
      return notifyUser({
        userId: p.id,
        email: p.email,
        subject: mail.subject,
        html: mail.html,
        title: b.title,
        body: b.body,
        link: b.link,
      });
    }),
  );
  return panelists.length;
}

/** Tells every panelist that a candidate is waiting for an interview. Never throws: it must not block the caller. */
export async function announceWaitingCandidate(candidateName: string, jobTitle: string, round: number) {
  try {
    await notifyAllPanelists({
      title: "Candidate waiting for an interview",
      body: `${candidateName} - ${jobTitle}, round ${round}`,
      link: "/panelist/pipeline",
      mailFor: (name) => waitingCandidateMail(name, { candidateName, jobTitle, round }),
    });
  } catch (err) {
    console.error("Could not notify panelists:", err);
  }
}
