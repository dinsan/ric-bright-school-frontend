import type { Metadata } from "next";
import { DeleteAccountSection } from "@/features/account/components/security-sections";
import { DisplaySection, ParentLinkSection, ProfileSection, TeacherProfileSection } from "@/features/account/components/profile-forms";
import { requireUser } from "@/lib/server/session";

export const metadata: Metadata = { title: "Your account" };

export default async function AccountPage() {
  const user = await requireUser();
  return (
    <>
      <ProfileSection user={user} />
      {user.role === "teacher" && <TeacherProfileSection user={user} />}
      {user.role === "student" && <ParentLinkSection />}
      <DisplaySection user={user} />
      {/* Children's accounts are managed by their parent or school. */}
      {user.role !== "student" && <DeleteAccountSection user={user} />}
    </>
  );
}
