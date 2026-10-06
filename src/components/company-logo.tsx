"use client";

import { useState } from "react";
import { logoUrl } from "@/lib/design/color";

// Logo on a white tile with a soft halo in the company accent (the `.tinted` parent sets --halo).
export function CompanyLogo({ name, domain, size = 40 }: { name: string; domain: string | null; size?: number }) {
  const [failed, setFailed] = useState(false);
  const src = logoUrl(domain, 128, name);
  const radius = Math.round(size * 0.3);
  return (
    <span
      className="grid shrink-0 place-items-center overflow-hidden bg-white"
      style={{ width: size, height: size, borderRadius: radius, boxShadow: `0 0 0 ${Math.max(3, Math.round(size / 10))}px var(--halo, var(--line))` }}
    >
      {src && !failed ? (
        // eslint-disable-next-line @next/next/no-img-element -- external logo CDN, no optimisation needed
        <img src={src} alt="" width={size * 0.75} height={size * 0.75} className="object-contain" style={{ width: size * 0.75, height: size * 0.75 }} onError={() => setFailed(true)} />
      ) : (
        <span className="font-display font-bold text-[#17151f]" style={{ fontSize: size * 0.42 }} aria-hidden="true">
          {name.trim()[0]?.toUpperCase() ?? "?"}
        </span>
      )}
    </span>
  );
}
