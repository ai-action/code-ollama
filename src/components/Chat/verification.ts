import { TOOL } from '@/constants';
import type { ToolResult } from '@/types';
import type { ollama } from '@/utils';
import { mayMcpToolMutate } from '@/utils/mcp';

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
const NO_CHANGE_NEEDED_REGEX =
  /\b(?:already (?:exists|implemented|present|satisfied)|no (?:code )?changes? (?:are|were|is) (?:needed|required)|requested (?:behavior|change) is already)\b/i;

function mayToolMutate(name: string): boolean {
  return MUTATION_TOOLS.has(name) || mayMcpToolMutate(name);
}

export interface ExecutionVerification {
  commands: string[];
  failedMutationPending: boolean;
  failedMutationTool?: string;
  inspectedTargets: string[];
  mutationCompleted: boolean;
  mutationRequired: boolean;
  mutationTask?: string;
  mutationTargets: string[];
  postFailureInspectedTargets: string[];
  remainingCommands: string[];
  required: boolean;
}

export function createExecutionVerification(
  commands: string[] = [],
  mutationRequired = false,
  mutationTask?: string,
  mutationTargets: string[] = [],
): ExecutionVerification {
  return {
    commands,
    failedMutationPending: false,
    inspectedTargets: [],
    mutationCompleted: false,
    mutationRequired,
    mutationTask,
    mutationTargets,
    postFailureInspectedTargets: [],
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
  const { name, arguments: args } = toolCall.function;
  if (result.error) {
    return mayToolMutate(name)
      ? {
          ...verification,
          failedMutationPending: true,
          failedMutationTool: name,
          postFailureInspectedTargets: [],
        }
      : verification;
  }

  const path = typeof args.path === 'string' ? normalizeTarget(args.path) : '';
  const inspectedTargets =
    isReadFileTool(name) && path
      ? addUnique(verification.inspectedTargets, path)
      : verification.inspectedTargets;
  const postFailureInspectedTargets =
    verification.failedMutationPending && isReadFileTool(name) && path
      ? addUnique(verification.postFailureInspectedTargets, path)
      : verification.postFailureInspectedTargets;
  const updatedVerification = {
    ...verification,
    failedMutationPending: mayToolMutate(name)
      ? false
      : verification.failedMutationPending,
    failedMutationTool: mayToolMutate(name)
      ? undefined
      : verification.failedMutationTool,
    inspectedTargets,
    mutationCompleted: verification.mutationCompleted || mayToolMutate(name),
    postFailureInspectedTargets,
  };
  const command =
    typeof args.command === 'string' ? args.command.trim() : undefined;
  if (
    mayToolMutate(name) &&
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

function normalizeTarget(target: string): string {
  return target.replaceAll('\\', '/').replace(/^(?:\.\/)+/, '');
}

function addUnique(targets: string[], target: string): string[] {
  return targets.includes(target) ? targets : [...targets, target];
}

function isReadFileTool(name: string): boolean {
  return name === TOOL.READ_FILE || name.endsWith('__read_file');
}

export function reportsVerifiedNoChange(
  verification: ExecutionVerification,
  content: string,
): boolean {
  if (
    !verification.mutationRequired ||
    verification.mutationCompleted ||
    verification.mutationTargets.length === 0 ||
    !NO_CHANGE_NEEDED_REGEX.test(content)
  ) {
    return false;
  }

  const targets = verification.mutationTargets.map(normalizeTarget);
  const inspected = new Set(verification.inspectedTargets);
  if (!targets.every((target) => inspected.has(target))) {
    return false;
  }

  if (verification.failedMutationPending) {
    const inspectedAfterFailure = new Set(
      verification.postFailureInspectedTargets,
    );
    return targets.every((target) => inspectedAfterFailure.has(target));
  }

  return true;
}

export function buildFailedMutationCorrection(toolName?: string): string {
  if (toolName === TOOL.EDIT_FILE) {
    return [
      'The previous edit_file call failed.',
      'Retry with one edit_file call using exactly: {"path":"file","oldText":"exact unique existing text","newText":"replacement text"}.',
      'Do not use an edits array.',
      'If exact text is uncertain, call read_file with a focused line range before retrying.',
      'If the approved change is already present, reread every planned target and explicitly report that no changes are needed, citing the existing behavior.',
      'Do not merely describe a future action.',
    ].join('\n');
  }

  return 'The previous state-changing tool failed. Either call a corrected tool now, or explicitly report that the requested work cannot be completed and why. Do not merely describe a future action.';
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
