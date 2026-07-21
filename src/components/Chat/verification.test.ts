import { TOOL } from '@/constants';

import {
  buildVerificationCorrection,
  createExecutionVerification,
  isCommandBasedVerification,
  reportsVerificationBlocked,
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
  });

  it('clears verification only for successful verification commands', () => {
    const pending = {
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
  });

  it('distinguishes exact commands from prose verification instructions', () => {
    expect(isCommandBasedVerification('npm run lint')).toBe(true);
    expect(isCommandBasedVerification('CI=true vitest run')).toBe(true);
    expect(isCommandBasedVerification('./scripts/verify.sh')).toBe(true);
    expect(isCommandBasedVerification('Run the tests')).toBe(false);
    expect(isCommandBasedVerification('Check all relevant files')).toBe(false);
  });
});
