"use client";

import Link from "next/link";
import { useActionState, useState } from "react";

import { signInAction, signUpAction } from "@/app/(auth)/actions";
import { Alert } from "@/components/alert";
import { SubmitButton } from "@/components/ui/submit-button";
import { ButtonLink } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { IDLE_AUTH_STATE } from "@/lib/action-state";

export function SignInForm({
  nextPath,
  initialError,
}: {
  nextPath: string | null;
  initialError: string | null;
}) {
  const [state, formAction] = useActionState(signInAction, IDLE_AUTH_STATE);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const errorMessage = state.status === "error" ? state.message : initialError;

  return (
    <div className="card p-6 sm:p-8">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand-600">
        Welcome back
      </p>
      <h1 className="mt-2 text-2xl font-semibold tracking-tight text-slate-900">Sign in</h1>
      <p className="mt-2 text-sm leading-6 text-slate-500">
        Use the account your owner created for you.
      </p>

      {errorMessage ? (
        <Alert variant="error" className="mt-5">
          {errorMessage}
        </Alert>
      ) : null}

      <form action={formAction} className="mt-6 space-y-4">
        {nextPath ? <Input type="hidden" name="next" value={nextPath} /> : null}

        <Field label="Email" htmlFor="email">
          <Input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            placeholder="you@example.com"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
          />
        </Field>

        <Field label="Password" htmlFor="password">
          <Input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
          />
        </Field>

        <SubmitButton className="btn btn-primary w-full" pendingLabel="Signing in…">
          Sign in
        </SubmitButton>
      </form>

      <p className="mt-6 text-center text-sm text-slate-500">
        Need an account?{" "}
        <Link href="/register" className="font-semibold text-brand-700 hover:text-brand-800">
          Create one
        </Link>
      </p>
    </div>
  );
}

export function SignUpForm() {
  const [state, formAction] = useActionState(signUpAction, IDLE_AUTH_STATE);
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  if (state.status === "success") {
    return (
      <div className="card p-6 sm:p-8">
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
          Check your email
        </h1>
        <p className="mt-2 text-sm leading-6 text-slate-500">{state.message}</p>
        <Alert variant="success" className="mt-5">
          Your account starts with the salesman role. An owner can upgrade it from the Team page.
        </Alert>
        <ButtonLink href="/login" className="mt-6 w-full">
          Go to sign in
        </ButtonLink>
      </div>
    );
  }

  return (
    <div className="card p-6 sm:p-8">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand-600">
        Join the crew
      </p>
      <h1 className="mt-2 text-2xl font-semibold tracking-tight text-slate-900">
        Create your account
      </h1>
      <p className="mt-2 text-sm leading-6 text-slate-500">
        Only the owner can change roles after signup.
      </p>

      {state.status === "error" && state.message ? (
        <Alert variant="error" className="mt-5">
          {state.message}
        </Alert>
      ) : null}

      <form action={formAction} className="mt-6 space-y-4">
        <Field label="Full name" htmlFor="fullName">
          <Input
            id="fullName"
            name="fullName"
            autoComplete="name"
            placeholder="Kai Ocean"
            maxLength={120}
            value={fullName}
            onChange={(event) => setFullName(event.target.value)}
            required
          />
        </Field>

        <Field label="Email" htmlFor="register-email">
          <Input
            id="register-email"
            name="email"
            type="email"
            autoComplete="email"
            placeholder="you@example.com"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
          />
        </Field>

        <Field
          label="Password"
          htmlFor="register-password"
          hint="At least 8 characters."
        >
          <Input
            id="register-password"
            name="password"
            type="password"
            autoComplete="new-password"
            minLength={8}
            maxLength={72}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
          />
        </Field>

        <SubmitButton className="btn btn-primary w-full" pendingLabel="Creating account…">
          Create account
        </SubmitButton>
      </form>

      <p className="mt-6 text-center text-sm text-slate-500">
        Already have an account?{" "}
        <Link href="/login" className="font-semibold text-brand-700 hover:text-brand-800">
          Sign in
        </Link>
      </p>
    </div>
  );
}
