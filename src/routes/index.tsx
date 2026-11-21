import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { ListOrdered } from "lucide-react";
import { useState, type ReactNode } from "react";
import { toast } from "sonner";
import { EmptyState } from "@/client/components/EmptyState";
import { Page } from "@/client/components/Page";
import { PageHeader } from "@/client/components/PageHeader";
import { STATUS_LABELS, StatusBadge } from "@/client/components/StatusBadge";
import { Alert, AlertDescription } from "@/client/components/ui/alert";
import { Button } from "@/client/components/ui/button";
import { Card, CardContent } from "@/client/components/ui/card";
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/client/components/ui/field";
import { Input } from "@/client/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/client/components/ui/select";
import { messageOf } from "@/client/lib/errors";
import type { RequestStatus } from "@/db/schema";
import type { QueueRow, SubmitResult } from "@/server/requests";
import { normalizeHost, queuePosition } from "@/shared/urls";
import {
  getQueue,
  setRequestStatus,
  submitRequest,
  withdrawRequest,
} from "@/serverFunctions/queue";

export const Route = createFileRoute("/")({
  loader: () => getQueue(),
  head: () => ({ meta: [{ title: "Build queue · App Requests" }] }),
  component: QueuePage,
});

function QueuePage() {
  const { building, queued, finished, admin } = Route.useLoaderData();
  const empty = building.length + queued.length + finished.length === 0;
  return (
    <Page>
      <PageHeader
        title="Build queue"
        description={
          <>
            <span data-testid="count-building">{building.length}</span>{" "}
            building ·{" "}
            <span data-testid="count-queued">{queued.length}</span> in line
          </>
        }
      />
      <RequestForm />
      {empty ? (
        <EmptyState
          icon={ListOrdered}
          title="No requests yet"
          description="Paste a product's address above and it joins the line."
        />
      ) : (
        <>
          {building.length > 0 && (
            <Section title="Building" testId="queue-building">
              {building.map((row) => (
                <RequestRow key={row.id} row={row} admin={admin} />
              ))}
            </Section>
          )}
          <Section title="In line" testId="queue-waiting">
            {queued.length === 0 ? (
              <li className="px-5 py-4 text-sm text-muted-foreground">
                Nobody is waiting.
              </li>
            ) : (
              queued.map((row, index) => (
                <RequestRow
                  key={row.id}
                  row={row}
                  admin={admin}
                  position={queuePosition(index + 1)}
                />
              ))
            )}
          </Section>
          {finished.length > 0 && (
            <Section title="Recently finished" testId="queue-finished">
              {finished.map((row) => (
                <RequestRow key={row.id} row={row} admin={admin} />
              ))}
            </Section>
          )}
        </>
      )}
    </Page>
  );
}

function RequestForm() {
  const router = useRouter();
  const [url, setUrl] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [existing, setExisting] = useState<SubmitResult | null>(null);
  const [pending, setPending] = useState(false);

  async function submit() {
    setError(null);
    setExisting(null);
    if (!normalizeHost(url)) {
      setError("Enter a web address such as https://example.com.");
      return;
    }
    setPending(true);
    try {
      const result = await submitRequest({ data: { url, note } });
      if (result.kind === "created") {
        setUrl("");
        setNote("");
        toast.success(`${result.host} joined the line.`);
      } else {
        setExisting(result);
      }
      await router.invalidate();
    } catch (cause) {
      setError(messageOf(cause));
    } finally {
      setPending(false);
    }
  }

  return (
    <Card>
      <CardContent>
        <form
          noValidate
          onSubmit={(event) => {
            event.preventDefault();
            void submit();
          }}
        >
          <FieldGroup>
            <Field data-invalid={error ? true : undefined}>
              <FieldLabel htmlFor="request-url">Product address</FieldLabel>
              <Input
                id="request-url"
                data-testid="request-url"
                inputMode="url"
                autoComplete="off"
                placeholder="https://example.com"
                value={url}
                aria-invalid={error ? true : undefined}
                onChange={(event) => setUrl(event.target.value)}
              />
              {error && (
                <FieldError data-testid="request-error">{error}</FieldError>
              )}
            </Field>
            <Field>
              <FieldLabel htmlFor="request-note">Note (optional)</FieldLabel>
              <Input
                id="request-note"
                data-testid="request-note"
                maxLength={500}
                placeholder="What you use it for"
                value={note}
                onChange={(event) => setNote(event.target.value)}
              />
            </Field>
            {existing && <Existing result={existing} />}
            <div>
              <Button
                type="submit"
                data-testid="request-submit"
                pending={pending}
              >
                Request a build
              </Button>
            </div>
          </FieldGroup>
        </form>
      </CardContent>
    </Card>
  );
}

function Existing({ result }: { result: SubmitResult }) {
  if (result.kind === "created") return null;
  return (
    <Alert data-testid="request-duplicate">
      <AlertDescription>
        {result.kind === "library" ? (
          <>
            {result.host} is already in the library as{" "}
            <Link
              to="/library/$slug"
              params={{ slug: result.slug }}
              className="font-medium text-foreground underline underline-offset-4"
            >
              {result.name}
            </Link>
            .
          </>
        ) : (
          <>
            {result.host} is already requested and{" "}
            {result.status === "queued" || result.status === "building"
              ? `is ${STATUS_LABELS[result.status].toLowerCase()}`
              : `was ${STATUS_LABELS[result.status].toLowerCase()}`}
            .
          </>
        )}
      </AlertDescription>
    </Alert>
  );
}

function Section({
  title,
  testId,
  children,
}: {
  title: string;
  testId: string;
  children: ReactNode;
}) {
  return (
    <section className="space-y-3" data-testid={testId}>
      <h2 className="text-base font-semibold tracking-tight">{title}</h2>
      <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-card text-card-foreground shadow-xs">
        {children}
      </ul>
    </section>
  );
}

const STATUS_ITEMS = (
  Object.entries(STATUS_LABELS) as [RequestStatus, string][]
).map(([value, label]) => ({ value, label }));

function RequestRow({
  row,
  admin,
  position,
}: {
  row: QueueRow;
  admin: boolean;
  position?: string;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function change(work: () => Promise<unknown>, done: string) {
    setPending(true);
    try {
      await work();
      await router.invalidate();
      toast.success(done);
    } catch (cause) {
      toast.error(messageOf(cause));
    } finally {
      setPending(false);
    }
  }

  return (
    <li
      data-testid="queue-row"
      data-host={row.host}
      className="flex flex-wrap items-center gap-x-4 gap-y-2 px-5 py-3"
    >
      <div className="min-w-0 flex-1 basis-48">
        <p className="truncate font-medium">{row.host}</p>
        <p className="truncate text-sm text-muted-foreground">
          <span data-testid="row-requester">{row.requester}</span>
          {row.note ? <> · {row.note}</> : null}
        </p>
      </div>
      <div className="flex shrink-0 flex-wrap items-center gap-2">
        {position && (
          <span
            data-testid="row-position"
            className="text-sm font-medium text-muted-foreground tabular-nums"
          >
            {position}
          </span>
        )}
        <StatusBadge status={row.status} />
        {row.appSlug && (
          <Button
            variant="link"
            size="sm"
            data-testid="row-app-link"
            nativeButton={false}
            render={<Link to="/library/$slug" params={{ slug: row.appSlug }} />}
          >
            Open in library
          </Button>
        )}
        {row.mine && row.status === "queued" && (
          <Button
            variant="ghost"
            size="sm"
            data-testid="row-withdraw"
            pending={pending}
            onClick={() =>
              change(
                () => withdrawRequest({ data: { id: row.id } }),
                `Withdrew ${row.host}.`,
              )
            }
          >
            Withdraw
          </Button>
        )}
        {admin && (
          <Select
            items={STATUS_ITEMS}
            value={row.status}
            disabled={pending}
            onValueChange={(status) => {
              if (status && status !== row.status)
                void change(
                  () => setRequestStatus({ data: { id: row.id, status } }),
                  `${row.host}: ${STATUS_LABELS[status].toLowerCase()}.`,
                );
            }}
          >
            <SelectTrigger
              size="sm"
              data-testid="row-status-select"
              aria-label={`Status of ${row.host}`}
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {STATUS_ITEMS.map((item) => (
                <SelectItem key={item.value} value={item.value}>
                  {item.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>
    </li>
  );
}
