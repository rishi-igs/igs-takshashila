"use client";

import { useMemo, useState } from "react";
import { slugify } from "@/lib/slug";

type Item = {
  id: string;
  name: string;
  roleStage: string;
  jobFamily: string;
  hours: number;
  moduleCount: number;
};

export default function DesignationBrowser({ items }: { items: Item[] }) {
  const [query, setQuery] = useState("");
  const [roleStage, setRoleStage] = useState("");
  const [jobFamily, setJobFamily] = useState("");

  const roleStages = useMemo(
    () => Array.from(new Set(items.map((i) => i.roleStage))).sort(),
    [items]
  );
  const jobFamilies = useMemo(
    () => Array.from(new Set(items.map((i) => i.jobFamily))).sort(),
    [items]
  );

  const filtered = items.filter((i) => {
    if (roleStage && i.roleStage !== roleStage) return false;
    if (jobFamily && i.jobFamily !== jobFamily) return false;
    if (query && !i.name.toLowerCase().includes(query.toLowerCase())) return false;
    return true;
  });

  return (
    <>
      <div className="filters">
        <input
          type="search"
          placeholder="Search designations..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <select value={roleStage} onChange={(e) => setRoleStage(e.target.value)}>
          <option value="">All role stages</option>
          {roleStages.map((rs) => (
            <option key={rs} value={rs}>
              {rs}
            </option>
          ))}
        </select>
        <select value={jobFamily} onChange={(e) => setJobFamily(e.target.value)}>
          <option value="">All job families</option>
          {jobFamilies.map((jf) => (
            <option key={jf} value={jf}>
              {jf}
            </option>
          ))}
        </select>
      </div>

      {filtered.length === 0 ? (
        <p className="empty-state">No designations match those filters.</p>
      ) : (
        <div className="card-grid">
          {filtered.map((item) => (
            <a key={item.id} className="card" href={`/curriculum/${slugify(item.name)}`}>
              <div className="name">{item.name}</div>
              <div className="meta">
                {item.roleStage} · {item.jobFamily}
              </div>
              <div className="meta">
                {item.moduleCount} modules · {item.hours} hrs
              </div>
            </a>
          ))}
        </div>
      )}
    </>
  );
}
