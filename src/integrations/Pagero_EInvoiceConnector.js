/**
 * @NApiVersion 2.1
 * @NModuleScope Public
 *
 * Pagero_EInvoiceConnector
 * --------------------------
 * Reusable connector for the Pagero e-invoicing network. Wraps auth and
 * the two operations the rest of the codebase needs — submitting an
 * invoice for outbound e-invoicing and polling delivery status — so
 * RL_PageroInvoiceSync and any scheduled retry job share one
 * implementation instead of each rolling their own HTTP calls.
 *
 * Reference/illustrative implementation written to demonstrate the
 * pattern — not derived from any employer or client codebase. Endpoint
 * paths and payload shapes are illustrative and would be replaced with
 * the actual Pagero API contract in a real integration.
 */
define(['N/https', 'N/log'], (https, log) => {

    const BASE_URL = 'https://api.pagero.com/v2';

    /**
     * @param {Object} credentials
     * @param {string} credentials.apiKey
     */
    function createClient(credentials) {
        const headers = {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${credentials.apiKey}`
        };

        return {
            submitInvoice: (invoicePayload) => submitInvoice(headers, invoicePayload),
            getInvoiceStatus: (pageroInvoiceId) => getInvoiceStatus(headers, pageroInvoiceId)
        };
    }

    function submitInvoice(headers, invoicePayload) {
        const response = https.post({
            url: `${BASE_URL}/invoices`,
            headers,
            body: JSON.stringify(invoicePayload)
        });

        if (response.code >= 400) {
            log.error({ title: 'Pagero submitInvoice failed', details: `HTTP ${response.code}: ${response.body}` });
            throw new Error(`Pagero submitInvoice failed with status ${response.code}`);
        }

        return JSON.parse(response.body);
    }

    function getInvoiceStatus(headers, pageroInvoiceId) {
        const response = https.get({
            url: `${BASE_URL}/invoices/${pageroInvoiceId}/status`,
            headers
        });

        if (response.code >= 400) {
            log.error({ title: 'Pagero getInvoiceStatus failed', details: `HTTP ${response.code}: ${response.body}` });
            throw new Error(`Pagero getInvoiceStatus failed with status ${response.code}`);
        }

        return JSON.parse(response.body);
    }

    return { createClient };
});
