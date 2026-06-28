# SO Landed Cost Assignment

Automatically assigns a Landed Cost Template at the line level on new
Mexico-subsidiary Sales Orders shipped from a US location — a real
cross-border allocation rule rather than a generic per-script-type sample.

## Flow

`UE_SOLandedCostAssignment` runs on Sales Order `beforeSubmit` (create) and
chains four checks, stopping early the moment one fails:

1. **Subsidiary** is Mexico (`13` — representative placeholder id).
2. **Location**'s country is `US`.
3. A **Landed Cost Template** record exists for country `US`.
4. For each order line, the **item**'s own default Landed Cost Template
   matches that US template — only matching lines get it stamped onto
   `custcol_landed_cost_template`, so mixed-sourcing orders don't get a
   blanket assignment.

## Files

| File | Script Type | Role |
|---|---|---|
| [`UE_SOLandedCostAssignment.js`](UE_SOLandedCostAssignment.js) | User Event | Subsidiary -> location -> template -> item chain, line-level assignment |

Reference/illustrative implementation written to demonstrate the pattern —
not derived from any employer or client codebase. Field/record ids
(`customrecord_landed_cost_template`, `custrecord_lct_country`,
`custitem_landed_cost_template`, `custcol_landed_cost_template`) are
representative placeholders, not real configuration.
