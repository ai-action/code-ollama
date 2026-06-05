import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync as removeFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

let testHome = '';

function getSessionsDirectory() {
  return join(testHome, '.code-ollama', 'sessions');
}

function getSessionDirectory(id: string) {
  return join(getSessionsDirectory(), id);
}

function getMetadataPath(id: string) {
  return join(getSessionDirectory(id), 'metadata.json');
}

function getMessagesPath(id: string) {
  return join(getSessionDirectory(id), 'messages.jsonl');
}

describe('session', () => {
  beforeEach(() => {
    testHome = mkdtempSync(join(tmpdir(), 'code-ollama-session-'));
    vi.resetModules();

    vi.doMock('node:os', async () => ({
      ...(await vi.importActual('node:os')),
      homedir: () => testHome,
    }));
  });

  afterEach(() => {
    vi.doUnmock('node:os');
    rmSync(testHome, { force: true, recursive: true });
  });

  it('creates a session directory with metadata and messages files', async () => {
    const { createSession } = await import('./session');
    const session = createSession('gemma4');

    expect(existsSync(getSessionDirectory(session.metadata.id))).toBe(true);
    expect(existsSync(getMetadataPath(session.metadata.id))).toBe(true);
    expect(existsSync(getMessagesPath(session.metadata.id))).toBe(true);
    expect(session.metadata.title).toBe('New session');
    expect(session.metadata.directory).toBe(process.cwd());
    expect(session.messages).toEqual([]);
  });

  it('appends messages and updates metadata from the first user prompt', async () => {
    const { appendMessage, createSession, loadSession } =
      await import('./session');
    const session = createSession('gemma4');

    const metadata = appendMessage(
      session.metadata.id,
      { role: 'user', content: 'Investigate session persistence' },
      'llama3',
    );

    expect(metadata.title).toBe('Investigate session persistence');
    expect(metadata.model).toBe('llama3');
    expect(metadata.updatedAt >= metadata.createdAt).toBe(true);

    const loaded = loadSession(session.metadata.id);
    expect(loaded.messages).toEqual([
      { role: 'user', content: 'Investigate session persistence' },
    ]);
  });

  it('persists image attachments in session messages', async () => {
    const { appendMessage, createSession, loadSession } =
      await import('./session');
    const session = createSession('gemma4');

    appendMessage(
      session.metadata.id,
      {
        role: 'user',
        content: 'Review this screenshot',
        images: ['/tmp/code-ollama/images/image-1.png'],
      },
      'gemma4',
    );

    expect(loadSession(session.metadata.id).messages).toEqual([
      {
        role: 'user',
        content: 'Review this screenshot',
        images: ['/tmp/code-ollama/images/image-1.png'],
      },
    ]);
  });

  it('replaces persisted messages and updates metadata', async () => {
    const { appendMessage, createSession, loadSession, replaceMessages } =
      await import('./session');
    const session = createSession('gemma4');

    appendMessage(
      session.metadata.id,
      { role: 'user', content: 'original' },
      'gemma4',
    );

    const metadata = replaceMessages(
      session.metadata.id,
      [
        { role: 'system', content: 'Compacted conversation summary' },
        { role: 'user', content: 'latest prompt' },
      ],
      'llama3',
    );

    expect(metadata.model).toBe('llama3');
    expect(metadata.updatedAt >= metadata.createdAt).toBe(true);
    expect(loadSession(session.metadata.id).messages).toEqual([
      { role: 'system', content: 'Compacted conversation summary' },
      { role: 'user', content: 'latest prompt' },
    ]);
  });

  it('can replace persisted messages with an empty list', async () => {
    const { appendMessage, createSession, loadSession, replaceMessages } =
      await import('./session');
    const session = createSession('gemma4');

    appendMessage(
      session.metadata.id,
      { role: 'user', content: 'original' },
      'gemma4',
    );

    replaceMessages(session.metadata.id, [], 'gemma4');

    expect(readFileSync(getMessagesPath(session.metadata.id), 'utf8')).toBe('');
    expect(loadSession(session.metadata.id).messages).toEqual([]);
  });

  it('lists sessions sorted by most recently updated', async () => {
    const { createSession, listSessions } = await import('./session');
    const first = createSession('gemma4');
    const second = createSession('llama3');

    writeFileSync(
      getMetadataPath(first.metadata.id),
      JSON.stringify(
        {
          ...first.metadata,
          updatedAt: '2026-05-11T00:00:00.000Z',
        },
        null,
        2,
      ) + '\n',
      'utf8',
    );
    writeFileSync(
      getMetadataPath(second.metadata.id),
      JSON.stringify(
        {
          ...second.metadata,
          updatedAt: '2026-05-11T00:00:01.000Z',
        },
        null,
        2,
      ) + '\n',
      'utf8',
    );

    const sessions = listSessions();
    expect(sessions.map(({ id }) => id)).toEqual([
      second.metadata.id,
      first.metadata.id,
    ]);
  });

  it('excludes sessions from other directories when listing', async () => {
    const { createSession, listSessions } = await import('./session');
    const current = createSession('gemma4');
    const other = createSession('llama3');

    writeFileSync(
      getMetadataPath(other.metadata.id),
      JSON.stringify(
        { ...other.metadata, directory: '/other/project' },
        null,
        2,
      ) + '\n',
      'utf8',
    );

    const sessions = listSessions();
    expect(sessions.map(({ id }) => id)).toEqual([current.metadata.id]);
  });

  it('updates the stored model without changing updatedAt', async () => {
    const { createSession, loadSession, updateSessionModel } =
      await import('./session');
    const session = createSession('gemma4');
    const before = loadSession(session.metadata.id).metadata;

    const updated = updateSessionModel(session.metadata.id, 'llama3');

    expect(updated.model).toBe('llama3');
    expect(updated.updatedAt).toBe(before.updatedAt);
  });

  it('deletes a session directory', async () => {
    const { createSession, deleteSession } = await import('./session');
    const session = createSession('gemma4');

    deleteSession(session.metadata.id);

    expect(existsSync(getSessionDirectory(session.metadata.id))).toBe(false);
  });

  it('deletes a session directory when messages.jsonl is blank', async () => {
    const { createSession, deleteSessionIfEmpty } = await import('./session');
    const session = createSession('gemma4');

    expect(deleteSessionIfEmpty(session.metadata.id)).toBe(true);
    expect(existsSync(getSessionDirectory(session.metadata.id))).toBe(false);
  });

  it('deletes a session directory when messages.jsonl is missing', async () => {
    const { createSession, deleteSessionIfEmpty } = await import('./session');
    const session = createSession('gemma4');

    removeFileSync(getMessagesPath(session.metadata.id));

    expect(deleteSessionIfEmpty(session.metadata.id)).toBe(true);
    expect(existsSync(getSessionDirectory(session.metadata.id))).toBe(false);
  });

  it('keeps a session directory when messages.jsonl has content', async () => {
    const { appendMessage, createSession, deleteSessionIfEmpty } =
      await import('./session');
    const session = createSession('gemma4');

    appendMessage(
      session.metadata.id,
      { role: 'user', content: 'Persist this session' },
      'gemma4',
    );

    expect(deleteSessionIfEmpty(session.metadata.id)).toBe(false);
    expect(existsSync(getSessionDirectory(session.metadata.id))).toBe(true);
  });

  it('returns false when deleting an empty session that does not exist', async () => {
    const { deleteSessionIfEmpty } = await import('./session');

    expect(deleteSessionIfEmpty('missing')).toBe(false);
  });

  it('throws when loading a missing session', async () => {
    const { loadSession } = await import('./session');

    expect(() => loadSession('missing')).toThrow('Session not found: missing');
  });

  it('returns an empty list when the sessions directory does not exist', async () => {
    const { listSessions } = await import('./session');

    expect(listSessions()).toEqual([]);
  });

  it('loads an empty message list when messages.jsonl is blank', async () => {
    const { createSession, loadSession } = await import('./session');
    const session = createSession('gemma4');

    expect(loadSession(session.metadata.id).messages).toEqual([]);
  });

  it('loads an empty message list when messages.jsonl is missing', async () => {
    const { createSession, loadSession } = await import('./session');
    const session = createSession('gemma4');

    removeFileSync(getMessagesPath(session.metadata.id));

    expect(loadSession(session.metadata.id).messages).toEqual([]);
  });

  it('throws when metadata is malformed', async () => {
    const { createSession, loadSession } = await import('./session');
    const session = createSession('gemma4');

    writeFileSync(getMetadataPath(session.metadata.id), '{bad json}\n', 'utf8');

    expect(() => loadSession(session.metadata.id)).toThrow(
      `Invalid session metadata: ${session.metadata.id}`,
    );
  });

  it('throws when message lines are malformed', async () => {
    const { createSession, loadSession } = await import('./session');
    const session = createSession('gemma4');

    writeFileSync(getMessagesPath(session.metadata.id), '{bad json}\n', 'utf8');

    expect(() => loadSession(session.metadata.id)).toThrow(
      `Invalid session messages: ${session.metadata.id}`,
    );
  });

  it('skips malformed metadata when listing sessions', async () => {
    const { createSession, listSessions } = await import('./session');
    const session = createSession('gemma4');
    const brokenDirectory = join(getSessionsDirectory(), 'broken');

    mkdirSync(brokenDirectory, { recursive: true });
    writeFileSync(
      join(brokenDirectory, 'metadata.json'),
      '{bad json}\n',
      'utf8',
    );

    const sessions = listSessions();

    expect(sessions.map(({ id }) => id)).toEqual([session.metadata.id]);
  });

  it('writes metadata.json with the persisted title', async () => {
    const { appendMessage, createSession } = await import('./session');
    const session = createSession('gemma4');

    appendMessage(
      session.metadata.id,
      { role: 'user', content: 'Write metadata title' },
      'gemma4',
    );

    const metadata = JSON.parse(
      readFileSync(getMetadataPath(session.metadata.id), 'utf8'),
    ) as { title: string };
    expect(metadata.title).toBe('Write metadata title');
  });

  it('keeps the default title for assistant and blank user messages', async () => {
    const { appendMessage, createSession, loadSession } =
      await import('./session');
    const session = createSession('gemma4');

    appendMessage(
      session.metadata.id,
      { role: 'assistant', content: 'ready' },
      'gemma4',
    );
    appendMessage(
      session.metadata.id,
      { role: 'user', content: '   ' },
      'gemma4',
    );

    expect(loadSession(session.metadata.id).metadata.title).toBe('New session');
  });

  it('does not replace an existing derived title on later user messages', async () => {
    const { appendMessage, createSession, loadSession } =
      await import('./session');
    const session = createSession('gemma4');

    appendMessage(
      session.metadata.id,
      { role: 'user', content: 'First title' },
      'gemma4',
    );
    appendMessage(
      session.metadata.id,
      { role: 'user', content: 'Second title' },
      'gemma4',
    );

    expect(loadSession(session.metadata.id).metadata.title).toBe('First title');
  });

  it('truncates long first prompts when deriving titles', async () => {
    const { appendMessage, createSession, loadSession } =
      await import('./session');
    const session = createSession('gemma4');

    appendMessage(
      session.metadata.id,
      {
        role: 'user',
        content:
          'This title is intentionally very long so the stored metadata title is truncated for session lists',
      },
      'gemma4',
    );

    expect(loadSession(session.metadata.id).metadata.title.endsWith('…')).toBe(
      true,
    );
  });

  it('throws when deleting a missing session', async () => {
    const { deleteSession } = await import('./session');

    expect(() => {
      deleteSession('missing');
    }).toThrow('Session not found: missing');
  });
});
