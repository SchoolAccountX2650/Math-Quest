/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * MATH QUEST v3.0 — 数学クイズ + タイマー/コンボ/XP/ガチャ/デイリー
 */

import { useEffect, useState, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { auth, signInWithGoogle, signOut , signInAsGuest } from './firebase';
import { onAuthStateChanged, User } from 'firebase/auth';
import {
  Loader2, LogOut, Play, User as UserIcon, Trophy, ArrowRight, CheckCircle2, XCircle, Home, Coins,
  Gift, Sparkles, LayoutGrid, ArrowLeft, Volume2, VolumeX, Flame, Zap, Clock, Calendar, Star, Award, Target,
  RotateCcw, Medal, GraduationCap,
} from 'lucide-react';
// ============================================================================
// 以下は元 src/mathGen.ts / src/rewards.ts / src/sfx.ts をインライン化したもの
// ============================================================================

// ===== mathGen =====
export interface Problem {
  problem: string;
  solution: string;
  explanation: string;
}

export type DifficultyId = '算数低' | '算数高' | '数学低' | '数学中' | '数学高';

type ProblemGenerator = () => Problem;

// ── 乱数・数学ヘルパー ──
const rint = (min: number, max: number) => Math.floor(Math.random() * (max - min + 1)) + min;
function pick<T>(a: readonly T[]): T { return a[Math.floor(Math.random() * a.length)]; }

function gcd(a: number, b: number): number {
  a = Math.abs(a);
  b = Math.abs(b);
  while (b) {
    const t = a % b;
    a = b;
    b = t;
  }
  return a || 1;
}

function lcm(a: number, b: number): number {
  return Math.abs(a * b) / gcd(a, b);
}

function fracStr(n: number, d: number): string {
  if (d < 0) { n = -n; d = -d; }
  const g = gcd(n, d);
  const nn = n / g, dd = d / g;
  return dd === 1 ? String(nn) : `${nn}/${dd}`;
}

function decimalStr(n: number): string {
  if (Number.isInteger(n)) return String(n);
  return String(Math.round(n * 1000000) / 1000000).replace(/(\.\d*?)0+$/, '$1').replace(/\.$/, '');
}

function signedTerm(n: number): string {
  return n >= 0 ? `+ ${n}` : `- ${Math.abs(n)}`;
}

function nonZero(min: number, max: number): number {
  let v = 0;
  while (v === 0) v = rint(min, max);
  return v;
}

function nPr(n: number, r: number): number {
  let value = 1;
  for (let i = 0; i < r; i += 1) value *= n - i;
  return value;
}

function nCr(n: number, r: number): number {
  return nPr(n, r) / nPr(r, r);
}

// ── 正誤判定（全角→半角・空白・x=接頭辞・分数/小数の等価を吸収） ──
function toHalf(s: string): string {
  return String(s)
    .replace(/[０-９]/g, c => String.fromCharCode(c.charCodeAt(0) - 0xFEE0))
    .replace(/[Ａ-Ｚａ-ｚ]/g, c => String.fromCharCode(c.charCodeAt(0) - 0xFEE0))
    .replace(/／/g, '/').replace(/＝/g, '=').replace(/[－ー−―]/g, '-').replace(/．/g, '.')
    .replace(/[ｘＸ]/g, 'x').replace(/[ｙＹ]/g, 'y');
}

const UNIT_SUFFIX = /(平方センチメートル|センチメートル|cm²|cm2|cm|m²|m2|m|kg|g|円|点|人|匹|個|こ|本|まい|枚|秒|分|時)$/u;

function normAns(s: string): string {
  let t = toHalf(s).trim().toLowerCase().replace(/\s+/g, '').replace(/[,，]/g, '');
  t = t.replace(/pi/g, 'π').replace(/Π/g, 'π');
  t = t.replace(/^[xy]=/, '').replace(/=$/, '');
  t = t.replace(UNIT_SUFFIX, '').replace(/[。.]$/, '').replace(UNIT_SUFFIX, '');
  return t;
}

function parseFrac(x: string): [number, number] | null {
  const m = x.match(/^(-?\d+)\/(-?\d+)$/);
  return m ? [parseInt(m[1], 10), parseInt(m[2], 10)] : null;
}

export function checkAnswer(user: string, solution: string): boolean {
  const u = normAns(user), s = normAns(solution);
  if (!u) return false;

  const uf = parseFrac(u), sf = parseFrac(s);
  if ((uf && uf[1] === 0) || (sf && sf[1] === 0)) return false;
  if (u === s) return true;

  const isNum = (v: string) => /^-?(?:\d+\.?\d*|\.\d+)$/.test(v);
  if (uf && sf) return uf[0] * sf[1] === sf[0] * uf[1];
  if (isNum(u) && isNum(s)) return Math.abs(parseFloat(u) - parseFloat(s)) < 1e-9;
  if (uf && isNum(s)) return Math.abs(uf[0] / uf[1] - parseFloat(s)) < 1e-9;
  if (sf && isNum(u)) return Math.abs(sf[0] / sf[1] - parseFloat(u)) < 1e-9;
  return false;
}

// ── 算数低（小1〜3） ──
const ES_GENERATORS: readonly ProblemGenerator[] = [
  () => {
    const a = rint(2, 49), b = rint(2, 49);
    return { problem: `${a} + ${b} = ?`, solution: String(a + b), explanation: `${a} に ${b} をたすと ${a + b} です。` };
  },
  () => {
    const a = rint(11, 99), b = rint(1, a - 1);
    return { problem: `${a} - ${b} = ?`, solution: String(a - b), explanation: `${a} から ${b} をひくと ${a - b} です。` };
  },
  () => {
    const a = rint(2, 9), b = rint(2, 9);
    return { problem: `${a} × ${b} = ?`, solution: String(a * b), explanation: `${a} のだんを ${b} こ分。${a} × ${b} = ${a * b} です。` };
  },
  () => {
    const people = rint(2, 5), each = rint(2, 9), total = people * each;
    return { problem: `${total}こを ${people}人で同じ数ずつ分けます。1人は何こ？`, solution: String(each), explanation: `${total} ÷ ${people} = ${each}。1人は ${each}こです。` };
  },
  () => {
    const a = rint(3, 15), b = rint(2, 9), it = pick([{ name: 'りんご', unit: 'こ' }, { name: 'あめ', unit: 'こ' }, { name: 'えんぴつ', unit: '本' }, { name: 'シール', unit: 'まい' }]);
    return { problem: `${it.name}が ${a}${it.unit} あります。${b}${it.unit} もらうと、ぜんぶで何${it.unit}？`, solution: String(a + b), explanation: `はじめの ${a}${it.unit} に ${b}${it.unit} をたして、${a + b}${it.unit} です。` };
  },
  () => {
    const a = rint(8, 25), b = rint(1, a - 2), it = pick([{ name: 'りんご', unit: 'こ' }, { name: 'あめ', unit: 'こ' }, { name: 'えんぴつ', unit: '本' }, { name: 'シール', unit: 'まい' }]);
    return { problem: `${it.name}が ${a}${it.unit} あります。${b}${it.unit} 使うと、のこりは何${it.unit}？`, solution: String(a - b), explanation: `${a}${it.unit} から ${b}${it.unit} をひいて、${a - b}${it.unit} のこります。` };
  },
  () => {
    const a = rint(1, 9);
    return { problem: `10にするには ${a} にいくつたす？`, solution: String(10 - a), explanation: `${a} + ${10 - a} = 10 なので、${10 - a} です。` };
  },
  () => {
    const a = rint(1, 9);
    return { problem: `10は ${a} といくつに分けられる？`, solution: String(10 - a), explanation: `${a} と ${10 - a} をあわせると 10 です。` };
  },
  () => {
    let a = rint(10, 99), b = rint(10, 99);
    while (a === b) b = rint(10, 99);
    return { problem: `${a} と ${b} では、どちらが大きい？（大きい数を答えてね）`, solution: String(Math.max(a, b)), explanation: `くらべると ${Math.max(a, b)} のほうが大きいです。` };
  },
  () => {
    const start = rint(1, 12), add = rint(1, 10), answer = ((start + add - 1) % 12) + 1;
    return { problem: `${start}時の ${add}時間後は何時？`, solution: String(answer), explanation: `${start} から ${add}時間すすむと ${answer}時です。` };
  },
  () => {
    const h = rint(1, 5), t = rint(0, 9), o = rint(0, 9), total = h * 100 + t * 10 + o;
    return { problem: `100円玉が ${h}枚、10円玉が ${t}枚、1円玉が ${o}枚あります。全部で何円？`, solution: String(total), explanation: `${h}×100 + ${t}×10 + ${o} = ${total}円です。` };
  },
  () => {
    const a = rint(1, 30), b = rint(1, 30), c = rint(1, 30);
    return { problem: `${a} + ${b} + ${c} = ?`, solution: String(a + b + c), explanation: `${a} + ${b} = ${a + b}、${a + b} + ${c} = ${a + b + c} です。` };
  },
  () => {
    const digits = [rint(1, 9), rint(1, 9), rint(1, 9)];
    const answer = [...digits].sort((a, b) => b - a).join('');
    return { problem: `数字 ${digits[0]}, ${digits[1]}, ${digits[2]} をならべてできる一番大きい3けたの数は？`, solution: answer, explanation: `大きいくらいから大きい数字を置くので、${answer} です。` };
  },
  () => {
    const a = rint(1, 9), step = rint(2, 9), b = a + step, c = b + step, answer = c + step;
    return { problem: `${a}, ${b}, ${c}, ? 次の数は？`, solution: String(answer), explanation: `${step} ずつふえているので、${c} + ${step} = ${answer} です。` };
  },
  () => {
    const x = rint(1, 9), b = rint(1, 9), sum = x + b;
    return { problem: `□ + ${b} = ${sum}。□に入る数は？`, solution: String(x), explanation: `${sum} - ${b} = ${x} なので、□は ${x} です。` };
  },
];

// ── 算数高（小4〜6） ──
const EH_GENERATORS: readonly ProblemGenerator[] = [
  () => {
    const a = rint(12, 99), b = rint(11, 40);
    return { problem: `${a} × ${b} = ?`, solution: String(a * b), explanation: `${a} × ${b} = ${a * b} です。` };
  },
  () => {
    const b = rint(3, 12), q = rint(4, 20), a = b * q;
    return { problem: `${a} ÷ ${b} = ?`, solution: String(q), explanation: `${b} × ${q} = ${a} なので、${a} ÷ ${b} = ${q} です。` };
  },
  () => {
    const d1 = rint(2, 9), d2 = rint(2, 9);
    const n1 = rint(1, d1 - 1), n2 = rint(1, d2 - 1);
    let op = pick(['+', '-'] as const);
    let leftN = n1, leftD = d1, rightN = n2, rightD = d2;
    if (op === '-' && leftN * rightD <= rightN * leftD) {
      leftN = n2; leftD = d2; rightN = n1; rightD = d1;
    }
    const den = leftD * rightD;
    const num = op === '+' ? leftN * rightD + rightN * leftD : leftN * rightD - rightN * leftD;
    return { problem: `${leftN}/${leftD} ${op} ${rightN}/${rightD} = ?（約分して答えてね）`, solution: fracStr(num, den), explanation: `通分すると ${leftN * rightD}/${den} ${op} ${rightN * leftD}/${den} = ${num}/${den}。約分して ${fracStr(num, den)} です。` };
  },
  () => {
    let a = rint(11, 89) / 10, b = rint(11, 89) / 10;
    const op = pick(['+', '-'] as const);
    if (op === '-' && a < b) [a, b] = [b, a];
    const answer = op === '+' ? a + b : a - b;
    return { problem: `${a.toFixed(1)} ${op} ${b.toFixed(1)} = ?`, solution: decimalStr(answer), explanation: `${a.toFixed(1)} ${op} ${b.toFixed(1)} = ${decimalStr(answer)} です。` };
  },
  () => {
    const base = pick([100, 200, 300, 400, 500, 600, 800, 1000]), pct = pick([5, 10, 20, 25, 30, 40, 50]);
    const v = base * pct / 100;
    return { problem: `${base} の ${pct}% はいくつ？`, solution: String(v), explanation: `${base} × ${pct} ÷ 100 = ${v} です。` };
  },
  () => {
    const w = rint(3, 15), h = rint(3, 15);
    return { problem: `たて ${h}cm、よこ ${w}cm の長方形の面積は何 cm² ですか？（数字だけ）`, solution: String(w * h), explanation: `面積 = たて × よこ = ${h} × ${w} = ${w * h}（cm²）です。` };
  },
  () => {
    const a = rint(4, 24), b = rint(4, 24);
    return { problem: `${a} と ${b} の最小公倍数は？`, solution: String(lcm(a, b)), explanation: `最小公倍数は ${a} と ${b} の共通の倍数のうち最小の数で、${lcm(a, b)} です。` };
  },
  () => {
    const g = rint(2, 12), a = g * rint(2, 8), b = g * rint(2, 8);
    return { problem: `${a} と ${b} の最大公約数は？`, solution: String(gcd(a, b)), explanation: `${a} と ${b} をどちらも割り切る最大の数は ${gcd(a, b)} です。` };
  },
  () => {
    const red = rint(1, 5), blue = rint(1, 5), unit = rint(2, 8), total = (red + blue) * unit;
    return { problem: `赤と青の数の比が ${red}:${blue} で、全部で ${total}こです。赤は何こ？`, solution: String(red * unit), explanation: `全体は ${red + blue} 等分。1等分は ${total} ÷ ${red + blue} = ${unit}こ。赤は ${red} × ${unit} = ${red * unit}こです。` };
  },
  () => {
    const avg = rint(8, 40);
    const nums = [avg - 3, avg - 1, avg + 1, avg + 3];
    return { problem: `4つの数 ${nums[0]}、${nums[1]}、${nums[2]}、${nums[3]} の平均は？`, solution: String(avg), explanation: `合計は ${avg * 4}。${avg * 4} ÷ 4 = ${avg} です。` };
  },
  () => {
    const mode = pick(['cm-m', 'g-kg', 'min-sec'] as const);
    if (mode === 'cm-m') {
      const cm = rint(12, 250) * 10;
      return { problem: `${cm}cm は何m？`, solution: decimalStr(cm / 100), explanation: `1m = 100cm なので、${cm} ÷ 100 = ${decimalStr(cm / 100)}m です。` };
    }
    if (mode === 'g-kg') {
      const g = rint(5, 50) * 100;
      return { problem: `${g}g は何kg？`, solution: decimalStr(g / 1000), explanation: `1kg = 1000g なので、${g} ÷ 1000 = ${decimalStr(g / 1000)}kg です。` };
    }
    const min = rint(1, 9), sec = rint(0, 59);
    return { problem: `${min}分${sec}秒 は何秒？`, solution: String(min * 60 + sec), explanation: `${min}分 = ${min * 60}秒。${min * 60} + ${sec} = ${min * 60 + sec}秒です。` };
  },
  () => {
    const w = rint(3, 20), h = rint(3, 20), answer = 2 * (w + h);
    return { problem: `たて ${h}cm、よこ ${w}cm の長方形の周の長さは何cm？`, solution: String(answer), explanation: `周の長さ = (${h} + ${w}) × 2 = ${answer}cm です。` };
  },
  () => {
    const base = rint(2, 12) * 2, height = rint(3, 15), answer = base * height / 2;
    return { problem: `底辺 ${base}cm、高さ ${height}cm の三角形の面積は何 cm²？（数字だけ）`, solution: String(answer), explanation: `三角形の面積 = 底辺 × 高さ ÷ 2 = ${base} × ${height} ÷ 2 = ${answer}（cm²）です。` };
  },
  () => {
    const whole = pick([80, 120, 160, 200, 240, 300, 400]), pct = pick([10, 20, 25, 40, 50]), part = whole * pct / 100;
    return { problem: `ある数の ${pct}% が ${part} です。ある数はいくつ？`, solution: String(whole), explanation: `${pct}% は ${pct / 100}。${part} ÷ ${pct / 100} = ${whole} です。` };
  },
  () => {
    const b = rint(3, 12), q = rint(3, 20), rem = rint(1, b - 1), a = b * q + rem;
    return { problem: `${a} ÷ ${b} のあまりは？`, solution: String(rem), explanation: `${a} = ${b} × ${q} + ${rem} なので、あまりは ${rem} です。` };
  },
  () => {
    const m = rint(2, 12), cm = rint(1, 99), answer = m * 100 + cm;
    return { problem: `${m}m${cm}cm は何cm？`, solution: String(answer), explanation: `${m}m = ${m * 100}cm。${m * 100} + ${cm} = ${answer}cm です。` };
  },
];

// ── 数学低（中1〜3） ──
const ML_GENERATORS: readonly ProblemGenerator[] = [
  () => {
    const a = pick([2, 3, 4, 5]), x = rint(2, 12), b = rint(1, 15), c = a * x + b;
    return { problem: `方程式 ${a}x + ${b} = ${c} を解きなさい。x = ?`, solution: String(x), explanation: `${a}x = ${c} - ${b} = ${a * x}。両辺を ${a} で割って x = ${x}。` };
  },
  () => {
    const a = rint(2, 15);
    return { problem: `√${a * a} = ?`, solution: String(a), explanation: `${a} × ${a} = ${a * a} なので √${a * a} = ${a} です。` };
  },
  () => {
    const a = rint(2, 12), p = pick([2, 3] as const), v = p === 2 ? a * a : a * a * a;
    return { problem: `${a}${p === 2 ? '²' : '³'} = ?`, solution: String(v), explanation: `${a} を ${p} 回かけて ${v} です。` };
  },
  () => {
    const a = -rint(1, 12), b = rint(1, 12), op = pick(['+', '-', '×'] as const);
    const value = op === '+' ? a + b : op === '-' ? a - b : a * b;
    return { problem: `(${a}) ${op} ${b} = ?`, solution: String(value), explanation: `符号に注意して計算すると ${value} です。` };
  },
  () => {
    const tri = pick([[3, 4, 5], [6, 8, 10], [5, 12, 13], [8, 15, 17], [9, 12, 15]] as const);
    return { problem: `直角をはさむ2辺の長さが ${tri[0]} と ${tri[1]} の直角三角形の、斜辺の長さは？`, solution: String(tri[2]), explanation: `三平方の定理より ${tri[0]}² + ${tri[1]}² = ${tri[0] * tri[0] + tri[1] * tri[1]} = ${tri[2]}²。斜辺は ${tri[2]} です。` };
  },
  () => {
    const x = rint(-8, 8), y = rint(-8, 8), sum = x + y, diff = x - y;
    return { problem: `連立方程式 x + y = ${sum}, x - y = ${diff} の x の値は？`, solution: String(x), explanation: `2つの式をたすと 2x = ${sum + diff}。よって x = ${x} です。` };
  },
  () => {
    const a = rint(1, 9), b = rint(1, 9), sum = a + b, prod = a * b;
    return { problem: `x² + ${sum}x + ${prod} = (x + ${a})(x + □)。□に入る数は？`, solution: String(b), explanation: `(x + ${a})(x + ${b}) = x² + ${sum}x + ${prod} なので、□は ${b} です。` };
  },
  () => {
    const a = rint(1, 9), b = rint(1, 9);
    return { problem: `(x + ${a})(x + ${b}) を展開したとき、x の係数は？`, solution: String(a + b), explanation: `展開すると x² + ${a + b}x + ${a * b}。x の係数は ${a + b} です。` };
  },
  () => {
    const m = nonZero(-6, 6), b = rint(-9, 9);
    return { problem: `一次関数 y = ${m}x ${signedTerm(b)} の傾きは？`, solution: String(m), explanation: `y = ax + b の a が傾きです。ここでは ${m} です。` };
  },
  () => {
    const m = nonZero(-6, 6), b = rint(-9, 9);
    return { problem: `一次関数 y = ${m}x ${signedTerm(b)} の切片は？`, solution: String(b), explanation: `y = ax + b の b が切片です。ここでは ${b} です。` };
  },
  () => {
    const k = nonZero(-8, 8), x = nonZero(-6, 6), y = k * x;
    return { problem: `比例 y = ${k}x で、x = ${x} のとき y は？`, solution: String(y), explanation: `y = ${k} × ${x} = ${y} です。` };
  },
  () => {
    const x = nonZero(2, 9), y = nonZero(-8, 8), k = x * y;
    return { problem: `反比例 y = ${k}/x で、x = ${x} のとき y は？`, solution: String(y), explanation: `y = ${k} ÷ ${x} = ${y} です。` };
  },
  () => {
    const a = rint(1, 9), b = rint(3, 20), answer = b - a - 1;
    return { problem: `不等式 x + ${a} < ${b} を満たす最大の整数 x は？`, solution: String(answer), explanation: `x < ${b - a} なので、最大の整数は ${answer} です。` };
  },
  () => {
    const a = rint(2, 12), b = rint(2, 12);
    return { problem: `√${a * a} + √${b * b} = ?`, solution: String(a + b), explanation: `√${a * a} = ${a}、√${b * b} = ${b}。合計は ${a + b} です。` };
  },
  () => {
    const r = rint(2, 9), answer = `${r * r}π`;
    return { problem: `半径 ${r}cm の円の面積は？（πを使って）`, solution: answer, explanation: `円の面積は πr²。π × ${r}² = ${answer} です。` };
  },
  () => {
    const d = rint(2, 18), answer = `${d}π`;
    return { problem: `直径 ${d}cm の円の円周は？（πを使って）`, solution: answer, explanation: `円周は 直径 × π。${d} × π = ${answer} です。` };
  },
];

// ── 数学中（高1〜3） ──
const MM_GENERATORS: readonly ProblemGenerator[] = [
  () => {
    let r1 = rint(-6, 6), r2 = rint(-6, 6);
    while (r1 === r2) r2 = rint(-6, 6);
    return { problem: `2次方程式 (x - (${r1}))(x - (${r2})) = 0 の解のうち、小さい方の値は？`, solution: String(Math.min(r1, r2)), explanation: `解は x = ${r1}, ${r2}。小さい方は ${Math.min(r1, r2)} です。` };
  },
  () => {
    const n = pick([2, 3, 4] as const), a = rint(-4, 4), v = n * Math.pow(a, n - 1);
    return { problem: `関数 f(x) = x^${n} のとき、微分係数 f'(${a}) の値は？`, solution: String(v), explanation: `f'(x) = ${n}x^${n - 1}。f'(${a}) = ${v} です。` };
  },
  () => {
    const tr = pick([['sin 30°', '1/2'], ['cos 60°', '1/2'], ['tan 45°', '1'], ['sin 90°', '1'], ['cos 0°', '1'], ['tan 0°', '0'], ['sin 0°', '0'], ['cos 90°', '0']] as const);
    return { problem: `${tr[0]} の値は？（分数は a/b の形で）`, solution: tr[1], explanation: `三角比の基本値より ${tr[0]} = ${tr[1]} です。` };
  },
  () => {
    const base = pick([2, 3, 10] as const), p = rint(2, 5), v = Math.pow(base, p);
    return { problem: `log_${base} ${v} = ?`, solution: String(p), explanation: `${base}^${p} = ${v} なので log_${base} ${v} = ${p} です。` };
  },
  () => {
    const o = pick([['2枚のコインを同時に投げるとき、2枚とも表が出る確率は？', '1/4'], ['1個のサイコロを投げるとき、3以下の目が出る確率は？', '1/2'], ['1個のサイコロを投げるとき、偶数の目が出る確率は？', '1/2'], ['2枚のコインを投げて、少なくとも1枚が表になる確率は？', '3/4']] as const);
    return { problem: o[0], solution: o[1], explanation: `すべての場合を数えると確率は ${o[1]} です。` };
  },
  () => {
    const a = rint(-5, 9), d = nonZero(-5, 6), n = rint(4, 9), v = a + (n - 1) * d;
    return { problem: `初項 ${a}、公差 ${d} の等差数列の第 ${n} 項は？`, solution: String(v), explanation: `a_n = a + (n - 1)d = ${a} + ${n - 1} × ${d} = ${v} です。` };
  },
  () => {
    const a = nonZero(-4, 5), r = pick([-3, -2, 2, 3] as const), n = rint(3, 6), v = a * Math.pow(r, n - 1);
    return { problem: `初項 ${a}、公比 ${r} の等比数列の第 ${n} 項は？`, solution: String(v), explanation: `a_n = ${a} × ${r}^${n - 1} = ${v} です。` };
  },
  () => {
    const n = rint(4, 8), r = rint(2, Math.min(4, n));
    return { problem: `${n}P${r} = ?`, solution: String(nPr(n, r)), explanation: `${n}P${r} = ${n} から ${r} 個を順に選ぶので ${nPr(n, r)} です。` };
  },
  () => {
    const n = rint(5, 10), r = rint(2, Math.min(5, n - 1));
    return { problem: `${n}C${r} = ?`, solution: String(nCr(n, r)), explanation: `${n}C${r} = ${nCr(n, r)} です。` };
  },
  () => {
    const h = rint(-5, 5), k = rint(-10, 10);
    return { problem: `2次関数 y = (x - (${h}))² + ${k} の頂点の y座標は？`, solution: String(k), explanation: `y = (x - p)² + q の頂点は (${h}, ${k})。y座標は ${k} です。` };
  },
  () => {
    const h = rint(-5, 5), k = rint(-10, 10);
    return { problem: `2次関数 y = -(x - (${h}))² + ${k} の最大値は？`, solution: String(k), explanation: `-(x - ${h})² は最大 0 なので、最大値は ${k} です。` };
  },
  () => {
    const a = rint(-6, 6), b = rint(-6, 6), c = rint(-6, 6), d = rint(-6, 6), v = a * c + b * d;
    return { problem: `ベクトル (${a}, ${b}) と (${c}, ${d}) の内積は？`, solution: String(v), explanation: `内積は ${a}×${c} + ${b}×${d} = ${v} です。` };
  },
  () => {
    const a = rint(-20, 20), b = rint(-20, 20), v = Math.abs(a - b);
    return { problem: `|${a} - ${b}| = ?`, solution: String(v), explanation: `${a} - ${b} = ${a - b}。絶対値は ${v} です。` };
  },
  () => {
    const base = pick([2, 3, 4, 5] as const), m = rint(1, 4), n = rint(1, 4), v = Math.pow(base, m + n);
    return { problem: `${base}^${m} × ${base}^${n} = ?`, solution: String(v), explanation: `同じ底の積なので指数を足し、${base}^${m + n} = ${v} です。` };
  },
  () => {
    const n = rint(4, 8), r = rint(1, n - 1);
    return { problem: `(1 + x)^${n} の x^${r} の係数は？`, solution: String(nCr(n, r)), explanation: `二項定理より係数は ${n}C${r} = ${nCr(n, r)} です。` };
  },
  () => {
    const a = rint(1, 5), b = rint(1, 8), c = rint(0, 9), r = rint(-4, 4), v = a * r * r + b * r + c;
    return { problem: `多項式 f(x) = ${a}x² + ${b}x + ${c} を x - ${r} で割った余りは？`, solution: String(v), explanation: `余りの定理より f(${r}) = ${a}×${r}² + ${b}×${r} + ${c} = ${v} です。` };
  },
];

// ── 数学高（大1〜4） ──
const MH_GENERATORS: readonly ProblemGenerator[] = [
  () => {
    const a = rint(1, 5), b = rint(-4, 4), c = rint(-4, 4), d = rint(1, 5), v = a * d - b * c;
    return { problem: `行列 [[${a}, ${b}], [${c}, ${d}]] の行列式 det を求めよ。`, solution: String(v), explanation: `det = ad - bc = ${a}×${d} - ${b}×${c} = ${v}。` };
  },
  () => {
    if (pick([true, false])) {
      const a = rint(-6, 6) || 2, u = rint(2, 6), v = a * u;
      return { problem: `定積分 ∫₀^${u} ${a} dx を求めよ。`, solution: String(v), explanation: `∫₀^${u} ${a} dx = [${a}x]₀^${u} = ${v}。` };
    }
    const a = pick([-6, -4, -2, 2, 4, 6] as const), u = rint(2, 6), v = a * u * u / 2;
    return { problem: `定積分 ∫₀^${u} ${a}x dx を求めよ。`, solution: String(v), explanation: `∫ ${a}x dx = ${a / 2}x²。[${a / 2}x²]₀^${u} = ${v}。` };
  },
  () => {
    const o = pick([['lim[x→0] sin(x)/x = ?', '1'], ['lim[x→∞] (1 + 1/x)^x = ?（記号で）', 'e'], ['lim[x→0] (1 - cos(x))/x = ?', '0'], ['lim[x→0] (e^x - 1)/x = ?', '1']] as const);
    return { problem: o[0], solution: o[1], explanation: `代表的な極限の公式より、答えは ${o[1]} です。` };
  },
  () => {
    const a = nonZero(-5, 5);
    const o = pick<[string, string, string]>([
      [`関数 f(x) = e^(${a}x) の f'(0) の値は？`, String(a), `f'(x) = ${a}e^(${a}x)、f'(0) = ${a}。`],
      [`関数 f(x) = sin(${a}x) の f'(0) の値は？`, String(a), `f'(x) = ${a}cos(${a}x)、f'(0) = ${a}。`],
    ]);
    return { problem: o[0], solution: o[1], explanation: o[2] };
  },
  () => {
    const a = rint(-5, 5), b = rint(-4, 4), c = rint(-4, 4), d = rint(-5, 5);
    return { problem: `行列 [[${a}, ${b}], [${c}, ${d}]] のトレース（対角成分の和）は？`, solution: String(a + d), explanation: `トレース = ${a} + ${d} = ${a + d}。` };
  },
  () => {
    const a = rint(-5, 5), b = rint(-4, 4), d = rint(-5, 5);
    return { problem: `上三角行列 [[${a}, ${b}], [0, ${d}]] の固有値のうち大きい方は？`, solution: String(Math.max(a, d)), explanation: `上三角行列の固有値は対角成分 ${a}, ${d}。大きい方は ${Math.max(a, d)} です。` };
  },
  () => ({
    problem: '定積分 ∫₀¹ x e^x dx を求めよ。',
    solution: '1',
    explanation: `部分積分で ∫ x e^x dx = x e^x - e^x。0 から 1 で (1e - e) - (0 - 1) = 1 です。`,
  }),
  () => ({
    problem: 'e^x = 1 + ax + ... としたとき a は？',
    solution: '1',
    explanation: 'e^x のテイラー展開は 1 + x + x²/2! + ... なので、a = 1 です。',
  }),
  () => {
    const a = rint(1, 4), b = rint(-5, 5), x = rint(-3, 3), y = nonZero(-3, 3), v = 2 * a * x * y;
    return { problem: `f(x, y) = ${a}x²y + ${b}y の ∂f/∂x を点 (${x}, ${y}) で求めよ。`, solution: String(v), explanation: `∂f/∂x = ${2 * a}xy。点 (${x}, ${y}) では ${2 * a}×${x}×${y} = ${v} です。` };
  },
  () => {
    const tri = pick([[3, 4, 5], [5, 12, 13], [8, 15, 17], [7, 24, 25]] as const);
    return { problem: `複素数 ${tri[0]} + ${tri[1]}i の絶対値は？`, solution: String(tri[2]), explanation: `|a + bi| = √(a² + b²) = √(${tri[0] ** 2} + ${tri[1] ** 2}) = ${tri[2]} です。` };
  },
  () => {
    const a = rint(-8, 8), b = rint(1, 8);
    return { problem: `複素数 ${a} + ${b}i の共役の虚部は？`, solution: String(-b), explanation: `共役は ${a} - ${b}i なので、虚部は ${-b} です。` };
  },
  () => {
    const a = rint(-4, 4), b = rint(-4, 4), c = rint(-4, 4), d = rint(-4, 4);
    const e = rint(-4, 4), f = rint(-4, 4), g = rint(-4, 4), h = rint(-4, 4);
    const v = a * f + b * h;
    return { problem: `A = [[${a}, ${b}], [${c}, ${d}]], B = [[${e}, ${f}], [${g}, ${h}]] のとき、AB の (1,2) 成分は？`, solution: String(v), explanation: `(1,2) 成分は ${a}×${f} + ${b}×${h} = ${v} です。` };
  },
  () => {
    const n = rint(5, 30), v = n * (n + 1) / 2;
    return { problem: `Σ_{k=1}^{${n}} k = ?`, solution: String(v), explanation: `1 から ${n} までの和は ${n}(${n}+1)/2 = ${v} です。` };
  },
  () => {
    let a: number, b: number, c: number, d: number;
    if (pick([true, false])) {
      do {
        a = rint(-5, 5); b = rint(-5, 5); c = rint(-5, 5); d = rint(-5, 5);
      } while (a * d - b * c === 0);
    } else {
      a = nonZero(1, 5); b = rint(1, 5);
      const k = rint(2, 4);
      c = a * k; d = b * k;
    }
    const det = a * d - b * c, exists = det !== 0 ? 1 : 0;
    return { problem: `行列 [[${a}, ${b}], [${c}, ${d}]] に逆行列が存在するなら1、しないなら0で答えよ。`, solution: String(exists), explanation: `行列式は ${a}×${d} - ${b}×${c} = ${det}。${det !== 0 ? '0でないので存在します' : '0なので存在しません'}。` };
  },
  () => {
    const a = nonZero(-4, 4), b = rint(-4, 4), c = rint(-4, 4), d = nonZero(-4, 4), e = rint(-4, 4), f = nonZero(-4, 4);
    const v = a * d * f;
    return { problem: `三角行列 [[${a}, ${b}, ${c}], [0, ${d}, ${e}], [0, 0, ${f}]] の行列式は？`, solution: String(v), explanation: `三角行列の行列式は対角成分の積なので ${a}×${d}×${f} = ${v} です。` };
  },
  () => {
    const q = rint(2, 8);
    return { problem: `無限等比級数 1 + 1/${q} + 1/${q}² + ... の和は？`, solution: fracStr(q, q - 1), explanation: `初項 1、公比 1/${q} なので、和は 1 ÷ (1 - 1/${q}) = ${fracStr(q, q - 1)} です。` };
  },
];

const GEN: Record<DifficultyId, readonly ProblemGenerator[]> = {
  '算数低': ES_GENERATORS,
  '算数高': EH_GENERATORS,
  '数学低': ML_GENERATORS,
  '数学中': MM_GENERATORS,
  '数学高': MH_GENERATORS,
};

export function generateProblem(difficulty: string, recent?: string[]): Problem {
  const generators = GEN[difficulty as DifficultyId] || ES_GENERATORS;
  const recentSet = new Set(recent ?? []);
  let fallback = pick(generators)();
  for (let i = 0; i < 10; i += 1) {
    const candidate = pick(generators)();
    fallback = candidate;
    if (!recentSet.has(candidate.problem)) return candidate;
  }
  return fallback;
}

// ── 難易度メタ ──
export const DIFFICULTIES = [
  { id: '算数低', label: '算数低', desc: '小学1〜3年生' },
  { id: '算数高', label: '算数高', desc: '小学4〜6年生' },
  { id: '数学低', label: '数学低', desc: '中学1〜3年生' },
  { id: '数学中', label: '数学中', desc: '高校1〜3年生' },
  { id: '数学高', label: '数学高', desc: '大学1〜4年生' },
] as const;

// ===== rewards =====
// 6段階レアリティ: N ノーマル / U アンコモン / R レア / E エピック / S シークレット / X ???(アンアベイラブル)
export type Rarity = 'N' | 'U' | 'R' | 'E' | 'S' | 'X';
export const RARITY_ORDER: Rarity[] = ['N', 'U', 'R', 'E', 'S', 'X'];
export interface Sticker { id: string; emoji: string; name: string; rarity: Rarity; img?: string; }
export interface RewardData {
  coins: number;
  stickers: Record<string, number>;
  xp: number;
  streak: number;        // デイリー連続ログイン日数
  lastClaim: string;     // 最後にデイリーを受け取った日付 (YYYY-MM-DD)
  bestCombo: number;     // 最高コンボ記録
  totalCorrect: number;  // 累計正解数（実績用）
  totalPlayed: number;   // 累計出題数（実績用）
  perfectGames: number;  // 全問正解ゲーム数（実績用）
}

export interface RarityStyle {
  label: string; weight: number; pct: string; // pct = ガチャ確率の表示
  text: string; ring: string; bg: string; glow: string;
  grad: string;    // 箔/ホロ用グラデーション（背景）
  holo: boolean;   // 高レア: きらめきアニメを付ける
}
// weight は N/U/R/E/S の重み付き抽選比（60:20:10:5:1）。X は別枠の極小確率(X_CHANCE)で抽選される。
export const RARITY: Record<Rarity, RarityStyle> = {
  N: { label: 'ノーマル', weight: 60, pct: '60%', text: 'text-slate-500', ring: 'border-slate-300', bg: 'bg-slate-100', glow: 'rgba(148,163,184,0.45)', grad: 'linear-gradient(135deg,#f1f5f9,#e2e8f0)', holo: false },
  U: { label: 'アンコモン', weight: 20, pct: '20%', text: 'text-emerald-600', ring: 'border-emerald-400', bg: 'bg-emerald-50', glow: 'rgba(16,185,129,0.5)', grad: 'linear-gradient(135deg,#d1fae5,#a7f3d0)', holo: false },
  R: { label: 'レア', weight: 10, pct: '10%', text: 'text-blue-600', ring: 'border-blue-400', bg: 'bg-blue-50', glow: 'rgba(59,130,246,0.6)', grad: 'linear-gradient(135deg,#dbeafe,#bfdbfe)', holo: false },
  E: { label: 'エピック', weight: 5, pct: '5%', text: 'text-purple-600', ring: 'border-purple-400', bg: 'bg-purple-50', glow: 'rgba(168,85,247,0.7)', grad: 'linear-gradient(135deg,#f5d0fe,#e9d5ff,#c4b5fd)', holo: true },
  S: { label: 'シークレット', weight: 1, pct: '1%', text: 'text-amber-500', ring: 'border-amber-400', bg: 'bg-amber-50', glow: 'rgba(245,158,11,0.9)', grad: 'linear-gradient(135deg,#fde68a,#fbbf24,#f59e0b)', holo: true },
  X: { label: '???', weight: 0, pct: '???', text: 'text-fuchsia-600', ring: 'border-fuchsia-400', bg: 'bg-fuchsia-50', glow: 'rgba(217,70,239,0.95)', grad: 'linear-gradient(135deg,#f0abfc,#a5b4fc,#5eead4,#fca5a5,#fcd34d)', holo: true },
};

// ガチャ確率テーブル（表示用）。X は伏せて "???"。
export const GACHA_ODDS: { r: Rarity; pct: string }[] = RARITY_ORDER.map(r => ({ r, pct: RARITY[r].pct }));
export const X_CHANCE = 0.001; // ??? が出る極小確率（0.1%）

// 学び・かわいい系のシール（6段49種）。既存IDは保持し、新レアリティへ再割当＋新規追加。
export const STICKERS: Sticker[] = [
  // ── N ノーマル (14) ──
  { id: 'c1', emoji: '⭐', name: 'ほし', rarity: 'N' },
  { id: 'c2', emoji: '🍎', name: 'りんご', rarity: 'N' },
  { id: 'c3', emoji: '✏️', name: 'えんぴつ', rarity: 'N' },
  { id: 'c4', emoji: '📏', name: 'ものさし', rarity: 'N' },
  { id: 'c5', emoji: '🔢', name: 'すうじ', rarity: 'N' },
  { id: 'c6', emoji: '🟦', name: 'しかく', rarity: 'N' },
  { id: 'c7', emoji: '🔺', name: 'さんかく', rarity: 'N' },
  { id: 'c8', emoji: '🍊', name: 'みかん', rarity: 'N' },
  { id: 'c9', emoji: '📎', name: 'クリップ', rarity: 'N' },
  { id: 'c10', emoji: '🧷', name: 'ピン', rarity: 'N' },
  { id: 'n1', emoji: '📕', name: 'ほん', rarity: 'N' },
  { id: 'n2', emoji: '🖍️', name: 'クレヨン', rarity: 'N' },
  { id: 'n3', emoji: '🍓', name: 'いちご', rarity: 'N' },
  { id: 'n4', emoji: '🔵', name: 'まる', rarity: 'N' },
  // ── U アンコモン (12) ──
  { id: 'r1', emoji: '🧮', name: 'そろばん', rarity: 'U' },
  { id: 'r2', emoji: '📐', name: 'ぶんどき', rarity: 'U' },
  { id: 'r3', emoji: '📗', name: 'きょうかしょ', rarity: 'U' },
  { id: 'r4', emoji: '🎈', name: 'ふうせん', rarity: 'U' },
  { id: 'r5', emoji: '🐢', name: 'かめ', rarity: 'U' },
  { id: 'r6', emoji: '🦊', name: 'きつね', rarity: 'U' },
  { id: 'r7', emoji: '🧩', name: 'パズル', rarity: 'U' },
  { id: 'r8', emoji: '🔔', name: 'ベル', rarity: 'U' },
  { id: 'u1', emoji: '🐧', name: 'ペンギン', rarity: 'U' },
  { id: 'u2', emoji: '🍡', name: 'だんご', rarity: 'U' },
  { id: 'u3', emoji: '⚽', name: 'ボール', rarity: 'U' },
  { id: 'u4', emoji: '🎵', name: 'おんぷ', rarity: 'U' },
  // ── R レア (10) ──
  { id: 'e1', emoji: '🎓', name: 'そつぎょうぼう', rarity: 'R' },
  { id: 'e2', emoji: '🏅', name: 'メダル', rarity: 'R' },
  { id: 'e3', emoji: '🚀', name: 'ロケット', rarity: 'R' },
  { id: 'e4', emoji: '🔭', name: 'ぼうえんきょう', rarity: 'R' },
  { id: 'e5', emoji: '🧠', name: 'ひらめき', rarity: 'R' },
  { id: 'e6', emoji: '🎨', name: 'パレット', rarity: 'R' },
  { id: 'e7', emoji: '⚗️', name: 'フラスコ', rarity: 'R' },
  { id: 'rr1', emoji: '🧭', name: 'コンパス', rarity: 'R' },
  { id: 'rr2', emoji: '🔬', name: 'けんびきょう', rarity: 'R' },
  { id: 'rr3', emoji: '🦋', name: 'ちょう', rarity: 'R' },
  // ── E エピック (7) ──
  { id: 'l1', emoji: '🏆', name: 'トロフィー', rarity: 'E' },
  { id: 'l2', emoji: '🦉', name: 'ちえのフクロウ', rarity: 'E' },
  { id: 'l3', emoji: '👑', name: 'おうかん', rarity: 'E' },
  { id: 'l4', emoji: '🌈', name: 'にじ', rarity: 'E' },
  { id: 'l5', emoji: '💎', name: 'ダイヤ', rarity: 'E' },
  { id: 'l6', emoji: '🪐', name: 'わくせい', rarity: 'E' },
  { id: 'ee1', emoji: '💫', name: 'ながれぼし', rarity: 'E' },
  // ── S シークレット (4) ──
  { id: 's1', emoji: '🔮', name: 'すいしょう', rarity: 'S' },
  { id: 's2', emoji: '🐉', name: 'ドラゴン', rarity: 'S' },
  { id: 's3', emoji: '🗝️', name: 'かぎ', rarity: 'S' },
  { id: 's4', emoji: '🎆', name: 'はなび', rarity: 'S' },
  // ── X ??? アンアベイラブル (2) ──
  { id: 'x1', emoji: '🌌', name: 'うちゅう', rarity: 'X' },
  { id: 'x2', emoji: '♾️', name: 'むげん', rarity: 'X' },
];

// ===== カスタム描き起こしシール絵（SVG data URI）を S/??? 枠に適用 =====
const STICKER_ART: Record<string, string> = {
  s1: 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNTYgMjU2Ij4KPGRlZnM+CiAgPGxpbmVhckdyYWRpZW50IGlkPSJob2xvIiB4MT0iMCIgeTE9IjAiIHgyPSIxIiB5Mj0iMSI+CiAgICA8c3RvcCBvZmZzZXQ9IjAiIHN0b3AtY29sb3I9IiM1ZWVhZDQiLz48c3RvcCBvZmZzZXQ9IjAuMjgiIHN0b3AtY29sb3I9IiM4MThjZjgiLz4KICAgIDxzdG9wIG9mZnNldD0iMC41NSIgc3RvcC1jb2xvcj0iI2MwODRmYyIvPjxzdG9wIG9mZnNldD0iMC43OCIgc3RvcC1jb2xvcj0iI2Y0NzJiNiIvPgogICAgPHN0b3Agb2Zmc2V0PSIxIiBzdG9wLWNvbG9yPSIjZmJiZjI0Ii8+CiAgPC9saW5lYXJHcmFkaWVudD4KICA8bGluZWFyR3JhZGllbnQgaWQ9ImdvbGQiIHgxPSIwIiB5MT0iMCIgeDI9IjAuNCIgeTI9IjEiPgogICAgPHN0b3Agb2Zmc2V0PSIwIiBzdG9wLWNvbG9yPSIjZmRlNjhhIi8+PHN0b3Agb2Zmc2V0PSIwLjUiIHN0b3AtY29sb3I9IiNmNTllMGIiLz4KICAgIDxzdG9wIG9mZnNldD0iMSIgc3RvcC1jb2xvcj0iI2I0NTMwOSIvPgogIDwvbGluZWFyR3JhZGllbnQ+CiAgPHJhZGlhbEdyYWRpZW50IGlkPSJnb2xkUiIgY3g9IjAuNCIgY3k9IjAuMzIiIHI9IjAuNzUiPgogICAgPHN0b3Agb2Zmc2V0PSIwIiBzdG9wLWNvbG9yPSIjZmZmYmU2Ii8+PHN0b3Agb2Zmc2V0PSIwLjQ1IiBzdG9wLWNvbG9yPSIjZmJiZjI0Ii8+CiAgICA8c3RvcCBvZmZzZXQ9IjEiIHN0b3AtY29sb3I9IiNiNDUzMDkiLz4KICA8L3JhZGlhbEdyYWRpZW50PgogIDxsaW5lYXJHcmFkaWVudCBpZD0iaWNlIiB4MT0iMCIgeTE9IjAiIHgyPSIwLjUiIHkyPSIxIj4KICAgIDxzdG9wIG9mZnNldD0iMCIgc3RvcC1jb2xvcj0iI2UwZjJmZSIvPjxzdG9wIG9mZnNldD0iMC41IiBzdG9wLWNvbG9yPSIjN2RkM2ZjIi8+CiAgICA8c3RvcCBvZmZzZXQ9IjEiIHN0b3AtY29sb3I9IiM2MzY2ZjEiLz4KICA8L2xpbmVhckdyYWRpZW50PgogIDxsaW5lYXJHcmFkaWVudCBpZD0iamFkZSIgeDE9IjAiIHkxPSIwIiB4Mj0iMC41IiB5Mj0iMSI+CiAgICA8c3RvcCBvZmZzZXQ9IjAiIHN0b3AtY29sb3I9IiNiYmY3ZDAiLz48c3RvcCBvZmZzZXQ9IjAuNSIgc3RvcC1jb2xvcj0iIzM0ZDM5OSIvPgogICAgPHN0b3Agb2Zmc2V0PSIxIiBzdG9wLWNvbG9yPSIjMGY3NjZlIi8+CiAgPC9saW5lYXJHcmFkaWVudD4KICA8cmFkaWFsR3JhZGllbnQgaWQ9InNwYWNlIiBjeD0iMC41IiBjeT0iMC40MiIgcj0iMC43Ij4KICAgIDxzdG9wIG9mZnNldD0iMCIgc3RvcC1jb2xvcj0iIzFlMjkzYiIvPjxzdG9wIG9mZnNldD0iMC43IiBzdG9wLWNvbG9yPSIjMGIxMTIwIi8+CiAgICA8c3RvcCBvZmZzZXQ9IjEiIHN0b3AtY29sb3I9IiMwMjA2MTciLz4KICA8L3JhZGlhbEdyYWRpZW50PgogIDxyYWRpYWxHcmFkaWVudCBpZD0icGxhbmV0IiBjeD0iMC4zOCIgY3k9IjAuMzIiIHI9IjAuODUiPgogICAgPHN0b3Agb2Zmc2V0PSIwIiBzdG9wLWNvbG9yPSIjYTViNGZjIi8+PHN0b3Agb2Zmc2V0PSIwLjQ1IiBzdG9wLWNvbG9yPSIjNjM2NmYxIi8+CiAgICA8c3RvcCBvZmZzZXQ9IjEiIHN0b3AtY29sb3I9IiMzMTJlODEiLz4KICA8L3JhZGlhbEdyYWRpZW50PgogIDxmaWx0ZXIgaWQ9InNvZnQiIHg9Ii00MCUiIHk9Ii00MCUiIHdpZHRoPSIxODAlIiBoZWlnaHQ9IjE4MCUiPgogICAgPGZlR2F1c3NpYW5CbHVyIHN0ZERldmlhdGlvbj0iNCIvPgogIDwvZmlsdGVyPgo8L2RlZnM+PGc+PGcgZmlsdGVyPSJ1cmwoI3NvZnQpIiBvcGFjaXR5PSIwLjU1Ij48cG9seWdvbiBwb2ludHM9IjkwLjAwLDk2LjAwIDY2LjAwLDEwMi4wMCAxMjguMDAsMjE0LjAwIDE5MC4wMCwxMDIuMDAgMTY2LjAwLDk2LjAwIiBmaWxsPSIjNjM2NmYxIi8+PC9nPjxwb2x5Z29uIHBvaW50cz0iOTAuMDAsOTYuMDAgNjYuMDAsMTAyLjAwIDEyOC4wMCwyMTQuMDAgMTkwLjAwLDEwMi4wMCAxNjYuMDAsOTYuMDAiIGZpbGw9InVybCgjaWNlKSIgc3Ryb2tlPSIjYzdkMmZlIiBzdHJva2Utd2lkdGg9IjIiIHN0cm9rZS1saW5lam9pbj0icm91bmQiLz48cG9seWdvbiBwb2ludHM9IjkwLjAwLDk2LjAwIDExMi4wMCw0MC4wMCAxNDQuMDAsNDAuMDAgMTY2LjAwLDk2LjAwIiBmaWxsPSJ1cmwoI2ljZSkiIHN0cm9rZT0iI2UwZjJmZSIgc3Ryb2tlLXdpZHRoPSIyIiBzdHJva2UtbGluZWpvaW49InJvdW5kIi8+PHBvbHlnb24gcG9pbnRzPSI5MC4wMCw5Ni4wMCAxMjguMDAsMTE0LjAwIDY2LjAwLDEwMi4wMCIgZmlsbD0iI2E1YjRmYyIgb3BhY2l0eT0iMC44NSIvPjxwb2x5Z29uIHBvaW50cz0iMTY2LjAwLDk2LjAwIDEyOC4wMCwxMTQuMDAgMTkwLjAwLDEwMi4wMCIgZmlsbD0iIzRmNDZlNSIgb3BhY2l0eT0iMC42Ii8+PHBvbHlnb24gcG9pbnRzPSI2Ni4wMCwxMDIuMDAgMTI4LjAwLDExNC4wMCAxMjguMDAsMjE0LjAwIiBmaWxsPSIjODE4Y2Y4IiBvcGFjaXR5PSIwLjciLz48cG9seWdvbiBwb2ludHM9IjE5MC4wMCwxMDIuMDAgMTI4LjAwLDExNC4wMCAxMjguMDAsMjE0LjAwIiBmaWxsPSIjNDMzOGNhIiBvcGFjaXR5PSIwLjU1Ii8+PHBvbHlnb24gcG9pbnRzPSIxMTIuMDAsNDAuMDAgMTQ0LjAwLDQwLjAwIDEyOC4wMCwxMTQuMDAiIGZpbGw9IiNlZWYyZmYiIG9wYWNpdHk9IjAuOSIvPjxsaW5lIHgxPSIxMjgiIHkxPSIxMTQiIHgyPSIxMjgiIHkyPSIyMTQiIHN0cm9rZT0iI2UwZTdmZiIgc3Ryb2tlLXdpZHRoPSIxLjUiIG9wYWNpdHk9IjAuNyIvPjxwb2x5Z29uIHBvaW50cz0iMTk2LjAwLDY1LjAwIDE5OS4xMyw3NC44NyAyMDkuMDAsNzguMDAgMTk5LjEzLDgxLjEzIDE5Ni4wMCw5MS4wMCAxOTIuODcsODEuMTMgMTgzLjAwLDc4LjAwIDE5Mi44Nyw3NC44NyIgZmlsbD0iI2ZmZiIgb3BhY2l0eT0iMC45NSIvPjxwb2x5Z29uIHBvaW50cz0iNjQuMDAsMTQxLjAwIDY2LjE2LDE0Ny44NCA3My4wMCwxNTAuMDAgNjYuMTYsMTUyLjE2IDY0LjAwLDE1OS4wMCA2MS44NCwxNTIuMTYgNTUuMDAsMTUwLjAwIDYxLjg0LDE0Ny44NCIgZmlsbD0iI2ZmZiIgb3BhY2l0eT0iMC44NSIvPjxwb2x5Z29uIHBvaW50cz0iMTgyLjAwLDE0NC4wMCAxODMuNDQsMTQ4LjU2IDE4OC4wMCwxNTAuMDAgMTgzLjQ0LDE1MS40NCAxODIuMDAsMTU2LjAwIDE4MC41NiwxNTEuNDQgMTc2LjAwLDE1MC4wMCAxODAuNTYsMTQ4LjU2IiBmaWxsPSIjZmZmIiBvcGFjaXR5PSIwLjciLz48L2c+PC9zdmc+',
  s2: 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNTYgMjU2Ij4KPGRlZnM+CiAgPGxpbmVhckdyYWRpZW50IGlkPSJob2xvIiB4MT0iMCIgeTE9IjAiIHgyPSIxIiB5Mj0iMSI+CiAgICA8c3RvcCBvZmZzZXQ9IjAiIHN0b3AtY29sb3I9IiM1ZWVhZDQiLz48c3RvcCBvZmZzZXQ9IjAuMjgiIHN0b3AtY29sb3I9IiM4MThjZjgiLz4KICAgIDxzdG9wIG9mZnNldD0iMC41NSIgc3RvcC1jb2xvcj0iI2MwODRmYyIvPjxzdG9wIG9mZnNldD0iMC43OCIgc3RvcC1jb2xvcj0iI2Y0NzJiNiIvPgogICAgPHN0b3Agb2Zmc2V0PSIxIiBzdG9wLWNvbG9yPSIjZmJiZjI0Ii8+CiAgPC9saW5lYXJHcmFkaWVudD4KICA8bGluZWFyR3JhZGllbnQgaWQ9ImdvbGQiIHgxPSIwIiB5MT0iMCIgeDI9IjAuNCIgeTI9IjEiPgogICAgPHN0b3Agb2Zmc2V0PSIwIiBzdG9wLWNvbG9yPSIjZmRlNjhhIi8+PHN0b3Agb2Zmc2V0PSIwLjUiIHN0b3AtY29sb3I9IiNmNTllMGIiLz4KICAgIDxzdG9wIG9mZnNldD0iMSIgc3RvcC1jb2xvcj0iI2I0NTMwOSIvPgogIDwvbGluZWFyR3JhZGllbnQ+CiAgPHJhZGlhbEdyYWRpZW50IGlkPSJnb2xkUiIgY3g9IjAuNCIgY3k9IjAuMzIiIHI9IjAuNzUiPgogICAgPHN0b3Agb2Zmc2V0PSIwIiBzdG9wLWNvbG9yPSIjZmZmYmU2Ii8+PHN0b3Agb2Zmc2V0PSIwLjQ1IiBzdG9wLWNvbG9yPSIjZmJiZjI0Ii8+CiAgICA8c3RvcCBvZmZzZXQ9IjEiIHN0b3AtY29sb3I9IiNiNDUzMDkiLz4KICA8L3JhZGlhbEdyYWRpZW50PgogIDxsaW5lYXJHcmFkaWVudCBpZD0iaWNlIiB4MT0iMCIgeTE9IjAiIHgyPSIwLjUiIHkyPSIxIj4KICAgIDxzdG9wIG9mZnNldD0iMCIgc3RvcC1jb2xvcj0iI2UwZjJmZSIvPjxzdG9wIG9mZnNldD0iMC41IiBzdG9wLWNvbG9yPSIjN2RkM2ZjIi8+CiAgICA8c3RvcCBvZmZzZXQ9IjEiIHN0b3AtY29sb3I9IiM2MzY2ZjEiLz4KICA8L2xpbmVhckdyYWRpZW50PgogIDxsaW5lYXJHcmFkaWVudCBpZD0iamFkZSIgeDE9IjAiIHkxPSIwIiB4Mj0iMC41IiB5Mj0iMSI+CiAgICA8c3RvcCBvZmZzZXQ9IjAiIHN0b3AtY29sb3I9IiNiYmY3ZDAiLz48c3RvcCBvZmZzZXQ9IjAuNSIgc3RvcC1jb2xvcj0iIzM0ZDM5OSIvPgogICAgPHN0b3Agb2Zmc2V0PSIxIiBzdG9wLWNvbG9yPSIjMGY3NjZlIi8+CiAgPC9saW5lYXJHcmFkaWVudD4KICA8cmFkaWFsR3JhZGllbnQgaWQ9InNwYWNlIiBjeD0iMC41IiBjeT0iMC40MiIgcj0iMC43Ij4KICAgIDxzdG9wIG9mZnNldD0iMCIgc3RvcC1jb2xvcj0iIzFlMjkzYiIvPjxzdG9wIG9mZnNldD0iMC43IiBzdG9wLWNvbG9yPSIjMGIxMTIwIi8+CiAgICA8c3RvcCBvZmZzZXQ9IjEiIHN0b3AtY29sb3I9IiMwMjA2MTciLz4KICA8L3JhZGlhbEdyYWRpZW50PgogIDxyYWRpYWxHcmFkaWVudCBpZD0icGxhbmV0IiBjeD0iMC4zOCIgY3k9IjAuMzIiIHI9IjAuODUiPgogICAgPHN0b3Agb2Zmc2V0PSIwIiBzdG9wLWNvbG9yPSIjYTViNGZjIi8+PHN0b3Agb2Zmc2V0PSIwLjQ1IiBzdG9wLWNvbG9yPSIjNjM2NmYxIi8+CiAgICA8c3RvcCBvZmZzZXQ9IjEiIHN0b3AtY29sb3I9IiMzMTJlODEiLz4KICA8L3JhZGlhbEdyYWRpZW50PgogIDxmaWx0ZXIgaWQ9InNvZnQiIHg9Ii00MCUiIHk9Ii00MCUiIHdpZHRoPSIxODAlIiBoZWlnaHQ9IjE4MCUiPgogICAgPGZlR2F1c3NpYW5CbHVyIHN0ZERldmlhdGlvbj0iNCIvPgogIDwvZmlsdGVyPgo8L2RlZnM+PGc+PGcgZmlsdGVyPSJ1cmwoI3NvZnQpIiBvcGFjaXR5PSIwLjUiPjxwYXRoIGQ9Ik02MCAxNTAgUTcwIDcwIDE1MCA3OCBRMjEwIDg0IDIxNCAxNDAgUTE3MCAxMjggMTUwIDE1MCBRMTIwIDE3NiA2MCAxNTBaIiBmaWxsPSIjMGY3NjZlIi8+PC9nPjxwYXRoIGQ9Ik01NiAxNTAgQzcwIDk2IDEwOCA3NCAxNTAgODAgQzE3NiA4NCAxOTYgOTYgMjA2IDExOCBDMTg4IDExMiAxNzYgMTE4IDE3MiAxMzAgQzE5NiAxMjggMjE0IDE0MiAyMTAgMTY2IEMxOTYgMTUwIDE4MiAxNTIgMTc2IDE2NCBDMTcwIDE1MCAxNTAgMTQ2IDE1MCAxNDYgQzEyMCAxNzYgNzQgMTc2IDU2IDE1MCBaIiBmaWxsPSJ1cmwoI2phZGUpIiBzdHJva2U9IiMwNjVmNDYiIHN0cm9rZS13aWR0aD0iMyIgc3Ryb2tlLWxpbmVqb2luPSJyb3VuZCIvPjxwYXRoIGQ9Ik0xNTAgODAgTDEzOCA0NCBMMTYyIDY2IFoiIGZpbGw9InVybCgjamFkZSkiIHN0cm9rZT0iIzA2NWY0NiIgc3Ryb2tlLXdpZHRoPSIyLjUiIHN0cm9rZS1saW5lam9pbj0icm91bmQiLz48cGF0aCBkPSJNMTIwIDEwNCBRMTQwIDk2IDE1OCAxMDgiIGZpbGw9Im5vbmUiIHN0cm9rZT0iIzA2NWY0NiIgc3Ryb2tlLXdpZHRoPSI0IiBzdHJva2UtbGluZWNhcD0icm91bmQiLz48ZWxsaXBzZSBjeD0iMTMyIiBjeT0iMTE4IiByeD0iMTIiIHJ5PSI5IiBmaWxsPSIjZmRlNjhhIi8+PHBhdGggZD0iTTEzMiAxMTAgTDEyOCAxMjYgTDEzNiAxMjYgWiIgZmlsbD0iIzdjMmQxMiIvPjxjaXJjbGUgY3g9IjY2IiBjeT0iMTQwIiByPSIzLjUiIGZpbGw9IiMwNjVmNDYiLz48cG9seWdvbiBwb2ludHM9Ijc4LjAwLDE1OC4wMCA4NC4wMCwxNzAuMDAgOTAuMDAsMTU4LjAwIiBmaWxsPSIjZmZmIi8+PHBvbHlnb24gcG9pbnRzPSI5Ni4wMCwxNjAuMDAgMTAxLjAwLDE3MS4wMCAxMDYuMDAsMTYwLjAwIiBmaWxsPSIjZmZmIi8+PHBvbHlnb24gcG9pbnRzPSIxNjguMDAsODYuMDAgMTc4LjAwLDc2LjAwIDE4OC4wMCw4Ni4wMCAxNzguMDAsODkuMDAiIGZpbGw9IiMxMGI5ODEiIHN0cm9rZT0iIzA2NWY0NiIgc3Ryb2tlLXdpZHRoPSIxLjUiIG9wYWNpdHk9IjAuOTUiLz48cG9seWdvbiBwb2ludHM9IjE4Ni4wMCw5Ni4wMCAxOTguMDAsODQuMDAgMjEwLjAwLDk2LjAwIDE5OC4wMCw5OS4wMCIgZmlsbD0iIzEwYjk4MSIgc3Ryb2tlPSIjMDY1ZjQ2IiBzdHJva2Utd2lkdGg9IjEuNSIgb3BhY2l0eT0iMC45NSIvPjxwb2x5Z29uIHBvaW50cz0iMjAwLjAwLDExMi4wMCAyMTEuMDAsMTAxLjAwIDIyMi4wMCwxMTIuMDAgMjExLjAwLDExNS4wMCIgZmlsbD0iIzEwYjk4MSIgc3Ryb2tlPSIjMDY1ZjQ2IiBzdHJva2Utd2lkdGg9IjEuNSIgb3BhY2l0eT0iMC45NSIvPjxwb2x5Z29uIHBvaW50cz0iMjA2LjAwLDY2LjAwIDIwNy45Miw3Mi4wOCAyMTQuMDAsNzQuMDAgMjA3LjkyLDc1LjkyIDIwNi4wMCw4Mi4wMCAyMDQuMDgsNzUuOTIgMTk4LjAwLDc0LjAwIDIwNC4wOCw3Mi4wOCIgZmlsbD0iI2ZlZjA4YSIgb3BhY2l0eT0iMC45NSIvPjwvZz48L3N2Zz4=',
  s3: 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNTYgMjU2Ij4KPGRlZnM+CiAgPGxpbmVhckdyYWRpZW50IGlkPSJob2xvIiB4MT0iMCIgeTE9IjAiIHgyPSIxIiB5Mj0iMSI+CiAgICA8c3RvcCBvZmZzZXQ9IjAiIHN0b3AtY29sb3I9IiM1ZWVhZDQiLz48c3RvcCBvZmZzZXQ9IjAuMjgiIHN0b3AtY29sb3I9IiM4MThjZjgiLz4KICAgIDxzdG9wIG9mZnNldD0iMC41NSIgc3RvcC1jb2xvcj0iI2MwODRmYyIvPjxzdG9wIG9mZnNldD0iMC43OCIgc3RvcC1jb2xvcj0iI2Y0NzJiNiIvPgogICAgPHN0b3Agb2Zmc2V0PSIxIiBzdG9wLWNvbG9yPSIjZmJiZjI0Ii8+CiAgPC9saW5lYXJHcmFkaWVudD4KICA8bGluZWFyR3JhZGllbnQgaWQ9ImdvbGQiIHgxPSIwIiB5MT0iMCIgeDI9IjAuNCIgeTI9IjEiPgogICAgPHN0b3Agb2Zmc2V0PSIwIiBzdG9wLWNvbG9yPSIjZmRlNjhhIi8+PHN0b3Agb2Zmc2V0PSIwLjUiIHN0b3AtY29sb3I9IiNmNTllMGIiLz4KICAgIDxzdG9wIG9mZnNldD0iMSIgc3RvcC1jb2xvcj0iI2I0NTMwOSIvPgogIDwvbGluZWFyR3JhZGllbnQ+CiAgPHJhZGlhbEdyYWRpZW50IGlkPSJnb2xkUiIgY3g9IjAuNCIgY3k9IjAuMzIiIHI9IjAuNzUiPgogICAgPHN0b3Agb2Zmc2V0PSIwIiBzdG9wLWNvbG9yPSIjZmZmYmU2Ii8+PHN0b3Agb2Zmc2V0PSIwLjQ1IiBzdG9wLWNvbG9yPSIjZmJiZjI0Ii8+CiAgICA8c3RvcCBvZmZzZXQ9IjEiIHN0b3AtY29sb3I9IiNiNDUzMDkiLz4KICA8L3JhZGlhbEdyYWRpZW50PgogIDxsaW5lYXJHcmFkaWVudCBpZD0iaWNlIiB4MT0iMCIgeTE9IjAiIHgyPSIwLjUiIHkyPSIxIj4KICAgIDxzdG9wIG9mZnNldD0iMCIgc3RvcC1jb2xvcj0iI2UwZjJmZSIvPjxzdG9wIG9mZnNldD0iMC41IiBzdG9wLWNvbG9yPSIjN2RkM2ZjIi8+CiAgICA8c3RvcCBvZmZzZXQ9IjEiIHN0b3AtY29sb3I9IiM2MzY2ZjEiLz4KICA8L2xpbmVhckdyYWRpZW50PgogIDxsaW5lYXJHcmFkaWVudCBpZD0iamFkZSIgeDE9IjAiIHkxPSIwIiB4Mj0iMC41IiB5Mj0iMSI+CiAgICA8c3RvcCBvZmZzZXQ9IjAiIHN0b3AtY29sb3I9IiNiYmY3ZDAiLz48c3RvcCBvZmZzZXQ9IjAuNSIgc3RvcC1jb2xvcj0iIzM0ZDM5OSIvPgogICAgPHN0b3Agb2Zmc2V0PSIxIiBzdG9wLWNvbG9yPSIjMGY3NjZlIi8+CiAgPC9saW5lYXJHcmFkaWVudD4KICA8cmFkaWFsR3JhZGllbnQgaWQ9InNwYWNlIiBjeD0iMC41IiBjeT0iMC40MiIgcj0iMC43Ij4KICAgIDxzdG9wIG9mZnNldD0iMCIgc3RvcC1jb2xvcj0iIzFlMjkzYiIvPjxzdG9wIG9mZnNldD0iMC43IiBzdG9wLWNvbG9yPSIjMGIxMTIwIi8+CiAgICA8c3RvcCBvZmZzZXQ9IjEiIHN0b3AtY29sb3I9IiMwMjA2MTciLz4KICA8L3JhZGlhbEdyYWRpZW50PgogIDxyYWRpYWxHcmFkaWVudCBpZD0icGxhbmV0IiBjeD0iMC4zOCIgY3k9IjAuMzIiIHI9IjAuODUiPgogICAgPHN0b3Agb2Zmc2V0PSIwIiBzdG9wLWNvbG9yPSIjYTViNGZjIi8+PHN0b3Agb2Zmc2V0PSIwLjQ1IiBzdG9wLWNvbG9yPSIjNjM2NmYxIi8+CiAgICA8c3RvcCBvZmZzZXQ9IjEiIHN0b3AtY29sb3I9IiMzMTJlODEiLz4KICA8L3JhZGlhbEdyYWRpZW50PgogIDxmaWx0ZXIgaWQ9InNvZnQiIHg9Ii00MCUiIHk9Ii00MCUiIHdpZHRoPSIxODAlIiBoZWlnaHQ9IjE4MCUiPgogICAgPGZlR2F1c3NpYW5CbHVyIHN0ZERldmlhdGlvbj0iNCIvPgogIDwvZmlsdGVyPgo8L2RlZnM+PGc+PGcgdHJhbnNmb3JtPSJyb3RhdGUoLTM4IDEyOCAxMjgpIj48Y2lyY2xlIGN4PSIxMjgiIGN5PSI3MCIgcj0iNDIiIGZpbGw9Im5vbmUiIHN0cm9rZT0idXJsKCNnb2xkKSIgc3Ryb2tlLXdpZHRoPSIxNiIvPjxjaXJjbGUgY3g9IjEyOCIgY3k9IjcwIiByPSI0MiIgZmlsbD0ibm9uZSIgc3Ryb2tlPSIjZmRlNjhhIiBzdHJva2Utd2lkdGg9IjMiIG9wYWNpdHk9IjAuNyIvPjxwYXRoIGQ9Ik0xMjggNjAgQzEyMiA1MCAxMDggNTQgMTEyIDY2IEMxMTQgNzQgMTI4IDg0IDEyOCA4NCBDMTI4IDg0IDE0MiA3NCAxNDQgNjYgQzE0OCA1NCAxMzQgNTAgMTI4IDYwWiIgZmlsbD0idXJsKCNnb2xkUikiLz48cmVjdCB4PSIxMjAiIHk9IjEwOCIgd2lkdGg9IjE2IiBoZWlnaHQ9Ijk2IiByeD0iNiIgZmlsbD0idXJsKCNnb2xkKSIvPjxyZWN0IHg9IjEyMyIgeT0iMTA4IiB3aWR0aD0iNCIgaGVpZ2h0PSI5NiIgcng9IjIiIGZpbGw9IiNmZmZiZTYiIG9wYWNpdHk9IjAuNiIvPjxyZWN0IHg9IjEzNiIgeT0iMTc2IiB3aWR0aD0iMjYiIGhlaWdodD0iMTIiIHJ4PSIzIiBmaWxsPSJ1cmwoI2dvbGQpIi8+PHJlY3QgeD0iMTM2IiB5PSIxOTIiIHdpZHRoPSIxNiIgaGVpZ2h0PSIxMiIgcng9IjMiIGZpbGw9InVybCgjZ29sZCkiLz48Y2lyY2xlIGN4PSIxMjgiIGN5PSIyMDQiIHI9IjkiIGZpbGw9InVybCgjZ29sZFIpIiBzdHJva2U9IiNiNDUzMDkiIHN0cm9rZS13aWR0aD0iMiIvPjwvZz48cG9seWdvbiBwb2ludHM9IjE5Ni4wMCw3Mi4wMCAxOTguODgsODEuMTIgMjA4LjAwLDg0LjAwIDE5OC44OCw4Ni44OCAxOTYuMDAsOTYuMDAgMTkzLjEyLDg2Ljg4IDE4NC4wMCw4NC4wMCAxOTMuMTIsODEuMTIiIGZpbGw9IiNmZmYiIG9wYWNpdHk9IjAuOTUiLz48cG9seWdvbiBwb2ludHM9IjcwLjAwLDY4LjAwIDcxLjkyLDc0LjA4IDc4LjAwLDc2LjAwIDcxLjkyLDc3LjkyIDcwLjAwLDg0LjAwIDY4LjA4LDc3LjkyIDYyLjAwLDc2LjAwIDY4LjA4LDc0LjA4IiBmaWxsPSIjZmZmIiBvcGFjaXR5PSIwLjgiLz48L2c+PC9zdmc+',
  s4: 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNTYgMjU2Ij4KPGRlZnM+CiAgPGxpbmVhckdyYWRpZW50IGlkPSJob2xvIiB4MT0iMCIgeTE9IjAiIHgyPSIxIiB5Mj0iMSI+CiAgICA8c3RvcCBvZmZzZXQ9IjAiIHN0b3AtY29sb3I9IiM1ZWVhZDQiLz48c3RvcCBvZmZzZXQ9IjAuMjgiIHN0b3AtY29sb3I9IiM4MThjZjgiLz4KICAgIDxzdG9wIG9mZnNldD0iMC41NSIgc3RvcC1jb2xvcj0iI2MwODRmYyIvPjxzdG9wIG9mZnNldD0iMC43OCIgc3RvcC1jb2xvcj0iI2Y0NzJiNiIvPgogICAgPHN0b3Agb2Zmc2V0PSIxIiBzdG9wLWNvbG9yPSIjZmJiZjI0Ii8+CiAgPC9saW5lYXJHcmFkaWVudD4KICA8bGluZWFyR3JhZGllbnQgaWQ9ImdvbGQiIHgxPSIwIiB5MT0iMCIgeDI9IjAuNCIgeTI9IjEiPgogICAgPHN0b3Agb2Zmc2V0PSIwIiBzdG9wLWNvbG9yPSIjZmRlNjhhIi8+PHN0b3Agb2Zmc2V0PSIwLjUiIHN0b3AtY29sb3I9IiNmNTllMGIiLz4KICAgIDxzdG9wIG9mZnNldD0iMSIgc3RvcC1jb2xvcj0iI2I0NTMwOSIvPgogIDwvbGluZWFyR3JhZGllbnQ+CiAgPHJhZGlhbEdyYWRpZW50IGlkPSJnb2xkUiIgY3g9IjAuNCIgY3k9IjAuMzIiIHI9IjAuNzUiPgogICAgPHN0b3Agb2Zmc2V0PSIwIiBzdG9wLWNvbG9yPSIjZmZmYmU2Ii8+PHN0b3Agb2Zmc2V0PSIwLjQ1IiBzdG9wLWNvbG9yPSIjZmJiZjI0Ii8+CiAgICA8c3RvcCBvZmZzZXQ9IjEiIHN0b3AtY29sb3I9IiNiNDUzMDkiLz4KICA8L3JhZGlhbEdyYWRpZW50PgogIDxsaW5lYXJHcmFkaWVudCBpZD0iaWNlIiB4MT0iMCIgeTE9IjAiIHgyPSIwLjUiIHkyPSIxIj4KICAgIDxzdG9wIG9mZnNldD0iMCIgc3RvcC1jb2xvcj0iI2UwZjJmZSIvPjxzdG9wIG9mZnNldD0iMC41IiBzdG9wLWNvbG9yPSIjN2RkM2ZjIi8+CiAgICA8c3RvcCBvZmZzZXQ9IjEiIHN0b3AtY29sb3I9IiM2MzY2ZjEiLz4KICA8L2xpbmVhckdyYWRpZW50PgogIDxsaW5lYXJHcmFkaWVudCBpZD0iamFkZSIgeDE9IjAiIHkxPSIwIiB4Mj0iMC41IiB5Mj0iMSI+CiAgICA8c3RvcCBvZmZzZXQ9IjAiIHN0b3AtY29sb3I9IiNiYmY3ZDAiLz48c3RvcCBvZmZzZXQ9IjAuNSIgc3RvcC1jb2xvcj0iIzM0ZDM5OSIvPgogICAgPHN0b3Agb2Zmc2V0PSIxIiBzdG9wLWNvbG9yPSIjMGY3NjZlIi8+CiAgPC9saW5lYXJHcmFkaWVudD4KICA8cmFkaWFsR3JhZGllbnQgaWQ9InNwYWNlIiBjeD0iMC41IiBjeT0iMC40MiIgcj0iMC43Ij4KICAgIDxzdG9wIG9mZnNldD0iMCIgc3RvcC1jb2xvcj0iIzFlMjkzYiIvPjxzdG9wIG9mZnNldD0iMC43IiBzdG9wLWNvbG9yPSIjMGIxMTIwIi8+CiAgICA8c3RvcCBvZmZzZXQ9IjEiIHN0b3AtY29sb3I9IiMwMjA2MTciLz4KICA8L3JhZGlhbEdyYWRpZW50PgogIDxyYWRpYWxHcmFkaWVudCBpZD0icGxhbmV0IiBjeD0iMC4zOCIgY3k9IjAuMzIiIHI9IjAuODUiPgogICAgPHN0b3Agb2Zmc2V0PSIwIiBzdG9wLWNvbG9yPSIjYTViNGZjIi8+PHN0b3Agb2Zmc2V0PSIwLjQ1IiBzdG9wLWNvbG9yPSIjNjM2NmYxIi8+CiAgICA8c3RvcCBvZmZzZXQ9IjEiIHN0b3AtY29sb3I9IiMzMTJlODEiLz4KICA8L3JhZGlhbEdyYWRpZW50PgogIDxmaWx0ZXIgaWQ9InNvZnQiIHg9Ii00MCUiIHk9Ii00MCUiIHdpZHRoPSIxODAlIiBoZWlnaHQ9IjE4MCUiPgogICAgPGZlR2F1c3NpYW5CbHVyIHN0ZERldmlhdGlvbj0iNCIvPgogIDwvZmlsdGVyPgo8L2RlZnM+PGc+PGxpbmUgeDE9IjE1OC4wIiB5MT0iMTI4LjAiIHgyPSIyMjAuMCIgeTI9IjEyOC4wIiBzdHJva2U9IiNmYmJmMjQiIHN0cm9rZS13aWR0aD0iNSIgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIi8+PGNpcmNsZSBjeD0iMjIwLjAiIGN5PSIxMjguMCIgcj0iNSIgZmlsbD0iI2ZiYmYyNCIvPjxsaW5lIHgxPSIxNTUuNyIgeTE9IjEzOS41IiB4Mj0iMTg3LjEiIHkyPSIxNTIuNSIgc3Ryb2tlPSIjZjQ3MmI2IiBzdHJva2Utd2lkdGg9IjMiIHN0cm9rZS1saW5lY2FwPSJyb3VuZCIvPjxjaXJjbGUgY3g9IjE4Ny4xIiBjeT0iMTUyLjUiIHI9IjMuNSIgZmlsbD0iI2Y0NzJiNiIvPjxsaW5lIHgxPSIxNDkuMiIgeTE9IjE0OS4yIiB4Mj0iMTkzLjEiIHkyPSIxOTMuMSIgc3Ryb2tlPSIjMzhiZGY4IiBzdHJva2Utd2lkdGg9IjUiIHN0cm9rZS1saW5lY2FwPSJyb3VuZCIvPjxjaXJjbGUgY3g9IjE5My4xIiBjeT0iMTkzLjEiIHI9IjUiIGZpbGw9IiMzOGJkZjgiLz48bGluZSB4MT0iMTM5LjUiIHkxPSIxNTUuNyIgeDI9IjE1Mi41IiB5Mj0iMTg3LjEiIHN0cm9rZT0iI2EzZTYzNSIgc3Ryb2tlLXdpZHRoPSIzIiBzdHJva2UtbGluZWNhcD0icm91bmQiLz48Y2lyY2xlIGN4PSIxNTIuNSIgY3k9IjE4Ny4xIiByPSIzLjUiIGZpbGw9IiNhM2U2MzUiLz48bGluZSB4MT0iMTI4LjAiIHkxPSIxNTguMCIgeDI9IjEyOC4wIiB5Mj0iMjIwLjAiIHN0cm9rZT0iI2ZiYmYyNCIgc3Ryb2tlLXdpZHRoPSI1IiBzdHJva2UtbGluZWNhcD0icm91bmQiLz48Y2lyY2xlIGN4PSIxMjguMCIgY3k9IjIyMC4wIiByPSI1IiBmaWxsPSIjZmJiZjI0Ii8+PGxpbmUgeDE9IjExNi41IiB5MT0iMTU1LjciIHgyPSIxMDMuNSIgeTI9IjE4Ny4xIiBzdHJva2U9IiNmNDcyYjYiIHN0cm9rZS13aWR0aD0iMyIgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIi8+PGNpcmNsZSBjeD0iMTAzLjUiIGN5PSIxODcuMSIgcj0iMy41IiBmaWxsPSIjZjQ3MmI2Ii8+PGxpbmUgeDE9IjEwNi44IiB5MT0iMTQ5LjIiIHgyPSI2Mi45IiB5Mj0iMTkzLjEiIHN0cm9rZT0iIzM4YmRmOCIgc3Ryb2tlLXdpZHRoPSI1IiBzdHJva2UtbGluZWNhcD0icm91bmQiLz48Y2lyY2xlIGN4PSI2Mi45IiBjeT0iMTkzLjEiIHI9IjUiIGZpbGw9IiMzOGJkZjgiLz48bGluZSB4MT0iMTAwLjMiIHkxPSIxMzkuNSIgeDI9IjY4LjkiIHkyPSIxNTIuNSIgc3Ryb2tlPSIjYTNlNjM1IiBzdHJva2Utd2lkdGg9IjMiIHN0cm9rZS1saW5lY2FwPSJyb3VuZCIvPjxjaXJjbGUgY3g9IjY4LjkiIGN5PSIxNTIuNSIgcj0iMy41IiBmaWxsPSIjYTNlNjM1Ii8+PGxpbmUgeDE9Ijk4LjAiIHkxPSIxMjguMCIgeDI9IjM2LjAiIHkyPSIxMjguMCIgc3Ryb2tlPSIjZmJiZjI0IiBzdHJva2Utd2lkdGg9IjUiIHN0cm9rZS1saW5lY2FwPSJyb3VuZCIvPjxjaXJjbGUgY3g9IjM2LjAiIGN5PSIxMjguMCIgcj0iNSIgZmlsbD0iI2ZiYmYyNCIvPjxsaW5lIHgxPSIxMDAuMyIgeTE9IjExNi41IiB4Mj0iNjguOSIgeTI9IjEwMy41IiBzdHJva2U9IiNmNDcyYjYiIHN0cm9rZS13aWR0aD0iMyIgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIi8+PGNpcmNsZSBjeD0iNjguOSIgY3k9IjEwMy41IiByPSIzLjUiIGZpbGw9IiNmNDcyYjYiLz48bGluZSB4MT0iMTA2LjgiIHkxPSIxMDYuOCIgeDI9IjYyLjkiIHkyPSI2Mi45IiBzdHJva2U9IiMzOGJkZjgiIHN0cm9rZS13aWR0aD0iNSIgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIi8+PGNpcmNsZSBjeD0iNjIuOSIgY3k9IjYyLjkiIHI9IjUiIGZpbGw9IiMzOGJkZjgiLz48bGluZSB4MT0iMTE2LjUiIHkxPSIxMDAuMyIgeDI9IjEwMy41IiB5Mj0iNjguOSIgc3Ryb2tlPSIjYTNlNjM1IiBzdHJva2Utd2lkdGg9IjMiIHN0cm9rZS1saW5lY2FwPSJyb3VuZCIvPjxjaXJjbGUgY3g9IjEwMy41IiBjeT0iNjguOSIgcj0iMy41IiBmaWxsPSIjYTNlNjM1Ii8+PGxpbmUgeDE9IjEyOC4wIiB5MT0iOTguMCIgeDI9IjEyOC4wIiB5Mj0iMzYuMCIgc3Ryb2tlPSIjZmJiZjI0IiBzdHJva2Utd2lkdGg9IjUiIHN0cm9rZS1saW5lY2FwPSJyb3VuZCIvPjxjaXJjbGUgY3g9IjEyOC4wIiBjeT0iMzYuMCIgcj0iNSIgZmlsbD0iI2ZiYmYyNCIvPjxsaW5lIHgxPSIxMzkuNSIgeTE9IjEwMC4zIiB4Mj0iMTUyLjUiIHkyPSI2OC45IiBzdHJva2U9IiNmNDcyYjYiIHN0cm9rZS13aWR0aD0iMyIgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIi8+PGNpcmNsZSBjeD0iMTUyLjUiIGN5PSI2OC45IiByPSIzLjUiIGZpbGw9IiNmNDcyYjYiLz48bGluZSB4MT0iMTQ5LjIiIHkxPSIxMDYuOCIgeDI9IjE5My4xIiB5Mj0iNjIuOSIgc3Ryb2tlPSIjMzhiZGY4IiBzdHJva2Utd2lkdGg9IjUiIHN0cm9rZS1saW5lY2FwPSJyb3VuZCIvPjxjaXJjbGUgY3g9IjE5My4xIiBjeT0iNjIuOSIgcj0iNSIgZmlsbD0iIzM4YmRmOCIvPjxsaW5lIHgxPSIxNTUuNyIgeTE9IjExNi41IiB4Mj0iMTg3LjEiIHkyPSIxMDMuNSIgc3Ryb2tlPSIjYTNlNjM1IiBzdHJva2Utd2lkdGg9IjMiIHN0cm9rZS1saW5lY2FwPSJyb3VuZCIvPjxjaXJjbGUgY3g9IjE4Ny4xIiBjeT0iMTAzLjUiIHI9IjMuNSIgZmlsbD0iI2EzZTYzNSIvPjxjaXJjbGUgY3g9IjEyOCIgY3k9IjEyOCIgcj0iMjIiIGZpbGw9InVybCgjZ29sZFIpIi8+PGNpcmNsZSBjeD0iMTI4IiBjeT0iMTI4IiByPSIyMiIgZmlsbD0ibm9uZSIgc3Ryb2tlPSIjZmZmYmU2IiBzdHJva2Utd2lkdGg9IjIiIG9wYWNpdHk9IjAuNyIvPjxwb2x5Z29uIHBvaW50cz0iMTI4LjAwLDExNi4wMCAxMzAuODgsMTI1LjEyIDE0MC4wMCwxMjguMDAgMTMwLjg4LDEzMC44OCAxMjguMDAsMTQwLjAwIDEyNS4xMiwxMzAuODggMTE2LjAwLDEyOC4wMCAxMjUuMTIsMTI1LjEyIiBmaWxsPSIjZmZmIiBvcGFjaXR5PSIwLjk1Ii8+PGxpbmUgeDE9IjUyIiB5MT0iNTgiIHgyPSI2OC4wIiB5Mj0iNTguMCIgc3Ryb2tlPSIjZjQ3MmI2IiBzdHJva2Utd2lkdGg9IjIiIHN0cm9rZS1saW5lY2FwPSJyb3VuZCIgb3BhY2l0eT0iMC44NSIvPjxsaW5lIHgxPSI1MiIgeTE9IjU4IiB4Mj0iNjMuMyIgeTI9IjY5LjMiIHN0cm9rZT0iI2Y0NzJiNiIgc3Ryb2tlLXdpZHRoPSIyIiBzdHJva2UtbGluZWNhcD0icm91bmQiIG9wYWNpdHk9IjAuODUiLz48bGluZSB4MT0iNTIiIHkxPSI1OCIgeDI9IjUyLjAiIHkyPSI3NC4wIiBzdHJva2U9IiNmNDcyYjYiIHN0cm9rZS13aWR0aD0iMiIgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIiBvcGFjaXR5PSIwLjg1Ii8+PGxpbmUgeDE9IjUyIiB5MT0iNTgiIHgyPSI0MC43IiB5Mj0iNjkuMyIgc3Ryb2tlPSIjZjQ3MmI2IiBzdHJva2Utd2lkdGg9IjIiIHN0cm9rZS1saW5lY2FwPSJyb3VuZCIgb3BhY2l0eT0iMC44NSIvPjxsaW5lIHgxPSI1MiIgeTE9IjU4IiB4Mj0iMzYuMCIgeTI9IjU4LjAiIHN0cm9rZT0iI2Y0NzJiNiIgc3Ryb2tlLXdpZHRoPSIyIiBzdHJva2UtbGluZWNhcD0icm91bmQiIG9wYWNpdHk9IjAuODUiLz48bGluZSB4MT0iNTIiIHkxPSI1OCIgeDI9IjQwLjciIHkyPSI0Ni43IiBzdHJva2U9IiNmNDcyYjYiIHN0cm9rZS13aWR0aD0iMiIgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIiBvcGFjaXR5PSIwLjg1Ii8+PGxpbmUgeDE9IjUyIiB5MT0iNTgiIHgyPSI1Mi4wIiB5Mj0iNDIuMCIgc3Ryb2tlPSIjZjQ3MmI2IiBzdHJva2Utd2lkdGg9IjIiIHN0cm9rZS1saW5lY2FwPSJyb3VuZCIgb3BhY2l0eT0iMC44NSIvPjxsaW5lIHgxPSI1MiIgeTE9IjU4IiB4Mj0iNjMuMyIgeTI9IjQ2LjciIHN0cm9rZT0iI2Y0NzJiNiIgc3Ryb2tlLXdpZHRoPSIyIiBzdHJva2UtbGluZWNhcD0icm91bmQiIG9wYWNpdHk9IjAuODUiLz48bGluZSB4MT0iMjA2IiB5MT0iNjYiIHgyPSIyMjIuMCIgeTI9IjY2LjAiIHN0cm9rZT0iIzM4YmRmOCIgc3Ryb2tlLXdpZHRoPSIyIiBzdHJva2UtbGluZWNhcD0icm91bmQiIG9wYWNpdHk9IjAuODUiLz48bGluZSB4MT0iMjA2IiB5MT0iNjYiIHgyPSIyMTcuMyIgeTI9Ijc3LjMiIHN0cm9rZT0iIzM4YmRmOCIgc3Ryb2tlLXdpZHRoPSIyIiBzdHJva2UtbGluZWNhcD0icm91bmQiIG9wYWNpdHk9IjAuODUiLz48bGluZSB4MT0iMjA2IiB5MT0iNjYiIHgyPSIyMDYuMCIgeTI9IjgyLjAiIHN0cm9rZT0iIzM4YmRmOCIgc3Ryb2tlLXdpZHRoPSIyIiBzdHJva2UtbGluZWNhcD0icm91bmQiIG9wYWNpdHk9IjAuODUiLz48bGluZSB4MT0iMjA2IiB5MT0iNjYiIHgyPSIxOTQuNyIgeTI9Ijc3LjMiIHN0cm9rZT0iIzM4YmRmOCIgc3Ryb2tlLXdpZHRoPSIyIiBzdHJva2UtbGluZWNhcD0icm91bmQiIG9wYWNpdHk9IjAuODUiLz48bGluZSB4MT0iMjA2IiB5MT0iNjYiIHgyPSIxOTAuMCIgeTI9IjY2LjAiIHN0cm9rZT0iIzM4YmRmOCIgc3Ryb2tlLXdpZHRoPSIyIiBzdHJva2UtbGluZWNhcD0icm91bmQiIG9wYWNpdHk9IjAuODUiLz48bGluZSB4MT0iMjA2IiB5MT0iNjYiIHgyPSIxOTQuNyIgeTI9IjU0LjciIHN0cm9rZT0iIzM4YmRmOCIgc3Ryb2tlLXdpZHRoPSIyIiBzdHJva2UtbGluZWNhcD0icm91bmQiIG9wYWNpdHk9IjAuODUiLz48bGluZSB4MT0iMjA2IiB5MT0iNjYiIHgyPSIyMDYuMCIgeTI9IjUwLjAiIHN0cm9rZT0iIzM4YmRmOCIgc3Ryb2tlLXdpZHRoPSIyIiBzdHJva2UtbGluZWNhcD0icm91bmQiIG9wYWNpdHk9IjAuODUiLz48bGluZSB4MT0iMjA2IiB5MT0iNjYiIHgyPSIyMTcuMyIgeTI9IjU0LjciIHN0cm9rZT0iIzM4YmRmOCIgc3Ryb2tlLXdpZHRoPSIyIiBzdHJva2UtbGluZWNhcD0icm91bmQiIG9wYWNpdHk9IjAuODUiLz48bGluZSB4MT0iNjAiIHkxPSIyMDAiIHgyPSI3Ni4wIiB5Mj0iMjAwLjAiIHN0cm9rZT0iI2EzZTYzNSIgc3Ryb2tlLXdpZHRoPSIyIiBzdHJva2UtbGluZWNhcD0icm91bmQiIG9wYWNpdHk9IjAuODUiLz48bGluZSB4MT0iNjAiIHkxPSIyMDAiIHgyPSI3MS4zIiB5Mj0iMjExLjMiIHN0cm9rZT0iI2EzZTYzNSIgc3Ryb2tlLXdpZHRoPSIyIiBzdHJva2UtbGluZWNhcD0icm91bmQiIG9wYWNpdHk9IjAuODUiLz48bGluZSB4MT0iNjAiIHkxPSIyMDAiIHgyPSI2MC4wIiB5Mj0iMjE2LjAiIHN0cm9rZT0iI2EzZTYzNSIgc3Ryb2tlLXdpZHRoPSIyIiBzdHJva2UtbGluZWNhcD0icm91bmQiIG9wYWNpdHk9IjAuODUiLz48bGluZSB4MT0iNjAiIHkxPSIyMDAiIHgyPSI0OC43IiB5Mj0iMjExLjMiIHN0cm9rZT0iI2EzZTYzNSIgc3Ryb2tlLXdpZHRoPSIyIiBzdHJva2UtbGluZWNhcD0icm91bmQiIG9wYWNpdHk9IjAuODUiLz48bGluZSB4MT0iNjAiIHkxPSIyMDAiIHgyPSI0NC4wIiB5Mj0iMjAwLjAiIHN0cm9rZT0iI2EzZTYzNSIgc3Ryb2tlLXdpZHRoPSIyIiBzdHJva2UtbGluZWNhcD0icm91bmQiIG9wYWNpdHk9IjAuODUiLz48bGluZSB4MT0iNjAiIHkxPSIyMDAiIHgyPSI0OC43IiB5Mj0iMTg4LjciIHN0cm9rZT0iI2EzZTYzNSIgc3Ryb2tlLXdpZHRoPSIyIiBzdHJva2UtbGluZWNhcD0icm91bmQiIG9wYWNpdHk9IjAuODUiLz48bGluZSB4MT0iNjAiIHkxPSIyMDAiIHgyPSI2MC4wIiB5Mj0iMTg0LjAiIHN0cm9rZT0iI2EzZTYzNSIgc3Ryb2tlLXdpZHRoPSIyIiBzdHJva2UtbGluZWNhcD0icm91bmQiIG9wYWNpdHk9IjAuODUiLz48bGluZSB4MT0iNjAiIHkxPSIyMDAiIHgyPSI3MS4zIiB5Mj0iMTg4LjciIHN0cm9rZT0iI2EzZTYzNSIgc3Ryb2tlLXdpZHRoPSIyIiBzdHJva2UtbGluZWNhcD0icm91bmQiIG9wYWNpdHk9IjAuODUiLz48bGluZSB4MT0iMjAwIiB5MT0iMTk4IiB4Mj0iMjE2LjAiIHkyPSIxOTguMCIgc3Ryb2tlPSIjZmJiZjI0IiBzdHJva2Utd2lkdGg9IjIiIHN0cm9rZS1saW5lY2FwPSJyb3VuZCIgb3BhY2l0eT0iMC44NSIvPjxsaW5lIHgxPSIyMDAiIHkxPSIxOTgiIHgyPSIyMTEuMyIgeTI9IjIwOS4zIiBzdHJva2U9IiNmYmJmMjQiIHN0cm9rZS13aWR0aD0iMiIgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIiBvcGFjaXR5PSIwLjg1Ii8+PGxpbmUgeDE9IjIwMCIgeTE9IjE5OCIgeDI9IjIwMC4wIiB5Mj0iMjE0LjAiIHN0cm9rZT0iI2ZiYmYyNCIgc3Ryb2tlLXdpZHRoPSIyIiBzdHJva2UtbGluZWNhcD0icm91bmQiIG9wYWNpdHk9IjAuODUiLz48bGluZSB4MT0iMjAwIiB5MT0iMTk4IiB4Mj0iMTg4LjciIHkyPSIyMDkuMyIgc3Ryb2tlPSIjZmJiZjI0IiBzdHJva2Utd2lkdGg9IjIiIHN0cm9rZS1saW5lY2FwPSJyb3VuZCIgb3BhY2l0eT0iMC44NSIvPjxsaW5lIHgxPSIyMDAiIHkxPSIxOTgiIHgyPSIxODQuMCIgeTI9IjE5OC4wIiBzdHJva2U9IiNmYmJmMjQiIHN0cm9rZS13aWR0aD0iMiIgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIiBvcGFjaXR5PSIwLjg1Ii8+PGxpbmUgeDE9IjIwMCIgeTE9IjE5OCIgeDI9IjE4OC43IiB5Mj0iMTg2LjciIHN0cm9rZT0iI2ZiYmYyNCIgc3Ryb2tlLXdpZHRoPSIyIiBzdHJva2UtbGluZWNhcD0icm91bmQiIG9wYWNpdHk9IjAuODUiLz48bGluZSB4MT0iMjAwIiB5MT0iMTk4IiB4Mj0iMjAwLjAiIHkyPSIxODIuMCIgc3Ryb2tlPSIjZmJiZjI0IiBzdHJva2Utd2lkdGg9IjIiIHN0cm9rZS1saW5lY2FwPSJyb3VuZCIgb3BhY2l0eT0iMC44NSIvPjxsaW5lIHgxPSIyMDAiIHkxPSIxOTgiIHgyPSIyMTEuMyIgeTI9IjE4Ni43IiBzdHJva2U9IiNmYmJmMjQiIHN0cm9rZS13aWR0aD0iMiIgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIiBvcGFjaXR5PSIwLjg1Ii8+PC9nPjwvc3ZnPg==',
  x1: 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNTYgMjU2Ij4KPGRlZnM+CiAgPGxpbmVhckdyYWRpZW50IGlkPSJob2xvIiB4MT0iMCIgeTE9IjAiIHgyPSIxIiB5Mj0iMSI+CiAgICA8c3RvcCBvZmZzZXQ9IjAiIHN0b3AtY29sb3I9IiM1ZWVhZDQiLz48c3RvcCBvZmZzZXQ9IjAuMjgiIHN0b3AtY29sb3I9IiM4MThjZjgiLz4KICAgIDxzdG9wIG9mZnNldD0iMC41NSIgc3RvcC1jb2xvcj0iI2MwODRmYyIvPjxzdG9wIG9mZnNldD0iMC43OCIgc3RvcC1jb2xvcj0iI2Y0NzJiNiIvPgogICAgPHN0b3Agb2Zmc2V0PSIxIiBzdG9wLWNvbG9yPSIjZmJiZjI0Ii8+CiAgPC9saW5lYXJHcmFkaWVudD4KICA8bGluZWFyR3JhZGllbnQgaWQ9ImdvbGQiIHgxPSIwIiB5MT0iMCIgeDI9IjAuNCIgeTI9IjEiPgogICAgPHN0b3Agb2Zmc2V0PSIwIiBzdG9wLWNvbG9yPSIjZmRlNjhhIi8+PHN0b3Agb2Zmc2V0PSIwLjUiIHN0b3AtY29sb3I9IiNmNTllMGIiLz4KICAgIDxzdG9wIG9mZnNldD0iMSIgc3RvcC1jb2xvcj0iI2I0NTMwOSIvPgogIDwvbGluZWFyR3JhZGllbnQ+CiAgPHJhZGlhbEdyYWRpZW50IGlkPSJnb2xkUiIgY3g9IjAuNCIgY3k9IjAuMzIiIHI9IjAuNzUiPgogICAgPHN0b3Agb2Zmc2V0PSIwIiBzdG9wLWNvbG9yPSIjZmZmYmU2Ii8+PHN0b3Agb2Zmc2V0PSIwLjQ1IiBzdG9wLWNvbG9yPSIjZmJiZjI0Ii8+CiAgICA8c3RvcCBvZmZzZXQ9IjEiIHN0b3AtY29sb3I9IiNiNDUzMDkiLz4KICA8L3JhZGlhbEdyYWRpZW50PgogIDxsaW5lYXJHcmFkaWVudCBpZD0iaWNlIiB4MT0iMCIgeTE9IjAiIHgyPSIwLjUiIHkyPSIxIj4KICAgIDxzdG9wIG9mZnNldD0iMCIgc3RvcC1jb2xvcj0iI2UwZjJmZSIvPjxzdG9wIG9mZnNldD0iMC41IiBzdG9wLWNvbG9yPSIjN2RkM2ZjIi8+CiAgICA8c3RvcCBvZmZzZXQ9IjEiIHN0b3AtY29sb3I9IiM2MzY2ZjEiLz4KICA8L2xpbmVhckdyYWRpZW50PgogIDxsaW5lYXJHcmFkaWVudCBpZD0iamFkZSIgeDE9IjAiIHkxPSIwIiB4Mj0iMC41IiB5Mj0iMSI+CiAgICA8c3RvcCBvZmZzZXQ9IjAiIHN0b3AtY29sb3I9IiNiYmY3ZDAiLz48c3RvcCBvZmZzZXQ9IjAuNSIgc3RvcC1jb2xvcj0iIzM0ZDM5OSIvPgogICAgPHN0b3Agb2Zmc2V0PSIxIiBzdG9wLWNvbG9yPSIjMGY3NjZlIi8+CiAgPC9saW5lYXJHcmFkaWVudD4KICA8cmFkaWFsR3JhZGllbnQgaWQ9InNwYWNlIiBjeD0iMC41IiBjeT0iMC40MiIgcj0iMC43Ij4KICAgIDxzdG9wIG9mZnNldD0iMCIgc3RvcC1jb2xvcj0iIzFlMjkzYiIvPjxzdG9wIG9mZnNldD0iMC43IiBzdG9wLWNvbG9yPSIjMGIxMTIwIi8+CiAgICA8c3RvcCBvZmZzZXQ9IjEiIHN0b3AtY29sb3I9IiMwMjA2MTciLz4KICA8L3JhZGlhbEdyYWRpZW50PgogIDxyYWRpYWxHcmFkaWVudCBpZD0icGxhbmV0IiBjeD0iMC4zOCIgY3k9IjAuMzIiIHI9IjAuODUiPgogICAgPHN0b3Agb2Zmc2V0PSIwIiBzdG9wLWNvbG9yPSIjYTViNGZjIi8+PHN0b3Agb2Zmc2V0PSIwLjQ1IiBzdG9wLWNvbG9yPSIjNjM2NmYxIi8+CiAgICA8c3RvcCBvZmZzZXQ9IjEiIHN0b3AtY29sb3I9IiMzMTJlODEiLz4KICA8L3JhZGlhbEdyYWRpZW50PgogIDxmaWx0ZXIgaWQ9InNvZnQiIHg9Ii00MCUiIHk9Ii00MCUiIHdpZHRoPSIxODAlIiBoZWlnaHQ9IjE4MCUiPgogICAgPGZlR2F1c3NpYW5CbHVyIHN0ZERldmlhdGlvbj0iNCIvPgogIDwvZmlsdGVyPgo8L2RlZnM+PGc+PGNpcmNsZSBjeD0iMTI4IiBjeT0iMTI4IiByPSIxMTgiIGZpbGw9InVybCgjc3BhY2UpIi8+PGVsbGlwc2UgY3g9IjEyOCIgY3k9IjEzMiIgcng9IjEwNCIgcnk9IjQwIiBmaWxsPSJub25lIiBzdHJva2U9InVybCgjaG9sbykiIHN0cm9rZS13aWR0aD0iMi41IiBvcGFjaXR5PSIwLjgiIHRyYW5zZm9ybT0icm90YXRlKC0yNCAxMjggMTMyKSIvPjxjaXJjbGUgY3g9IjEyOCIgY3k9IjEyMCIgcj0iNDYiIGZpbGw9InVybCgjcGxhbmV0KSIvPjxlbGxpcHNlIGN4PSIxMTIiIGN5PSIxMDQiIHJ4PSIxNiIgcnk9IjEwIiBmaWxsPSIjYzdkMmZlIiBvcGFjaXR5PSIwLjUiLz48ZWxsaXBzZSBjeD0iMTI4IiBjeT0iMTIwIiByeD0iODIiIHJ5PSIyNiIgZmlsbD0ibm9uZSIgc3Ryb2tlPSJ1cmwoI2hvbG8pIiBzdHJva2Utd2lkdGg9IjkiIHRyYW5zZm9ybT0icm90YXRlKC0yNCAxMjggMTIwKSIvPjxwYXRoIGQ9Ik02MCAxMDYgQTgyIDI2IC0yNCAwIDAgMTk2IDEzNCIgZmlsbD0ibm9uZSIgc3Ryb2tlPSIjMzEyZTgxIiBzdHJva2Utd2lkdGg9IjkiIG9wYWNpdHk9IjAuNTUiLz48cG9seWdvbiBwb2ludHM9IjYwLjAwLDYyLjAwIDYwLjk2LDY1LjA0IDY0LjAwLDY2LjAwIDYwLjk2LDY2Ljk2IDYwLjAwLDcwLjAwIDU5LjA0LDY2Ljk2IDU2LjAwLDY2LjAwIDU5LjA0LDY1LjA0IiBmaWxsPSIjZmZmIiBvcGFjaXR5PSIwLjkiLz48cG9seWdvbiBwb2ludHM9IjIwMC4wMCw2Ny4wMCAyMDEuMjAsNzAuODAgMjA1LjAwLDcyLjAwIDIwMS4yMCw3My4yMCAyMDAuMDAsNzcuMDAgMTk4LjgwLDczLjIwIDE5NS4wMCw3Mi4wMCAxOTguODAsNzAuODAiIGZpbGw9IiNmZmYiIG9wYWNpdHk9IjAuOSIvPjxwb2x5Z29uIHBvaW50cz0iNTIuMDAsMTc3LjAwIDUyLjcyLDE3OS4yOCA1NS4wMCwxODAuMDAgNTIuNzIsMTgwLjcyIDUyLjAwLDE4My4wMCA1MS4yOCwxODAuNzIgNDkuMDAsMTgwLjAwIDUxLjI4LDE3OS4yOCIgZmlsbD0iI2ZmZiIgb3BhY2l0eT0iMC45Ii8+PHBvbHlnb24gcG9pbnRzPSIyMDYuMDAsMTcyLjAwIDIwNi45NiwxNzUuMDQgMjEwLjAwLDE3Ni4wMCAyMDYuOTYsMTc2Ljk2IDIwNi4wMCwxODAuMDAgMjA1LjA0LDE3Ni45NiAyMDIuMDAsMTc2LjAwIDIwNS4wNCwxNzUuMDQiIGZpbGw9IiNmZmYiIG9wYWNpdHk9IjAuOSIvPjxwb2x5Z29uIHBvaW50cz0iMTUwLjAwLDU1LjAwIDE1MC43Miw1Ny4yOCAxNTMuMDAsNTguMDAgMTUwLjcyLDU4LjcyIDE1MC4wMCw2MS4wMCAxNDkuMjgsNTguNzIgMTQ3LjAwLDU4LjAwIDE0OS4yOCw1Ny4yOCIgZmlsbD0iI2ZmZiIgb3BhY2l0eT0iMC45Ii8+PHBvbHlnb24gcG9pbnRzPSI5NC4wMCwxOTMuMDAgOTQuNzIsMTk1LjI4IDk3LjAwLDE5Ni4wMCA5NC43MiwxOTYuNzIgOTQuMDAsMTk5LjAwIDkzLjI4LDE5Ni43MiA5MS4wMCwxOTYuMDAgOTMuMjgsMTk1LjI4IiBmaWxsPSIjZmZmIiBvcGFjaXR5PSIwLjkiLz48cG9seWdvbiBwb2ludHM9IjIyMC4wMCwxMTcuMDAgMjIwLjcyLDExOS4yOCAyMjMuMDAsMTIwLjAwIDIyMC43MiwxMjAuNzIgMjIwLjAwLDEyMy4wMCAyMTkuMjgsMTIwLjcyIDIxNy4wMCwxMjAuMDAgMjE5LjI4LDExOS4yOCIgZmlsbD0iI2ZmZiIgb3BhY2l0eT0iMC45Ii8+PGNpcmNsZSBjeD0iMTI4IiBjeT0iMTI4IiByPSIxMTgiIGZpbGw9Im5vbmUiIHN0cm9rZT0idXJsKCNob2xvKSIgc3Ryb2tlLXdpZHRoPSIzIiBvcGFjaXR5PSIwLjkiLz48L2c+PC9zdmc+',
  x2: 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNTYgMjU2Ij4KPGRlZnM+CiAgPGxpbmVhckdyYWRpZW50IGlkPSJob2xvIiB4MT0iMCIgeTE9IjAiIHgyPSIxIiB5Mj0iMSI+CiAgICA8c3RvcCBvZmZzZXQ9IjAiIHN0b3AtY29sb3I9IiM1ZWVhZDQiLz48c3RvcCBvZmZzZXQ9IjAuMjgiIHN0b3AtY29sb3I9IiM4MThjZjgiLz4KICAgIDxzdG9wIG9mZnNldD0iMC41NSIgc3RvcC1jb2xvcj0iI2MwODRmYyIvPjxzdG9wIG9mZnNldD0iMC43OCIgc3RvcC1jb2xvcj0iI2Y0NzJiNiIvPgogICAgPHN0b3Agb2Zmc2V0PSIxIiBzdG9wLWNvbG9yPSIjZmJiZjI0Ii8+CiAgPC9saW5lYXJHcmFkaWVudD4KICA8bGluZWFyR3JhZGllbnQgaWQ9ImdvbGQiIHgxPSIwIiB5MT0iMCIgeDI9IjAuNCIgeTI9IjEiPgogICAgPHN0b3Agb2Zmc2V0PSIwIiBzdG9wLWNvbG9yPSIjZmRlNjhhIi8+PHN0b3Agb2Zmc2V0PSIwLjUiIHN0b3AtY29sb3I9IiNmNTllMGIiLz4KICAgIDxzdG9wIG9mZnNldD0iMSIgc3RvcC1jb2xvcj0iI2I0NTMwOSIvPgogIDwvbGluZWFyR3JhZGllbnQ+CiAgPHJhZGlhbEdyYWRpZW50IGlkPSJnb2xkUiIgY3g9IjAuNCIgY3k9IjAuMzIiIHI9IjAuNzUiPgogICAgPHN0b3Agb2Zmc2V0PSIwIiBzdG9wLWNvbG9yPSIjZmZmYmU2Ii8+PHN0b3Agb2Zmc2V0PSIwLjQ1IiBzdG9wLWNvbG9yPSIjZmJiZjI0Ii8+CiAgICA8c3RvcCBvZmZzZXQ9IjEiIHN0b3AtY29sb3I9IiNiNDUzMDkiLz4KICA8L3JhZGlhbEdyYWRpZW50PgogIDxsaW5lYXJHcmFkaWVudCBpZD0iaWNlIiB4MT0iMCIgeTE9IjAiIHgyPSIwLjUiIHkyPSIxIj4KICAgIDxzdG9wIG9mZnNldD0iMCIgc3RvcC1jb2xvcj0iI2UwZjJmZSIvPjxzdG9wIG9mZnNldD0iMC41IiBzdG9wLWNvbG9yPSIjN2RkM2ZjIi8+CiAgICA8c3RvcCBvZmZzZXQ9IjEiIHN0b3AtY29sb3I9IiM2MzY2ZjEiLz4KICA8L2xpbmVhckdyYWRpZW50PgogIDxsaW5lYXJHcmFkaWVudCBpZD0iamFkZSIgeDE9IjAiIHkxPSIwIiB4Mj0iMC41IiB5Mj0iMSI+CiAgICA8c3RvcCBvZmZzZXQ9IjAiIHN0b3AtY29sb3I9IiNiYmY3ZDAiLz48c3RvcCBvZmZzZXQ9IjAuNSIgc3RvcC1jb2xvcj0iIzM0ZDM5OSIvPgogICAgPHN0b3Agb2Zmc2V0PSIxIiBzdG9wLWNvbG9yPSIjMGY3NjZlIi8+CiAgPC9saW5lYXJHcmFkaWVudD4KICA8cmFkaWFsR3JhZGllbnQgaWQ9InNwYWNlIiBjeD0iMC41IiBjeT0iMC40MiIgcj0iMC43Ij4KICAgIDxzdG9wIG9mZnNldD0iMCIgc3RvcC1jb2xvcj0iIzFlMjkzYiIvPjxzdG9wIG9mZnNldD0iMC43IiBzdG9wLWNvbG9yPSIjMGIxMTIwIi8+CiAgICA8c3RvcCBvZmZzZXQ9IjEiIHN0b3AtY29sb3I9IiMwMjA2MTciLz4KICA8L3JhZGlhbEdyYWRpZW50PgogIDxyYWRpYWxHcmFkaWVudCBpZD0icGxhbmV0IiBjeD0iMC4zOCIgY3k9IjAuMzIiIHI9IjAuODUiPgogICAgPHN0b3Agb2Zmc2V0PSIwIiBzdG9wLWNvbG9yPSIjYTViNGZjIi8+PHN0b3Agb2Zmc2V0PSIwLjQ1IiBzdG9wLWNvbG9yPSIjNjM2NmYxIi8+CiAgICA8c3RvcCBvZmZzZXQ9IjEiIHN0b3AtY29sb3I9IiMzMTJlODEiLz4KICA8L3JhZGlhbEdyYWRpZW50PgogIDxmaWx0ZXIgaWQ9InNvZnQiIHg9Ii00MCUiIHk9Ii00MCUiIHdpZHRoPSIxODAlIiBoZWlnaHQ9IjE4MCUiPgogICAgPGZlR2F1c3NpYW5CbHVyIHN0ZERldmlhdGlvbj0iNCIvPgogIDwvZmlsdGVyPgo8L2RlZnM+PGc+PGcgZmlsdGVyPSJ1cmwoI3NvZnQpIiBvcGFjaXR5PSIwLjUiPjxwYXRoIGQ9Ik0xMjggMTI4IEMxMDQgOTIgNjIgOTIgNTYgMTI4IEM1MCAxNjQgOTIgMTY4IDExNiAxNDAgQzEyNCAxMzAgMTMyIDEzMCAxNDAgMTQwIEMxNjQgMTY4IDIwNiAxNjQgMjAwIDEyOCBDMTk0IDkyIDE1MiA5MiAxMjggMTI4IFoiIGZpbGw9Im5vbmUiIHN0cm9rZT0iI2E3OGJmYSIgc3Ryb2tlLXdpZHRoPSIzMCIvPjwvZz48cGF0aCBkPSJNMTI4IDEyOCBDMTA0IDkyIDYyIDkyIDU2IDEyOCBDNTAgMTY0IDkyIDE2OCAxMTYgMTQwIEMxMjQgMTMwIDEzMiAxMzAgMTQwIDE0MCBDMTY0IDE2OCAyMDYgMTY0IDIwMCAxMjggQzE5NCA5MiAxNTIgOTIgMTI4IDEyOCBaIiBmaWxsPSJub25lIiBzdHJva2U9InVybCgjaG9sbykiIHN0cm9rZS13aWR0aD0iMjQiIHN0cm9rZS1saW5lam9pbj0icm91bmQiLz48cGF0aCBkPSJNMTI4IDEyOCBDMTA0IDkyIDYyIDkyIDU2IDEyOCBDNTAgMTY0IDkyIDE2OCAxMTYgMTQwIEMxMjQgMTMwIDEzMiAxMzAgMTQwIDE0MCBDMTY0IDE2OCAyMDYgMTY0IDIwMCAxMjggQzE5NCA5MiAxNTIgOTIgMTI4IDEyOCBaIiBmaWxsPSJub25lIiBzdHJva2U9IiNmZmZmZmYiIHN0cm9rZS13aWR0aD0iNSIgb3BhY2l0eT0iMC41NSIvPjxwYXRoIGQ9Ik0xMjggMTI4IEMxMDQgOTIgNjIgOTIgNTYgMTI4IEM1MCAxNjQgOTIgMTY4IDExNiAxNDAgQzEyNCAxMzAgMTMyIDEzMCAxNDAgMTQwIEMxNjQgMTY4IDIwNiAxNjQgMjAwIDEyOCBDMTk0IDkyIDE1MiA5MiAxMjggMTI4IFoiIGZpbGw9Im5vbmUiIHN0cm9rZT0iI2ZmZmZmZiIgc3Ryb2tlLXdpZHRoPSIxLjUiIG9wYWNpdHk9IjAuOCIvPjxwb2x5Z29uIHBvaW50cz0iNTYuMDAsMTIyLjAwIDU3LjQ0LDEyNi41NiA2Mi4wMCwxMjguMDAgNTcuNDQsMTI5LjQ0IDU2LjAwLDEzNC4wMCA1NC41NiwxMjkuNDQgNTAuMDAsMTI4LjAwIDU0LjU2LDEyNi41NiIgZmlsbD0iI2ZmZiIgb3BhY2l0eT0iMC45Ii8+PHBvbHlnb24gcG9pbnRzPSIyMDAuMDAsMTIyLjAwIDIwMS40NCwxMjYuNTYgMjA2LjAwLDEyOC4wMCAyMDEuNDQsMTI5LjQ0IDIwMC4wMCwxMzQuMDAgMTk4LjU2LDEyOS40NCAxOTQuMDAsMTI4LjAwIDE5OC41NiwxMjYuNTYiIGZpbGw9IiNmZmYiIG9wYWNpdHk9IjAuOSIvPjxwb2x5Z29uIHBvaW50cz0iMTI4LjAwLDEyMS4wMCAxMjkuNjgsMTI2LjMyIDEzNS4wMCwxMjguMDAgMTI5LjY4LDEyOS42OCAxMjguMDAsMTM1LjAwIDEyNi4zMiwxMjkuNjggMTIxLjAwLDEyOC4wMCAxMjYuMzIsMTI2LjMyIiBmaWxsPSIjZmZmIiBvcGFjaXR5PSIwLjkiLz48cG9seWdvbiBwb2ludHM9Ijk2LjAwLDE0Ni4wMCA5Ni45NiwxNDkuMDQgMTAwLjAwLDE1MC4wMCA5Ni45NiwxNTAuOTYgOTYuMDAsMTU0LjAwIDk1LjA0LDE1MC45NiA5Mi4wMCwxNTAuMDAgOTUuMDQsMTQ5LjA0IiBmaWxsPSIjZmZmIiBvcGFjaXR5PSIwLjkiLz48cG9seWdvbiBwb2ludHM9IjE2MC4wMCwxNDYuMDAgMTYwLjk2LDE0OS4wNCAxNjQuMDAsMTUwLjAwIDE2MC45NiwxNTAuOTYgMTYwLjAwLDE1NC4wMCAxNTkuMDQsMTUwLjk2IDE1Ni4wMCwxNTAuMDAgMTU5LjA0LDE0OS4wNCIgZmlsbD0iI2ZmZiIgb3BhY2l0eT0iMC45Ii8+PHBvbHlnb24gcG9pbnRzPSI5Ni4wMCwxMDMuMDAgOTYuNzIsMTA1LjI4IDk5LjAwLDEwNi4wMCA5Ni43MiwxMDYuNzIgOTYuMDAsMTA5LjAwIDk1LjI4LDEwNi43MiA5My4wMCwxMDYuMDAgOTUuMjgsMTA1LjI4IiBmaWxsPSIjZmZmIiBvcGFjaXR5PSIwLjkiLz48cG9seWdvbiBwb2ludHM9IjE2MC4wMCwxMDMuMDAgMTYwLjcyLDEwNS4yOCAxNjMuMDAsMTA2LjAwIDE2MC43MiwxMDYuNzIgMTYwLjAwLDEwOS4wMCAxNTkuMjgsMTA2LjcyIDE1Ny4wMCwxMDYuMDAgMTU5LjI4LDEwNS4yOCIgZmlsbD0iI2ZmZiIgb3BhY2l0eT0iMC45Ii8+PC9nPjwvc3ZnPg==',
};
STICKERS.forEach(s => { const a = STICKER_ART[s.id]; if (a) s.img = a; });

export const STICKER_BY_ID: Record<string, Sticker> = Object.fromEntries(STICKERS.map(s => [s.id, s]));

export const GACHA_COST = 100;
export const TEN_PULL_COST = 900; // 10連は1回分お得
export const DUP_REFUND = 20;

function key(uid: string) { return `mathquest:reward:${uid || 'guest'}`; }

const EMPTY: RewardData = { coins: 0, stickers: {}, xp: 0, streak: 0, lastClaim: '', bestCombo: 0, totalCorrect: 0, totalPlayed: 0, perfectGames: 0 };

export function loadReward(uid: string): RewardData {
  try {
    const raw = localStorage.getItem(key(uid));
    if (raw) {
      const d = JSON.parse(raw);
      return {
        coins: typeof d.coins === 'number' ? d.coins : 0,
        stickers: (d.stickers && typeof d.stickers === 'object') ? d.stickers : {},
        xp: typeof d.xp === 'number' ? d.xp : 0,
        streak: typeof d.streak === 'number' ? d.streak : 0,
        lastClaim: typeof d.lastClaim === 'string' ? d.lastClaim : '',
        bestCombo: typeof d.bestCombo === 'number' ? d.bestCombo : 0,
        totalCorrect: typeof d.totalCorrect === 'number' ? d.totalCorrect : 0,
        totalPlayed: typeof d.totalPlayed === 'number' ? d.totalPlayed : 0,
        perfectGames: typeof d.perfectGames === 'number' ? d.perfectGames : 0,
      };
    }
  } catch { /* ignore */ }
  return { ...EMPTY };
}

export function saveReward(uid: string, d: RewardData) {
  try { localStorage.setItem(key(uid), JSON.stringify(d)); } catch { /* ignore */ }
}

// ===== コイン計算（基本＋コンボ＋スピード） =====
// 段階に応じた1問あたりの基本単価。算数低=10 … 数学高=50。
export function baseCoinPerCorrect(tierIndex: number): number { return 10 + tierIndex * 10; }

// コンボ倍率: 2連=1.2, 3連=1.4 … 上限3.0。0/1連は1.0。
export function comboMultiplier(combo: number): number {
  if (combo <= 1) return 1;
  return Math.min(3, 1 + (combo - 1) * 0.2);
}

// スピードボーナス: 残り時間割合(0〜1)に応じて基本の最大50%を加算。
export function speedBonus(base: number, timeFrac: number): number {
  return Math.round(base * 0.5 * Math.max(0, Math.min(1, timeFrac)));
}

// 1問正解時の獲得コイン（基本×コンボ + スピード）
export function coinsForQuestion(tierIndex: number, combo: number, timeFrac: number): number {
  const base = baseCoinPerCorrect(tierIndex);
  const withCombo = Math.round(base * comboMultiplier(combo));
  return withCombo + speedBonus(base, timeFrac);
}

// 旧API互換（結果画面の合計簡易計算に使用可）
export function coinsForResult(correct: number, tierIndex: number): number {
  return correct * baseCoinPerCorrect(tierIndex);
}

// 全問正解ボーナス
export function perfectBonus(total: number, tierIndex: number): number {
  return Math.round(baseCoinPerCorrect(tierIndex) * total * 0.5);
}

// ===== XP / レベル =====
export interface LevelInfo { level: number; title: string; xpInto: number; xpForNext: number; progress: number; totalForCurrent: number; }

// レベルnに到達するのに必要な累計XP: n=1→0, 以降ゆるやかな二次
function cumulativeXpForLevel(level: number): number {
  if (level <= 1) return 0;
  const n = level - 1;
  return Math.round(50 * n * n + 50 * n); // Lv2=100, Lv3=300, Lv4=600, Lv5=1000...
}

const TITLES: { min: number; title: string }[] = [
  { min: 1, title: 'かけだし見習い' },
  { min: 3, title: '計算ビギナー' },
  { min: 5, title: '数の探検家' },
  { min: 8, title: '計算名人' },
  { min: 12, title: '方程式マスター' },
  { min: 16, title: '数学の賢者' },
  { min: 20, title: '数の魔術師' },
  { min: 25, title: 'グランドマスター' },
  { min: 30, title: '数の神' },
];

export function titleForLevel(level: number): string {
  let t = TITLES[0].title;
  for (const e of TITLES) if (level >= e.min) t = e.title;
  return t;
}

export function levelFromXp(xp: number): LevelInfo {
  let level = 1;
  while (cumulativeXpForLevel(level + 1) <= xp && level < 999) level++;
  const totalForCurrent = cumulativeXpForLevel(level);
  const totalForNext = cumulativeXpForLevel(level + 1);
  const xpInto = xp - totalForCurrent;
  const xpForNext = totalForNext - totalForCurrent;
  return { level, title: titleForLevel(level), xpInto, xpForNext, progress: xpForNext > 0 ? xpInto / xpForNext : 1, totalForCurrent };
}

// 1回のゲームで得るXP: 正解数×(段階+1)×5 + 全問正解ボーナス
export function xpForResult(correct: number, total: number, tierIndex: number): number {
  const base = correct * (tierIndex + 1) * 5;
  const perfect = correct === total && total > 0 ? (tierIndex + 1) * 10 : 0;
  return base + perfect;
}

// ===== デイリーボーナス =====
export function todayStr(now = new Date()): string {
  const y = now.getFullYear(), m = String(now.getMonth() + 1).padStart(2, '0'), d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}
function dayDiff(a: string, b: string): number {
  const pa = a.split('-').map(Number), pb = b.split('-').map(Number);
  if (pa.length !== 3 || pb.length !== 3) return 999;
  const da = Date.UTC(pa[0], pa[1] - 1, pa[2]), db = Date.UTC(pb[0], pb[1] - 1, pb[2]);
  return Math.round((db - da) / 86400000);
}
export function canClaimDaily(d: RewardData, now = new Date()): boolean {
  return d.lastClaim !== todayStr(now);
}
export function dailyBonusAmount(streak: number): number {
  // 連続日数が増えるほど増える（上限あり）。1日目50, 以降+30, 最大250。
  return Math.min(250, 50 + Math.max(0, streak - 1) * 30);
}
export interface DailyResult { data: RewardData; amount: number; streak: number; alreadyClaimed: boolean; }
export function claimDaily(d: RewardData, now = new Date()): DailyResult {
  const today = todayStr(now);
  if (d.lastClaim === today) return { data: d, amount: 0, streak: d.streak, alreadyClaimed: true };
  const diff = d.lastClaim ? dayDiff(d.lastClaim, today) : 999;
  const newStreak = diff === 1 ? d.streak + 1 : 1;
  const amount = dailyBonusAmount(newStreak);
  return { data: { ...d, coins: d.coins + amount, streak: newStreak, lastClaim: today }, amount, streak: newStreak, alreadyClaimed: false };
}

// ===== ガチャ =====
const rarityIdx = (r: Rarity) => RARITY_ORDER.indexOf(r);
function pickFrom(pool: Sticker[]): Sticker {
  const totalW = pool.reduce((s, st) => s + Math.max(0.0001, RARITY[st.rarity].weight), 0);
  let r = Math.random() * totalW;
  for (const st of pool) { r -= Math.max(0.0001, RARITY[st.rarity].weight); if (r <= 0) return st; }
  return pool[pool.length - 1];
}
function rollOne(): Sticker {
  // まず ??? (X) を極小確率で抽選。外れたら N/U/R/E/S を重み付き抽選。
  const xs = STICKERS.filter(s => s.rarity === 'X');
  if (xs.length && Math.random() < X_CHANCE) return xs[Math.floor(Math.random() * xs.length)];
  return pickFrom(STICKERS.filter(s => s.rarity !== 'X'));
}
function rollAtLeast(minRarity: Rarity): Sticker {
  const minIdx = rarityIdx(minRarity);
  // 保証枠は X を除外し、min以上〜S から抽選（X は保証には使わない）
  const pool = STICKERS.filter(s => s.rarity !== 'X' && rarityIdx(s.rarity) >= minIdx);
  return pool.length ? pickFrom(pool) : rollOne();
}

export interface PullResult { data: RewardData; sticker: Sticker; isNew: boolean; refund: number; }

export function pullGacha(data: RewardData): PullResult | null {
  if (data.coins < GACHA_COST) return null;
  const chosen = rollOne();
  const stickers = { ...data.stickers };
  const isNew = !stickers[chosen.id];
  stickers[chosen.id] = (stickers[chosen.id] || 0) + 1;
  const refund = isNew ? 0 : DUP_REFUND;
  return { data: { ...data, coins: data.coins - GACHA_COST + refund, stickers }, sticker: chosen, isNew, refund };
}

export interface MultiPullResult { data: RewardData; items: { sticker: Sticker; isNew: boolean }[]; refund: number; newCount: number; bestRarity: Rarity; }

// 10連: レア(R)以上1枚保証。コインは TEN_PULL_COST、かぶりは都度返金。
export function pullGachaMulti(data: RewardData): MultiPullResult | null {
  if (data.coins < TEN_PULL_COST) return null;
  const rolls: Sticker[] = [];
  for (let i = 0; i < 10; i++) rolls.push(rollOne());
  const rIdx = rarityIdx('R');
  if (!rolls.some(s => rarityIdx(s.rarity) >= rIdx)) rolls[9] = rollAtLeast('R'); // R以上保証
  const stickers = { ...data.stickers };
  const items: { sticker: Sticker; isNew: boolean }[] = [];
  let refund = 0, newCount = 0, bestIdx = 0;
  for (const s of rolls) {
    const isNew = !stickers[s.id];
    stickers[s.id] = (stickers[s.id] || 0) + 1;
    if (isNew) newCount++; else refund += DUP_REFUND;
    items.push({ sticker: s, isNew });
    bestIdx = Math.max(bestIdx, rarityIdx(s.rarity));
  }
  return { data: { ...data, coins: data.coins - TEN_PULL_COST + refund, stickers }, items, refund, newCount, bestRarity: RARITY_ORDER[bestIdx] };
}

export function collectedCount(data: RewardData): number {
  return STICKERS.filter(s => data.stickers[s.id]).length;
}
export function isComplete(data: RewardData): boolean {
  return collectedCount(data) >= STICKERS.length;
}

// ===== スコア履歴（localStorage） =====
export interface ScoreRec { id?: string; difficulty: string; correctCount: number; totalQuestions: number; createdAt: number; bestCombo?: number; }
function scoreKey(uid: string) { return `mathquest:scores:${uid || 'guest'}`; }
export function getScoresLocal(uid: string): ScoreRec[] {
  try { const raw = localStorage.getItem(scoreKey(uid)); if (raw) { const a = JSON.parse(raw); return Array.isArray(a) ? a : []; } } catch { /* ignore */ }
  return [];
}
export function saveScoreLocal(uid: string, rec: ScoreRec) {
  try { const arr = getScoresLocal(uid); arr.unshift(rec); localStorage.setItem(scoreKey(uid), JSON.stringify(arr.slice(0, 100))); } catch { /* ignore */ }
}

// ===== sfx =====
let ctx: AudioContext | null = null;
function ac(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  try {
    if (!ctx) {
      const AC = window.AudioContext || (window as any).webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
    }
    if (ctx.state === 'suspended') ctx.resume().catch(() => {});
    return ctx;
  } catch { return null; }
}

const MUTE_KEY = 'mathquest:muted';
let muted = (() => { try { return localStorage.getItem(MUTE_KEY) === '1'; } catch { return false; } })();
function isMuted(): boolean { return muted; }
function setMuted(v: boolean) { muted = v; try { localStorage.setItem(MUTE_KEY, v ? '1' : '0'); } catch { /* ignore */ } }

/** 単純なトーン。type/周波数/長さ/音量/開始ディレイ/簡易エンベロープ */
function tone(freq: number, dur: number, opts: { type?: OscillatorType; gain?: number; delay?: number; sweepTo?: number } = {}) {
  const c = ac(); if (!c || muted) return;
  const t0 = c.currentTime + (opts.delay || 0);
  const osc = c.createOscillator();
  const g = c.createGain();
  osc.type = opts.type || 'sine';
  osc.frequency.setValueAtTime(freq, t0);
  if (opts.sweepTo) osc.frequency.exponentialRampToValueAtTime(Math.max(1, opts.sweepTo), t0 + dur);
  const peak = opts.gain ?? 0.18;
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(peak, t0 + 0.012);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  osc.connect(g); g.connect(c.destination);
  osc.start(t0); osc.stop(t0 + dur + 0.02);
}

function noise(dur: number, gain = 0.15, delay = 0) {
  const c = ac(); if (!c || muted) return;
  const t0 = c.currentTime + delay;
  const n = Math.floor(c.sampleRate * dur);
  const buf = c.createBuffer(1, n, c.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < n; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / n);
  const src = c.createBufferSource(); src.buffer = buf;
  const g = c.createGain(); g.gain.setValueAtTime(gain, t0); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  const hp = c.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 900;
  src.connect(hp); hp.connect(g); g.connect(c.destination);
  src.start(t0); src.stop(t0 + dur);
}

/** iOS/Chrome の自動再生ポリシー対策: 最初のユーザー操作で解錠 */
function unlock() { const c = ac(); if (c && c.state === 'suspended') c.resume().catch(() => {}); }

export const sfx = {
  isMuted, setMuted, unlock,
  click: () => tone(320, 0.05, { type: 'triangle', gain: 0.08 }),
  correct: () => { tone(660, 0.12, { type: 'triangle', gain: 0.16 }); tone(880, 0.16, { type: 'triangle', gain: 0.16, delay: 0.09 }); tone(1320, 0.2, { type: 'sine', gain: 0.12, delay: 0.18 }); },
  wrong: () => { tone(200, 0.22, { type: 'sawtooth', gain: 0.12, sweepTo: 110 }); },
  coin: () => { tone(1200, 0.08, { type: 'square', gain: 0.1 }); tone(1600, 0.12, { type: 'square', gain: 0.1, delay: 0.06 }); },
  tick: () => tone(880, 0.04, { type: 'sine', gain: 0.05 }),
  timeout: () => { tone(440, 0.14, { type: 'sine', gain: 0.12, sweepTo: 180 }); },
  combo: (level: number) => tone(520 + level * 90, 0.1, { type: 'triangle', gain: 0.13 }),
  levelup: () => { [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.18, { type: 'triangle', gain: 0.15, delay: i * 0.1 })); },
  gachaSpin: () => { for (let i = 0; i < 10; i++) tone(400 + i * 60, 0.05, { type: 'square', gain: 0.06, delay: i * 0.06 }); },
  complete: () => { [659, 784, 988, 1319].forEach((f, i) => tone(f, 0.22, { type: 'sine', gain: 0.16, delay: i * 0.11 })); },
  reveal: (r: Rarity) => {
    if (r === 'X') { noise(0.5, 0.14); [784, 1047, 1319, 1568, 2093, 2637].forEach((f, i) => tone(f, 0.34, { type: 'triangle', gain: 0.17, delay: i * 0.08 })); }
    else if (r === 'S') { noise(0.35, 0.12); [784, 988, 1175, 1568, 2093].forEach((f, i) => tone(f, 0.3, { type: 'triangle', gain: 0.16, delay: i * 0.09 })); }
    else if (r === 'E') { [659, 988, 1319].forEach((f, i) => tone(f, 0.24, { type: 'triangle', gain: 0.15, delay: i * 0.1 })); }
    else if (r === 'R') { tone(659, 0.16, { type: 'triangle', gain: 0.14 }); tone(988, 0.2, { type: 'triangle', gain: 0.14, delay: 0.1 }); }
    else { tone(523, 0.14, { type: 'sine', gain: 0.12 }); }
  },
};

// ===== problemSource =====
export interface SourcedProblem { problem: Problem; source: 'ai' | 'local'; }

export interface GetOpts {
  useAI?: boolean;
  timeoutMs?: number;
  fetchImpl?: typeof fetch;
  signatureOf?: (p: Problem) => string;
}

const SEEN_PREFIX = 'mathquest:seen:';
const DEFAULT_TIMEOUT_MS = 7000;
const SEEN_LIMIT = 300;
const LOCAL_ATTEMPTS = 20;

type StorageLike = Pick<Storage, 'getItem' | 'setItem' | 'removeItem' | 'key' | 'length'>;

function storage(): StorageLike | null {
  try {
    return (globalThis as { localStorage?: StorageLike }).localStorage ?? null;
  } catch {
    return null;
  }
}

function seenKey(difficulty: string): string {
  return `${SEEN_PREFIX}${difficulty}`;
}

function readSeen(difficulty: string): string[] {
  try {
    const raw = storage()?.getItem(seenKey(difficulty));
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((value): value is string => typeof value === 'string' && value.length > 0);
  } catch {
    return [];
  }
}

function writeSeen(difficulty: string, values: string[]): void {
  try {
    storage()?.setItem(seenKey(difficulty), JSON.stringify(values));
  } catch {
    // localStorage may be unavailable or full. Repetition prevention is best-effort.
  }
}

function normalizeProblemText(value: string): string {
  return String(value)
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[ \t\r\n\u3000]+/g, '')
    .replace(/[－−―ー]/g, '-')
    .replace(/？/g, '?')
    .replace(/＝/g, '=')
    .trim();
}

export function problemSignature(p: Problem): string {
  return `problem:${normalizeProblemText(p.problem ?? '')}`;
}

export function isSeen(difficulty: string, sig: string): boolean {
  if (!sig) return false;
  return readSeen(difficulty).includes(sig);
}

export function markSeen(difficulty: string, sig: string): void {
  if (!sig) return;
  const next = readSeen(difficulty).filter(value => value !== sig);
  next.push(sig);
  while (next.length > SEEN_LIMIT) next.shift();
  writeSeen(difficulty, next);
}

export function clearSeen(difficulty?: string): void {
  const store = storage();
  if (!store) return;

  try {
    if (typeof difficulty === 'string') {
      store.removeItem(seenKey(difficulty));
      return;
    }

    const keys: string[] = [];
    for (let i = 0; i < store.length; i += 1) {
      const key = store.key(i);
      if (key?.startsWith(SEEN_PREFIX)) keys.push(key);
    }
    for (const key of keys) store.removeItem(key);
  } catch {
    // Ignore malformed or unavailable storage implementations.
  }
}

export function seenCount(difficulty: string): number {
  return new Set(readSeen(difficulty)).size;
}

function safeSignature(p: Problem, signatureOf: (p: Problem) => string): string {
  try {
    const sig = signatureOf(p);
    return typeof sig === 'string' ? sig : problemSignature(p);
  } catch {
    return problemSignature(p);
  }
}

function hasBadToken(value: string): boolean {
  return /(NaN|undefined)/i.test(value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

// AIの答えが「生徒が入力できる短い1つの値」かを判定。かな/漢字・複数値・LaTeX・長すぎる答えは不可。
const JP_RE = /[぀-ヿ一-鿿]/; // ひらがな・カタカナ・漢字
function isTypeableSolution(s: string): boolean {
  const t = s.trim();
  if (t.length === 0 || t.length > 24) return false;
  if (JP_RE.test(t)) return false;                            // かな・カナ・漢字を含む答えは入力困難
  if (/[,、;；]/.test(t)) return false;                       // 複数値
  if (/[$\\]/.test(t) || /[a-zA-Z]{3,}/.test(t)) return false; // LaTeX/英単語
  return true;
}

function validProblem(value: unknown): Problem | null {
  if (!isRecord(value)) return null;

  const problem = value.problem;
  const solution = value.solution;
  const explanation = value.explanation;
  if (typeof problem !== 'string' || problem.trim().length === 0) return null;
  if (typeof solution !== 'string' || solution.trim().length === 0) return null;
  if (typeof explanation !== 'string' || explanation.trim().length === 0) return null;
  if (hasBadToken(problem) || hasBadToken(solution) || hasBadToken(explanation)) return null;
  if (/[$\\]|\\frac|\\sqrt/.test(problem)) return null;   // LaTeX混入問題は不採用（表示崩れ防止）
  if (!isTypeableSolution(solution)) return null;          // 入力不能な答えは不採用→localへ
  if (!checkAnswer(solution, solution)) return null;

  return { problem, solution, explanation };
}

function timeoutValue(value: number | undefined): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) return DEFAULT_TIMEOUT_MS;
  return value;
}

async function fetchAIProblem(difficulty: string, opts: GetOpts): Promise<Problem | null> {
  const fetchImpl = opts.fetchImpl ?? (globalThis as { fetch?: typeof fetch }).fetch;
  if (typeof fetchImpl !== 'function') return null;

  const controller = typeof AbortController === 'function' ? new AbortController() : null;
  const timeoutMs = timeoutValue(opts.timeoutMs);
  const url = `/api/problem?difficulty=${encodeURIComponent(difficulty)}`;
  let timer: ReturnType<typeof setTimeout> | undefined;

  const request = (async (): Promise<Problem | null> => {
    const init: RequestInit = controller ? { signal: controller.signal } : {};
    const response = await fetchImpl(url, init);
    if ('ok' in response && response.ok === false) return null;
    return validProblem(await response.json());
  })().catch(() => null);

  const timeout = new Promise<null>(resolve => {
    timer = setTimeout(() => {
      try {
        controller?.abort();
      } catch {
        // AbortController can be absent or already settled.
      }
      resolve(null);
    }, timeoutMs);
  });

  try {
    return await Promise.race([request, timeout]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

function emergencyProblem(): Problem {
  return {
    problem: '0 + 0 = ?',
    solution: '0',
    explanation: '0 + 0 = 0 です。',
  };
}

function localProblem(difficulty: string, signatureOf: (p: Problem) => string): Problem {
  const recent = readSeen(difficulty);
  let fallback: Problem | null = null;

  for (let i = 0; i < LOCAL_ATTEMPTS; i += 1) {
    const candidate = generateProblem(difficulty, recent);
    fallback = candidate;
    if (!isSeen(difficulty, safeSignature(candidate, signatureOf))) return candidate;
  }

  return fallback ?? emergencyProblem();
}

export async function getProblem(difficulty: string, opts: GetOpts = {}): Promise<SourcedProblem> {
  const signatureOf = opts.signatureOf ?? problemSignature;

  if (opts.useAI) {
    try {
      const aiProblem = await fetchAIProblem(difficulty, opts);
      if (aiProblem) {
        const sig = safeSignature(aiProblem, signatureOf);
        if (!isSeen(difficulty, sig)) {
          markSeen(difficulty, sig);
          return { problem: aiProblem, source: 'ai' };
        }
      }
    } catch {
      // AI mode must never prevent local generation.
    }
  }

  try {
    const problem = localProblem(difficulty, signatureOf);
    markSeen(difficulty, safeSignature(problem, signatureOf));
    return { problem, source: 'local' };
  } catch {
    const problem = emergencyProblem();
    markSeen(difficulty, safeSignature(problem, signatureOf));
    return { problem, source: 'local' };
  }
}

// ============================================================================

// ============================================================================
// 以下は元 src/reviewDeck.ts / src/achievements.ts をインライン化したもの
// （storage/StorageLike は既存 problemSource と衝突するためリネーム済み）
// ============================================================================

// ===== reviewDeck =====
export interface ReviewItem {
  id: string;
  problem: string;
  solution: string;
  explanation: string;
  difficulty: string;
  wrongCount: number;
  correctStreak: number;
  addedAt: number;
  lastSeenAt: number;
}

export const MASTER_STREAK: number = 2;
export const DECK_LIMIT: number = 100;

interface RdStorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

const REVIEW_PREFIX = 'mathquest:review:';
const MASTERED_PREFIX = 'mathquest:reviewMastered:';
const MAX_COUNT = Number.MAX_SAFE_INTEGER;

function rdStorage(): RdStorageLike | null {
  try {
    return (globalThis as { localStorage?: RdStorageLike }).localStorage ?? null;
  } catch {
    return null;
  }
}

function reviewKey(uid: string): string {
  return `${REVIEW_PREFIX}${uid}`;
}

function masteredKey(uid: string): string {
  return `${MASTERED_PREFIX}${uid}`;
}

function safeCount(value: unknown, fallback = 0): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) return fallback;
  return Math.min(MAX_COUNT, Math.floor(value));
}

function safeTime(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function currentTime(now?: number): number {
  if (typeof now === 'number' && Number.isFinite(now)) return now;
  try {
    const value = Date.now();
    return Number.isFinite(value) ? value : 0;
  } catch {
    return 0;
  }
}

function increment(value: number): number {
  return value >= MAX_COUNT ? MAX_COUNT : value + 1;
}

/** Stable 64-bit FNV-1a key over the problem's UTF-16 code units. */
function problemId(problem: string): string {
  let hash = 0xcbf29ce484222325n;
  const prime = 0x100000001b3n;
  for (let index = 0; index < problem.length; index += 1) {
    hash ^= BigInt(problem.charCodeAt(index));
    hash = BigInt.asUintN(64, hash * prime);
  }
  return `review-${hash.toString(36)}-${problem.length.toString(36)}`;
}

function compareNumber(left: number, right: number): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function trimToLimit(items: ReviewItem[]): ReviewItem[] {
  const excess = items.length - DECK_LIMIT;
  if (excess <= 0) return items;

  const indexes = items.map((_, index) => index);
  indexes.sort((leftIndex, rightIndex) => {
    const left = items[leftIndex];
    const right = items[rightIndex];
    return (
      compareNumber(left.wrongCount, right.wrongCount) ||
      compareNumber(left.addedAt, right.addedAt) ||
      compareNumber(left.lastSeenAt, right.lastSeenAt) ||
      left.id.localeCompare(right.id)
    );
  });

  const discarded = new Set(indexes.slice(0, excess));
  return items.filter((_, index) => !discarded.has(index));
}

function parseItem(value: unknown): ReviewItem | null {
  if (typeof value !== 'object' || value === null) return null;
  const data = value as Record<string, unknown>;
  if (
    typeof data.problem !== 'string' ||
    typeof data.solution !== 'string' ||
    typeof data.explanation !== 'string' ||
    typeof data.difficulty !== 'string'
  ) {
    return null;
  }

  const addedAt = safeTime(data.addedAt, 0);
  return {
    id: problemId(data.problem),
    problem: data.problem,
    solution: data.solution,
    explanation: data.explanation,
    difficulty: data.difficulty,
    wrongCount: Math.max(1, safeCount(data.wrongCount, 1)),
    correctStreak: Math.min(MASTER_STREAK - 1, safeCount(data.correctStreak)),
    addedAt,
    lastSeenAt: safeTime(data.lastSeenAt, addedAt),
  };
}

function readDeck(uid: string): ReviewItem[] {
  try {
    const raw = rdStorage()?.getItem(reviewKey(uid));
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];

    const items: ReviewItem[] = [];
    const seenProblems = new Set<string>();
    for (const value of parsed) {
      const item = parseItem(value);
      if (item && !seenProblems.has(item.problem)) {
        seenProblems.add(item.problem);
        items.push(item);
      }
    }
    return trimToLimit(items);
  } catch {
    return [];
  }
}

function writeDeck(uid: string, items: ReviewItem[]): void {
  try {
    rdStorage()?.setItem(reviewKey(uid), JSON.stringify(trimToLimit(items)));
  } catch {
    // Storage can be unavailable, blocked, or full. Persistence is best-effort.
  }
}

function writeMasteredCount(uid: string, value: number): void {
  try {
    rdStorage()?.setItem(masteredKey(uid), String(safeCount(value)));
  } catch {
    // Storage can be unavailable, blocked, or full. Persistence is best-effort.
  }
}

export function addWrong(
  uid: string,
  p: { problem: string; solution: string; explanation: string; difficulty: string },
  now?: number,
): void {
  try {
    const problem = typeof p.problem === 'string' ? p.problem : '';
    const seenAt = currentTime(now);
    const items = readDeck(uid);
    const existing = items.find((item) => item.problem === problem);

    if (existing) {
      existing.wrongCount = increment(existing.wrongCount);
      existing.correctStreak = 0;
      existing.lastSeenAt = seenAt;
    } else {
      items.push({
        id: problemId(problem),
        problem,
        solution: typeof p.solution === 'string' ? p.solution : '',
        explanation: typeof p.explanation === 'string' ? p.explanation : '',
        difficulty: typeof p.difficulty === 'string' ? p.difficulty : '',
        wrongCount: 1,
        correctStreak: 0,
        addedAt: seenAt,
        lastSeenAt: seenAt,
      });
    }

    writeDeck(uid, trimToLimit(items));
  } catch {
    // Invalid runtime input or rdStorage errors must never escape this boundary.
  }
}

export function recordReviewResult(
  uid: string,
  id: string,
  correct: boolean,
  now?: number,
): { mastered: boolean; remaining: number } {
  try {
    const items = readDeck(uid);
    const index = items.findIndex((item) => item.id === id);
    if (index < 0) return { mastered: false, remaining: items.length };

    const item = items[index];
    item.lastSeenAt = currentTime(now);
    if (!correct) {
      item.correctStreak = 0;
      item.wrongCount = increment(item.wrongCount);
      writeDeck(uid, items);
      return { mastered: false, remaining: items.length };
    }

    item.correctStreak = increment(item.correctStreak);
    if (item.correctStreak < MASTER_STREAK) {
      writeDeck(uid, items);
      return { mastered: false, remaining: items.length };
    }

    items.splice(index, 1);
    writeDeck(uid, items);
    writeMasteredCount(uid, increment(getMasteredCount(uid)));
    return { mastered: true, remaining: items.length };
  } catch {
    return { mastered: false, remaining: getDeckSize(uid) };
  }
}

export function getDeck(uid: string): ReviewItem[] {
  try {
    return readDeck(uid).sort((left, right) => (
      compareNumber(right.wrongCount, left.wrongCount) ||
      compareNumber(left.addedAt, right.addedAt)
    ));
  } catch {
    return [];
  }
}

export function getDeckSize(uid: string): number {
  try {
    return getDeck(uid).length;
  } catch {
    return 0;
  }
}

export function getMasteredCount(uid: string): number {
  try {
    const raw = rdStorage()?.getItem(masteredKey(uid));
    if (raw === null || raw === undefined || raw.trim() === '') return 0;
    return safeCount(Number(raw));
  } catch {
    return 0;
  }
}

export function clearDeck(uid: string): void {
  try {
    rdStorage()?.removeItem(reviewKey(uid));
  } catch {
    // Clearing an unavailable rdStorage backend is a no-op.
  }
}

// ===== achievements =====
export interface AchStats {
  totalCorrect: number;
  totalPlayed: number;
  perfectGames: number;
  bestCombo: number;
  level: number;
  stickersCollected: number;
  stickersTotal: number;
  masteredReviews: number;
  dailyStreak: number;
}

export type AchTier = 'bronze' | 'silver' | 'gold' | 'platinum';

export interface Achievement {
  id: string;
  name: string;
  desc: string;
  icon: string;
  tier: AchTier;
  check: (s: AchStats) => boolean;
  progress: (s: AchStats) => { cur: number; goal: number };
}

interface AcStorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}
type NumericStat = keyof AchStats;

const ACHIEVEMENT_PREFIX = 'mathquest:achv:';
const MAX_VALUE = Number.MAX_SAFE_INTEGER;

function acStorage(): AcStorageLike | null {
  try {
    return (globalThis as { localStorage?: AcStorageLike }).localStorage ?? null;
  } catch {
    return null;
  }
}

function achievementKey(uid: string): string {
  return `${ACHIEVEMENT_PREFIX}${uid}`;
}

function finiteStat(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) return 0;
  return Math.min(MAX_VALUE, Math.floor(value));
}

function stat(stats: AchStats, key: NumericStat): number {
  try {
    return finiteStat(stats?.[key]);
  } catch {
    return 0;
  }
}

function boundedProgress(current: unknown, target: unknown): { cur: number; goal: number } {
  const goal = Math.max(1, finiteStat(target));
  return { cur: Math.min(finiteStat(current), goal), goal };
}

function thresholdAchievement(
  id: string,
  name: string,
  desc: string,
  icon: string,
  tier: AchTier,
  key: NumericStat,
  goal: number,
): Achievement {
  return {
    id,
    name,
    desc,
    icon,
    tier,
    check: (stats) => stat(stats, key) >= goal,
    progress: (stats) => boundedProgress(stat(stats, key), goal),
  };
}

const stickersHalf: Achievement = {
  id: 'stickers_half',
  name: 'シールコレクター',
  desc: 'シールを全種類の半分集める',
  icon: '🧩',
  tier: 'silver',
  check: (stats) => {
    const total = stat(stats, 'stickersTotal');
    return total > 0 && stat(stats, 'stickersCollected') >= Math.ceil(total / 2);
  },
  progress: (stats) => {
    const total = stat(stats, 'stickersTotal');
    return boundedProgress(stat(stats, 'stickersCollected'), Math.max(1, Math.ceil(total / 2)));
  },
};

const stickersComplete: Achievement = {
  id: 'stickers_complete',
  name: 'シールマスター',
  desc: 'シールを全種類コンプリートする',
  icon: '🌟',
  tier: 'platinum',
  check: (stats) => {
    const total = stat(stats, 'stickersTotal');
    return total > 0 && stat(stats, 'stickersCollected') >= total;
  },
  progress: (stats) => {
    const total = stat(stats, 'stickersTotal');
    return boundedProgress(stat(stats, 'stickersCollected'), Math.max(1, total));
  },
};

export const ACHIEVEMENTS: Achievement[] = [
  thresholdAchievement('first_correct', 'はじめの一歩', 'はじめて問題に正解する', '🌱', 'bronze', 'totalCorrect', 1),
  thresholdAchievement('correct_50', 'かけだし学者', '累計50問に正解する', '✏️', 'silver', 'totalCorrect', 50),
  thresholdAchievement('correct_200', '数学探究者', '累計200問に正解する', '📚', 'gold', 'totalCorrect', 200),
  thresholdAchievement('correct_1000', '千問の賢者', '累計1000問に正解する', '👑', 'platinum', 'totalCorrect', 1000),
  thresholdAchievement('played_100', '百戦錬磨', '累計100問に挑戦する', '🧭', 'silver', 'totalPlayed', 100),
  thresholdAchievement('combo_5', '集中モード', '最高コンボ5を達成する', '🔥', 'bronze', 'bestCombo', 5),
  thresholdAchievement('combo_10', 'ひらめき連鎖', '最高コンボ10を達成する', '⚡', 'silver', 'bestCombo', 10),
  thresholdAchievement('level_5', '成長の階段', 'レベル5に到達する', '🪜', 'bronze', 'level', 5),
  thresholdAchievement('level_10', '知識の塔', 'レベル10に到達する', '🏛️', 'gold', 'level', 10),
  thresholdAchievement('level_20', '知恵の頂', 'レベル20に到達する', '🏰', 'platinum', 'level', 20),
  thresholdAchievement('perfect_1', '初パーフェクト', '全問正解のゲームを1回達成する', '💯', 'bronze', 'perfectGames', 1),
  thresholdAchievement('perfect_10', '完全無欠', '全問正解のゲームを10回達成する', '🎯', 'gold', 'perfectGames', 10),
  stickersHalf,
  stickersComplete,
  thresholdAchievement('review_master_10', '復習名人', '復習問題を10問卒業する', '🔁', 'silver', 'masteredReviews', 10),
  thresholdAchievement('daily_7', '一週間の冒険', '7日連続でログインする', '📅', 'gold', 'dailyStreak', 7),
];

export function evaluateAll(s: AchStats): Record<string, boolean> {
  const result: Record<string, boolean> = {};
  for (const achievement of ACHIEVEMENTS) {
    try {
      result[achievement.id] = achievement.check(s) === true;
    } catch {
      result[achievement.id] = false;
    }
  }
  return result;
}

export function loadUnlocked(uid: string): string[] {
  try {
    const raw = acStorage()?.getItem(achievementKey(uid));
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];

    const unique = new Set<string>();
    for (const value of parsed) {
      if (typeof value === 'string' && value.length > 0) unique.add(value);
    }
    return [...unique];
  } catch {
    return [];
  }
}

export function saveUnlocked(uid: string, ids: string[]): void {
  try {
    const unique = new Set<string>();
    if (Array.isArray(ids)) {
      for (const id of ids) {
        if (typeof id === 'string' && id.length > 0) unique.add(id);
      }
    }
    acStorage()?.setItem(achievementKey(uid), JSON.stringify([...unique]));
  } catch {
    // Storage can be unavailable, blocked, or full. Persistence is best-effort.
  }
}

export function checkNewUnlocks(uid: string, s: AchStats): Achievement[] {
  try {
    const unlocked = loadUnlocked(uid);
    const known = new Set(unlocked);
    const newlyUnlocked = ACHIEVEMENTS.filter((achievement) => (
      !known.has(achievement.id) && achievement.check(s) === true
    ));

    if (newlyUnlocked.length > 0) {
      saveUnlocked(uid, [...unlocked, ...newlyUnlocked.map((achievement) => achievement.id)]);
    }
    return newlyUnlocked;
  } catch {
    return [];
  }
}

// ============================================================================
const QUESTION_COUNTS = [3, 5, 10];
// エピック以上(E/S/X)を「高レア」として演出（紙吹雪・グロー・ホロ）を強める
const isHiRarity = (r: Rarity) => RARITY_ORDER.indexOf(r) >= RARITY_ORDER.indexOf('E');
// 段階別の制限時間（秒）。時間切れでも失敗せず、スピードボーナスが0になるだけ。
const TIME_LIMIT = [25, 30, 40, 50, 60];

type GameState = 'menu' | 'playing' | 'explanation' | 'result' | 'scores' | 'gacha' | 'album' | 'achievements';
interface QLog { problem: string; solution: string; userAnswer: string; correct: boolean; }
interface QEarn { coins: number; base: number; mult: number; speed: number; combo: number; timeFrac: number; }

const tierIndexOf = (id: string) => Math.max(0, DIFFICULTIES.findIndex(d => d.id === id));

// ===== 補助コンポーネント =====

/** 円形タイマー */
function TimerRing({ frac, seconds }: { frac: number; seconds: number }) {
  const R = 26, C = 2 * Math.PI * R;
  const col = frac > 0.5 ? '#22c55e' : frac > 0.25 ? '#f59e0b' : '#ef4444';
  return (
    <div className="relative w-16 h-16 shrink-0">
      <svg width="64" height="64" className="-rotate-90">
        <circle cx="32" cy="32" r={R} fill="none" stroke="#e2e8f0" strokeWidth="6" />
        <circle cx="32" cy="32" r={R} fill="none" stroke={col} strokeWidth="6" strokeLinecap="round"
          strokeDasharray={C} strokeDashoffset={C * (1 - frac)} style={{ transition: 'stroke-dashoffset 0.1s linear, stroke 0.3s' }} />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center font-black tabular-nums text-slate-700" style={{ color: frac <= 0.25 ? col : undefined }}>
        {Math.ceil(seconds)}
      </div>
    </div>
  );
}

/** 正解時などの紙吹雪バースト */
function Confetti({ fire }: { fire: number }) {
  const COLORS = ['#3b82f6', '#22c55e', '#f59e0b', '#ef4444', '#a855f7', '#ec4899'];
  const pieces = Array.from({ length: 28 }, (_, i) => i);
  return (
    <AnimatePresence>
      {fire > 0 && (
        <div key={fire} className="pointer-events-none fixed inset-0 z-50 overflow-hidden">
          {pieces.map(i => {
            const angle = (i / pieces.length) * Math.PI * 2;
            const dist = 120 + Math.random() * 220;
            const dx = Math.cos(angle) * dist, dy = Math.sin(angle) * dist - 80;
            return (
              <motion.div key={i}
                initial={{ opacity: 1, x: 0, y: 0, scale: 1, rotate: 0 }}
                animate={{ opacity: 0, x: dx, y: dy + 300, scale: 0.6, rotate: Math.random() * 720 - 360 }}
                transition={{ duration: 1.1 + Math.random() * 0.5, ease: 'easeOut' }}
                style={{ position: 'absolute', left: '50%', top: '42%', width: 10, height: 14, borderRadius: 2, background: COLORS[i % COLORS.length] }} />
            );
          })}
        </div>
      )}
    </AnimatePresence>
  );
}

/** レベルバッジ + XPバー（ヘッダー用） */
function LevelBadge({ xp }: { xp: number }) {
  const info = levelFromXp(xp);
  return (
    <div className="hidden sm:flex items-center gap-2 bg-slate-900 text-white px-3 py-1.5 rounded-xl">
      <div className="flex items-center justify-center w-6 h-6 rounded-lg bg-blue-500 font-black text-xs">{info.level}</div>
      <div className="w-24">
        <div className="flex justify-between text-[10px] font-bold leading-tight"><span className="truncate max-w-[80px]">{info.title}</span></div>
        <div className="w-full bg-slate-700 h-1.5 rounded-full overflow-hidden mt-0.5">
          <div className="bg-blue-400 h-full transition-all" style={{ width: `${Math.round(info.progress * 100)}%` }} />
        </div>
      </div>
    </div>
  );
}

const cx = (...a: (string | false | undefined)[]) => a.filter(Boolean).join(' ');

// カスタム描き起こしシール絵（SVG）。無ければ絵文字にフォールバック。
function StickerImg({ img, className }: { img: string; className?: string }) {
  return <img src={img} alt="" draggable={false} className={cx('object-contain relative z-10', className)} style={{ filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.22))' }} />;
}

// ===== アプリ本体 =====
export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [gameState, setGameState] = useState<GameState>('menu');
  const [difficulty, setDifficulty] = useState('算数低');
  const [questionCount, setQuestionCount] = useState(3);
  const [problem, setProblem] = useState<Problem | null>(null);
  const [aiMode, setAiMode] = useState(false);
  const [loadingProblem, setLoadingProblem] = useState(false);
  const [probSource, setProbSource] = useState<'ai' | 'local'>('local');
  const genRef = useRef(0);

  const [currentQIndex, setCurrentQIndex] = useState(0);
  const [correctCount, setCorrectCount] = useState(0);
  const [userAnswer, setUserAnswer] = useState('');
  const [isCorrect, setIsCorrect] = useState(false);
  const [combo, setCombo] = useState(0);
  const [bestCombo, setBestCombo] = useState(0);
  const [qLog, setQLog] = useState<QLog[]>([]);
  const [qEarn, setQEarn] = useState<QEarn | null>(null);

  const [gameCoins, setGameCoins] = useState(0);
  const [earnedCoins, setEarnedCoins] = useState(0);
  const [perfectBonusCoins, setPerfectBonusCoins] = useState(0);
  const [xpGained, setXpGained] = useState(0);
  const [leveledUp, setLeveledUp] = useState<number | null>(null);
  const [scores, setScores] = useState<ScoreRec[]>([]);

  const [reward, setReward] = useState<RewardData>({ coins: 0, stickers: {}, xp: 0, streak: 0, lastClaim: '', bestCombo: 0, totalCorrect: 0, totalPlayed: 0, perfectGames: 0 });
  const [pull, setPull] = useState<PullResult | null>(null);
  const [multi, setMulti] = useState<MultiPullResult | null>(null);
  const [spinning, setSpinning] = useState(false);

  // ===== 復習モード（まちがえた問題デッキ） =====
  const [isReview, setIsReview] = useState(false);          // 復習セッション中か
  const [deckSize, setDeckSize] = useState(0);              // メニュー表示用
  const [masteredTotal, setMasteredTotal] = useState(0);    // 卒業した累計
  const [reviewMastered, setReviewMastered] = useState(0);  // 今セッションで卒業した数
  const reviewQueueRef = useRef<ReviewItem[]>([]);          // 出題キュー
  const currentReviewIdRef = useRef<string | null>(null);   // 今出している復習問題のid

  // ===== 実績 =====
  const [unlockedIds, setUnlockedIds] = useState<string[]>([]);
  const [achToast, setAchToast] = useState<Achievement | null>(null);

  // ===== AI問題のプリフェッチ（解説を読んでいる間に次を先読み） =====
  const prefetchRef = useRef<{ key: string; promise: Promise<SourcedProblem> } | null>(null);

  const [muted, setMutedState] = useState(sfx.isMuted());
  const [confetti, setConfetti] = useState(0);
  const [dailyToast, setDailyToast] = useState<{ amount: number; streak: number } | null>(null);

  // タイマー
  const [timeLeft, setTimeLeft] = useState(0);
  const deadlineRef = useRef(0);
  const limitRef = useRef(1);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastTickRef = useRef(99);

  const clearTimer = useCallback(() => { if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; } }, []);
  const startTimer = useCallback((tierIdx: number) => {
    clearTimer();
    const limit = TIME_LIMIT[tierIdx] ?? 30;
    limitRef.current = limit;
    deadlineRef.current = Date.now() + limit * 1000;
    lastTickRef.current = 99;
    setTimeLeft(limit);
    timerRef.current = setInterval(() => {
      const rem = Math.max(0, deadlineRef.current - Date.now()) / 1000;
      setTimeLeft(rem);
      const whole = Math.ceil(rem);
      if (rem > 0 && rem <= 5 && whole !== lastTickRef.current) { lastTickRef.current = whole; sfx.tick(); }
      if (rem <= 0) { clearTimer(); sfx.timeout(); }
    }, 100);
  }, [clearTimer]);

  useEffect(() => () => clearTimer(), [clearTimer]);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setAuthLoading(false);
      if (u) {
        setReward(loadReward(u.uid));
        setDeckSize(getDeckSize(u.uid));
        setMasteredTotal(getMasteredCount(u.uid));
        setUnlockedIds(loadUnlocked(u.uid));
      }
    });
    return () => unsub();
  }, []);

  // 実績の統計を今の状態から組み立てる
  const buildAchStats = useCallback((r: RewardData, mastered: number): AchStats => ({
    totalCorrect: r.totalCorrect,
    totalPlayed: r.totalPlayed,
    perfectGames: r.perfectGames,
    bestCombo: r.bestCombo,
    level: levelFromXp(r.xp).level,
    stickersCollected: collectedCount(r),
    stickersTotal: STICKERS.length,
    masteredReviews: mastered,
    dailyStreak: r.streak,
  }), []);

  // 新規解除をチェックしてトースト表示
  const runAchievementCheck = useCallback((r: RewardData, mastered: number) => {
    if (!user) return;
    const gained = checkNewUnlocks(user.uid, buildAchStats(r, mastered));
    if (gained.length > 0) {
      setUnlockedIds(loadUnlocked(user.uid));
      setAchToast(gained[0]);
      setTimeout(() => sfx.complete(), 300);
      setTimeout(() => setAchToast(null), 4200);
    }
  }, [user, buildAchStats]);

  const persistReward = useCallback((d: RewardData) => { setReward(d); if (user) saveReward(user.uid, d); }, [user]);

  const toggleMute = () => { sfx.unlock(); const m = !muted; sfx.setMuted(m); setMutedState(m); if (!m) sfx.click(); };

  const timeFracNow = () => Math.max(0, Math.min(1, (deadlineRef.current - Date.now()) / (limitRef.current * 1000)));

  const pfKey = (diff: string) => `${diff}|${aiMode ? 'ai' : 'local'}`;

  // 解説を読んでいる間に次の問題を先読みする（AIの2〜6秒の待ちを隠す）
  const startPrefetch = useCallback((diff: string) => {
    const entry: { key: string; promise: Promise<SourcedProblem>; value?: SourcedProblem } =
      { key: `${diff}|${aiMode ? 'ai' : 'local'}`, promise: getProblem(diff, { useAI: aiMode, timeoutMs: 15000 }) };
    entry.promise.then(v => { if (prefetchRef.current === entry) entry.value = v; }).catch(() => { /* ignore */ });
    prefetchRef.current = entry;
  }, [aiMode]);

  // 問題取得（数学AI or ローカル生成）。既出は自動回避。世代トークンで古い取得を破棄。先読み済みなら即座に使う。
  const loadProblem = useCallback(async (diff: string) => {
    const gen = ++genRef.current;
    clearTimer();
    const pf = prefetchRef.current;
    const hit = pf && pf.key === pfKey(diff);

    // 先読みが「解決済み」なら、ローディングを一切出さずに即出題
    if (hit && pf!.value) {
      const v = pf!.value!;
      prefetchRef.current = null;
      setProbSource(v.source);
      setProblem(v.problem);
      setLoadingProblem(false);
      startTimer(tierIndexOf(diff));
      return;
    }

    setLoadingProblem(true);
    setProblem(null);
    const p = hit ? pf!.promise : getProblem(diff, { useAI: aiMode, timeoutMs: 15000 });
    prefetchRef.current = null;
    const res = await p;
    if (gen !== genRef.current) return; // 画面遷移/次の取得に置き換えられた
    setProbSource(res.source);
    setProblem(res.problem);
    setLoadingProblem(false);
    startTimer(tierIndexOf(diff));
  }, [startTimer, clearTimer, aiMode]);

  // 復習: キューから次の問題を出す（生成しない）
  const loadReviewProblem = useCallback(() => {
    ++genRef.current;
    clearTimer();
    const item = reviewQueueRef.current.shift();
    if (!item) { currentReviewIdRef.current = null; setProblem(null); return; }
    currentReviewIdRef.current = item.id;
    setDifficulty(item.difficulty);
    setProbSource('local');
    setProblem({ problem: item.problem, solution: item.solution, explanation: item.explanation });
    setLoadingProblem(false);
    startTimer(tierIndexOf(item.difficulty));
  }, [clearTimer, startTimer]);

  const resetSession = () => {
    setCurrentQIndex(0);
    setCorrectCount(0);
    setCombo(0);
    setBestCombo(0);
    setGameCoins(0);
    setQLog([]);
    setQEarn(null);
    setUserAnswer('');
    setReviewMastered(0);
    prefetchRef.current = null;
  };

  const startGame = (selectedDiff: string, count: number) => {
    sfx.unlock(); sfx.click();
    setIsReview(false);
    reviewQueueRef.current = [];
    currentReviewIdRef.current = null;
    setDifficulty(selectedDiff);
    setQuestionCount(count);
    resetSession();
    setGameState('playing');
    loadProblem(selectedDiff);
  };

  // 復習セッション開始（まちがえた問題だけを出題）
  const startReview = () => {
    if (!user) return;
    sfx.unlock(); sfx.click();
    const deck = getDeck(user.uid);
    if (deck.length === 0) return;
    const take = Math.min(10, deck.length);
    reviewQueueRef.current = deck.slice(0, take);
    setIsReview(true);
    setQuestionCount(take);
    resetSession();
    setGameState('playing');
    loadReviewProblem();
  };

  const submitAnswer = () => {
    if (!problem) return;
    clearTimer();
    const tf = timeFracNow();
    const correct = checkAnswer(userAnswer, problem.solution);
    const tierIdx = tierIndexOf(difficulty);
    setIsCorrect(correct);

    let earn: QEarn = { coins: 0, base: baseCoinPerCorrect(tierIdx), mult: 1, speed: 0, combo, timeFrac: tf };
    if (correct) {
      const newCombo = combo + 1;
      const base = baseCoinPerCorrect(tierIdx);
      const mult = comboMultiplier(newCombo);
      const sp = speedBonus(base, tf);
      const coins = coinsForQuestion(tierIdx, newCombo, tf);
      earn = { coins, base, mult, speed: sp, combo: newCombo, timeFrac: tf };
      setCombo(newCombo);
      setBestCombo(b => Math.max(b, newCombo));
      setCorrectCount(c => c + 1);
      setGameCoins(g => g + coins);
      persistReward({ ...reward, coins: reward.coins + coins });
      sfx.correct();
      if (newCombo >= 2) { sfx.combo(newCombo); }
      setConfetti(c => c + 1);
    } else {
      setCombo(0);
      sfx.wrong();
    }
    // ── 復習デッキの更新 ──
    if (user) {
      if (isReview) {
        const id = currentReviewIdRef.current;
        if (id) {
          const r = recordReviewResult(user.uid, id, correct);
          if (r.mastered) { setReviewMastered(m => m + 1); setMasteredTotal(getMasteredCount(user.uid)); }
          setDeckSize(r.remaining);
        }
      } else if (!correct) {
        // まちがえた問題を復習デッキへ（同じ問題は重複せず誤答数が増える）
        addWrong(user.uid, { problem: problem.problem, solution: problem.solution, explanation: problem.explanation, difficulty });
        setDeckSize(getDeckSize(user.uid));
      }
    }

    setQEarn(earn);
    setQLog(l => [...l, { problem: problem.problem, solution: problem.solution, userAnswer, correct }]);
    setGameState('explanation');

    // 解説を読んでいる間に次の問題を先読み（通常モードかつ最終問題でないとき）
    if (!isReview && currentQIndex + 1 < questionCount) startPrefetch(difficulty);
  };

  const nextQuestion = () => {
    sfx.click();
    if (currentQIndex + 1 >= questionCount) {
      const tierIdx = tierIndexOf(difficulty);
      const pb = correctCount === questionCount ? perfectBonus(questionCount, tierIdx) : 0;
      const gained = xpForResult(correctCount, questionCount, tierIdx);
      const before = levelFromXp(reward.xp).level;
      const after = levelFromXp(reward.xp + gained).level;
      const newBestCombo = Math.max(reward.bestCombo, bestCombo);
      const isPerfect = correctCount === questionCount && questionCount > 0;
      setEarnedCoins(gameCoins + pb);
      setPerfectBonusCoins(pb);
      setXpGained(gained);
      setLeveledUp(after > before ? after : null);
      const next: RewardData = {
        ...reward,
        coins: reward.coins + pb,
        xp: reward.xp + gained,
        bestCombo: newBestCombo,
        totalCorrect: reward.totalCorrect + correctCount,
        totalPlayed: reward.totalPlayed + questionCount,
        perfectGames: reward.perfectGames + (isPerfect ? 1 : 0),
      };
      persistReward(next);
      if (after > before) setTimeout(() => sfx.levelup(), 400);
      if (user) saveScoreLocal(user.uid, { difficulty, correctCount, totalQuestions: questionCount, createdAt: Date.now(), bestCombo });
      // 実績の新規解除チェック（復習の卒業数も反映）
      runAchievementCheck(next, user ? getMasteredCount(user.uid) : masteredTotal);
      prefetchRef.current = null;
      setGameState('result');
    } else {
      setCurrentQIndex(i => i + 1);
      setUserAnswer('');
      setProblem(null);
      setGameState('playing');
      if (isReview) loadReviewProblem(); else loadProblem(difficulty);
    }
  };

  const viewScores = () => { sfx.click(); if (user) setScores(getScoresLocal(user.uid)); setGameState('scores'); };

  const doPull = () => {
    sfx.unlock();
    const res = pullGacha(reward);
    if (!res) return;
    setSpinning(true); setPull(null); setMulti(null); sfx.gachaSpin();
    setTimeout(() => {
      setSpinning(false);
      setPull(res);
      persistReward(res.data);
      sfx.reveal(res.sticker.rarity);
      if (isHiRarity(res.sticker.rarity)) setConfetti(c => c + 1);
    }, 650);
  };

  const doMultiPull = () => {
    sfx.unlock();
    const res = pullGachaMulti(reward);
    if (!res) return;
    setSpinning(true); setPull(null); setMulti(null); sfx.gachaSpin();
    setTimeout(() => {
      setSpinning(false);
      setMulti(res);
      persistReward(res.data);
      sfx.reveal(res.bestRarity);
      if (isHiRarity(res.bestRarity)) setConfetti(c => c + 1);
    }, 650);
  };

  const claimDailyBonus = () => {
    sfx.unlock();
    if (!canClaimDaily(reward)) return;
    const res = claimDaily(reward);
    persistReward(res.data);
    setDailyToast({ amount: res.amount, streak: res.streak });
    sfx.coin();
    setTimeout(() => setDailyToast(null), 3500);
  };

  const goMenu = () => {
    sfx.click(); genRef.current++; clearTimer(); setLoadingProblem(false);
    prefetchRef.current = null;
    setIsReview(false); reviewQueueRef.current = []; currentReviewIdRef.current = null;
    if (user) { setDeckSize(getDeckSize(user.uid)); setMasteredTotal(getMasteredCount(user.uid)); }
    setGameState('menu');
  };

  if (authLoading) {
    return <div className="min-h-screen flex items-center justify-center bg-slate-50"><Loader2 className="w-8 h-8 animate-spin text-blue-600" /></div>;
  }

  if (!user) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-4 text-slate-800">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}
          className="max-w-md w-full bg-white p-12 rounded-2xl border-2 border-slate-900 shadow-[8px_8px_0px_0px_rgba(15,23,42,1)] text-center">
          <div className="w-16 h-16 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center mx-auto mb-6"><UserIcon size={32} /></div>
          <h1 className="font-display text-5xl font-extrabold tracking-tight text-blue-600 mb-2">MATH QUEST</h1>
          <p className="text-slate-500 mb-8 font-medium">算数から大学数学まで、あなたのレベルで問題をとこう。コンボとスピードでコインを稼ぎ、レベルを上げてシールをコンプリート！</p>
          <button onClick={signInWithGoogle} className="w-full flex items-center justify-center gap-3 bg-blue-600 hover:bg-blue-700 text-white py-4 px-4 rounded-xl font-bold shadow-[4px_4px_0px_0px_rgba(15,23,42,1)] transition-all">
            Googleでログイン
          </button>
          <button onClick={signInAsGuest} className="w-full mt-3 flex items-center justify-center gap-3 bg-white hover:bg-slate-100 text-slate-800 font-bold py-3 px-4 rounded-xl border-2 border-slate-900 transition-colors">
            ゲストで遊ぶ（ログイン不要）
          </button>
        </motion.div>
      </div>
    );
  }

  const tierDesc = DIFFICULTIES.find(d => d.id === difficulty)?.desc || '';
  const lvl = levelFromXp(reward.xp);
  const timeFrac = Math.max(0, Math.min(1, timeLeft / (limitRef.current || 1)));

  return (
    <div className="min-h-screen flex flex-col text-slate-800 selection:bg-blue-200">
      <Confetti fire={confetti} />

      {/* デイリーボーナス トースト */}
      <AnimatePresence>
        {dailyToast && (
          <motion.div initial={{ opacity: 0, y: -30, scale: 0.9 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -20 }}
            className="fixed top-20 left-1/2 -translate-x-1/2 z-50 bg-white border-2 border-amber-400 rounded-2xl px-6 py-4 shadow-[6px_6px_0px_0px_rgba(245,158,11,0.6)] flex items-center gap-3">
            <Calendar className="text-amber-500" />
            <div>
              <p className="font-black text-slate-800">デイリーボーナス +{dailyToast.amount} コイン</p>
              <p className="text-xs font-bold text-amber-600">🔥 {dailyToast.streak}日 連続ログイン中！</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 実績アンロック トースト */}
      <AnimatePresence>
        {achToast && (
          <motion.div initial={{ opacity: 0, y: -30, scale: 0.85 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -20 }}
            className="fixed top-20 left-1/2 -translate-x-1/2 z-50 bg-white border-2 border-amber-500 rounded-2xl px-6 py-4 shadow-[6px_6px_0px_0px_rgba(15,23,42,1)] flex items-center gap-3">
            <span className="text-3xl">{achToast.icon}</span>
            <div>
              <p className="text-[10px] font-black text-amber-500 uppercase tracking-widest">実績かいじょ！</p>
              <p className="font-black text-slate-800">{achToast.name}</p>
              <p className="text-xs font-bold text-slate-500">{achToast.desc}</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <header className="flex justify-between items-center border-b-2 border-slate-200 px-4 sm:px-8 py-4 bg-white sticky top-0 z-20 shadow-sm">
        <h1 className="font-display text-2xl sm:text-3xl font-extrabold tracking-tight text-blue-600 cursor-pointer" onClick={goMenu}>
MATH QUEST <span className="text-slate-400 font-light text-lg font-sans">v5.0</span>
        </h1>
        <div className="flex items-center gap-2 sm:gap-4">
          <LevelBadge xp={reward.xp} />
          <div className="flex items-center gap-2 bg-amber-100 border-2 border-amber-300 text-amber-700 px-3 py-1.5 rounded-xl font-black">
            <Coins size={18} /> <span className="tabular-nums">{reward.coins}</span>
          </div>
          <button onClick={toggleMute} className="text-slate-400 hover:text-slate-900 transition-colors" title={muted ? '音を出す' : '消音'}>
            {muted ? <VolumeX size={22} /> : <Volume2 size={22} />}
          </button>
          {user.photoURL
            ? <img src={user.photoURL} alt="avatar" className="w-9 h-9 rounded-full border-2 border-slate-200 bg-gray-200 hidden sm:block" referrerPolicy="no-referrer" />
            : <div className="w-9 h-9 rounded-full border-2 border-slate-200 bg-slate-100 hidden sm:flex items-center justify-center text-slate-400"><UserIcon size={18} /></div>}
          <button onClick={signOut} className="text-slate-400 hover:text-slate-900 transition-colors"><LogOut size={22} /></button>
        </div>
      </header>

      <main className="flex-grow p-4 sm:p-8 max-w-5xl w-full mx-auto">
        {gameState === 'menu' && (
          <motion.div key="menu" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.35 }} className="flex flex-col">
            {/* デイリーボーナス */}
            <div className={cx('mb-6 rounded-2xl border-2 p-4 flex items-center justify-between gap-3', canClaimDaily(reward) ? 'bg-amber-50 border-amber-300' : 'bg-white border-slate-200')}>
              <div className="flex items-center gap-3">
                <div className={cx('w-11 h-11 rounded-xl flex items-center justify-center', canClaimDaily(reward) ? 'bg-amber-400 text-white' : 'bg-slate-100 text-slate-400')}><Calendar size={22} /></div>
                <div>
                  <p className="font-black text-slate-800">デイリーボーナス</p>
                  <p className="text-xs font-bold text-slate-500">🔥 {reward.streak} 日連続ログイン{!canClaimDaily(reward) && '（本日受け取り済み）'}</p>
                </div>
              </div>
              <button onClick={claimDailyBonus} disabled={!canClaimDaily(reward)}
                className="bg-amber-500 hover:bg-amber-600 disabled:bg-slate-200 disabled:text-slate-400 text-white font-black px-5 py-3 rounded-xl border-2 border-slate-900 disabled:border-slate-200 shadow-[3px_3px_0px_0px_rgba(15,23,42,1)] disabled:shadow-none transition-all whitespace-nowrap">
                {canClaimDaily(reward) ? '受け取る' : '済'}
              </button>
            </div>

            <header className="mb-4 border-b-2 border-slate-200 pb-4">
              <h2 className="text-2xl sm:text-3xl font-black tracking-tighter text-slate-800 uppercase">レベルをえらぶ</h2>
              <p className="text-sm font-medium text-slate-500">レベルに合わせて問題を出します。コンボとスピードでコインアップ！</p>
            </header>

            {/* 問題数セレクタ & AIモード */}
            <div className="flex flex-wrap items-center gap-2 mb-5">
              <span className="text-xs font-black uppercase tracking-widest text-slate-400 mr-1">問題数</span>
              {QUESTION_COUNTS.map(n => (
                <button key={n} onClick={() => { sfx.click(); setQuestionCount(n); }}
                  className={cx('px-4 py-2 rounded-lg font-black border-2 transition-all', questionCount === n ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-500 border-slate-200 hover:border-slate-400')}>
                  {n}問
                </button>
              ))}
              <button onClick={() => { sfx.click(); setAiMode(v => !v); }}
                className={cx('ml-auto flex items-center gap-1.5 px-4 py-2 rounded-lg font-black border-2 transition-all', aiMode ? 'bg-blue-600 text-white border-blue-600 shadow-[3px_3px_0px_0px_rgba(15,23,42,1)]' : 'bg-white text-slate-500 border-slate-200 hover:border-slate-400')}>
                <Sparkles size={15} /> AI問題 {aiMode ? 'ON' : 'OFF'}
              </button>
            </div>
            <p className="text-[11px] text-slate-400 font-bold -mt-3 mb-5">🤖 AI問題ONで、Geminiが毎回ちがう問題を作ります（同じ問題は出ません）。OFFでも出題は毎回重複を避けます。</p>

            <nav className="grid grid-cols-2 md:grid-cols-5 gap-2 mb-6">
              {DIFFICULTIES.map((d, i) => (
                <motion.button key={d.id} whileHover={{ y: -4 }} whileTap={{ scale: 0.97 }} onClick={() => startGame(d.id, questionCount)}
                  className="py-6 px-3 bg-white border-2 border-slate-200 hover:border-slate-900 hover:shadow-[4px_4px_0px_0px_rgba(15,23,42,1)] text-slate-700 font-bold transition-colors flex flex-col items-center justify-center gap-2 rounded-xl">
                  <Play size={22} className="text-blue-600" />
                  <span className="text-base">{d.label}</span>
                  <span className="text-[10px] text-slate-400">{d.desc}</span>
                  <span className="text-[10px] font-black text-amber-500 flex items-center gap-0.5"><Coins size={10} />{baseCoinPerCorrect(i)}/問</span>
                </motion.button>
              ))}
            </nav>

            {/* 復習デッキ（まちがえた問題） */}
            <div className={cx('mb-4 rounded-2xl border-2 p-4 flex items-center justify-between gap-3', deckSize > 0 ? 'bg-rose-50 border-rose-300' : 'bg-white border-slate-200')}>
              <div className="flex items-center gap-3">
                <div className={cx('w-11 h-11 rounded-xl flex items-center justify-center', deckSize > 0 ? 'bg-rose-500 text-white' : 'bg-slate-100 text-slate-400')}><RotateCcw size={22} /></div>
                <div>
                  <p className="font-black text-slate-800">まちがえた問題の復習</p>
                  <p className="text-xs font-bold text-slate-500">
                    {deckSize > 0 ? `${deckSize}問 のこっています` : 'いまは0問。まちがえるとここに入ります'}
                    <span className="ml-2 text-emerald-600"><GraduationCap size={11} className="inline mb-0.5" /> 卒業 {masteredTotal}問</span>
                  </p>
                </div>
              </div>
              <button onClick={startReview} disabled={deckSize === 0}
                className="bg-rose-500 hover:bg-rose-600 disabled:bg-slate-200 disabled:text-slate-400 text-white font-black px-5 py-3 rounded-xl border-2 border-slate-900 disabled:border-slate-200 shadow-[3px_3px_0px_0px_rgba(15,23,42,1)] disabled:shadow-none transition-all whitespace-nowrap">
                {deckSize > 0 ? '復習する' : 'なし'}
              </button>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <button onClick={() => { sfx.click(); setPull(null); setMulti(null); setGameState('gacha'); }} className="flex items-center justify-center gap-2 text-white bg-purple-600 hover:bg-purple-700 font-bold px-3 py-4 rounded-xl border-2 border-slate-900 shadow-[4px_4px_0px_0px_rgba(15,23,42,1)] transition-all">
                <Gift size={18} /> ガチャ
              </button>
              <button onClick={() => { sfx.click(); setGameState('album'); }} className="flex items-center justify-center gap-2 text-slate-800 bg-white hover:bg-slate-50 font-bold px-3 py-4 rounded-xl border-2 border-slate-900 shadow-[4px_4px_0px_0px_rgba(15,23,42,1)] transition-all">
                <LayoutGrid size={18} /> シール <span className="text-[10px] text-slate-400">{collectedCount(reward)}/{STICKERS.length}</span>
              </button>
              <button onClick={() => { sfx.click(); setGameState('achievements'); }} className="flex items-center justify-center gap-2 text-amber-700 bg-amber-50 hover:bg-amber-100 font-bold px-3 py-4 rounded-xl border-2 border-amber-500 transition-all">
                <Medal size={18} /> 実績 <span className="text-[10px] text-amber-500">{unlockedIds.length}/{ACHIEVEMENTS.length}</span>
              </button>
              <button onClick={viewScores} className="flex items-center justify-center gap-2 text-blue-600 bg-white hover:bg-blue-50 font-bold px-3 py-4 rounded-xl border-2 border-blue-600 transition-all">
                <Trophy size={18} /> スコア
              </button>
            </div>
          </motion.div>
        )}

        {gameState === 'playing' && !problem && (
          <motion.div key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col items-center justify-center py-24 gap-4">
            <Loader2 className="w-10 h-10 animate-spin text-blue-600" />
            <p className="font-bold text-slate-500">{aiMode ? '🤖 AIが問題をつくっています…' : '問題を準備中…'}</p>
          </motion.div>
        )}
        {gameState === 'playing' && problem && (
          <motion.div key="playing" initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} className="grid grid-cols-12 gap-6">
            <section className="col-span-12 lg:col-span-8 flex flex-col gap-6">
              <div className="flex-grow bg-white border-2 border-slate-900 rounded-2xl p-6 sm:p-10 flex flex-col relative shadow-[8px_8px_0px_0px_rgba(15,23,42,1)]">
                <div className="flex items-start justify-between mb-2">
                  <span className="flex items-center gap-2">
                    <span className="text-xs font-mono font-bold bg-slate-100 text-slate-500 px-3 py-1 rounded">第 {currentQIndex + 1} 問 / {questionCount}</span>
                    {isReview && <span className="text-[10px] font-black bg-rose-100 text-rose-600 px-2 py-1 rounded-full flex items-center gap-1"><RotateCcw size={10} /> 復習</span>}
                    {!isReview && probSource === 'ai' && <span className="text-[10px] font-black bg-blue-100 text-blue-600 px-2 py-1 rounded-full flex items-center gap-1"><Sparkles size={10} /> AI</span>}
                  </span>
                  <div className="flex items-center gap-3">
                    <AnimatePresence>
                      {combo >= 2 && (
                        <motion.span key={combo} initial={{ scale: 0.4, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ opacity: 0 }}
                          className="flex items-center gap-1 bg-orange-100 text-orange-600 font-black px-3 py-1 rounded-full border-2 border-orange-300">
                          <Flame size={16} /> {combo} コンボ ×{comboMultiplier(combo).toFixed(1)}
                        </motion.span>
                      )}
                    </AnimatePresence>
                    <TimerRing frac={timeFrac} seconds={timeLeft} />
                  </div>
                </div>
                <div className="mt-6 flex-grow flex flex-col">
                  <div className="text-2xl sm:text-3xl font-bold text-slate-800 leading-relaxed whitespace-pre-wrap mb-8 flex-grow">{problem.problem}</div>
                  <div className="space-y-3">
                    <label className="block text-xs font-bold uppercase tracking-widest text-slate-500">こたえ</label>
                    <input type="text" inputMode="text" value={userAnswer} onChange={(e) => setUserAnswer(e.target.value)} placeholder="答えを入力..." autoFocus
                      className="w-full text-2xl font-bold px-6 py-4 bg-slate-50 border-2 border-slate-200 rounded-xl focus:border-blue-600 outline-none transition-all"
                      onKeyDown={(e) => e.key === 'Enter' && userAnswer.trim() && submitAnswer()} />
                    <div className="flex flex-wrap gap-2">
                      {['/', '-', '.', '√', 'π'].map(k => (
                        <button key={k} type="button" onClick={() => setUserAnswer(a => a + k)} className="w-10 h-10 rounded-lg bg-slate-100 hover:bg-slate-200 font-black text-slate-600 border-2 border-slate-200">{k}</button>
                      ))}
                      <button type="button" onClick={() => setUserAnswer(a => a.slice(0, -1))} className="w-10 h-10 rounded-lg bg-slate-100 hover:bg-slate-200 font-black text-slate-600 border-2 border-slate-200">⌫</button>
                      <button type="button" onClick={() => setUserAnswer('')} className="px-3 h-10 rounded-lg bg-slate-100 hover:bg-slate-200 font-black text-slate-500 border-2 border-slate-200 text-xs">クリア</button>
                    </div>
                    <button onClick={submitAnswer} disabled={!userAnswer.trim()}
                      className="w-full flex items-center justify-center gap-2 bg-slate-900 hover:bg-slate-800 text-white py-5 rounded-xl font-bold transition-all disabled:opacity-50 disabled:cursor-not-allowed text-lg shadow-[4px_4px_0px_0px_rgba(59,130,246,0.5)]">
                      こたえる
                    </button>
                  </div>
                </div>
              </div>
            </section>
            <aside className="col-span-12 lg:col-span-4 flex flex-col gap-6">
              <div className="bg-slate-900 text-white p-6 rounded-2xl shadow-[8px_8px_0px_0px_rgba(59,130,246,1)]">
                <h3 className="text-xs font-bold uppercase tracking-tighter mb-4 opacity-60">Session</h3>
                <div className="space-y-5">
                  <div>
                    <div className="flex justify-between text-sm font-bold mb-2"><span>せいかい</span><span className="text-blue-400">{correctCount}</span></div>
                    <div className="w-full bg-slate-700 h-2 rounded-full overflow-hidden"><div className="bg-blue-400 h-full transition-all" style={{ width: `${currentQIndex > 0 ? (correctCount / currentQIndex) * 100 : 0}%` }} /></div>
                  </div>
                  <div>
                    <div className="flex justify-between text-sm font-bold mb-2"><span>すすみ</span><span className="text-green-400">{currentQIndex} / {questionCount}</span></div>
                    <div className="w-full bg-slate-700 h-2 rounded-full overflow-hidden"><div className="bg-green-400 h-full transition-all" style={{ width: `${(currentQIndex / questionCount) * 100}%` }} /></div>
                  </div>
                  <div className="flex justify-between items-center pt-2 border-t border-slate-700">
                    <span className="text-sm font-bold flex items-center gap-1.5"><Flame size={15} className="text-orange-400" /> コンボ</span>
                    <span className="text-orange-400 font-black">{combo}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-bold flex items-center gap-1.5"><Coins size={15} className="text-amber-400" /> 獲得</span>
                    <span className="text-amber-400 font-black tabular-nums">+{gameCoins}</span>
                  </div>
                </div>
              </div>
              <div className="bg-blue-100 p-6 rounded-2xl border-2 border-blue-200">
                <p className="text-xs font-black text-blue-800 uppercase tracking-widest mb-1">レベル</p>
                <p className="text-lg text-blue-700 font-black mb-1">{difficulty}</p>
                <p className="text-xs text-blue-600 font-medium">{tierDesc}</p>
              </div>
            </aside>
          </motion.div>
        )}

        {gameState === 'explanation' && problem && (
          <motion.div key="expl" initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} className="max-w-3xl mx-auto space-y-6">
            <div className={cx('p-6 sm:p-8 rounded-2xl border-2 flex items-start gap-5 shadow-[8px_8px_0px_0px_rgba(15,23,42,1)] bg-white', isCorrect ? 'border-green-500' : 'border-red-500')}>
              {isCorrect ? <CheckCircle2 className="w-12 h-12 shrink-0 text-green-500" /> : <XCircle className="w-12 h-12 shrink-0 text-red-500" />}
              <div className="flex-grow">
                <h3 className={cx('text-3xl font-black mb-3 tracking-tighter', isCorrect ? 'text-green-600' : 'text-red-600')}>{isCorrect ? 'せいかい！' : 'ざんねん'}</h3>
                <p className="text-slate-500 font-bold text-xs uppercase tracking-widest mb-1">正しい答え</p>
                <p className="font-mono font-bold text-2xl text-slate-800 bg-slate-100 inline-block px-3 py-1 rounded mb-3">{problem.solution}</p>
                <p className="text-slate-500 font-bold text-xs uppercase tracking-widest mb-1">あなたの答え</p>
                <p className="font-mono font-bold text-xl text-slate-600">{userAnswer || '（未入力）'}</p>
                {isCorrect && qEarn && (
                  <div className="mt-4 flex flex-wrap items-center gap-2 text-sm font-black">
                    <span className="flex items-center gap-1 bg-amber-100 text-amber-700 px-3 py-1.5 rounded-lg border-2 border-amber-300"><Coins size={15} /> +{qEarn.coins}</span>
                    <span className="text-slate-400 font-bold text-xs">基本{qEarn.base}{qEarn.mult > 1 && <> × <span className="text-orange-500">コンボ{qEarn.mult.toFixed(1)}</span></>}{qEarn.speed > 0 && <> + <span className="text-blue-500">スピード{qEarn.speed}</span></>}</span>
                  </div>
                )}
              </div>
            </div>
            <div className="bg-white p-6 sm:p-8 rounded-2xl border-2 border-slate-200">
              <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-4">かいせつ</h4>
              <div className="text-slate-700 leading-relaxed whitespace-pre-wrap text-lg font-medium">{problem.explanation}</div>
            </div>
            <button onClick={nextQuestion}
              className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white py-5 rounded-xl font-black tracking-widest uppercase transition-all shadow-[8px_8px_0px_0px_rgba(15,23,42,1)] hover:translate-y-1 hover:shadow-[4px_4px_0px_0px_rgba(15,23,42,1)] text-lg">
              {currentQIndex + 1 >= questionCount ? 'けっかを見る' : 'つぎの問題'} <ArrowRight size={22} />
            </button>
          </motion.div>
        )}
        {gameState === 'result' && (
          <motion.div key="result" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="max-w-2xl mx-auto">
            <div className="bg-white p-8 sm:p-10 rounded-3xl border-2 border-slate-900 shadow-[8px_8px_0px_0px_rgba(15,23,42,1)] text-center">
              <motion.div initial={{ rotate: -8, scale: 0.6 }} animate={{ rotate: -3, scale: 1 }} transition={{ type: 'spring', stiffness: 200 }}
                className="w-24 h-24 bg-blue-600 text-white rounded-2xl border-4 border-slate-900 flex items-center justify-center mx-auto mb-6 shadow-[4px_4px_0px_0px_rgba(15,23,42,1)]"><Trophy size={48} /></motion.div>
              <h2 className="text-3xl sm:text-4xl font-black tracking-tighter text-slate-900 mb-1 uppercase">{isReview ? '復習かんりょう！' : 'クリア！'}</h2>
              <p className="text-sm font-bold text-slate-500 uppercase tracking-widest mb-3">{isReview ? 'まちがえた問題の復習' : `レベル: ${difficulty}`}</p>
              {isReview && (
                <div className="flex flex-wrap items-center justify-center gap-2 mb-5">
                  <span className="flex items-center gap-1.5 bg-emerald-100 text-emerald-700 border-2 border-emerald-300 font-black px-4 py-2 rounded-xl">
                    <GraduationCap size={16} /> 今回 {reviewMastered}問 そつぎょう！
                  </span>
                  <span className="flex items-center gap-1.5 bg-rose-100 text-rose-700 border-2 border-rose-300 font-black px-4 py-2 rounded-xl">
                    <RotateCcw size={16} /> のこり {deckSize}問
                  </span>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3 mb-4">
                <div className="bg-slate-50 rounded-2xl p-5 border-2 border-slate-200">
                  <div className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">せいかい</div>
                  <div className="text-5xl font-black text-blue-600 tracking-tighter">{correctCount}<span className="text-2xl text-slate-300 mx-1">/</span>{questionCount}</div>
                </div>
                <div className="bg-orange-50 rounded-2xl p-5 border-2 border-orange-200 flex flex-col justify-center">
                  <div className="text-xs font-bold text-orange-400 uppercase tracking-widest mb-1 flex items-center justify-center gap-1"><Flame size={12} /> 最高コンボ</div>
                  <div className="text-5xl font-black text-orange-500 tracking-tighter">{bestCombo}</div>
                </div>
              </div>

              <div className="flex items-center justify-center gap-2 bg-amber-100 border-2 border-amber-300 text-amber-700 rounded-2xl py-3 mb-2 font-black text-xl">
                <Coins size={22} /> +{earnedCoins} コイン
              </div>
              <div className="flex flex-wrap items-center justify-center gap-2 text-xs font-bold text-slate-500 mb-4">
                <span>プレイ {gameCoins}</span>
                {perfectBonusCoins > 0 && <span className="text-green-600 flex items-center gap-1"><Star size={12} /> 全問正解ボーナス +{perfectBonusCoins}</span>}
              </div>

              <div className="flex items-center justify-center gap-2 bg-blue-50 border-2 border-blue-200 text-blue-700 rounded-2xl py-3 mb-4 font-black">
                <Zap size={20} /> +{xpGained} XP
              </div>
              <AnimatePresence>
                {leveledUp && (
                  <motion.div initial={{ opacity: 0, scale: 0.7 }} animate={{ opacity: 1, scale: 1 }}
                    className="flex items-center justify-center gap-2 bg-purple-600 text-white rounded-2xl py-3 mb-6 font-black text-lg border-2 border-slate-900 shadow-[4px_4px_0px_0px_rgba(15,23,42,1)]">
                    <Award size={22} /> レベルアップ！ Lv.{leveledUp} 「{levelFromXp(reward.xp).title}」
                  </motion.div>
                )}
              </AnimatePresence>

              {/* 解答レビュー */}
              <div className="text-left bg-slate-50 rounded-2xl border-2 border-slate-200 p-4 mb-6">
                <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-3 flex items-center gap-1"><Target size={13} /> ふりかえり</h4>
                <ul className="space-y-2">
                  {qLog.map((q, i) => (
                    <li key={i} className="flex items-center gap-3 text-sm">
                      {q.correct ? <CheckCircle2 size={18} className="text-green-500 shrink-0" /> : <XCircle size={18} className="text-red-500 shrink-0" />}
                      <span className="font-medium text-slate-600 truncate flex-grow">{q.problem.replace(/\n/g, ' ')}</span>
                      <span className={cx('font-mono font-bold shrink-0', q.correct ? 'text-slate-400' : 'text-red-500')}>{q.solution}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <button onClick={goMenu} className="flex items-center justify-center gap-2 bg-slate-900 hover:bg-slate-800 text-white py-4 rounded-xl font-bold transition-all shadow-[4px_4px_0px_0px_rgba(59,130,246,0.5)]"><Home size={18} /> ホーム</button>
                <button onClick={() => { sfx.click(); setPull(null); setMulti(null); setGameState('gacha'); }} className="flex items-center justify-center gap-2 bg-purple-600 hover:bg-purple-700 text-white py-4 rounded-xl font-bold transition-all shadow-[4px_4px_0px_0px_rgba(15,23,42,1)]"><Gift size={18} /> ガチャへ</button>
                {isReview
                  ? <button onClick={startReview} disabled={deckSize === 0} className="flex items-center justify-center gap-2 bg-rose-500 hover:bg-rose-600 disabled:bg-slate-200 disabled:text-slate-400 text-white border-2 border-slate-900 disabled:border-slate-200 py-4 rounded-xl font-bold transition-all shadow-[4px_4px_0px_0px_rgba(15,23,42,1)] disabled:shadow-none"><RotateCcw size={18} /> {deckSize > 0 ? 'つづけて復習' : '復習おわり'}</button>
                  : <button onClick={() => startGame(difficulty, questionCount)} className="flex items-center justify-center gap-2 bg-white border-2 border-slate-900 hover:bg-slate-50 text-slate-900 py-4 rounded-xl font-bold transition-all shadow-[4px_4px_0px_0px_rgba(15,23,42,1)]">もう1回</button>}
              </div>
            </div>
          </motion.div>
        )}

        {gameState === 'gacha' && (
          <motion.div key="gacha" initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} className="max-w-xl mx-auto">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl sm:text-3xl font-black tracking-tighter text-purple-700 flex items-center gap-2"><Sparkles /> シールガチャ</h2>
              <button onClick={goMenu} className="text-slate-500 hover:text-slate-900 flex items-center gap-1 font-bold text-sm"><ArrowLeft size={18} /> もどる</button>
            </div>
            <div className="bg-white border-2 border-slate-900 rounded-2xl p-6 sm:p-8 shadow-[8px_8px_0px_0px_rgba(15,23,42,1)] text-center">
              <div className="flex items-center justify-center gap-2 text-amber-600 font-black text-lg mb-6"><Coins size={22} /> もっているコイン: <span className="tabular-nums">{reward.coins}</span></div>

              <div className="min-h-[176px] flex items-center justify-center mb-6">
                {spinning ? (
                  <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 0.6, ease: 'linear' }} className="w-40 h-40 rounded-3xl border-4 border-purple-300 border-t-purple-600 flex items-center justify-center text-6xl"><Sparkles className="text-purple-400" size={56} /></motion.div>
                ) : multi ? (
                  <div className="grid grid-cols-5 gap-2 w-full">
                    {multi.items.map((it, i) => (
                      <motion.div key={i} initial={{ scale: 0, rotate: -30 }} animate={{ scale: 1, rotate: 0 }} transition={{ delay: i * 0.06, type: 'spring', stiffness: 260 }}
                        className={cx('aspect-square rounded-xl border-2 flex flex-col items-center justify-center relative overflow-hidden', RARITY[it.sticker.rarity].ring, RARITY[it.sticker.rarity].holo && 'holo')}
                        style={{ backgroundImage: RARITY[it.sticker.rarity].grad, boxShadow: isHiRarity(it.sticker.rarity) ? `0 0 14px ${RARITY[it.sticker.rarity].glow}` : undefined }}>
                        {it.sticker.img ? <StickerImg img={it.sticker.img} className="w-[86%] h-[86%]" /> : <span className="text-3xl relative z-10">{it.sticker.emoji}</span>}
                        {it.isNew && <span className="absolute -top-1 -right-1 bg-green-500 text-white text-[8px] font-black px-1 rounded z-10">NEW</span>}
                      </motion.div>
                    ))}
                  </div>
                ) : pull ? (
                  <motion.div initial={{ scale: 0.4, rotate: -20 }} animate={{ scale: 1, rotate: 0 }} transition={{ type: 'spring', stiffness: 220 }}
                    className={cx('relative overflow-hidden w-40 h-40 rounded-3xl border-4 flex items-center justify-center text-7xl', RARITY[pull.sticker.rarity].ring, RARITY[pull.sticker.rarity].holo && 'holo sheen')}
                    style={{ backgroundImage: RARITY[pull.sticker.rarity].grad, boxShadow: isHiRarity(pull.sticker.rarity) ? `0 0 34px ${RARITY[pull.sticker.rarity].glow}` : undefined }}>
                    {pull.sticker.img ? <StickerImg img={pull.sticker.img} className="w-[82%] h-[82%]" /> : <span className="relative z-10" style={{ filter: 'drop-shadow(0 2px 3px rgba(0,0,0,0.15))' }}>{pull.sticker.emoji}</span>}
                  </motion.div>
                ) : (
                  <div className="w-40 h-40 rounded-3xl border-4 bg-slate-100 border-slate-200 flex items-center justify-center"><Gift className="text-slate-300" size={64} /></div>
                )}
              </div>

              {!spinning && pull && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mb-6">
                  <span className={cx('inline-block text-xs font-black px-3 py-1 rounded-full border-2', RARITY[pull.sticker.rarity].ring, RARITY[pull.sticker.rarity].text, RARITY[pull.sticker.rarity].bg)}>{RARITY[pull.sticker.rarity].label}</span>
                  <p className="text-2xl font-black text-slate-800 mt-2">{pull.sticker.name}</p>
                  <p className={cx('text-sm font-bold mt-1', pull.isNew ? 'text-green-600' : 'text-slate-400')}>{pull.isNew ? '✨ 新しいシール！' : `かぶり… +${DUP_REFUND}コイン もどってきた`}</p>
                </motion.div>
              )}
              {!spinning && multi && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.6 }} className="mb-6">
                  <p className="text-lg font-black text-slate-800">10連結果: <span className="text-green-600">新規 {multi.newCount}</span> / かぶり返金 <span className="text-amber-600">+{multi.refund}</span></p>
                  <p className="text-xs font-bold text-slate-400 mt-1">最高レア: <span className={RARITY[multi.bestRarity].text}>{RARITY[multi.bestRarity].label}</span></p>
                </motion.div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <button onClick={doPull} disabled={reward.coins < GACHA_COST || spinning}
                  className="flex items-center justify-center gap-2 bg-purple-600 hover:bg-purple-700 text-white py-4 rounded-xl font-black transition-all disabled:opacity-40 disabled:cursor-not-allowed shadow-[4px_4px_0px_0px_rgba(15,23,42,1)]">
                  <Gift size={20} /> 1回（{GACHA_COST}）
                </button>
                <button onClick={doMultiPull} disabled={reward.coins < TEN_PULL_COST || spinning}
                  className="flex items-center justify-center gap-2 bg-amber-500 hover:bg-amber-600 text-white py-4 rounded-xl font-black transition-all disabled:opacity-40 disabled:cursor-not-allowed shadow-[4px_4px_0px_0px_rgba(15,23,42,1)]">
                  <Sparkles size={20} /> 10連（{TEN_PULL_COST}）<span className="text-[10px] bg-white/25 px-1.5 py-0.5 rounded">R確定</span>
                </button>
              </div>
              {reward.coins < GACHA_COST && <p className="text-xs text-slate-400 mt-3 font-bold">コインが足りません。問題をといて集めよう！</p>}
              <button onClick={() => { sfx.click(); setGameState('album'); }} className="mt-4 text-purple-600 font-bold text-sm flex items-center justify-center gap-1 mx-auto hover:underline"><LayoutGrid size={16} /> シールちょうを見る（{collectedCount(reward)}/{STICKERS.length}）</button>
            </div>

            {/* 排出確率テーブル */}
            <div className="mt-4 bg-white border-2 border-slate-200 rounded-2xl p-4">
              <p className="text-xs font-black text-slate-400 uppercase tracking-widest mb-3 flex items-center gap-1"><Star size={12} /> 排出確率</p>
              <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                {GACHA_ODDS.map(({ r, pct }) => (
                  <div key={r} className={cx('rounded-xl border-2 py-2 px-1 text-center relative overflow-hidden', RARITY[r].ring, RARITY[r].holo && 'holo')}
                    style={{ backgroundImage: RARITY[r].grad }}>
                    <div className={cx('text-[11px] font-black relative z-10', RARITY[r].text)}>{RARITY[r].label}</div>
                    <div className="text-sm font-black text-slate-800 relative z-10 tabular-nums">{pct}</div>
                  </div>
                ))}
              </div>
              <p className="text-[10px] text-slate-400 font-bold mt-2 text-center">??? は超激レア。手に入れたら本物のラッキー！</p>
            </div>
          </motion.div>
        )}

        {gameState === 'album' && (
          <motion.div key="album" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="max-w-4xl mx-auto">
            <div className="flex items-center justify-between mb-6 border-b-2 border-slate-200 pb-4">
              <h2 className="text-2xl sm:text-3xl font-black tracking-tighter text-slate-800 flex items-center gap-2"><LayoutGrid /> シールちょう
                <span className="text-base text-slate-400 font-bold">{collectedCount(reward)} / {STICKERS.length}</span>
              </h2>
              <button onClick={goMenu} className="text-slate-500 hover:text-slate-900 flex items-center gap-1 font-bold text-sm"><Home size={18} /> ホーム</button>
            </div>
            {isComplete(reward) && (
              <div className="mb-4 bg-amber-50 border-2 border-amber-300 rounded-2xl p-4 text-center font-black text-amber-700 flex items-center justify-center gap-2"><Trophy /> コンプリート達成！すべてのシールを集めました 🎉</div>
            )}
            <div className="grid grid-cols-3 sm:grid-cols-5 md:grid-cols-6 gap-3">
              {STICKERS.map((s, i) => {
                const count = reward.stickers[s.id] || 0;
                const owned = count > 0;
                return (
                  <motion.div key={s.id} initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: i * 0.02 }}
                    className={cx('aspect-square rounded-2xl border-2 flex flex-col items-center justify-center relative overflow-hidden transition-all', owned ? RARITY[s.rarity].ring : 'bg-slate-100 border-slate-200', owned && RARITY[s.rarity].holo && 'holo')}
                    style={{ backgroundImage: owned ? RARITY[s.rarity].grad : undefined, boxShadow: owned && isHiRarity(s.rarity) ? `0 0 14px ${RARITY[s.rarity].glow}` : undefined }}>
                    {owned && s.img
                      ? <StickerImg img={s.img} className="w-[86%] h-[86%]" />
                      : <span className={cx('text-4xl sm:text-5xl relative z-10', owned ? '' : 'grayscale opacity-20')}>{owned ? s.emoji : (s.rarity === 'X' ? '❔' : '❓')}</span>}
                    <span className={cx('text-[10px] font-bold mt-1 relative z-10', owned ? RARITY[s.rarity].text : 'text-slate-300')}>{owned ? s.name : '？？？'}</span>
                    {count > 1 && <span className="absolute top-1 right-1 bg-slate-900 text-white text-[10px] font-black px-1.5 rounded-full z-10">×{count}</span>}
                  </motion.div>
                );
              })}
            </div>
            <div className="mt-6 flex justify-center">
              <button onClick={() => { sfx.click(); setPull(null); setMulti(null); setGameState('gacha'); }} className="flex items-center gap-2 bg-purple-600 hover:bg-purple-700 text-white font-bold px-6 py-3 rounded-xl border-2 border-slate-900 shadow-[4px_4px_0px_0px_rgba(15,23,42,1)]"><Gift size={18} /> ガチャを引く</button>
            </div>
          </motion.div>
        )}

        {gameState === 'achievements' && (() => {
          const st = buildAchStats(reward, masteredTotal);
          const tierStyle: Record<string, string> = {
            bronze: 'from-amber-100 to-orange-200 border-amber-500 text-amber-700',
            silver: 'from-slate-100 to-slate-300 border-slate-500 text-slate-700',
            gold: 'from-yellow-100 to-amber-300 border-amber-500 text-amber-800',
            platinum: 'from-cyan-100 via-fuchsia-100 to-indigo-200 border-fuchsia-400 text-fuchsia-700',
          };
          return (
            <motion.div key="achv" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="max-w-4xl mx-auto">
              <div className="flex items-center justify-between mb-6 border-b-2 border-slate-200 pb-4">
                <h2 className="text-2xl sm:text-3xl font-black tracking-tighter text-slate-800 flex items-center gap-2">
                  <Medal className="text-amber-500" /> 実績
                  <span className="text-base text-slate-400 font-bold">{unlockedIds.length} / {ACHIEVEMENTS.length}</span>
                </h2>
                <button onClick={goMenu} className="text-slate-500 hover:text-slate-900 flex items-center gap-1 font-bold text-sm"><Home size={18} /> ホーム</button>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {ACHIEVEMENTS.map((a, i) => {
                  const done = unlockedIds.includes(a.id);
                  const pr = a.progress(st);
                  const pct = pr.goal > 0 ? Math.min(100, Math.round((pr.cur / pr.goal) * 100)) : 0;
                  return (
                    <motion.div key={a.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }}
                      className={cx('rounded-2xl border-2 p-4 flex items-center gap-4 transition-all',
                        done ? `bg-gradient-to-br ${tierStyle[a.tier]} shadow-[4px_4px_0px_0px_rgba(15,23,42,1)]` : 'bg-slate-50 border-slate-200')}>
                      <span className={cx('text-4xl shrink-0', done ? '' : 'grayscale opacity-30')}>{done ? a.icon : '🔒'}</span>
                      <div className="flex-grow min-w-0">
                        <p className={cx('font-black truncate', done ? '' : 'text-slate-400')}>{a.name}</p>
                        <p className={cx('text-xs font-bold truncate', done ? 'opacity-80' : 'text-slate-400')}>{a.desc}</p>
                        {!done && (
                          <div className="mt-1.5">
                            <div className="w-full bg-slate-200 h-1.5 rounded-full overflow-hidden">
                              <div className="bg-blue-400 h-full transition-all" style={{ width: `${pct}%` }} />
                            </div>
                            <p className="text-[10px] font-bold text-slate-400 mt-0.5 tabular-nums">{pr.cur} / {pr.goal}</p>
                          </div>
                        )}
                      </div>
                      {done && <Star size={18} className="shrink-0" />}
                    </motion.div>
                  );
                })}
              </div>
            </motion.div>
          );
        })()}

        {gameState === 'scores' && (
          <motion.div key="scores" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="max-w-3xl mx-auto">
            <header className="flex items-end justify-between mb-6 border-b-2 border-slate-200 pb-4">
              <h2 className="text-2xl sm:text-3xl font-black tracking-tighter text-slate-800 uppercase">スコア</h2>
              <button onClick={goMenu} className="text-slate-500 hover:text-slate-900 flex items-center gap-2 font-bold text-sm"><Home size={18} /> ホーム</button>
            </header>
            <div className="bg-white border-2 border-slate-900 rounded-2xl shadow-[8px_8px_0px_0px_rgba(15,23,42,1)] overflow-hidden">
              {scores.length === 0 ? (
                <div className="p-16 text-center text-slate-500 font-bold">まだ記録がありません。</div>
              ) : (
                <ul className="divide-y-2 divide-slate-100">
                  {scores.map((s, i) => (
                    <li key={s.id || i} className="p-5 sm:p-6 flex items-center justify-between hover:bg-slate-50 transition-colors">
                      <div className="flex items-center gap-5">
                        <div className="text-slate-300 font-black text-2xl w-8 text-center">{i + 1}</div>
                        <div className="space-y-1">
                          <div className="font-black text-lg text-slate-800 flex items-center gap-2">{s.difficulty}{typeof s.bestCombo === 'number' && s.bestCombo >= 2 && <span className="text-xs text-orange-500 font-bold flex items-center gap-0.5"><Flame size={11} />{s.bestCombo}</span>}</div>
                          <div className="text-xs text-slate-400 font-bold">{s.createdAt ? new Date(s.createdAt).toLocaleString('ja-JP') : '...'}</div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 bg-slate-900 text-white px-4 py-2 rounded-xl shadow-[4px_4px_0px_0px_rgba(59,130,246,1)]">
                        <span className="text-2xl font-black">{s.correctCount}</span><span className="text-sm font-bold text-slate-400">/ {s.totalQuestions}</span>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </motion.div>
        )}
      </main>
    </div>
  );
}
