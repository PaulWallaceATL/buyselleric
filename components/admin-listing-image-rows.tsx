"use client";

import { useState } from "react";
import { canPreviewImageUrl } from "@/lib/form-images";

const inputClass =
  "w-full rounded-xl border border-border bg-muted/20 px-4 py-2.5 text-foreground placeholder:text-muted-foreground focus-ring outline-none font-mono text-sm";

type Props = {
  initialUrls: string[];
};

export function AdminListingImageRows({ initialUrls }: Props) {
  const [rows, setRows] = useState<string[]>(() =>
    initialUrls.length > 0 ? [...initialUrls] : [""]
  );

  function updateRow(i: number, v: string) {
    setRows((prev) => prev.map((x, j) => (j === i ? v : x)));
  }

  function removeRow(i: number) {
    setRows((prev) => (prev.length <= 1 ? [""] : prev.filter((_, j) => j !== i)));
  }

  function addRow() {
    setRows((prev) => [...prev, ""]);
  }

  function moveRow(i: number, dir: -1 | 1) {
    const j = i + dir;
    if (j < 0 || j >= rows.length) {
      return;
    }
    setRows((prev) => {
      const next = [...prev];
      const a = next[i];
      const b = next[j];
      if (a === undefined || b === undefined) {
        return prev;
      }
      next[i] = b;
      next[j] = a;
      return next;
    });
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        The <strong className="text-foreground">first</strong> image is the cover on cards and listing pages.
        Use arrows to change order.
      </p>
      <div className="space-y-4">
        {rows.map((url, i) => (
          <div
            key={i}
            className="flex flex-col gap-3 rounded-xl border border-border bg-muted/10 p-4 sm:flex-row sm:items-stretch"
          >
            <div className="mx-auto flex shrink-0 flex-col gap-2 sm:mx-0">
              <div className="h-28 w-40 overflow-hidden rounded-lg border border-border bg-muted sm:h-32 sm:w-44">
                {canPreviewImageUrl(url) ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={url.trim()} alt="" className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full items-center justify-center p-2 text-center text-xs text-muted-foreground">
                    {url.trim() ? "Can’t preview" : "Enter URL"}
                  </div>
                )}
              </div>
              <div className="flex justify-center gap-1">
                <button
                  type="button"
                  onClick={() => moveRow(i, -1)}
                  disabled={i === 0}
                  className="rounded-md border border-border px-2 py-1 text-xs font-medium disabled:opacity-40"
                  aria-label="Move image up"
                >
                  ↑
                </button>
                <button
                  type="button"
                  onClick={() => moveRow(i, 1)}
                  disabled={i === rows.length - 1}
                  className="rounded-md border border-border px-2 py-1 text-xs font-medium disabled:opacity-40"
                  aria-label="Move image down"
                >
                  ↓
                </button>
              </div>
            </div>
            <div className="min-w-0 flex-1">
              <label className="mb-1 block text-sm font-medium" htmlFor={`image_url_${i}`}>
                Image URL {i + 1}
              </label>
              <input
                id={`image_url_${i}`}
                name="image_url"
                value={url}
                onChange={(e) => updateRow(i, e.target.value)}
                placeholder="https://…"
                className={inputClass}
                autoComplete="off"
              />
              <button
                type="button"
                onClick={() => removeRow(i)}
                className="mt-2 text-sm text-red-600 underline-offset-2 hover:underline dark:text-red-400"
              >
                Remove
              </button>
            </div>
          </div>
        ))}
      </div>
      <button
        type="button"
        onClick={addRow}
        className="text-sm font-medium text-foreground underline-offset-4 hover:underline"
      >
        + Add image URL
      </button>
    </div>
  );
}
