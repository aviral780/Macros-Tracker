import type { Metadata } from "next";
import os from "node:os";
import { headers } from "next/headers";
import { SettingsView } from "@/components/SettingsView";

export const metadata: Metadata = { title: "Settings" };

export default async function Page() {
  const host = (await headers()).get("host") ?? "localhost:3000";
  const port = host.split(":")[1] ?? "3000";
  const lanUrls = Object.values(os.networkInterfaces())
    .flat()
    .filter((i) => i && i.family === "IPv4" && !i.internal)
    .map((i) => `http://${i!.address}:${port}`);
  return <SettingsView lanUrls={lanUrls} />;
}
