/**
 * @NApiVersion 2.1
 * @NScriptType Suitelet
 *
 * SL_MassJEApprovalResults
 * --------------------------
 * Processing/results page for the Mass JE Approval project. SL_MassJEApproval
 * redirects here after handing a batch to MR_MassJEApprovalProcessor via
 * N/task. While the task is still running, this page auto-refreshes itself
 * every 5 seconds; once the task completes, it reads the cached batch
 * results written by the Map/Reduce summarize stage and lists each journal
 * entry with a link back to the record.
 *
 * Reference/illustrative implementation written to demonstrate the
 * pattern — not derived from any employer or client codebase.
 */
define(['N/ui/serverWidget', 'N/task', 'N/cache', 'N/url', 'N/runtime', 'N/record'],
    (serverWidget, task, cache, url, runtime, record) => {

    const CACHE_NAME = 'mass_je_approval';
    const REFRESH_SECONDS = 5;

    // Placeholder script/deployment id for SL_MassJEApproval, used for the "back to search" link.
    const SEARCH_SCRIPT_ID = 'customscript_sl_mjea_search';
    const SEARCH_DEPLOYMENT_ID = 'customdeploy_sl_mjea_search';

    function onRequest(context) {
        const taskId = context.request.parameters.taskid;
        const batchId = context.request.parameters.batchid;
        const status = task.checkStatus({ taskId }).status;

        if (status === task.TaskStatus.COMPLETE) {
            renderResults(context, batchId);
        } else if (status === task.TaskStatus.FAILED) {
            renderFailed(context);
        } else {
            renderProcessing(context, taskId, batchId);
        }
    }

    function renderProcessing(context, taskId, batchId) {
        const form = serverWidget.createForm({ title: 'Approving Journal Entries…' });
        addBackLink(form);

        const selfUrl = url.resolveScript({
            scriptId: runtime.getCurrentScript().id,
            deploymentId: runtime.getCurrentScript().deploymentId,
            params: { taskid: taskId, batchid: batchId }
        });

        const statusField = form.addField({ id: 'custpage_status', type: serverWidget.FieldType.INLINEHTML, label: ' ' });
        statusField.defaultValue = `<meta http-equiv="refresh" content="${REFRESH_SECONDS};url=${selfUrl}">`
            + `<p>Processing batch ${escapeHtml(batchId)}… this page refreshes automatically every ${REFRESH_SECONDS} seconds.</p>`;

        context.response.writePage(form);
    }

    function renderResults(context, batchId) {
        const form = serverWidget.createForm({ title: 'Mass JE Approval — Results' });
        addBackLink(form);

        const sublist = form.addSublist({ id: 'results', type: serverWidget.SublistType.LIST, label: 'Approval Results' });
        sublist.addField({ id: 'internalid', type: serverWidget.FieldType.TEXT, label: 'Internal ID' });
        sublist.addField({ id: 'tranid', type: serverWidget.FieldType.TEXT, label: 'Tran ID' });
        sublist.addField({ id: 'status', type: serverWidget.FieldType.TEXT, label: 'Status' });
        sublist.addField({ id: 'view', type: serverWidget.FieldType.URL, label: 'View' });

        readCachedResults(batchId).forEach((result, line) => {
            sublist.setSublistValue({ id: 'internalid', line, value: result.id });
            sublist.setSublistValue({ id: 'tranid', line, value: result.tranid || '' });
            sublist.setSublistValue({ id: 'status', line, value: result.status });
            sublist.setSublistValue({
                id: 'view',
                line,
                value: url.resolveRecord({ recordType: record.Type.JOURNAL_ENTRY, recordId: result.id, isEditMode: false })
            });
        });

        context.response.writePage(form);
    }

    function renderFailed(context) {
        const form = serverWidget.createForm({ title: 'Mass JE Approval — Failed' });
        addBackLink(form);

        const message = form.addField({ id: 'custpage_message', type: serverWidget.FieldType.INLINEHTML, label: ' ' });
        message.defaultValue = '<p>The approval batch failed. Check the script execution log for details.</p>';

        context.response.writePage(form);
    }

    function readCachedResults(batchId) {
        const cacheInstance = cache.getCache({ name: CACHE_NAME, scope: cache.Scope.PROTECTED });
        const cached = cacheInstance.get({ key: `results_${batchId}` });
        return cached ? JSON.parse(cached) : [];
    }

    function addBackLink(form) {
        const searchUrl = url.resolveScript({ scriptId: SEARCH_SCRIPT_ID, deploymentId: SEARCH_DEPLOYMENT_ID });
        const field = form.addField({ id: 'custpage_backlink', type: serverWidget.FieldType.INLINEHTML, label: ' ' });
        field.defaultValue = `<p><a href="${searchUrl}">&larr; Back to Search</a></p>`;
    }

    function escapeHtml(value) {
        return String(value).replace(/[&<>"']/g, (ch) => ({
            '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
        }[ch]));
    }

    return { onRequest };
});
