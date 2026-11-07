const ANSI_RE = /\x1b\[[0-9;]*m|\x1b\]8;;[^\x07]*\x07/g;

function colorEnabled() {
  if (process.env.NO_COLOR !== undefined && process.env.FORCE_COLOR === undefined) {
    return false;
  }
  if (process.env.FORCE_COLOR !== undefined && process.env.FORCE_COLOR !== '0') {
    return true;
  }
  if (process.env.TERM === 'dumb') return false;
  return Boolean(process.stdout.isTTY);
}

let USE_COLOR = colorEnabled();
const USE_TRUECOLOR =
  /truecolor|24bit/i.test(process.env.COLORTERM || '') ||
  process.env.FORCE_COLOR === '3';

export function setColorEnabled(enabled) {
  USE_COLOR = Boolean(enabled);
}

export const C = {
  emerald: '#2dd4bf',
  emeraldSoft: '#99f6e4',
  emeraldDim: '#0f766e',
  amber: '#fbbf24',
  amberSoft: '#fde68a',
  cream: '#f6e7c8',
  red: '#fb7185',
  rose: '#f472b6',
  violet: '#c4b5fd',
  sky: '#7dd3fc',
  muted: '#94a3b8',
  faint: '#64748b',
  white: '#f8fafc',
  ink: '#08201d',
};

const escapeCache = new Map();

function hexToRgb(hex) {
  const clean = hex.replace('#', '');
  return [
    Number.parseInt(clean.slice(0, 2), 16),
    Number.parseInt(clean.slice(2, 4), 16),
    Number.parseInt(clean.slice(4, 6), 16),
  ];
}

function rgbTo256([r, g, b]) {
  if (r === g && g === b) {
    if (r < 8) return 16;
    if (r > 248) return 231;
    return Math.round(((r - 8) / 247) * 24) + 232;
  }
  const toCube = (value) => Math.round((value / 255) * 5);
  return 16 + 36 * toCube(r) + 6 * toCube(g) + toCube(b);
}

function foreground(hex) {
  const key = `fg:${hex}`;
  if (escapeCache.has(key)) return escapeCache.get(key);
  const rgb = hexToRgb(hex);
  const code = USE_TRUECOLOR
    ? `\x1b[38;2;${rgb[0]};${rgb[1]};${rgb[2]}m`
    : `\x1b[38;5;${rgbTo256(rgb)}m`;
  escapeCache.set(key, code);
  return code;
}

function background(hex) {
  const key = `bg:${hex}`;
  if (escapeCache.has(key)) return escapeCache.get(key);
  const rgb = hexToRgb(hex);
  const code = USE_TRUECOLOR
    ? `\x1b[48;2;${rgb[0]};${rgb[1]};${rgb[2]}m`
    : `\x1b[48;5;${rgbTo256(rgb)}m`;
  escapeCache.set(key, code);
  return code;
}

function rgbToHex([r, g, b]) {
  const part = (value) => Math.max(0, Math.min(255, Math.round(value))).toString(16).padStart(2, '0');
  return `#${part(r)}${part(g)}${part(b)}`;
}

function mix(from, to, amount) {
  const a = hexToRgb(from);
  const b = hexToRgb(to);
  return rgbToHex([
    a[0] + (b[0] - a[0]) * amount,
    a[1] + (b[1] - a[1]) * amount,
    a[2] + (b[2] - a[2]) * amount,
  ]);
}

export function paint(hex, text, { bold = false, dim = false, italic = false, underline = false, inverse = false, bg = null } = {}) {
  if (!USE_COLOR) return String(text);
  let prefix = foreground(hex);
  if (bg) prefix += background(bg);
  if (bold) prefix += '\x1b[1m';
  if (dim) prefix += '\x1b[2m';
  if (italic) prefix += '\x1b[3m';
  if (underline) prefix += '\x1b[4m';
  if (inverse) prefix += '\x1b[7m';
  return `${prefix}${text}\x1b[0m`;
}

export function gradient(text, colors, { bold = false, dim = false } = {}) {
  const value = String(text);
  if (!USE_COLOR) return value;
  const chars = [...value];
  if (chars.length === 0) return '';
  const stops = colors.length > 1 ? colors : [colors[0], colors[0]];
  return chars
    .map((char, index) => {
      if (char === ' ') return char;
      const position = (index / Math.max(1, chars.length - 1)) * (stops.length - 1);
      const stop = Math.min(stops.length - 2, Math.floor(position));
      const shade = mix(stops[stop], stops[stop + 1], position - stop);
      return paint(shade, char, { bold, dim });
    })
    .join('');
}

export function pill(text, color, bg = C.ink, { bold = true } = {}) {
  if (!USE_COLOR) return String(text);
  return paint(color, ` ${text} `, { bold, bg });
}

export function link(url, text = url) {
  if (!USE_COLOR) return text;
  return `\x1b]8;;${url}\x07${text}\x1b]8;;\x07`;
}

export function stripAnsi(text) {
  return String(text).replace(ANSI_RE, '');
}

const WIDE_RE =
  /[\u1100-\u115F\u2329\u232A\u2E80-\uA4CF\uAC00-\uD7A3\uF900-\uFAFF\uFE10-\uFE19\uFE30-\uFE6F\uFF00-\uFF60\uFFE0-\uFFE6]|[\u{1F000}-\u{1FAFF}]/u;
const ZERO_RE = /[\u0300-\u036F\u200B-\u200D\uFE00-\uFE0F\uFEFF]/;

export function visibleWidth(text) {
  let width = 0;
  let previousWasJoiner = false;
  for (const char of stripAnsi(text)) {
    if (char === '\u200D') {
      previousWasJoiner = true;
      continue;
    }
    if (ZERO_RE.test(char)) continue;
    if (previousWasJoiner) {
      previousWasJoiner = false;
      continue;
    }
    width += WIDE_RE.test(char) ? 2 : 1;
  }
  return width;
}

export function padEnd(text, target) {
  const missing = target - visibleWidth(text);
  return missing > 0 ? `${text}${' '.repeat(missing)}` : text;
}

export function padStart(text, target) {
  const missing = target - visibleWidth(text);
  return missing > 0 ? `${' '.repeat(missing)}${text}` : text;
}

export function centre(text, target) {
  const missing = target - visibleWidth(text);
  if (missing <= 0) return text;
  const left = Math.floor(missing / 2);
  return `${' '.repeat(left)}${text}${' '.repeat(missing - left)}`;
}

export function truncate(text, target, ellipsis = '…') {
  if (visibleWidth(text) <= target) return text;
  const plain = stripAnsi(text);
  const ellipsisWidth = visibleWidth(ellipsis);
  let result = '';
  for (const char of plain) {
    if (visibleWidth(result + char) + ellipsisWidth > target) break;
    result += char;
  }
  return `${result.trimEnd()}${ellipsis}`;
}

export function align(left, right, target) {
  if (!right) return left;
  const leftWidth = visibleWidth(left);
  const rightWidth = visibleWidth(right);
  if (leftWidth + rightWidth + 1 <= target) {
    const line = `${left}${' '.repeat(target - leftWidth - rightWidth)}${right}`;
    return line.replace(/[ \t]+$/, '');
  }
  return `${left}\n${padStart(right, target).replace(/[ \t]+$/, '')}`;
}

export function wrap(text, maxWidth) {
  if (!text) return [''];
  const output = [];
  for (const paragraph of String(text).split(/\r?\n/)) {
    const words = paragraph.trim().split(/\s+/).filter(Boolean);
    if (words.length === 0) {
      output.push('');
      continue;
    }

    let line = '';
    for (const word of words) {
      if (visibleWidth(word) > maxWidth) {
        if (line) {
          output.push(line);
          line = '';
        }
        let chunk = '';
        for (const char of word) {
          if (visibleWidth(chunk + char) > maxWidth) {
            output.push(chunk);
            chunk = char;
          } else {
            chunk += char;
          }
        }
        line = chunk;
        continue;
      }

      const candidate = line ? `${line} ${word}` : word;
      if (visibleWidth(candidate) <= maxWidth) {
        line = candidate;
      } else {
        output.push(line);
        line = word;
      }
    }
    if (line) output.push(line);
  }
  return output.length > 0 ? output : [''];
}

export function flow(items, maxWidth, { separator = ' · ' } = {}) {
  const lines = [];
  let line = '';
  let lineWidth = 0;
  const separatorWidth = visibleWidth(separator);

  for (const item of items) {
    const text = typeof item === 'string' ? item : item.text;
    const style = typeof item === 'string' ? null : item.style;
    if (!text) continue;

    const styled = style ? style(text) : text;
    const textWidth = visibleWidth(text);

    if (textWidth > maxWidth) {
      if (line) {
        lines.push(line);
        line = '';
        lineWidth = 0;
      }
      for (const part of wrap(text, maxWidth)) {
        lines.push(style ? style(part) : part);
      }
      continue;
    }

    if (!line) {
      line = styled;
      lineWidth = textWidth;
    } else if (lineWidth + separatorWidth + textWidth <= maxWidth) {
      line += `${separator}${styled}`;
      lineWidth += separatorWidth + textWidth;
    } else {
      lines.push(line);
      line = styled;
      lineWidth = textWidth;
    }
  }

  if (line) lines.push(line);
  return lines;
}

export function rule(width, color = C.emeraldDim) {
  return paint(color, '─'.repeat(Math.max(0, width)));
}

export function gradientRule(width, colors = [C.emeraldDim, C.emerald, C.emeraldDim]) {
  return gradient('─'.repeat(Math.max(0, width)), colors);
}

export function gradientBar(value, max, width, { from = C.emeraldDim, to = C.emerald, empty = C.faint } = {}) {
  const safeMax = max > 0 ? max : 1;
  const filled = Math.max(0, Math.min(width, Math.round((value / safeMax) * width)));
  const solid = filled > 0 ? gradient('█'.repeat(filled), [from, to]) : '';
  return `${solid}${paint(empty, '░'.repeat(width - filled))}`;
}

export function shade(hex, amount = 0.5) {
  return mix('#000000', hex, Math.max(0, Math.min(1, amount)));
}

function topBorder(width, title, borderColor, titleColor) {
  if (!title) return paint(borderColor, `╭${'─'.repeat(width - 2)}╮`);
  const label = ` ${title} `;
  const labelWidth = visibleWidth(label);
  if (labelWidth > width - 2) {
    return paint(borderColor, `╭${'─'.repeat(width - 2)}╮`);
  }
  const remaining = width - 2 - labelWidth - 1;
  return `${paint(borderColor, '╭─')}${paint(titleColor, label)}${paint(
    borderColor,
    `${'─'.repeat(Math.max(0, remaining))}╮`,
  )}`;
}

export function panelRaw(lines, { width, padding = 3, borderColor = C.emeraldDim, title, titleColor = C.emeraldSoft } = {}) {
  const safeWidth = Math.max(20, width);
  const inner = safeWidth - 2 - padding * 2;
  const output = [topBorder(safeWidth, title, borderColor, titleColor)];
  const left = paint(borderColor, '│');
  const gutter = ' '.repeat(padding);
  for (const line of lines) {
    for (const part of String(line).split('\n')) {
      output.push(`${left}${gutter}${padEnd(part, inner)}${gutter}${left}`);
    }
  }
  output.push(paint(borderColor, `╰${'─'.repeat(safeWidth - 2)}╯`));
  return output;
}

export function layout() {
  const columns = process.stdout.columns || 80;
  const width = Math.max(40, Math.min(columns - 4, 84));
  return { width, indent: 2, columns };
}

export function indentLines(lines, spaces = 2) {
  const prefix = ' '.repeat(spaces);
  return lines.map((line) => (String(line).trim() ? `${prefix}${line}` : ''));
}
