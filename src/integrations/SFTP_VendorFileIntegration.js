/**
 * @NApiVersion 2.1
 * @NModuleScope Public
 *
 * SFTP_VendorFileIntegration
 * -----------------------------
 * Reusable SFTP connector for vendor/bank file integrations — connects,
 * downloads a delimited file from the remote directory, and parses it
 * into plain row objects ready for a calling script (typically a
 * Scheduled Script) to turn into NetSuite records. Connection details
 * are passed in rather than hardcoded so the same module supports
 * multiple vendor connections.
 *
 * Reference/illustrative implementation written to demonstrate the
 * pattern — not derived from any employer or client codebase.
 */
define(['N/sftp', 'N/log'], (sftp, log) => {

    /**
     * @param {Object} options
     * @param {string} options.url
     * @param {number} options.port
     * @param {string} options.username
     * @param {string} options.guid       NetSuite SFTP password/key guid from a secret credential field
     * @param {number} options.hostKeyId
     */
    function connect(options) {
        return sftp.createConnection({
            url: options.url,
            port: options.port,
            username: options.username,
            passwordGuid: options.guid,
            hostKey: options.hostKey,
            hostKeyType: options.hostKeyType || 'rsa-sha2-256',
            directory: options.directory || '/'
        });
    }

    /**
     * Downloads a file and parses it as delimited rows.
     *
     * @param {Object} connection   result of connect()
     * @param {string} filename
     * @param {string} [delimiter]  defaults to comma
     * @returns {Array<Object>} parsed rows keyed by header column name
     */
    function downloadAndParse(connection, filename, delimiter) {
        const file = connection.download({ filename });
        const contents = file.getContents();
        return parseDelimited(contents, delimiter || ',');
    }

    /**
     * Uploads a generated file (e.g. an outbound remittance advice) to the
     * vendor's SFTP directory.
     */
    function uploadFile(connection, file) {
        connection.upload({ file, replaceExisting: true });
        log.audit({ title: 'SFTP upload complete', details: file.name });
    }

    function parseDelimited(contents, delimiter) {
        const lines = contents.split(/\r?\n/).filter((line) => line.trim().length > 0);
        if (lines.length === 0) {
            return [];
        }

        const headers = lines[0].split(delimiter).map((h) => h.trim());
        return lines.slice(1).map((line) => {
            const values = line.split(delimiter);
            const row = {};
            headers.forEach((header, index) => {
                row[header] = (values[index] || '').trim();
            });
            return row;
        });
    }

    return { connect, downloadAndParse, uploadFile };
});
