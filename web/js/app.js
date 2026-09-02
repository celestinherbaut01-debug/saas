import { supabase } from "./supabaseClient.js";
import { categories, categoriesByGroup, nafCodesForSelection, businessTypes } from "./categories.js";
import { geocodeAddress, geolocateBrowser } from "./geocode.js";

const q = (s) => document.querySelector(s);
const qa = (s) => [...document.querySelectorAll(s)];
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

function toast(text) {
  const el = q("#toast");
  el.textContent = text;
  el.classList.add("show");
  setTimeout(() => el.classList.remove("show"), 2200);
}

// ---------------------------------------------------------------------------
// Auth guard
// ---------------------------------------------------------------------------
const { data: sessionData } = await supabase.auth.getSession();
if (!sessionData.session) {
  window.location.href = "index.html";
}
const user = sessionData.session.user;
q("#userEmail").textContent = user.email;

q("#logoutBtn").addEventListener("click", async () => {
  await supabase.auth.signOut();
  window.location.href = "index.html";
});

supabase.auth.onAuthStateChange((_event, session) => {
  if (!session) window.location.href = "index.html";
});

// ---------------------------------------------------------------------------
// Navigation
// ---------------------------------------------------------------------------
const viewLabels = { search: "Prospection", crm: "CRM", settings: "Paramètres" };
function go(view) {
  qa(".view").forEach((v) => v.classList.remove("active"));
  q(`#view-${view}`)?.classList.add("active");
  qa(".navbtn").forEach((b) => b.classList.toggle("active", b.dataset.view === view));
  q("#crumb").textContent = viewLabels[view] || view;
  if (view === "crm") loadCrm();
}
qa(".navbtn").forEach((b) => (b.onclick = () => go(b.dataset.view)));

// ---------------------------------------------------------------------------
// Catégories (sélection des métiers ciblés)
// ---------------------------------------------------------------------------
const selectedCategoryIds = new Set();

function renderCatGrid() {
  const groups = categoriesByGroup();
  let html = "";
  for (const [group, cats] of groups) {
    html += `<div class="grouphead">${esc(group)}</div>`;
    for (const c of cats) {
      html += `<button class="cat${selectedCategoryIds.has(c.id) ? " active" : ""}" data-id="${c.id}">${c.icon} ${esc(c.name)}</button>`;
    }
  }
  q("#catGrid").innerHTML = html;
  qa(".cat").forEach((btn) => {
    btn.onclick = () => {
      const id = btn.dataset.id;
      selectedCategoryIds.has(id) ? selectedCategoryIds.delete(id) : selectedCategoryIds.add(id);
      renderCatGrid();
      renderSelectedChips();
    };
  });
}

function renderSelectedChips() {
  q("#targetCount").textContent = `${selectedCategoryIds.size} sélectionnée(s)`;
  q("#selectedCats").innerHTML = [...selectedCategoryIds]
    .map((id) => categories.find((c) => c.id === id))
    .filter(Boolean)
    .map((c) => `<span class="chip active">${c.icon} ${esc(c.name)}</span>`)
    .join("");
}

renderCatGrid();
renderSelectedChips();

// ---------------------------------------------------------------------------
// Adresse / géocodage
// ---------------------------------------------------------------------------
let validatedGeo = null; // { lat, lng, label }

q("#radius").addEventListener("input", () => (q("#radiusNum").value = q("#radius").value));
q("#radiusNum").addEventListener("input", () => {
  const v = Math.max(0.5, Math.min(250, +q("#radiusNum").value || 0.5));
  q("#radius").value = v;
  q("#radiusNum").value = v;
});

["street", "postal", "city"].forEach((id) =>
  q(`#${id}`).addEventListener("input", () => {
    validatedGeo = null;
    q("#geoStatus").className = "hint";
    q("#geoStatus").textContent = "Adresse modifiée — revalidez avant de rechercher.";
  }),
);

q("#verifyAddress").addEventListener("click", async () => {
  const geoBox = q("#geoStatus");
  geoBox.className = "hint";
  geoBox.textContent = "Géocodage en cours…";
  try {
    const result = await geocodeAddress({
      street: q("#street").value,
      postalCode: q("#postal").value,
      city: q("#city").value,
    });
    validatedGeo = result;
    geoBox.className = "success";
    geoBox.textContent = `✓ ${result.label} (confiance ${(result.score * 100).toFixed(0)}%)`;
  } catch (err) {
    validatedGeo = null;
    geoBox.className = "danger";
    geoBox.textContent = err.message;
  }
});

q("#useLocation").addEventListener("click", async () => {
  const geoBox = q("#geoStatus");
  geoBox.className = "hint";
  geoBox.textContent = "Localisation en cours…";
  try {
    const { lat, lng } = await geolocateBrowser();
    validatedGeo = { lat, lng, label: "Votre position GPS actuelle" };
    geoBox.className = "success";
    geoBox.textContent = "✓ Position GPS actuelle validée.";
  } catch (err) {
    geoBox.className = "danger";
    geoBox.textContent = err.message;
  }
});

// ---------------------------------------------------------------------------
// Recherche (appel de l'Edge Function search-prospects)
// ---------------------------------------------------------------------------
let lastResults = [];

function currentFilters() {
  return {
    operationalOnly: q("#operationalOnly").checked,
    excludeTempClosed: q("#excludeTempClosed").checked,
    excludeChains: q("#excludeChains").checked,
    excludeAssociations: q("#excludeAssociations").checked,
    excludeLargeGroups: q("#excludeLargeGroups").checked,
    needContact: q("#needContact").checked,
    maxEstablishmentsPerSiren: +q("#maxEstablishments").value || 8,
    webFilter: q("#webFilter").value,
  };
}

const businessStatusLabel = {
  OPERATIONAL: '<span class="tag green">Opérationnel</span>',
  CLOSED_TEMPORARILY: '<span class="tag amber">Fermé temp.</span>',
  CLOSED_PERMANENTLY: '<span class="tag red">Fermé définitivement</span>',
  unverified: '<span class="tag">À vérifier</span>',
};
const websiteQualityLabel = {
  none: '<span class="tag green">Sans site confirmé</span>',
  weak: '<span class="tag amber">Site à améliorer</span>',
  ok: '<span class="tag">Site correct</span>',
  unknown: '<span class="tag">À vérifier</span>',
};

function renderResults() {
  const wrap = q("#resultsWrap");
  q("#resultCount").textContent = lastResults.length
    ? `${lastResults.length} établissement(s) vérifié(s).`
    : "Aucun résultat.";
  q("#addSelectedBtn").style.display = lastResults.length ? "inline-flex" : "none";

  if (!lastResults.length) {
    wrap.innerHTML = `<div class="empty"><strong>Aucun résultat</strong>Lancez une recherche avec une adresse validée.</div>`;
    return;
  }

  wrap.innerHTML = `<div class="tablewrap"><table class="table">
    <thead><tr><th></th><th>Entreprise</th><th>Distance</th><th>Statut</th><th>Site</th><th>Contact</th><th>Score</th></tr></thead>
    <tbody>${lastResults
      .map(
        (r, i) => `<tr>
      <td><input type="checkbox" class="resultCheck" data-i="${i}"></td>
      <td><div class="co">${esc(r.companyName)}</div><div class="sub">${esc([r.street, r.postalCode, r.city].filter(Boolean).join(" "))}</div></td>
      <td>${r.distanceKm.toFixed(1)} km</td>
      <td>${businessStatusLabel[r.businessStatus] || businessStatusLabel.unverified}</td>
      <td>${websiteQualityLabel[r.websiteQuality] || websiteQualityLabel.unknown}</td>
      <td class="tiny">${esc(r.phone || "—")}</td>
      <td><div class="score">${r.qualityScore}</div></td>
    </tr>`,
      )
      .join("")}</tbody>
  </table></div>`;
}

q("#searchBtn").addEventListener("click", async () => {
  const statusBox = q("#searchStatus");
  statusBox.className = "statusBox show info";

  if (!validatedGeo) {
    statusBox.className = "statusBox show err";
    statusBox.textContent = "Validez d'abord l'adresse de départ (étape 2).";
    return;
  }
  if (selectedCategoryIds.size === 0) {
    statusBox.className = "statusBox show err";
    statusBox.textContent = "Sélectionnez au moins un métier à démarcher (étape 1).";
    return;
  }

  const btn = q("#searchBtn");
  btn.disabled = true;
  statusBox.textContent = "Recherche en cours — registre officiel, Google Places, analyse des sites…";

  try {
    const { data, error } = await supabase.functions.invoke("search-prospects", {
      body: {
        lat: validatedGeo.lat,
        lng: validatedGeo.lng,
        radiusKm: +q("#radiusNum").value,
        nafCodes: nafCodesForSelection(selectedCategoryIds),
        filters: currentFilters(),
      },
    });
    if (error) throw error;
    if (data.error) throw new Error(data.error);

    lastResults = data.results;
    statusBox.className = "statusBox show ok";
    statusBox.textContent = `${data.totalMatchedInRegistry} établissement(s) trouvé(s) dans le registre, ${data.verifiedCount} vérifié(s)${
      data.googlePlacesConfigured ? "." : " — clé Google Places non configurée : statuts affichés en \"à vérifier\"."
    }`;
    renderResults();
  } catch (err) {
    statusBox.className = "statusBox show err";
    statusBox.textContent = `Erreur : ${err.message}`;
  } finally {
    btn.disabled = false;
  }
});

q("#addSelectedBtn").addEventListener("click", async () => {
  const checked = qa(".resultCheck:checked").map((c) => lastResults[+c.dataset.i]);
  if (checked.length === 0) return toast("Cochez au moins un résultat.");

  const rows = checked.map((r) => ({
    user_id: user.id,
    siren: r.siren,
    siret: r.siret,
    company_name: r.companyName,
    naf_code: r.nafCode,
    street: r.street,
    postal_code: r.postalCode,
    city: r.city,
    lat: r.lat,
    lng: r.lng,
    distance_km: r.distanceKm,
    legal_status: r.etatAdministratif === "A" ? "active" : "closed",
    nature_juridique: r.natureJuridique,
    effectif_tranche: r.effectifTranche,
    is_association: r.isAssociation,
    is_large_group: r.isLargeGroup,
    is_chain: r.isChain,
    place_id: r.placeId,
    business_status: r.businessStatus,
    website_uri: r.websiteUri,
    website_quality: r.websiteQuality,
    phone: r.phone,
    google_rating: r.googleRating,
    google_rating_count: r.googleRatingCount,
    places_checked_at: r.placesCheckedAt,
    quality_score: r.qualityScore,
    verification_sources: r.verificationSources,
  }));

  const { error } = await supabase.from("prospects").upsert(rows, { onConflict: "user_id,siret" });
  if (error) return toast(`Erreur : ${error.message}`);
  toast(`${rows.length} prospect(s) ajouté(s) au CRM.`);
  refreshCrmCount();
});

// ---------------------------------------------------------------------------
// CRM
// ---------------------------------------------------------------------------
const statusOptions = [
  ["new", "Nouveau"],
  ["to_contact", "À contacter"],
  ["contacted", "Contacté"],
  ["replied", "A répondu"],
  ["won", "Gagné"],
  ["lost", "Perdu"],
];

async function refreshCrmCount() {
  const { count } = await supabase.from("prospects").select("id", { count: "exact", head: true });
  q("#navCrmCount").textContent = count ?? 0;
}

async function loadCrm() {
  const wrap = q("#crmWrap");
  wrap.innerHTML = `<div class="hint">Chargement…</div>`;

  const { data, error } = await supabase
    .from("prospects")
    .select("*")
    .order("quality_score", { ascending: false });

  if (error) {
    wrap.innerHTML = `<div class="danger">Erreur : ${esc(error.message)}</div>`;
    return;
  }

  q("#navCrmCount").textContent = data.length;

  if (data.length === 0) {
    wrap.innerHTML = `<div class="empty"><strong>CRM vide</strong>Ajoutez des prospects depuis l'onglet Prospection.</div>`;
    return;
  }

  wrap.innerHTML = `<div class="tablewrap"><table class="table">
    <thead><tr><th>Entreprise</th><th>Distance</th><th>Statut Google</th><th>Site</th><th>Score</th><th>Étape CRM</th></tr></thead>
    <tbody>${data
      .map(
        (p) => `<tr>
      <td><div class="co">${esc(p.company_name)}</div><div class="sub">${esc([p.street, p.postal_code, p.city].filter(Boolean).join(" "))}</div></td>
      <td>${p.distance_km ? p.distance_km.toFixed(1) + " km" : "—"}</td>
      <td>${businessStatusLabel[p.business_status] || businessStatusLabel.unverified}</td>
      <td>${websiteQualityLabel[p.website_quality] || websiteQualityLabel.unknown}</td>
      <td><div class="score">${p.quality_score}</div></td>
      <td><select class="crmStatus" data-id="${p.id}">${statusOptions
          .map(([v, l]) => `<option value="${v}" ${p.status === v ? "selected" : ""}>${l}</option>`)
          .join("")}</select></td>
    </tr>`,
      )
      .join("")}</tbody>
  </table></div>`;

  qa(".crmStatus").forEach((sel) => {
    sel.addEventListener("change", async () => {
      const { error } = await supabase
        .from("prospects")
        .update({ status: sel.value })
        .eq("id", sel.dataset.id);
      if (error) toast(`Erreur : ${error.message}`);
      else toast("Statut mis à jour.");
    });
  });
}

// ---------------------------------------------------------------------------
// Paramètres
// ---------------------------------------------------------------------------
q("#setBusinessType").innerHTML = businessTypes
  .map(([v, l]) => `<option value="${v}">${esc(l)}</option>`)
  .join("");

async function loadSettings() {
  const { data, error } = await supabase.from("profiles").select("*").eq("id", user.id).maybeSingle();
  if (error || !data) return;
  q("#setCompany").value = data.company || "";
  q("#setBusinessType").value = data.business_type || "generic";
  q("#setActivity").value = data.activity || "";
  q("#setOffer").value = data.offer || "";
  q("#setStreet").value = data.street || "";
  q("#setPostal").value = data.postal_code || "";
  q("#setCity").value = data.city || "";
  q("#setRadius").value = data.default_radius_km ?? 20;
}

q("#saveSettings").addEventListener("click", async () => {
  const payload = {
    company: q("#setCompany").value,
    business_type: q("#setBusinessType").value,
    activity: q("#setActivity").value,
    offer: q("#setOffer").value,
    street: q("#setStreet").value,
    postal_code: q("#setPostal").value,
    city: q("#setCity").value,
    default_radius_km: +q("#setRadius").value || 20,
  };
  const { error } = await supabase.from("profiles").update(payload).eq("id", user.id);
  const box = q("#settingsStatus");
  if (error) {
    box.innerHTML = `<div class="danger">Erreur : ${esc(error.message)}</div>`;
  } else {
    box.innerHTML = `<div class="success">Enregistré.</div>`;
    toast("Paramètres enregistrés.");
  }
});

// ---------------------------------------------------------------------------
// Bootstrap
// ---------------------------------------------------------------------------
loadSettings();
refreshCrmCount();
