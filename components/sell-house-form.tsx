"use client";

import { useActionState } from "react";
import { submitSellInquiry } from "@/app/actions/sell";
import { ctaPrimary } from "@/lib/cta-styles";
import { siteConfig } from "@/lib/config";

function fieldClass() {
  return "w-full min-h-[48px] rounded-xl border border-border/80 bg-background/80 px-4 py-3.5 text-base text-foreground shadow-sm placeholder:text-muted-foreground transition-[border-color,box-shadow] focus-ring outline-none focus:border-ring/50 focus:shadow-md sm:rounded-2xl";
}

function labelClass() {
  return "mb-1.5 block text-sm font-medium text-foreground";
}

export function SellHouseForm() {
  const [state, formAction, pending] = useActionState(submitSellInquiry, null);

  if (state?.ok === true) {
    return (
      <div className="rounded-[1.75rem] border border-border/70 bg-muted/20 p-8 text-center sm:rounded-[2rem] sm:p-10">
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-muted-foreground">
          Sent
        </p>
        <p className="mt-3 text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
          You&apos;re on Eric&apos;s list.
        </p>
        <p className="mx-auto mt-3 max-w-md text-pretty text-muted-foreground">
          He&apos;ll review your details and follow up with a clear next step. No spam, no
          pressure.
        </p>
        <a
          href={`tel:${siteConfig.phoneTel}`}
          className={`${ctaPrimary} mt-8`}
        >
          Prefer to talk now? Call {siteConfig.phoneDisplay}
        </a>
      </div>
    );
  }

  return (
    <form
      action={formAction}
      className="rounded-[1.75rem] border border-border/70 bg-muted/15 p-6 sm:rounded-[2rem] sm:p-8 lg:p-9"
    >
      {state?.ok === false ? (
        <p className="mb-6 rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-700 dark:text-red-300">
          {state.message}
        </p>
      ) : null}

      <fieldset className="space-y-4">
        <legend className="mb-4 w-full border-b border-border/60 pb-3 text-sm font-semibold uppercase tracking-[0.16em] text-muted-foreground">
          About you
        </legend>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label htmlFor="full_name" className={labelClass()}>
              Full name
            </label>
            <input id="full_name" name="full_name" required autoComplete="name" className={fieldClass()} />
          </div>
          <div>
            <label htmlFor="email" className={labelClass()}>
              Email
            </label>
            <input
              id="email"
              name="email"
              type="email"
              required
              autoComplete="email"
              className={fieldClass()}
            />
          </div>
          <div>
            <label htmlFor="phone" className={labelClass()}>
              Phone
            </label>
            <input
              id="phone"
              name="phone"
              type="tel"
              autoComplete="tel"
              className={fieldClass()}
            />
          </div>
        </div>
      </fieldset>

      <fieldset className="mt-8 space-y-4">
        <legend className="mb-4 w-full border-b border-border/60 pb-3 text-sm font-semibold uppercase tracking-[0.16em] text-muted-foreground">
          About your home
        </legend>
        <div>
          <label htmlFor="property_address" className={labelClass()}>
            Property address
          </label>
          <input
            id="property_address"
            name="property_address"
            autoComplete="street-address"
            placeholder="Street address"
            className={fieldClass()}
          />
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <label htmlFor="city" className={labelClass()}>
              City
            </label>
            <input id="city" name="city" autoComplete="address-level2" className={fieldClass()} />
          </div>
          <div>
            <label htmlFor="state" className={labelClass()}>
              State
            </label>
            <input
              id="state"
              name="state"
              autoComplete="address-level1"
              defaultValue="GA"
              className={fieldClass()}
            />
          </div>
          <div>
            <label htmlFor="postal_code" className={labelClass()}>
              ZIP
            </label>
            <input
              id="postal_code"
              name="postal_code"
              autoComplete="postal-code"
              className={fieldClass()}
            />
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="property_type" className={labelClass()}>
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
            <label htmlFor="timeline" className={labelClass()}>
              Timeline
            </label>
            <select id="timeline" name="timeline" className={fieldClass()}>
              <option value="">When do you hope to sell?</option>
              <option value="asap">As soon as possible</option>
              <option value="1_3_months">1–3 months</option>
              <option value="3_6_months">3–6 months</option>
              <option value="exploring">Just exploring</option>
            </select>
          </div>
        </div>
        <div>
          <label htmlFor="message" className={labelClass()}>
            Anything else Eric should know?
          </label>
          <textarea
            id="message"
            name="message"
            rows={4}
            placeholder="Updates, lot size, motivation, questions…"
            className={`${fieldClass()} min-h-[110px] resize-y`}
          />
        </div>
      </fieldset>

      <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <button type="submit" disabled={pending} className={`${ctaPrimary} disabled:opacity-50`}>
          {pending ? "Sending…" : "Request a consultation"}
        </button>
        <p className="text-sm text-muted-foreground sm:max-w-[14rem] sm:text-right">
          Takes about a minute. Eric replies personally.
        </p>
      </div>
    </form>
  );
}
