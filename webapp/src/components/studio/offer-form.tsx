import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/select";
import type { OfferType, StudioInput } from "@/lib/studio/types";

/**
 * Formulaire de saisie des champs d'une création — les mêmes champs servent
 * à la fois à la création et à la modification (voir StudioView). Aucun
 * champ n'est pré-rempli automatiquement au-delà de ce que l'utilisateur
 * tape : le générateur (lib/studio/generator.ts) ne compose QUE ce qui est
 * saisi ici.
 */
export function OfferForm({
  offerType,
  value,
  onChange,
}: {
  offerType: OfferType;
  value: StudioInput;
  onChange: (next: StudioInput) => void;
}) {
  function set<K extends keyof StudioInput>(key: K, v: StudioInput[K]) {
    onChange({ ...value, [key]: v });
  }

  return (
    <div className="flex flex-col gap-3">
      <div>
        <Label htmlFor="studio-title">Titre *</Label>
        <Input
          id="studio-title"
          value={value.title}
          onChange={(e) => set("title", e.target.value)}
          placeholder={offerType === "bien" ? "Ex. Maison familiale avec jardin" : "Ex. Vidange + révision complète"}
        />
      </div>

      <div>
        <Label htmlFor="studio-description">Description</Label>
        <Textarea id="studio-description" rows={3} value={value.description} onChange={(e) => set("description", e.target.value)} />
      </div>

      {offerType === "bien" && (
        <div className="grid gap-2.5 sm:grid-cols-2">
          <div>
            <Label htmlFor="studio-property-type">Type de bien</Label>
            <Input id="studio-property-type" value={value.propertyType ?? ""} onChange={(e) => set("propertyType", e.target.value || null)} placeholder="Maison, appartement, terrain…" />
          </div>
          <div>
            <Label htmlFor="studio-surface">Surface (m²)</Label>
            <Input id="studio-surface" type="number" value={value.surfaceM2 ?? ""} onChange={(e) => set("surfaceM2", e.target.value ? Number(e.target.value) : null)} />
          </div>
          <div>
            <Label htmlFor="studio-rooms">Pièces</Label>
            <Input id="studio-rooms" type="number" value={value.rooms ?? ""} onChange={(e) => set("rooms", e.target.value ? Number(e.target.value) : null)} />
          </div>
          <div>
            <Label htmlFor="studio-bedrooms">Chambres</Label>
            <Input id="studio-bedrooms" type="number" value={value.bedrooms ?? ""} onChange={(e) => set("bedrooms", e.target.value ? Number(e.target.value) : null)} />
          </div>
          <div>
            <Label htmlFor="studio-city">Ville</Label>
            <Input id="studio-city" value={value.city ?? ""} onChange={(e) => set("city", e.target.value || null)} />
          </div>
          <div>
            <Label htmlFor="studio-neighborhood">Quartier</Label>
            <Input id="studio-neighborhood" value={value.neighborhood ?? ""} onChange={(e) => set("neighborhood", e.target.value || null)} />
          </div>
          <div>
            <Label htmlFor="studio-dpe">DPE (optionnel)</Label>
            <Input id="studio-dpe" value={value.dpe ?? ""} onChange={(e) => set("dpe", e.target.value || null)} placeholder="A à G" maxLength={1} />
          </div>
        </div>
      )}

      {offerType === "evenement" && (
        <div className="grid gap-2.5 sm:grid-cols-2">
          <div>
            <Label htmlFor="studio-event-date">Date</Label>
            <Input id="studio-event-date" value={value.eventDate ?? ""} onChange={(e) => set("eventDate", e.target.value || null)} placeholder="Ex. Samedi 12 octobre, 19h" />
          </div>
          <div>
            <Label htmlFor="studio-event-location">Lieu</Label>
            <Input id="studio-event-location" value={value.eventLocation ?? ""} onChange={(e) => set("eventLocation", e.target.value || null)} />
          </div>
        </div>
      )}

      {offerType === "promotion" && (
        <div>
          <Label htmlFor="studio-valid-until">Offre valable jusqu&apos;au</Label>
          <Input id="studio-valid-until" value={value.validUntil ?? ""} onChange={(e) => set("validUntil", e.target.value || null)} />
        </div>
      )}

      <div className="grid gap-2.5 sm:grid-cols-2">
        <div>
          <Label htmlFor="studio-price">Prix / tarif (optionnel)</Label>
          <Input id="studio-price" value={value.price ?? ""} onChange={(e) => set("price", e.target.value || null)} placeholder="Jamais inventé si vide" />
        </div>
        <div>
          <Label htmlFor="studio-cta">Appel à l&apos;action (optionnel)</Label>
          <Input id="studio-cta" value={value.callToAction ?? ""} onChange={(e) => set("callToAction", e.target.value || null)} placeholder="Un texte par défaut sera utilisé sinon" />
        </div>
      </div>

      <div>
        <Label htmlFor="studio-highlights">Points forts (un par ligne, optionnel)</Label>
        <Textarea
          id="studio-highlights"
          rows={3}
          value={value.highlights.join("\n")}
          onChange={(e) => set("highlights", e.target.value.split("\n"))}
        />
      </div>
    </div>
  );
}
