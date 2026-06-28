# Mass JE Approval

A real custom mass-approval workflow: an approver searches for journal
entries pending approval, marks the ones to approve, and the batch is
processed asynchronously with a dedicated progress/results page — rather
than generic per-script-type samples, this is one connected mini-project.

## Flow

1. **SL_MassJEApproval** — search/filter Suitelet. Filters: Date From/To,
   Subsidiary, Name, Page Size. Always-on rules (not user-facing toggles):
   only JEs with Approval Status = Pending, in an open/unlocked period, and
   excluding JEs created by the logged-in user (segregation of duties).
   Mark All / Unmark All and Refresh are handled client-side by
   **CS_MassJEApproval**; Approve submits the marked JE ids.
2. On Approve, the Suitelet hands the marked ids to **MR_MassJEApprovalProcessor**
   via `N/task` (so a batch of any size is safe from Suitelet
   governance/timeout) and redirects to **SL_MassJEApprovalResults** with
   the task and batch id.
3. **MR_MassJEApprovalProcessor** sets each JE's Approval Status to
   Approved and caches the outcome per JE, keyed by batch id.
4. **SL_MassJEApprovalResults** polls the task status: while it's still
   running, the page auto-refreshes every 5 seconds; once complete, it
   reads the cached results and lists each JE with a link back to the
   record.

## Files

| File | Script Type | Role |
|---|---|---|
| [`SL_MassJEApproval.js`](SL_MassJEApproval.js) | Suitelet | Search/filter page, kicks off the approval batch |
| [`CS_MassJEApproval.js`](CS_MassJEApproval.js) | Client Script | Mark All/Unmark All, Refresh, Approve button behavior |
| [`MR_MassJEApprovalProcessor.js`](MR_MassJEApprovalProcessor.js) | Map/Reduce | Approves each JE, caches per-batch results |
| [`SL_MassJEApprovalResults.js`](SL_MassJEApprovalResults.js) | Suitelet | Progress polling + results page |

Reference/illustrative implementation written to demonstrate the pattern —
not derived from any employer or client codebase. Field/script/deployment
ids are representative placeholders, not real configuration.
