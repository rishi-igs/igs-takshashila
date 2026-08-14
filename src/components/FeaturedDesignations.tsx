import { slugify } from "@/lib/slug";

type Item = {
  id: string;
  name: string;
  roleStage: string;
  jobFamily: string;
  hours: number;
  moduleCount: number;
};

// A handful of approachable, recognizable designations for the home page
// teaser — full search/filter over all of them lives at /curriculum.
const FEATURED_NAMES = ["Quality Associate", "Quality Engineer", "Test Automation Engineer", "DevOps Engineer"];

export default function FeaturedDesignations({ items }: { items: Item[] }) {
  const byName = new Map(items.map((i) => [i.name, i]));
  const featured = FEATURED_NAMES.map((name) => byName.get(name)).filter((i): i is Item => Boolean(i));

  return (
    <section className="featured-designations">
      <div className="card-grid">
        {featured.map((item) => (
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
      <a href="/curriculum" className="button secondary" style={{ marginTop: "1.25rem" }}>
        View all designations
      </a>
    </section>
  );
}
