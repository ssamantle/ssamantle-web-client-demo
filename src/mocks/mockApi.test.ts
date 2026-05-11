import {
  __resetMockStore,
  fetchMockGameState,
  fetchMockGuessHistory,
  joinMockGame,
  submitMockGuess,
  validateMockSession,
} from "./mockApi";

beforeEach(() => {
  __resetMockStore();
});

test("joinMockGame reuses the same session for the same username", async () => {
  const first = await joinMockGame("demo-user");
  const second = await joinMockGame("demo-user");

  expect(second).toEqual(first);
});

test("submitMockGuess persists history and updates the leaderboard", async () => {
  const auth = await joinMockGame("demo-user");

  await submitMockGuess(auth.sessionId, auth.username, "ssamantle");

  await expect(validateMockSession(auth.sessionId)).resolves.toBe(true);
  await expect(fetchMockGuessHistory(auth.sessionId, auth.username)).resolves.toEqual([
    {
      isAnswer: true,
      label: "ssamantle",
      rank: 1,
      similarity: 100,
      wordRank: 1,
    },
  ]);

  const state = await fetchMockGameState();

  expect(state.players).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        name: "demo-user",
        rank: 1,
        bestSimilarity: 100,
      }),
    ]),
  );
});
