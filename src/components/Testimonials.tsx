// Illustrative quotes written for the Academy, in the voice of its real
// designations — not attributed to real, identifiable people. Swap these
// for genuine learner feedback once it's collected.
const TESTIMONIALS = [
  {
    quote:
      "The role-based curriculum meant I wasn't just taking random courses — every module mapped straight to what my next designation actually required.",
    name: "Ananya R.",
    role: "Quality Engineer",
  },
  {
    quote:
      "I went from executing assigned tests to designing my own test strategy in under six months, and the evidence-based progression made the jump feel earned, not arbitrary.",
    name: "Rohan K.",
    role: "Senior Quality Engineer",
  },
  {
    quote:
      "Having AI Enablement built into the core curriculum — not bolted on — helped me use tools like Copilot responsibly instead of guessing.",
    name: "Priya M.",
    role: "Test Automation Engineer",
  },
  {
    quote:
      "The certification directions gave me a clear target instead of a vague checklist. I knew exactly what to study and why.",
    name: "Karthik S.",
    role: "DevOps Engineer",
  },
];

export default function Testimonials() {
  return (
    <section className="testimonial-section">
      <div className="section-heading">
        <h2>What learners say</h2>
        <p className="muted">Illustrative feedback in the voice of the Academy&apos;s designations.</p>
      </div>
      <div className="testimonial-grid">
        {TESTIMONIALS.map((t) => (
          <figure className="testimonial-card" key={t.name}>
            <blockquote>&ldquo;{t.quote}&rdquo;</blockquote>
            <figcaption>
              <span className="testimonial-name">{t.name}</span>
              <span className="muted">{t.role}</span>
            </figcaption>
          </figure>
        ))}
      </div>
    </section>
  );
}
