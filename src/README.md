# Code Samples

This is a small SuiteScript 2.1 library covering the script types, integration
patterns, and ERP processes described in the top-level README. Everything here
is an original, illustrative reference implementation written to demonstrate
coding patterns and architecture — it is not copied or derived from any
employer or client codebase, and field/account IDs are representative
placeholders, not real configuration.

## Layout

| Path | Script Type | Demonstrates |
|---|---|---|
| [`user-events/UE_AmortizationInvoiceValidation.js`](user-events/UE_AmortizationInvoiceValidation.js) | User Event | Blocking invalid deferred-revenue lines on Invoice `beforeSubmit` |
| [`client-scripts/CS_SalesOrderCreditValidation.js`](client-scripts/CS_SalesOrderCreditValidation.js) | Client Script | Real-time credit limit & currency validation on Sales Order |
| [`scheduled-scripts/SS_PaymentBatchProcessor.js`](scheduled-scripts/SS_PaymentBatchProcessor.js) | Scheduled Script | Governance-aware nightly payment application batch |
| [`scheduled-scripts/SS_VendorFileSFTPImport.js`](scheduled-scripts/SS_VendorFileSFTPImport.js) | Scheduled Script | End-to-end SFTP file pickup → Vendor Bill creation |
| [`map-reduce/MR_RevenueAmortizationProcessor.js`](map-reduce/MR_RevenueAmortizationProcessor.js) | Map/Reduce | Revenue recognition at volume using the shared journal entry library |
| [`suitelets/SL_OrderToCashDashboard.js`](suitelets/SL_OrderToCashDashboard.js) | Suitelet | Custom Order-to-Cash status dashboard UI |
| [`restlets/RL_PageroInvoiceSync.js`](restlets/RL_PageroInvoiceSync.js) | RESTlet | Inbound/outbound integration endpoint for Pagero e-invoicing |
| [`integrations/Pagero_EInvoiceConnector.js`](integrations/Pagero_EInvoiceConnector.js) | Library module | Reusable Pagero API client (submit invoice, poll status) |
| [`integrations/SFTP_VendorFileIntegration.js`](integrations/SFTP_VendorFileIntegration.js) | Library module | Reusable SFTP connect/download/parse/upload helper |
| [`utils/JournalEntryUtil.js`](utils/JournalEntryUtil.js) | Library module | Shared standard & amortization journal entry creation logic |

## Projects

Multi-script projects that demonstrate one real workflow end to end live
under `projects/`, separate from the per-script-type samples above:

| Project | Demonstrates |
|---|---|
| [`projects/mass-je-approval/`](projects/mass-je-approval/README.md) | Search/filter Suitelet → async Map/Reduce approval batch (via `N/task`) → progress-polling/results Suitelet |

## How the pieces connect

- `MR_RevenueAmortizationProcessor` and `UE_AmortizationInvoiceValidation` both
  rely on the same deferred-revenue convention (`custcol_defer_revenue`,
  service start/end dates), and the Map/Reduce script calls into
  `JournalEntryUtil` rather than building journal entries inline.
- `RL_PageroInvoiceSync` calls `Pagero_EInvoiceConnector` for live status
  rather than embedding `N/https` calls directly in the RESTlet.
- `SS_VendorFileSFTPImport` calls `SFTP_VendorFileIntegration` for the
  connection/parsing, then owns the NetSuite-side record creation itself —
  keeping the transport layer reusable across other vendor file integrations.

## Why this structure

Each script type is isolated so it's easy to see the boundary between
record-level logic (User Event/Client Script), batch/volume processing
(Scheduled/Map-Reduce), custom UI (Suitelet), and external integration
(RESTlet + connector modules) — mirroring how a real SuiteCloud project
would be organized for maintainability across a multi-script implementation.
