import { createBrowserRouter } from "react-router";
import AppLayout from "@/layouts/app-layout";

function lazyPage(importFn: () => Promise<{ default: React.ComponentType }>) {
  return async () => {
    const mod = await importFn();
    return { Component: mod.default };
  };
}

export const router = createBrowserRouter([
  {
    element: <AppLayout />,
    children: [
      {
        path: "/",
        lazy: lazyPage(() => import("@/pages/home")),
      },
      {
        path: "/create",
        lazy: lazyPage(() => import("@/pages/create")),
      },
      {
        path: "/login",
        lazy: lazyPage(() => import("@/pages/login")),
      },
      {
        path: "/dashboard",
        lazy: lazyPage(() => import("@/pages/dashboard")),
      },
      {
        path: "/builder",
        lazy: lazyPage(() => import("@/pages/builder")),
      },
      {
        path: "/marketplace",
        lazy: lazyPage(() => import("@/pages/marketplace")),
      },
      {
        path: "/templates/new",
        lazy: lazyPage(() => import("@/pages/template-editor")),
      },
      {
        path: "/templates/:slug",
        lazy: lazyPage(() => import("@/pages/template-detail")),
      },
      {
        path: "/templates/:slug/edit",
        lazy: lazyPage(() => import("@/pages/template-editor")),
      },
    ],
  },
]);
