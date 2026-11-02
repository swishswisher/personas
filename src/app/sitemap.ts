import type { MetadataRoute } from "next";
import { publicPaths } from "@/components/public-page";
import { appUrl } from "@/server/config";
export default function sitemap(): MetadataRoute.Sitemap {
  return ["", ...publicPaths].map((path) => ({
    url: appUrl() + "/" + path,
    changeFrequency: "monthly" as const,
    priority: path === "" ? 1 : 0.7,
  }));
}
