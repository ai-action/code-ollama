import { PACKAGE } from '@/constants';

const REGISTRY_URL = `https://registry.npmjs.org/${PACKAGE.NAME}/latest`;

function getSemver(version: string): [number, number, number] {
  return version.split('.').map(Number) as [number, number, number];
}

/**
 * Check if the latest version is newer than the current version
 * @param current The current version
 * @param latest The latest version
 * @returns true if the latest version is newer, false otherwise
 */
function isVersionNewer(current: string, latest: string): boolean {
  const [currentMajor, currentMinor, currentPatch] = getSemver(current);
  const [latestMajor, latestMinor, latestPatch] = getSemver(latest);

  if (latestMajor !== currentMajor) {
    return latestMajor > currentMajor;
  }

  if (latestMinor !== currentMinor) {
    return latestMinor > currentMinor;
  }

  return latestPatch > currentPatch;
}

/**
 * Check if a newer version is available on npm
 * @returns The latest version if available, undefined otherwise
 */
export async function checkForUpdate(): Promise<string | undefined> {
  try {
    const response = await fetch(REGISTRY_URL);

    if (!response.ok) {
      return;
    }

    const { version: latestVersion } = (await response.json()) as {
      version?: string;
    };

    if (!latestVersion) {
      return;
    }

    if (isVersionNewer(PACKAGE.VERSION, latestVersion)) {
      return latestVersion;
    }
  } catch {
    // pass
  }
}
