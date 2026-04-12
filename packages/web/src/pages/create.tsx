import { useState } from "react";
import { Navigate, useNavigate } from "react-router";
import { Copy, Check, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/contexts/auth-context";
import { createSite, ApiError } from "@/lib/api";
import { passphraseToToken } from "@/lib/crypto";

type Step = "username" | "passphrase";

export default function CreatePage() {
  const navigate = useNavigate();
  const { login, isAuthenticated } = useAuth();

  const [step, setStep] = useState<Step>("username");
  const [username, setUsername] = useState("");
  const [passphrase, setPassphrase] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [copied, setCopied] = useState(false);

  if (isAuthenticated && step === "username") {
    return <Navigate to="/dashboard" replace />;
  }

  async function handleCreateSite(e: React.FormEvent) {
    e.preventDefault();
    setErrorMsg("");
    setLoading(true);

    try {
      const result = await createSite(username.toLowerCase().trim());
      setPassphrase(result.passphrase);
      setStep("passphrase");
    } catch (err) {
      setErrorMsg(err instanceof ApiError ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  async function handleCopy() {
    await navigator.clipboard.writeText(passphrase);
    setCopied(true);
    toast.success("Passphrase copied to clipboard");
    setTimeout(() => setCopied(false), 2000);
  }

  async function handleContinue() {
    const token = await passphraseToToken(passphrase);
    login(token, username.toLowerCase().trim());
    navigate("/dashboard", { replace: true });
  }

  if (step === "passphrase") {
    return (
      <div className="flex flex-1 flex-col items-center justify-center p-8">
        <Card className="w-full max-w-lg">
          <CardHeader>
            <CardTitle>Save your passphrase</CardTitle>
            <CardDescription>
              This is your only way to access your site. Write it down somewhere safe.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-start gap-3 rounded-md border border-amber-500/50 bg-amber-500/10 p-3 text-sm text-amber-700 dark:text-amber-400">
              <AlertTriangle className="mt-0.5 size-4 shrink-0" />
              <p>
                This passphrase will <strong>never be shown again</strong>. If you lose it, you will lose access to your site permanently.
              </p>
            </div>
            <div className="relative rounded-md bg-muted p-4">
              <p className="pr-10 font-mono text-sm leading-relaxed select-all">
                {passphrase}
              </p>
              <Button
                variant="ghost"
                size="icon"
                className="absolute top-2 right-2"
                onClick={handleCopy}
              >
                {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
              </Button>
            </div>
          </CardContent>
          <CardFooter>
            <Button className="w-full" onClick={handleContinue}>
              I've saved my passphrase — continue
            </Button>
          </CardFooter>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col items-center justify-center p-8">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Create your site</CardTitle>
          <CardDescription>Pick a username to get started.</CardDescription>
        </CardHeader>
        <form onSubmit={handleCreateSite}>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Input
                placeholder="username"
                value={username}
                onChange={(e) => {
                  setUsername(e.target.value);
                  setErrorMsg("");
                }}
                autoFocus
                autoComplete="off"
                pattern="[a-z][a-z0-9-]*[a-z0-9]"
                minLength={3}
                maxLength={39}
              />
              <p className="text-xs text-muted-foreground">
                3-39 characters. Lowercase letters, numbers, and hyphens.
              </p>
            </div>
            {errorMsg && (
              <p className="text-sm text-destructive">{errorMsg}</p>
            )}
          </CardContent>
          <CardFooter>
            <Button type="submit" className="w-full" disabled={loading || username.length < 3}>
              {loading ? "Creating…" : "Create site"}
            </Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}
