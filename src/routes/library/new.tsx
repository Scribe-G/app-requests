import { createFileRoute, notFound } from "@tanstack/react-router";
import { AppForm } from "@/client/components/AppForm";
import { NotFound } from "@/client/components/NotFound";
import { Page } from "@/client/components/Page";
import { PageHeader } from "@/client/components/PageHeader";
import { getAppForm } from "@/serverFunctions/library";

export const Route = createFileRoute("/library/new")({
  loader: async () => {
    const form = await getAppForm({ data: {} });
    if (!form) throw notFound();
    return form;
  },
  head: () => ({ meta: [{ title: "Add app · App Requests" }] }),
  notFoundComponent: NotFound,
  component: NewEntry,
});

function NewEntry() {
  const { requests } = Route.useLoaderData();
  return (
    <Page>
      <PageHeader title="Add app" />
      <AppForm entry={null} requests={requests} />
    </Page>
  );
}
