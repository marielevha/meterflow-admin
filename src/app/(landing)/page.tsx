import type { Metadata } from "next";
import { Space_Grotesk, Inter } from "next/font/google";
import Link from "next/link";
import { ThemeToggleButton } from "@/components/common/ThemeToggleButton";
import styles from "./landing.module.css";

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  weight: ["500", "700"],
});

const inter = Inter({
  subsets: ["latin"],
  weight: ["500", "600", "700"],
});

const showcases = ["ENERGY GRID", "UTILITY OPS", "MUNICIPAL", "FIELD FORCE", "ANALYTICS"];

const modules = [
  {
    title: "Capture mobile intelligente",
    text: "Photo, index, GPS et sync offline.",
    tags: ["Flutter", "Offline outbox", "Geo proof"],
  },
  {
    title: "Validation centralisee",
    text: "Pending, flagged, rejected en un flux.",
    tags: ["Review queue", "Decisioning", "Audit mode"],
  },
  {
    title: "Anti fraude evolutif",
    text: "Regles metier puis OCR et scoring.",
    tags: ["Rules engine", "OCR ready", "Fraud score"],
  },
];

const useCases = [
  { title: "Releve mensuel massif", text: "Campagnes multi zones." },
  { title: "Recontrole des cas suspects", text: "Taches terrain et SLA." },
  { title: "Preparation facturation", text: "Index fiables et traces." },
  { title: "Pilotage regional", text: "Vue performance par equipe." },
];

const kpis = [
  { value: "98.7%", label: "Soumissions geotaguees" },
  { value: "-41%", label: "Temps moyen de validation" },
  { value: "24/7", label: "Supervision continue" },
  { value: "100%", label: "Actions tracables" },
];

const steps = [
  { title: "Collecte", text: "Le client ou lagent envoie photo et index depuis mobile." },
  { title: "Controle", text: "La plateforme applique controles metier et classifie les dossiers." },
  { title: "Decision", text: "Le backoffice valide, signale ou rejette avec historique complet." },
  { title: "Suivi", text: "Le client recoit le statut et les KPI s actualisent en temps reel." },
];

const faqs = [
  {
    q: "Le mode offline est il disponible partout ?",
    a: "Oui, stockage local puis sync auto.",
  },
  {
    q: "Peut on commencer sans IA ?",
    a: "Oui, regles d abord puis OCR ensuite.",
  },
  {
    q: "Comment garantir la tracabilite ?",
    a: "Chaque action cree un reading_event.",
  },
];

const gallery = [
  {
    src: "https://images.pexels.com/photos/257700/pexels-photo-257700.jpeg?auto=compress&cs=tinysrgb&w=1200",
    label: "Operations terrain",
  },
  {
    src: "https://images.pexels.com/photos/442150/pexels-photo-442150.jpeg?auto=compress&cs=tinysrgb&w=1200",
    label: "Supervision reseau",
  },
  {
    src: "https://images.pexels.com/photos/159397/solar-panel-array-power-sun-electricity-159397.jpeg?auto=compress&cs=tinysrgb&w=1200",
    label: "Infrastructure energie",
  },
];

export const metadata: Metadata = {
  title: "MeterFlow | Smart Meter Reading Platform",
  description:
    "Landing page moderne de la plateforme MeterFlow pour la collecte, validation et supervision des releves electriques.",
};

export default function LandingPage() {
  return (
    <main className={`${styles.page} ${inter.className}`}>
      <div className={styles.shell}>
        <header className={styles.nav}>
          <Link href="/" className={`${styles.brand} ${spaceGrotesk.className}`}>
            meterflow<span className={styles.brandDot}>.</span>
          </Link>

          <nav className={styles.navLinks}>
            <a href="#modules">Modules</a>
            <a href="#showcase">Showcase</a>
            <a href="#workflow">Workflow</a>
            <a href="#faq">FAQ</a>
          </nav>

          <div className={styles.ctaGroup}>
            <ThemeToggleButton />
            <Link href="/signin" className={styles.btnGhost}>
              Connexion
            </Link>
            <Link href="/admin" className={styles.btn}>
              Ouvrir backoffice
            </Link>
          </div>
        </header>

        <section className={styles.hero}>
          <div className={styles.heroText}>
            <span className={styles.kicker}>Energy data platform</span>
            <h1 className={`${styles.title} ${spaceGrotesk.className}`}>
              Meter reading,
              <br />
              <span className={styles.titleGlow}>fluid by design.</span>
            </h1>
            <p className={styles.subtitle}>
              Collecter, verifier, valider. Rapidement.
            </p>
            <div className={styles.heroActions}>
              <Link href="/signin" className={styles.btn}>
                Demarrer un pilote
              </Link>
              <a href="#modules" className={styles.btnGhost}>
                Explorer la plateforme
              </a>
            </div>
          </div>

          <div className={styles.heroViz} aria-hidden="true">
            <img
              src="https://images.pexels.com/photos/236698/pexels-photo-236698.jpeg?auto=compress&cs=tinysrgb&w=1200"
              alt=""
              className={styles.heroImage}
            />
            <div className={styles.orb} />
            <div className={styles.orbTwo} />
            <div className={styles.orbThree} />
            <div className={styles.wave} />
            <div className={styles.floatCard}>
              <p className={styles.cardLabel}>Pending queue</p>
              <p className={styles.cardValue}>+236</p>
              <p className={styles.cardMeta}>sync ready</p>
            </div>
            <div className={styles.floatCardTwo}>
              <p className={styles.cardLabel}>Validation rate</p>
              <p className={styles.cardValue}>92.1%</p>
              <p className={styles.cardMeta}>today</p>
            </div>
            <div className={styles.floatCardThree}>
              <p className={styles.cardLabel}>Fraud alerts</p>
              <p className={styles.cardValue}>17</p>
              <p className={styles.cardMeta}>needs review</p>
            </div>
          </div>
        </section>

        <section id="showcase" className={styles.logoRow}>
          {showcases.map((item) => (
            <span key={item}>{item}</span>
          ))}
        </section>

        <section id="modules" className={styles.section}>
          <div className={styles.sectionHead}>
            <h2 className={`${styles.sectionTitle} ${spaceGrotesk.className}`}>
              Modules fondamentaux pour un deploiement rapide
            </h2>
            <p className={styles.sectionText}>Moins de saisie. Plus de controle.</p>
          </div>

          <div className={styles.grid}>
            {modules.map((module) => (
              <article key={module.title} className={styles.card}>
                <h3 className={`${styles.cardTitle} ${spaceGrotesk.className}`}>{module.title}</h3>
                <p className={styles.cardText}>{module.text}</p>
                <div className={styles.pills}>
                  {module.tags.map((tag) => (
                    <span key={tag} className={styles.pill}>
                      {tag}
                    </span>
                  ))}
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className={`${styles.section} ${styles.useCaseSection}`}>
          <div className={styles.sectionHead}>
            <h2 className={`${styles.sectionTitle} ${spaceGrotesk.className}`}>Showcase d usage terrain</h2>
            <p className={styles.sectionText}>Cas reels, execution rapide.</p>
          </div>
          <div className={styles.useCaseGrid}>
            {useCases.map((item) => (
              <article key={item.title} className={styles.useCaseCard}>
                <h3 className={spaceGrotesk.className}>{item.title}</h3>
                <p>{item.text}</p>
              </article>
            ))}
          </div>
        </section>

        <section className={`${styles.section} ${styles.mediaSection}`}>
          <div className={styles.sectionHead}>
            <h2 className={`${styles.sectionTitle} ${spaceGrotesk.className}`}>Showcase visuel</h2>
            <p className={styles.sectionText}>Images libres de droit pour illustrer le produit.</p>
          </div>
          <div className={styles.mediaGrid}>
            {gallery.map((item) => (
              <article key={item.src} className={styles.mediaCard}>
                <img src={item.src} alt={item.label} className={styles.mediaImage} loading="lazy" />
                <p className={styles.mediaCaption}>{item.label}</p>
              </article>
            ))}
          </div>
        </section>

        <section id="workflow" className={`${styles.section} ${styles.sectionSplit}`}>
          <div>
            <div className={styles.sectionHead}>
              <h2 className={`${styles.sectionTitle} ${spaceGrotesk.className}`}>Workflow end to end</h2>
              <p className={styles.sectionText}>4 etapes claires, 0 zone grise.</p>
            </div>
            <div className={styles.timeline}>
              {steps.map((step, index) => (
                <article key={step.title} className={styles.step}>
                  <span className={styles.stepIndex}>{String(index + 1).padStart(2, "0")}</span>
                  <div>
                    <h4 className={spaceGrotesk.className}>{step.title}</h4>
                    <p>{step.text}</p>
                  </div>
                </article>
              ))}
            </div>
          </div>

          <aside className={styles.kpiWrap}>
            <div className={styles.sectionHead}>
              <h3 className={`${styles.sectionTitle} ${spaceGrotesk.className}`}>Live metrics snapshot</h3>
              <p className={styles.sectionText}>Vue instantanee.</p>
            </div>
            <div className={styles.kpiGrid}>
              {kpis.map((item) => (
                <article key={item.label} className={styles.kpi}>
                  <strong className={spaceGrotesk.className}>{item.value}</strong>
                  <span>{item.label}</span>
                </article>
              ))}
            </div>
          </aside>
        </section>

        <section className={`${styles.section} ${styles.archSection}`}>
          <div className={styles.archCard}>
            <h3 className={spaceGrotesk.className}>Architecture claire</h3>
            <p>Mobile → API → DB → Dashboard.</p>
          </div>
          <div className={styles.archCard}>
            <h3 className={spaceGrotesk.className}>Roadmap IA</h3>
            <p>MVP regles puis OCR.</p>
          </div>
          <div className={styles.archCard}>
            <h3 className={spaceGrotesk.className}>Conformite</h3>
            <p>Audit, GPS, preuves photo.</p>
          </div>
        </section>

        <section className={styles.testimonialSection}>
          <article className={styles.testimonialCard}>
            <p>
              &quot;Nous avons reduit les releves litigieux en trois semaines avec une meilleure visibilite sur le terrain.&quot;
            </p>
            <span>Responsable exploitation, Distribution regionale</span>
          </article>
          <article className={styles.testimonialCard}>
            <p>
              &quot;Le mode offline et la validation centralisee ont supprime les doubles saisies et fluidifie les equipes.&quot;
            </p>
            <span>Chef de projet digitalisation, Utility nationale</span>
          </article>
        </section>

        <section id="faq" className={styles.faqSection}>
          <h2 className={`${styles.sectionTitle} ${spaceGrotesk.className}`}>FAQ</h2>
          <div className={styles.faqList}>
            {faqs.map((item) => (
              <details key={item.q} className={styles.faqItem}>
                <summary className={spaceGrotesk.className}>{item.q}</summary>
                <p>{item.a}</p>
              </details>
            ))}
          </div>
        </section>

        <section className={styles.planSection}>
          <article className={styles.planCard}>
            <h3 className={spaceGrotesk.className}>MVP Launch</h3>
            <p>Auth, collecte, validation.</p>
          </article>
          <article className={styles.planCardAccent}>
            <h3 className={spaceGrotesk.className}>Scale Plan</h3>
            <p>Tasks, alerting, OCR.</p>
          </article>
        </section>

        <section className={styles.cta}>
          <h2 className={`${styles.ctaTitle} ${spaceGrotesk.className}`}>Launch fast, scale with confidence.</h2>
          <p className={styles.ctaText}>Passez en production plus vite.</p>
          <div className={styles.ctaRow}>
            <Link href="/signin" className={styles.btn}>
              Planifier une demo
            </Link>
            <Link href="/admin" className={styles.btnGhost}>
              Voir le dashboard
            </Link>
          </div>
        </section>

        <footer className={styles.footer}>
          <div className={styles.footerRow}>
            <span>© 2026 MeterFlow platform</span>
            <span>Security · Privacy · Support</span>
          </div>
        </footer>
      </div>
    </main>
  );
}
