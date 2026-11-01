import { AuthForm } from "@/components/AuthForm";

export default function SignupPage() {
  return (
    <main>
      <h1>Create an account</h1>
      <div className="card">
        <AuthForm mode="signup" />
      </div>
    </main>
  );
}
