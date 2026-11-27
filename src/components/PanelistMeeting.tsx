"use client";

import { useEffect, useRef, useState } from "react";
import { VideoIcon } from "@/components/icons";
import { Button, buttonClass } from "@/components/ui";
import { readMeetingStatus } from "@/app/panelist/interviews/actions";
import { CompleteInterviewForm } from "@/app/panelist/interviews/forms";

export function PanelistMeeting({ id, url, compact = false }: { id: string; url: string; compact?: boolean }) {
  const [watching, setWatching] = useState(false);
  const [blocked, setBlocked] = useState(false);
  const child = useRef<Window | null>(null);
  useEffect(() => {
    if (!watching) return;
    let active = true;
    let busy = false;
    async function check() {
      if (busy) return;
      busy = true;
      try {
        const status = await readMeetingStatus(id);
        if (!active || status === "scheduled") return;
        if (status === "completed") {
          try { child.current?.close(); window.focus(); } catch { /* Browser controls focus. */ }
        }
        window.location.replace(`/panelist/interviews?returned=${encodeURIComponent(id)}#feedback-due`);
      } catch { /* Retry on focus or the next interval. */ }
      finally { busy = false; }
    }
    void check();
    const timer = window.setInterval(check, 15000);
    window.addEventListener("focus", check);
    return () => { active = false; clearInterval(timer); window.removeEventListener("focus", check); };
  }, [id, watching]);

  function join() {
    const destination = new URL(url);
    if (destination.protocol !== "https:") return;
    const tab = window.open("about:blank", "_blank");
    if (tab) {
      tab.opener = null;
      tab.location.replace(destination.href);
    }
    child.current = tab;
    setBlocked(!tab);
    setWatching(true);
  }
  if (watching) return <div className="grid gap-2">
    <span role="status">{blocked ? "Your browser blocked the meeting window." : "Waiting for Teams to confirm the meeting has ended."}</span>
    {blocked && <a href={url} target="_blank" rel="noreferrer" className={buttonClass("secondary", "sm")}>Open Teams</a>}
    <CompleteInterviewForm interviewId={id} returnToList />
  </div>;
  return <>
    <Button type="button" variant={compact ? "secondary" : "primary"} onClick={join}><VideoIcon width={16} height={16} />{compact ? "Join" : "Join Teams meeting"}</Button>
    {!compact && <CompleteInterviewForm interviewId={id} />}
  </>;
}
