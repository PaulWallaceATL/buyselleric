"use client";

import { useActionState } from "react";
import { submitSellInquiry } from "@/app/actions/sell";

function fieldClass() {
  return "w-full rounded-xl border border-border bg-muted/20 px-4 py-3 text-foreground placeholder:text-muted-foreground focus-ring outline-none";
}

export function SellHouseForm() {
  const [state, formAction, pending] = useActionState(submitSellInquiry, null);

  if (state?.ok === true) {
    return (
      <div className="rounded-2xl border border-border bg-muted/30 p-8 text-center">
        <p className="text-lg font-medium text-foreground">Thank you.</p>
        <p className="mt-2 text-muted-foreground">
          Eric will review your details and reach out shortly.
        </p>
      </div>
    );
  }

  return (
    <form action={formAction} className="space-y-5 max-w-xl">
      {state?.ok === false ? (
        <p className="rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-700 dark:text-red-300">
          {state.message}
        </p>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label htmlFor="full_name" className="mb-1 block text-sm font-medium">
            Full name
          </label>
          <input id="full_name" name="full_name" required className={fieldClass()} />
        </div>
        <div>
          <label htmlFor="email" className="mb-1 block text-sm font-medium">
            Email
          </label>
          <input id="email" name="email" type="email" required className={fieldClass()} />
        </div>
        <div>
          <label htmlFor="phone" className="mb-1 block text-sm font-medium">
            Phone
          </label>
          <input id="phone" name="phone" type="tel" className={fieldClass()} />
        </div>
      </div>

      <div>
        <label htmlFor="property_address" className="mb-1 block text-sm font-medium">
          Property address
        </label>
        <input id="property_address" name="property_address" className={fieldClass()} />
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div>
          <label htmlFor="city" className="mb-1 block text-sm font-medium">
            City
          </label>
          <input id="city" name="city" className={fieldClass()} />
        </div>
        <div>
          <label htmlFor="state" className="mb-1 block text-sm font-medium">
            State
          </label>
          <input id="state" name="state" className={fieldClass()} />
        </div>
        <div>
          <label htmlFor="postal_code" className="mb-1 block text-sm font-medium">
            ZIP
          </label>
          <input id="postal_code" name="postal_code" className={fieldClass()} />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="property_type" className="mb-1 block text-sm font-medium">
            Property type
          </label>
          <select id="property_type" name="property_type" className={fieldClass()}>
            <option value="">Select…</option>
            <option value="single_family">Single-family</option>
            <option value="condo">Condo / townhome</option>
            <option value="multi_family">Multi-family</option>
            <option value="land">Land</option>
            <option value="other">Other</option>
          </select>
        </div>
        <div>
          <label htmlFor="timeline" className="mb-1 block text-sm font-medium">
            When do you hope to sell?
          </label>
          <select id="timeline" name="timeline" className={fieldClass()}>
            <option value="">Select…</option>
            <option value="asap">As soon as possible</option>
            <option value="1_3_months">1–3 months</option>
            <option value="3_6_months">3–6 months</option>
            <option value="exploring">Just exploring</option>
          </select>
        </div>
      </div>

      <div>
        <label htmlFor="message" className="mb-1 block text-sm font-medium">
          Tell Eric about your home
        </label>
        <textarea
          id="message"
          name="message"
          rows={5}
          placeholder="Updates, lot size, motivation, questions…"
          className={`${fieldClass()} min-h-[120px] resize-y`}
        />
      </div>

      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-full bg-foreground py-3.5 text-sm font-medium text-background hover:opacity-90 disabled:opacity-50 transition-opacity focus-ring outline-none sm:w-auto sm:px-10"
      >
        {pending ? "Sending…" : "Request a consultation"}
      </button>
    </form>
  );
}
