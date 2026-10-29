"use client";

import { useEffect, useState } from "react";

import {
  ArrowLeftIcon,
  LogOutIcon,
  MaximizeIcon,
  MinimizeIcon,
} from "@/components/icons";
import { ExpenseDialog } from "@/components/expense-dialog";
import { Button, ButtonLink } from "@/components/ui/button";
import { SALE_SIGNOUT_FORM_ID } from "@/components/memo-form/types";

export function MemoFormTopBar({
  title,
  memoId,
  cancelHref,
  showNavigation,
  showSignOut,
  showExpense,
}: {
  title: string;
  memoId?: string;
  cancelHref: string;
  showNavigation: boolean;
  showSignOut: boolean;
  showExpense: boolean;
}) {
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    const handleChange = () => setIsFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener("fullscreenchange", handleChange);
    handleChange();

    return () => document.removeEventListener("fullscreenchange", handleChange);
  }, []);

  async function toggleFullscreen() {
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
      } else if (document.documentElement.requestFullscreen) {
        await document.documentElement.requestFullscreen();
      }
    } catch {
      // Some browsers reject fullscreen outside a direct gesture or in embeds.
    }
  }

  return (
    <div className="flex shrink-0 flex-wrap items-center justify-between gap-3">
      <div className="flex min-w-0 items-center gap-3">
        {showNavigation ? (
          <ButtonLink
            href={cancelHref}
            variant="secondary"
            size="sm"
            className="gap-1.5 whitespace-nowrap"
          >
            <ArrowLeftIcon className="size-4" />
            Back
          </ButtonLink>
        ) : null}
        <h1 className="truncate text-xl font-semibold tracking-tight text-slate-900 sm:text-2xl">
          {title}
        </h1>
      </div>

      <div className="flex items-center gap-3">
        {showExpense ? <ExpenseDialog label="Add expense" /> : null}

        {showSignOut ? (
          <Button
            type="submit"
            form={SALE_SIGNOUT_FORM_ID}
            variant="ghost"
            size="sm"
            className="whitespace-nowrap"
          >
            <LogOutIcon className="size-4" />
            <span className="hidden sm:inline">Sign out</span>
          </Button>
        ) : null}

        <Button
          variant="ghost"
          size="sm"
          onClick={toggleFullscreen}
          className="whitespace-nowrap"
          aria-label={isFullscreen ? "Exit full screen" : "Enter full screen"}
        >
          {isFullscreen ? (
            <MinimizeIcon className="size-4" />
          ) : (
            <MaximizeIcon className="size-4" />
          )}
          <span className="hidden sm:inline">
            {isFullscreen ? "Exit full screen" : "Full screen"}
          </span>
        </Button>

        <div className="flex items-baseline gap-2">
          <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400">
            No.
          </span>
          <span className="text-sm font-semibold tabular-nums text-slate-700">
            {memoId ? memoId.slice(0, 8).toUpperCase() : "AUTO"}
          </span>
        </div>
      </div>
    </div>
  );
}
