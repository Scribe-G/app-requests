import { Link } from "@tanstack/react-router";
import { SearchX } from "lucide-react";
import { EmptyState } from "@/client/components/EmptyState";
import { Page } from "@/client/components/Page";
import { Button } from "@/client/components/ui/button";

/** An address with nothing behind it, or an entry this person can't see. */
export function NotFound() {
  return (
    <Page>
      <EmptyState
        icon={SearchX}
        title="Nothing here"
        action={
          <Button nativeButton={false} render={<Link to="/library" />}>
            Go to the library
          </Button>
        }
      />
    </Page>
  );
}
