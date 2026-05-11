import type {
  AuthState,
  GameState,
  GuessResult,
  PlayerState,
} from "../types/game";
import { normalizeInput } from "../utils/inputValidation";
import { WORD_RANK_VOCAB_SIZE } from "../utils/raceMap";

const STORAGE_KEY = "ssamantle.mock.store";
const MOCK_ANSWER = "ssamantle";
const MOCK_GAME_STARTED_AT_OFFSET_MS = 1000 * 60 * 30;
const MOCK_GAME_ENDS_AT_OFFSET_MS = 1000 * 60 * 60 * 6;

interface StoredSession {
  username: string;
}

interface MockStore {
  sessions: Record<string, StoredSession>;
  guessHistoryBySessionId: Record<string, GuessResult[]>;
}

const MOCK_BASE_PLAYERS: Array<Omit<PlayerState, "rank">> = [
  {
    name: "alpha",
    bestSimilarity: 96.42,
    bestSubmission: {
      similarity: 96.42,
      wordRank: 184,
    },
    latestSubmission: {
      similarity: 94.1,
      wordRank: 266,
    },
  },
  {
    name: "bravo",
    bestSimilarity: 91.36,
    bestSubmission: {
      similarity: 91.36,
      wordRank: 843,
    },
    latestSubmission: {
      similarity: 90.04,
      wordRank: 1016,
    },
  },
  {
    name: "charlie",
    bestSimilarity: 87.58,
    bestSubmission: {
      similarity: 87.58,
      wordRank: 1548,
    },
    latestSubmission: {
      similarity: 82.63,
      wordRank: 2412,
    },
  },
];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isGuessResult(value: unknown): value is GuessResult {
  if (!isRecord(value)) return false;

  return (
    typeof value.isAnswer === "boolean" &&
    typeof value.label === "string" &&
    typeof value.rank === "number" &&
    Number.isFinite(value.rank) &&
    typeof value.similarity === "number" &&
    Number.isFinite(value.similarity) &&
    typeof value.wordRank === "number" &&
    Number.isFinite(value.wordRank)
  );
}

function readStore(): MockStore {
  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    return {
      sessions: {},
      guessHistoryBySessionId: {},
    };
  }

  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!isRecord(parsed)) {
      throw new Error("Invalid mock store");
    }

    const sessions = isRecord(parsed.sessions) ? parsed.sessions : {};
    const guessHistoryBySessionId = isRecord(parsed.guessHistoryBySessionId)
      ? parsed.guessHistoryBySessionId
      : {};

    return {
      sessions: Object.fromEntries(
        Object.entries(sessions).flatMap(([sessionId, value]) => {
          if (!isRecord(value) || typeof value.username !== "string") {
            return [];
          }

          const username = normalizeInput(value.username, {
            collapseWhitespace: true,
          });

          if (!username) {
            return [];
          }

          return [[sessionId, { username }]];
        }),
      ),
      guessHistoryBySessionId: Object.fromEntries(
        Object.entries(guessHistoryBySessionId).map(([sessionId, value]) => [
          sessionId,
          Array.isArray(value) ? value.filter(isGuessResult) : [],
        ]),
      ),
    };
  } catch {
    return {
      sessions: {},
      guessHistoryBySessionId: {},
    };
  }
}

function writeStore(store: MockStore): void {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
}

function comparePlayersByLeaderboard(a: PlayerState, b: PlayerState): number {
  if (b.bestSimilarity !== a.bestSimilarity) {
    return b.bestSimilarity - a.bestSimilarity;
  }

  return a.name.localeCompare(b.name);
}

function toRank(similarity: number): number {
  if (similarity >= 100) return 1;

  return Math.max(2, Math.round(100 - similarity) + 1);
}

function clampSimilarity(value: number): number {
  return Math.max(0, Math.min(99.99, value));
}

function toWordRank(similarity: number): number {
  if (similarity >= 100) return 1;

  return Math.max(
    2,
    Math.min(
      WORD_RANK_VOCAB_SIZE,
      Math.round(((100 - similarity) / 100) * WORD_RANK_VOCAB_SIZE),
    ),
  );
}

function hashWord(word: string): number {
  return word.split("").reduce((acc, char, index) => {
    return acc + char.charCodeAt(0) * (index + 17);
  }, 0);
}

function createGuessResult(word: string): GuessResult {
  const normalizedWord = normalizeInput(word).toLowerCase();

  if (normalizedWord === MOCK_ANSWER) {
    return {
      isAnswer: true,
      label: word,
      rank: 1,
      similarity: 100,
      wordRank: 1,
    };
  }

  const answerChars = new Set(MOCK_ANSWER.split(""));
  const uniqueChars = new Set(normalizedWord.split(""));
  const sharedChars = Array.from(uniqueChars).filter((char) => answerChars.has(char)).length;
  const prefixBonus = normalizedWord[0] === MOCK_ANSWER[0] ? 8 : 0;
  const lengthPenalty = Math.abs(normalizedWord.length - MOCK_ANSWER.length) * 2;
  const variation = (hashWord(normalizedWord) % 240) / 10;
  const similarity = Number(
    clampSimilarity(24 + sharedChars * 9 + prefixBonus + variation - lengthPenalty).toFixed(2),
  );

  return {
    isAnswer: false,
    label: word,
    rank: toRank(similarity),
    similarity,
    wordRank: toWordRank(similarity),
  };
}

function getHistory(store: MockStore, sessionId: string): GuessResult[] {
  return store.guessHistoryBySessionId[sessionId] ?? [];
}

function ensureSession(store: MockStore, sessionId: string): StoredSession {
  const session = store.sessions[sessionId];
  if (!session) {
    throw new Error("Mock session has expired. Please join the game again.");
  }

  return session;
}

function createPlayerFromHistory(name: string, history: GuessResult[]): Omit<PlayerState, "rank"> {
  const latestSubmission = history.length > 0 ? history[history.length - 1] : null;
  const bestSubmission =
    history.length > 0
      ? [...history].sort((a, b) => {
          if (b.similarity !== a.similarity) {
            return b.similarity - a.similarity;
          }

          return a.wordRank - b.wordRank;
        })[0]
      : null;

  return {
    name,
    bestSimilarity: bestSubmission?.similarity ?? 0,
    bestSubmission: bestSubmission
      ? {
          similarity: bestSubmission.similarity,
          wordRank: bestSubmission.wordRank,
        }
      : null,
    latestSubmission: latestSubmission
      ? {
          similarity: latestSubmission.similarity,
          wordRank: latestSubmission.wordRank,
        }
      : null,
  };
}

export function validateMockSession(sessionId: string): Promise<boolean> {
  const store = readStore();
  return Promise.resolve(Boolean(store.sessions[sessionId]));
}

export function joinMockGame(name: string): Promise<AuthState> {
  const username = normalizeInput(name, { collapseWhitespace: true });
  const store = readStore();

  const existingSessionEntry = Object.entries(store.sessions).find(([, session]) => {
    return session.username.toLowerCase() === username.toLowerCase();
  });

  if (existingSessionEntry) {
    const [sessionId, session] = existingSessionEntry;
    return Promise.resolve({
      username: session.username,
      sessionId,
    });
  }

  const sessionId = `mock-session-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  store.sessions[sessionId] = { username };
  store.guessHistoryBySessionId[sessionId] = getHistory(store, sessionId);
  writeStore(store);

  return Promise.resolve({
    username,
    sessionId,
  });
}

export function fetchMockGameState(): Promise<GameState> {
  const store = readStore();
  const sessionPlayers = Object.entries(store.sessions).map(([sessionId, session]) => {
    return createPlayerFromHistory(session.username, getHistory(store, sessionId));
  });
  const sessionPlayerNames = new Set(sessionPlayers.map((player) => player.name.toLowerCase()));

  const players = [...MOCK_BASE_PLAYERS, ...sessionPlayers]
    .filter((player, index, array) => {
      if (index < MOCK_BASE_PLAYERS.length) {
        return !sessionPlayerNames.has(player.name.toLowerCase());
      }

      return array.findIndex((candidate) => candidate.name === player.name) === index;
    })
    .sort((a, b) => comparePlayersByLeaderboard({ ...a, rank: 0 }, { ...b, rank: 0 }))
    .map((player, index) => ({
      ...player,
      rank: index + 1,
    }));

  return Promise.resolve({
    startAt: new Date(Date.now() - MOCK_GAME_STARTED_AT_OFFSET_MS),
    endAt: new Date(Date.now() + MOCK_GAME_ENDS_AT_OFFSET_MS),
    players,
  });
}

export function submitMockGuess(
  sessionId: string,
  username: string,
  word: string,
): Promise<GuessResult> {
  const store = readStore();
  const session = ensureSession(store, sessionId);
  const normalizedUsername = normalizeInput(username, {
    collapseWhitespace: true,
  });

  if (session.username.toLowerCase() !== normalizedUsername.toLowerCase()) {
    throw new Error("Mock session does not match the current user.");
  }

  const nextResult = createGuessResult(word);
  store.guessHistoryBySessionId[sessionId] = [...getHistory(store, sessionId), nextResult];
  writeStore(store);

  return Promise.resolve(nextResult);
}

export function fetchMockGuessHistory(
  sessionId: string,
  username: string,
): Promise<GuessResult[]> {
  const store = readStore();
  const session = ensureSession(store, sessionId);
  const normalizedUsername = normalizeInput(username, {
    collapseWhitespace: true,
  });

  if (session.username.toLowerCase() !== normalizedUsername.toLowerCase()) {
    throw new Error("Mock session does not match the current user.");
  }

  return Promise.resolve([...getHistory(store, sessionId)]);
}

export function __resetMockStore(): void {
  window.localStorage.removeItem(STORAGE_KEY);
}
