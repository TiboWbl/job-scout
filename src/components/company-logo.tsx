"use client";

import { useState } from "react";
import { JobOffer } from "@/lib/types";
import { gradientForCompany } from "@/lib/sources/normalize";

export function CompanyLogo({ offer, size = 36 }: { offer: Pick<JobOffer, "company" | "companyInitials" | "companyColor" | "companyDomain">; size?: number }) {
  const [failed, setFailed] = useState(false);
  const showLogo = offer.companyDomain && !failed;
  const [from, to] = gradientForCompany(offer.company);

  return (
    <div
      className="flex shrink-0 items-center justify-center overflow-hidden rounded-xl text-white"
      style={{
        width: size,
        height: size,
        backgroundColor: showLogo ? "#ffffff" : undefined,
        backgroundImage: showLogo ? undefined : `linear-gradient(135deg, ${from}, ${to})`,
        border: showLogo ? "1px solid var(--border)" : undefined,
      }}
    >
      {showLogo ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={`https://unavatar.io/${offer.companyDomain}?fallback=false`}
          alt={offer.company}
          width={size}
          height={size}
          className="h-full w-full object-contain p-1.5"
          onError={() => setFailed(true)}
        />
      ) : (
        <span className="font-semibold tracking-tight" style={{ fontSize: size * 0.46 }}>
          {offer.companyInitials}
        </span>
      )}
    </div>
  );
}
