/**
 * @NApiVersion 2.1
 * @NScriptType ClientScript
 *
 * CS_SalesOrderCreditValidation
 * ------------------------------
 * Client-side guardrail for the Lead-to-Cash / Order-to-Cash flow. Warns
 * the rep in real time if a Sales Order would push a customer over their
 * credit limit or mixes a transaction currency that doesn't match the
 * customer's primary currency, instead of letting that surface later as
 * a failed fulfillment or billing run.
 *
 * Reference/illustrative implementation written to demonstrate the
 * pattern — not derived from any employer or client codebase.
 */
define(['N/currentRecord', 'N/search', 'N/ui/dialog'], (currentRecord, search, dialog) => {

    function fieldChanged(context) {
        if (context.fieldId !== 'entity' && context.fieldId !== 'currency') {
            return;
        }

        const rec = context.currentRecord;
        const customerId = rec.getValue({ fieldId: 'entity' });
        if (!customerId) {
            return;
        }

        validateCurrency(rec, customerId);
    }

    function saveRecord(context) {
        const rec = context.currentRecord;
        const customerId = rec.getValue({ fieldId: 'entity' });
        const orderTotal = rec.getValue({ fieldId: 'total' });

        if (!customerId) {
            return true;
        }

        const { creditLimit, balance } = lookupCustomerCredit(customerId);

        if (creditLimit && (balance + orderTotal) > creditLimit) {
            dialog.alert({
                title: 'Credit Limit Exceeded',
                message: `This order brings the customer's balance to ${balance + orderTotal}, which exceeds their credit limit of ${creditLimit}. Manager approval is required before submitting.`
            });
            return false;
        }

        return true;
    }

    function validateCurrency(rec, customerId) {
        const lookup = search.lookupFields({
            type: search.Type.CUSTOMER,
            id: customerId,
            columns: ['currency']
        });

        const customerCurrency = lookup.currency && lookup.currency[0] && lookup.currency[0].value;
        const orderCurrency = rec.getValue({ fieldId: 'currency' });

        if (customerCurrency && orderCurrency && customerCurrency !== orderCurrency) {
            dialog.alert({
                title: 'Currency Mismatch',
                message: 'The transaction currency does not match this customer\'s primary currency. Confirm this is intentional before proceeding.'
            });
        }
    }

    function lookupCustomerCredit(customerId) {
        const lookup = search.lookupFields({
            type: search.Type.CUSTOMER,
            id: customerId,
            columns: ['creditlimit', 'balance']
        });

        return {
            creditLimit: parseFloat(lookup.creditlimit) || 0,
            balance: parseFloat(lookup.balance) || 0
        };
    }

    return { fieldChanged, saveRecord };
});
