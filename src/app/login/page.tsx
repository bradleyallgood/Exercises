import { AuthForm } from "@/components/AuthForm";

export default function LoginPage() {
  return (
    <main>
      <h1>Sign in</h1>
      <div className="card">
        <AuthForm mode="login" />
      </div>
    </main>
  );
}
