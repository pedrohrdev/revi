import type { NextConfig } from "next";
import path from "node:path";

const nextConfig: NextConfig = {
  turbopack: {
    // Pin the project root explicitly: an unrelated package-lock.json in a
    // parent directory (outside this Git repo) otherwise confuses Turbopack's
    // root inference.
    root: path.join(__dirname),
  },
};

export default nextConfig;
