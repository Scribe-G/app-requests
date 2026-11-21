import { useNavigate } from "@tanstack/react-router";
import { useState, type ReactNode } from "react";
import { toast } from "sonner";
import { Alert, AlertDescription } from "@/client/components/ui/alert";
import { Button } from "@/client/components/ui/button";
import { Card, CardContent } from "@/client/components/ui/card";
import {
  Field,
  FieldDescription,
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
import { Textarea } from "@/client/components/ui/textarea";
import { messageOf } from "@/client/lib/errors";
import { slugify } from "@/shared/urls";
import { createApp, updateApp } from "@/serverFunctions/library";

interface Entry {
  id: string;
  slug: string;
  name: string;
  purpose: string;
  inspiredBy: string;
  categories: string[];
  description: string;
  does: string[];
  handled: string[];
  leavesOut: string[];
  needs: string[];
  installUrl: string;
  repoUrl: string;
  requestId: string | null;
}

const NO_REQUEST = "none";

const lines = (text: string) =>
  text
    .split("\n")
    .map((item) => item.trim())
    .filter(Boolean);

/** Adds or edits a library entry. Admins only reach it. */
export function AppForm({
  entry,
  requests,
}: {
  entry: Entry | null;
  requests: { id: string; host: string }[];
}) {
  const navigate = useNavigate();
  const [values, setValues] = useState({
    name: entry?.name ?? "",
    slug: entry?.slug ?? "",
    purpose: entry?.purpose ?? "",
    inspiredBy: entry?.inspiredBy ?? "",
    categories: entry?.categories.join(", ") ?? "",
    description: entry?.description ?? "",
    does: entry?.does.join("\n") ?? "",
    handled: entry?.handled.join("\n") ?? "",
    leavesOut: entry?.leavesOut.join("\n") ?? "",
    needs: entry?.needs.join("\n") ?? "",
    installUrl: entry?.installUrl ?? "",
    repoUrl: entry?.repoUrl ?? "",
    requestId: entry?.requestId ?? NO_REQUEST,
  });
  const [slugEdited, setSlugEdited] = useState(Boolean(entry));
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  type Key = keyof typeof values;
  const set = (key: Key) => (value: string) =>
    setValues((prev) => ({
      ...prev,
      [key]: value,
      ...(key === "name" && !slugEdited ? { slug: slugify(value) } : {}),
    }));

  const requestItems = [
    { value: NO_REQUEST, label: "None" },
    ...requests.map((request) => ({ value: request.id, label: request.host })),
  ];

  async function save() {
    setError(null);
    setPending(true);
    const app = {
      name: values.name,
      slug: values.slug,
      purpose: values.purpose,
      inspiredBy: values.inspiredBy,
      categories: values.categories
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean),
      description: values.description,
      does: lines(values.does),
      handled: lines(values.handled),
      leavesOut: lines(values.leavesOut),
      needs: lines(values.needs),
      installUrl: values.installUrl,
      repoUrl: values.repoUrl,
      requestId: values.requestId === NO_REQUEST ? null : values.requestId,
    };
    try {
      const { slug } = entry
        ? await updateApp({ data: { id: entry.id, app } })
        : await createApp({ data: app });
      toast.success(entry ? "Saved." : `Published ${app.name}.`);
      await navigate({ to: "/library/$slug", params: { slug } });
    } catch (cause) {
      setError(messageOf(cause));
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
            void save();
          }}
        >
          <FieldGroup>
            <div className="grid gap-6 sm:grid-cols-2">
              <TextField label="Name" id="f-name" value={values.name} onChange={set("name")} />
              <TextField
                label="Slug"
                id="f-slug"
                value={values.slug}
                onChange={(value) => {
                  setSlugEdited(true);
                  set("slug")(value);
                }}
              />
            </div>
            <TextField label="Purpose" id="f-purpose" value={values.purpose} onChange={set("purpose")} />
            <div className="grid gap-6 sm:grid-cols-2">
              <TextField
                label="Inspired by"
                id="f-inspired"
                placeholder="https://example.com"
                value={values.inspiredBy}
                onChange={set("inspiredBy")}
              />
              <TextField
                label="Categories"
                id="f-categories"
                placeholder="Forms, Surveys"
                value={values.categories}
                onChange={set("categories")}
                hint="Separated by commas"
              />
            </div>
            <AreaField label="Description" id="f-description" rows={4} value={values.description} onChange={set("description")} />
            <div className="grid gap-6 sm:grid-cols-2">
              <AreaField label="What it does" id="f-does" value={values.does} onChange={set("does")} hint="One per line" />
              <AreaField label="Handled by the platform" id="f-handled" value={values.handled} onChange={set("handled")} hint="One per line" />
              <AreaField label="Left out" id="f-leaves" value={values.leavesOut} onChange={set("leavesOut")} hint="One per line" />
              <AreaField label="Set up before use" id="f-needs" value={values.needs} onChange={set("needs")} hint="One per line; blank if nothing" />
            </div>
            <div className="grid gap-6 sm:grid-cols-2">
              <TextField label="Install link" id="f-install" placeholder="https://" value={values.installUrl} onChange={set("installUrl")} />
              <TextField label="Source code link" id="f-repo" placeholder="https://" value={values.repoUrl} onChange={set("repoUrl")} />
            </div>
            <Field>
              <FieldLabel>Request</FieldLabel>
              <Select
                items={requestItems}
                value={values.requestId}
                onValueChange={(value) => {
                  if (value) set("requestId")(value);
                }}
              >
                <SelectTrigger data-testid="f-request" className="w-full sm:w-80">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {requestItems.map((item) => (
                    <SelectItem key={item.value} value={item.value}>
                      {item.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FieldDescription>The request is marked done.</FieldDescription>
            </Field>
            {error && (
              <Alert variant="destructive" data-testid="form-error">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
            <div>
              <Button type="submit" data-testid="f-save" pending={pending}>
                {entry ? "Save" : "Publish"}
              </Button>
            </div>
          </FieldGroup>
        </form>
      </CardContent>
    </Card>
  );
}

function TextField({
  label,
  id,
  value,
  onChange,
  placeholder,
  hint,
}: {
  label: string;
  id: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  hint?: ReactNode;
}) {
  return (
    <Field>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <Input
        id={id}
        data-testid={id}
        value={value}
        placeholder={placeholder}
        autoComplete="off"
        onChange={(event) => onChange(event.target.value)}
      />
      {hint ? <FieldDescription>{hint}</FieldDescription> : null}
    </Field>
  );
}

function AreaField({
  label,
  id,
  value,
  onChange,
  rows = 4,
  hint,
}: {
  label: string;
  id: string;
  value: string;
  onChange: (value: string) => void;
  rows?: number;
  hint?: string;
}) {
  return (
    <Field>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <Textarea
        id={id}
        data-testid={id}
        rows={rows}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
      {hint ? <FieldDescription>{hint}</FieldDescription> : null}
    </Field>
  );
}
