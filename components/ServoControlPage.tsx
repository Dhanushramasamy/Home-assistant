"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowLeft, Minus, Plus, RotateCcw, Wifi } from "lucide-react";

type ServoBoard = {
  boardId: string;
  name: string;
  pin: number;
  online: boolean;
  ready: boolean;
  lastSeen: string | null;
  angle: number;
};

function gearPath(radius: number, teeth: number): string {
  const points: [number, number][] = [];
  const radii = [radius * 0.86, radius, radius, radius * 0.86, radius * 0.86, radius, radius, radius * 0.86];
  for (let tooth = 0; tooth < teeth; tooth++) {
    const base = (tooth / teeth) * Math.PI * 2 - Math.PI / 2;
    for (let step = 0; step < radii.length; step++) {
      const a = base + (step / radii.length) * (Math.PI * 2 / teeth);
      points.push([Math.cos(a) * radii[step], Math.sin(a) * radii[step]]);
    }
  }
  return points.map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(2)} ${y.toFixed(2)}`).join(" ") + "Z";
}

const MOTOR_GEAR = gearPath(18, 12);
const MIDDLE_GEAR = gearPath(30, 20);
const OUTPUT_GEAR = gearPath(45, 30);

export function ServoControlPage() {
  const [boards, setBoards] = useState<ServoBoard[]>([]);
  const [boardId, setBoardId] = useState("");
  const [angle, setAngle] = useState(90);
  const [reversed, setReversed] = useState(false);
  const [direction, setDirection] = useState("CENTER");
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("Loading servo boards…");
  const [busy, setBusy] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingAngle = useRef<number | null>(null);
  const previousOutputAngle = useRef(90);

  const refresh = useCallback(async () => {
    try {
      const response = await fetch("/api/servo", { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Couldn't load servo boards.");
      const nextBoards = (data.boards ?? []) as ServoBoard[];
      setBoards(nextBoards);
      setBoardId((current) => nextBoards.some((board) => board.boardId === current) ? current : nextBoards[0]?.boardId ?? "");
      setMessage(nextBoards.length ? "" : "No servo board is set up yet.");
    } catch (error) {
      setMessage((error as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
    const id = window.setInterval(() => void refresh(), 10_000);
    return () => {
      window.clearInterval(id);
      if (timer.current) clearTimeout(timer.current);
    };
  }, [refresh]);

  const selected = boards.find((board) => board.boardId === boardId);
  useEffect(() => {
    if (selected && pendingAngle.current === null) {
      const requested = reversed ? 180 - selected.angle : selected.angle;
      setAngle(requested);
      previousOutputAngle.current = selected.angle;
    }
    // Re-sync when the selected board changes; angle reports are updated after confirmed commands.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected?.boardId]);

  const send = async (outputAngle: number, targetBoard = boardId) => {
    if (!targetBoard) return;
    setBusy(true);
    setMessage("Sending position to ESP32…");
    try {
      const response = await fetch("/api/servo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ boardId: targetBoard, angle: outputAngle }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "The ESP32 couldn't move the servo.");
      pendingAngle.current = null;
      const confirmed = data.reportedAngle ?? data.angle ?? outputAngle;
      previousOutputAngle.current = confirmed;
      setMessage(`ESP32 confirmed ${confirmed}°`);
      await refresh();
    } catch (error) {
      pendingAngle.current = null;
      setMessage((error as Error).message);
      await refresh();
    } finally {
      setBusy(false);
    }
  };

  const outputAngle = reversed ? 180 - angle : angle;

  const chooseAngle = (raw: number) => {
    const nextAngle = Math.max(0, Math.min(180, Math.round(raw)));
    const targetBoard = boardId;
    const nextOutput = reversed ? 180 - nextAngle : nextAngle;
    const delta = nextOutput - previousOutputAngle.current;
    setDirection(delta === 0 ? "CENTER" : delta > 0 ? "CLOCKWISE" : "COUNTERCLOCKWISE");
    pendingAngle.current = nextOutput;
    setAngle(nextAngle);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      const latest = pendingAngle.current;
      if (latest !== null) void send(latest, targetBoard);
    }, 120);
  };

  const toggleReverse = () => {
    const next = !reversed;
    const nextOutput = Math.max(0, Math.min(180, Math.round(next ? 180 - angle : angle)));
    if (timer.current) clearTimeout(timer.current);
    pendingAngle.current = nextOutput;
    const delta = nextOutput - previousOutputAngle.current;
    setDirection(delta === 0 ? "CENTER" : delta > 0 ? "CLOCKWISE" : "COUNTERCLOCKWISE");
    setReversed(next);
    void send(nextOutput);
  };

  const errorState = /offline|couldn't|could not|hasn't confirmed|access|sign in|not signed|isn't ready/i.test(message);
  const gearTransition = "transform 420ms cubic-bezier(.2,.75,.25,1)";
  const outputTurn = outputAngle - 90;
  const motorTurn = (outputAngle - 90) * (30 / 12);
  const middleTurn = -(outputAngle - 90) * (30 / 20);

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-3xl flex-1 flex-col px-5 pb-12 pt-6 sm:px-8 sm:pt-10">
      <header className="flex items-center justify-between">
        <Link href="/" className="glass-btn flex h-12 items-center gap-2 rounded-full px-4 text-sm text-ink transition-transform active:scale-95">
          <ArrowLeft className="h-4 w-4" /> Home
        </Link>
        <div className="flex items-center gap-2 text-xs text-muted">
          <Wifi className="h-4 w-4 text-accent" /> Supabase cloud
        </div>
      </header>

      <section className="mx-auto my-auto w-full max-w-xl py-10">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-accent">ESP32 · GPIO {selected?.pin ?? 18}</p>
        <h1 className="mt-2 text-3xl font-medium tracking-tight text-ink sm:text-4xl">Servo motion</h1>
        <p className="mt-2 text-sm text-muted">Set the output angle and watch the gears follow.</p>

        {boards.length > 1 && (
          <label className="mt-6 block text-sm text-muted">
            Board
            <select value={boardId} disabled={busy} onChange={(event) => {
              const nextBoardId = event.target.value;
              const nextBoard = boards.find((board) => board.boardId === nextBoardId);
              setBoardId(nextBoardId);
              if (nextBoard) setAngle(reversed ? 180 - nextBoard.angle : nextBoard.angle);
            }} className="glass mt-2 h-12 w-full rounded-2xl px-4 text-ink focus:outline-none disabled:opacity-50">
              {boards.map((board) => <option key={board.boardId} value={board.boardId}>{board.name}</option>)}
            </select>
          </label>
        )}

        <section className="mt-5 overflow-hidden rounded-[28px] border border-white/10 bg-gradient-to-br from-[#242b31] to-[#171c20] shadow-2xl" aria-label="Interactive servo model">
          <div className="px-3 pt-4 sm:px-5">
            <svg viewBox="0 0 640 370" role="img" aria-labelledby="servo-title servo-description" className="block h-auto w-full overflow-visible">
              <title id="servo-title">Cutaway servo motor at {outputAngle} degrees</title>
              <desc id="servo-description">A motor and three meshing gears rotate the servo output horn to the selected angle.</desc>
              <defs>
                <linearGradient id="servo-case" x1="0" x2=".9" y1="0" y2="1"><stop offset="0" stopColor="#a5b4bc" /><stop offset="1" stopColor="#71838e" /></linearGradient>
                <linearGradient id="servo-side" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stopColor="#60727d" /><stop offset="1" stopColor="#3b4b55" /></linearGradient>
                <radialGradient id="servo-gear" cx="35%" cy="25%"><stop offset="0" stopColor="#c4d1d7" /><stop offset="1" stopColor="#738994" /></radialGradient>
                <filter id="servo-shadow" x="-30%" y="-30%" width="160%" height="180%"><feDropShadow dx="0" dy="7" stdDeviation="7" floodColor="#000" floodOpacity=".38" /></filter>
              </defs>
              <path d="M40 335H600" stroke="#35434c" />
              <g filter="url(#servo-shadow)">
                <path d="M94 115H148V150H94Q82 150 82 138V127Q82 115 94 115ZM492 115H546Q558 115 558 127V138Q558 150 546 150H492ZM94 278H148V313H94Q82 313 82 301V290Q82 278 94 278ZM492 278H546Q558 278 558 290V301Q558 313 546 313H492Z" fill="#8497a2" stroke="#bfccd1" strokeWidth="1.5" />
                <path d="M110 102H530V292L501 325H139L110 292Z" fill="url(#servo-side)" />
                <path d="M110 91Q110 77 124 77H516Q530 77 530 91V284H110Z" fill="url(#servo-case)" stroke="#b8c5cc" strokeWidth="2" />
                <path d="M188 120H489V280H188Z" fill="#202a32" stroke="#9babb4" strokeWidth="2" />
                <path d="M190 122H487V158H190Z" fill="#ffffff" opacity=".04" />
                <rect x="127" y="155" width="42" height="91" rx="8" fill="url(#servo-side)" stroke="#aab8bf" strokeWidth="1.5" />
                <rect x="132" y="164" width="32" height="71" rx="15" fill="#c2ccd1" stroke="#ecf0f1" strokeWidth="1.5" />
                <ellipse cx="148" cy="165" rx="16" ry="7" fill="#82939d" stroke="#d4dde1" strokeWidth="1.5" />
                <path d="M139 177v38M148 176v40M157 177v38" stroke="#62737d" strokeWidth="2" />
                <path d="M151 153L122 126H50M389 121L440 102H584" fill="none" stroke="#7c929e" strokeDasharray="3 4" />
                <text x="46" y="119" fill="#dce5e9" fontSize="11" fontWeight="600" letterSpacing="1">DC MOTOR</text>
                <text x="46" y="133" fill="#a9b7bf" fontSize="10">drives gear train</text>
                <text x="488" y="91" fill="#dce5e9" fontSize="11" fontWeight="600" letterSpacing="1">OUTPUT HORN</text>
                <text x="488" y="105" fill="#a9b7bf" fontSize="10">turns to target</text>
                <text x="204" y="269" fill="#a9b7bf" fontSize="10" letterSpacing="1">GEAR TRAIN</text>
              </g>
              <g transform={`rotate(${motorTurn} 190 204)`} style={{ transition: gearTransition }}>
                <path d={MOTOR_GEAR} transform="translate(190 204)" fill="#bfccd1" stroke="#d0dbe0" strokeWidth="1.5" />
                <circle cx="190" cy="204" r="6" fill="#27323a" stroke="#d8e0e4" strokeWidth="1.5" />
                <path d="M190 199V181M185 204H172M195 204H208M190 209V227" stroke="#d1dce1" strokeWidth="3" strokeLinecap="round" />
              </g>
              <g transform={`rotate(${middleTurn} 238 204)`} style={{ transition: gearTransition }}>
                <path d={MIDDLE_GEAR} transform="translate(238 204)" fill="#6f8795" stroke="#d0dbe0" strokeWidth="1.5" />
                <circle cx="238" cy="204" r="8" fill="#27323a" stroke="#d8e0e4" strokeWidth="1.5" />
                <path d="M238 196V178M230 204H212M246 204H264M238 212V230" stroke="#d1dce1" strokeWidth="3" strokeLinecap="round" />
              </g>
              <g transform={`rotate(${outputTurn} 313 204)`} style={{ transition: gearTransition }}>
                <path d={OUTPUT_GEAR} transform="translate(313 204)" fill="url(#servo-gear)" stroke="#d0dbe0" strokeWidth="1.5" />
                <circle cx="313" cy="204" r="12" fill="#27323a" stroke="#d8e0e4" strokeWidth="1.5" />
                <path d="M313 192V171M301 204H280M325 204H346M313 216V237" stroke="#d1dce1" strokeWidth="3" strokeLinecap="round" />
              </g>
              <g transform={`rotate(${outputTurn} 313 204)`} style={{ transition: gearTransition }}>
                <path d="M302 199L300 149Q313 141 326 149L324 199Z" fill="#e5ecef" stroke="#fff" strokeWidth="1.3" />
                <circle cx="313" cy="155" r="4" fill="#46545d" stroke="#f2f5f6" />
                <circle cx="313" cy="169" r="4" fill="#46545d" stroke="#f2f5f6" />
                <circle cx="313" cy="183" r="4" fill="#46545d" stroke="#f2f5f6" />
                <circle cx="313" cy="204" r="9" fill="#d8e2e7" stroke="#fff" strokeWidth="1.5" />
                <circle cx="313" cy="204" r="3" fill="#647781" />
              </g>
              <path d="M355 153 A54 54 0 0 1 360 245" fill="none" stroke="#ffb66d" strokeWidth="2" strokeLinecap="round" />
              <path d="M0 0L-8 -4L-7 5Z" transform="translate(360 245) rotate(80)" fill="#ffb66d" />
              <text x="313" y="252" textAnchor="middle" fill="#dce5e9" fontSize="11" fontWeight="600">{outputAngle}°</text>
              <text x="46" y="340" fill="#a9b7bf" fontSize="10" letterSpacing=".5">SG90-STYLE SERVO · MOTION SHOWN SCHEMATICALLY</text>
            </svg>
          </div>

          <div className="border-t border-white/10 bg-black/10 px-5 py-5 sm:px-7">
            <div className="mb-2 flex items-baseline justify-between gap-3">
              <span className="text-sm text-muted">Output angle</span>
              <output className="font-mono text-3xl font-semibold tabular-nums text-ink" aria-live="polite">{outputAngle}°</output>
              <span className="font-mono text-[11px] tracking-widest text-[#ffb66d]">{direction}</span>
            </div>
            <label className="sr-only" htmlFor="servo-angle">Servo angle from 0 to 180 degrees</label>
            <input id="servo-angle" className="slider w-full" type="range" min="0" max="180" step="1" value={angle} disabled={!selected || !selected.online || !selected.ready || busy} onChange={(event) => chooseAngle(Number(event.target.value))} />
            <div className="mt-2 flex justify-between font-mono text-xs tabular-nums text-dim"><span>0°</span><span>90°</span><span>180°</span></div>

            <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap gap-2">
                <button type="button" onClick={() => chooseAngle(angle - 5)} disabled={!selected || !selected.online || !selected.ready || busy} className="glass-btn flex h-11 items-center gap-2 rounded-xl px-3 text-sm text-ink disabled:opacity-40"><Minus className="h-4 w-4" /> Turn left</button>
                <button type="button" onClick={() => chooseAngle(angle + 5)} disabled={!selected || !selected.online || !selected.ready || busy} className="glass-btn flex h-11 items-center gap-2 rounded-xl px-3 text-sm text-ink disabled:opacity-40">Turn right <Plus className="h-4 w-4" /></button>
              </div>
              <button type="button" onClick={toggleReverse} disabled={!selected || !selected.online || !selected.ready || busy} aria-pressed={reversed} className="glass-btn flex h-11 items-center gap-2 rounded-xl px-3 text-sm text-ink disabled:opacity-40"><RotateCcw className="h-4 w-4" /> Reverse direction</button>
            </div>
            <p className="mt-3 text-xs text-muted">{reversed ? "Reverse direction" : "Normal direction"} · horn at {outputAngle}°</p>
          </div>
        </section>

        <p className="mt-4 flex min-h-6 items-center gap-2 px-1 text-xs text-muted" aria-live="polite">
          <span className={`h-1.5 w-1.5 rounded-full ${selected?.online && selected.ready ? "bg-success" : "bg-danger"}`} />
          {loading ? "Checking board…" : selected ? `${selected.name} · GPIO ${selected.pin} · ${!selected.online ? "Offline" : !selected.ready ? "Upload servo firmware" : (message || "Online")}` : message}
        </p>
        {!loading && boards.length === 0 && (
          <div className="mt-5 glass rounded-2xl p-4 text-sm text-muted">
            <p>{/couldn't|not signed|sign in|setup/i.test(message) ? message : "Ask an admin to add the ESP32 in Settings → Boards, set its relay pin and Wi‑Fi, choose the servo GPIO (new boards default to GPIO 18), then download and upload its firmware. Add a switch for its relay and grant access."}</p>
            <Link href="/" className="mt-3 inline-flex items-center gap-2 text-accent">Open Home Control</Link>
          </div>
        )}
        {message && boards.length > 0 && <p className={`mt-2 px-1 text-xs ${errorState ? "text-danger" : "text-muted"}`}>{message}</p>}
      </section>
    </main>
  );
}
