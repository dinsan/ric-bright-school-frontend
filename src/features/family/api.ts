import { apiFetch } from "@/lib/api-client";
import { paths, type Child, type ChildCreate, type ChildSignInSetup } from "@/features/auth/contract";

export const familyApi = {
  children: () => apiFetch<Child[]>(paths.children),
  addChild: (body: ChildCreate) => apiFetch<Child>(paths.children, { method: "POST", json: body }),
  setUpSignIn: (childId: string, body: ChildSignInSetup) => apiFetch<Child>(paths.childSignIn(childId), { method: "PUT", json: body }),
  linkChild: (code: string) => apiFetch<Child>(paths.linkChild, { method: "POST", json: { code } }),
  setActiveChild: (childId: string) => apiFetch<unknown>(paths.activeChild, { method: "PUT", json: { child_id: childId } }),
};
