import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import GamePage from "./GamePage";
import { GamePhaseEnum } from "../types/game";
import { fetchGuessHistory } from "../services/gameService";
import { useGamePolling } from "../hooks/useGamePolling";
import { useGameClock } from "../hooks/useGameClock";
import { useGamePhase } from "../hooks/useGamePhase";
import confetti from "canvas-confetti";

jest.mock("canvas-confetti", () => {
  const create = jest.fn(() => jest.fn());
  return {
    __esModule: true,
    default: {
      create,
    },
  };
});

jest.mock("../services/gameService", () => ({
  fetchGuessHistory: jest.fn(),
}));

jest.mock("../hooks/useGamePolling", () => ({
  useGamePolling: jest.fn(),
}));

jest.mock("../hooks/useGameClock", () => ({
  useGameClock: jest.fn(),
}));

jest.mock("../hooks/useGamePhase", () => ({
  useGamePhase: jest.fn(),
}));

jest.mock("../components/game/WordGuessComposer", () => ({
  WordGuessComposer: ({
    onSubmitted,
  }: {
    onSubmitted: (result: {
      isAnswer: boolean;
      label: string;
      rank: number;
      similarity: number;
      wordRank: number;
    }) => Promise<void>;
  }) => (
    <>
      <button
        type="button"
        onClick={() =>
          void onSubmitted({
            isAnswer: false,
            label: "top-word",
            rank: 77,
            similarity: 14.55,
            wordRank: 245,
          })
        }
      >
        submit-latest-word
      </button>
      <button
        type="button"
        onClick={() =>
          void onSubmitted({
            isAnswer: true,
            label: "answer-word",
            rank: 1,
            similarity: 100,
            wordRank: 1,
          })
        }
      >
        submit-answer-word
      </button>
    </>
  ),
}));

const mockedFetchGuessHistory = fetchGuessHistory as jest.MockedFunction<
  typeof fetchGuessHistory
>;
const mockedUseGamePolling = useGamePolling as jest.MockedFunction<
  typeof useGamePolling
>;
const mockedUseGameClock = useGameClock as jest.MockedFunction<
  typeof useGameClock
>;
const mockedUseGamePhase = useGamePhase as jest.MockedFunction<
  typeof useGamePhase
>;

beforeEach(() => {
  mockedFetchGuessHistory.mockImplementation(
    () => new Promise(() => undefined),
  );
  mockedUseGameClock.mockReturnValue(new Date("2026-04-17T12:00:00+09:00"));
  mockedUseGamePhase.mockReturnValue({
    phase: GamePhaseEnum.PRE_GAME,
    remainingMs: 0,
    label: "게임 시작까지",
  });
  mockedUseGamePolling.mockReturnValue({
    gameState: {
      startAt: null,
      endAt: null,
      players: [],
    },
    isLoading: false,
    error: null,
    lastSyncedAt: new Date("2026-04-17T12:34:56+09:00"),
    refetch: jest.fn().mockResolvedValue(undefined),
  });
});

test("renders top info bar with synced time, username, and logout", () => {
  render(
    <GamePage
      username="tester"
      sessionId="session-1"
      onLogout={jest.fn()}
    />,
  );

  expect(screen.getByText("마지막 동기화")).toBeInTheDocument();
  expect(screen.getByText(/(?:오후|PM) 12:34:56/)).toBeInTheDocument();
  const logoutButton = screen.getByRole("button", { name: "로그아웃" });
  const topInfoBar = logoutButton.closest("div");
  expect(topInfoBar).not.toBeNull();
  expect(within(topInfoBar as HTMLElement).getByText("tester")).toBeInTheDocument();
  expect(logoutButton).toBeInTheDocument();
  expect(screen.getByText("싸맨틀 :: 단어 추측 게임")).toBeInTheDocument();
});

test("shows waiting text before first successful sync", () => {
  mockedUseGamePolling.mockReturnValue({
    gameState: {
      startAt: null,
      endAt: null,
      players: [],
    },
    isLoading: false,
    error: null,
    lastSyncedAt: null,
    refetch: jest.fn().mockResolvedValue(undefined),
  });

  render(
    <GamePage
      username="tester"
      sessionId="session-1"
      onLogout={jest.fn()}
    />,
  );

  expect(screen.getByText("동기화 대기 중")).toBeInTheDocument();
});

test("calls logout when the logout button is clicked", async () => {
  const onLogout = jest.fn();

  render(
    <GamePage
      username="tester"
      sessionId="session-1"
      onLogout={onLogout}
    />,
  );

  await userEvent.click(screen.getByRole("button", { name: "로그아웃" }));

  expect(onLogout).toHaveBeenCalledTimes(1);
});

test("shows the existing history row highlighted at the top after duplicate submission", async () => {
  mockedFetchGuessHistory.mockResolvedValue([
    {
      isAnswer: false,
      label: "top-word",
      rank: 4,
      similarity: 95.12,
      wordRank: 44,
    },
    {
      isAnswer: false,
      label: "mid-word",
      rank: 18,
      similarity: 84.22,
      wordRank: 180,
    },
  ]);

  render(
    <GamePage
      username="tester"
      sessionId="session-1"
      onLogout={jest.fn()}
    />,
  );

  await screen.findByText("top-word");
  await userEvent.click(screen.getByRole("button", { name: "submit-latest-word" }));

  await waitFor(() => {
    const rows = screen.getAllByRole("row").slice(1);
    expect(rows).toHaveLength(2);
    expect(within(rows[0]).getByText("top-word")).toBeInTheDocument();
    expect(rows[0]).toHaveAttribute("data-highlighted", "true");
    expect(rows[0]).toHaveClass("bg-[#f4eadb]");
  });
});

test("renders both best and latest similarity markers on the race map", () => {
  mockedUseGamePolling.mockReturnValue({
    gameState: {
      startAt: null,
      endAt: null,
      players: [
        {
          name: "alpha",
          rank: 1,
          bestSimilarity: 97.3,
          bestSubmission: {
            similarity: 97.3,
            wordRank: 2,
          },
          latestSubmission: {
            similarity: 88.4,
            wordRank: 84,
          },
        },
      ],
    },
    isLoading: false,
    error: null,
    lastSyncedAt: new Date("2026-04-17T12:34:56+09:00"),
    refetch: jest.fn().mockResolvedValue(undefined),
  });

  const { container } = render(
    <GamePage
      username="tester"
      sessionId="session-1"
      onLogout={jest.fn()}
    />,
  );

  const bestMarker = container.querySelector(
    '[data-similarity-marker-type="best"][data-player-name="alpha"]',
  );
  const latestMarker = container.querySelector(
    '[data-similarity-marker-type="latest"][data-player-name="alpha"]',
  );
  const latestMarkerLabel = container.querySelector(
    '[data-similarity-marker-label-type="latest"][data-player-name="alpha"]',
  );

  expect(bestMarker).toBeInTheDocument();
  expect(bestMarker).toHaveClass("bg-[#1c87b0]");
  expect(latestMarker).toBeInTheDocument();
  expect(latestMarker).toHaveClass("bg-[#aacada]");
  expect(latestMarkerLabel).toBeInTheDocument();
  expect(latestMarkerLabel).toHaveTextContent("alpha");
});

test("shows confetti with bilateral launch origins when the submitted guess is the answer", async () => {
  const { container } = render(
    <GamePage
      username="tester"
      sessionId="session-1"
      onLogout={jest.fn()}
    />,
  );

  await userEvent.click(screen.getByRole("button", { name: "submit-answer-word" }));

  await waitFor(() => {
    expect(
      container.querySelector('[data-confetti-active="true"]'),
    ).toBeInTheDocument();
  });

  const mockedConfetti = confetti as unknown as {
    create: jest.Mock;
  };
  expect(mockedConfetti.create).toHaveBeenCalled();
});
