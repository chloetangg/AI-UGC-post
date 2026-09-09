import { redirect } from "next/navigation";

export default async function PreferencesRedirectPage({
  params,
}: {
  params: Promise<{ campaignId: string }>;
}) {
  const { campaignId } = await params;
  redirect(`/c/${campaignId}/experience`);
}
