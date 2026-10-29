import type { Metadata } from "next";

import { SignInForm } from "@/components/auth-forms";

export const metadata: Metadata = { title: "Sign in" };

type LoginPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

const CALLBACK_ERRORS: Record<string, string> = {
  confirmation_failed: "That confirmation link is invalid or has expired. Sign in or register again.",
  missing_code: "The confirmation link is incomplete. Request a new email and try again.",
};

function single(value: string | string[] | undefined): string | null {
  const resolved = Array.isArray(value) ? value[0] : value;
  return resolved && resolved.length > 0 ? resolved : null;
}

function safeNext(value: string | null): string | null {
  if (!value || !value.startsWith("/") || value.startsWith("//")) return null;
  return value;
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const params = await searchParams;
  const errorCode = single(params.error);
  const initialError = errorCode
    ? (CALLBACK_ERRORS[errorCode] ?? "Sign-in failed. Please try again.")
    : null;

  return <SignInForm nextPath={safeNext(single(params.next))} initialError={initialError} />;
}
