const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const REQUIRED_ARTIFACTS = [
  'surevideotool_cam_pipe_publisher.exe',
  'surevideotool_cam_registrar.exe',
  'SurevideotoolVirtualCamera.dll',
  'SurevideotoolVirtualCameraMF.dll'
];

const appDir = path.resolve(__dirname, '..');
const repoRoot = path.resolve(appDir, '..');
const nativeCameraDir = path.join(repoRoot, 'native-camera');
const nativeBuildScript = path.join(nativeCameraDir, 'build.ps1');
const config = process.env.SUREVIDEOTOOL_NATIVE_CONFIG || 'Release';
const arch = process.env.SUREVIDEOTOOL_NATIVE_ARCH || 'x64';
const outputDir = path.join(nativeCameraDir, 'build', config);

function fail(message) {
  process.stderr.write(`${message}\n`);
  process.exit(1);
}

function getPowerShellCommand() {
  for (const command of ['powershell.exe', 'pwsh.exe']) {
    const result = spawnSync(command, ['-NoProfile', '-Command', '$PSVersionTable.PSVersion.ToString()'], {
      encoding: 'utf8',
      windowsHide: true
    });

    if (!result.error && result.status === 0) {
      return command;
    }
  }

  return null;
}

function assertArtifactsExist() {
  const missingArtifacts = REQUIRED_ARTIFACTS.filter((artifact) => !fs.existsSync(path.join(outputDir, artifact)));

  if (missingArtifacts.length > 0) {
    fail(
      `Native camera build finished, but ${outputDir} is missing: ${missingArtifacts.join(', ')}`
    );
  }
}

if (process.platform !== 'win32') {
  fail('The Surevideotool native camera currently builds only on Windows.');
}

if (!fs.existsSync(nativeBuildScript)) {
  fail(`Unable to find native camera build script: ${nativeBuildScript}`);
}

const powershellCommand = getPowerShellCommand();
if (!powershellCommand) {
  fail('Unable to find powershell.exe or pwsh.exe on PATH.');
}

process.stdout.write(`[native-camera] Building ${config} ${arch} artifacts...\n`);

const result = spawnSync(
  powershellCommand,
  ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', nativeBuildScript, '-Config', config, '-Arch', arch],
  {
    cwd: nativeCameraDir,
    stdio: 'inherit',
    windowsHide: true
  }
);

if (result.error) {
  fail(`Native camera build could not start: ${result.error.message}`);
}

if (result.status !== 0) {
  fail(`Native camera build failed with exit code ${result.status}.`);
}

assertArtifactsExist();
process.stdout.write(`[native-camera] Verified required artifacts in ${outputDir}.\n`);
