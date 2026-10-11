import { redirect } from "next/navigation";
import { newRatingPath } from "@/lib/entry-rating";
import { MOCK_CAMPAIGN_ID } from "@/lib/mock/campaign";

export default function Home() {
  redirect(newRatingPath(MOCK_CAMPAIGN_ID));
}
