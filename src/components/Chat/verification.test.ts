import { TOOL } from '@/constants';

import {
  buildFailedMutationCorrection,
  buildVerificationCorrection,
  createExecutionVerification,
  getPendingMutationTargets,
  isCommandBasedVerification,
  isMeaningfulVerificationCommand,
  reportsVerificationBlocked,
  reportsVerifiedNoChange,
  resolveVerifiedNoChange,
  updateExecutionVerification,
} from './verification';

const toolCall = (name: string, args: Record<string, unknown> = {}) => ({
  function: { name, arguments: args },
});

describe('execution verification', () => {
  it('requires verification after a successful project mutation', () => {
    const verification = updateExecutionVerification(
      createExecutionVerification(['npm run lint']),
      toolCall(TOOL.EDIT_FILE, { path: 'src/app.ts' }),
      { content: 'edited' },
    );

    expect(verification).toEqual({
      commands: ['npm run lint'],
      failedMutationPending: false,
      failedMutationTool: undefined,
      failedVerificationCommands: [],
      inspectedTargets: [],
      mutationCompleted: true,
      mutationRequired: false,
      mutationTargets: [],
      mutatedTargets: [],
      postFailureInspectedTargets: [],
      remainingCommands: ['npm run lint'],
      required: true,
      verifiedNoChangeTargets: [],
    });
  });

  it('does not require verification after a failed mutation', () => {
    const verification = updateExecutionVerification(
      createExecutionVerification(),
      toolCall(TOOL.EDIT_FILE),
      { content: '', error: 'Exact text not found' },
    );

    expect(verification.required).toBe(false);
    expect(verification.failedMutationPending).toBe(true);
  });

  it('keeps a failed mutation pending through reads and clears it on retry', () => {
    const failed = updateExecutionVerification(
      createExecutionVerification(),
      toolCall(TOOL.EDIT_FILE, { path: 'src/app.ts' }),
      { content: '', error: 'Exact text matched multiple locations' },
    );
    const inspected = updateExecutionVerification(
      failed,
      toolCall(TOOL.READ_FILE, { path: 'src/app.ts' }),
      { content: 'source' },
    );
    const retried = updateExecutionVerification(
      inspected,
      toolCall(TOOL.EDIT_FILE),
      { content: 'edited' },
    );

    expect(inspected.failedMutationPending).toBe(true);
    expect(inspected.postFailureInspectedTargets).toEqual(['src/app.ts']);
    expect(retried.failedMutationPending).toBe(false);
  });

  it('requires every planned mutation target to be changed', () => {
    const initial = createExecutionVerification(
      ['npm test'],
      true,
      'Update both components',
      ['src/PlanReview.tsx', 'src/Chat.tsx'],
    );
    const firstEdit = updateExecutionVerification(
      initial,
      toolCall(TOOL.EDIT_FILE, { path: 'src/PlanReview.tsx' }),
      { content: 'edited' },
    );
    const secondEdit = updateExecutionVerification(
      firstEdit,
      toolCall(TOOL.EDIT_FILE, { path: 'src/Chat.tsx' }),
      { content: 'edited' },
    );

    expect(firstEdit).toMatchObject({
      mutatedTargets: ['src/PlanReview.tsx'],
      mutationCompleted: false,
      required: true,
    });
    expect(getPendingMutationTargets(firstEdit)).toEqual(['src/Chat.tsx']);
    expect(secondEdit).toMatchObject({
      mutatedTargets: ['src/PlanReview.tsx', 'src/Chat.tsx'],
      mutationCompleted: true,
      required: true,
    });
  });

  it('accepts an explicit no-op only after every planned target is inspected', () => {
    const initial = createExecutionVerification(
      ['npm test'],
      true,
      'Keep existing behavior',
      ['src/app.ts'],
    );
    const inspected = updateExecutionVerification(
      initial,
      toolCall(TOOL.READ_FILE, { path: './src/app.ts' }),
      { content: 'existing behavior' },
    );

    expect(
      reportsVerifiedNoChange(
        initial,
        'No changes are needed because the requested behavior already exists.',
      ),
    ).toBe(false);
    expect(
      reportsVerifiedNoChange(
        inspected,
        'No changes are needed because the requested behavior already exists.',
      ),
    ).toBe(true);
  });

  it('requires targets to be reread after a failed mutation before accepting a no-op', () => {
    const inspected = updateExecutionVerification(
      createExecutionVerification([], true, 'Keep behavior', ['src/app.ts']),
      toolCall(TOOL.READ_FILE, { path: 'src/app.ts' }),
      { content: 'source' },
    );
    const failed = updateExecutionVerification(
      inspected,
      toolCall(TOOL.EDIT_FILE, { path: 'src/app.ts' }),
      { content: '', error: 'Exact text not found' },
    );
    const reread = updateExecutionVerification(
      failed,
      toolCall(TOOL.READ_FILE, { path: 'src/app.ts' }),
      { content: 'source' },
    );
    const report =
      'The requested behavior is already implemented, so no changes are needed.';

    expect(reportsVerifiedNoChange(failed, report)).toBe(false);
    expect(reportsVerifiedNoChange(reread, report)).toBe(true);
  });

  it('accepts an inspected no-op for remaining targets after another target changed', () => {
    const changed = updateExecutionVerification(
      createExecutionVerification(['npm test'], true, 'Update both files', [
        'src/changed.ts',
        'src/existing.ts',
      ]),
      toolCall(TOOL.EDIT_FILE, { path: 'src/changed.ts' }),
      { content: 'edited' },
    );
    const inspected = updateExecutionVerification(
      changed,
      toolCall(TOOL.READ_FILE, { path: 'src/existing.ts' }),
      { content: 'already correct' },
    );

    expect(
      reportsVerifiedNoChange(
        inspected,
        'The requested behavior is already implemented in the remaining target.',
      ),
    ).toBe(true);
    const resolved = resolveVerifiedNoChange(inspected);
    expect(resolved).toMatchObject({
      mutationCompleted: true,
      mutatedTargets: ['src/changed.ts'],
      verifiedNoChangeTargets: ['src/existing.ts'],
    });
    expect(getPendingMutationTargets(resolved)).toEqual([]);
  });

  it('requires verification after a successful MCP mutation', () => {
    const verification = updateExecutionVerification(
      createExecutionVerification(['npm run lint'], true),
      toolCall('mcp__filesystem__edit_file', {
        path: 'src/app.ts',
      }),
      { content: 'edited' },
    );

    expect(verification).toMatchObject({
      mutationCompleted: true,
      mutationRequired: true,
      remainingCommands: ['npm run lint'],
      required: true,
    });
  });

  it('clears verification only for successful verification commands', () => {
    const pending = {
      ...createExecutionVerification(['npm run lint']),
      commands: ['npm run lint'],
      remainingCommands: ['npm run lint'],
      required: true,
    };

    expect(
      updateExecutionVerification(
        pending,
        toolCall(TOOL.READ_FILE, { path: 'src/app.ts' }),
        { content: 'source' },
      ).required,
    ).toBe(true);
    expect(
      updateExecutionVerification(
        pending,
        toolCall(TOOL.RUN_SHELL, { command: 'echo done' }),
        { content: 'done' },
      ).required,
    ).toBe(true);
    expect(
      updateExecutionVerification(
        pending,
        toolCall(TOOL.RUN_SHELL, { command: 'npm run lint' }),
        { content: 'passed' },
      ).required,
    ).toBe(false);
  });

  it('clears a failed verification command when its retry succeeds', () => {
    const failed = updateExecutionVerification(
      {
        ...createExecutionVerification(['npm run lint']),
        remainingCommands: ['npm run lint'],
        required: true,
      },
      toolCall(TOOL.RUN_SHELL, { command: 'npm run lint' }),
      { content: '', error: 'Command failed: exit code 1' },
    );
    const retried = updateExecutionVerification(
      failed,
      toolCall(TOOL.RUN_SHELL, { command: 'npm run lint' }),
      { content: 'passed' },
    );

    expect(retried).toMatchObject({
      failedVerificationCommands: [],
      remainingCommands: [],
      required: false,
    });
  });

  it('tracks a failed meaningful check even when it was not planned', () => {
    const changed = updateExecutionVerification(
      createExecutionVerification(['npm run lint'], true, 'Update files', [
        'src/app.ts',
      ]),
      toolCall(TOOL.EDIT_FILE, { path: 'src/app.ts' }),
      { content: 'edited' },
    );
    const failed = updateExecutionVerification(
      changed,
      toolCall(TOOL.RUN_SHELL, { command: 'npm test -- run app.test.ts' }),
      { content: '', error: 'Tests failed' },
    );
    const repaired = updateExecutionVerification(
      failed,
      toolCall(TOOL.EDIT_FILE, { path: 'src/app.ts' }),
      { content: 'repaired' },
    );

    expect(failed.failedVerificationCommands).toEqual([
      'npm test -- run app.test.ts',
    ]);
    expect(repaired).toMatchObject({
      failedVerificationCommands: ['npm test -- run app.test.ts'],
      remainingCommands: ['npm run lint', 'npm test -- run app.test.ts'],
      required: true,
    });
  });

  it('accepts a project check as a replacement after a planned command fails', () => {
    const pending = updateExecutionVerification(
      {
        ...createExecutionVerification(['grep -q expected src/app.ts']),
        remainingCommands: ['grep -q expected src/app.ts'],
        required: true,
      },
      toolCall(TOOL.RUN_SHELL, {
        command: 'grep -q expected src/app.ts',
      }),
      { content: '', error: 'Command failed: exit code 1' },
    );
    const recovered = updateExecutionVerification(
      pending,
      toolCall(TOOL.RUN_SHELL, { command: 'npm run lint:tsc' }),
      { content: 'passed' },
    );

    expect(pending).toMatchObject({
      failedVerificationCommands: ['grep -q expected src/app.ts'],
      required: true,
    });
    expect(recovered).toMatchObject({
      failedVerificationCommands: [],
      remainingCommands: [],
      required: false,
    });
  });

  it('accepts a deterministic replacement when no project check exists', () => {
    const pending = {
      ...createExecutionVerification(['grep -q old src/app.txt']),
      failedVerificationCommands: ['grep -q old src/app.txt'],
      remainingCommands: ['grep -q old src/app.txt'],
      required: true,
    };
    const recovered = updateExecutionVerification(
      pending,
      toolCall(TOOL.RUN_SHELL, { command: 'grep -q new src/app.txt' }),
      { content: 'matched' },
    );

    expect(recovered).toMatchObject({
      failedVerificationCommands: [],
      remainingCommands: [],
      required: false,
    });
  });

  it('does not accept a non-evidentiary shell command as a replacement', () => {
    const pending = {
      ...createExecutionVerification(['grep -q expected src/app.ts']),
      failedVerificationCommands: ['grep -q expected src/app.ts'],
      remainingCommands: ['grep -q expected src/app.ts'],
      required: true,
    };
    const result = updateExecutionVerification(
      pending,
      toolCall(TOOL.RUN_SHELL, { command: 'echo done' }),
      { content: 'done' },
    );

    expect(result.required).toBe(true);
  });

  it('requires a successful replacement for each failed verification', () => {
    const pending = {
      ...createExecutionVerification(['npm run lint', 'npm test']),
      failedVerificationCommands: ['npm run lint', 'npm test'],
      remainingCommands: ['npm run lint', 'npm test'],
      required: true,
    };
    const linted = updateExecutionVerification(
      pending,
      toolCall(TOOL.RUN_SHELL, { command: 'npm run lint' }),
      { content: 'passed' },
    );

    expect(linted).toMatchObject({
      failedVerificationCommands: ['npm test'],
      remainingCommands: ['npm test'],
      required: true,
    });
  });

  it('requires verification again after a later mutation', () => {
    const verified = updateExecutionVerification(
      {
        ...createExecutionVerification(['npm test']),
        commands: ['npm test'],
        remainingCommands: ['npm test'],
        required: true,
      },
      toolCall(TOOL.RUN_SHELL, { command: 'npm test' }),
      { content: 'passed' },
    );
    const changedAgain = updateExecutionVerification(
      verified,
      toolCall(TOOL.WRITE_FILE, { path: 'src/app.ts' }),
      { content: 'written' },
    );

    expect(changedAgain.required).toBe(true);
  });

  it('requires every approved command after the latest mutation', () => {
    const changed = updateExecutionVerification(
      createExecutionVerification(['npm run lint', 'npm run lint:tsc']),
      toolCall(TOOL.EDIT_FILE, { path: 'src/app.ts' }),
      { content: 'edited' },
    );
    const linted = updateExecutionVerification(
      changed,
      toolCall(TOOL.RUN_SHELL, { command: 'npm run lint' }),
      { content: 'passed' },
    );

    expect(linted).toMatchObject({
      remainingCommands: ['npm run lint:tsc'],
      required: true,
    });
  });

  it('recognizes explicit blocked reports and builds command guidance', () => {
    expect(
      reportsVerificationBlocked(
        'The work is incomplete because the lint command is unavailable.',
      ),
    ).toBe(true);
    expect(reportsVerificationBlocked('Everything is complete.')).toBe(false);
    expect(buildVerificationCorrection(['npm run lint'])).toContain(
      '- npm run lint',
    );
    expect(buildVerificationCorrection([])).toContain('AGENTS.md');
    expect(
      buildVerificationCorrection(
        ['grep -q expected src/app.ts'],
        ['grep -q expected src/app.ts'],
      ),
    ).toContain(
      'exactly one appropriate read, edit, write, or shell tool call',
    );
    expect(
      buildVerificationCorrection(
        ['grep -q expected src/app.ts'],
        ['grep -q expected src/app.ts'],
      ),
    ).toContain('A failing check is not evidence of success');
    expect(buildFailedMutationCorrection(TOOL.EDIT_FILE)).toContain(
      '{"path":"file","oldText":"exact unique existing text","newText":"replacement text"}',
    );
    expect(buildFailedMutationCorrection(TOOL.EDIT_FILE)).toContain(
      'Do not use an edits array.',
    );
  });

  it('does not track an ineligible failed shell command and rejects no-ops with no pending targets', () => {
    const verification = createExecutionVerification();
    const failed = updateExecutionVerification(
      verification,
      toolCall(TOOL.RUN_SHELL, { command: 'npm test' }),
      { content: '', error: 'Tests failed' },
    );

    expect(failed).toBe(verification);
    expect(
      reportsVerifiedNoChange(
        {
          ...createExecutionVerification([], true, 'Keep behavior', [
            'src/app.ts',
          ]),
          mutatedTargets: ['src/app.ts'],
        },
        'No changes are needed because the requested behavior already exists.',
      ),
    ).toBe(false);
  });

  it('distinguishes exact commands from prose verification instructions', () => {
    expect(isCommandBasedVerification('npm run lint')).toBe(true);
    expect(isCommandBasedVerification('CI=true vitest run')).toBe(true);
    expect(isCommandBasedVerification('./scripts/verify.sh')).toBe(true);
    expect(isCommandBasedVerification('Run the tests')).toBe(false);
    expect(isCommandBasedVerification('Check all relevant files')).toBe(false);
    expect(isMeaningfulVerificationCommand('npm run lint:tsc')).toBe(true);
    expect(isMeaningfulVerificationCommand('CI=true npm test')).toBe(true);
    expect(isMeaningfulVerificationCommand('cargo check')).toBe(true);
    expect(isMeaningfulVerificationCommand('grep -q expected src/app.ts')).toBe(
      true,
    );
    expect(isMeaningfulVerificationCommand('node --check src/app.js')).toBe(
      true,
    );
    expect(isMeaningfulVerificationCommand('./scripts/smoke.sh')).toBe(true);
    expect(isMeaningfulVerificationCommand('echo done')).toBe(false);
    expect(isMeaningfulVerificationCommand('pwd')).toBe(false);
    expect(isMeaningfulVerificationCommand('ls -la')).toBe(false);
    expect(isMeaningfulVerificationCommand('echo value | grep value')).toBe(
      true,
    );
    expect(isMeaningfulVerificationCommand('Run the tests')).toBe(false);
  });
});
