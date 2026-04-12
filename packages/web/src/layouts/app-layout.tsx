import { Link, NavLink, Outlet } from "react-router";
import {
  LayoutDashboard,
  PenTool,
  Store,
  LogOut,
  LogIn,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/auth-context";
import { cn } from "@/lib/utils";

const navItems = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/builder", label: "Builder", icon: PenTool },
  { to: "/marketplace", label: "Marketplace", icon: Store },
] as const;

function NavItem({
  to,
  label,
  icon: Icon,
}: {
  to: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        cn(
          "flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors",
          isActive
            ? "bg-accent text-accent-foreground"
            : "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
        )
      }
    >
      <Icon className="h-4 w-4" />
      {label}
    </NavLink>
  );
}

export default function AppLayout() {
  const { isAuthenticated, username, logout } = useAuth();

  return (
    <div className="flex min-h-svh flex-col">
      <header className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="mx-auto flex h-14 max-w-7xl items-center gap-4 px-4">
          <Link to="/" className="text-lg font-bold">
            Site
          </Link>

          {isAuthenticated && (
            <nav className="hidden items-center gap-1 md:flex">
              {navItems.map((item) => (
                <NavItem key={item.to} {...item} />
              ))}
            </nav>
          )}

          <div className="ml-auto flex items-center gap-2">
            {isAuthenticated ? (
              <>
                <span className="hidden text-sm text-muted-foreground sm:inline">
                  {username}
                </span>
                <Button variant="ghost" size="sm" onClick={logout}>
                  <LogOut className="mr-1 h-4 w-4" />
                  Log out
                </Button>
              </>
            ) : (
              <Button variant="ghost" size="sm" asChild>
                <Link to="/login">
                  <LogIn className="mr-1 h-4 w-4" />
                  Log in
                </Link>
              </Button>
            )}
          </div>
        </div>
      </header>

      {/* Mobile nav */}
      {isAuthenticated && (
        <nav className="flex gap-1 overflow-x-auto border-b px-4 py-2 md:hidden">
          {navItems.map((item) => (
            <NavItem key={item.to} {...item} />
          ))}
        </nav>
      )}

      <main className="mx-auto flex w-full max-w-7xl flex-1 flex-col px-4">
        <Outlet />
      </main>
    </div>
  );
}
