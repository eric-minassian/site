import { useState } from "react";
import { Navigate, useNavigate } from "react-router";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useAuth } from "@/contexts/auth-context";
import { getSite, ApiError } from "@/lib/api";
import { passphraseToToken } from "@/lib/crypto";

export default function LoginPage() {
  const navigate = useNavigate();
  const { login, isAuthenticated } = useAuth();

  const [passphrase, setPassphrase] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  if (isAuthenticated) {
    return <Navigate to="/dashboard" replace />;
  }

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setErrorMsg("");
    setLoading(true);

    try {
      const token = await passphraseToToken(passphrase);
      const site = await getSite(token);
      login(token, site.username);
      navigate("/dashboard", { replace: true });
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        setErrorMsg("Invalid passphrase. Please check your words and try again.");
      } else {
        setErrorMsg(err instanceof ApiError ? err.message : "Something went wrong");
      }
    } finally {
      setLoading(false);
    }
  }

  const wordCount = passphrase.trim().split(/\s+/).filter(Boolean).length;

  return (
    <div className="flex flex-1 flex-col items-center justify-center p-8">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Log in</CardTitle>
          <CardDescription>
            Enter your 12-word passphrase to access your site.
          </CardDescription>
        </CardHeader>
        <form onSubmit={handleLogin}>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <textarea
                className="border-input bg-background ring-offset-background placeholder:text-muted-foreground focus-visible:ring-ring flex min-h-[100px] w-full rounded-md border px-3 py-2 text-sm focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50"
                placeholder="Enter your 12-word passphrase…"
                value={passphrase}
                onChange={(e) => {
                  setPassphrase(e.target.value);
                  setErrorMsg("");
                }}
                autoFocus
                autoComplete="off"
                spellCheck={false}
              />
              <p className="text-xs text-muted-foreground">
                {wordCount}/12 words
              </p>
            </div>
            {errorMsg && (
              <p className="text-sm text-destructive">{errorMsg}</p>
            )}
          </CardContent>
          <CardFooter>
            <Button type="submit" className="w-full" disabled={loading || wordCount !== 12}>
              {loading ? "Verifying…" : "Log in"}
            </Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}
