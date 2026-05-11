import { gamesApi } from "../api/client";
import { isMockApiEnabled } from "../config/runtime";
import {
  fetchMockGameState,
  fetchMockGuessHistory,
  joinMockGame,
  submitMockGuess,
} from "../mocks/mockApi";
import type {
  AuthState,
  GameState,
  GuessResult,
  PlayerSubmission,
} from "../types/game";
import {
  normalizeInput,
  validateGuessWord,
  validateUsername,
} from "../utils/inputValidation";

function toDate(value: unknown): Date | null {
  if (!value) return null;

  const date = new Date(value as string);
  return Number.isNaN(date.getTime()) ? null : date;
}

async function toApiError(
  error: unknown,
  fallbackMessage: string,
): Promise<Error> {
  if (error instanceof Error && error.message.trim()) {
    return error;
  }

  if (error instanceof Response) {
    try {
      const data = (await error.json()) as { detail?: unknown };
      if (typeof data.detail === "string" && data.detail.trim()) {
        return new Error(data.detail);
      }
    } catch {
      return new Error(fallbackMessage);
    }
  }

  return new Error(fallbackMessage);
}

function toPlayerSubmission(value: unknown): PlayerSubmission | null {
  if (!value || typeof value !== "object") return null;

  const data = value as {
    similarity?: unknown;
    wordRank?: unknown;
  };

  if (typeof data.similarity !== "number" || !Number.isFinite(data.similarity)) {
    return null;
  }

  const toValidRank = (rawRank: unknown): number | null => {
    if (typeof rawRank !== "number" || !Number.isFinite(rawRank) || rawRank < 0) {
      return null;
    }

    return Math.trunc(rawRank);
  };

  return {
    similarity: data.similarity,
    wordRank: toValidRank(data.wordRank),
  };
}

export async function fetchGameState(): Promise<GameState> {
  if (isMockApiEnabled) {
    return fetchMockGameState();
  }

  const data = await gamesApi.gamePollingApiV1GamesPollingGet();

  return {
    startAt: toDate(data.startAt),
    endAt: toDate(data.endAt),
    players: [...data.users]
      .map((user) => ({
        name: user.name,
        rank: user.rank,
        bestSimilarity: user.bestSimilarity,
        bestSubmission: toPlayerSubmission(user.bestSubmission),
        latestSubmission: toPlayerSubmission(user.latestSubmission),
      }))
      .sort((a, b) => a.rank - b.rank),
  };
}

export async function joinGame(name: string): Promise<AuthState> {
  const usernameValidation = validateUsername(name);
  if (!usernameValidation.isValid) {
    throw new Error(usernameValidation.error ?? "사용자명을 확인해 주세요.");
  }

  if (isMockApiEnabled) {
    return joinMockGame(usernameValidation.value);
  }

  try {
    const response = await gamesApi.joinGameApiV1GamesJoinPost({
      nickname: usernameValidation.value,
    });

    return {
      username: response.nickname,
      sessionId: response.sessionId,
    };
  } catch (error) {
    throw await toApiError(
      error,
      "게임 참가에 실패했습니다. 잠시 후 다시 시도해 주세요.",
    );
  }
}

export async function submitGuess(
  sessionId: string,
  username: string,
  word: string,
): Promise<GuessResult> {
  const guessValidation = validateGuessWord(word);
  if (!guessValidation.isValid) {
    throw new Error(guessValidation.error ?? "추측한 단어를 확인해 주세요.");
  }

  if (isMockApiEnabled) {
    return submitMockGuess(sessionId, username, guessValidation.value);
  }

  const response = await gamesApi.guessWordApiV1GamesGuessPost(sessionId, {
    username: normalizeInput(username, { collapseWhitespace: true }),
    word: guessValidation.value,
  });

  return {
    isAnswer: response.isAnswer,
    label: response.label,
    rank: response.rank,
    similarity: response.similarity,
    wordRank: response.wordRank,
  };
}

export async function fetchGuessHistory(
  sessionId: string,
  username: string,
): Promise<GuessResult[]> {
  if (isMockApiEnabled) {
    return fetchMockGuessHistory(sessionId, username);
  }

  const response = await gamesApi.getGuessHistoryApiV1GamesGuessesGet(
    username,
    sessionId,
  );

  return response.map((item) => ({
    isAnswer: item.isAnswer,
    label: item.label,
    rank: item.rank,
    similarity: item.similarity,
    wordRank: item.wordRank,
  }));
}
