import type { Metadata } from "next";
import { PageHeader } from "@/components/layout/page-header";
import { MyCourses } from "@/features/learn/components/my-courses";
import { CoursesNav } from "@/features/learn/components/notebook";

export const metadata: Metadata = { title: "My courses" };

export default function MyCoursesPage() {
  return (
    <div className="mx-auto grid max-w-5xl gap-6">
      <PageHeader title="My courses" description="The courses you are taking, with where you got to." />
      <CoursesNav />
      <MyCourses />
    </div>
  );
}
