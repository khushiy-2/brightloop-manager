"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, type ReactNode } from "react";
import { useForm, useWatch } from "react-hook-form";
import { z } from "zod";
import { AdminDialog } from "@/components/admin/AdminDialog";
import { discountInputSchema, discountScopes, discountTypes } from "@/lib/validation/admin";

type DiscountValues = z.infer<typeof discountInputSchema>;
type DiscountFormInput = z.input<typeof discountInputSchema>;
type ProductOption = { id: string; name: string };
type DiscountRecord = Omit<DiscountValues, "productIds" | "value" | "minPurchase" | "startDate" | "endDate"> & {
  id: string;
  value: string;
  minPurchase: string | null;
  startDate: string;
  endDate: string | null;
  products: { product: ProductOption }[];
};

function Field({
  label,
  error,
  children,
}: {
  label: string;
  error?: string;
  children: ReactNode;
}) {
  return (
    <label className="form-field">
      <span>{label}</span>
      {children}
      {error && <span className="field-error">{error}</span>}
    </label>
  );
}

function dateToLocalInput(value: string) {
  const date = new Date(value);
  const localDate = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return localDate.toISOString().slice(0, 16);
}

function newDiscountValues(): DiscountValues {
  return {
    name: "",
    code: null,
    type: "PERCENT",
    value: "",
    scope: "SUBSCRIPTION",
    productIds: [],
    minPurchase: null,
    minQuantity: null,
    startDate: dateToLocalInput(new Date().toISOString()),
    endDate: null,
    usageLimit: null,
    isActive: true,
  };
}

export function DiscountDialog({
  open,
  busy,
  error,
  discount,
  products,
  onClose,
  onSave,
}: {
  open: boolean;
  busy: boolean;
  error: string;
  discount: DiscountRecord | null;
  products: ProductOption[];
  onClose: () => void;
  onSave: (values: DiscountValues) => Promise<void>;
}) {
  const form = useForm<DiscountFormInput, unknown, DiscountValues>({
    resolver: zodResolver(discountInputSchema),
    defaultValues: newDiscountValues(),
  });
  const { reset, setValue } = form;
  const scope = useWatch({ control: form.control, name: "scope" });

  useEffect(() => {
    reset(discount ? {
      name: discount.name,
      code: discount.code,
      type: discount.type,
      value: discount.value,
      scope: discount.scope,
      productIds: discount.products.map(({ product }) => product.id),
      minPurchase: discount.minPurchase,
      minQuantity: discount.minQuantity,
      startDate: dateToLocalInput(discount.startDate),
      endDate: discount.endDate ? dateToLocalInput(discount.endDate) : null,
      usageLimit: discount.usageLimit,
      isActive: discount.isActive,
    } : newDiscountValues());
  }, [discount, open, reset]);

  return (
    <AdminDialog
      open={open}
      title={discount ? "Edit discount" : "Create discount"}
      submitLabel={discount ? "Save changes" : "Create discount"}
      busy={busy}
      error={error}
      onClose={onClose}
      onSubmit={(event) => void form.handleSubmit(async (values) => {
        await onSave({
          ...values,
          startDate: new Date(values.startDate).toISOString(),
          endDate: values.endDate ? new Date(values.endDate).toISOString() : null,
        });
      })(event)}
    >
      <Field label="Name" error={form.formState.errors.name?.message}>
        <input autoComplete="off" {...form.register("name")} />
      </Field>
      <Field label="Code (optional)" error={form.formState.errors.code?.message}>
        <input
          autoComplete="off"
          {...form.register("code", { setValueAs: (value) => value.trim() || null })}
        />
      </Field>
      <Field label="Type" error={form.formState.errors.type?.message}>
        <select {...form.register("type")}>
          {discountTypes.map((type) => <option key={type} value={type}>{type}</option>)}
        </select>
      </Field>
      <Field label="Value" error={form.formState.errors.value?.message}>
        <input inputMode="decimal" placeholder="0.00" {...form.register("value")} />
      </Field>
      <Field label="Scope" error={form.formState.errors.scope?.message}>
        <select
          {...form.register("scope", {
            onChange: (event) => {
              if (event.currentTarget.value === "SUBSCRIPTION") {
                setValue("productIds", [], { shouldValidate: true });
              }
            },
          })}
        >
          {discountScopes.map((value) => <option key={value} value={value}>{value}</option>)}
        </select>
      </Field>
      {scope === "PRODUCT" && (
        <Field label="Products" error={form.formState.errors.productIds?.message}>
          <select multiple size={5} {...form.register("productIds")}>
            {products.map((product) => <option key={product.id} value={product.id}>{product.name}</option>)}
          </select>
        </Field>
      )}
      <Field label="Minimum purchase (optional)" error={form.formState.errors.minPurchase?.message}>
        <input
          inputMode="decimal"
          placeholder="No minimum"
          {...form.register("minPurchase", { setValueAs: (value) => value || null })}
        />
      </Field>
      <Field label="Minimum quantity (optional)" error={form.formState.errors.minQuantity?.message}>
        <input
          type="number"
          min={1}
          step={1}
          {...form.register("minQuantity", { setValueAs: (value) => value === "" ? null : Number(value) })}
        />
      </Field>
      <Field label="Start date" error={form.formState.errors.startDate?.message}>
        <input type="datetime-local" {...form.register("startDate")} />
      </Field>
      <Field label="End date (optional)" error={form.formState.errors.endDate?.message}>
        <input
          type="datetime-local"
          {...form.register("endDate", { setValueAs: (value) => value || null })}
        />
      </Field>
      <Field label="Usage limit (optional)" error={form.formState.errors.usageLimit?.message}>
        <input
          type="number"
          min={1}
          step={1}
          {...form.register("usageLimit", { setValueAs: (value) => value === "" ? null : Number(value) })}
        />
      </Field>
      <label className="checkbox-field">
        <input type="checkbox" {...form.register("isActive")} />
        <span>Active</span>
      </label>
    </AdminDialog>
  );
}
