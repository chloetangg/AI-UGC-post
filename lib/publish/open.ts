import { sharePost } from "@/lib/publish/share";
import type { RednotePublishPackage } from "@/lib/rednote-publish";
import type { SharePostResult } from "@/lib/publish/types";

/** Unified publish entry. Existing generated package only — never calls OpenAI. */
export async function shareGeneratedPost(pkg: RednotePublishPackage): Promise<SharePostResult> {
  return sharePost(pkg);
}

export { sharePost };
