import { type RouteConfig, index, route, layout } from "@react-router/dev/routes";

export default [
    layout("routes/AdminAuthLayout.tsx", [
      index("pages/AdminIndex.tsx", { id: "ops-erp-root" }),
      route("admin", "pages/AdminIndex.tsx", { id: "ops-erp-admin" }),
      route("admin/ops", "pages/AdminOpsDashboard.tsx"),
      route("admin/ai-runs", "pages/AdminAiRuns.tsx"),
      route("admin/ops-agent", "pages/AdminOpsAgent.tsx"),
      route("admin/cms-agent", "pages/AdminCmsAgent.tsx"),
      route("admin/forecasting", "pages/AdminForecasting.tsx"),
      route("admin/menu-engineering", "pages/AdminMenuEngineering.tsx"),
      route("admin/analytics", "pages/AdminAnalytics.tsx"),
      route("admin/support-tickets", "pages/AdminSupportTickets.tsx"),
      route("admin/rd-applications", "pages/AdminRdApplications.tsx"),
      route("admin/moderation", "pages/AdminModeration.tsx"),
      route("admin/community-moderation", "pages/AdminCommunityModeration.tsx"),
      route("admin/sales-console", "pages/AdminSalesConsole.tsx"),
      route("admin/sales-console/:slug", "pages/AdminSalesAccount.tsx"),
      route("admin/kds", "pages/AdminKds.tsx"),
      route("admin/supplier", "pages/AdminSupplier.tsx"),
      route("admin/compliance", "pages/AdminCompliance.tsx"),
    ]),
    layout("routes/RdAuthLayout.tsx", [
      route("rd-console", "pages/RdConsole.tsx")
    ]),
    route("admin/login", "pages/AdminLogin.tsx", { id: "admin-login" }),
    route("login", "pages/AdminLogin.tsx", { id: "legacy-login-alias" }),
    route("*", "pages/not-found.tsx")
] satisfies RouteConfig;
