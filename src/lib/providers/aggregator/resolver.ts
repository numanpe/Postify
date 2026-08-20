import "server-only";

import type { AggregatorCredential } from "@prisma/client";

import { decryptSecret } from "@/lib/crypto";
import { AGGREGATOR_PROVIDERS, AggregatorProviderError } from "./types";
import type { SocialAggregatorAdapter } from "./types";
import { ZernioAdapter } from "./zernio-adapter";
import { PostproxyAdapter } from "./postproxy-adapter";
import { BufferAdapter } from "./buffer-adapter";
import { UploadPostAdapter } from "./upload-post-adapter";

// All four providers now have real adapters — see AGGREGATOR_PROVIDERS
// in types.ts for the confidence level and sourcing on each (Zernio and
// Postproxy are live-tested against their real request/response shapes;
// Buffer and Upload-Post have confirmed endpoints/auth but a
// medium-confidence field-name inference for their exact payloads,
// flagged in each adapter file). If a field name ever turns out wrong,
// the real API's own error response surfaces honestly — never a fake
// success, per CLAUDE.md's no-fake-functionality rule.
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
    case "UPLOAD_POST":
      return new UploadPostAdapter(apiKey);
    default:
      throw new AggregatorProviderError(credential.provider, "This provider isn't wired up yet.");
  }
}
