import type { AspectRatio } from "@prisma/client";

export const POSTER_DIMENSIONS: Record<AspectRatio, { width: number; height: number }> = {
  SQUARE: { width: 1080, height: 1080 },
  STORY: { width: 1080, height: 1920 },
  LANDSCAPE: { width: 1920, height: 1080 },
};
