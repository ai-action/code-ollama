import { TOOL } from '@/constants';

import {
  buildFailedMutationCorrection,
  buildVerificationCorrection,
  createExecutionVerification,
  isCommandBasedVerification,
  reportsVerificationBlocked,
  reportsVerifiedNoChange,
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
      inspectedTargets: [],
      mutationCompleted: true,
      mutationRequired: false,
      mutationTargets: [],
      postFailureInspectedTargets: [],
      remainingCommands: ['npm run lint'],
      required: true,
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
    expect(buildFailedMutationCorrection(TOOL.EDIT_FILE)).toContain(
      '{"path":"file","oldText":"exact unique existing text","newText":"replacement text"}',
    );
    expect(buildFailedMutationCorrection(TOOL.EDIT_FILE)).toContain(
      'Do not use an edits array.',
    );
  });

  it('distinguishes exact commands from prose verification instructions', () => {
    expect(isCommandBasedVerification('npm run lint')).toBe(true);
    expect(isCommandBasedVerification('CI=true vitest run')).toBe(true);
    expect(isCommandBasedVerification('./scripts/verify.sh')).toBe(true);
    expect(isCommandBasedVerification('Run the tests')).toBe(false);
    expect(isCommandBasedVerification('Check all relevant files')).toBe(false);
  });
});
