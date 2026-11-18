import { notFound } from "next/navigation";
import { cache } from "react";
import { requirePageAuth } from "@/server/auth/current-user";
import { HttpError } from "@/server/http/errors";
import { childForParent } from "@/server/family/service";

/** This parent's child (404 otherwise), loaded once per request for the layout, the pages and their titles. */
export const loadChild = cache(async (id: string) => {
  const auth = await requirePageAuth(["parent"]);
  try {
    return { auth, child: await childForParent(auth, id) };
  } catch (error) {
    if (error instanceof HttpError && error.status === 404) notFound();
    throw error;
  }
});
