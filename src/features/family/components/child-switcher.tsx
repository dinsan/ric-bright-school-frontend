"use client";

import { ChevronDown } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "@/components/ui/toast";
import { useChildren, useSetActiveChild } from "../hooks";

/** Parents: which child the app is showing. Hidden until there are two children to choose from. */
export function ChildSwitcher({ activeChildId }: { activeChildId: string | null | undefined }) {
  const children = useChildren();
  const setActive = useSetActiveChild();
  const list = children.data ?? [];
  if (list.length < 2) return null;
  const active = list.find((child) => child.id === activeChildId) ?? list[0]!;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="max-w-48 gap-2 px-2" loading={setActive.isPending}>
          <Avatar name={active.display_name} size="sm" decorative />
          <span className="truncate max-sm:sr-only">
            <span className="sr-only">Showing</span> {active.display_name.split(" ")[0]}
          </span>
          <ChevronDown aria-hidden />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent>
        <DropdownMenuLabel>Show progress for</DropdownMenuLabel>
        <DropdownMenuRadioGroup
          value={active.id}
          onValueChange={(id) =>
            setActive.mutate(id, {
              onSuccess: () => toast({ title: `Showing ${list.find((child) => child.id === id)?.display_name}`, tone: "success" }),
              onError: () => toast({ title: "Could not switch child", description: "Try again in a moment.", tone: "danger" }),
            })
          }
        >
          {list.map((child) => (
            <DropdownMenuRadioItem key={child.id} value={child.id}>
              {child.display_name}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
