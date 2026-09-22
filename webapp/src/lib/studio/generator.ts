// STUDIO IA — générateur de contenu multi-canal 100% déterministe (aucun
// appel Anthropic, cohérent avec le reste du produit : NOVA et Business
// Twin restent déterministes tant qu'aucune clé n'est configurée). La
// RÈGLE ABSOLUE : chaque ligne produite vient d'un champ que l'utilisateur
// a rempli (StudioInput), de l'identité de l'entreprise (nom/ville, déjà
// connues) ou du Brand Kit (ton) — jamais d'un prix, d'une caractéristique
// ou d'un chiffre de performance inventés. Un champ vide n'apparaît tout
// simplement pas, plutôt que d'être deviné.

import type { BrandKit, BrandTone, GeneratedContent, OfferType, StudioInput, StudioVertical } from "./types";

const TONE_CLOSING: Record<BrandTone, string> = {
  professionnel: "Nous restons à votre disposition pour toute question.",
  chaleureux: "On a hâte de vous accueillir !",
  dynamique: "Ne passez pas à côté !",
  premium: "Une expérience pensée pour vous.",
};

const TONE_EMOJI: Record<BrandTone, string> = {
  professionnel: "",
  chaleureux: "🙂",
  dynamique: "🔥",
  premium: "✨",
};

const DEFAULT_CTA_BY_VERTICAL: Record<StudioVertical, string> = {
  garage: "Prenez rendez-vous à l'atelier",
  restaurant: "Réservez votre table",
  salon: "Prenez rendez-vous",
  artisan: "Demandez votre devis",
  agency: "Contactez-nous pour en discuter",
  cleaning: "Demandez votre devis",
  commerce: "Venez découvrir en boutique",
  realestate: "Demandez une visite",
  generic: "Contactez-nous",
};

/** Lignes de faits, construites uniquement à partir des champs réellement remplis. */
function factLines(input: StudioInput, offerType: OfferType): string[] {
  const lines: string[] = [];

  if (offerType === "bien") {
    const parts = [input.propertyType, input.rooms ? `${input.rooms} pièces` : null, input.bedrooms ? `${input.bedrooms} chambres` : null, input.surfaceM2 ? `${input.surfaceM2} m²` : null].filter(Boolean);
    if (parts.length > 0) lines.push(parts.join(", "));
    const location = [input.neighborhood, input.city].filter(Boolean).join(", ");
    if (location) lines.push(location);
    if (input.dpe) lines.push(`DPE : ${input.dpe}`);
  }

  if (offerType === "evenement") {
    if (input.eventDate) lines.push(`📅 ${input.eventDate}`);
    if (input.eventLocation) lines.push(`📍 ${input.eventLocation}`);
  }

  if (offerType === "promotion" && input.validUntil) {
    lines.push(`Offre valable jusqu'au ${input.validUntil}`);
  }

  if (input.price) lines.push(input.price);

  return lines;
}

function ctaText(input: StudioInput, vertical: StudioVertical): string {
  return input.callToAction?.trim() || DEFAULT_CTA_BY_VERTICAL[vertical];
}

export function generateStudioContent(params: {
  input: StudioInput;
  offerType: OfferType;
  vertical: StudioVertical;
  brandKit: BrandKit;
  companyName: string;
  city: string | null;
}): GeneratedContent {
  const { input, offerType, vertical, brandKit, companyName } = params;
  const facts = factLines(input, offerType);
  const cta = ctaText(input, vertical);
  const closing = TONE_CLOSING[brandKit.tone];
  const emoji = TONE_EMOJI[brandKit.tone];
  const highlightsLines = input.highlights.filter((h) => h.trim().length > 0);

  // --- Instagram : court, direct, émoji du ton, pas de blabla.
  const instagramParts = [
    `${emoji ? emoji + " " : ""}${input.title}`.trim(),
    ...facts,
    input.description,
    highlightsLines.length > 0 ? highlightsLines.map((h) => `• ${h}`).join("\n") : null,
    `👉 ${cta}`,
  ].filter((p): p is string => Boolean(p && p.trim()));
  const instagram = instagramParts.join("\n");

  // --- Facebook : un peu plus long, contexte de l'entreprise en tête.
  const facebookParts = [
    `${companyName} — ${input.title}`,
    ...facts,
    input.description,
    highlightsLines.length > 0 ? highlightsLines.map((h) => `✔ ${h}`).join("\n") : null,
    cta + ".",
    brandKit.tagline || null,
  ].filter((p): p is string => Boolean(p && p.trim()));
  const facebook = facebookParts.join("\n\n");

  // --- SMS : très court, un seul CTA, pas de mise en page.
  const smsFacts = facts.slice(0, 1).join(" — ");
  const sms = [`${companyName} : ${input.title}${smsFacts ? " (" + smsFacts + ")" : ""}.`, cta + "."].join(" ").slice(0, 300);

  // --- Email : objet + corps structuré.
  const emailSubject = input.title;
  const emailBodyParts = [
    `Bonjour,`,
    input.description,
    facts.length > 0 ? facts.join("\n") : null,
    highlightsLines.length > 0 ? highlightsLines.map((h) => `- ${h}`).join("\n") : null,
    `${cta}.`,
    closing,
    companyName,
  ].filter((p): p is string => Boolean(p && p.trim()));
  const email = { subject: emailSubject, body: emailBodyParts.join("\n\n") };

  // --- Site : bloc landing (titre + paragraphe + bouton), sans emoji.
  const siteBodyParts = [input.description, facts.length > 0 ? facts.join(" · ") : null, highlightsLines.length > 0 ? highlightsLines.join(" · ") : null].filter((p): p is string => Boolean(p && p.trim()));
  const site = { headline: input.title, body: siteBodyParts.join("\n\n"), cta };

  return { instagram, facebook, sms, email, site };
}
