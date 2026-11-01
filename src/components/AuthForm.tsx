"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { authClient } from "@/lib/auth-client";

export function AuthForm({ mode }: { mode: "login" | "signup" }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [submitting, startSubmit] = useTransition();
  const isSignup = mode === "signup";

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    const data = new FormData(event.currentTarget);
    const email = String(data.get("email"));
    const password = String(data.get("password"));

    startSubmit(async () => {
      try {
        const { error } = isSignup
          ? await authClient.signUp.email({ email, password, name: email })
          : await authClient.signIn.email({ email, password });
        if (error) {
          setError(error.message ?? "Something went wrong. Please try again.");
          return;
        }
        router.push("/");
        router.refresh();
      } catch {
        setError("Something went wrong. Please try again.");
      }
    });
  }

  return (
    <>
      <form onSubmit={handleSubmit}>
        <label>
          Email
          <input name="email" type="email" autoComplete="email" required />
        </label>

        <label>
          Password
          <input
            name="password"
            type="password"
            autoComplete={isSignup ? "new-password" : "current-password"}
            minLength={8}
            required
          />
        </label>

        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}

        <button type="submit" disabled={submitting}>
          {submitting ? "Please wait..." : isSignup ? "Create account" : "Sign in"}
        </button>
      </form>
      <p className="muted">
        {isSignup ? (
          <>
            Already have an account? <Link href="/login">Sign in</Link>
          </>
        ) : (
          <>
            No account yet? <Link href="/signup">Create one</Link>
          </>
        )}
      </p>
    </>
  );
}
