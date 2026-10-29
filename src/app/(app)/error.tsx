"use client";

import { useEffect } from "react";

import { Alert } from "@/components/alert";
import { Button, ButtonLink } from "@/components/ui/button";

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="mx-auto max-w-xl space-y-5">
      <Alert variant="error" title="Something went wrong">
        We couldn&apos;t load this page. Your data is safe — try again, or return to the dashboard.
      </Alert>

      <div className="flex flex-wrap gap-2">
        <Button onClick={() => reset()}>Try again</Button>
        <ButtonLink href="/dashboard" variant="secondary">
          Dashboard
        </ButtonLink>
      </div>
    </div>
  );
}
