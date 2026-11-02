import type { MetadataRoute } from "next";
import { appUrl } from "@/server/config";
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [
        "/app/",
        "/admin/",
        "/api/",
        "/share/",
        "/login",
        "/signup",
        "/invite",
        "/reset",
        "/verify",
      ],
    },
    sitemap: appUrl() + "/sitemap.xml",
  };
}
