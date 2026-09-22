"use client";

import { useMemo, useState, useTransition } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge, type BadgeTone } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { Select } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { OfferForm } from "@/components/studio/offer-form";
import { PhotoUploader } from "@/components/studio/photo-uploader";
import { ChannelPreview } from "@/components/studio/channel-preview";
import { createStudioCreation, regenerateStudioCreation, updateStudioCreationInput, updateStudioCreationStatus } from "@/lib/actions/studio";
import { generateStudioContent } from "@/lib/studio/generator";
import { EMPTY_STUDIO_INPUT, parseGeneratedContent, parseStudioInput, type BrandKit, type GeneratedContent, type OfferType, type StudioInput, type StudioStatus, type StudioVertical } from "@/lib/studio/types";
import { parsePhotos, photoPublicUrl } from "@/lib/studio/photos";
import { OFFER_TYPE_LABEL, STUDIO_VERTICAL_LABEL, offerTypesForVertical } from "@/lib/studio/vertical";
import type { Database } from "@/lib/supabase/types";

type CreationRow = Database["public"]["Tables"]["studio_creations"]["Row"];

const STATUS_TABS: { key: StudioStatus; label: string }[] = [
  { key: "draft", label: "Brouillons" },
  { key: "ready", label: "Prêts" },
  { key: "published", label: "Publiés" },
  { key: "archived", label: "Archivés" },
];

const STATUS_BADGE: Record<StudioStatus, { text: string; tone: BadgeTone }> = {
  draft: { text: "Brouillon", tone: "neutral" },
  ready: { text: "Prêt", tone: "accent" },
  published: { text: "Publié", tone: "success" },
  archived: { text: "Archivé", tone: "neutral" },
};

const CHANNEL_TABS = [
  { key: "instagram", label: "Instagram" },
  { key: "facebook", label: "Facebook" },
  { key: "email", label: "Email" },
  { key: "site", label: "Site" },
  { key: "sms", label: "SMS" },
] as const;

function channelText(content: GeneratedContent, channel: (typeof CHANNEL_TABS)[number]["key"]): string {
  if (channel === "email") return `Objet : ${content.email.subject}\n\n${content.email.body}`;
  if (channel === "site") return `${content.site.headline}\n\n${content.site.body}\n\n[${content.site.cta}]`;
  return content[channel];
}

type ViewMode = "library" | "form" | "preview";

export interface StudioPrefill {
  title: string;
  description: string;
  sourceMissionId: string | null;
}

export function StudioView({
  workspaceId,
  vertical,
  initialCreations,
  brandKit,
  prefill,
  companyName,
  city,
}: {
  workspaceId: string;
  vertical: StudioVertical;
  initialCreations: CreationRow[];
  brandKit: BrandKit;
  prefill?: StudioPrefill | null;
  companyName: string;
  city: string | null;
}) {
  const [creations, setCreations] = useState<CreationRow[]>(initialCreations);
  const [mode, setMode] = useState<ViewMode>(prefill ? "form" : "library");
  const [statusFilter, setStatusFilter] = useState<StudioStatus>("draft");
  const [activeId, setActiveId] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [copiedChannel, setCopiedChannel] = useState<string | null>(null);
  const [activeChannel, setActiveChannel] = useState<(typeof CHANNEL_TABS)[number]["key"]>("instagram");
  const [editing, setEditing] = useState(false);
  const [prefillSourceMissionId] = useState<string | null>(prefill?.sourceMissionId ?? null);

  const availableOfferTypes = useMemo(() => offerTypesForVertical(vertical), [vertical]);
  const [formOfferType, setFormOfferType] = useState<OfferType>(prefill ? "promotion" : availableOfferTypes[0]);
  const [formInput, setFormInput] = useState<StudioInput>(
    prefill ? { ...EMPTY_STUDIO_INPUT, title: prefill.title, description: prefill.description } : EMPTY_STUDIO_INPUT,
  );

  const active = creations.find((c) => c.id === activeId) ?? null;
  const activeContent = active ? parseGeneratedContent(active.generated_content) : null;
  const activePhotos = active ? parsePhotos(active.photos) : [];
  const activePrimaryPhotoUrl = activePhotos.length > 0 ? photoPublicUrl(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "", activePhotos[0].path) : null;
  const [editInput, setEditInput] = useState<StudioInput>(EMPTY_STUDIO_INPUT);

  // Preview live — recalculée à chaque frappe côté client avec le même
  // générateur que le serveur (aucune donnée de plus, aucun appel réseau) :
  // ce que l'utilisateur voit pendant qu'il remplit le formulaire est
  // EXACTEMENT ce qui sera généré au clic sur "Générer le contenu".
  const liveContent = useMemo(
    () => generateStudioContent({ input: formInput, offerType: formOfferType, vertical, brandKit, companyName, city }),
    [formInput, formOfferType, vertical, brandKit, companyName, city],
  );
  const [formActiveChannel, setFormActiveChannel] = useState<(typeof CHANNEL_TABS)[number]["key"]>("instagram");

  const filtered = creations.filter((c) => c.status === statusFilter);

  function openNewForm() {
    setFormOfferType(availableOfferTypes[0]);
    setFormInput(EMPTY_STUDIO_INPUT);
    setError(null);
    setMode("form");
  }

  function submitNewCreation() {
    setError(null);
    startTransition(async () => {
      const result = await createStudioCreation(workspaceId, { vertical, offerType: formOfferType, input: formInput, sourceMissionId: prefillSourceMissionId });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      const newRow: CreationRow = {
        id: result.id,
        workspace_id: workspaceId,
        vertical,
        offer_type: formOfferType,
        title: formInput.title.trim(),
        input_data: formInput as unknown as Record<string, unknown>,
        generated_content: result.content as unknown as Record<string, unknown>,
        photos: [],
        status: "draft",
        source_mission_id: prefillSourceMissionId,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      setCreations((prev) => [newRow, ...prev]);
      setActiveId(result.id);
      setActiveChannel("instagram");
      setMode("preview");
    });
  }

  function openPreview(id: string) {
    setActiveId(id);
    setActiveChannel("instagram");
    setEditing(false);
    setError(null);
    setMode("preview");
  }

  function startEditing() {
    if (!active) return;
    setEditInput(parseStudioInput(active.input_data));
    setEditing(true);
  }

  function saveEdits() {
    if (!active) return;
    setError(null);
    startTransition(async () => {
      const result = await updateStudioCreationInput(workspaceId, active.id, { title: editInput.title, input: editInput });
      if (!result.ok) {
        setError(result.error ?? "Échec de l'enregistrement.");
        return;
      }
      setCreations((prev) => prev.map((c) => (c.id === active.id ? { ...c, title: editInput.title.trim(), input_data: editInput as unknown as Record<string, unknown> } : c)));
      setEditing(false);
    });
  }

  function regenerate() {
    if (!active) return;
    setError(null);
    startTransition(async () => {
      const result = await regenerateStudioCreation(workspaceId, active.id);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setCreations((prev) => prev.map((c) => (c.id === active.id ? { ...c, generated_content: result.content as unknown as Record<string, unknown> } : c)));
    });
  }

  function setStatus(status: StudioStatus) {
    if (!active) return;
    startTransition(async () => {
      const result = await updateStudioCreationStatus(workspaceId, active.id, status);
      if (!result.ok) {
        setError(result.error ?? "Échec.");
        return;
      }
      setCreations((prev) => prev.map((c) => (c.id === active.id ? { ...c, status } : c)));
    });
  }

  async function copyChannel() {
    if (!activeContent) return;
    const text = channelText(activeContent, activeChannel);
    try {
      await navigator.clipboard.writeText(text);
      setCopiedChannel(activeChannel);
      setTimeout(() => setCopiedChannel(null), 1500);
    } catch {
      setError("Impossible de copier — copiez le texte manuellement.");
    }
  }

  if (mode === "form") {
    return (
      <div className="flex flex-col gap-5">
        <div className="flex items-center justify-between">
          <h1 className="font-display text-2xl font-extrabold">Nouvelle création</h1>
          <Button variant="ghost" onClick={() => setMode("library")}>
            Annuler
          </Button>
        </div>
        <div className="grid gap-5 lg:grid-cols-2 lg:items-start">
          <Card>
            <h2 className="font-display text-sm font-bold">1. Informations</h2>
            <div className="mt-3 flex flex-col gap-3">
              {prefillSourceMissionId && (
                <p className="rounded-lg bg-accent/10 px-3 py-2 text-[11.5px] font-medium text-accent">
                  🧭 Pré-rempli depuis une action de votre mission Business Twin — vérifiez et complétez avant de générer.
                </p>
              )}
              <div>
                <Label htmlFor="studio-offer-type">Type d&apos;offre</Label>
                <Select id="studio-offer-type" value={formOfferType} onChange={(e) => setFormOfferType(e.target.value as OfferType)} className="mt-1 w-full">
                  {availableOfferTypes.map((t) => (
                    <option key={t} value={t}>
                      {OFFER_TYPE_LABEL[t]}
                    </option>
                  ))}
                </Select>
                <p className="mt-1 text-[11px] text-faint">
                  Verticale détectée : {STUDIO_VERTICAL_LABEL[vertical]} — les types d&apos;offre proposés sont adaptés à votre métier.
                </p>
              </div>
              <OfferForm offerType={formOfferType} value={formInput} onChange={setFormInput} />
              {error && <p className="text-[12px] font-medium text-red-fg">{error}</p>}
              <Button onClick={submitNewCreation} disabled={pending || !formInput.title.trim()}>
                {pending ? "Génération…" : "Générer le contenu"}
              </Button>
              <p className="text-[10.5px] text-faint">Les photos s&apos;ajoutent à l&apos;étape suivante, une fois la création enregistrée.</p>
            </div>
          </Card>

          <Card className="lg:sticky lg:top-20">
            <h2 className="font-display text-sm font-bold">2. Aperçu en direct</h2>
            <div className="mt-3 flex flex-wrap gap-1.5 border-b border-line pb-3">
              {CHANNEL_TABS.map((c) => (
                <button
                  key={c.key}
                  type="button"
                  onClick={() => setFormActiveChannel(c.key)}
                  className={cn(
                    "rounded-lg px-3 py-1.5 text-[12px] font-semibold",
                    formActiveChannel === c.key ? "bg-ink text-bg" : "bg-soft text-muted hover:text-ink",
                  )}
                >
                  {c.label}
                </button>
              ))}
            </div>
            <div className="mt-4">
              {formInput.title.trim() ? (
                <ChannelPreview channel={formActiveChannel} content={liveContent} companyName={companyName} photoUrl={null} />
              ) : (
                <p className="py-10 text-center text-[12.5px] text-faint">Commencez à remplir le titre pour voir l&apos;aperçu.</p>
              )}
            </div>
          </Card>
        </div>
      </div>
    );
  }

  if (mode === "preview" && active && activeContent) {
    return (
      <div className="flex flex-col gap-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="font-display text-2xl font-extrabold">{active.title}</h1>
            <p className="mt-1 text-[12.5px] text-muted">
              {OFFER_TYPE_LABEL[active.offer_type]} — {STUDIO_VERTICAL_LABEL[active.vertical as StudioVertical] ?? active.vertical}
            </p>
          </div>
          <Button variant="ghost" onClick={() => setMode("library")}>
            ← Bibliothèque
          </Button>
        </div>

        {error && <p className="text-[12px] font-medium text-red-fg">{error}</p>}

        {!editing && (
          <Card>
            <h2 className="font-display text-sm font-bold">Photos</h2>
            <p className="mt-1 text-[11.5px] text-muted">
              La première photo est utilisée comme photo principale dans les aperçus Instagram/Facebook/Site.
            </p>
            <div className="mt-3">
              <PhotoUploader
                workspaceId={workspaceId}
                creationId={active.id}
                photos={parsePhotos(active.photos)}
                photoUrl={(path) => photoPublicUrl(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "", path)}
                onPhotosChange={(photos) => setCreations((prev) => prev.map((c) => (c.id === active.id ? { ...c, photos } : c)))}
              />
            </div>
          </Card>
        )}

        {editing ? (
          <Card>
            <h2 className="font-display text-sm font-bold">Modifier les champs</h2>
            <div className="mt-3">
              <OfferForm offerType={active.offer_type} value={editInput} onChange={setEditInput} />
            </div>
            <div className="mt-4 flex gap-2">
              <Button onClick={saveEdits} disabled={pending}>
                {pending ? "Enregistrement…" : "Sauvegarder"}
              </Button>
              <Button variant="ghost" onClick={() => setEditing(false)} disabled={pending}>
                Annuler
              </Button>
            </div>
            <p className="mt-2 text-[11px] text-faint">Sauvegarder met à jour les champs — cliquez ensuite sur « Régénérer » pour recalculer le contenu à partir des nouveaux champs.</p>
          </Card>
        ) : (
          <Card>
            <div className="flex flex-wrap gap-1.5 border-b border-line pb-3">
              {CHANNEL_TABS.map((c) => (
                <button
                  key={c.key}
                  type="button"
                  onClick={() => setActiveChannel(c.key)}
                  className={cn(
                    "rounded-lg px-3 py-1.5 text-[12.5px] font-semibold",
                    activeChannel === c.key ? "bg-ink text-bg" : "bg-soft text-muted hover:text-ink",
                  )}
                >
                  {c.label}
                </button>
              ))}
            </div>
            <div className="mt-4 grid gap-4 lg:grid-cols-2 lg:items-start">
              <div>
                <p className="mb-2 text-[10.5px] font-bold uppercase tracking-wider text-faint">Aperçu</p>
                <ChannelPreview channel={activeChannel} content={activeContent} companyName={companyName} photoUrl={activePrimaryPhotoUrl} />
              </div>
              <div>
                <p className="mb-2 text-[10.5px] font-bold uppercase tracking-wider text-faint">Texte à copier</p>
                <pre className="whitespace-pre-wrap break-words rounded-lg bg-soft p-3.5 font-sans text-[13px] leading-relaxed text-ink">
                  {channelText(activeContent, activeChannel)}
                </pre>
              </div>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <Button size="sm" onClick={copyChannel}>
                {copiedChannel === activeChannel ? "Copié ✓" : "Copier"}
              </Button>
              <Button size="sm" variant="ghost" onClick={startEditing}>
                Modifier
              </Button>
              <Button size="sm" variant="ghost" onClick={regenerate} disabled={pending}>
                {pending ? "Régénération…" : "Régénérer"}
              </Button>
            </div>
          </Card>
        )}

        <Card>
          <h2 className="font-display text-sm font-bold">Statut</h2>
          <p className="mt-1 text-[11.5px] text-muted">
            « Publié » est une case que vous cochez vous-même une fois postée ailleurs — ProspectFlow ne publie rien automatiquement sur vos réseaux.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {STATUS_TABS.map((s) => (
              <Button key={s.key} size="sm" variant={active.status === s.key ? "primary" : "ghost"} onClick={() => setStatus(s.key)} disabled={pending}>
                {STATUS_BADGE[s.key].text}
              </Button>
            ))}
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-extrabold">Studio IA</h1>
          <p className="mt-1 text-[13px] text-muted">
            Transformez une offre en contenu prêt à publier, adapté à {STUDIO_VERTICAL_LABEL[vertical]} — jamais de caractéristique inventée, votre Brand Kit ({brandKit.tone}) est déjà appliqué.
          </p>
        </div>
        <Button onClick={openNewForm}>+ Nouvelle création</Button>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {STATUS_TABS.map((tab) => {
          const count = creations.filter((c) => c.status === tab.key).length;
          return (
            <button
              key={tab.key}
              type="button"
              onClick={() => setStatusFilter(tab.key)}
              className={cn(
                "rounded-lg px-3 py-1.5 text-[12.5px] font-semibold",
                statusFilter === tab.key ? "bg-ink text-bg" : "bg-soft text-muted hover:text-ink",
              )}
            >
              {tab.label} {count > 0 && <span className="opacity-60">({count})</span>}
            </button>
          );
        })}
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon="🎨"
          title={statusFilter === "draft" ? "Aucun brouillon pour l'instant" : `Aucune création ${STATUS_TABS.find((s) => s.key === statusFilter)?.label.toLowerCase()}`}
          description="Créez votre première campagne à partir d'un produit, service, bien, réalisation, événement ou promotion."
          action={<Button onClick={openNewForm}>+ Nouvelle création</Button>}
        />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((c) => (
            <Card key={c.id} interactive className="flex animate-fade-up flex-col gap-2" onClick={() => openPreview(c.id)}>
              <div className="flex items-start justify-between gap-2">
                <p className="font-display text-[14px] font-extrabold leading-tight">{c.title}</p>
                <Badge tone={STATUS_BADGE[c.status as StudioStatus].tone}>{STATUS_BADGE[c.status as StudioStatus].text}</Badge>
              </div>
              <p className="text-[11.5px] text-muted">{OFFER_TYPE_LABEL[c.offer_type]}</p>
              <p className="mt-auto text-[10.5px] text-faint">Modifié le {new Date(c.updated_at).toLocaleDateString("fr-FR")}</p>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
