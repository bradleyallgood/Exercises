"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { ACTIVITY_TYPES } from "@/lib/schemas";

// LEARNING NOTE: "use client" marks a Client Component: it runs in the browser
// and can use state, effects, and event handlers. Keep these small and push
// them to the leaves of the tree so most of the page stays server-rendered.

function toLocalInputValue(date: Date): string {
  const offsetMs = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offsetMs).toISOString().slice(0, 16);
}

export function ActivityForm() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);

    const form = event.currentTarget;
    const data = new FormData(form);
    const distance = String(data.get("distanceKm") ?? "").trim();

    const payload = {
      type: data.get("type"),
      durationMinutes: Number(data.get("durationMinutes")),
      ...(distance !== "" ? { distanceKm: Number(distance) } : {}),
      performedAt: new Date(String(data.get("performedAt"))).toISOString(),
    };

    try {
      const response = await fetch("/api/activities", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as {
          error?: string;
        } | null;
        setError(body?.error ?? `Request failed (${response.status})`);
        return;
      }

      form.reset();
      // Re-run the Server Component so the list and stats update.
      router.refresh();
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setSubmitting(false);
    }
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
