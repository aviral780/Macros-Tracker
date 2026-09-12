import type { NextConfig } from "next";
import os from "node:os";

// Let phones on the same Wi-Fi reach the dev server.
const lanHosts = Object.values(os.networkInterfaces())
  .flat()
  .filter((i) => i && i.family === "IPv4" && !i.internal)
  .map((i) => i!.address);

const nextConfig: NextConfig = {
  // Pin the project root so a stray lockfile in the home folder isn't picked up.
  outputFileTracingRoot: process.cwd(),
  turbopack: { root: process.cwd() },
  allowedDevOrigins: lanHosts,
  serverExternalPackages: ["better-sqlite3"],
  // The badge sits bottom-left, directly on top of the Settings nav item.
  // Compile and runtime errors still surface without it.
  devIndicators: false,
};

export default nextConfig;
