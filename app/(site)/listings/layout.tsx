import { ListingsNavShell } from "@/components/listings-nav-context";
import type { ReactNode } from "react";

export default function ListingsLayout({ children }: { children: ReactNode }): ReactNode {
  return <ListingsNavShell>{children}</ListingsNavShell>;
}
