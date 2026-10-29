import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";

export function MemoDetails({
  saleDate,
  onSaleDateChange,
  customerName,
  onCustomerNameChange,
  customerPhone,
  onCustomerPhoneChange,
  errors,
}: {
  saleDate: string;
  onSaleDateChange: (value: string) => void;
  customerName: string;
  onCustomerNameChange: (value: string) => void;
  customerPhone: string;
  onCustomerPhoneChange: (value: string) => void;
  errors: Record<string, string[]>;
}) {
  return (
    <section className="card shrink-0 p-4 sm:p-5">
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_14rem]">
        <Field
          label="Customer name"
          htmlFor="customerName"
          optional
          errors={errors.customerName}
        >
          <Input
            id="customerName"
            name="customerName"
            value={customerName}
            onChange={(event) => onCustomerNameChange(event.target.value)}
            maxLength={120}
            autoComplete="off"
            placeholder="Walk-in customer"
            aria-invalid={Boolean(errors.customerName)}
          />
        </Field>

        <Field
          label="Customer phone"
          htmlFor="customerPhone"
          optional
          errors={errors.customerPhone}
        >
          <Input
            id="customerPhone"
            name="customerPhone"
            type="tel"
            inputMode="tel"
            value={customerPhone}
            onChange={(event) => onCustomerPhoneChange(event.target.value)}
            maxLength={40}
            autoComplete="off"
            placeholder="+1 555 010 2030"
            aria-invalid={Boolean(errors.customerPhone)}
          />
        </Field>

        <Field
          label={
            <>
              Date <span className="text-coral-600">*</span>
              <span className="font-normal text-slate-400"> · defaults to today</span>
            </>
          }
          htmlFor="saleDate"
          errors={errors.saleDate}
        >
          <Input
            id="saleDate"
            name="saleDate"
            type="date"
            value={saleDate}
            onChange={(event) => onSaleDateChange(event.target.value)}
            required
            aria-invalid={Boolean(errors.saleDate)}
          />
        </Field>
      </div>
    </section>
  );
}
