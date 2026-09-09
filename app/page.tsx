import { redirect } from "next/navigation";
import { MOCK_CAMPAIGN_ID } from "@/lib/mock/campaign";

export default function Home() {
  redirect(`/c/${MOCK_CAMPAIGN_ID}/customer`);
}
