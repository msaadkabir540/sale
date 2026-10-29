import { ChevronLeftIcon, ChevronRightIcon } from "@/components/icons";
import { ButtonLink, buttonStyles } from "@/components/ui/button";

export function Pagination({
  page,
  pageCount,
  total,
  pageSize,
  buildHref,
}: {
  page: number;
  pageCount: number;
  total: number;
  pageSize: number;
  buildHref: (page: number) => string;
}) {
  if (total === 0) return null;

  const first = (page - 1) * pageSize + 1;
  const last = Math.min(page * pageSize, total);
  const disabledStyles = buttonStyles({
    variant: "secondary",
    size: "sm",
    className: "pointer-events-none opacity-40",
  });

  return (
    <div className="flex flex-col gap-3 border-t border-slate-100 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
      <p className="text-sm text-slate-500">
        Showing <span className="font-medium text-slate-700">{first}</span>–
        <span className="font-medium text-slate-700">{last}</span> of{" "}
        <span className="font-medium text-slate-700">{total}</span>
      </p>

      <div className="flex items-center gap-2">
        {page > 1 ? (
          <ButtonLink
            href={buildHref(page - 1)}
            variant="secondary"
            size="sm"
            rel="prev"
          >
            <ChevronLeftIcon className="size-3.5" />
            Previous
          </ButtonLink>
        ) : (
          <span className={disabledStyles}>
            <ChevronLeftIcon className="size-3.5" />
            Previous
          </span>
        )}

        <span className="px-2 text-xs font-medium text-slate-500">
          Page {page} of {Math.max(pageCount, 1)}
        </span>

        {page < pageCount ? (
          <ButtonLink
            href={buildHref(page + 1)}
            variant="secondary"
            size="sm"
            rel="next"
          >
            Next
            <ChevronRightIcon className="size-3.5" />
          </ButtonLink>
        ) : (
          <span className={disabledStyles}>
            Next
            <ChevronRightIcon className="size-3.5" />
          </span>
        )}
      </div>
    </div>
  );
}
