"use client";

import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";

export function SignOutButton() {
  const router = useRouter();

  async function handleClick() {
    await authClient.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <button type="button" onClick={handleClick}>
      Sign out
    </button>
  );
}
