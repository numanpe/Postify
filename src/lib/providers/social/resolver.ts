import "server-only";

import type { SocialAccount } from "@prisma/client";

import { decryptSecret } from "@/lib/crypto";
import type { SocialProvider } from "./types";
import { FacebookPageProvider } from "./facebook-page-provider";
import { InstagramProvider } from "./instagram-provider";

// Unlike the text/image resolvers, there's no free-vs-BYOK choice here —
// every SocialAccount row already picked its provider by which platform
// it connected. This just builds the right adapter with the account's
// decrypted token.
export function getSocialProvider(account: SocialAccount): SocialProvider {
  const token = decryptSecret(account.encryptedToken);

  if (account.platform === "FACEBOOK") {
    return new FacebookPageProvider(account.externalAccountId, token);
  }
  return new InstagramProvider(account.externalAccountId, token);
}
