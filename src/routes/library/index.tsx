import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { LayoutGrid, Plus, Search } from "lucide-react";
import { useEffect, useState } from "react";
import { z } from "zod";
import { EmptyState } from "@/client/components/EmptyState";
import { Page } from "@/client/components/Page";
import { PageHeader } from "@/client/components/PageHeader";
import { Badge } from "@/client/components/ui/badge";
import { Button } from "@/client/components/ui/button";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/client/components/ui/card";
import { Input } from "@/client/components/ui/input";
import { getLibrary } from "@/serverFunctions/library";

const searchSchema = z.object({
  q: z.string().optional().catch(undefined),
  category: z.string().optional().catch(undefined),
});

export const Route = createFileRoute("/library/")({
  validateSearch: searchSchema,
  loaderDeps: ({ search }) => search,
  loader: ({ deps }) =>
    getLibrary({
      data: {
        q: deps.q?.slice(0, 200) || undefined,
        category: deps.category?.slice(0, 40) || undefined,
      },
    }),
  head: () => ({ meta: [{ title: "Library · App Requests" }] }),
  component: LibraryPage,
});

function LibraryPage() {
  const { apps, categories, total, admin } = Route.useLoaderData();
  const { q = "", category } = Route.useSearch();
  const navigate = useNavigate({ from: "/library/" });
  const [text, setText] = useState(q);

  useEffect(() => setText(q), [q]);
  useEffect(() => {
    if (text === q) return;
    const timer = setTimeout(() => {
      void navigate({
        search: (prev) => ({ ...prev, q: text || undefined }),
        replace: true,
      });
    }, 150);
    return () => clearTimeout(timer);
  }, [text, q, navigate]);

  function pick(next: string | undefined) {
    void navigate({ search: (prev) => ({ ...prev, category: next }) });
  }

  return (
    <Page>
      <PageHeader
        title="Library"
        actions={
          admin ? (
            <Button
              data-testid="add-app"
              nativeButton={false}
              render={<Link to="/library/new" />}
            >
              <Plus data-icon="inline-start" />
              Add app
            </Button>
          ) : null
        }
      />
      {total === 0 ? (
        <EmptyState
          icon={LayoutGrid}
          title="The library is empty"
          description={
            admin
              ? "Add a finished app and members will see it here."
              : "Finished apps will show up here."
          }
        />
      ) : (
        <div className="space-y-6">
          <div className="space-y-3">
            <div className="relative">
              <Search
                aria-hidden
                className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
              />
              <Input
                type="search"
                data-testid="library-search"
                aria-label="Search the library"
                placeholder="Search by name, purpose or address"
                className="pl-9"
                value={text}
                onChange={(event) => setText(event.target.value)}
              />
            </div>
            <div
              className="flex flex-wrap gap-2"
              role="group"
              aria-label="Category"
            >
              <Button
                size="sm"
                variant={category ? "outline" : "secondary"}
                aria-pressed={!category}
                onClick={() => pick(undefined)}
              >
                All
              </Button>
              {categories.map((item) => (
                <Button
                  key={item.name}
                  size="sm"
                  variant={category === item.name ? "secondary" : "outline"}
                  aria-pressed={category === item.name}
                  data-testid="category-filter"
                  data-category={item.name}
                  onClick={() =>
                    pick(category === item.name ? undefined : item.name)
                  }
                >
                  {item.name}
                  <span
                    data-testid="category-count"
                    className="text-muted-foreground tabular-nums"
                  >
                    {item.count}
                  </span>
                </Button>
              ))}
            </div>
          </div>
          {apps.length === 0 ? (
            <div data-testid="library-empty">
              <EmptyState
                kind="filtered"
                title="No apps match"
                action={
                  <Button
                    variant="outline"
                    onClick={() =>
                      void navigate({ search: {} }).then(() => setText(""))
                    }
                  >
                    Clear search and filter
                  </Button>
                }
              />
            </div>
          ) : (
            <ul className="grid gap-4 sm:grid-cols-2">
              {apps.map((app) => (
                <li key={app.id}>
                  <Link
                    to="/library/$slug"
                    params={{ slug: app.slug }}
                    data-testid="app-card"
                    data-slug={app.slug}
                    className="block h-full rounded-xl outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
                  >
                    <Card className="h-full transition-colors hover:bg-muted/40">
                      <CardHeader>
                        <CardTitle className="flex flex-wrap items-center gap-2">
                          {app.name}
                          {!app.published && (
                            <Badge variant="warning">Unpublished</Badge>
                          )}
                        </CardTitle>
                        <CardDescription>{app.purpose}</CardDescription>
                      </CardHeader>
                      <div className="flex flex-wrap items-center gap-2 px-(--card-spacing) text-xs text-muted-foreground">
                        <span>From {app.inspiredBy}</span>
                        {app.categories.map((name) => (
                          <Badge key={name} variant="outline">
                            {name}
                          </Badge>
                        ))}
                      </div>
                    </Card>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </Page>
  );
}
