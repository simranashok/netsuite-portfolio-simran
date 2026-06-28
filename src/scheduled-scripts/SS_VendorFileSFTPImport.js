/**
 * @NApiVersion 2.1
 * @NScriptType ScheduledScript
 *
 * SS_VendorFileSFTPImport
 * --------------------------
 * Nightly pickup of a vendor remittance/billing file over SFTP, parsed
 * into rows by the shared SFTP_VendorFileIntegration module and turned
 * into Vendor Bill records. Connection details are read from script
 * parameters so the same script can be deployed per vendor connection
 * without code changes.
 *
 * Reference/illustrative implementation written to demonstrate the
 * pattern — not derived from any employer or client codebase.
 */
define(
    ['N/record', 'N/runtime', 'N/log', '../integrations/SFTP_VendorFileIntegration'],
    (record, runtime, log, sftpIntegration) => {

        function execute() {
            const script = runtime.getCurrentScript();

            const connection = sftpIntegration.connect({
                url: script.getParameter({ name: 'custscript_sftp_url' }),
                port: script.getParameter({ name: 'custscript_sftp_port' }) || 22,
                username: script.getParameter({ name: 'custscript_sftp_username' }),
                guid: script.getParameter({ name: 'custscript_sftp_password_guid' }),
                directory: script.getParameter({ name: 'custscript_sftp_directory' }) || '/outbound'
            });

            const filename = script.getParameter({ name: 'custscript_sftp_filename' });
            const rows = sftpIntegration.downloadAndParse(connection, filename);

            let created = 0;
            let failed = 0;

            rows.forEach((row) => {
                try {
                    createVendorBillFromRow(row);
                    created += 1;
                } catch (e) {
                    failed += 1;
                    log.error({ title: `Failed to create vendor bill from row`, details: { row, error: e.message } });
                }
            });

            log.audit({ title: 'SFTP vendor file import complete', details: `Created: ${created}, Failed: ${failed}` });
        }

        function createVendorBillFromRow(row) {
            const bill = record.create({ type: record.Type.VENDOR_BILL, isDynamic: true });

            bill.setValue({ fieldId: 'entity', value: row.vendorId });
            bill.setValue({ fieldId: 'trandate', value: new Date(row.invoiceDate) });
            bill.setValue({ fieldId: 'duedate', value: new Date(row.dueDate) });
            bill.setValue({ fieldId: 'tranid', value: row.invoiceNumber });

            bill.selectNewLine({ sublistId: 'expense' });
            bill.setCurrentSublistValue({ sublistId: 'expense', fieldId: 'account', value: row.expenseAccount });
            bill.setCurrentSublistValue({ sublistId: 'expense', fieldId: 'amount', value: parseFloat(row.amount) });
            bill.commitLine({ sublistId: 'expense' });

            return bill.save({ enableSourcing: true });
        }

        return { execute };
    }
);
