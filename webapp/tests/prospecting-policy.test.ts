import { test } from "node:test";
import assert from "node:assert/strict";
import {
  findObjective,
  resolveProspectingObjectives,
  resolveObjectiveTargetSlugs,
  scoringProfileForObjective,
} from "../src/lib/prospecting/offer-catalog";
import {
  defaultWebFilter,
  filtersForObjective,
  matchesSearchCriteria,
  matchesWebsiteFilter,
} from "../src/lib/prospecting/search-policy";
import {
  DEFAULT_PROSPECTION_FILTERS,
  normalizeProspectionFilters,
} from "../src/lib/prospecting-config";
import { computeQualityScore } from "../../supabase/functions/_shared/scoring";
import { computeRelevance } from "../../supabase/functions/_shared/relevance";
import type { ProspectionResult } from "../src/components/prospection/result-card";

const objective = (slug: string, id: string) => {
  const result = findObjective(slug, null, id);
  assert.ok(result);
  return result;
};
const prospect: ProspectionResult = {
  siren: "111111111",
  siret: "11111111111111",
  companyName: "Hôtel Démo",
  nafCode: "55.10Z",
  street: null,
  postalCode: null,
  city: "Lille",
  lat: 50.63,
  lng: 3.06,
  etatAdministratif: "A",
  natureJuridique: null,
  effectifTranche: null,
  distanceKm: 4,
  isAssociation: false,
  isLargeGroup: false,
  isChain: false,
  placeId: "demo-place",
  businessStatus: "OPERATIONAL",
  websiteUri: null,
  websiteQuality: "none",
  verificationStatus: "NO_WEBSITE_CONFIRMED",
  phone: null,
  googleRating: null,
  googleRatingCount: null,
  placesCheckedAt: null,
  qualityScore: 0,
  verificationSources: {},
  relevanceScore: 70,
  relevanceTier: "primary",
  relevanceReasons: [],
};

test("creation, redesign and maintenance use different website defaults", () => {
  assert.equal(defaultWebFilter(objective("web", "web_creation")), "none");
  assert.equal(defaultWebFilter(objective("web", "web_refonte")), "weak");
  assert.equal(
    defaultWebFilter(objective("web", "web_maintenance")),
    "existing",
  );
});

test("unknown or failed Google lookups never count as no website", () => {
  assert.equal(
    matchesWebsiteFilter({ ...prospect, placeId: null }, "none"),
    false,
  );
  assert.equal(
    matchesWebsiteFilter(
      { ...prospect, placeId: null, websiteQuality: "unknown" },
      "none",
    ),
    false,
  );
  assert.equal(
    matchesWebsiteFilter(
      { ...prospect, websiteUri: "https://example.com" },
      "none",
    ),
    false,
  );
  assert.equal(matchesWebsiteFilter(prospect, "none"), true);
  assert.equal(
    matchesWebsiteFilter(
      {
        ...prospect,
        websiteUri: "https://example.com",
        websiteQuality: "unknown",
      },
      "existing",
    ),
    true,
  );
});

test("a saved digital filter cannot leak into cleaning or garage searches", () => {
  const digitalFilters = {
    ...DEFAULT_PROSPECTION_FILTERS,
    webFilter: "none" as const,
  };
  for (const [slug, id] of [
    ["cleaning", "cleaning_offices"],
    ["garages", "garage_fleet"],
  ]) {
    assert.equal(
      filtersForObjective(objective(slug, id), digitalFilters).webFilter,
      "all",
    );
  }
});

test("different offers actually resolve different target sectors", () => {
  const web = resolveObjectiveTargetSlugs(objective("web", "web_creation"));
  const cleaning = resolveObjectiveTargetSlugs(
    objective("cleaning", "cleaning_hotels"),
  );
  const fleet = resolveObjectiveTargetSlugs(
    objective("garages", "garage_fleet"),
  );
  assert.ok(web.includes("hair"));
  assert.ok(cleaning.includes("hotels"));
  assert.ok(!cleaning.includes("hair"));
  assert.ok(fleet.includes("transport"));
  assert.ok(!fleet.includes("garages"));
  assert.notDeepEqual(web, cleaning);
});

test("garage consumers are a management use case, not registry prospects", () => {
  const b2c = objective("garages", "garage_b2c");
  assert.equal(b2c.audience, "b2c");
  assert.deepEqual(resolveObjectiveTargetSlugs(b2c), []);
  assert.equal(findObjective("garages", null, "web_creation"), null);
  assert.ok(
    resolveProspectingObjectives(null, null).every((o) =>
      o.id.startsWith("generic_"),
    ),
  );
});

test("security is not given cleaning objectives", () => {
  assert.ok(
    resolveProspectingObjectives("security", null).every((o) =>
      o.id.startsWith("security_"),
    ),
  );
});

test("hotel remains a valid B2B cleaning buyer even though hotel customers are consumers", () => {
  const result = computeRelevance(
    "55.10Z",
    "b2b",
    new Map([["55.10Z", "b2c"]]),
    "contract_potential",
    "Hôtel Démo",
  );
  assert.equal(result.tier, "primary");
  assert.equal(result.reasons.length, 0);
});

test("name exclusions still downgrade imprecise sector matches", () => {
  assert.equal(
    computeRelevance(
      "45.20A",
      "b2b",
      new Map(),
      "contract_potential",
      "Grossiste Démo",
      new Map([["45.20A", ["grossiste"]]]),
    ).tier,
    "secondary",
  );
});

test("cleaning and fleet scores are independent of website quality", () => {
  for (const [slug, id] of [
    ["cleaning", "cleaning_offices"],
    ["garages", "garage_fleet"],
  ]) {
    const profile = scoringProfileForObjective(objective(slug, id));
    const absent = computeQualityScore(prospect, profile);
    const good = computeQualityScore(
      { ...prospect, websiteUri: "https://example.com", websiteQuality: "ok" },
      profile,
    );
    assert.equal(absent.score, good.score);
    assert.equal(absent.sources.no_website, undefined);
  }
});

test("strict zone, sector, closure and contact constraints survive an old search backend", () => {
  assert.equal(
    matchesSearchCriteria(
      prospect,
      ["55.10Z"],
      20,
      DEFAULT_PROSPECTION_FILTERS,
    ),
    true,
  );
  for (const changed of [
    { nafCode: "45.20A" },
    { distanceKm: 20.01 },
    { distanceKm: NaN },
    { etatAdministratif: "F" },
    { isChain: true },
  ]) {
    assert.equal(
      matchesSearchCriteria(
        { ...prospect, ...changed },
        ["55.10Z"],
        20,
        DEFAULT_PROSPECTION_FILTERS,
      ),
      false,
    );
  }
  assert.equal(
    matchesSearchCriteria(prospect, [], 20, DEFAULT_PROSPECTION_FILTERS),
    false,
  );
  assert.equal(
    matchesSearchCriteria(prospect, ["55.10Z"], 20, {
      ...DEFAULT_PROSPECTION_FILTERS,
      phoneOnly: true,
    }),
    false,
  );
});

test("legacy settings keep no implicit objective or activity; current settings round-trip", () => {
  const legacy = normalizeProspectionFilters({ webFilter: "invalid" });
  assert.equal(legacy.webFilter, "all");
  assert.equal(legacy.objectiveId, null);
  assert.equal(legacy.activityKey, null);
  const saved = {
    ...DEFAULT_PROSPECTION_FILTERS,
    webFilter: "existing" as const,
    objectiveId: "web_maintenance",
    activityKey: "web-category",
  };
  assert.deepEqual(normalizeProspectionFilters(saved), saved);
});

import { scoreBreakdown } from "../src/lib/score-breakdown";

test("CRM score explanations use the same profile weights as the search score", () => {
  for (const profile of ["digital_opportunity", "marketing_potential", "contract_potential", "b2b_commercial"] as const) {
    const row = { ...prospect, googleRatingCount: 20 };
    const scored = computeQualityScore(row, profile);
    const sum = scoreBreakdown(scored.sources, row.distanceKm).reduce((n, r) => n + r.points, 0);
    assert.equal(Math.max(0, Math.min(100, sum)), scored.score);
  }
});

test("an unknown website contributes no evidence points", () => {
  const scored = computeQualityScore({ ...prospect, placeId: null, websiteQuality: "unknown" }, "digital_opportunity");
  assert.equal(scoreBreakdown(scored.sources, prospect.distanceKm).find((r) => r.label === "Site non vérifiable")?.points, 0);
});
