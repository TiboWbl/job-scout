"use client";

import { useState } from "react";
import type { Criteria } from "@/lib/domain/criteria";
import { CriteriaEditor } from "./criteria-editor";

// The demo persona's criteria: editable during the visit to see how it works, never saved.
export function DemoSearch({ initial }: { initial: Criteria }) {
  const [criteria, setCriteria] = useState(initial);
  return <CriteriaEditor value={criteria} onChange={setCriteria} />;
}
