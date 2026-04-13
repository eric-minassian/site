import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router";
import {
  Search,
  Users,
  Download,
  ChevronLeft,
  ChevronRight,
  Plus,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardFooter,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAuth } from "@/contexts/auth-context";
import { getTemplates, type TemplateSummary } from "@/lib/api";

const PAGE_SIZE = 12;

type Filter = "all" | "curated" | "community";
type Sort = "popular" | "newest";

function getTemplateColors(t: TemplateSummary) {
  const find = (names: string[]) =>
    t.variables.find((v) => names.includes(v.name))?.default;
  return {
    bg: find(["backgroundColor", "bg", "background"]) ?? "#f8fafc",
    primary:
      find(["primaryColor", "primary", "accentColor", "accent"]) ?? "#3b82f6",
    text: find(["textColor", "text", "foreground"]) ?? "#1e293b",
  };
}

export default function MarketplacePage() {
  const { isAuthenticated } = useAuth();
  const [templates, setTemplates] = useState<TemplateSummary[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [sort, setSort] = useState<Sort>("popular");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadTemplates = useCallback(
    async (p: number, s: string, f: Filter, so: Sort) => {
      setLoading(true);
      setError(null);
      try {
        const result = await getTemplates({
          search: s || undefined,
          filter: f === "all" ? undefined : f,
          sort: so,
          page: p,
          limit: PAGE_SIZE,
        });
        setTemplates(result.items);
        setTotal(result.total);
        setTotalPages(result.totalPages);
        setPage(result.page);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Failed to load templates",
        );
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  // Debounce search input
  useEffect(() => {
    const timeout = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(timeout);
  }, [search]);

  // Reload on filter/sort/search change
  useEffect(() => {
    loadTemplates(1, debouncedSearch, filter, sort);
  }, [debouncedSearch, filter, sort, loadTemplates]);

  const handlePageChange = (newPage: number) => {
    loadTemplates(newPage, debouncedSearch, filter, sort);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <div className="flex flex-1 flex-col gap-6 py-8">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Theme Marketplace</h1>
          <p className="text-muted-foreground">
            Browse and apply templates for your site.
          </p>
        </div>
        {isAuthenticated && (
          <Button asChild size="sm">
            <Link to="/templates/new">
              <Plus className="mr-1.5 h-4 w-4" />
              Create Template
            </Link>
          </Button>
        )}
      </div>

      {/* Controls */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search templates..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>

        <div className="flex gap-2">
          {(["all", "curated", "community"] as const).map((f) => (
            <Button
              key={f}
              variant={filter === f ? "default" : "outline"}
              size="sm"
              onClick={() => setFilter(f)}
            >
              {f.charAt(0).toUpperCase() + f.slice(1)}
            </Button>
          ))}
        </div>

        <Select value={sort} onValueChange={(v) => setSort(v as Sort)}>
          <SelectTrigger className="w-[140px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="popular">Popular</SelectItem>
            <SelectItem value="newest">Newest</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Results count */}
      {!loading && !error && (
        <p className="text-sm text-muted-foreground">
          {total} {total === 1 ? "template" : "templates"} found
        </p>
      )}

      {/* Error */}
      {error && (
        <div className="rounded-md border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
          {error}
        </div>
      )}

      {/* Loading skeleton */}
      {loading && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Card key={i} className="animate-pulse">
              <div className="aspect-[4/3] rounded-t-lg bg-muted" />
              <CardContent className="space-y-2 p-4">
                <div className="h-4 w-2/3 rounded bg-muted" />
                <div className="h-3 w-full rounded bg-muted" />
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Template grid */}
      {!loading && !error && (
        <>
          {templates.length === 0 ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-2 py-16 text-center">
              <p className="text-lg font-medium">No templates found</p>
              <p className="text-sm text-muted-foreground">
                Try adjusting your search or filters.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {templates.map((t) => (
                <TemplateCard key={t.templateId} template={t} />
              ))}
            </div>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 py-4">
              <Button
                variant="outline"
                size="sm"
                disabled={page <= 1}
                onClick={() => handlePageChange(page - 1)}
              >
                <ChevronLeft className="size-4" />
                Previous
              </Button>
              <span className="text-sm text-muted-foreground">
                Page {page} of {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={page >= totalPages}
                onClick={() => handlePageChange(page + 1)}
              >
                Next
                <ChevronRight className="size-4" />
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function TemplateCard({ template: t }: { template: TemplateSummary }) {
  const colors = getTemplateColors(t);

  return (
    <Link to={`/templates/${t.slug}`}>
    <Card className="group overflow-hidden transition-shadow hover:shadow-md">
      {/* Preview thumbnail */}
      <div
        className="relative aspect-[4/3] overflow-hidden"
        style={{ backgroundColor: colors.bg }}
      >
        <div className="flex h-full flex-col items-center justify-center gap-2 p-6">
          <div
            className="h-2.5 w-3/4 rounded-sm"
            style={{ backgroundColor: colors.primary }}
          />
          <div
            className="h-1.5 w-1/2 rounded-sm opacity-40"
            style={{ backgroundColor: colors.text }}
          />
          <div
            className="h-1.5 w-2/3 rounded-sm opacity-30"
            style={{ backgroundColor: colors.text }}
          />
          <div
            className="h-1.5 w-5/12 rounded-sm opacity-20"
            style={{ backgroundColor: colors.text }}
          />
        </div>
        {t.isCurated && (
          <span className="absolute left-2 top-2 rounded-full bg-primary px-2 py-0.5 text-[10px] font-medium text-primary-foreground">
            Curated
          </span>
        )}
      </div>

      <CardContent className="p-4">
        <h3 className="font-semibold transition-colors group-hover:text-primary">
          {t.name}
        </h3>
        <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
          {t.description}
        </p>
      </CardContent>

      <CardFooter className="flex items-center justify-between border-t px-4 py-3 text-xs text-muted-foreground">
        <span className="flex items-center gap-1">
          <Users className="size-3" />
          {t.isCurated ? "Curated" : "Community"}
        </span>
        <span className="flex items-center gap-1">
          <Download className="size-3" />
          {t.usageCount} {t.usageCount === 1 ? "use" : "uses"}
        </span>
      </CardFooter>
    </Card>
    </Link>
  );
}
