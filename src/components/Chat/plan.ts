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
