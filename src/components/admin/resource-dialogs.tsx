"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, type ReactNode } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import {
  billingPeriods,
  paymentTermInputSchema,
  planInputSchema,
  productInputSchema,
  productTypes,
  taxInputSchema,
  taxTypes,
  variantUpdateSchema,
} from "@/lib/validation/admin";
import { AdminDialog } from "@/components/admin/AdminDialog";

type TaxOption = { id: string; name: string; isActive: boolean };
type ProductValues = z.infer<typeof productInputSchema>;
type TaxValues = z.infer<typeof taxInputSchema>;
type PaymentTermValues = z.infer<typeof paymentTermInputSchema>;
type PlanValues = z.infer<typeof planInputSchema>;
type VariantValues = z.infer<typeof variantUpdateSchema>;

type DialogProps<T> = {
  open: boolean;
  busy: boolean;
  error: string;
  onClose: () => void;
  onSave: (values: T) => Promise<void>;
};

type ProductRecord = ProductValues & {
  id: string;
  salesPrice: string;
  costPrice: string;
};

type TaxRecord = TaxValues & { id: string; rate: string };
type PaymentTermRecord = PaymentTermValues & { id: string };
type PlanRecord = Omit<PlanValues, "availableFrom" | "availableTo"> & {
  id: string;
  price: string;
  availableFrom: string;
  availableTo: string | null;
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

export function ProductDialog({
  open,
  busy,
  error,
  product,
  taxes,
  onClose,
  onSave,
}: DialogProps<ProductValues> & { product: ProductRecord | null; taxes: TaxOption[] }) {
  const form = useForm<ProductValues>({
    resolver: zodResolver(productInputSchema),
    defaultValues: {
      name: "",
      type: "SOFTWARE",
      salesPrice: "",
      costPrice: "",
      notes: null,
      defaultTaxId: null,
      isActive: true,
    },
  });
  const { reset } = form;

  useEffect(() => {
    reset(product ? {
      name: product.name,
      type: product.type,
      salesPrice: product.salesPrice,
      costPrice: product.costPrice,
      notes: product.notes,
      defaultTaxId: product.defaultTaxId,
      isActive: product.isActive,
    } : {
      name: "",
      type: "SOFTWARE",
      salesPrice: "",
      costPrice: "",
      notes: null,
      defaultTaxId: null,
      isActive: true,
    });
  }, [open, product, reset]);

  return (
    <AdminDialog
      open={open}
      title={product ? "Edit product" : "Create product"}
      submitLabel={product ? "Save changes" : "Create product"}
      busy={busy}
      error={error}
      onClose={onClose}
      onSubmit={(event) => void form.handleSubmit(onSave)(event)}
    >
      <Field label="Name" error={form.formState.errors.name?.message}>
        <input autoComplete="off" {...form.register("name")} />
      </Field>
      <Field label="Product type" error={form.formState.errors.type?.message}>
        <select {...form.register("type")}>
          {productTypes.map((type) => <option key={type} value={type}>{type}</option>)}
        </select>
      </Field>
      <Field label="Sales price" error={form.formState.errors.salesPrice?.message}>
        <input inputMode="decimal" placeholder="0.00" {...form.register("salesPrice")} />
      </Field>
      <Field label="Cost price" error={form.formState.errors.costPrice?.message}>
        <input inputMode="decimal" placeholder="0.00" {...form.register("costPrice")} />
      </Field>
      <Field label="Default tax">
        <select {...form.register("defaultTaxId", { setValueAs: (value) => value || null })}>
          <option value="">No default tax</option>
          {taxes.map((tax) => (
            <option key={tax.id} value={tax.id}>{tax.name}{tax.isActive ? "" : " (inactive)"}</option>
          ))}
        </select>
      </Field>
      <Field label="Notes" error={form.formState.errors.notes?.message}>
        <textarea rows={3} {...form.register("notes", { setValueAs: (value) => value || null })} />
      </Field>
      <label className="checkbox-field">
        <input type="checkbox" {...form.register("isActive")} />
        <span>Active</span>
      </label>
    </AdminDialog>
  );
}

export function VariantDialog({
  open,
  busy,
  error,
  variant,
  onClose,
  onSave,
}: DialogProps<VariantValues> & {
  variant: (VariantValues & { id: string; extraPrice: string }) | null;
}) {
  const form = useForm<VariantValues>({
    resolver: zodResolver(variantUpdateSchema),
    defaultValues: { attribute: "", value: "", extraPrice: "0", isActive: true },
  });
  const { reset } = form;

  useEffect(() => {
    reset(variant ? {
      attribute: variant.attribute,
      value: variant.value,
      extraPrice: variant.extraPrice,
      isActive: variant.isActive,
    } : { attribute: "", value: "", extraPrice: "0", isActive: true });
  }, [open, reset, variant]);

  return (
    <AdminDialog
      open={open}
      title={variant ? "Edit variant" : "Add product variant"}
      submitLabel={variant ? "Save changes" : "Add variant"}
      busy={busy}
      error={error}
      onClose={onClose}
      onSubmit={(event) => void form.handleSubmit(onSave)(event)}
    >
      <Field label="Attribute" error={form.formState.errors.attribute?.message}>
        <input placeholder="Brand" {...form.register("attribute")} />
      </Field>
      <Field label="Value" error={form.formState.errors.value?.message}>
        <input placeholder="Odoo" {...form.register("value")} />
      </Field>
      <Field label="Extra price" error={form.formState.errors.extraPrice?.message}>
        <input inputMode="decimal" placeholder="0.00" {...form.register("extraPrice")} />
      </Field>
      <label className="checkbox-field">
        <input type="checkbox" {...form.register("isActive")} />
        <span>Active</span>
      </label>
    </AdminDialog>
  );
}

export function TaxDialog({
  open,
  busy,
  error,
  tax,
  onClose,
  onSave,
}: DialogProps<TaxValues> & { tax: TaxRecord | null }) {
  const form = useForm<TaxValues>({
    resolver: zodResolver(taxInputSchema),
    defaultValues: { name: "", type: "PERCENT", rate: "", isActive: true },
  });
  const { reset } = form;

  useEffect(() => {
    reset(tax ? { name: tax.name, type: tax.type, rate: tax.rate, isActive: tax.isActive } : {
      name: "", type: "PERCENT", rate: "", isActive: true,
    });
  }, [open, reset, tax]);

  return (
    <AdminDialog
      open={open}
      title={tax ? "Edit tax" : "Create tax"}
      submitLabel={tax ? "Save changes" : "Create tax"}
      busy={busy}
      error={error}
      onClose={onClose}
      onSubmit={(event) => void form.handleSubmit(onSave)(event)}
    >
      <Field label="Name" error={form.formState.errors.name?.message}>
        <input placeholder="GST 18%" {...form.register("name")} />
      </Field>
      <Field label="Type" error={form.formState.errors.type?.message}>
        <select {...form.register("type")}>
          {taxTypes.map((type) => <option key={type} value={type}>{type}</option>)}
        </select>
      </Field>
      <Field label="Rate" error={form.formState.errors.rate?.message}>
        <input inputMode="decimal" placeholder="18" {...form.register("rate")} />
      </Field>
      <label className="checkbox-field">
        <input type="checkbox" {...form.register("isActive")} />
        <span>Active</span>
      </label>
    </AdminDialog>
  );
}

export function PaymentTermDialog({
  open,
  busy,
  error,
  paymentTerm,
  onClose,
  onSave,
}: DialogProps<PaymentTermValues> & { paymentTerm: PaymentTermRecord | null }) {
  const form = useForm<PaymentTermValues>({
    resolver: zodResolver(paymentTermInputSchema),
    defaultValues: { name: "", days: 0 },
  });
  const { reset } = form;

  useEffect(() => {
    reset(paymentTerm ? { name: paymentTerm.name, days: paymentTerm.days } : { name: "", days: 0 });
  }, [open, paymentTerm, reset]);

  return (
    <AdminDialog
      open={open}
      title={paymentTerm ? "Edit payment term" : "Create payment term"}
      submitLabel={paymentTerm ? "Save changes" : "Create payment term"}
      busy={busy}
      error={error}
      onClose={onClose}
      onSubmit={(event) => void form.handleSubmit(onSave)(event)}
    >
      <Field label="Name" error={form.formState.errors.name?.message}>
        <input placeholder="Net 30" {...form.register("name")} />
      </Field>
      <Field label="Days" error={form.formState.errors.days?.message}>
        <input type="number" min={0} step={1} {...form.register("days", { valueAsNumber: true })} />
      </Field>
    </AdminDialog>
  );
}

function dateToLocalInput(value: string) {
  const date = new Date(value);
  const localDate = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return localDate.toISOString().slice(0, 16);
}

export function PlanDialog({
  open,
  busy,
  error,
  plan,
  onClose,
  onSave,
}: DialogProps<PlanValues> & { plan: PlanRecord | null }) {
  const form = useForm<PlanValues>({
    resolver: zodResolver(planInputSchema),
    defaultValues: {
      name: "",
      price: "",
      period: "MONTHLY",
      minQuantity: 1,
      availableFrom: "",
      availableTo: null,
      autoClose: false,
      closable: true,
      pausable: false,
      renewable: true,
    },
  });
  const { reset } = form;

  useEffect(() => {
    reset(plan ? {
      name: plan.name,
      price: plan.price,
      period: plan.period,
      minQuantity: plan.minQuantity,
      availableFrom: dateToLocalInput(plan.availableFrom),
      availableTo: plan.availableTo ? dateToLocalInput(plan.availableTo) : null,
      autoClose: plan.autoClose,
      closable: plan.closable,
      pausable: plan.pausable,
      renewable: plan.renewable,
    } : {
      name: "",
      price: "",
      period: "MONTHLY",
      minQuantity: 1,
      availableFrom: dateToLocalInput(new Date().toISOString()),
      availableTo: null,
      autoClose: false,
      closable: true,
      pausable: false,
      renewable: true,
    });
  }, [open, plan, reset]);

  return (
    <AdminDialog
      open={open}
      title={plan ? "Edit plan" : "Create plan"}
      submitLabel={plan ? "Save changes" : "Create plan"}
      busy={busy}
      error={error}
      onClose={onClose}
      onSubmit={(event) => void form.handleSubmit((values) => onSave({
        ...values,
        availableTo: values.availableTo || null,
      }))(event)}
    >
      <Field label="Name" error={form.formState.errors.name?.message}>
        <input {...form.register("name")} />
      </Field>
      <Field label="Price" error={form.formState.errors.price?.message}>
        <input inputMode="decimal" placeholder="0.00" {...form.register("price")} />
      </Field>
      <Field label="Period" error={form.formState.errors.period?.message}>
        <select {...form.register("period")}>
          {billingPeriods.map((period) => <option key={period} value={period}>{period}</option>)}
        </select>
      </Field>
      <Field label="Minimum quantity" error={form.formState.errors.minQuantity?.message}>
        <input type="number" min={1} step={1} {...form.register("minQuantity", { valueAsNumber: true })} />
      </Field>
      <Field label="Available from" error={form.formState.errors.availableFrom?.message}>
        <input type="datetime-local" {...form.register("availableFrom")} />
      </Field>
      <Field label="Available to" error={form.formState.errors.availableTo?.message}>
        <input type="datetime-local" {...form.register("availableTo", { setValueAs: (value) => value || null })} />
      </Field>
      <div className="checkbox-grid">
        {([
          ["autoClose", "Auto close"],
          ["closable", "Closable"],
          ["pausable", "Pausable"],
          ["renewable", "Renewable"],
        ] as const).map(([field, label]) => (
          <label className="checkbox-field" key={field}>
            <input type="checkbox" {...form.register(field)} />
            <span>{label}</span>
          </label>
        ))}
      </div>
    </AdminDialog>
  );
}
