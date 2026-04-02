import { useState, useCallback, useEffect, useRef } from "react";
import { ConnectButton } from "./ConnectButton";

interface HistoryEntry {
  round: number;
  choice: string;
  won: boolean;
  pnl: number;
  bet: number;
  multiplier: number;
}

type Phase = "SHUFFLE" | "BET" | "SWITCH" | "RESULT";

const CURRENT_BET = 5;

export function App() {
  const [showLeftPanel, setShowLeftPanel] = useState(true);
  const [balance, setBalance] = useState(1000);
  const [round, setRound] = useState(1);
  const [phase, setPhase] = useState<Phase>("SHUFFLE");
  const [carDoor, setCarDoor] = useState(-1);
  const [playerPick, setPlayerPick] = useState(-1);
  const [revealedDoor, setRevealedDoor] = useState(-1);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [message, setMessage] = useState("");
  const [resultInfo, setResultInfo] = useState<{
    type: "win" | "lose";
    text: string;
    sub: string;
  } | null>(null);
  const [finalPick, setFinalPick] = useState(-1);
  const [allRevealed, setAllRevealed] = useState(false);

  // Shuffle state
  const [shuffleCarDoor, setShuffleCarDoor] = useState(() =>
    Math.floor(Math.random() * 3),
  );
  const [shuffleRevealed, setShuffleRevealed] = useState(true);
  const [shufflePositions, setShufflePositions] = useState([0, 1, 2]);
  const [shuffling, setShuffling] = useState(false);
  const shuffleTimers = useRef<number[]>([]);

  const startShuffle = useCallback(() => {
    const car = Math.floor(Math.random() * 3);
    setShuffleCarDoor(car);
    setShuffleRevealed(true);
    setShufflePositions([0, 1, 2]);
    setShuffling(false);
    setPhase("SHUFFLE");

    // Show revealed for 1.5s
    const t1 = window.setTimeout(() => {
      setShuffleRevealed(false); // flip closed
    }, 1500);

    // Start shuffling after flip (0.5s for flip animation)
    const t2 = window.setTimeout(() => {
      setShuffling(true);
      let positions = [0, 1, 2];
      const shuffleCount = 6;
      for (let s = 0; s < shuffleCount; s++) {
        const t = window.setTimeout(() => {
          const i = Math.floor(Math.random() * 3);
          let j = Math.floor(Math.random() * 3);
          while (j === i) j = Math.floor(Math.random() * 3);
          positions = [...positions];
          const temp = positions[i];
          positions[i] = positions[j];
          positions[j] = temp;
          setShufflePositions([...positions]);
        }, s * 350);
        shuffleTimers.current.push(t);
      }
      // End shuffle
      const tEnd = window.setTimeout(
        () => {
          setShuffling(false);
          setPhase("BET");
        },
        shuffleCount * 350 + 200,
      );
      shuffleTimers.current.push(tEnd);
    }, 2000);

    shuffleTimers.current.push(t1, t2);
  }, []);

  useEffect(() => {
    startShuffle();
    return () => shuffleTimers.current.forEach(clearTimeout);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const fireConfetti = useCallback(() => {
    if (typeof window !== "undefined" && (window as any).confetti) {
      const end = Date.now() + 600;
      const frame = () => {
        (window as any).confetti({
          particleCount: 3,
          angle: 60,
          spread: 55,
          origin: { x: 0, y: 0.6 },
        });
        (window as any).confetti({
          particleCount: 3,
          angle: 120,
          spread: 55,
          origin: { x: 1, y: 0.6 },
        });
        if (Date.now() < end) requestAnimationFrame(frame);
      };
      frame();
    }
  }, []);

  const makeChoice = useCallback(
    (choice: "stay" | "switch") => {
      if (phase !== "SWITCH") return;
      setPhase("RESULT");

      let fp = playerPick;
      if (choice === "switch") {
        fp = [0, 1, 2].find((d) => d !== playerPick && d !== revealedDoor)!;
      }
      setFinalPick(fp);
      setAllRevealed(true);

      const won = fp === carDoor;
      const multiplier = choice === "stay" ? 1.8 : 1.35;

      if (won) {
        const payout = Math.floor(CURRENT_BET * multiplier * 100) / 100;
        setBalance((b) => b + payout);
        const pnl = +(payout - CURRENT_BET).toFixed(2);
        setResultInfo({
          type: "win",
          text: "You Win!",
          sub: `+${payout.toFixed(1)} INIT (${choice} ${multiplier}x)`,
        });
        setMessage(
          `Car was behind the ${["first", "second", "third"][carDoor]} door`,
        );
        setHistory((h) => [
          {
            round,
            choice: choice.toUpperCase(),
            won: true,
            pnl,
            bet: CURRENT_BET,
            multiplier,
          },
          ...h,
        ]);
        fireConfetti();
      } else {
        setResultInfo({
          type: "lose",
          text: "You Lose",
          sub: `-${CURRENT_BET} INIT`,
        });
        setMessage(
          `Car was behind the ${["first", "second", "third"][carDoor]} door`,
        );
        setHistory((h) => [
          {
            round,
            choice: choice.toUpperCase(),
            won: false,
            pnl: -CURRENT_BET,
            bet: CURRENT_BET,
            multiplier,
          },
          ...h,
        ]);
      }
    },
    [phase, playerPick, revealedDoor, carDoor, round, fireConfetti],
  );

  const pickDoor = useCallback(
    (idx: number) => {
      if (phase === "SWITCH") {
        if (idx === revealedDoor) return;
        if (idx === playerPick) makeChoice("stay");
        else makeChoice("switch");
        return;
      }
      if (phase !== "BET") return;
      if (CURRENT_BET > balance) {
        setMessage("Insufficient balance!");
        return;
      }

      const newBalance = balance - CURRENT_BET;
      setBalance(newBalance);
      setPlayerPick(idx);

      const car = Math.floor(Math.random() * 3);
      setCarDoor(car);

      const candidates = [0, 1, 2].filter((d) => d !== idx && d !== car);
      const revealed =
        candidates[Math.floor(Math.random() * candidates.length)];
      setRevealedDoor(revealed);

      setPhase("SWITCH");
      setMessage("Stay or Switch?");
    },
    [phase, balance, playerPick, revealedDoor, makeChoice],
  );

  const resetGame = useCallback(() => {
    setRound((r) => r + 1);
    setPlayerPick(-1);
    setCarDoor(-1);
    setRevealedDoor(-1);
    setFinalPick(-1);
    setAllRevealed(false);
    setResultInfo(null);
    startShuffle();
  }, [startShuffle]);

  const clearHistory = useCallback(() => setHistory([]), []);

  const getDoorClasses = (i: number) => {
    const classes = ["door"];
    if (i === revealedDoor && phase !== "BET")
      classes.push("revealed", "eliminated", "goat-door");
    if (allRevealed) {
      classes.push("revealed");
      classes.push(i === carDoor ? "car-door" : "goat-door");
      if (i === finalPick) {
        classes.push("selected");
        classes.push(finalPick === carDoor ? "win-state" : "lose-state");
      }
    } else if (i === playerPick && phase !== "BET") {
      classes.push("selected");
    }
    if (phase === "RESULT") classes.push("locked");
    return classes.join(" ");
  };

  return (
    <div className="app-shell">
      {/* TOP BAR */}
      <div className="top-bar-wrapper">
        <div className="top-bar">
          <div className="top-left">
            <div className="top-stat">
              <div className="top-stat-label">Balance</div>
              <div className="top-stat-val">{balance.toFixed(1)} INIT</div>
            </div>
            <div className="top-stat">
              <div className="top-stat-label">Bet</div>
              <div className="top-stat-val">5 INIT</div>
            </div>
            <div className="top-stat">
              <div className="top-stat-label">Round</div>
              <div className="top-stat-val">{round}</div>
            </div>
          </div>
          <img src="/black logo.png" alt="MONTIA" className="logo" />
          <ConnectButton />
        </div>
      </div>

      {/* MAIN */}
      <div className="main-layout">
        {/* LEFT PANEL */}
        <div className={`left-panel ${showLeftPanel ? "" : "collapsed"}`}>
          <div>
            <h3>How to Play</h3>
            <ul className="rule-steps">
              <li className="rule-step">
                <div className="step-num">1</div>
                <div className="step-text">
                  Pick one of 3 doors. Behind one is a car, behind the others
                  are goats.
                </div>
              </li>
              <li className="rule-step">
                <div className="step-num">2</div>
                <div className="step-text">
                  The host reveals a goat behind one of the doors you
                  didn&apos;t pick.
                </div>
              </li>
              <li className="rule-step">
                <div className="step-num">3</div>
                <div className="step-text">
                  Choose to stay with your door or switch to the other unopened
                  door.
                </div>
              </li>
              <li className="rule-step">
                <div className="step-num">4</div>
                <div className="step-text">
                  If your final door has the car, you win!
                </div>
              </li>
            </ul>
          </div>

          <div className="payout-section">
            <h4>Payouts</h4>
            <div className="payout-row">
              <span className="payout-label">Stay + Win</span>
              <span className="payout-val">1.80x</span>
            </div>
            <div className="payout-divider" />
            <div className="payout-row">
              <span className="payout-label">Switch + Win</span>
              <span className="payout-val">1.35x</span>
            </div>
            <div className="payout-divider" />
            <div className="payout-row">
              <span className="payout-label">Stay odds</span>
              <span className="payout-val">33.3%</span>
            </div>
            <div className="payout-divider" />
            <div className="payout-row">
              <span className="payout-label">Switch odds</span>
              <span className="payout-val">66.6%</span>
            </div>
          </div>

          <div className="tip-box">
            <strong>Pro tip:</strong> Switching wins 2/3 of the time. The math
            says always switch!
          </div>
        </div>
        <button
          className="panel-toggle left-toggle"
          onClick={() => setShowLeftPanel(!showLeftPanel)}
        >
          {showLeftPanel ? "\u25C0" : "\u25B6"}
        </button>

        {/* GAME AREA */}
        <div className="game-area">
          {phase === "BET" && (
            <div className="result-header">
              <div className="result-title pick-title">Pick a door!</div>
            </div>
          )}
          {resultInfo && phase === "RESULT" && (
            <div className={`result-header ${resultInfo.type}`}>
              <div className="result-title">{resultInfo.text}</div>
              <div className="result-detail">{message}</div>
            </div>
          )}

          <div className="doors-container">
            {[0, 1, 2].map((i) => {
              if (phase === "SHUFFLE") {
                const pos = shufflePositions[i];
                const offset = (pos - i) * 208; // door width(180) + gap(28)
                const isCarDoor = i === shuffleCarDoor;
                const classes = ["door"];
                if (shuffleRevealed) {
                  classes.push(
                    "revealed",
                    isCarDoor ? "car-door" : "goat-door",
                  );
                }
                return (
                  <div
                    key={i}
                    className={classes.join(" ")}
                    style={{
                      transform: `translateX(${offset}px)`,
                      transition: shuffling ? "transform 0.3s ease" : undefined,
                    }}
                  >
                    <div className="door-mystery">?</div>
                    <div className="door-icon" />
                    <div className="door-label">{i + 1}</div>
                  </div>
                );
              }
              return (
                <div
                  key={i}
                  className={getDoorClasses(i)}
                  onClick={() => pickDoor(i)}
                >
                  <div className="door-mystery">?</div>
                  <div className="door-icon" />
                  <div className="door-label">{i + 1}</div>
                </div>
              );
            })}
          </div>

          <div className="game-ui">
            {phase === "SWITCH" && (
              <>
                <div className="msg-box">Stay or Switch?</div>
                <div className="switch-controls" style={{ display: "flex" }}>
                  <button
                    className="switch-btn"
                    onClick={() => makeChoice("stay")}
                  >
                    Stay
                  </button>
                  <button
                    className="switch-btn"
                    onClick={() => makeChoice("switch")}
                  >
                    Switch
                  </button>
                </div>
              </>
            )}

            {phase === "RESULT" && (
              <button
                className="play-again-btn"
                style={{ display: "inline-block" }}
                onClick={resetGame}
              >
                Play Again
              </button>
            )}
          </div>
        </div>

        {/* RIGHT PANEL */}
        <div className="right-panel">
          <div className="bets-list">
            {history.length === 0
              ? null
              : history.map((h, idx) => (
                  <div
                    key={idx}
                    className={`bet-entry ${h.won ? "win-entry" : "lose-entry"}`}
                  >
                    <div className="bet-entry-top">
                      <span
                        className={`bet-result ${h.won ? "win-text" : "lose-text"}`}
                      >
                        {h.won ? "WIN" : "LOSS"}
                      </span>
                      <span className="bet-multiplier">
                        {h.multiplier.toFixed(2)}x
                      </span>
                    </div>
                    <div className="bet-details">
                      Round {h.round} &bull; {h.choice}
                    </div>
                    <div className="bet-pnl">
                      <span className="amount">{h.bet} INIT </span>
                      <span className={h.won ? "pnl-win" : "pnl-lose"}>
                        {h.pnl >= 0 ? "+" : ""}
                        {h.pnl.toFixed(2)} INIT
                      </span>
                    </div>
                  </div>
                ))}
          </div>
        </div>
      </div>
    </div>
  );
}
