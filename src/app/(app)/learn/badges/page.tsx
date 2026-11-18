import type { Metadata } from "next";
import { PageHeader } from "@/components/layout/page-header";
import { AchievementsNav } from "@/features/learn/components/achievements-nav";
import { BadgesOverview } from "@/features/learn/components/gamification";

export const metadata: Metadata = { title: "Badges" };

export default function BadgesPage() {
  return (
    <div className="mx-auto grid max-w-5xl gap-6">
      <PageHeader title="Badges" description="Earned by learning a little, often. Every badge says how to get it." />
      <AchievementsNav />
      <BadgesOverview />
    </div>
  );
}
