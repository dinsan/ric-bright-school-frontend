import { apiFetch } from "@/lib/api-client";
import { paths, type Child, type ChildCreate, type ChildSignInSetup } from "@/features/auth/contract";

/** Where a child's data copy downloads from (a plain link: the browser saves the file). */
export function childDataUrl(childId: string): string {
  return `/api${paths.childData(childId)}`;
}

export const familyApi = {
  children: () => apiFetch<Child[]>(paths.children),
  deleteChild: (childId: string) => apiFetch<void>(paths.child(childId), { method: "DELETE" }),
  addChild: (body: ChildCreate) => apiFetch<Child>(paths.children, { method: "POST", json: body }),
  setUpSignIn: (childId: string, body: ChildSignInSetup) => apiFetch<Child>(paths.childSignIn(childId), { method: "PUT", json: body }),
  linkChild: (code: string) => apiFetch<Child>(paths.linkChild, { method: "POST", json: { code } }),
  setActiveChild: (childId: string) => apiFetch<unknown>(paths.activeChild, { method: "PUT", json: { child_id: childId } }),
};
