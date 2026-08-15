import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  turbopack: {
    root: import.meta.dirname,
  },
  // @resvg/resvg-js ships a native binding loaded via a dynamic
  // require() that Turbopack's bundler can't statically resolve
  // ("non-ecmascript placeable asset"). @ffmpeg-installer/ffmpeg and
  // @ffprobe-installer/ffprobe similarly ship a platform-specific
  // binary resolved via a dynamic require(). All three need to opt out
  // of bundling in favor of plain Node require, same as sharp already
  // gets automatically (sharp is on Next's built-in external-packages
  // list; these aren't).
  serverExternalPackages: [
    "@resvg/resvg-js",
    "@ffmpeg-installer/ffmpeg",
    "@ffprobe-installer/ffprobe",
  ],
};

export default nextConfig;
