import { useCallback, useEffect, useRef, useState } from "react";
import { Link, Navigate } from "react-router";
import {
  AlertTriangle,
  Check,
  Copy,
  ExternalLink,
  Globe,
  Loader2,
  Pencil,
  RefreshCw,
  Rocket,
  Trash2,
} from "lucide-react";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/contexts/auth-context";
import {
  addCustomDomain,
  ApiError,
  getCustomDomainStatus,
  getSite,
  publishSite,
  regeneratePassphrase,
  removeCustomDomain,
  type DomainStatus,
} from "@/lib/api";
import { passphraseToToken } from "@/lib/crypto";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type SiteData = Awaited<ReturnType<typeof getSite>>;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const SITES_DOMAIN = import.meta.env.VITE_SITES_DOMAIN as string | undefined;

function siteUrl(username: string, customDomain: string | null) {
  if (customDomain) return `https://${customDomain}`;
  if (SITES_DOMAIN) return `https://${username}.${SITES_DOMAIN}`;
  return null;
}

function formatDate(iso: string | null) {
  if (!iso) return "Never";
  return new Date(iso).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function buildStatusColor(status: string) {
  switch (status) {
    case "success":
      return "bg-green-500";
    case "queued":
    case "building":
      return "bg-yellow-500 animate-pulse";
    case "failed":
      return "bg-red-500";
    default:
      return "bg-muted-foreground";
  }
}

function buildStatusLabel(status: string) {
  switch (status) {
    case "success":
      return "Live";
    case "queued":
      return "Queued";
    case "building":
      return "Building";
    case "failed":
      return "Build failed";
    default:
      return "Draft";
  }
}

// ---------------------------------------------------------------------------
// Copy button (shared with custom domain section)
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
// Site Overview Section
// ---------------------------------------------------------------------------

function SiteOverviewSection({
  site,
  token,
  onSiteUpdate,
}: {
  site: SiteData;
  token: string;
  onSiteUpdate: (site: SiteData) => void;
}) {
  const [publishing, setPublishing] = useState(false);
  const url = siteUrl(site.username, site.customDomain);

  async function handlePublish() {
    setPublishing(true);
    try {
      await publishSite(token);
      onSiteUpdate({ ...site, buildStatus: "queued" });
      toast.success("Build queued");
    } catch (err) {
      toast.error(
        err instanceof ApiError ? err.message : "Failed to publish",
      );
    } finally {
      setPublishing(false);
    }
  }

  const isBuilding = site.buildStatus === "queued" || site.buildStatus === "building";

  return (
    <Card>
      <CardHeader>
        <CardTitle>Site Overview</CardTitle>
        <CardDescription>
          Status and quick actions for your site.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Status row */}
        <div className="flex items-center justify-between rounded-md border p-3">
          <div className="flex items-center gap-3">
            <span
              className={`inline-block size-2 rounded-full ${buildStatusColor(site.buildStatus)}`}
            />
            <div>
              <p className="text-sm font-medium">
                {buildStatusLabel(site.buildStatus)}
              </p>
              <p className="text-xs text-muted-foreground">
                Last built: {formatDate(site.lastBuildAt)}
              </p>
            </div>
          </div>
          {url && (
            <a
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
            >
              {site.customDomain ?? `${site.username}.${SITES_DOMAIN ?? "site"}`}
              <ExternalLink className="size-3.5" />
            </a>
          )}
        </div>

        {/* Template info */}
        {site.templateId && (
          <div className="text-sm text-muted-foreground">
            Template: <span className="font-medium text-foreground">{site.templateId}</span>
          </div>
        )}
      </CardContent>
      <CardFooter className="flex flex-wrap gap-2">
        <Button asChild variant="outline" size="sm">
          <Link to="/builder">
            <Pencil className="mr-2 size-4" />
            Edit content
          </Link>
        </Button>
        <Button asChild variant="outline" size="sm">
          <Link to="/marketplace">
            Change template
          </Link>
        </Button>
        <Button
          size="sm"
          onClick={handlePublish}
          disabled={publishing || isBuilding || !site.markdown}
        >
          {publishing || isBuilding ? (
            <>
              <Loader2 className="mr-2 size-4 animate-spin" />
              {isBuilding ? "Building…" : "Publishing…"}
            </>
          ) : (
            <>
              <Rocket className="mr-2 size-4" />
              Publish
            </>
          )}
        </Button>
      </CardFooter>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Passphrase Regeneration Section
// ---------------------------------------------------------------------------

function PassphraseSection({ token }: { token: string }) {
  const { login, username } = useAuth();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [newPassphrase, setNewPassphrase] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  async function handleRegenerate() {
    setLoading(true);
    try {
      const result = await regeneratePassphrase(token);
      setNewPassphrase(result.passphrase);
      // Update auth with new token
      const newToken = await passphraseToToken(result.passphrase);
      if (username) login(newToken, username);
      toast.success("Passphrase regenerated");
    } catch (err) {
      toast.error(
        err instanceof ApiError ? err.message : "Failed to regenerate passphrase",
      );
      setOpen(false);
    } finally {
      setLoading(false);
    }
  }

  async function handleCopy() {
    if (!newPassphrase) return;
    await navigator.clipboard.writeText(newPassphrase);
    setCopied(true);
    toast.success("Copied to clipboard");
    setTimeout(() => setCopied(false), 2000);
  }

  function handleClose() {
    setOpen(false);
    setNewPassphrase(null);
    setCopied(false);
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <RefreshCw className="size-5" />
            Passphrase
          </CardTitle>
          <CardDescription>
            Regenerate your 12-word passphrase. Your current passphrase will stop
            working immediately.
          </CardDescription>
        </CardHeader>
        <CardFooter>
          <Button variant="outline" onClick={() => setOpen(true)}>
            Regenerate passphrase
          </Button>
        </CardFooter>
      </Card>

      <Dialog open={open} onOpenChange={(v) => !v && handleClose()}>
        <DialogContent>
          {!newPassphrase ? (
            <>
              <DialogHeader>
                <DialogTitle>Regenerate passphrase?</DialogTitle>
                <DialogDescription>
                  This will invalidate your current passphrase. Make sure to save
                  the new one — it cannot be recovered.
                </DialogDescription>
              </DialogHeader>
              <div className="flex items-start gap-3 rounded-md border border-amber-500/50 bg-amber-500/10 p-3 text-sm text-amber-700 dark:text-amber-400">
                <AlertTriangle className="mt-0.5 size-4 shrink-0" />
                <p>This action cannot be undone.</p>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={handleClose}>
                  Cancel
                </Button>
                <Button
                  variant="destructive"
                  onClick={handleRegenerate}
                  disabled={loading}
                >
                  {loading ? (
                    <>
                      <Loader2 className="mr-2 size-4 animate-spin" />
                      Regenerating…
                    </>
                  ) : (
                    "Regenerate"
                  )}
                </Button>
              </DialogFooter>
            </>
          ) : (
            <>
              <DialogHeader>
                <DialogTitle>Save your new passphrase</DialogTitle>
                <DialogDescription>
                  Write this down somewhere safe. It will never be shown again.
                </DialogDescription>
              </DialogHeader>
              <div className="flex items-start gap-3 rounded-md border border-amber-500/50 bg-amber-500/10 p-3 text-sm text-amber-700 dark:text-amber-400">
                <AlertTriangle className="mt-0.5 size-4 shrink-0" />
                <p>
                  This passphrase will <strong>never be shown again</strong>.
                </p>
              </div>
              <div className="relative rounded-md bg-muted p-4">
                <p className="pr-10 font-mono text-sm leading-relaxed select-all">
                  {newPassphrase}
                </p>
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute top-2 right-2"
                  onClick={handleCopy}
                >
                  {copied ? (
                    <Check className="size-4" />
                  ) : (
                    <Copy className="size-4" />
                  )}
                </Button>
              </div>
              <DialogFooter>
                <Button onClick={handleClose}>
                  I've saved my passphrase
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

// ---------------------------------------------------------------------------
// Status helpers (custom domain)
// ---------------------------------------------------------------------------

function StatusDot({ status }: { status: DomainStatus["status"] }) {
  if (status === "active")
    return <span className="inline-block size-2 rounded-full bg-green-500" />;
  if (status === "pending_validation")
    return (
      <span className="inline-block size-2 rounded-full bg-yellow-500 animate-pulse" />
    );
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
  const pollRef = useRef<ReturnType<typeof setInterval>>(undefined);

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
            <Button type="submit" disabled={loading || !domain.trim()}>
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

const BUILD_POLL_INTERVAL = 5_000;

export default function DashboardPage() {
  const { token, username, isAuthenticated } = useAuth();
  const [site, setSite] = useState<SiteData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval>>(undefined);

  const fetchSite = useCallback(async () => {
    if (!token) return null;
    try {
      const data = await getSite(token);
      setSite(data);
      return data;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load site");
      return null;
    }
  }, [token]);

  // Initial load
  useEffect(() => {
    fetchSite().finally(() => setLoading(false));
  }, [fetchSite]);

  // Poll while building
  useEffect(() => {
    const isBuilding =
      site?.buildStatus === "queued" || site?.buildStatus === "building";

    if (isBuilding) {
      pollRef.current = setInterval(async () => {
        const updated = await fetchSite();
        if (
          updated &&
          updated.buildStatus !== "queued" &&
          updated.buildStatus !== "building"
        ) {
          clearInterval(pollRef.current);
          if (updated.buildStatus === "success") {
            toast.success("Site published successfully!");
          } else if (updated.buildStatus === "failed") {
            toast.error("Build failed. Please try again.");
          }
        }
      }, BUILD_POLL_INTERVAL);
    }

    return () => clearInterval(pollRef.current);
  }, [site?.buildStatus, fetchSite]);

  if (!isAuthenticated || !token) {
    return <Navigate to="/login" replace />;
  }

  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error || !site) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-2">
        <p className="text-sm text-destructive">{error ?? "Site not found"}</p>
      </div>
    );
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
        <SiteOverviewSection
          site={site}
          token={token}
          onSiteUpdate={setSite}
        />
        <CustomDomainSection token={token} />
        <PassphraseSection token={token} />
      </div>
    </div>
  );
}
