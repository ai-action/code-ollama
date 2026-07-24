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
const ENV_PREFIX_REGEX = /^(?:(?:[A-Za-z_][\w]*=\S+)\s+)*/;
const SHELL_OPERATOR_REGEX = /(?:&&|\|\||[|;<>])/;
const NON_EVIDENCE_COMMAND_REGEX =
  /^(?::|true|false|pwd|(?:echo|printf|ls|cat|head|tail|which)\b[^;&|<>]*|command\s+-v\b[^;&|<>]*)$/i;
const NO_CHANGE_NEEDED_REGEX =
  /\b(?:already (?:exists|implemented|present|satisfied)|no (?:code )?changes? (?:are|were|is) (?:needed|required)|requested (?:behavior|change) is already)\b/i;

export function mayToolMutate(name: string): boolean {
  return MUTATION_TOOLS.has(name) || mayMcpToolMutate(name);
}

export interface ExecutionVerification {
  commands: string[];
  failedMutationPending: boolean;
  failedMutationTool?: string;
  failedVerificationCommands: string[];
  inspectedTargets: string[];
  mutationCompleted: boolean;
  mutationRequired: boolean;
  mutationTask?: string;
  mutationTargets: string[];
  mutatedTargets: string[];
  postFailureInspectedTargets: string[];
  remainingCommands: string[];
  required: boolean;
  verifiedNoChangeTargets: string[];
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
    failedVerificationCommands: [],
    inspectedTargets: [],
    mutationCompleted: false,
    mutationRequired,
    mutationTask,
    mutationTargets,
    mutatedTargets: [],
    postFailureInspectedTargets: [],
    remainingCommands: [],
    required: false,
    verifiedNoChangeTargets: [],
  };
}

export function isCommandBasedVerification(value: string): boolean {
  const trimmed = value.trim();
  return (
    COMMAND_PREFIX_REGEX.test(trimmed) &&
    !PROSE_VERIFICATION_REGEX.test(trimmed)
  );
}

export function isMeaningfulVerificationCommand(value: string): boolean {
  const command = value.trim().replace(ENV_PREFIX_REGEX, '');
  return (
    isCommandBasedVerification(value) &&
    (SHELL_OPERATOR_REGEX.test(command) ||
      !NON_EVIDENCE_COMMAND_REGEX.test(command))
  );
}

export function updateExecutionVerification(
  verification: ExecutionVerification,
  toolCall: ollama.ToolCall,
  result: ToolResult,
): ExecutionVerification {
  const { name, arguments: args } = toolCall.function;
  if (result.error) {
    const command =
      typeof args.command === 'string' ? args.command.trim() : undefined;
    if (
      name === TOOL.RUN_SHELL &&
      command !== undefined &&
      isMeaningfulVerificationCommand(command) &&
      (verification.required || verification.mutatedTargets.length > 0)
    ) {
      return {
        ...verification,
        failedVerificationCommands: addUnique(
          verification.failedVerificationCommands,
          command,
        ),
      };
    }

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
  const mutates = mayToolMutate(name);
  const mutatedTargets = mutates
    ? addAffectedMutationTargets(verification, args)
    : verification.mutatedTargets;
  const mutationCompleted = mutates
    ? verification.mutationTargets.length === 0 ||
      getPendingMutationTargets({
        ...verification,
        mutatedTargets,
      }).length === 0
    : verification.mutationCompleted;
  const updatedVerification = {
    ...verification,
    failedMutationPending: mutates ? false : verification.failedMutationPending,
    failedMutationTool: mutates ? undefined : verification.failedMutationTool,
    inspectedTargets,
    mutationCompleted,
    mutatedTargets,
    postFailureInspectedTargets,
  };
  const command =
    typeof args.command === 'string' ? args.command.trim() : undefined;
  if (mutates && verification.commands.some(isCommandBasedVerification)) {
    return {
      ...updatedVerification,
      remainingCommands: unique([
        ...verification.commands,
        ...verification.failedVerificationCommands,
      ]),
      required: true,
    };
  }

  if (name === TOOL.RUN_SHELL && command !== undefined) {
    if (verification.remainingCommands.includes(command)) {
      const remainingCommands = verification.remainingCommands.filter(
        (remainingCommand) => remainingCommand !== command,
      );
      const failedVerificationCommands =
        verification.failedVerificationCommands.filter(
          (failedCommand) => failedCommand !== command,
        );
      return {
        ...updatedVerification,
        failedVerificationCommands,
        remainingCommands,
        required:
          remainingCommands.length > 0 || failedVerificationCommands.length > 0,
      };
    }

    if (
      verification.failedVerificationCommands.length > 0 &&
      isMeaningfulVerificationCommand(command)
    ) {
      const [replacedCommand, ...failedVerificationCommands] =
        verification.failedVerificationCommands;
      const remainingCommands = verification.remainingCommands.filter(
        (remainingCommand) => remainingCommand !== replacedCommand,
      );
      return {
        ...updatedVerification,
        failedVerificationCommands,
        remainingCommands,
        required:
          remainingCommands.length > 0 || failedVerificationCommands.length > 0,
      };
    }
  }

  return updatedVerification;
}

function normalizeTarget(target: string): string {
  return target.replaceAll('\\', '/').replace(/^(?:\.\/)+/, '');
}

function addUnique(targets: string[], target: string): string[] {
  return targets.includes(target) ? targets : [...targets, target];
}

function unique(values: string[]): string[] {
  return Array.from(new Set(values));
}

function addAffectedMutationTargets(
  verification: ExecutionVerification,
  args: Record<string, unknown>,
): string[] {
  if (verification.mutationTargets.length === 0) {
    return verification.mutatedTargets;
  }

  const argumentTargets = Object.entries(args).flatMap(([key, value]) =>
    /(?:path|file|target|source|destination|from|to|uri)$/i.test(key) &&
    typeof value === 'string'
      ? [normalizeTarget(value)]
      : [],
  );

  return verification.mutationTargets.reduce((targets, target) => {
    const normalized = normalizeTarget(target);
    const affected = argumentTargets.some(
      (argumentTarget) =>
        argumentTarget === normalized ||
        argumentTarget.startsWith(`${normalized}/`) ||
        argumentTarget.endsWith(`/${normalized}`),
    );
    return affected ? addUnique(targets, normalized) : targets;
  }, verification.mutatedTargets);
}

export function getPendingMutationTargets(
  verification: Pick<
    ExecutionVerification,
    'mutationTargets' | 'mutatedTargets' | 'verifiedNoChangeTargets'
  >,
): string[] {
  const resolved = new Set(
    [
      ...verification.mutatedTargets,
      ...verification.verifiedNoChangeTargets,
    ].map(normalizeTarget),
  );
  return verification.mutationTargets
    .map(normalizeTarget)
    .filter((target) => !resolved.has(target));
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
    verification.mutationTargets.length === 0 ||
    !NO_CHANGE_NEEDED_REGEX.test(content)
  ) {
    return false;
  }

  const targets = getPendingMutationTargets(verification);
  if (targets.length === 0) {
    return false;
  }
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

export function resolveVerifiedNoChange(
  verification: ExecutionVerification,
): ExecutionVerification {
  return {
    ...verification,
    failedMutationPending: false,
    failedMutationTool: undefined,
    mutationCompleted: true,
    verifiedNoChangeTargets: unique([
      ...verification.verifiedNoChangeTargets,
      ...getPendingMutationTargets(verification),
    ]),
  };
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

export function buildVerificationCorrection(
  commands: string[],
  failedCommands: string[] = [],
): string {
  const commandList = commands.length
    ? `Approved verification commands:\n${commands.map((command) => `- ${command}`).join('\n')}`
    : '';

  return [
    'Project files changed after the last successful command-based verification.',
    'Use the repository instructions from AGENTS.md to choose the relevant lint, type-check, build, or test command.',
    commandList,
    failedCommands.length > 0
      ? [
          'A verification command failed. A failing check is not evidence of success, and the work remains incomplete.',
          'Use exactly one appropriate read, edit, write, or shell tool call now to inspect or repair the failure.',
          'After repairing it, rerun the failed check or another deterministic command that validates the same behavior.',
        ].join('\n')
      : '',
    failedCommands.length === 0
      ? 'Your next response must be exactly one run_shell tool call with no prose.'
      : '',
    'Resolve any command failure before reporting completion.',
    'Reading the edited file verifies its content, not its correctness.',
    'If verification cannot run, explicitly report that the work is incomplete and explain why.',
  ]
    .filter(Boolean)
    .join('\n');
}
