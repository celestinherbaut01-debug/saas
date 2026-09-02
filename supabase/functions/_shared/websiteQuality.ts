export type WebsiteQuality = "none" | "weak" | "ok" | "unknown";

/**
 * Analyse sommaire de la qualité d'un site déjà confirmé par Google Places.
 * On ne cherche pas à juger le design, juste à repérer les signaux forts
 * d'un site à l'abandon ou non responsive — ce qui rend le prospect
 * intéressant pour une offre de refonte.
 */
export async function analyseWebsiteQuality(
  websiteUri: string | null,
): Promise<WebsiteQuality> {
  if (!websiteUri) return "none";

  try {
    const res = await fetch(websiteUri, {
      redirect: "follow",
      signal: AbortSignal.timeout(6000),
      headers: {
        "User-Agent":
          "Mozilla/5.0 (compatible; ProspectFlowBot/1.0; +https://prospectflow.example/bot)",
      },
    });

    if (!res.ok || res.status >= 400) return "weak";

    const html = await res.text().catch(() => "");
    if (html.length < 400) return "weak";

    const isHttps = res.url.startsWith("https://");
    const hasViewport = /<meta[^>]+name=["']viewport["']/i.test(html);

    if (isHttps && hasViewport) return "ok";
    return "weak";
  } catch {
    // Timeout, DNS mort, certificat invalide... le site est probablement
    // à l'abandon, mais on ne l'affirme pas sans confirmation supplémentaire.
    return "unknown";
  }
}
