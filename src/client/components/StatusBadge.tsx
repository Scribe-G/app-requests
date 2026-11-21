import type { RequestStatus } from "@/db/schema";
import { Badge } from "@/client/components/ui/badge";

export const STATUS_LABELS: Record<RequestStatus, string> = {
  queued: "Queued",
  building: "Building",
  done: "Done",
  declined: "Declined",
};

const VARIANTS = {
  queued: "outline",
  building: "default",
  done: "success",
  declined: "destructive",
} as const;

export function StatusBadge({ status }: { status: RequestStatus }) {
  return (
    <Badge variant={VARIANTS[status]} data-testid="row-status">
      {STATUS_LABELS[status]}
    </Badge>
  );
}
