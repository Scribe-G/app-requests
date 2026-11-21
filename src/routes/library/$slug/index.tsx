import {
  createFileRoute,
  Link,
  notFound,
  useNavigate,
  useRouter,
} from "@tanstack/react-router";
import { ExternalLink, Pencil } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/client/components/ConfirmDialog";
import { NotFound } from "@/client/components/NotFound";
import { Page } from "@/client/components/Page";
import { PageHeader } from "@/client/components/PageHeader";
import { Badge } from "@/client/components/ui/badge";
import { Button } from "@/client/components/ui/button";
import { messageOf } from "@/client/lib/errors";
import { httpUrl } from "@/shared/urls";
import {
  deleteApp,
  getAppEntry,
  setAppPublished,
} from "@/serverFunctions/library";

export const Route = createFileRoute("/library/$slug/")({
  loader: async ({ params }) => {
    const found = await getAppEntry({ data: { slug: params.slug } });
    if (!found) throw notFound();
    return found;
  },
  head: ({ loaderData }) => ({
    meta: loaderData
      ? [{ title: `${loaderData.entry.name} · App Requests` }]
      : [],
  }),
  notFoundComponent: NotFound,
  component: EntryPage,
});

function EntryPage() {
  const { entry, admin } = Route.useLoaderData();
  const router = useRouter();
  const navigate = useNavigate();
  const [confirming, setConfirming] = useState(false);
  const [pending, setPending] = useState(false);

  async function togglePublished() {
    setPending(true);
    try {
      await setAppPublished({
        data: { id: entry.id, published: !entry.published },
      });
      await router.invalidate();
      toast.success(entry.published ? "Unpublished." : "Published.");
    } catch (cause) {
      toast.error(messageOf(cause));
    } finally {
      setPending(false);
    }
  }

  async function remove() {
    setPending(true);
    try {
      await deleteApp({ data: { id: entry.id } });
      setConfirming(false);
      toast.success(`Deleted ${entry.name}.`);
      await navigate({ to: "/library" });
    } catch (cause) {
      toast.error(messageOf(cause));
      setPending(false);
    }
  }

  return (
    <Page>
      <PageHeader
        backLink={
          <Link
            to="/library"
            className="inline-flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            Library
          </Link>
        }
        title={
          <span className="flex flex-wrap items-center gap-2">
            <span data-testid="app-name">{entry.name}</span>
            {!entry.published && (
              <Badge variant="warning" data-testid="app-unpublished">
                Unpublished
              </Badge>
            )}
          </span>
        }
        description={<span data-testid="app-purpose">{entry.purpose}</span>}
        actions={
          <>
            <OutLink href={entry.installUrl} testId="install-link" primary>
              Install
            </OutLink>
            <OutLink href={entry.repoUrl} testId="repo-link">
              Source code
            </OutLink>
          </>
        }
      />

      <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
        <span>Inspired by {entry.inspiredBy}</span>
        <span data-testid="app-categories" className="flex flex-wrap gap-2">
          {entry.categories.map((name) => (
            <Badge key={name} variant="outline">
              {name}
            </Badge>
          ))}
        </span>
      </div>

      <p data-testid="app-description" className="whitespace-pre-line">
        {entry.description}
      </p>

      <div className="grid gap-8 sm:grid-cols-2">
        <ListSection title="What it does" items={entry.does} testId="list-does" />
        <ListSection
          title="Handled by the platform"
          items={entry.handled}
          testId="list-handled"
        />
        <ListSection
          title="Left out"
          items={entry.leavesOut}
          testId="list-leaves-out"
        />
        <ListSection
          title="Set up before use"
          items={entry.needs}
          testId="list-needs"
          empty="Nothing. It works once installed."
        />
      </div>

      {admin && (
        <section className="flex flex-wrap gap-2 border-t border-border pt-6">
          <Button
            variant="outline"
            data-testid="edit-app"
            nativeButton={false}
            render={
              <Link to="/library/$slug/edit" params={{ slug: entry.slug }} />
            }
          >
            <Pencil data-icon="inline-start" />
            Edit
          </Button>
          <Button
            variant="outline"
            data-testid="toggle-publish"
            pending={pending && !confirming}
            onClick={() => void togglePublished()}
          >
            {entry.published ? "Unpublish" : "Publish"}
          </Button>
          <Button
            variant="destructive"
            data-testid="delete-app"
            onClick={() => setConfirming(true)}
          >
            Delete
          </Button>
        </section>
      )}

      {confirming && (
        <ConfirmDialog
          title={`Delete ${entry.name}?`}
          confirmLabel="Delete"
          destructive
          pending={pending}
          onConfirm={() => void remove()}
          onClose={() => setConfirming(false)}
        >
          The entry is removed for good.
        </ConfirmDialog>
      )}
    </Page>
  );
}

function OutLink({
  href,
  testId,
  primary = false,
  children,
}: {
  href: string;
  testId: string;
  primary?: boolean;
  children: string;
}) {
  const safe = httpUrl(href);
  if (!safe) return null;
  return (
    <Button
      variant={primary ? "default" : "outline"}
      data-testid={testId}
      nativeButton={false}
      render={<a href={safe} target="_blank" rel="noopener noreferrer" />}
    >
      {children}
      <ExternalLink data-icon="inline-end" />
    </Button>
  );
}

function ListSection({
  title,
  items,
  testId,
  empty = "None listed.",
}: {
  title: string;
  items: string[];
  testId: string;
  empty?: string;
}) {
  return (
    <section className="space-y-2" data-testid={testId}>
      <h2 className="text-base font-semibold tracking-tight">{title}</h2>
      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground">{empty}</p>
      ) : (
        <ul className="list-disc space-y-1 pl-5 text-sm">
          {items.map((item, index) => (
            <li key={index}>{item}</li>
          ))}
        </ul>
      )}
    </section>
  );
}
