import type { Metadata } from "next";
import { Poppins } from "next/font/google";
import Image from "next/image";
import Link from "next/link";
import { ActionButton, SectionHeading, StatTile } from "./components/LandingBits";
import styles from "./landing.module.css";

const poppins = Poppins({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
});

const featureRibbon = [
  "Capture mobile hors ligne",
  "Controle qualite automatique",
  "Synchronisation ERP et facturation",
  "Pilotage multi equipes terrain",
];

const processSteps = [
  {
    title: "1. Capture terrain",
    text: "Lecture index, photo preuve, geolocalisation et horodatage depuis mobile.",
  },
  {
    title: "2. Controle automatique",
    text: "Detection des incoherences, doublons et variations suspectes en temps reel.",
  },
  {
    title: "3. Validation superviseur",
    text: "File de revue priorisee avec historique des decisions et audit complet.",
  },
  {
    title: "4. Injection SI",
    text: "Transmission vers facturation, CRM et entrepot data avec suivi des statuts.",
  },
];

const integrations = ["SAP IS-U", "Salesforce", "Microsoft Dynamics", "Oracle Utilities", "Snowflake", "Power BI"];

const stats = [
  { value: "10x", label: "releve plus rapide" },
  { value: "8M+", label: "index traites par mois" },
  { value: "43%", label: "dossiers corriges avant facturation" },
  { value: "5x", label: "moins de retours terrain" },
];

export const metadata: Metadata = {
  title: "E2C",
  description: "Plateforme metier pour E2C Client, E2C Agent et E2C Admin autour de la releve, du controle qualite et des operations terrain.",
};

export default function LandingPage() {
  return (
    <main className={`${styles.page} ${poppins.className}`}>
      <header className={styles.topbar}>
        <div className={styles.topbarInner}>
          <div className={styles.brand}>E2C</div>
          <nav className={styles.nav}>
            <a href="#workflow">Processus</a>
            <a href="#kpi">KPI</a>
            <a href="#integrations">Integrations</a>
            <a href="#reviews">Clients</a>
          </nav>
          <div className={styles.topActions}>
            <Link href="/signin" className={styles.ghostButton}>
              Se connecter
            </Link>
            <ActionButton href="/admin" small>
              Ouvrir la plateforme
            </ActionButton>
          </div>
        </div>
      </header>

      <div className={styles.container}>
        <section className={styles.hero}>
          <div>
            <h1>Les releves compteurs passent en vitesse superieure.</h1>
            <p>
              E2C Client, E2C Agent et E2C Admin unifient capture terrain, verification bureau et suivi des anomalies pour fiabiliser la facturation.
            </p>
            <ActionButton href="/signin">Demarrer un pilote</ActionButton>
          </div>
          <div className={styles.heroArt} aria-hidden="true">
            {processSteps.slice(0, 3).map((step) => (
              <div key={step.title} className={styles.heroBubble}>
                {step.title}
              </div>
            ))}
          </div>
        </section>

        <section className={styles.ribbon}>
          {featureRibbon.map((item) => (
            <article key={item} className={styles.ribbonItem}>
              <span>●</span>
              <p>{item}</p>
            </article>
          ))}
        </section>

        <section className={styles.darkShowcase}>
          <div className={styles.darkShowcaseHeader}>
            <h2>La creation de campagnes terrain simplifiee</h2>
            <p>Planifiez secteurs, assignez les tournees, suivez la progression et cloturez avec preuve photo.</p>
          </div>
          <div className={styles.darkShotFrame}>
            <Image src="/images/task/task.jpg" alt="Console de supervision des releves" fill sizes="100vw" />
          </div>
        </section>

        <section id="workflow">
          <SectionHeading
            title="Un parcours clair de la releve a la facturation"
            text="Chaque bloc correspond a une etape operationnelle unique, avec un responsable clairement defini."
          />
          <div className={styles.processGrid}>
            {processSteps.map((step) => (
              <article key={step.title} className={styles.processCard}>
                <h3>{step.title}</h3>
                <p>{step.text}</p>
              </article>
            ))}
          </div>
          <div className={styles.workflowGrid}>
            <article className={styles.workflowLarge}>
              <Image
                src="/images/grid-image/image-06.png"
                alt="Vue globale des operations terrain"
                fill
                sizes="(max-width: 768px) 100vw, 66vw"
              />
            </article>
            <article className={styles.workflowCard}>Controle doublons, incoherences et index suspects</article>
            <article className={styles.workflowCard}>Validation superviseur avec historique des decisions</article>
            <article className={styles.workflowCard}>Relances automatiques sur lots incomplets</article>
            <article className={styles.workflowCard}>Rapports qualite, SLA et productivite par secteur</article>
          </div>
        </section>

        <section id="kpi" className={styles.metricSection}>
          <h2>E2C, le standard operationnel pour la releve intelligente</h2>
          <p className={styles.kpiIntro}>
            Des indicateurs simples pour piloter la performance terrain, la qualite des donnees et le revenu.
          </p>
          <div className={styles.metricsGrid}>
            {stats.map((item) => (
              <StatTile key={item.label} value={item.value} label={item.label} />
            ))}
          </div>
        </section>

        <section id="integrations">
          <SectionHeading
            title="Integrez vos flux en quelques clics"
            text="Connexion SI facturation, MDM, CRM et data warehouse via API securisee et webhooks."
          />
          <div className={styles.integrationsList}>
            {integrations.map((item) => (
              <article key={item} className={styles.integrationItem}>
                {item}
              </article>
            ))}
          </div>
        </section>

        <section className={styles.aiSection}>
          <h2>Debloquez le potentiel IA de vos operations metering.</h2>
          <p>Score de confiance, detection de fraude et priorisation dynamique des interventions critiques.</p>
          <ActionButton href="/signin">Activer les modules IA</ActionButton>
          <div className={styles.aiPanels}>
            <article>Detection automatique des anomalies index</article>
            <article>Suggestion de route terrain optimisee</article>
            <article>Prediction des litiges avant emission facture</article>
          </div>
        </section>

        <section id="reviews">
          <SectionHeading
            title="Les equipes exploitation adoptent E2C"
            text="Des retours concrets de responsables releve, support client et revenue assurance."
          />
          <div className={styles.reviewGrid}>
            <article className={styles.reviewPhone}>
              <Image src="/images/carousel/carousel-01.png" alt="Application mobile releve" fill sizes="(max-width: 768px) 100vw, 25vw" />
            </article>
            <article className={styles.reviewCard}>
              <p>
                &ldquo;Nous avons baisse les rejets de facturation en trois semaines grace aux controles automatiques.&rdquo;
              </p>
              <span>Samia, Responsable facturation</span>
            </article>
            <article className={styles.reviewImage}>
              <Image src="/images/product/product-02.jpg" alt="Equipe operations terrain" fill sizes="(max-width: 768px) 100vw, 25vw" />
            </article>
            <article className={styles.reviewCard}>
              <p>
                &ldquo;Le deploiement multi agences est devenu standardise et mesurable, sans perte de qualite terrain.&rdquo;
              </p>
              <span>Marc, Directeur operations</span>
            </article>
          </div>
        </section>

        <section className={styles.ctaStrip}>
          <div>
            <h3>Capturez, controlez, facturez.</h3>
            <p>Une base unique pour connecter agents terrain, supervision et cycle revenu.</p>
          </div>
          <ActionButton href="/signin">Planifier une demo</ActionButton>
        </section>
      </div>

      <footer className={styles.footer}>
        <div className={styles.footerInner}>
          <div>
            <h4>E2C</h4>
            <p>Plateforme metier pour operations de releve et pilotage qualite.</p>
          </div>
          <div>
            <h5>Produit</h5>
            <a href="#">Capture mobile</a>
            <a href="#">Supervision</a>
            <a href="#">Automatisation</a>
          </div>
          <div>
            <h5>Ressources</h5>
            <a href="#">Documentation API</a>
            <a href="#">Securite</a>
            <a href="#">Tarification</a>
          </div>
          <div>
            <h5>Entreprise</h5>
            <a href="#">A propos</a>
            <a href="#">Contact</a>
            <a href="#">Partenaires</a>
          </div>
        </div>
      </footer>
    </main>
  );
}
