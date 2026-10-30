# Component standards

This document defines how UI is built in this repository. It is intentionally short and
prescriptive so the codebase stays consistent as features are added.

## Non-negotiables

1. **Reuse before creating.** Search `src/components` before adding markup. If an element already
   exists, extend its props instead of copying it into a page or another feature.
2. **Default HTML controls live behind primitives.** Application code must not render raw
   `<input>`, `<select>`, `<table>`, `<label>`, or `<button>` elements outside
   `src/components/ui/`. Use the components listed below.
3. **One responsibility per file.** Application source files under `src/` stay at or below 500
   lines. A page that grows beyond that composes smaller components rather than growing further.
4. **Server by default.** Primitives have no client hooks. Add `"use client"` only to components
   that need state, effects, event handlers, or browser APIs (`Modal`, `ExpenseDialog`, `MemoForm`,
   `SubmitButton`, `NavLinks`, `DeleteMemoButton`, `AuthForms`).
5. **Pages compose, components implement.** Route files under `src/app` fetch, authorize, and lay
   out sections. Form controls, tables, modals, and feature widgets live in `src/components`.
6. **Shared styling comes from `globals.css`.** Use the `.card`, `.btn`, `.input`, `.label`,
   `.hint`, and `.data-table` tokens through components instead of introducing page-specific
   control styling.

## Directory layout

```text
src/components/
├── ui/                     # framework-level primitives; reusable across every feature
│   ├── button.tsx          # Button, ButtonLink, buttonStyles
│   ├── icon-button.tsx     # accessible icon-only button
│   ├── field.tsx           # Field, Label, FieldErrors
│   ├── input.tsx           # Input
│   ├── select.tsx          # Select
│   ├── table.tsx           # Table and table section/cell wrappers
│   ├── submit-button.tsx   # form submit button with useFormStatus pending state
│   └── modal.tsx           # portal modal with Escape/backdrop/scroll handling
├── memo-form/              # sale editor feature components
│   ├── index.tsx           # MemoForm state + layout
│   ├── top-bar.tsx         # back, expense, sign out, fullscreen, memo number
│   ├── memo-details.tsx    # customer and date fields
│   ├── line-items-card.tsx # line-item rows and live totals
│   ├── saved-sale-dialog.tsx
│   └── types.ts            # form types and helpers
├── app-shell.tsx
├── auth-forms.tsx
├── expense-dialog.tsx
├── ...
```

## Primitive catalog

| Component | Import | Use for |
| --- | --- | --- |
| `Button` | `@/components/ui/button` | Any non-submit button. Variants: primary, secondary, accent, danger, ghost. |
| `ButtonLink` | `@/components/ui/button` | Navigation actions styled as buttons. |
| `buttonStyles` | `@/components/ui/button` | Styling non-interactive elements that must match a button (for example disabled pagination). |
| `IconButton` | `@/components/ui/icon-button` | Icon-only actions with a required accessible `label`. |
| `Field` | `@/components/ui/field` | A labeled control with optional hint and field errors. |
| `Label` | `@/components/ui/field` | A standalone label when a `Field` wrapper is not appropriate. |
| `FieldErrors` | `@/components/ui/field` | Rendering server-returned validation messages for a group of fields. |
| `Input` | `@/components/ui/input` | Every text, date, number, telephone, password, and hidden input. |
| `Select` | `@/components/ui/select` | Every select. Render native `<option>` children. |
| `Table` | `@/components/ui/table` | Every data table and its horizontal scroll wrapper. |
| `TableHeader`, `TableBody`, `TableFooter`, `TableRow` | `@/components/ui/table` | Table sections and rows. |
| `TableHeadCell`, `TableCell` | `@/components/ui/table` | Header/data cells; `align="right"` replaces ad-hoc `text-right`. |
| `Modal` | `@/components/ui/modal` | Portaled dialogs. Handles Escape, backdrop dismissal when `onClose` is supplied, and body scroll lock. |
| `SubmitButton` | `@/components/ui/submit-button` | Every form submit button. Uses `useFormStatus` for pending state and disabled handling. |

Feature components (`PageHeader`, `SectionCard`, `Alert`, `EmptyState`, `StatCard`, `MemoTable`,
`Pagination`, `ExpenseDialog`, `MemoForm`, `AuthForms`, `DeleteMemoButton`) should be reused in the
same way. Do not reproduce their markup in a page.

## Choosing the right abstraction

- **A new UI primitive** is justified only when a native HTML control is needed in more than one
  feature, or when behavior is shared (focus, portal, pending state, validation display). Put it in
  `src/components/ui/`.
- **A new feature component** is justified when a page repeats a block, when a block has its own
  state, or when a page would otherwise cross the 500-line budget. Put it in
  `src/components/<feature>/`.
- **A page-local fragment** is fine for one-off layout (a heading row, a summary grid) as long as it
  renders no raw primitive controls and does not repeat another page.
- **Do not create one-off wrappers** around `Input` or `Select` just to rename a prop. Pass the
  existing primitive the native props it already supports.

## Examples

A labeled filter control:

```tsx
<Field label="Partner" htmlFor="history-partner">
  <Select id="history-partner" name="partner" defaultValue={partnerId ?? ""}>
    <option value="">All partners</option>
    {partners.map((partner) => (
      <option key={partner.id} value={partner.id}>
        {partner.name}
      </option>
    ))}
  </Select>
</Field>
```

A table section:

```tsx
<Table>
  <TableHeader>
    <TableRow>
      <TableHeadCell>Expense</TableHeadCell>
      <TableHeadCell align="right">Amount</TableHeadCell>
    </TableRow>
  </TableHeader>
  <TableBody>
    {expenses.map((expense) => (
      <TableRow key={expense.id}>
        <TableCell>{expense.name}</TableCell>
        <TableCell align="right">{formatMoney(expense.amount)}</TableCell>
      </TableRow>
    ))}
  </TableBody>
</Table>
```

A dialog:

```tsx
<Modal open={open} onClose={onClose} labelledBy="expense-dialog-title" align="top">
  <h2 id="expense-dialog-title">Add expense</h2>
  {children}
</Modal>
```

## File-size budget

- All TypeScript/TSX files under `src/` are kept at or below 500 lines.
- When a component approaches the budget, split by responsibility first (state container, detail
  fields, row list, dialog), not by arbitrary chunks.
- Long-form documentation, immutable SQL migration history, and the destructive SQL test suite are
  not React application source and are intentionally excluded from the source-file budget.

## Review checklist

- [ ] No raw `<input>`, `<select>`, `<table>`, `<label>`, or `<button>` outside
      `src/components/ui/`.
- [ ] Existing `Field`, `Input`, `Select`, `Table`, `Button`, `Modal`, and display components reused.
- [ ] New interactive UI has a clear component boundary and intentional `"use client"` placement.
- [ ] Touch targets, labels, `aria-*` attributes, and keyboard behavior preserved.
- [ ] Every touched `src/**` file is still at or below 500 lines.
- [ ] `npm run typecheck`, `npm run lint`, `npm run test`, and `npm run build` pass.
