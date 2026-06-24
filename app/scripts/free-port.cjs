const { spawnSync } = require('child_process');

const ports = process.argv
  .slice(2)
  .map((value) => Number(value))
  .filter((value) => Number.isInteger(value) && value > 0 && value < 65536);

if (ports.length === 0) {
  process.stderr.write('Usage: node scripts/free-port.cjs <port> [...ports]\n');
  process.exit(1);
}

function findWindowsListeningPids(port) {
  const result = spawnSync('netstat.exe', ['-ano', '-p', 'tcp'], {
    encoding: 'utf8',
    windowsHide: true
  });

  if (result.error) {
    throw result.error;
  }

  if (result.status !== 0) {
    throw new Error(result.stderr || `netstat exited with code ${result.status}`);
  }

  const portSuffix = `:${port}`;
  const pids = new Set();

  for (const line of result.stdout.split(/\r?\n/)) {
    const columns = line.trim().split(/\s+/);
    if (columns.length < 5 || columns[0] !== 'TCP') {
      continue;
    }

    const [, localAddress, , state, pid] = columns;
    if (state === 'LISTENING' && localAddress.endsWith(portSuffix) && /^\d+$/.test(pid)) {
      pids.add(pid);
    }
  }

  return [...pids];
}

function findUnixListeningPids(port) {
  const result = spawnSync('lsof', ['-ti', `tcp:${port}`, '-sTCP:LISTEN'], {
    encoding: 'utf8'
  });

  if (result.error && result.error.code === 'ENOENT') {
    return [];
  }

  if (result.error) {
    throw result.error;
  }

  if (result.status !== 0 && result.status !== 1) {
    throw new Error(result.stderr || `lsof exited with code ${result.status}`);
  }

  return result.stdout
    .split(/\s+/)
    .filter((pid) => /^\d+$/.test(pid));
}

function stopWindowsPid(pid) {
  const result = spawnSync('taskkill.exe', ['/PID', pid, '/T', '/F'], {
    stdio: 'inherit',
    windowsHide: true
  });

  if (result.error) {
    throw result.error;
  }

  if (result.status !== 0) {
    throw new Error(`taskkill failed for PID ${pid} with code ${result.status}`);
  }
}

function stopUnixPid(pid) {
  try {
    process.kill(Number(pid), 'SIGTERM');
  } catch (error) {
    if (error.code !== 'ESRCH') {
      throw error;
    }
  }
}

for (const port of ports) {
  const pids = process.platform === 'win32' ? findWindowsListeningPids(port) : findUnixListeningPids(port);

  if (pids.length === 0) {
    process.stdout.write(`[free-port] No listener on port ${port}.\n`);
    continue;
  }

  for (const pid of pids) {
    if (Number(pid) === process.pid) {
      continue;
    }

    process.stdout.write(`[free-port] Stopping PID ${pid} on port ${port}.\n`);
    if (process.platform === 'win32') {
      stopWindowsPid(pid);
    } else {
      stopUnixPid(pid);
    }
  }
}
