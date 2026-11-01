"use client";

// LEARNING NOTE: error.tsx is a route-level error boundary. It must be a
// Client Component. `reset` re-renders the segment to retry.
export default function Error({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main>
      <h1>Something went wrong</h1>
      <p className="muted">The page failed to load.</p>
      <button onClick={reset}>Try again</button>
    </main>
  );
}
