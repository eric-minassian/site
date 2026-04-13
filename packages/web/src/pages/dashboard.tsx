import { useCallback, useEffect, useRef, useState } from "react";
import { Navigate } from "react-router";
import { Copy, Check, Globe, Loader2, Trash2, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/contexts/auth-context";
import {
  addCustomDomain,
  getCustomDomainStatus,
  removeCustomDomain,
  getSite,
  ApiError,
  type DomainStatus,
} from "@/lib/api";

// ---------------------------------------------------------------------------
// Status helpers
// ---------------------------------------------------------------------------

function StatusDot({ status }: { status: DomainStatus["status"] }) {
  if (status === "active")
    return <span className="inline-block size-2 rounded-full bg-green-500" />;
  if (status === "pending_validation")
    return <span className="inline-block size-2 rounded-full bg-yellow-500 animate-pulse" />;
  if (status === "failed")
    return <span className="inline-block size-2 rounded-full bg-red-500" />;
  return null;
}

function statusLabel(status: DomainStatus["status"]) {
  switch (status) {
    case "active":
      return "Active";
    case "pending_validation":
      return "Pending validation";
    case "failed":
      return "Failed";
    default:
      return "";
  }
}

// ---------------------------------------------------------------------------
// Copy-to-clipboard button
// ---------------------------------------------------------------------------

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    toast.success("Copied to clipboard");
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <Button variant="ghost" size="icon" className="size-7" onClick={handleCopy}>
      {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
    </Button>
  );
}

// ---------------------------------------------------------------------------
// Custom Domain Section
// ---------------------------------------------------------------------------

function CustomDomainSection({ token }: { token: string }) {
  const [domain, setDomain] = useState("");
  const [domainStatus, setDomainStatus] = useState<DomainStatus>({
    domain: null,
    status: null,
    validationRecords: null,
  });
  const [loading, setLoading] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [initialLoading, setInitialLoading] = useState(true);
  const pollRef = useRef<ReturnType<typeof setInterval>>();

  // Fetch current domain status
  const fetchStatus = useCallback(async () => {
    try {
      const status = await getCustomDomainStatus(token);
      setDomainStatus(status);
      return status;
    } catch {
      // Silently ignore polling errors
      return null;
    }
  }, [token]);

  // Initial load
  useEffect(() => {
    fetchStatus().finally(() => setInitialLoading(false));
  }, [fetchStatus]);

  // Poll while pending
  useEffect(() => {
    if (domainStatus.status === "pending_validation") {
      pollRef.current = setInterval(async () => {
        const result = await fetchStatus();
        if (result && result.status !== "pending_validation") {
          clearInterval(pollRef.current);
          if (result.status === "active") {
            toast.success("Custom domain is now active!");
          }
        }
      }, 15_000);
    }
    return () => clearInterval(pollRef.current);
  }, [domainStatus.status, fetchStatus]);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    setErrorMsg("");
    setLoading(true);
    try {
      const result = await addCustomDomain(token, domain.trim().toLowerCase());
      setDomainStatus(result);
      setDomain("");
      toast.success("Custom domain added. Configure DNS records below.");
    } catch (err) {
      setErrorMsg(
        err instanceof ApiError ? err.message : "Failed to add domain",
      );
    } finally {
      setLoading(false);
    }
  }

  async function handleRemove() {
    setRemoving(true);
    try {
      await removeCustomDomain(token);
      setDomainStatus({ domain: null, status: null, validationRecords: null });
      toast.success("Custom domain removed");
    } catch (err) {
      toast.error(
        err instanceof ApiError ? err.message : "Failed to remove domain",
      );
    } finally {
      setRemoving(false);
    }
  }

  if (initialLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Globe className="size-5" />
            Custom Domain
          </CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="size-5 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  // No domain configured — show add form
  if (!domainStatus.domain) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Globe className="size-5" />
            Custom Domain
          </CardTitle>
          <CardDescription>
            Connect your own domain to your site.
          </CardDescription>
        </CardHeader>
        <form onSubmit={handleAdd}>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <label htmlFor="domain-input" className="text-sm font-medium">
                Domain
              </label>
              <Input
                id="domain-input"
                type="text"
                placeholder="example.com"
                value={domain}
                onChange={(e) => {
                  setDomain(e.target.value);
                  setErrorMsg("");
                }}
              />
              <p className="text-xs text-muted-foreground">
                Enter the domain you want to use (e.g., example.com or
                blog.example.com).
              </p>
            </div>
            {errorMsg && (
              <p className="text-sm text-destructive">{errorMsg}</p>
            )}
          </CardContent>
          <CardFooter>
            <Button
              type="submit"
              disabled={loading || !domain.trim()}
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 size-4 animate-spin" />
                  Adding…
                </>
              ) : (
                "Add domain"
              )}
            </Button>
          </CardFooter>
        </form>
      </Card>
    );
  }

  // Domain configured — show status + DNS records
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Globe className="size-5" />
          Custom Domain
        </CardTitle>
        <CardDescription>
          Manage your custom domain settings.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Domain + status */}
        <div className="flex items-center justify-between rounded-md border p-3">
          <div className="flex items-center gap-3">
            <StatusDot status={domainStatus.status} />
            <div>
              <p className="text-sm font-medium">{domainStatus.domain}</p>
              <p className="text-xs text-muted-foreground">
                {statusLabel(domainStatus.status)}
              </p>
            </div>
          </div>
          {domainStatus.status === "active" && (
            <a
              href={`https://${domainStatus.domain}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-muted-foreground hover:text-foreground"
            >
              <ExternalLink className="size-4" />
            </a>
          )}
        </div>

        {/* DNS validation records */}
        {domainStatus.validationRecords &&
          domainStatus.validationRecords.length > 0 && (
            <div className="space-y-3">
              <div>
                <h4 className="text-sm font-medium">DNS Records</h4>
                <p className="text-xs text-muted-foreground">
                  {domainStatus.status === "pending_validation"
                    ? "Add these CNAME records to your DNS provider to verify domain ownership."
                    : "These DNS records are configured for your domain."}
                </p>
              </div>
              <div className="space-y-2">
                {domainStatus.validationRecords.map((record) => (
                  <div
                    key={record.name}
                    className="rounded-md border bg-muted/50 p-3 text-xs"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0 flex-1 space-y-1.5">
                        <div>
                          <span className="font-medium text-muted-foreground">
                            Name:{" "}
                          </span>
                          <code className="break-all">{record.name}</code>
                        </div>
                        <div>
                          <span className="font-medium text-muted-foreground">
                            Value:{" "}
                          </span>
                          <code className="break-all">{record.value}</code>
                        </div>
                        <div>
                          <span className="font-medium text-muted-foreground">
                            Type:{" "}
                          </span>
                          <code>CNAME</code>
                        </div>
                      </div>
                      <div className="flex flex-col gap-1">
                        <CopyButton text={record.name} />
                        <CopyButton text={record.value} />
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {domainStatus.status === "pending_validation" && (
                <p className="text-xs text-muted-foreground">
                  DNS propagation can take up to 48 hours. This page checks
                  automatically every 15 seconds.
                </p>
              )}
            </div>
          )}

        {domainStatus.status === "failed" && (
          <div className="rounded-md border border-red-500/50 bg-red-500/10 p-3 text-sm text-red-700 dark:text-red-400">
            Certificate validation failed. Remove this domain and try again.
          </div>
        )}
      </CardContent>
      <CardFooter>
        <Button
          variant="destructive"
          onClick={handleRemove}
          disabled={removing}
        >
          {removing ? (
            <>
              <Loader2 className="mr-2 size-4 animate-spin" />
              Removing…
            </>
          ) : (
            <>
              <Trash2 className="mr-2 size-4" />
              Remove domain
            </>
          )}
        </Button>
      </CardFooter>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Dashboard Page
// ---------------------------------------------------------------------------

export default function DashboardPage() {
  const { token, username, isAuthenticated } = useAuth();

  if (!isAuthenticated || !token) {
    return <Navigate to="/login" replace />;
  }

  return (
    <div className="flex flex-1 flex-col gap-6 p-8">
      <div>
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <p className="text-muted-foreground">
          Manage your site
          {username ? (
            <>
              {" — "}
              <span className="font-medium text-foreground">{username}</span>
            </>
          ) : (
            "."
          )}
        </p>
      </div>

      <div className="mx-auto w-full max-w-2xl space-y-6">
        <CustomDomainSection token={token} />
      </div>
    </div>
  );
}
