// The website's version of the app's About scene (mobile/components/HowlingDogScene.tsx):
// flat outline drawing on a warm morning, seen from a little above. Paddy fields to the horizon,
// a small church far off, Bruno walks in along the path, the bell swings, he stops and howls
// ("awoooo" writes itself), then walks on. Pure SVG + CSS keyframes (globals.css, "scene-"),
// no JS. Always the morning colours, whatever the site's time-of-day theme (DECISIONS.md D15).

const INK = "#5a3a24";
const SKY = "#fde5cc";
const ORANGE = "#e8743a";
const PADDY = ["#cfe2a2", "#bdd78e", "#dbe9c4"];

function Paddies() {
  // A fixed perspective grid: rows deepen toward the viewer, bunds lean to a vanishing point.
  const top = 88;
  const bottom = 168;
  const rows = 5;
  const cols = 9;
  const vx = 220;
  const vy = top - 50;
  const rowY = (k: number) => top + (bottom - top) * Math.pow(k / rows, 1.5);
  const xAt = (j: number, y: number) => {
    const xb = -360 + (j * 1120) / cols;
    return vx + (xb - vx) * ((y - vy) / (bottom - vy));
  };
  const cells = [];
  const tufts = [];
  for (let k = 0; k < rows; k++) {
    const y0 = rowY(k);
    const y1 = rowY(k + 1);
    for (let j = 0; j < cols; j++) {
      const kind = (k * 2 + j * 3) % 3;
      const pts = [
        [xAt(j, y0), y0],
        [xAt(j + 1, y0), y0],
        [xAt(j + 1, y1), y1],
        [xAt(j, y1), y1],
      ]
        .map((p) => p.map((n) => n.toFixed(1)).join(","))
        .join(" ");
      cells.push(<polygon key={`c${k}-${j}`} points={pts} fill={PADDY[kind]} />);
      if (kind !== 2 && k >= 1) {
        const cy = (y0 + y1) / 2 + (y1 - y0) * 0.2;
        const cx = (xAt(j, cy) + xAt(j + 1, cy)) / 2;
        const s = 1.5 + (k / rows) * 4;
        tufts.push(
          <path
            key={`t${k}-${j}`}
            d={`M${cx - s * 0.6} ${cy - s} L${cx} ${cy} L${cx + s * 0.6} ${cy - s} M${cx} ${cy} L${cx} ${cy - s * 1.2}`}
            stroke="#7fa65a"
            strokeWidth={1}
            fill="none"
            strokeLinecap="round"
          />,
        );
      }
    }
  }
  return (
    <g>
      {cells}
      {Array.from({ length: rows + 1 }, (_, k) => (
        <line key={`r${k}`} x1={0} x2={400} y1={rowY(k)} y2={rowY(k)} stroke="rgba(90,58,36,0.3)" strokeWidth={0.8} />
      ))}
      {tufts}
    </g>
  );
}

export default function StoryScene() {
  return (
    <svg
      className="scene"
      viewBox="0 0 400 220"
      role="img"
      aria-label="Drawing: Bruno walks along a path between paddy fields, a church bell rings in the distance, and he stops to howl."
    >
      <rect width="400" height="220" fill={SKY} />
      {/* sun, birds, far hill */}
      <circle cx="250" cy="88" r="20" fill="#fcc690" stroke="#ee8a46" strokeWidth="1.6" />
      {[-60, -30, 0, 30, 60].map((deg) => {
        const a = ((deg - 90) * Math.PI) / 180;
        return (
          <line
            key={deg}
            x1={250 + Math.cos(a) * 26}
            y1={88 + Math.sin(a) * 26}
            x2={250 + Math.cos(a) * 33}
            y2={88 + Math.sin(a) * 33}
            stroke="#ee8a46"
            strokeWidth="1.6"
            strokeLinecap="round"
          />
        );
      })}
      <path className="scene-bird" d="M40 50 q4 -4 8 0 q4 -4 8 0" stroke={INK} strokeWidth="1.1" fill="none" />
      <path className="scene-bird scene-bird-2" d="M70 38 q3 -3 6 0 q3 -3 6 0" stroke={INK} strokeWidth="1" fill="none" />
      <path d="M0 86 Q 80 74 170 87" stroke="rgba(90,58,36,0.4)" strokeWidth="1.2" fill="none" />

      {/* land */}
      <rect y="88" width="400" height="132" fill="#f3d3a8" />
      <Paddies />
      <rect y="168" width="400" height="20" fill="#f3d3a8" />
      <line x1="0" x2="400" y1="168" y2="168" stroke={INK} strokeWidth="1.2" />
      <line x1="0" x2="400" y1="188" y2="188" stroke={INK} strokeWidth="1.2" />
      <rect y="188" width="400" height="32" fill={PADDY[1]} />
      <line x1="0" x2="400" y1="88" y2="88" stroke={INK} strokeWidth="1.2" />

      {/* the far church, with its bell */}
      <g transform="translate(316 88) scale(0.55)">
        <path d="M0 0 V-30 H18 V0 M18 -14 H40 V0" stroke={INK} strokeWidth="2.4" fill={SKY} />
        <path d="M-3 -30 L9 -44 L21 -30 Z M16 -14 L29 -24 L43 -14" stroke={INK} strokeWidth="2.4" fill={SKY} strokeLinejoin="round" />
        <line x1="9" y1="-44" x2="9" y2="-53" stroke={INK} strokeWidth="2.4" />
        <line x1="5" y1="-49" x2="13" y2="-49" stroke={INK} strokeWidth="2.4" />
        <path d="M4 -17 V-25 Q9 -30 14 -25 V-17" stroke={INK} strokeWidth="2" fill="none" />
        <path className="scene-bell" d="M6 -18 Q6 -24 9 -24 Q12 -24 12 -18 Z" fill={ORANGE} />
        <path d="M26 0 V-7 Q29 -10 32 -7 V0" stroke={INK} strokeWidth="2" fill="none" />
      </g>
      <path className="scene-ding" d="M306 66 q-5 6 0 12" stroke={ORANGE} strokeWidth="1.6" fill="none" strokeLinecap="round" />
      <path className="scene-ding scene-ding-2" d="M300 62 q-7 9 0 18" stroke={ORANGE} strokeWidth="1.6" fill="none" strokeLinecap="round" />

      {/* Bruno: drawn in a 200x130 box, scaled down, walking along the path */}
      <g className="scene-dog-track">
        <g transform="translate(0 116) scale(0.45)">
          <g className="scene-leg scene-leg-b">
            <line x1="78" y1="68" x2="78" y2="122" stroke="rgba(90,58,36,0.4)" strokeWidth="2.6" strokeLinecap="round" />
          </g>
          <g className="scene-leg scene-leg-a">
            <line x1="136" y1="68" x2="136" y2="122" stroke="rgba(90,58,36,0.4)" strokeWidth="2.6" strokeLinecap="round" />
          </g>
          <path className="scene-tail" d="M68 58 C56 50 52 34 62 26 C70 20 78 28 72 36" stroke={INK} strokeWidth="2.6" fill="none" strokeLinecap="round" />
          <path
            d="M64 60 C62 50 72 46 86 46 L124 44 C138 44 148 52 148 62 C148 74 140 80 130 80 C118 80 108 72 96 72 C84 72 72 78 67 72 C63 68 63 64 64 60 Z"
            fill={SKY}
            stroke={INK}
            strokeWidth="2.6"
            strokeLinejoin="round"
          />
          <g className="scene-leg scene-leg-a">
            <line x1="88" y1="68" x2="88" y2="122" stroke={INK} strokeWidth="2.6" strokeLinecap="round" />
            <line x1="88" y1="122" x2="93" y2="122" stroke={INK} strokeWidth="2.6" strokeLinecap="round" />
          </g>
          <g className="scene-leg scene-leg-b">
            <line x1="146" y1="68" x2="146" y2="122" stroke={INK} strokeWidth="2.6" strokeLinecap="round" />
            <line x1="146" y1="122" x2="151" y2="122" stroke={INK} strokeWidth="2.6" strokeLinecap="round" />
          </g>
          {/* The outer group places the head; the inner one animates (a CSS transform would replace an SVG transform attribute on the same element). */}
          <g transform="translate(120 8)">
          <g className="scene-head">
            <path d="M10 60 Q15 42 26 32 L41 36 Q33 48 28 64" fill={SKY} stroke={INK} strokeWidth="2.6" strokeLinejoin="round" />
            <path d="M22 19 L22 1 L30 15" fill={SKY} stroke="rgba(90,58,36,0.4)" strokeWidth="2.6" strokeLinejoin="round" />
            <ellipse cx="32" cy="27" rx="13" ry="11" fill={SKY} stroke={INK} strokeWidth="2.6" />
            <path d="M27 17 L32 -1 L38 16" fill={SKY} stroke={INK} strokeWidth="2.6" strokeLinejoin="round" />
            <path d="M42 22 L62 27 Q65 30 61 32 L43 34" fill={SKY} stroke={INK} strokeWidth="2.6" strokeLinejoin="round" />
            <circle cx="61.5" cy="28.5" r="2.5" fill={INK} />
            <circle cx="36" cy="24" r="1.7" fill={INK} />
            <line x1="19" y1="44" x2="37" y2="48" stroke={ORANGE} strokeWidth="3.2" strokeLinecap="round" />
            <path className="scene-mouth" d="M45 33 Q53 40 60 32" fill={SKY} stroke={INK} strokeWidth="2.6" strokeLinecap="round" />
          </g>
          </g>
          <text className="scene-awoo" x="150" y="-10" transform="rotate(-18 150 -10)">
            {"awoooo".split("").map((ch, i) => (
              <tspan key={i} className={`scene-awoo-l scene-awoo-${i}`} dy={i === 0 ? 0 : -3}>
                {ch}
              </tspan>
            ))}
          </text>
        </g>
      </g>
    </svg>
  );
}
