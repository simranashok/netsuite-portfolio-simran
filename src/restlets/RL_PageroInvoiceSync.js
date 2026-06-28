/**
 * @NApiVersion 2.1
 * @NScriptType Restlet
 *
 * RL_PageroInvoiceSync
 * -----------------------
 * Integration endpoint between NetSuite and Pagero. GET hands back the
 * outbound invoice payload Pagero needs to issue an e-invoice; POST
 * receives Pagero's delivery/acceptance status callback and writes it
 * back onto the invoice record. Built on top of the shared
 * Pagero_EInvoiceConnector module rather than embedding HTTP calls here.
 *
 * Reference/illustrative implementation written to demonstrate the
 * pattern — not derived from any employer or client codebase.
 */
define(
    ['N/record', 'N/search', 'N/runtime', 'N/log', '../integrations/Pagero_EInvoiceConnector'],
    (record, search, runtime, log, pageroConnector) => {

        function get(params) {
            const invoiceId = params.invoiceId;
            if (!invoiceId) {
                return errorResponse('invoiceId parameter is required');
            }

            const lookup = search.lookupFields({
                type: search.Type.INVOICE,
                id: invoiceId,
                columns: ['tranid', 'entity', 'total', 'currency', 'duedate', 'custbody_pagero_invoice_id']
            });

            const invoicePayload = {
                invoiceNumber: lookup.tranid,
                customer: lookup.entity[0].text,
                total: lookup.total,
                currency: lookup.currency[0].text,
                dueDate: lookup.duedate
            };

            const pageroInvoiceId = lookup.custbody_pagero_invoice_id;
            if (pageroInvoiceId) {
                invoicePayload.pageroStatus = fetchLiveStatus(pageroInvoiceId);
            }

            return { success: true, invoice: invoicePayload };
        }

        function fetchLiveStatus(pageroInvoiceId) {
            try {
                const client = pageroConnector.createClient({
                    apiKey: runtime.getCurrentScript().getParameter({ name: 'custscript_pagero_api_key' })
                });
                return client.getInvoiceStatus(pageroInvoiceId);
            } catch (e) {
                log.error({ title: `Could not fetch live Pagero status for ${pageroInvoiceId}`, details: e });
                return null;
            }
        }

        function post(requestBody) {
            const { invoiceId, pageroInvoiceId, status } = requestBody;

            if (!invoiceId || !status) {
                return errorResponse('invoiceId and status are required');
            }

            try {
                record.submitFields({
                    type: record.Type.INVOICE,
                    id: invoiceId,
                    values: {
                        custbody_pagero_invoice_id: pageroInvoiceId,
                        custbody_pagero_status: status
                    }
                });

                log.audit({ title: 'Pagero status updated', details: `Invoice ${invoiceId} -> ${status}` });
                return { success: true };
            } catch (e) {
                log.error({ title: `Failed to update invoice ${invoiceId} from Pagero callback`, details: e });
                return errorResponse(e.message);
            }
        }

        function errorResponse(message) {
            return { success: false, error: message };
        }

        return { get, post };
    }
);
