"use client";

import { useMemo, useState } from "react";
import { PILLAR_LABELS, PILLAR_ORDER } from "@/lib/pillars";
import type { Pillar } from "@/generated/prisma/enums";

type Item = {
  id: string;
  provider: string;
  name: string;
  accessType: string;
  directLink: string | null;
  pillars: Pillar[];
  qualityNote: string | null;
  validationStatus: string;
};

export default function CourseBrowser({ items }: { items: Item[] }) {
  const [query, setQuery] = useState("");
  const [pillar, setPillar] = useState<string>("");
  const [accessType, setAccessType] = useState("");

  const accessTypes = useMemo(
    () => Array.from(new Set(items.map((i) => i.accessType))).sort(),
    [items]
  );

  const filtered = items.filter((i) => {
    if (pillar && !i.pillars.includes(pillar as Pillar)) return false;
    if (accessType && i.accessType !== accessType) return false;
    if (query) {
      const q = query.toLowerCase();
      if (!i.name.toLowerCase().includes(q) && !i.provider.toLowerCase().includes(q)) return false;
    }
    return true;
  });

  return (
    <>
      <div className="filters">
        <input
          type="search"
          placeholder="Search course or provider..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <select value={pillar} onChange={(e) => setPillar(e.target.value)}>
          <option value="">All pillars</option>
          {PILLAR_ORDER.map((p) => (
            <option key={p} value={p}>
              {PILLAR_LABELS[p]}
            </option>
          ))}
        </select>
        <select value={accessType} onChange={(e) => setAccessType(e.target.value)}>
          <option value="">All access types</option>
          {accessTypes.map((a) => (
            <option key={a} value={a}>
              {a}
            </option>
          ))}
        </select>
      </div>

      <p className="muted" style={{ marginBottom: "0.75rem", fontSize: "0.85rem" }}>
        {filtered.length} of {items.length} courses
      </p>

      {filtered.length === 0 ? (
        <p className="empty-state">No courses match those filters.</p>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Course</th>
                <th>Provider</th>
                <th>Pillars</th>
                <th>Access</th>
                <th>Validation status</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((c) => (
                <tr key={c.id}>
                  <td>
                    {c.directLink ? (
                      <a href={c.directLink} target="_blank" rel="noreferrer" style={{ fontWeight: 600 }}>
                        {c.name}
                      </a>
                    ) : (
                      <span style={{ fontWeight: 600 }}>{c.name}</span>
                    )}
                    {c.qualityNote && (
                      <div className="muted" style={{ fontSize: "0.8rem" }}>
                        {c.qualityNote}
                      </div>
                    )}
                  </td>
                  <td>{c.provider}</td>
                  <td>
                    {c.pillars.map((p) => (
                      <span key={p} className="pill">
                        {PILLAR_LABELS[p]}
                      </span>
                    ))}
                  </td>
                  <td>{c.accessType}</td>
                  <td className="muted" style={{ fontSize: "0.85rem" }}>
                    {c.validationStatus}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
