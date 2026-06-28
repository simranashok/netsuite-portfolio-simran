/**
 * @NApiVersion 2.1
 * @NScriptType Suitelet
 *
 * SL_OrderToCashDashboard
 * -------------------------
 * Self-contained Order-to-Cash status dashboard: open sales orders,
 * unbilled fulfillments, and overdue invoices in one screen, with a
 * date-range filter. Built as a Suitelet rather than a saved search
 * bundle so the page can combine multiple result sets and basic
 * cross-filtering in a single custom UI.
 *
 * Reference/illustrative implementation written to demonstrate the
 * pattern — not derived from any employer or client codebase.
 */
define(['N/ui/serverWidget', 'N/search'], (serverWidget, search) => {

    function onRequest(context) {
        if (context.request.method === 'GET') {
            renderDashboard(context);
        }
    }

    function renderDashboard(context) {
        const fromDate = context.request.parameters.fromdate || defaultFromDate();

        const form = serverWidget.createForm({ title: 'Order to Cash Dashboard' });

        const filterGroup = form.addFieldGroup({ id: 'filters', label: 'Filters' });
        const fromDateField = form.addField({
            id: 'fromdate',
            type: serverWidget.FieldType.DATE,
            label: 'From Date',
            container: 'filters'
        });
        fromDateField.defaultValue = fromDate;

        form.addSubmitButton({ label: 'Refresh' });

        addOpenOrdersSublist(form, fromDate);
        addOverdueInvoicesSublist(form, fromDate);

        context.response.writePage(form);
    }

    function addOpenOrdersSublist(form, fromDate) {
        const sublist = form.addSublist({
            id: 'open_orders',
            type: serverWidget.SublistType.LIST,
            label: 'Open Sales Orders'
        });
        sublist.addField({ id: 'tranid', type: serverWidget.FieldType.TEXT, label: 'Order #' });
        sublist.addField({ id: 'entity', type: serverWidget.FieldType.TEXT, label: 'Customer' });
        sublist.addField({ id: 'amount', type: serverWidget.FieldType.CURRENCY, label: 'Amount' });
        sublist.addField({ id: 'status', type: serverWidget.FieldType.TEXT, label: 'Status' });

        const results = search.create({
            type: search.Type.SALES_ORDER,
            filters: [['mainline', 'is', 'T'], 'AND', ['status', 'anyof', 'SalesOrd:B', 'SalesOrd:D'], 'AND', ['trandate', 'onorafter', fromDate]],
            columns: ['tranid', 'entity', 'amount', 'statusref']
        }).run().getRange({ start: 0, end: 50 });

        results.forEach((result, line) => {
            sublist.setSublistValue({ id: 'tranid', line, value: result.getValue('tranid') });
            sublist.setSublistValue({ id: 'entity', line, value: result.getText('entity') });
            sublist.setSublistValue({ id: 'amount', line, value: result.getValue('amount') });
            sublist.setSublistValue({ id: 'status', line, value: result.getText('statusref') });
        });
    }

    function addOverdueInvoicesSublist(form, fromDate) {
        const sublist = form.addSublist({
            id: 'overdue_invoices',
            type: serverWidget.SublistType.LIST,
            label: 'Overdue Invoices'
        });
        sublist.addField({ id: 'tranid', type: serverWidget.FieldType.TEXT, label: 'Invoice #' });
        sublist.addField({ id: 'entity', type: serverWidget.FieldType.TEXT, label: 'Customer' });
        sublist.addField({ id: 'duedate', type: serverWidget.FieldType.TEXT, label: 'Due Date' });
        sublist.addField({ id: 'amountremaining', type: serverWidget.FieldType.CURRENCY, label: 'Balance' });

        const results = search.create({
            type: search.Type.INVOICE,
            filters: [['mainline', 'is', 'T'], 'AND', ['status', 'anyof', 'CustInvc:A'], 'AND', ['duedate', 'before', 'today'], 'AND', ['trandate', 'onorafter', fromDate]],
            columns: ['tranid', 'entity', 'duedate', 'amountremaining']
        }).run().getRange({ start: 0, end: 50 });

        results.forEach((result, line) => {
            sublist.setSublistValue({ id: 'tranid', line, value: result.getValue('tranid') });
            sublist.setSublistValue({ id: 'entity', line, value: result.getText('entity') });
            sublist.setSublistValue({ id: 'duedate', line, value: result.getValue('duedate') });
            sublist.setSublistValue({ id: 'amountremaining', line, value: result.getValue('amountremaining') });
        });
    }

    function defaultFromDate() {
        const date = new Date();
        date.setMonth(date.getMonth() - 1);
        return date;
    }

    return { onRequest };
});
