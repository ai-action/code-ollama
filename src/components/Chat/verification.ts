import { TOOL } from '@/constants';
import type { ToolResult } from '@/types';
import type { ollama } from '@/utils';

const MUTATION_TOOLS = new Set<string>([
  TOOL.WRITE_FILE,
  TOOL.EDIT_FILE,
  TOOL.CREATE_DIRECTORY,
  TOOL.RENAME_PATH,
  TOOL.DELETE_PATH,
]);
const BLOCKED_VERIFICATION_REGEX =
  /\b(?:cannot|can't|unable|blocked|could not|incomplete)\b[^.\n]*(?:\bbecause\b|\bdue to\b|\breason\b)/i;
const COMMAND_PREFIX_REGEX =
  /^(?:(?:[A-Za-z_][\w]*=\S+)\s+)*(?:\.\.?\/[\w./-]+|[a-z0-9][\w.-]*)(?:\s|$)/;
const PROSE_VERIFICATION_REGEX =
  /^(?:run|execute|verify|check|ensure)\s+(?:the|all|relevant|appropriate)\b/i;

export interface ExecutionVerification {
  commands: string[];
  mutationCompleted: boolean;
  mutationRequired: boolean;
  remainingCommands: string[];
  required: boolean;
}

export function createExecutionVerification(
  commands: string[] = [],
  mutationRequired = false,
): ExecutionVerification {
  return {
    commands,
    mutationCompleted: false,
    mutationRequired,
    remainingCommands: [],
    required: false,
  };
}

export function isCommandBasedVerification(value: string): boolean {
  const trimmed = value.trim();
  return (
    COMMAND_PREFIX_REGEX.test(trimmed) &&
    !PROSE_VERIFICATION_REGEX.test(trimmed)
  );
}

export function updateExecutionVerification(
  verification: ExecutionVerification,
  toolCall: ollama.ToolCall,
  result: ToolResult,
): ExecutionVerification {
  if (result.error) {
    return verification;
  }

  const { name, arguments: args } = toolCall.function;
  const updatedVerification = {
    ...verification,
    mutationCompleted:
      verification.mutationCompleted || MUTATION_TOOLS.has(name),
  };
  const command =
    typeof args.command === 'string' ? args.command.trim() : undefined;
  if (
    MUTATION_TOOLS.has(name) &&
    verification.commands.some(isCommandBasedVerification)
  ) {
    return {
      ...updatedVerification,
      remainingCommands: [...verification.commands],
      required: true,
    };
  }

  if (
    name === TOOL.RUN_SHELL &&
    command !== undefined &&
    verification.remainingCommands.includes(command)
  ) {
    const remainingCommands = verification.remainingCommands.filter(
      (remainingCommand) => remainingCommand !== command,
    );
    return {
      ...updatedVerification,
      remainingCommands,
      required: remainingCommands.length > 0,
    };
  }

  return updatedVerification;
}

export function reportsVerificationBlocked(content: string): boolean {
  return BLOCKED_VERIFICATION_REGEX.test(content);
}

export function buildVerificationCorrection(commands: string[]): string {
  const commandList = commands.length
    ? `Approved verification commands:\n${commands.map((command) => `- ${command}`).join('\n')}`
    : '';

  return [
    'Project files changed after the last successful command-based verification.',
    'Use the repository instructions from AGENTS.md to choose the relevant lint, type-check, build, or test command.',
    commandList,
    'Call run_shell now and resolve any failure before reporting completion.',
    'Reading the edited file verifies its content, not its correctness.',
    'If verification cannot run, explicitly report that the work is incomplete and explain why.',
  ]
    .filter(Boolean)
    .join('\n');
}
