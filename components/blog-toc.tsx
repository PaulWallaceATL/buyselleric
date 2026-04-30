import type { BlogTocItem } from "@/lib/blog-markdown";
import type { ReactNode } from "react";

type Props = Readonly<{
  items: BlogTocItem[];
}>;

export function BlogToc({ items }: Props): ReactNode {
  if (items.length < 3) return null;

  return (
    <aside className="hidden lg:block">
      <nav
        aria-label="On this page"
        className="sticky top-28 max-h-[calc(100vh-8rem)] overflow-y-auto rounded-2xl border border-border bg-muted/15 p-4 text-sm"
      >
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">On this page</p>
        <ol className="mt-3 list-none space-y-2 p-0">
          {items.map((item) => (
            <li key={item.id} className={item.depth === 3 ? "ml-3 border-l border-border pl-3" : ""}>
              <a
                href={`#${item.id}`}
                className="text-muted-foreground transition-colors hover:text-foreground"
              >
                {item.text}
              </a>
            </li>
          ))}
        </ol>
      </nav>
    </aside>
  );
}
