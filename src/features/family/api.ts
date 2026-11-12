import { bff } from "@/lib/bff";
import { paths, type Child, type ChildCreate, type ChildSignInSetup } from "@/features/auth/contract";

export const familyApi = {
  children: () => bff<Child[]>(paths.children),
  addChild: (body: ChildCreate) => bff<Child>(paths.children, { method: "POST", json: body }),
  setUpSignIn: (childId: string, body: ChildSignInSetup) => bff<Child>(paths.childSignIn(childId), { method: "PUT", json: body }),
  linkChild: (code: string) => bff<Child>(paths.linkChild, { method: "POST", json: { code } }),
  setActiveChild: (childId: string) => bff<unknown>(paths.activeChild, { method: "PUT", json: { child_id: childId } }),
};
