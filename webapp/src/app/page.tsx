import Link from "next/link";
import {
  ArrowRight,
  ArrowUpRight,
  Building2,
  Check,
  CirclePlay,
  ClipboardList,
  Globe2,
  LockKeyhole,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Wrench,
} from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { PublicNav } from "@/components/public-nav";
import { ProductDemo } from "@/components/product-demo";
import { Reveal } from "@/components/reveal";
import { ENTITLEMENTS } from "@/lib/entitlements";
import {
  ENABLE_MONEY_BACK_GUARANTEE,
  MONEY_BACK_GUARANTEE_DAYS,
} from "@/lib/trust-config";

export default async function Home() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const ctaHref = user ? "/dashboard" : "/signup";
  const ctaLabel = user ? "Ouvrir mon espace" : "Commencer gratuitement";
  return (
    <div className="marketing-page">
      <PublicNav />
      <main>
        <section className="landing-hero marketing-container">
          <div className="hero-copy">
            <p className="eyebrow">
              <span className="status-dot" />
              Pour les entreprises qui font le terrain
            </p>
            <h1>
              Les bons clients.
              <br />
              <span>Pour votre métier.</span>
            </h1>
            <p className="hero-description">
              Votre agence web ne cherche pas les mêmes clients qu’une
              entreprise de nettoyage. Trouvez des prospects adaptés à votre
              offre, puis gérez la suite au même endroit.
            </p>
            <div className="hero-actions">
              <Link href={ctaHref} className="marketing-cta">
                {ctaLabel}
                <ArrowRight size={17} />
              </Link>
              <a href="#demo" className="marketing-secondary">
                <CirclePlay size={19} />
                Voir le produit
              </a>
            </div>
            <div className="hero-assurance">
              <span>
                <Check size={14} />
                Sans carte bancaire
              </span>
              <span>
                <Check size={14} />
                Version gratuite disponible
              </span>
            </div>
            <div className="hero-note">
              <span className="note-line" />
              Prospection pour vos clients professionnels.
              <br />
              Gestion métier pour votre quotidien.
            </div>
          </div>
          <div className="hero-product">
            <div className="hero-product-label">
              <span />
              Essayez : changez de métier ci-dessous
              <ArrowRight size={14} />
            </div>
            <ProductDemo />
            <div className="hero-product-caption">
              <SlidersHorizontal size={14} />
              Votre offre change. Votre recherche aussi.
            </div>
          </div>
        </section>
        <div className="source-strip">
          <div className="marketing-container">
            <span>Des informations que vous pouvez vérifier</span>
            <strong>Registre officiel français</strong>
            <span className="source-divider" />
            <strong>Fiches Google, si disponibles</strong>
            <span className="source-divider" />
            <strong>Critères expliqués</strong>
          </div>
        </div>
        <Reveal className="marketing-container section-space">
          <div id="metiers" className="section-heading">
            <p className="eyebrow">Votre métier donne la direction</p>
            <h2>
              Un besoin concret.
              <br />
              <span>Un parcours qui lui correspond.</span>
            </h2>
            <p>
              Commencez par ce que vous vendez. Les bons critères en découlent.
            </p>
          </div>
          <div className="vertical-grid">
            <article className="vertical-card vertical-web">
              <span className="vertical-icon">
                <Globe2 size={23} />
              </span>
              <span className="vertical-tag">Acquisition</span>
              <h3>
                Vous créez
                <br />
                des sites internet.
              </h3>
              <p>
                Ciblez les commerces et artisans sans site renseigné sur Google,
                dans votre zone.
              </p>
              <div className="vertical-proof">
                <Search size={15} />
                <span>Signal web vérifié, besoin à confirmer</span>
              </div>
              <a href="#demo">
                Voir la démonstration
                <ArrowUpRight size={17} />
              </a>
            </article>
            <article className="vertical-card vertical-cleaning">
              <span className="vertical-icon">
                <Building2 size={23} />
              </span>
              <span className="vertical-tag">Acquisition</span>
              <h3>
                Vous entretenez
                <br />
                des locaux.
              </h3>
              <p>
                Bureaux, hôtels ou copropriétés : choisissez la prestation pour
                obtenir des secteurs adaptés.
              </p>
              <div className="vertical-proof">
                <ClipboardList size={15} />
                <span>Surface et contrat actuel à qualifier</span>
              </div>
              <a href="#demo">
                Voir la démonstration
                <ArrowUpRight size={17} />
              </a>
            </article>
            <article className="vertical-card vertical-garage">
              <span className="vertical-icon">
                <Wrench size={23} />
              </span>
              <span className="vertical-tag">Gestion métier</span>
              <h3>
                Vous faites
                <br />
                tourner un atelier.
              </h3>
              <p>
                Retrouvez vos clients, véhicules et interventions. Développez
                les flottes seulement si c’est votre offre.
              </p>
              <div className="vertical-proof">
                <Check size={15} />
                <span>Votre atelier au premier plan</span>
              </div>
              <Link href="/tarifs">
                Découvrir la gestion
                <ArrowUpRight size={17} />
              </Link>
            </article>
          </div>
        </Reveal>
        <section id="demo" className="demo-section section-space">
          <div className="marketing-container demo-section-grid">
            <div>
              <p className="eyebrow">Voyez ce qui change</p>
              <h2>
                Moins de listes.
                <br />
                <span>Plus de pertinence.</span>
              </h2>
              <p className="section-description">
                Une courte explication des parcours agence web, nettoyage et
                garage. La vidéo présente la logique de ciblage, sans recherche
                réelle.
              </p>
              <ol className="demo-steps">
                <li>
                  <span>01</span>
                  <div>
                    <strong>Votre offre</strong>
                    <p>
                      Création de site, nettoyage de bureaux, entretien de
                      flottes…
                    </p>
                  </div>
                </li>
                <li>
                  <span>02</span>
                  <div>
                    <strong>Vos critères et votre zone</strong>
                    <p>Secteurs, rayon et signaux utiles à votre prestation.</p>
                  </div>
                </li>
                <li>
                  <span>03</span>
                  <div>
                    <strong>Votre prochaine action</strong>
                    <p>
                      Vérifiez le besoin, puis ajoutez le prospect à votre CRM.
                    </p>
                  </div>
                </li>
              </ol>
            </div>
            <div className="video-frame">
              <div className="video-label">
                <CirclePlay size={16} />
                <span>Le produit en 18 secondes</span>
                <span>Aperçu illustratif</span>
              </div>
              <video
                controls
                playsInline
                preload="metadata"
                poster="/demo/poster.jpg"
                aria-label="Démonstration des trois parcours ProspectFlow"
              >
                <source src="/demo/parcours-metiers.mp4" type="video/mp4" />
                <track
                  kind="captions"
                  src="/demo/parcours-metiers.vtt"
                  srcLang="fr"
                  label="Français"
                  default
                />
              </video>
              <p>
                Sans son · parcours illustratifs · testez aussi les boutons de
                l’aperçu en haut de page.
              </p>
            </div>
          </div>
        </section>
        <Reveal className="marketing-container section-space workflow-section">
          <div className="section-heading">
            <p className="eyebrow">Du premier contact au suivi</p>
            <h2>
              Trouver un contact,
              <br />
              <span>c’est le début.</span>
            </h2>
          </div>
          <div className="workflow-grid">
            <article>
              <span className="workflow-number">01 / TROUVER</span>
              <Search size={25} />
              <h3>Une recherche ciblée</h3>
              <p>
                Une offre, des secteurs choisis et un rayon précis. Les critères
                de sélection restent visibles.
              </p>
            </article>
            <article>
              <span className="workflow-number">02 / QUALIFIER</span>
              <ClipboardList size={25} />
              <h3>Un CRM pour avancer</h3>
              <p>
                Ajoutez vos prospects, gardez vos notes et suivez les échanges
                jusqu’au devis et au client gagné.
              </p>
            </article>
            <article>
              <span className="workflow-number">03 / PILOTER</span>
              <Sparkles size={25} />
              <h3>Votre activité réunie</h3>
              <p>
                Avec la gestion métier, retrouvez les modules adaptés à votre
                quotidien, selon votre abonnement.
              </p>
            </article>
          </div>
        </Reveal>
        <section className="marketing-container trust-section">
          <div>
            <span className="trust-icon">
              <ShieldCheck size={29} />
            </span>
            <p className="eyebrow">La confiance se vérifie</p>
            <h2>
              Testez d’abord.
              <br />
              Décidez ensuite.
            </h2>
            <p>
              Comprenez ce que le produit fait, ce que les données permettent de
              savoir et ce qui reste à vérifier.
            </p>
            <Link href="/securite">
              Lire nos engagements de sécurité
              <ArrowUpRight size={16} />
            </Link>
          </div>
          <div className="trust-points">
            <article>
              <LockKeyhole size={20} />
              <div>
                <h3>Un accès par compte</h3>
                <p>
                  Connexion Google ou email et accès aux espaces de travail
                  réservé à leurs membres.
                </p>
              </div>
            </article>
            <article>
              <Search size={20} />
              <div>
                <h3>Des inconnues signalées</h3>
                <p>
                  Une entreprise sans site renseigné n’est pas une vente
                  garantie. Vous gardez la main sur la qualification.
                </p>
              </div>
            </article>
            <article>
              <Check size={20} />
              <div>
                <h3>Un essai sans carte bancaire</h3>
                <p>
                  Le plan gratuit comprend{" "}
                  {ENTITLEMENTS.free.searchMonthlyLimit} recherches et{" "}
                  {ENTITLEMENTS.free.prospectMonthlyLimit} prospects par mois,
                  dans un rayon maximal de {ENTITLEMENTS.free.maxRadiusKm} km.
                </p>
              </div>
            </article>
            {ENABLE_MONEY_BACK_GUARANTEE && (
              <article>
                <ShieldCheck size={20} />
                <div>
                  <h3>
                    {MONEY_BACK_GUARANTEE_DAYS} jours satisfait ou remboursé
                  </h3>
                  <p>Selon les conditions de la garantie.</p>
                </div>
              </article>
            )}
          </div>
        </section>
        <section className="marketing-container section-space faq-section">
          <div>
            <p className="eyebrow">Les bonnes questions</p>
            <h2>
              Avant de
              <br />
              vous lancer.
            </h2>
            <Link href="/tarifs" className="marketing-secondary">
              Consulter les tarifs
              <ArrowRight size={16} />
            </Link>
          </div>
          <div className="faq-list">
            {[
              [
                "Est-ce adapté à mon entreprise ?",
                "La prospection s’adresse aux offres vendues à des entreprises : création de sites, nettoyage, sécurité ou entretien de flottes, par exemple. Pour une activité centrée sur les particuliers, comme un garage, la gestion métier est le point de départ le plus utile.",
              ],
              [
                "Les prospects ont-ils forcément besoin de moi ?",
                "Non. Les secteurs et signaux permettent de repérer des clients potentiels. Le besoin réel, le budget et l’existence d’un prestataire doivent être confirmés lors du contact. Aucune vente n’est garantie.",
              ],
              [
                "Comment vérifiez-vous l’absence de site ?",
                "La recherche utilise les entreprises du registre officiel et leur fiche Google lorsqu’elle peut être identifiée. Sans site renseigné sur cette fiche, le prospect peut correspondre à une offre de création de site. Une vérification complémentaire reste nécessaire : le site peut simplement ne pas être renseigné sur Google.",
              ],
              [
                "Puis-je utiliser uniquement la gestion ?",
                "Oui. Les offres Acquisition et Business OS sont distinctes. Les tarifs précisent les modules, volumes et limites compris dans chaque formule.",
              ],
            ].map(([q, a]) => (
              <details key={q}>
                <summary>
                  {q}
                  <span>+</span>
                </summary>
                <p>{a}</p>
              </details>
            ))}
          </div>
        </section>
        <section className="final-cta marketing-container">
          <p className="eyebrow">Votre prochaine étape</p>
          <h2>
            Faites avancer
            <br />
            votre activité.
          </h2>
          <p>
            Commencez gratuitement. Explorez le parcours adapté à votre métier.
          </p>
          <Link href={ctaHref} className="marketing-cta">
            {ctaLabel}
            <ArrowRight size={17} />
          </Link>
        </section>
      </main>
      <footer className="marketing-footer marketing-container">
        <Link href="/" className="font-display text-lg font-extrabold">
          ProspectFlow<span>•</span>
        </Link>
        <p>Des outils concrets pour les entreprises de terrain.</p>
        <nav>
          <Link href="/tarifs">Tarifs</Link>
          <Link href="/securite">Sécurité</Link>
          <Link href="/login">Connexion</Link>
        </nav>
      </footer>
    </div>
  );
}
