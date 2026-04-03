"use client";

import { useActionState } from "react";
import { submitSellInquiry } from "@/app/actions/sell";
import { ctaPrimary } from "@/lib/cta-styles";
import { cardSurface } from "@/lib/ui";

function fieldClass() {
  return "w-full min-h-[48px] rounded-xl border border-border bg-background px-4 py-3.5 text-base text-foreground shadow-sm placeholder:text-muted-foreground transition-shadow focus-ring outline-none focus:border-ring/50 focus:shadow-md sm:rounded-2xl";
}

export function SellHouseForm() {
  const [state, formAction, pending] = useActionState(submitSellInquiry, null);

  if (state?.ok === true) {
    return (
      <div className={`${cardSurface} p-8 text-center sm:p-10`}>
        <p className="text-lg font-medium text-foreground">Thank you.</p>
        <p className="mt-2 text-muted-foreground">
          Eric will review your details and reach out shortly.
        </p>
      </div>
    );
  }

  return (
    <form
      action={formAction}
      className={`${cardSurface} mx-auto max-w-2xl space-y-6 p-6 sm:space-y-7 sm:p-8 lg:p-10`}
    >
      {state?.ok === false ? (
        <p className="rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-700 dark:text-red-300">
          {state.message}
        </p>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label htmlFor="full_name" className="mb-1.5 block text-sm font-medium text-foreground">
            Full name
          </label>
          <input id="full_name" name="full_name" required className={fieldClass()} />
        </div>
        <div>
          <label htmlFor="email" className="mb-1.5 block text-sm font-medium text-foreground">
            Email
          </label>
          <input id="email" name="email" type="email" required className={fieldClass()} />
        </div>
        <div>
          <label htmlFor="phone" className="mb-1.5 block text-sm font-medium text-foreground">
            Phone
          </label>
          <input id="phone" name="phone" type="tel" className={fieldClass()} />
        </div>
      </div>

      <div>
        <label htmlFor="property_address" className="mb-1.5 block text-sm font-medium text-foreground">
          Property address
        </label>
        <input id="property_address" name="property_address" className={fieldClass()} />
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div>
          <label htmlFor="city" className="mb-1.5 block text-sm font-medium text-foreground">
            City
          </label>
          <input id="city" name="city" className={fieldClass()} />
        </div>
        <div>
          <label htmlFor="state" className="mb-1.5 block text-sm font-medium text-foreground">
            State
          </label>
          <input id="state" name="state" className={fieldClass()} />
        </div>
        <div>
          <label htmlFor="postal_code" className="mb-1.5 block text-sm font-medium text-foreground">
            ZIP
          </label>
          <input id="postal_code" name="postal_code" className={fieldClass()} />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="property_type" className="mb-1.5 block text-sm font-medium text-foreground">
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
          <label htmlFor="timeline" className="mb-1.5 block text-sm font-medium text-foreground">
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
        <label htmlFor="message" className="mb-1.5 block text-sm font-medium text-foreground">
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
        className={`${ctaPrimary} disabled:opacity-50`}
      >
        {pending ? "Sending…" : "Request a consultation"}
      </button>
    </form>
  );
}
