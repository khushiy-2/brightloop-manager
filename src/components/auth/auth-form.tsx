"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";

type AuthMode = "login" | "signup" | "forgot-password" | "reset-password";

type AuthFormProps = {
  mode: AuthMode;
  initialToken?: string;
};

const copy: Record<AuthMode, { title: string; description: string; submit: string }> = {
  login: { title: "Welcome back", description: "Sign in to your Brightloop account.", submit: "Sign in" },
  signup: { title: "Create your account", description: "Get started with Brightloop.", submit: "Create account" },
  "forgot-password": {
    title: "Reset your password",
    description: "Enter your account email and we’ll send a reset link if it exists.",
    submit: "Send reset link",
  },
  "reset-password": {
    title: "Choose a new password",
    description: "Your new password must be more than 8 characters and include upper, lower, and special characters.",
    submit: "Update password",
  },
};

export function AuthForm({ mode, initialToken = "" }: AuthFormProps) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setMessage("");

    const formData = new FormData(event.currentTarget);
    const payload = Object.fromEntries(formData.entries());
    const body = mode === "reset-password" ? { ...payload, token: initialToken } : payload;

    try {
      const response = await fetch(`/api/auth/${mode}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const result = (await response.json()) as {
        error?: string;
        message?: string;
        user?: { role: string };
      };

      if (!response.ok) {
        setError(result.error ?? "We couldn’t complete that request.");
        return;
      }

      if (mode === "login" || mode === "signup") {
        router.replace(result.user?.role === "CUSTOMER" ? "/portal" : "/dashboard");
        router.refresh();
        return;
      }
      if (mode === "reset-password") {
        router.replace("/login?reset=success");
        return;
      }
      setMessage(result.message ?? "If the email is associated with an account, a reset link will be sent.");
    } catch {
      setError("A network error occurred. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="auth-page">
      <div className="auth-brand">
        <span className="brand-mark" aria-hidden="true">B</span>
        <span>brightloop</span>
      </div>
      <section className="auth-panel" aria-labelledby="auth-title">
        <header className="auth-heading">
          <p className="eyebrow">SUBSCRIPTION MANAGEMENT</p>
          <h1 id="auth-title">{copy[mode].title}</h1>
          <p>{copy[mode].description}</p>
        </header>

        <form className="auth-form" onSubmit={submit}>
          {mode === "signup" && (
            <label className="form-field">
              <span>Name</span>
              <input name="name" autoComplete="name" required maxLength={120} />
            </label>
          )}
          {mode !== "reset-password" && (
            <label className="form-field">
              <span>Email</span>
              <input name="email" type="email" autoComplete="email" required />
            </label>
          )}
          {(mode === "login" || mode === "signup" || mode === "reset-password") && (
            <label className="form-field">
              <span>{mode === "reset-password" ? "New password" : "Password"}</span>
              <input
                name="password"
                type="password"
                autoComplete={mode === "login" ? "current-password" : "new-password"}
                minLength={mode === "login" ? 1 : 9}
                required
              />
            </label>
          )}

          {error && <p className="form-message form-error" role="alert">{error}</p>}
          {message && <p className="form-message form-success" role="status">{message}</p>}
          {mode === "reset-password" && !initialToken && (
            <p className="form-message form-error" role="alert">This reset link is missing its token.</p>
          )}

          <button className="primary-button" type="submit" disabled={busy || (mode === "reset-password" && !initialToken)}>
            {busy ? "Please wait…" : copy[mode].submit}
          </button>
        </form>

        <footer className="auth-footer">
          {mode === "login" && (
            <>
              <Link href="/forgot-password">Forgot password?</Link>
              <span>New to Brightloop? <Link href="/signup">Create an account</Link></span>
            </>
          )}
          {mode === "signup" && <span>Already registered? <Link href="/login">Sign in</Link></span>}
          {(mode === "forgot-password" || mode === "reset-password") && <Link href="/login">Back to sign in</Link>}
        </footer>
      </section>
      <p className="auth-legal">A clearer way to manage every subscription.</p>
    </main>
  );
}