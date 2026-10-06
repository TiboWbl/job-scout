"use client";

import { useLayoutEffect, useRef, type TextareaHTMLAttributes } from "react";

// A textarea that grows with its text, so the whole of what was written stays visible.
export function AutoTextarea({ value, minRows = 3, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement> & { value: string; minRows?: number }) {
  const ref = useRef<HTMLTextAreaElement>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight + 2}px`;
  }, [value]);
  return <textarea ref={ref} value={value} rows={minRows} {...props} style={{ ...props.style, overflow: "hidden" }} />;
}
