"use client";

import { RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FieldError } from "@/components/ui/form-field";
import { cn } from "@/lib/cn";
import type { PictureKey } from "@/features/auth/contract";
import { PICTURE_KEYS, pictureInfo } from "@/features/auth/pictures";

interface PicturePickerProps {
  value: PictureKey[];
  onChange: (value: PictureKey[]) => void;
  error?: string;
  count?: number;
}

/** Parents choose a child's picture password: three different pictures, in order. */
export function PicturePicker({ value, onChange, error, count = 3 }: PicturePickerProps) {
  const toggle = (key: PictureKey) => {
    if (value.includes(key)) onChange(value.filter((item) => item !== key));
    else if (value.length < count) onChange([...value, key]);
  };
  return (
    <fieldset className="grid gap-3" aria-describedby={error ? "picture-error" : undefined}>
      <legend className="mb-1 text-small font-bold">
        Pick {count} pictures, in order <span className="font-normal text-fg-muted">({value.length} of {count})</span>
      </legend>
      <ol className="flex gap-2" aria-label="Chosen pictures">
        {Array.from({ length: count }, (_, index) => {
          const key = value[index];
          const info = key ? pictureInfo(key) : null;
          return (
            <li
              key={index}
              className={cn(
                "grid size-16 place-items-center rounded-control border-2 border-dashed border-line text-caption font-bold",
                info && `border-solid ${info.tone}`,
              )}
            >
              {info ? (
                <>
                  <info.icon aria-hidden className="size-7" />
                  <span className="sr-only">
                    {index + 1}: {info.label}
                  </span>
                </>
              ) : (
                <span aria-hidden>{index + 1}</span>
              )}
            </li>
          );
        })}
      </ol>
      <ul className="grid grid-cols-4 gap-2 sm:grid-cols-6">
        {PICTURE_KEYS.map((key) => {
          const { label, icon: Icon, tone } = pictureInfo(key);
          const position = value.indexOf(key);
          const chosen = position >= 0;
          return (
            <li key={key}>
              <button
                type="button"
                aria-pressed={chosen}
                disabled={!chosen && value.length >= count}
                onClick={() => toggle(key)}
                className={cn(
                  "relative flex aspect-square w-full flex-col items-center justify-center gap-0.5 rounded-control border-2 border-line p-1 text-caption font-bold disabled:opacity-40",
                  tone,
                  chosen && "ring-4 ring-focus ring-offset-2 ring-offset-surface",
                )}
              >
                <Icon aria-hidden className="size-[45%]" />
                {label}
                {chosen && (
                  <span aria-hidden className="absolute -top-2 -right-2 grid size-6 place-items-center rounded-full border-2 border-line bg-surface text-caption text-fg">
                    {position + 1}
                  </span>
                )}
              </button>
            </li>
          );
        })}
      </ul>
      {value.length > 0 && (
        <div>
          <Button size="sm" variant="ghost" onClick={() => onChange([])}>
            <RotateCcw aria-hidden />
            Clear pictures
          </Button>
        </div>
      )}
      {error && <FieldError id="picture-error">{error}</FieldError>}
    </fieldset>
  );
}
