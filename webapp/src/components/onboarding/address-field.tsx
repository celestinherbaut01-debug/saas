"use client";

import { useEffect, useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { suggestAddresses, geolocateBrowser, reverseGeocode, type AddressSuggestion } from "@/lib/geocode";

export interface AddressValue {
  street: string;
  postalCode: string;
  city: string;
  lat: number;
  lng: number;
  label: string;
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
  const [locating, setLocating] = useState(false);
  const [error, setError] = useState<string | null>(null);
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

  function pick(s: AddressSuggestion) {
    onChange({ street: s.street, postalCode: s.postalCode, city: s.city, lat: s.lat, lng: s.lng, label: s.label });
    setQuery(s.label);
    setOpen(false);
  }

  async function useMyLocation() {
    setLocating(true);
    setError(null);
    try {
      const pos = await geolocateBrowser();
      const address = await reverseGeocode(pos.lat, pos.lng);
      if (address) {
        pick(address);
      } else {
        onChange({ street: "", postalCode: "", city: "", lat: pos.lat, lng: pos.lng, label: "Position GPS actuelle" });
        setQuery("Position GPS actuelle");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Localisation impossible.");
    } finally {
      setLocating(false);
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
        <Button type="button" variant="outline" size="sm" onClick={useMyLocation} disabled={locating}>
          {locating ? "Localisation…" : "⌖ Utiliser ma position"}
        </Button>
        {value && (
          <span className="text-[12px] text-green-fg">
            ✓ {value.lat.toFixed(5)}, {value.lng.toFixed(5)}
          </span>
        )}
      </div>
      {error && <p className="text-[12px] text-red-fg">{error}</p>}
    </div>
  );
}
