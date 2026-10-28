// Renders the About screen's line-art scene (mobile/components/HowlingDogScene.tsx) as PNG frames
// for the story promo: Bruno walks in along the path, the far church bell rings, he stops and
// howls. Same drawing and timeline as the app, redrawn as plain SVG per frame and rasterised
// with sharp. The "awoooo" letters are added later by build_promo.py (it has the fonts).
//
// Usage: node render_line_scene.js <out_dir> [seconds]
const fs = require("fs");
const path = require("path");
const sharp = require("sharp");

const OUT = process.argv[2];
const SECONDS = parseFloat(process.argv[3] || "7.4");
const FPS = 30;

// The scene is drawn in a 360×640 phone-sized space and output at 3× (1080×1920).
const W = 360;
const H = 640;
const PX = 3;

const LOOP_S = 11;
const WALK_IN = [0, 3.4];
const BELL = [3.8, 5.8];
const HOWL = [5, 8.2];
const WALK_OUT = [8.6, LOOP_S];
const STEP_S = 0.55;

const SKY = "#fde5cc";
const GROUND = "#f3d3a8";
const INK = "#5a3a24";
const ORANGE = "#e8743a";
const FAINT_INK = "rgba(90,58,36,0.4)";
const BUND = "rgba(90,58,36,0.35)";
const FILL = SKY;
const SUN_FILL = "#fcc690";
const SUN_LINE = "#ee8a46";
const PADDY = ["#cfe2a2", "#bdd78e", "#dbe9c4"];
const TUFT = "#7fa65a";
const STROKE = 2.6;

const DOG_W = 200;
const DOG_H = 130;
const PAW_Y = 124;
// Bigger than in the app, so he reads on a video frame; the church too.
const SCALE = 0.8;
const CHURCH = 0.9;

// ---------- the app's Animated.interpolate, in seconds ----------

function interp(t, inputRange, outputRange) {
  if (t <= inputRange[0]) return outputRange[0];
  for (let i = 1; i < inputRange.length; i++) {
    if (t <= inputRange[i]) {
      const a = inputRange[i - 1];
      const b = inputRange[i];
      const f = b === a ? 1 : (t - a) / (b - a);
      return outputRange[i - 1] + (outputRange[i] - outputRange[i - 1]) * f;
    }
  }
  return outputRange[outputRange.length - 1];
}

function zigzag(segments, period, amp, rest = 0) {
  const inputRange = [0];
  const outputRange = [rest];
  for (const [start, end] of segments) {
    inputRange.push(start);
    outputRange.push(rest);
    let sign = 1;
    for (let s = start + period / 4; s < end - period / 4; s += period / 2) {
      inputRange.push(s);
      outputRange.push(rest + sign * amp);
      sign = -sign;
    }
    inputRange.push(end);
    outputRange.push(rest);
  }
  inputRange.push(LOOP_S);
  outputRange.push(rest);
  return [inputRange, outputRange];
}

function hold(from, to, peak, ramp = 0.35) {
  return [
    [0, from, from + ramp, to - ramp, to, LOOP_S],
    [0, 0, peak, peak, 0, 0],
  ];
}

// ---------- static scenery ----------

function paddy(top, bottom) {
  const rows = 6;
  const cols = 9;
  const vx = W * 0.55;
  const vy = top - (bottom - top) * 0.6;
  const rowY = (k) => top + (bottom - top) * Math.pow(k / rows, 1.5);
  const xAt = (j, y) => {
    const xb = -W * 0.9 + (j * W * 2.8) / cols;
    return vx + (xb - vx) * ((y - vy) / (bottom - vy));
  };
  let s = "";
  const tufts = [];
  for (let k = 0; k < rows; k++) {
    const y0 = rowY(k);
    const y1 = rowY(k + 1);
    for (let j = 0; j < cols; j++) {
      const kind = (k * 2 + j * 3) % 3;
      const pts = [[xAt(j, y0), y0], [xAt(j + 1, y0), y0], [xAt(j + 1, y1), y1], [xAt(j, y1), y1]];
      s += `<polygon points="${pts.map((p) => p.join(",")).join(" ")}" fill="${PADDY[kind]}"/>`;
      if (kind !== 2 && k >= 1) {
        const cy = (y0 + y1) / 2 + (y1 - y0) * 0.2;
        const cx = (xAt(j, cy) + xAt(j + 1, cy)) / 2;
        const sz = 2 + (k / rows) * 7;
        const spread = (xAt(j + 1, cy) - xAt(j, cy)) * 0.25;
        tufts.push([cx - spread, cy, sz], [cx + spread, cy, sz]);
      }
    }
  }
  for (let k = 0; k <= rows; k++) {
    const y = rowY(k);
    s += `<line x1="0" y1="${y}" x2="${W}" y2="${y}" stroke="${BUND}" stroke-width="1.2"/>`;
  }
  for (let j = 0; j <= cols; j++) {
    s += `<line x1="${xAt(j, top)}" y1="${top}" x2="${xAt(j, bottom)}" y2="${bottom}" stroke="${BUND}" stroke-width="1.2"/>`;
  }
  for (const [x, y, sz] of tufts) {
    s += `<path d="M${x - sz * 0.6} ${y - sz} L${x} ${y} L${x + sz * 0.6} ${y - sz} M${x} ${y} L${x} ${y - sz * 1.2}" stroke="${TUFT}" stroke-width="1.3" stroke-linecap="round" fill="none"/>`;
  }
  return s;
}

const horizonY = Math.round(H * 0.32);
const pathTop = Math.round(H * 0.74);
const pathBottom = Math.round(H * 0.84);
const pawY = pathTop + (pathBottom - pathTop) * 0.62;
const dogTop = pawY - DOG_H / 2 - (PAW_Y - DOG_H / 2) * SCALE;
const churchX = W * 0.8;
const sunX = W * 0.6;

function scenery() {
  let s = `<rect width="${W}" height="${H}" fill="${SKY}"/>`;
  s += `<circle cx="${sunX}" cy="${horizonY}" r="24" fill="${SUN_FILL}" stroke="${SUN_LINE}" stroke-width="2"/>`;
  for (const deg of [-60, -30, 0, 30, 60]) {
    const rad = ((deg - 90) * Math.PI) / 180;
    s += `<line x1="${sunX + Math.cos(rad) * 31}" y1="${horizonY + Math.sin(rad) * 31}" x2="${sunX + Math.cos(rad) * 40}" y2="${horizonY + Math.sin(rad) * 40}" stroke="${SUN_LINE}" stroke-width="2" stroke-linecap="round"/>`;
  }
  for (const [fx, fy, b] of [[0.1, 0.27, 6], [0.17, 0.25, 4], [0.9, 0.24, 5]]) {
    const x = W * fx;
    const y = H * fy;
    s += `<path d="M${x - b} ${y} Q${x - b / 2} ${y - b / 2} ${x} ${y} Q${x + b / 2} ${y - b / 2} ${x + b} ${y}" stroke="${INK}" stroke-width="1.4" fill="none" stroke-linecap="round"/>`;
  }
  s += `<path d="M0 ${horizonY - 3} Q ${W * 0.2} ${horizonY - 14} ${W * 0.42} ${horizonY - 1}" stroke="${FAINT_INK}" stroke-width="1.4" fill="none"/>`;
  s += `<rect x="0" y="${horizonY}" width="${W}" height="${H - horizonY}" fill="${GROUND}"/>`;
  s += paddy(horizonY, pathTop);
  s += `<rect x="0" y="${pathTop}" width="${W}" height="${pathBottom - pathTop}" fill="${GROUND}"/>`;
  s += `<line x1="0" y1="${pathTop}" x2="${W}" y2="${pathTop}" stroke="${INK}" stroke-width="1.4"/>`;
  s += `<line x1="0" y1="${pathBottom}" x2="${W}" y2="${pathBottom}" stroke="${INK}" stroke-width="1.4"/>`;
  s += `<rect x="0" y="${pathBottom}" width="${W}" height="${H - pathBottom}" fill="${PADDY[1]}"/>`;
  // the strip of field in front is much taller than in the app, so two rows of tufts
  for (const fy of [0.3, 0.7]) {
    for (let i = 0; i < Math.ceil(W / 34) + 1; i++) {
      const x = 14 + i * 34 + (fy > 0.5 ? 17 : 0);
      const y = pathBottom + (H - pathBottom) * fy;
      s += `<path d="M${x - 6} ${y - 10} L${x} ${y} L${x + 6} ${y - 10} M${x} ${y} L${x} ${y - 13}" stroke="${TUFT}" stroke-width="1.5" stroke-linecap="round" fill="none"/>`;
    }
  }
  s += `<line x1="0" y1="${horizonY}" x2="${W}" y2="${horizonY}" stroke="${INK}" stroke-width="1.4"/>`;
  s += `<g transform="translate(${churchX} ${horizonY}) scale(${CHURCH})">
    <path d="M0 0 V-30 H18 V0 M18 -14 H40 V0" stroke="${INK}" stroke-width="2.4" fill="${FILL}"/>
    <path d="M-3 -30 L9 -44 L21 -30 Z M16 -14 L29 -24 L43 -14" stroke="${INK}" stroke-width="2.4" fill="${FILL}" stroke-linejoin="round"/>
    <line x1="9" y1="-44" x2="9" y2="-53" stroke="${INK}" stroke-width="2.4"/>
    <line x1="5" y1="-49" x2="13" y2="-49" stroke="${INK}" stroke-width="2.4"/>
    <path d="M4 -17 V-25 Q9 -30 14 -25 V-17" stroke="${INK}" stroke-width="2" fill="none"/>
    <path d="M26 0 V-7 Q29 -10 32 -7 V0" stroke="${INK}" stroke-width="2" fill="none"/>
  </g>`;
  return s;
}

// ---------- moving parts ----------

const leg = (x, angle, far) => {
  const c = far ? FAINT_INK : INK;
  return `<g transform="translate(${x} 66) rotate(${angle} 8 0)">
    <line x1="8" y1="2" x2="8" y2="56" stroke="${c}" stroke-width="${STROKE}" stroke-linecap="round"/>
    <line x1="8" y1="56" x2="13" y2="56" stroke="${c}" stroke-width="${STROKE}" stroke-linecap="round"/>
  </g>`;
};

function frame(t) {
  const walking = [WALK_IN, WALK_OUT];
  const shownW = DOG_W * SCALE;
  const insetX = (DOG_W * (1 - SCALE)) / 2;
  const stopLeft = W * 0.22;
  const dogX = interp(t, [0, WALK_IN[1], WALK_OUT[0], LOOP_S],
    [-shownW - 10 - insetX, stopLeft - insetX, stopLeft - insetX, W + 10 - insetX]);
  const bob = interp(t, ...zigzag(walking, STEP_S / 2, 1.5));
  const legA = interp(t, ...zigzag(walking, STEP_S, 22));
  const legB = interp(t, ...zigzag(walking, STEP_S, -22));
  const tail = interp(t, ...zigzag(walking, 0.4, 8));
  const headUp = interp(t, ...hold(HOWL[0], HOWL[1], -34));
  const mouth = interp(t, ...hold(HOWL[0] + 0.3, HOWL[1] - 0.2, 1, 0.15));
  const bellA = interp(t,
    [0, BELL[0], BELL[0] + 0.3, BELL[0] + 0.7, BELL[0] + 1.1, BELL[0] + 1.5, BELL[1], LOOP_S],
    [0, 0, 24, -20, 14, -8, 0, 0]);

  let s = scenery();
  s += `<g transform="translate(${churchX} ${horizonY}) scale(${CHURCH}) translate(5 -25) rotate(${bellA} 4 0)">
    <path d="M1 7 Q1 1 4 1 Q7 1 7 7 Z" fill="${ORANGE}"/></g>`;
  [0, 0.5].forEach((delay, i) => {
    const op = interp(t, [0, BELL[0] + delay, BELL[0] + delay + 0.1, BELL[0] + delay + 0.9, LOOP_S], [0, 0, 1, 0, 0]);
    if (op <= 0) return;
    const sc = interp(t, [0, BELL[0] + delay, BELL[0] + delay + 0.9, LOOP_S], [0.6, 0.6, 1.3, 1.3]) * (CHURCH / 0.55);
    const x = churchX - (16 + i * 8) * (CHURCH / 0.55);
    const y = horizonY - (30 + i * 3) * (CHURCH / 0.55);
    s += `<g opacity="${op}" transform="translate(${x + 7} ${y + 11}) scale(${sc}) translate(-7 -11)">
      <path d="M11 3 Q4 11 11 19" stroke="${ORANGE}" stroke-width="2" fill="none" stroke-linecap="round"/></g>`;
  });

  // Bruno, scaled about the centre of his 200×130 box like the app's transform
  s += `<g transform="translate(${dogX} ${dogTop + bob}) translate(${DOG_W / 2} ${DOG_H / 2}) scale(${SCALE}) translate(${-DOG_W / 2} ${-DOG_H / 2})">`;
  s += leg(70, legB, true) + leg(128, legA, true);
  s += `<g transform="translate(40 18) rotate(${tail} 28 40.5)">
    <path d="M28 40 C16 32 12 16 22 8 C30 2 38 10 32 18" stroke="${INK}" stroke-width="${STROKE}" fill="none" stroke-linecap="round"/></g>`;
  s += `<path d="M64 60 C62 50 72 46 86 46 L124 44 C138 44 148 52 148 62 C148 74 140 80 130 80 C118 80 108 72 96 72 C84 72 72 78 67 72 C63 68 63 64 64 60 Z" fill="${FILL}" stroke="${INK}" stroke-width="${STROKE}" stroke-linejoin="round"/>`;
  s += leg(80, legA, false) + leg(138, legB, false);
  s += `<g transform="translate(120 8) rotate(${headUp} 16.7 63)">
    <path d="M10 60 Q15 42 26 32 L41 36 Q33 48 28 64" fill="${FILL}" stroke="${INK}" stroke-width="${STROKE}" stroke-linejoin="round" stroke-linecap="round"/>
    <path d="M22 19 L22 1 L30 15" fill="${FILL}" stroke="${FAINT_INK}" stroke-width="${STROKE}" stroke-linejoin="round"/>
    <ellipse cx="32" cy="27" rx="13" ry="11" fill="${FILL}" stroke="${INK}" stroke-width="${STROKE}"/>
    <path d="M27 17 L32 -1 L38 16" fill="${FILL}" stroke="${INK}" stroke-width="${STROKE}" stroke-linejoin="round"/>
    <path d="M42 22 L62 27 Q65 30 61 32 L43 34" fill="${FILL}" stroke="${INK}" stroke-width="${STROKE}" stroke-linejoin="round"/>
    <circle cx="61.5" cy="28.5" r="2.5" fill="${INK}"/>
    <circle cx="36" cy="24" r="1.7" fill="${INK}"/>
    <line x1="19" y1="44" x2="37" y2="48" stroke="${ORANGE}" stroke-width="3.2" stroke-linecap="round"/>
    ${mouth > 0 ? `<path opacity="${mouth}" d="M45 33 Q53 40 60 32" fill="${FILL}" stroke="${INK}" stroke-width="${STROKE}" stroke-linecap="round"/>` : ""}
  </g></g>`;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W * PX}" height="${H * PX}" viewBox="0 0 ${W} ${H}">${s}</svg>`;
}

async function main() {
  fs.mkdirSync(OUT, { recursive: true });
  const n = Math.round(SECONDS * FPS);
  for (let i = 0; i < n; i++) {
    const svg = frame(i / FPS);
    await sharp(Buffer.from(svg)).png().toFile(path.join(OUT, `f${String(i).padStart(4, "0")}.png`));
  }
  // where his mouth ends up while howling, for placing the "awoooo" letters (1080×1920 px)
  const stopX = W * 0.22 - (DOG_W * (1 - SCALE)) / 2;
  const toPx = (x, y) => [
    Math.round((stopX + DOG_W / 2 + (x - DOG_W / 2) * SCALE) * PX),
    Math.round((dogTop + DOG_H / 2 + (y - DOG_H / 2) * SCALE) * PX),
  ];
  console.log(JSON.stringify({ frames: n, howlText: toPx(150, -40) }));
}

main();
