import "server-only";

import type { AggregatorCredential } from "@prisma/client";

import { decryptSecret } from "@/lib/crypto";
import { AGGREGATOR_PROVIDERS, AggregatorProviderError } from "./types";
import type { SocialAggregatorAdapter } from "./types";
import { ZernioAdapter } from "./zernio-adapter";
import { PostproxyAdapter } from "./postproxy-adapter";
import { BufferAdapter } from "./buffer-adapter";

// ZERNIO, POSTPROXY, and BUFFER have real adapters, each built against
// verified (and where possible live-tested) API shapes — see
// AGGREGATOR_PROVIDERS in types.ts for the confidence level and sourcing
// on each. UPLOAD_POST still throws — its photo-publish endpoint (the
// one this app actually needs; posters are images) couldn't be verified
// despite repeated attempts, and this app won't call a guessed API. This
// throws rather than falling back to a fake success either way, per
// CLAUDE.md's no-fake-functionality rule.
export function getAggregatorAdapter(credential: AggregatorCredential): SocialAggregatorAdapter {
  const info = AGGREGATOR_PROVIDERS.find((p) => p.provider === credential.provider);
  if (!info?.implemented) {
    throw new AggregatorProviderError(
      info?.displayName ?? credential.provider,
      info?.unimplementedReason ?? "This provider isn't wired up yet.",
    );
  }

  const apiKey = decryptSecret(credential.encryptedKey);
  switch (credential.provider) {
    case "ZERNIO":
      return new ZernioAdapter(apiKey);
    case "POSTPROXY":
      return new PostproxyAdapter(apiKey);
    case "BUFFER":
      return new BufferAdapter(apiKey);
    default:
      throw new AggregatorProviderError(credential.provider, "This provider isn't wired up yet.");
  }
}
