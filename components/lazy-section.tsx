"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

export function LazySection({
  children,
  rootMargin = "200px",
}: {
  children: ReactNode;
  rootMargin?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin },
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [rootMargin]);

  return (
    <div ref={ref} style={visible ? undefined : { minHeight: "50vh" }}>
      {visible ? children : null}
    </div>
  );
}
