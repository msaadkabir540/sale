"use client";

import { useActionState } from "react";

import { deleteMemoAction } from "@/app/(app)/memos/actions";
import { Alert } from "@/components/alert";
import { TrashIcon } from "@/components/icons";
import { SubmitButton } from "@/components/ui/submit-button";
import { Input } from "@/components/ui/input";
import { IDLE_ACTION_STATE } from "@/lib/action-state";

export function DeleteMemoButton({ memoId }: { memoId: string }) {
  const [state, formAction] = useActionState(deleteMemoAction, IDLE_ACTION_STATE);

  return (
    <div>
      {state.status === "error" && state.message ? (
        <Alert variant="error" className="mb-3">
          {state.message}
        </Alert>
      ) : null}

      <form
        action={formAction}
        onSubmit={(event) => {
          if (!window.confirm("Delete this sale and all of its line items? This cannot be undone.")) {
            event.preventDefault();
          }
        }}
      >
        <Input type="hidden" name="memoId" value={memoId} />
        <SubmitButton
          className="btn btn-danger btn-sm"
          pendingLabel="Deleting…"
        >
          <TrashIcon className="size-4" />
          Delete sale
        </SubmitButton>
      </form>
    </div>
  );
}
