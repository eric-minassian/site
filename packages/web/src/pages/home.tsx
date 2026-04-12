import { Link } from "react-router";
import { Button } from "@/components/ui/button";

export default function HomePage() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-6 p-8">
      <h1 className="text-4xl font-bold tracking-tight">Site</h1>
      <p className="max-w-md text-center text-muted-foreground">
        Create your free personal site in seconds. No email, no password — just
        a 12-word passphrase.
      </p>
      <div className="flex gap-3">
        <Button asChild>
          <Link to="/create">Create a site</Link>
        </Button>
        <Button variant="outline" asChild>
          <Link to="/login">Log in</Link>
        </Button>
      </div>
    </div>
  );
}
