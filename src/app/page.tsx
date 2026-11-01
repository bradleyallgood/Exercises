import { redirect } from "next/navigation";
import { Suspense } from "react";
import { ActivityForm } from "@/components/ActivityForm";
import { SignOutButton } from "@/components/SignOutButton";
import { getActivities } from "@/lib/activities";
import { getUser } from "@/lib/session";
import { summarize } from "@/lib/stats";

// LEARNING NOTE: this is a Server Component. It is an async function that
// reads data directly (no useEffect, no fetch to our own API). The browser
// receives finished HTML. Only the client components ship JavaScript.
//
// Reading the session makes Dashboard request-time, so it streams in behind
// Suspense while the heading is prerendered into a static shell. force-dynamic
// is gone: only the data is cached, per user. See lib/activities.ts.

const dateFormat = new Intl.DateTimeFormat("en-US", {
  dateStyle: "medium",
  timeStyle: "short",
});

export default function HomePage() {
  return (
    <main>
      <h1>Activity Tracker</h1>
      <p className="subtitle">Next.js App Router, TypeScript, Zod-validated API.</p>

      <Suspense fallback={<p className="muted">Loading your dashboard...</p>}>
        <Dashboard />
      </Suspense>
    </main>
  );
}

async function Dashboard() {
  const user = await getUser();
  if (!user) redirect("/login");

  const activities = await getActivities();
  const summary = summarize(activities);

  return (
    <>
      <p className="muted">
        Signed in as {user.email} <SignOutButton />
      </p>

      <section className="stats" aria-label="Summary">
        <div className="card">
          <div className="stat-value">{summary.count}</div>
          <div className="stat-label">Activities</div>
        </div>
        <div className="card">
          <div className="stat-value">{summary.totalMinutes}</div>
          <div className="stat-label">Total minutes</div>
        </div>
        <div className="card">
          <div className="stat-value">{summary.totalDistanceKm}</div>
          <div className="stat-label">Total km</div>
        </div>
      </section>

      <h2>Log an activity</h2>
      <div className="card">
        <ActivityForm />
      </div>

      <h2>History</h2>
      {activities.length === 0 ? (
        <p className="muted">Nothing logged yet. Add your first activity above.</p>
      ) : (
        <ul className="activities">
          {activities.map((a) => (
            <li key={a.id} className="card activity-row">
              <span>
                <span className="activity-type">{a.type}</span>{" "}
                <span className="muted">
                  {a.durationMinutes} min
                  {a.distanceKm !== undefined ? ` · ${a.distanceKm} km` : ""}
                </span>
              </span>
              <span className="muted">{dateFormat.format(new Date(a.performedAt))}</span>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
