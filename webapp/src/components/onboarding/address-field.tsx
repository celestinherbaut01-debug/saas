"use client";

import { useEffect, useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  suggestAddresses,
  geolocateBrowser,
  reverseGeocode,
  GeolocationAppError,
  type AddressSuggestion,
} from "@/lib/geocode";

export interface AddressValue {
  street: string;
  postalCode: string;
  city: string;
  lat: number;
  lng: number;
  label: string;
  accuracy?: number;
}

type LocateState =
  | { kind: "idle" }
  | { kind: "locating" }
  | { kind: "success" }
  | { kind: "error"; message: string; canRetry: boolean };

/** Traduit le code natif du navigateur en message compréhensible, jamais le texte brut. */
function friendlyLocateError(err: unknown): { message: string; canRetry: boolean } {
  if (err instanceof GeolocationAppError) {
    switch (err.code) {
      case 1: // PERMISSION_DENIED
        return {
          message: "L'accès à votre localisation est désactivé. Autorisez-la dans votre navigateur ou saisissez votre adresse manuellement.",
          canRetry: true,
        };
      case 2: // POSITION_UNAVAILABLE
        return { message: "Votre position n'est pas disponible actuellement.", canRetry: true };
      case 3: // TIMEOUT
        return { message: "La localisation prend trop de temps. Réessayez ou saisissez votre adresse.", canRetry: true };
      default:
        return { message: "Votre navigateur n'a pas accès à votre position.", canRetry: false };
    }
  }
  return { message: "Localisation impossible pour le moment. Saisissez votre adresse manuellement.", canRetry: true };
}

export function AddressField({
  value,
  onChange,
}: {
  value: AddressValue | null;
  onChange: (v: AddressValue) => void;
}) {
  const [query, setQuery] = useState(value?.label ?? "");
  const [suggestions, setSuggestions] = useState<AddressSuggestion[]>([]);
  const [open, setOpen] = useState(false);
  const [locate, setLocate] = useState<LocateState>({ kind: "idle" });
  const [showHelp, setShowHelp] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      const results = await suggestAddresses(query);
      setSuggestions(results);
    }, 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query]);

  function pick(s: AddressSuggestion, accuracy?: number) {
    onChange({ street: s.street, postalCode: s.postalCode, city: s.city, lat: s.lat, lng: s.lng, label: s.label, accuracy });
    setQuery(s.label);
    setOpen(false);
  }

  async function useMyLocation() {
    setLocate({ kind: "locating" });
    setShowHelp(false);
    try {
      const pos = await geolocateBrowser();
      const address = await reverseGeocode(pos.lat, pos.lng);
      if (address) {
        pick(address, pos.accuracy);
      } else {
        // Pas d'adresse lisible trouvée : on garde les coordonnées, jamais une adresse inventée.
        onChange({ street: "", postalCode: "", city: "", lat: pos.lat, lng: pos.lng, label: "Position détectée", accuracy: pos.accuracy });
        setQuery("Position détectée");
      }
      setLocate({ kind: "success" });
    } catch (e) {
      const { message, canRetry } = friendlyLocateError(e);
      setLocate({ kind: "error", message, canRetry });
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="relative">
        <Input
          placeholder="12 rue de la Gare, 59400 Cambrai"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
        />
        {open && suggestions.length > 0 && (
          <ul className="absolute z-10 mt-1 w-full overflow-hidden rounded-lg border border-line bg-panel shadow-lg">
            {suggestions.map((s) => (
              <li key={s.label}>
                <button
                  type="button"
                  className="w-full px-3 py-2 text-left text-[13px] hover:bg-soft"
                  onClick={() => pick(s)}
                >
                  {s.label}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="flex items-center gap-2">
        <Button type="button" variant="outline" size="sm" onClick={useMyLocation} disabled={locate.kind === "locating"}>
          {locate.kind === "locating" ? "Localisation en cours…" : "⌖ Utiliser ma position"}
        </Button>
        {locate.kind === "success" && value && (
          <span className="text-[12px] text-green-fg">
            ✓ Position détectée
            {value.accuracy != null && ` — précision estimée : ± ${Math.round(value.accuracy)} m`}
          </span>
        )}
      </div>

      {locate.kind === "error" && (
        <div className="rounded-lg bg-amber-bg px-3 py-2.5 text-[12.5px] text-amber-fg">
          <p className="font-semibold">⚠ {locate.message}</p>
          <div className="mt-2 flex items-center gap-3">
            {locate.canRetry && (
              <button type="button" onClick={useMyLocation} className="font-semibold underline">
                Réessayer
              </button>
            )}
            <button type="button" onClick={() => setShowHelp((v) => !v)} className="underline">
              Comment activer ma localisation ?
            </button>
          </div>
          {showHelp && (
            <div className="mt-2 flex flex-col gap-1 border-t border-amber-fg/20 pt-2 text-[11.5px]">
              <p>
                <b>Safari :</b> Safari → Réglages pour ce site web → Localisation → Autoriser.
              </p>
              <p>
                <b>macOS :</b> Réglages Système → Confidentialité et sécurité → Service de localisation.
              </p>
            </div>
          )}
          <p className="mt-2">Vous pouvez aussi simplement saisir votre adresse ci-dessus.</p>
        </div>
      )}
    </div>
  );
}
