import { ActivityForm } from "@/components/ActivityForm";
import { summarize } from "@/lib/stats";
import { activityStore } from "@/lib/store";

// LEARNING NOTE: this is a Server Component. It is an async function that
// reads data directly (no useEffect, no fetch to our own API). The browser
// receives finished HTML. Only ActivityForm ships JavaScript to the client.
//
// force-dynamic: render on every request so new activities show up. In a real
// app you would think harder about caching (revalidate, tags, etc).
export const dynamic = "force-dynamic";

const dateFormat = new Intl.DateTimeFormat("en-US", {
  dateStyle: "medium",
  timeStyle: "short",
});

export default async function HomePage() {
  const activities = await activityStore.list();
  const summary = summarize(activities);

  return (
    <main>
      <h1>Activity Tracker</h1>
      <p className="subtitle">Next.js App Router, TypeScript, Zod-validated API.</p>

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
    </main>
  );
}
