export function hasExecutablePlan(content: string): boolean {
  const lines = content.split('\n');
  const proposedPlanIndex = lines.findIndex(
    (line) => line.trim().toLowerCase() === '## proposed plan',
  );

  if (proposedPlanIndex === -1) {
    return false;
  }

  const executionStepsIndex = lines.findIndex(
    (line, index) =>
      index > proposedPlanIndex &&
      line.trim().toLowerCase() === '### execution steps',
  );

  if (executionStepsIndex === -1) {
    return false;
  }

  const nextSectionIndex = lines.findIndex(
    (line, index) =>
      index > executionStepsIndex && /^#{1,6}\s+\S/.test(line.trim()),
  );
  const executionStepLines = lines.slice(
    executionStepsIndex + 1,
    nextSectionIndex === -1 ? undefined : nextSectionIndex,
  );

  return executionStepLines.some((line) =>
    /^(?:[-*]|\d+[.)])\s+\S/.test(line.trim()),
  );
}

export function isPlanModeFinal(content: string): boolean {
  const firstHeading = content
    .split('\n')
    .find((line) => line.trim())
    ?.trim()
    .toLowerCase();

  return isPlanNeedsInput(content) || firstHeading === '## proposed plan';
}

export function isPlanNeedsInput(content: string): boolean {
  const firstHeading = content
    .split('\n')
    .find((line) => line.trim())
    ?.trim()
    .toLowerCase();

  return firstHeading === '## plan needs input';
}

export function isDirectPlanAnswer(content: string): boolean {
  const normalized = content.trim();
  if (!normalized || isPlanModeFinal(normalized)) {
    return false;
  }

  return !/^(?:research(?: is)? complete|done)\.?$/i.test(normalized);
}
