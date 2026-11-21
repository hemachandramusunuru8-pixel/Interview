"use client";

import { Field, inputClass, selectClass } from "@/components/ui";
import { DEFAULT_TIME_ZONE, TIME_ZONES } from "@/lib/time";
import { DEFAULT_DURATION, DURATIONS } from "@/lib/validation/interview";

/** Date and time, time zone and length: the three inputs every booking form needs. */
export function SlotFields() {
  return (
    <>
      <Field label="Date and time">
        <input name="startLocal" type="datetime-local" required className={inputClass} />
      </Field>
      <Field label="Time zone">
        <select name="timeZone" defaultValue={DEFAULT_TIME_ZONE} className={selectClass}>
          {TIME_ZONES.map((z) => (
            <option key={z.id} value={z.id}>{z.label}</option>
          ))}
        </select>
      </Field>
      <Field label="Length">
        <select name="duration" defaultValue={DEFAULT_DURATION} className={selectClass}>
          {DURATIONS.map((d) => (
            <option key={d} value={d}>{d} minutes</option>
          ))}
        </select>
      </Field>
    </>
  );
}
