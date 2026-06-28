/**
 * @NApiVersion 2.1
 * @NScriptType Suitelet
 *
 * SL_MassJEApproval
 * -------------------
 * Search/filter page for the Mass JE Approval project: lists journal
 * entries pending approval, filtered by date range, subsidiary, and name,
 * with Mark All / Unmark All and an Approve action. Approve hands the
 * marked JEs to MR_MassJEApprovalProcessor via N/task (so a batch of any
 * size is safe from Suitelet governance/timeout) and redirects to
 * SL_MassJEApprovalResults to track progress and show the outcome.
 *
 * Reference/illustrative implementation written to demonstrate the
 * pattern — not derived from any employer or client codebase.
 */
define(['N/ui/serverWidget', 'N/search', 'N/task', 'N/runtime', 'N/http'], (serverWidget, search, task, runtime, http) => {

    const SUBLIST_ID = 'pendingje';
    const MARK_FIELD_ID = 'mark';
    const ACTION_FIELD_ID = 'custpage_action';
    const APPROVAL_STATUS_PENDING = '1'; // NetSuite's standard Approval Status list value for "Pending Approval"
    const DEFAULT_PAGE_SIZE = 50;

    // Placeholder script/deployment ids for the other two scripts in this project.
    const MR_SCRIPT_ID = 'customscript_mjea_processor';
    const MR_DEPLOYMENT_ID = 'customdeploy_mjea_processor';
    const RESULTS_SCRIPT_ID = 'customscript_sl_mjea_results';
    const RESULTS_DEPLOYMENT_ID = 'customdeploy_sl_mjea_results';

    function onRequest(context) {
        if (context.request.method === 'GET') {
            renderSearchForm(context, {});
            return;
        }

        if (context.request.parameters[ACTION_FIELD_ID] === 'approve') {
            handleApprove(context);
        } else {
            renderSearchForm(context, context.request.parameters);
        }
    }

    function renderSearchForm(context, filters) {
        const form = buildForm(filters);
        addPendingJESublist(form, filters);
        context.response.writePage(form);
    }

    function buildForm(filters) {
        const form = serverWidget.createForm({ title: 'Mass JE Approval' });
        form.clientScriptModulePath = './CS_MassJEApproval.js';

        form.addFieldGroup({ id: 'filters', label: 'Filters' });

        const dateFromField = form.addField({
            id: 'custpage_datefrom', type: serverWidget.FieldType.DATE, label: 'Date From', container: 'filters'
        });
        dateFromField.defaultValue = filters.custpage_datefrom;

        const dateToField = form.addField({
            id: 'custpage_dateto', type: serverWidget.FieldType.DATE, label: 'Date To', container: 'filters'
        });
        dateToField.defaultValue = filters.custpage_dateto;

        const subsidiaryField = form.addField({
            id: 'custpage_subsidiary', type: serverWidget.FieldType.SELECT, label: 'Subsidiary', source: 'subsidiary', container: 'filters'
        });
        subsidiaryField.defaultValue = filters.custpage_subsidiary;

        const nameField = form.addField({
            id: 'custpage_name', type: serverWidget.FieldType.TEXT, label: 'Name', container: 'filters'
        });
        nameField.defaultValue = filters.custpage_name;

        const pageSizeField = form.addField({
            id: 'custpage_pagesize', type: serverWidget.FieldType.SELECT, label: 'Page Size', container: 'filters'
        });
        [10, 25, 50, 100].forEach((size) => pageSizeField.addSelectOption({ value: String(size), text: String(size) }));
        pageSizeField.defaultValue = String(filters.custpage_pagesize || DEFAULT_PAGE_SIZE);

        const actionField = form.addField({ id: ACTION_FIELD_ID, type: serverWidget.FieldType.TEXT, label: 'Action' });
        actionField.updateDisplayType({ displayType: serverWidget.FieldDisplayType.HIDDEN });

        form.addSubmitButton({ label: 'Search' });
        form.addButton({ id: 'custpage_refresh', label: 'Refresh', functionName: 'triggerRefresh' });
        form.addButton({ id: 'custpage_markall', label: 'Mark All', functionName: 'markAll' });
        form.addButton({ id: 'custpage_unmarkall', label: 'Unmark All', functionName: 'unmarkAll' });
        form.addButton({ id: 'custpage_approve', label: 'Approve', functionName: 'triggerApprove' });

        return form;
    }

    function addPendingJESublist(form, filters) {
        const sublist = form.addSublist({ id: SUBLIST_ID, type: serverWidget.SublistType.LIST, label: 'Pending Journal Entries' });
        sublist.addField({ id: MARK_FIELD_ID, type: serverWidget.FieldType.CHECKBOX, label: 'Mark' });
        sublist.addField({ id: 'internalid', type: serverWidget.FieldType.TEXT, label: 'Internal ID' });
        sublist.addField({ id: 'name', type: serverWidget.FieldType.TEXT, label: 'Name' });
        sublist.addField({ id: 'businessprocess', type: serverWidget.FieldType.TEXT, label: 'Business Process' });
        sublist.addField({ id: 'memo', type: serverWidget.FieldType.TEXT, label: 'Memo' });
        sublist.addField({ id: 'subsidiary', type: serverWidget.FieldType.TEXT, label: 'Subsidiary' });
        sublist.addField({ id: 'period', type: serverWidget.FieldType.TEXT, label: 'Period' });

        const pageSize = parseInt(filters.custpage_pagesize, 10) || DEFAULT_PAGE_SIZE;
        const results = findPendingJEs(filters).getRange({ start: 0, end: pageSize });

        results.forEach((result, line) => {
            sublist.setSublistValue({ id: 'internalid', line, value: result.getValue('internalid') });
            sublist.setSublistValue({ id: 'name', line, value: result.getText('entity') });
            sublist.setSublistValue({ id: 'businessprocess', line, value: result.getText('custbody_business_process') });
            sublist.setSublistValue({ id: 'memo', line, value: result.getValue('memo') });
            sublist.setSublistValue({ id: 'subsidiary', line, value: result.getText('subsidiary') });
            sublist.setSublistValue({ id: 'period', line, value: result.getText('postingperiod') });
        });
    }

    function findPendingJEs(filters) {
        const currentUserId = runtime.getCurrentUser().id;

        // Always-on rules, not exposed as filters: only pending JEs in an open,
        // unlocked period, excluding JEs created by the approver themselves
        // (segregation of duties).
        const searchFilters = [
            ['mainline', 'is', 'T'],
            'AND', ['approvalstatus', 'anyof', APPROVAL_STATUS_PENDING],
            'AND', ['postingperiod.closed', 'is', 'F'],
            'AND', ['postingperiod.alllocked', 'is', 'F'],
            'AND', ['createdby', 'noneof', currentUserId]
        ];

        if (filters.custpage_datefrom) {
            searchFilters.push('AND', ['trandate', 'onorafter', filters.custpage_datefrom]);
        }
        if (filters.custpage_dateto) {
            searchFilters.push('AND', ['trandate', 'onorbefore', filters.custpage_dateto]);
        }
        if (filters.custpage_subsidiary) {
            searchFilters.push('AND', ['subsidiary', 'anyof', filters.custpage_subsidiary]);
        }
        if (filters.custpage_name) {
            searchFilters.push('AND', ['entity', 'contains', filters.custpage_name]);
        }

        return search.create({
            type: search.Type.JOURNAL_ENTRY,
            filters: searchFilters,
            columns: ['internalid', 'entity', 'custbody_business_process', 'memo', 'subsidiary', 'postingperiod']
        }).run();
    }

    function handleApprove(context) {
        const ids = getMarkedJEIds(context.request);

        if (!ids.length) {
            renderSearchForm(context, context.request.parameters);
            return;
        }

        const batchId = String(Date.now());

        const mrTask = task.create({
            taskType: task.TaskType.MAP_REDUCE,
            scriptId: MR_SCRIPT_ID,
            deploymentId: MR_DEPLOYMENT_ID,
            params: {
                custscript_mjea_je_ids: ids.join(','),
                custscript_mjea_batch_id: batchId
            }
        });
        const taskId = mrTask.submit();

        context.response.sendRedirect({
            type: http.RedirectType.SUITELET,
            identifier: RESULTS_SCRIPT_ID,
            id: RESULTS_DEPLOYMENT_ID,
            parameters: { taskid: taskId, batchid: batchId }
        });
    }

    function getMarkedJEIds(request) {
        const lineCount = request.getLineCount({ group: SUBLIST_ID });
        const ids = [];

        for (let line = 0; line < lineCount; line += 1) {
            const marked = request.getSublistValue({ group: SUBLIST_ID, name: MARK_FIELD_ID, line });
            if (marked === 'T') {
                ids.push(request.getSublistValue({ group: SUBLIST_ID, name: 'internalid', line }));
            }
        }

        return ids;
    }

    return { onRequest };
});
