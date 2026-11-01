"use client";

import { useState, useTransition } from "react";
import { createActivity } from "@/app/actions";
import { ACTIVITY_TYPES } from "@/lib/schemas";

// LEARNING NOTE: "use client" marks a Client Component: it runs in the browser
// and can use state, effects, and event handlers. Keep these small and push
// them to the leaves of the tree so most of the page stays server-rendered.

function toLocalInputValue(date: Date): string {
  const offsetMs = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offsetMs).toISOString().slice(0, 16);
}

export function ActivityForm() {
  const [error, setError] = useState<string | null>(null);
  const [submitting, startSubmit] = useTransition();

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    const form = event.currentTarget;
    const data = new FormData(form);
    const distance = String(data.get("distanceKm") ?? "").trim();

    // LEARNING NOTE: datetime-local has no timezone, so convert it here in the
    // browser. Parsed in the action, it would use the server's timezone instead.
    const payload = {
      type: data.get("type"),
      durationMinutes: Number(data.get("durationMinutes")),
      ...(distance !== "" ? { distanceKm: Number(distance) } : {}),
      performedAt: new Date(String(data.get("performedAt"))).toISOString(),
    };

    startSubmit(async () => {
      try {
        const result = await createActivity(payload);
        if (result.error) {
          setError(result.error);
          return;
        }
        form.reset();
      } catch {
        setError("Something went wrong. Please try again.");
      }
    });
  }

  return (
    <form onSubmit={handleSubmit}>
      <label>
        Type
        <select name="type" defaultValue="run">
          {ACTIVITY_TYPES.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
      </label>

      <label>
        Duration (minutes)
        <input name="durationMinutes" type="number" min={1} max={1440} step={1} required />
      </label>

      <label>
        Distance (km, optional)
        <input name="distanceKm" type="number" min={0} step="0.01" />
      </label>

      <label>
        When
        <input
          name="performedAt"
          type="datetime-local"
          defaultValue={toLocalInputValue(new Date())}
          required
        />
      </label>

      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}

      <button type="submit" disabled={submitting}>
        {submitting ? "Saving..." : "Add activity"}
      </button>
    </form>
  );
}
