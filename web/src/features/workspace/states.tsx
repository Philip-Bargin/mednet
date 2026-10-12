import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { StateMessage } from "@/components/ui/state-message";

/** Shared list states for workspace views (patient and provider). */
export function LoadingRows({ label, rows = 3 }: { label: string; rows?: number }) {
  return (
    <div aria-busy className="flex flex-col gap-3 py-4">
      <span role="status" className="sr-only">
        {label}
      </span>
      {Array.from({ length: rows }, (_, index) => (
        <Skeleton key={index} className="h-12 w-full" />
      ))}
    </div>
  );
}

/** Failed load: a permission refusal (403) reads as denied with no retry; anything else can be retried. */
export function ErrorRow({ title, onRetry, status }: { title: string; onRetry: () => void; status?: number }) {
  if (status === 403) {
    return (
      <StateMessage
        kind="denied"
        layout="inline"
        className="mt-4"
        title="You do not have permission to see this information."
      />
    );
  }
  return (
    <StateMessage
      kind="error"
      layout="inline"
      className="mt-4"
      title={title}
      action={
        <Button variant="secondary" size="sm" onClick={onRetry}>
          Try again
        </Button>
      }
    />
  );
}
