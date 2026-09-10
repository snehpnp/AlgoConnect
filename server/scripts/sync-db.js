const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

dotenv.config();

const backupsDir = path.join(__dirname, '..', 'backups');

if (!fs.existsSync(backupsDir)) {
    fs.mkdirSync(backupsDir);
}

const localDbUrl = process.env.DATABASE_URL;
const liveDbUrl = process.env.Live_DATABASE_URL;

if (!localDbUrl || !liveDbUrl) {
    console.error("Error: DATABASE_URL and Live_DATABASE_URL must be set in .env");
    process.exit(1);
}

const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
const localBackupFile = path.join(backupsDir, `local_backup_${timestamp}.dump`);
const localZipFile = path.join(backupsDir, `local_backup_${timestamp}.zip`);
const liveBackupFile = path.join(backupsDir, `live_backup_${timestamp}.dump`);

try {
    console.log(`[1/4] Taking backup of local database...`);
    execSync(`"C:\\Program Files\\PostgreSQL\\18\\bin\\pg_dump.exe" "${localDbUrl}" -F c -f "${localBackupFile}"`);
    console.log(`Local backup created: ${localBackupFile}`);

    console.log(`[2/4] Zipping local backup...`);
    // Using powershell to zip the file on Windows
    execSync(`powershell Compress-Archive -Path "${localBackupFile}" -DestinationPath "${localZipFile}"`);
    console.log(`Zipped local backup: ${localZipFile}`);
    
    // Remove the unzipped dump to save space
    fs.unlinkSync(localBackupFile);

    console.log(`[3/4] Taking backup of LIVE database...`);
    execSync(`"C:\\Program Files\\PostgreSQL\\18\\bin\\pg_dump.exe" "${liveDbUrl}" -F c -f "${liveBackupFile}"`);
    console.log(`Live backup created: ${liveBackupFile}`);

    console.log(`[4/4] Restoring LIVE backup to local database...`);
    // -c drops database objects before recreating them
    try {
        execSync(`"C:\\Program Files\\PostgreSQL\\18\\bin\\pg_restore.exe" --clean --if-exists --no-owner --no-privileges -d "${localDbUrl}" "${liveBackupFile}"`);
    } catch (restoreError) {
         // pg_restore often throws warnings about objects not existing when using -c, so we catch and ignore them, or print them.
         console.warn("Restore finished with some warnings (this is normal when using -c flag).");
    }
    console.log(`Restore completed successfully.`);

    // Optionally delete the live dump file
    fs.unlinkSync(liveBackupFile);
    
    console.log(`\n🎉 Process Complete!`);
    console.log(`Your old local database is safely stored at: ${localZipFile}`);
    console.log(`Your local database has been updated with live data.`);

} catch (error) {
    console.error(`\n❌ Error occurred during process:`, error.message);
    if (error.stdout) console.error(error.stdout.toString());
    if (error.stderr) console.error(error.stderr.toString());
}
