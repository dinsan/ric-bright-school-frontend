import { Apple, Bird, Car, Cat, Dog, Fish, Flower2, Moon, Rocket, Star, Sun, TreePine, type LucideIcon } from "lucide-react";
import type { PictureKey } from "./contract";

/**
 * The picture set for picture passwords (classroom sign-in for Grades 1–3). Keys are what the API
 * stores; the images live here. Each picture has a distinct shape AND colour AND a word, so it can be
 * recognised by children who cannot read yet, and named for screen readers.
 */
export interface PictureInfo {
  label: string;
  icon: LucideIcon;
  /** Literal Tailwind classes (the compiler must see them). */
  tone: string;
}

export const PICTURES: Record<PictureKey, PictureInfo> = {
  cat: { label: "Cat", icon: Cat, tone: "bg-accent text-accent-fg" },
  dog: { label: "Dog", icon: Dog, tone: "bg-info-soft text-info-soft-fg" },
  star: { label: "Star", icon: Star, tone: "bg-band-high text-band-high-fg" },
  sun: { label: "Sun", icon: Sun, tone: "bg-warning text-warning-fg" },
  moon: { label: "Moon", icon: Moon, tone: "bg-inverse text-inverse-fg" },
  tree: { label: "Tree", icon: TreePine, tone: "bg-band-middle text-band-middle-fg" },
  fish: { label: "Fish", icon: Fish, tone: "bg-primary text-primary-fg" },
  apple: { label: "Apple", icon: Apple, tone: "bg-danger text-danger-fg" },
  rocket: { label: "Rocket", icon: Rocket, tone: "bg-surface-sunken text-fg" },
  flower: { label: "Flower", icon: Flower2, tone: "bg-danger-soft text-danger-soft-fg" },
  bird: { label: "Bird", icon: Bird, tone: "bg-success-soft text-success-soft-fg" },
  car: { label: "Car", icon: Car, tone: "bg-success text-success-fg" },
};

export const PICTURE_KEYS = Object.keys(PICTURES) as PictureKey[];

export function pictureInfo(key: PictureKey): PictureInfo {
  return PICTURES[key] ?? { label: key, icon: Star, tone: "bg-surface-sunken text-fg" };
}
