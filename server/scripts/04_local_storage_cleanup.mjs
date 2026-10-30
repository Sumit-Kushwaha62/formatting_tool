/**
 * ==============================================================================
 * FORMAT STUDIO — LOCAL WORKSPACE FILE STORAGE CLEANUP UTILITY
 * ==============================================================================
 * MACHINE / FILESYSTEM SCOPE:
 * This script operates strictly on the LOCAL DEVELOPER MACHINE / WORKSPACE FILESYSTEM.
 * NOTE: Running this script locally DOES NOT clean hosted Render backend storage.
 * (Render filesystem cleanup requires restarting or redeploying ephemeral instances).
 *
 * SAFETY GUARDS:
 * 1. Uses path.relative-based containment checks to guarantee target directories
 *    remain strictly within server/uploads and server/outputs.
 * 2. Validates realpath to reject symlink and junction escapes across all path components.
 * 3. Preserves .gitkeep, .gitignore, and structural directory files.
 * 4. Defaults to DRY-RUN mode.
 * 5. Accurately reports skipped entries and errors; returns nonzero exit code on failure.
 *
 * USAGE:
 *   # Preview mode (Dry Run):
 *   node server/scripts/04_local_storage_cleanup.mjs
 *
 *   # Execution mode (Destructive - Pending Review):
 *   $env:EXECUTE_FILE_CLEANUP="true"
 *   node server/scripts/04_local_storage_cleanup.mjs
 * ==============================================================================
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

/**
 * Validates that target directory is strictly contained within the allowed parent directory.
 * Uses path.relative and realpath checks to prevent sibling prefixes and symlink/junction escapes.
 *
 * @param {string} targetDir
 * @param {string} allowedParentDir
 * @returns {boolean}
 */
export function isSafeDirectory(targetDir, allowedParentDir) {
  if (typeof targetDir !== 'string' || typeof allowedParentDir !== 'string') {
    return false;
  }

  const resolvedTarget = path.resolve(targetDir);
  const resolvedParent = path.resolve(allowedParentDir);

  // Containment check via path.relative
  const rel = path.relative(resolvedParent, resolvedTarget);
  if (!rel || rel === '' || rel.startsWith('..') || path.isAbsolute(rel)) {
    return false;
  }

  // Prevent sibling prefixes (e.g. 'server/uploads_sibling')
  // The first segment must be an immediate child or subpath within allowedParent
  const segments = rel.split(path.sep);
  if (segments.length === 0 || segments[0] === '..') {
    return false;
  }

  // If path exists on disk, check realpath to guarantee no symlink/junction escape
  if (fs.existsSync(resolvedTarget) && fs.existsSync(resolvedParent)) {
    try {
      const realTarget = fs.realpathSync(resolvedTarget);
      const realParent = fs.realpathSync(resolvedParent);
      const realRel = path.relative(realParent, realTarget);
      if (!realRel || realRel === '' || realRel.startsWith('..') || path.isAbsolute(realRel)) {
        return false;
      }
    } catch {
      return false;
    }
  }

  return true;
}

/**
 * Scans and cleans safe files from the target directory.
 * @param {string} dirPath
 * @param {boolean} execute
 * @returns {{ found: number, deleted: number, skipped: number, errors: string[] }}
 */
export function processDirectory(dirPath, execute = false) {
  const result = { found: 0, deleted: 0, skipped: 0, errors: [] };

  if (!fs.existsSync(dirPath)) {
    return result;
  }

  let stat;
  try {
    stat = fs.lstatSync(dirPath);
  } catch (err) {
    result.errors.push(`Failed to stat directory '${dirPath}': ${err.message}`);
    return result;
  }

  if (stat.isSymbolicLink() || !stat.isDirectory()) {
    result.errors.push(`Target path '${dirPath}' is not a standard directory or is a symlink`);
    return result;
  }

  let entries;
  try {
    entries = fs.readdirSync(dirPath);
  } catch (err) {
    result.errors.push(`Failed to read directory '${dirPath}': ${err.message}`);
    return result;
  }

  for (const entry of entries) {
    // Preserve git keep and structural files
    if (entry === '.gitkeep' || entry === '.gitignore') {
      result.skipped += 1;
      continue;
    }

    const fullPath = path.join(dirPath, entry);

    try {
      const entryStat = fs.lstatSync(fullPath);

      if (entryStat.isSymbolicLink()) {
        result.skipped += 1;
        result.errors.push(`Skipped symbolic link: ${entry}`);
        continue;
      }

      if (entryStat.isFile()) {
        result.found += 1;
        if (execute) {
          fs.unlinkSync(fullPath);
          result.deleted += 1;
        }
      } else {
        result.skipped += 1;
      }
    } catch (err) {
      result.errors.push(`Error processing file '${entry}': ${err.message}`);
    }
  }

  return result;
}

export async function runLocalStorageCleanup(envOverrides = {}) {
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);

  const serverDir = path.resolve(__dirname, '..');
  const targetDirs = [
    path.join(serverDir, 'uploads'),
    path.join(serverDir, 'outputs'),
  ];

  const env = { ...process.env, ...envOverrides };
  const isExecuteMode = env.EXECUTE_FILE_CLEANUP === 'true';

  console.log('=== FORMAT STUDIO LOCAL FILE STORAGE CLEANUP ===');
  console.log('SCOPE: Local Developer Workspace Filesystem Only');
  console.log('NOTICE: This local utility does NOT modify hosted Render storage.');
  console.log(`Execution Mode: ${isExecuteMode ? '🔴 LIVE DELETION' : '🟢 DRY RUN (PREVIEW ONLY)'}\n`);

  let totalFound = 0;
  let totalDeleted = 0;
  let totalSkipped = 0;
  let allErrors = [];

  for (const dir of targetDirs) {
    if (!isSafeDirectory(dir, serverDir)) {
      const err = `[SECURITY ERROR] Target directory '${dir}' escapes server boundary.`;
      console.error(err);
      return { success: false, found: totalFound, deleted: totalDeleted, errors: [err] };
    }

    const { found, deleted, skipped, errors } = processDirectory(dir, isExecuteMode);
    console.log(`Directory: ${path.relative(serverDir, dir)}`);
    console.log(`  Eligible Files Found: ${found}`);
    if (isExecuteMode) {
      console.log(`  Files Deleted:        ${deleted}`);
    }
    console.log(`  Entries Skipped:      ${skipped}`);

    totalFound += found;
    totalDeleted += deleted;
    totalSkipped += skipped;
    allErrors = allErrors.concat(errors);
  }

  console.log('\n--- CLEANUP SUMMARY ---');
  console.log(`Total eligible files: ${totalFound}`);
  if (isExecuteMode) {
    console.log(`Total deleted:        ${totalDeleted}`);
  }
  console.log(`Total skipped:        ${totalSkipped}`);

  if (allErrors.length > 0) {
    console.error('\nEncountered issues during scan/cleanup:');
    for (const err of allErrors) {
      console.error(`  - ${err}`);
    }
    return { success: false, found: totalFound, deleted: totalDeleted, errors: allErrors };
  }

  if (isExecuteMode && totalDeleted !== totalFound) {
    const err = 'Mismatch between identified files and deleted files.';
    console.error(`[ERROR] ${err}`);
    return { success: false, found: totalFound, deleted: totalDeleted, errors: [err] };
  }

  console.log('Clean run completed.');
  return { success: true, found: totalFound, deleted: totalDeleted, errors: [] };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  runLocalStorageCleanup()
    .then((res) => {
      if (!res.success) {
        process.exitCode = 1;
      }
    })
    .catch((err) => {
      console.error('[FATAL ERROR]:', err.message);
      process.exitCode = 1;
    });
}
