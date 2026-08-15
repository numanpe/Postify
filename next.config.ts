import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  turbopack: {
    root: import.meta.dirname,
  },
  // @resvg/resvg-js ships a native binding loaded via a dynamic
  // require() that Turbopack's bundler can't statically resolve
  // ("non-ecmascript placeable asset"). This opts it out of bundling
  // in favor of plain Node require, same as sharp already gets
  // automatically (sharp is on Next's built-in external-packages list;
  // resvg-js isn't).
  serverExternalPackages: ["@resvg/resvg-js"],
};

export default nextConfig;
