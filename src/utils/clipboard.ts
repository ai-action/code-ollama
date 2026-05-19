import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

export const TEMP_IMAGES_DIRECTORY = join(tmpdir(), 'code-ollama', 'images');

const WINDOWS_CLIPBOARD_EXIT_CODE = 11;

function ensureTempDirectory(directory: string): string {
  mkdirSync(directory, { recursive: true });
  return directory;
}

function buildTargetPath(
  directory: string,
  baseName: string,
  extension: string,
) {
  return join(ensureTempDirectory(directory), `${baseName}.${extension}`);
}

function readMacClipboardImage(path: string): void {
  const script = `
set outputPath to POSIX file ${JSON.stringify(path)}
try
  set clipboardData to the clipboard as «class PNGf»
on error
  error "Clipboard does not contain an image"
end try
set fileHandle to open for access outputPath with write permission
try
  set eof fileHandle to 0
  write clipboardData to fileHandle
on error errorMessage
  close access fileHandle
  error errorMessage
end try
close access fileHandle
`;

  execFileSync('osascript', ['-e', script], { stdio: 'ignore' });
}

function getClipboardErrorMessage(error: Error): string {
  if (error.message.includes('Clipboard does not contain an image')) {
    return 'Clipboard does not contain an image.';
  }

  return 'Clipboard image paste failed. Paste an image path instead.';
}

function readWindowsClipboardImage(path: string): void {
  const script = `
Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing
$image = [Windows.Forms.Clipboard]::GetImage()
if ($null -eq $image) { exit ${String(WINDOWS_CLIPBOARD_EXIT_CODE)} }
$image.Save($args[0], [System.Drawing.Imaging.ImageFormat]::Png)
`;

  execFileSync('powershell', ['-NoProfile', '-Command', script, path], {
    stdio: 'ignore',
  });
}

function readLinuxClipboardImage(directory: string, baseName: string): string {
  const wlPng = spawnSync('wl-paste', ['--no-newline', '--type', 'image/png'], {
    encoding: 'buffer',
  });
  if (wlPng.status === 0 && wlPng.stdout.length > 0) {
    const path = buildTargetPath(directory, baseName, 'png');
    writeFileSync(path, wlPng.stdout);
    return path;
  }

  const xclipPng = spawnSync(
    'xclip',
    ['-selection', 'clipboard', '-t', 'image/png', '-o'],
    { encoding: 'buffer' },
  );
  if (xclipPng.status === 0 && xclipPng.stdout.length > 0) {
    const path = buildTargetPath(directory, baseName, 'png');
    writeFileSync(path, xclipPng.stdout);
    return path;
  }

  throw new Error(
    'Clipboard image paste is unavailable. Paste an image path instead.',
  );
}

export function saveClipboardImage(
  baseName: string,
  directory = TEMP_IMAGES_DIRECTORY,
): string {
  try {
    switch (process.platform) {
      case 'darwin': {
        const path = buildTargetPath(directory, baseName, 'png');
        readMacClipboardImage(path);
        return path;
      }
      case 'win32': {
        const path = buildTargetPath(directory, baseName, 'png');
        readWindowsClipboardImage(path);
        return path;
      }
      case 'linux':
        return readLinuxClipboardImage(directory, baseName);
      default:
        throw new Error(
          'Clipboard image paste is not supported on this platform. Paste an image path instead.',
        );
    }
  } catch (error) {
    if (
      error instanceof Error &&
      'status' in error &&
      error.status === WINDOWS_CLIPBOARD_EXIT_CODE
    ) {
      throw new Error('Clipboard does not contain an image.', {
        cause: error,
      });
    }

    const path = join(directory, `${baseName}.png`);
    if (existsSync(path)) {
      rmSync(path, { force: true });
    }

    if (error instanceof Error) {
      throw new Error(getClipboardErrorMessage(error), { cause: error });
    }

    // v8 ignore next
    throw error;
  }
}

export function removeClipboardImage(path: string): void {
  if (existsSync(path)) {
    rmSync(path, { force: true });
  }
}
