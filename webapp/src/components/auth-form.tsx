"use client";

import { useActionState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import type { AuthActionState } from "@/lib/actions/auth";

export function AuthForm({
  action,
  submitLabel,
}: {
  action: (state: AuthActionState, formData: FormData) => Promise<AuthActionState>;
  submitLabel: string;
}) {
  const [state, formAction, pending] = useActionState<AuthActionState, FormData>(action, {
    error: null,
  });

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="email">Email</Label>
        <Input id="email" name="email" type="email" required autoComplete="email" placeholder="vous@entreprise.fr" />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="password">Mot de passe</Label>
        <Input
          id="password"
          name="password"
          type="password"
          required
          minLength={8}
          autoComplete="current-password"
          placeholder="••••••••"
        />
      </div>
      {state.error && <p className="text-[12px] text-red-fg">{state.error}</p>}
      <Button type="submit" disabled={pending} className="w-full">
        {pending ? "…" : submitLabel}
      </Button>
    </form>
  );
}
