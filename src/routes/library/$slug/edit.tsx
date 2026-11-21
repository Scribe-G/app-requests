import { createFileRoute, notFound } from "@tanstack/react-router";
import { AppForm } from "@/client/components/AppForm";
import { NotFound } from "@/client/components/NotFound";
import { Page } from "@/client/components/Page";
import { PageHeader } from "@/client/components/PageHeader";
import { getAppForm } from "@/serverFunctions/library";

export const Route = createFileRoute("/library/$slug/edit")({
  loader: async ({ params }) => {
    const form = await getAppForm({ data: { slug: params.slug } });
    if (!form?.entry) throw notFound();
    return { ...form, entry: form.entry };
  },
  head: ({ loaderData }) => ({
    meta: loaderData
      ? [{ title: `Edit ${loaderData.entry.name} · App Requests` }]
      : [],
  }),
  notFoundComponent: NotFound,
  component: EditEntry,
});

function EditEntry() {
  const { entry, requests } = Route.useLoaderData();
  return (
    <Page>
      <PageHeader title={`Edit ${entry.name}`} />
      <AppForm key={entry.id} entry={entry} requests={requests} />
    </Page>
  );
}
