import { PILLAR_LABELS } from "@/lib/pillars";
import type { Pillar } from "@/generated/prisma/enums";

// A curated sample from the real Course Library (see /courses for the full,
// filterable 210-course set) — one pick per pillar so the section shows the
// breadth of the curriculum at a glance.
const TRENDING: { provider: string; name: string; pillar: Pillar; accessType: string; href: string }[] = [
  {
    provider: "DeepLearning.AI",
    name: "Building and Evaluating Advanced RAG",
    pillar: "AI_ENABLEMENT",
    accessType: "Premium or additional",
    href: "https://www.deeplearning.ai/courses/building-evaluating-advanced-rag",
  },
  {
    provider: "Udemy",
    name: "Learn Playwright Web & API Testing with TypeScript",
    pillar: "TOOLS_AND_ENGINEERING",
    accessType: "Premium or additional",
    href: "https://www.udemy.com/course/learn-playwright-web-api-testing-with-typescript/",
  },
  {
    provider: "Udemy",
    name: "ISTQB Foundation Level Training",
    pillar: "PROCESS_AND_QUALITY",
    accessType: "Premium or additional",
    href: "https://www.udemy.com/course/foundation-level-training/",
  },
  {
    provider: "Udemy",
    name: "Data Quality Testing: Theory to Implementation",
    pillar: "DOMAIN_AND_BUSINESS",
    accessType: "Premium or additional",
    href: "https://www.udemy.com/course/data-quality-testing-unleashed-theory-to-implementation/",
  },
  {
    provider: "Udemy",
    name: "Difficult Conversations – Complete Guide",
    pillar: "COMMUNICATION",
    accessType: "Premium or additional",
    href: "https://www.udemy.com/course/difficult-conversations-the-complete-guide/",
  },
  {
    provider: "Udemy",
    name: "AI Agents for API Testing with Postman, Keploy and Apidog",
    pillar: "AI_ENABLEMENT",
    accessType: "Premium or additional",
    href: "https://www.udemy.com/course/master-ai-api-testing-with-agents-zero-to-hero-2026/",
  },
];

export default function TrendingCourses() {
  return (
    <section className="trending-section">
      <div className="section-heading">
        <h2>Trending courses</h2>
        <p className="muted">A sample from the full course library, mapped across all five learning pillars.</p>
      </div>
      <div className="trending-grid">
        {TRENDING.map((c) => (
          <a key={c.href} className="trending-card" href={c.href} target="_blank" rel="noreferrer">
            <span className="pill">{PILLAR_LABELS[c.pillar]}</span>
            <div className="trending-name">{c.name}</div>
            <div className="trending-meta">
              {c.provider} · {c.accessType}
            </div>
          </a>
        ))}
      </div>
      <a href="/courses" className="button secondary" style={{ marginTop: "1.25rem" }}>
        Browse the full course library
      </a>
    </section>
  );
}
