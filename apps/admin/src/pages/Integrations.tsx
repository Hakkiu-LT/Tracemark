import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { adminFetch } from "@/lib/api";
import { Can } from "@/components/Can";
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Input,
  Label,
} from "@/components/ui";

export function Integrations() {
  const [metaToken, setMetaToken] = useState("");

  const exchangeMeta = useMutation({
    mutationFn: () =>
      adminFetch<{ expires_at?: string; access_token?: string }>("/integrations/meta/exchange-token", {
        method: "POST",
        body: JSON.stringify({ short_lived_token: metaToken.trim() }),
      }),
    onSuccess: (res) => {
      toast.success(res.expires_at ? `Token stored. Expires ${new Date(res.expires_at).toLocaleDateString()}` : "Token exchanged");
      setMetaToken("");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="mx-auto w-full max-w-3xl space-y-6 p-6 md:p-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Integrations</h1>
        <p className="text-sm text-muted-foreground">Third-party connections and token management.</p>
      </div>

      <Can
        permission="integrations.manage"
        fallback={
          <Card>
            <CardContent className="py-8 text-center">
              <p className="text-sm text-muted-foreground">You need the <Badge variant="secondary">integrations.manage</Badge> permission to manage integrations.</p>
            </CardContent>
          </Card>
        }
      >
        <Card>
          <CardHeader>
            <CardTitle>Meta (Facebook) token</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Paste a short-lived Meta user access token to exchange it for a long-lived token. The token is stored in the main API and used for Meta Ad Library monitoring.
            </p>
            <div className="space-y-1.5">
              <Label>Short-lived user token</Label>
              <Input
                value={metaToken}
                onChange={(e) => setMetaToken(e.target.value)}
                placeholder="EAA…"
                className="font-mono text-xs"
              />
            </div>
            <Button
              onClick={() => exchangeMeta.mutate()}
              disabled={exchangeMeta.isPending || !metaToken.trim()}
            >
              {exchangeMeta.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              Exchange token
            </Button>
          </CardContent>
        </Card>
      </Can>
    </div>
  );
}
