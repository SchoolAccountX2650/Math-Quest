/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useEffect, useState } from 'react';
import { auth, signInWithGoogle, signOut } from './firebase';
import { onAuthStateChanged, User } from 'firebase/auth';
import { Loader2, LogOut, Play, User as UserIcon, Trophy, ArrowRight, CheckCircle2, XCircle, Home, Coins, Gift, Sparkles, LayoutGrid, ArrowLeft } from 'lucide-react';

// ===== 埋め込み数学ジェネレーター (mathGen inline) =====
export interface Problem {
  problem: string;
  solution: string;
  explanation: string;
}

export type DifficultyId = '算数低' | '算数高' | '数学低' | '数学中' | '数学高';

// ── 乱数・数学ヘルパー ──
const rint = (min: number, max: number) => Math.floor(Math.random() * (max - min + 1)) + min;
function pick<T>(a: T[]): T { return a[Math.floor(Math.random() * a.length)]; }
function gcd(a: number, b: number): number { a = Math.abs(a); b = Math.abs(b); while (b) { const t = a % b; a = b; b = t; } return a || 1; }
function fracStr(n: number, d: number): string {
  if (d < 0) { n = -n; d = -d; }
  const g = gcd(n, d);
  const nn = n / g, dd = d / g;
  return dd === 1 ? String(nn) : `${nn}/${dd}`;
}

// ── 正誤判定（全角→半角・空白・x=接頭辞・分数/小数の等価を吸収） ──
function toHalf(s: string): string {
  return String(s)
    .replace(/[０-９]/g, c => String.fromCharCode(c.charCodeAt(0) - 0xFEE0))
    .replace(/／/g, '/').replace(/＝/g, '=').replace(/[－ー−―]/g, '-').replace(/．/g, '.')
    .replace(/[ｘＸ]/g, 'x').replace(/[ｙＹ]/g, 'y');
}
function normAns(s: string): string {
  let t = toHalf(s).trim().toLowerCase().replace(/\s+/g, '').replace(/[,，]/g, '');
  t = t.replace(/^[xy]=/, '').replace(/=$/, '');
  t = t.replace(/(こ|個|本|まい|枚|cm²|cm2|cm|円|点|人|匹)$/, ''); // 末尾の単位を許容
  t = t.replace(/[。.]$/, '');
  return t;
}
function parseFrac(x: string): [number, number] | null {
  const m = x.match(/^(-?\d+)\/(-?\d+)$/);
  return m ? [parseInt(m[1], 10), parseInt(m[2], 10)] : null;
}
export function checkAnswer(user: string, solution: string): boolean {
  const u = normAns(user), s = normAns(solution);
  if (!u) return false;
  if (u === s) return true;
  const isNum = (v: string) => /^-?\d*\.?\d+$/.test(v);
  const uf = parseFrac(u), sf = parseFrac(s);
  if (uf && sf && uf[1] !== 0 && sf[1] !== 0) return uf[0] * sf[1] === sf[0] * uf[1];
  if (isNum(u) && isNum(s)) return Math.abs(parseFloat(u) - parseFloat(s)) < 1e-9;
  if (uf && isNum(s) && uf[1] !== 0) return Math.abs(uf[0] / uf[1] - parseFloat(s)) < 1e-9;
  if (sf && isNum(u) && sf[1] !== 0) return Math.abs(sf[0] / sf[1] - parseFloat(u)) < 1e-9;
  return false;
}

// ── 算数低（小1〜3）: たし算・ひき算・九九・文章題 ──
function genES(): Problem {
  const t = rint(1, 4);
  if (t === 1) { const a = rint(2, 49), b = rint(2, 49); return { problem: `${a} + ${b} = ?`, solution: String(a + b), explanation: `${a} に ${b} をたすと ${a + b} です。` }; }
  if (t === 2) { const a = rint(11, 99), b = rint(1, a - 1); return { problem: `${a} - ${b} = ?`, solution: String(a - b), explanation: `${a} から ${b} をひくと ${a - b} です。` }; }
  if (t === 3) { const a = rint(2, 9), b = rint(2, 9); return { problem: `${a} × ${b} = ?`, solution: String(a * b), explanation: `${a}のだんを${b}こ分。${a}×${b}=${a * b} です。` }; }
  const a = rint(3, 15), b = rint(2, 9), it = pick([['りんご', 'こ'], ['あめ', 'こ'], ['えんぴつ', '本'], ['シール', 'まい']]);
  return { problem: `${it[0]}が ${a}${it[1]} あります。${b}${it[1]} もらうと、ぜんぶで何${it[1]}になりますか？`, solution: String(a + b), explanation: `はじめの ${a}${it[1]} に ${b}${it[1]} をたして、${a + b}${it[1]} です。` };
}

// ── 算数高（小4〜6）: 2桁かけ算・わり算・分数・小数・百分率・面積 ──
function genEH(): Problem {
  const t = rint(1, 6);
  if (t === 1) { const a = rint(12, 99), b = rint(11, 40); return { problem: `${a} × ${b} = ?`, solution: String(a * b), explanation: `${a} × ${b} = ${a * b} です。` }; }
  if (t === 2) { const b = rint(3, 12), q = rint(4, 20), a = b * q; return { problem: `${a} ÷ ${b} = ?`, solution: String(q), explanation: `${b} × ${q} = ${a} なので、${a} ÷ ${b} = ${q} です。` }; }
  if (t === 3) {
    const d1 = pick([2, 3, 4, 5, 6]), d2 = pick([2, 3, 4, 5, 6]);
    const n1 = rint(1, d1 - 1), n2 = rint(1, d2 - 1), den = d1 * d2;
    let op = pick(['+', '-']);
    let num = op === '+' ? n1 * d2 + n2 * d1 : n1 * d2 - n2 * d1;
    if (op === '-' && num <= 0) { op = '+'; num = n1 * d2 + n2 * d1; } // 負にならないよう符号入替（再帰回避）
    return { problem: `${n1}/${d1} ${op} ${n2}/${d2} = ?（約分して答えてね）`, solution: fracStr(num, den), explanation: `通分すると ${n1 * d2}/${den} ${op} ${n2 * d1}/${den} = ${num}/${den}。約分して ${fracStr(num, den)} です。` };
  }
  if (t === 4) { const a = rint(11, 89) / 10, b = rint(11, 89) / 10, s = Math.round((a + b) * 10) / 10; return { problem: `${a.toFixed(1)} + ${b.toFixed(1)} = ?`, solution: String(s), explanation: `${a.toFixed(1)} + ${b.toFixed(1)} = ${s} です。` }; }
  if (t === 5) { const base = pick([100, 200, 300, 400, 500, 600, 800, 1000]), pct = pick([5, 10, 20, 25, 30, 40, 50]); const v = base * pct / 100; return { problem: `${base} の ${pct}% はいくつ？`, solution: String(v), explanation: `${base} × ${pct} ÷ 100 = ${v} です。` }; }
  const w = rint(3, 15), h = rint(3, 15); return { problem: `たて ${h}cm、よこ ${w}cm の長方形の面積は何 cm² ですか？（数字だけ）`, solution: String(w * h), explanation: `面積 = たて × よこ = ${h} × ${w} = ${w * h}（cm²）です。` };
}

// ── 数学低（中1〜3）: 一次方程式・平方根・累乗・正負の数・三平方 ──
function genML(): Problem {
  const t = rint(1, 5);
  if (t === 1) { const a = pick([2, 3, 4, 5]), x = rint(2, 12), b = rint(1, 15), c = a * x + b; return { problem: `方程式 ${a}x + ${b} = ${c} を解きなさい。 x = ?`, solution: String(x), explanation: `${a}x = ${c} - ${b} = ${a * x}。両辺を ${a} で割って x = ${x}。` }; }
  if (t === 2) { const a = rint(2, 15); return { problem: `√${a * a} = ?`, solution: String(a), explanation: `${a} × ${a} = ${a * a} なので √${a * a} = ${a} です。` }; }
  if (t === 3) { const a = rint(2, 15), p = pick([2, 3]), v = p === 2 ? a * a : a * a * a; return { problem: `${a}${p === 2 ? '²' : '³'} = ?`, solution: String(v), explanation: `${a} を ${p} 回かけて ${v} です。` }; }
  if (t === 4) { const a = rint(1, 12), b = rint(1, 12); const f = pick<[string, number]>([[`(-${a}) + ${b}`, -a + b], [`${b} - (-${a})`, b + a], [`(-${a}) - ${b}`, -a - b], [`(-${a}) × ${b}`, -a * b]]); return { problem: `${f[0]} = ?`, solution: String(f[1]), explanation: `符号に注意して計算すると ${f[1]} です。` }; }
  const tri = pick([[3, 4, 5], [6, 8, 10], [5, 12, 13], [8, 15, 17], [9, 12, 15]]); return { problem: `直角をはさむ2辺の長さが ${tri[0]} と ${tri[1]} の直角三角形の、斜辺の長さは？`, solution: String(tri[2]), explanation: `三平方の定理より ${tri[0]}² + ${tri[1]}² = ${tri[0] * tri[0] + tri[1] * tri[1]} = ${tri[2]}²。斜辺は ${tri[2]} です。` };
}

// ── 数学中（高1〜3）: 2次方程式・微分係数・三角比・対数・確率・数列 ──
function genMM(): Problem {
  const t = rint(1, 6);
  if (t === 1) {
    let r1 = rint(-6, 6), r2 = rint(-6, 6); if (r1 > r2) { const tmp = r1; r1 = r2; r2 = tmp; }
    if (r1 === r2) r2 = r1 + rint(1, 3); // 重解を避け「小さい方」を自然にする
    const b = -(r1 + r2), c = r1 * r2;
    const bs = b === 0 ? '' : ` ${b > 0 ? '+' : '-'} ${Math.abs(b)}x`, cs = c === 0 ? '' : ` ${c > 0 ? '+' : '-'} ${Math.abs(c)}`;
    return { problem: `2次方程式 x²${bs}${cs} = 0 の解のうち、小さい方の値は？`, solution: String(r1), explanation: `(x - (${r1}))(x - (${r2})) = 0 と因数分解でき、解は x = ${r1}, ${r2}。小さい方は ${r1}。` };
  }
  if (t === 2) { const n = pick([2, 3, 4]), a = rint(1, 4), v = n * Math.pow(a, n - 1); return { problem: `関数 f(x) = x^${n} のとき、微分係数 f'(${a}) の値は？`, solution: String(v), explanation: `f'(x) = ${n}x^${n - 1}。f'(${a}) = ${n} × ${a}^${n - 1} = ${v}。` }; }
  if (t === 3) { const tr = pick([['sin 30°', '1/2'], ['cos 60°', '1/2'], ['tan 45°', '1'], ['sin 90°', '1'], ['cos 0°', '1'], ['tan 0°', '0'], ['sin 0°', '0'], ['cos 90°', '0']]); return { problem: `${tr[0]} の値は？（分数は a/b の形で）`, solution: tr[1], explanation: `三角比の基本値より ${tr[0]} = ${tr[1]} です。` }; }
  if (t === 4) { const base = pick([2, 3, 10]), p = rint(2, 4), v = Math.pow(base, p); return { problem: `log_${base} ${v} = ?`, solution: String(p), explanation: `${base}^${p} = ${v} なので log_${base} ${v} = ${p} です。` }; }
  if (t === 5) { const o = pick([['2枚のコインを同時に投げるとき、2枚とも表が出る確率は？', '1/4'], ['1個のサイコロを投げるとき、3以下の目が出る確率は？', '1/2'], ['1個のサイコロを投げるとき、偶数の目が出る確率は？', '1/2'], ['2枚のコインを投げて、少なくとも1枚が表になる確率は？', '3/4']]); return { problem: o[0], solution: o[1], explanation: `すべての場合を数えると確率は ${o[1]} です。` }; }
  const a = rint(1, 9), d = rint(2, 6), n = rint(4, 8), v = a + (n - 1) * d; return { problem: `初項 ${a}、公差 ${d} の等差数列の第 ${n} 項は？`, solution: String(v), explanation: `a_n = a + (n - 1)d = ${a} + ${n - 1} × ${d} = ${v} です。` };
}

// ── 数学高（大1〜4）: 行列式・定積分・極限・微分・トレース ──
function genMH(): Problem {
  const t = rint(1, 5);
  if (t === 1) { const a = rint(1, 5), b = rint(0, 4), c = rint(0, 4), d = rint(1, 5), v = a * d - b * c; return { problem: `行列 [[${a}, ${b}], [${c}, ${d}]] の行列式 det を求めよ。`, solution: String(v), explanation: `det = ad - bc = ${a}×${d} - ${b}×${c} = ${v}。` }; }
  if (t === 2) {
    if (pick([true, false])) { const a = rint(2, 6), u = rint(2, 5), v = a * u; return { problem: `定積分 ∫₀^${u} ${a} dx を求めよ。`, solution: String(v), explanation: `∫₀^${u} ${a} dx = [${a}x]₀^${u} = ${a}×${u} = ${v}。` }; }
    const a = pick([2, 4]), u = rint(2, 5), v = a * u * u / 2; return { problem: `定積分 ∫₀^${u} ${a}x dx を求めよ。`, solution: String(v), explanation: `∫ ${a}x dx = ${a / 2}x²。[${a / 2}x²]₀^${u} = ${a / 2}×${u}² = ${v}。` };
  }
  if (t === 3) { const o = pick([['lim[x→0] sin(x)/x = ?', '1'], ['lim[x→∞] (1 + 1/x)^x = ?（記号で）', 'e'], ['lim[x→0] (1 - cos(x))/x = ?', '0'], ['lim[x→0] (e^x - 1)/x = ?', '1']]); return { problem: o[0], solution: o[1], explanation: `代表的な極限の公式より、答えは ${o[1]} です。` }; }
  if (t === 4) { const a = rint(2, 5); const o = pick<[string, string, string]>([[`関数 f(x) = e^(${a}x) の f'(0) の値は？`, String(a), `f'(x) = ${a}e^(${a}x)、f'(0) = ${a}×1 = ${a}。`], [`関数 f(x) = sin(${a}x) の f'(0) の値は？`, String(a), `f'(x) = ${a}cos(${a}x)、f'(0) = ${a}×1 = ${a}。`]]); return { problem: o[0], solution: o[1], explanation: o[2] }; }
  const a = rint(1, 5), d = rint(1, 5); return { problem: `行列 [[${a}, ${rint(0, 4)}], [${rint(0, 4)}, ${d}]] のトレース（対角成分の和）は？`, solution: String(a + d), explanation: `トレース = ${a} + ${d} = ${a + d}。` };
}

const GEN: Record<DifficultyId, () => Problem> = {
  '算数低': genES, '算数高': genEH, '数学低': genML, '数学中': genMM, '数学高': genMH,
};

export function generateProblem(difficulty: string): Problem {
  const g = GEN[difficulty as DifficultyId] || genES;
  return g();
}

// ===== 報酬システム (rewards inline) =====
export type Rarity = 'C' | 'R' | 'E' | 'L';
export interface Sticker { id: string; emoji: string; name: string; rarity: Rarity; }
export interface RewardData { coins: number; stickers: Record<string, number>; }

export const RARITY: Record<Rarity, { label: string; weight: number; text: string; ring: string; bg: string }> = {
  C: { label: 'ノーマル', weight: 60, text: 'text-slate-500', ring: 'border-slate-300', bg: 'bg-slate-100' },
  R: { label: 'レア', weight: 30, text: 'text-blue-600', ring: 'border-blue-400', bg: 'bg-blue-50' },
  E: { label: 'エピック', weight: 8, text: 'text-purple-600', ring: 'border-purple-400', bg: 'bg-purple-50' },
  L: { label: 'レジェンド', weight: 2, text: 'text-amber-500', ring: 'border-amber-400', bg: 'bg-amber-50' },
};

// 学び・かわいい系のシール 26種
export const STICKERS: Sticker[] = [
  { id: 'c1', emoji: '⭐', name: 'ほし', rarity: 'C' },
  { id: 'c2', emoji: '🍎', name: 'りんご', rarity: 'C' },
  { id: 'c3', emoji: '✏️', name: 'えんぴつ', rarity: 'C' },
  { id: 'c4', emoji: '📏', name: 'ものさし', rarity: 'C' },
  { id: 'c5', emoji: '🔢', name: 'すうじ', rarity: 'C' },
  { id: 'c6', emoji: '🟦', name: 'しかく', rarity: 'C' },
  { id: 'c7', emoji: '🔺', name: 'さんかく', rarity: 'C' },
  { id: 'c8', emoji: '🍊', name: 'みかん', rarity: 'C' },
  { id: 'r1', emoji: '🧮', name: 'そろばん', rarity: 'R' },
  { id: 'r2', emoji: '📐', name: 'ぶんどき', rarity: 'R' },
  { id: 'r3', emoji: '📗', name: 'きょうかしょ', rarity: 'R' },
  { id: 'r4', emoji: '🎈', name: 'ふうせん', rarity: 'R' },
  { id: 'r5', emoji: '🐢', name: 'かめ', rarity: 'R' },
  { id: 'r6', emoji: '🦊', name: 'きつね', rarity: 'R' },
  { id: 'r7', emoji: '🧩', name: 'パズル', rarity: 'R' },
  { id: 'e1', emoji: '🎓', name: 'そつぎょうぼう', rarity: 'E' },
  { id: 'e2', emoji: '🏅', name: 'メダル', rarity: 'E' },
  { id: 'e3', emoji: '🚀', name: 'ロケット', rarity: 'E' },
  { id: 'e4', emoji: '🔭', name: 'ぼうえんきょう', rarity: 'E' },
  { id: 'e5', emoji: '🧠', name: 'ひらめき', rarity: 'E' },
  { id: 'e6', emoji: '🎨', name: 'パレット', rarity: 'E' },
  { id: 'l1', emoji: '🏆', name: 'トロフィー', rarity: 'L' },
  { id: 'l2', emoji: '🦉', name: 'ちえのフクロウ', rarity: 'L' },
  { id: 'l3', emoji: '👑', name: 'おうかん', rarity: 'L' },
  { id: 'l4', emoji: '🌈', name: 'にじ', rarity: 'L' },
  { id: 'l5', emoji: '💎', name: 'ダイヤ', rarity: 'L' },
];

export const STICKER_BY_ID: Record<string, Sticker> = Object.fromEntries(STICKERS.map(s => [s.id, s]));

export const GACHA_COST = 100;
export const DUP_REFUND = 20;

function key(uid: string) { return `mathquest:reward:${uid || 'guest'}`; }

export function loadReward(uid: string): RewardData {
  try {
    const raw = localStorage.getItem(key(uid));
    if (raw) { const d = JSON.parse(raw); return { coins: typeof d.coins === 'number' ? d.coins : 0, stickers: (d.stickers && typeof d.stickers === 'object') ? d.stickers : {} }; }
  } catch { /* ignore */ }
  return { coins: 0, stickers: {} };
}

export function saveReward(uid: string, d: RewardData) {
  try { localStorage.setItem(key(uid), JSON.stringify(d)); } catch { /* ignore */ }
}

// 正解数×(段階に応じた単価)。算数低=10 … 数学高=50。
export function coinsForResult(correct: number, tierIndex: number): number {
  return correct * (10 + tierIndex * 10);
}

export interface PullResult { data: RewardData; sticker: Sticker; isNew: boolean; refund: number; }

export function pullGacha(data: RewardData): PullResult | null {
  if (data.coins < GACHA_COST) return null;
  const totalW = STICKERS.reduce((s, st) => s + RARITY[st.rarity].weight, 0);
  let r = Math.random() * totalW;
  let chosen = STICKERS[STICKERS.length - 1];
  for (const st of STICKERS) { r -= RARITY[st.rarity].weight; if (r <= 0) { chosen = st; break; } }
  const stickers = { ...data.stickers };
  const isNew = !stickers[chosen.id];
  stickers[chosen.id] = (stickers[chosen.id] || 0) + 1;
  const refund = isNew ? 0 : DUP_REFUND;
  return { data: { coins: data.coins - GACHA_COST + refund, stickers }, sticker: chosen, isNew, refund };
}

export function collectedCount(data: RewardData): number {
  return STICKERS.filter(s => data.stickers[s.id]).length;
}

// スコア履歴も localStorage（Firestoreルールが scores 書込を拒否するため確実側に寄せる。ログインは Firebase 継続）
export interface ScoreRec { difficulty: string; correctCount: number; totalQuestions: number; createdAt: number; }
function scoreKey(uid: string) { return `mathquest:scores:${uid || 'guest'}`; }
export function getScoresLocal(uid: string): ScoreRec[] {
  try { const raw = localStorage.getItem(scoreKey(uid)); if (raw) { const a = JSON.parse(raw); return Array.isArray(a) ? a : []; } } catch { /* ignore */ }
  return [];
}
export function saveScoreLocal(uid: string, rec: ScoreRec) {
  try { const arr = getScoresLocal(uid); arr.unshift(rec); localStorage.setItem(scoreKey(uid), JSON.stringify(arr.slice(0, 100))); } catch { /* ignore */ }
}

// ===== アプリ本体 =====

const DIFFICULTIES = [
  { id: '算数低', label: '算数低', desc: '小学1〜3年生' },
  { id: '算数高', label: '算数高', desc: '小学4〜6年生' },
  { id: '数学低', label: '数学低', desc: '中学1〜3年生' },
  { id: '数学中', label: '数学中', desc: '高校1〜3年生' },
  { id: '数学高', label: '数学高', desc: '大学1〜4年生' },
];

const QUESTIONS_PER_GAME = 3;
type GameState = 'menu' | 'playing' | 'explanation' | 'result' | 'scores' | 'gacha' | 'album';

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [gameState, setGameState] = useState<GameState>('menu');
  const [difficulty, setDifficulty] = useState('算数低');
  const [problem, setProblem] = useState<Problem | null>(null);

  const [currentQIndex, setCurrentQIndex] = useState(0);
  const [correctCount, setCorrectCount] = useState(0);
  const [userAnswer, setUserAnswer] = useState('');
  const [isCorrect, setIsCorrect] = useState(false);
  const [scores, setScores] = useState<any[]>([]);

  // ご褒美（コイン・シール）
  const [reward, setReward] = useState<RewardData>({ coins: 0, stickers: {} });
  const [earnedCoins, setEarnedCoins] = useState(0);
  const [pull, setPull] = useState<PullResult | null>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setAuthLoading(false);
      if (u) setReward(loadReward(u.uid));
    });
    return () => unsubscribe();
  }, []);

  const persistReward = (d: RewardData) => { setReward(d); if (user) saveReward(user.uid, d); };

  const loadProblem = (diff: string) => setProblem(generateProblem(diff));

  const startGame = (selectedDiff: string) => {
    setDifficulty(selectedDiff);
    setCurrentQIndex(0);
    setCorrectCount(0);
    setUserAnswer('');
    setGameState('playing');
    loadProblem(selectedDiff);
  };

  const submitAnswer = () => {
    if (!problem) return;
    const correct = checkAnswer(userAnswer, problem.solution);
    setIsCorrect(correct);
    if (correct) setCorrectCount(prev => prev + 1);
    setGameState('explanation');
  };

  const nextQuestion = async () => {
    const finalCorrect = correctCount; // correctCount は submitAnswer で加算済み
    if (currentQIndex + 1 >= QUESTIONS_PER_GAME) {
      const tierIndex = Math.max(0, DIFFICULTIES.findIndex(d => d.id === difficulty));
      const earned = coinsForResult(finalCorrect, tierIndex);
      setEarnedCoins(earned);
      persistReward({ ...reward, coins: reward.coins + earned });
      setGameState('result');
      if (user) saveScoreLocal(user.uid, { difficulty, correctCount: finalCorrect, totalQuestions: QUESTIONS_PER_GAME, createdAt: Date.now() });
    } else {
      setCurrentQIndex(prev => prev + 1);
      setUserAnswer('');
      setProblem(null);
      setGameState('playing');
      loadProblem(difficulty);
    }
  };

  const viewScores = async () => {
    if (user) setScores(getScoresLocal(user.uid));
    setGameState('scores');
  };

  const doPull = () => {
    const res = pullGacha(reward);
    if (!res) return;
    setPull(res);
    persistReward(res.data);
  };

  if (authLoading) {
    return <div className="min-h-screen flex items-center justify-center bg-slate-50"><Loader2 className="w-8 h-8 animate-spin text-blue-600" /></div>;
  }

  if (!user) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 p-4 font-sans text-slate-800">
        <div className="max-w-md w-full bg-white p-12 rounded-2xl border-2 border-slate-900 shadow-[8px_8px_0px_0px_rgba(15,23,42,1)] text-center">
          <div className="w-16 h-16 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center mx-auto mb-6"><UserIcon size={32} /></div>
          <h1 className="text-4xl font-black tracking-tighter text-blue-600 mb-2">MATH QUEST</h1>
          <p className="text-slate-500 mb-8 font-medium">算数から大学数学まで、あなたのレベルで問題をとこう。コインを集めてガチャでシールをコンプリート！</p>
          <button onClick={signInWithGoogle} className="w-full flex items-center justify-center gap-3 bg-blue-600 hover:bg-blue-700 text-white py-4 px-4 rounded-xl font-bold shadow-[4px_4px_0px_0px_rgba(15,23,42,1)] transition-all">
            Googleでログイン
          </button>
        </div>
      </div>
    );
  }

  const tierDesc = DIFFICULTIES.find(d => d.id === difficulty)?.desc || '';

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-800 font-sans selection:bg-blue-200">
      <header className="flex justify-between items-center border-b-2 border-slate-200 px-4 sm:px-8 py-4 bg-white sticky top-0 z-10 shadow-sm">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black tracking-tighter text-blue-600 cursor-pointer" onClick={() => setGameState('menu')}>
            MATH QUEST <span className="text-slate-400 font-light">v2.0</span>
          </h1>
        </div>
        <div className="flex items-center gap-3 sm:gap-5">
          <div className="flex items-center gap-2 bg-amber-100 border-2 border-amber-300 text-amber-700 px-3 py-1.5 rounded-xl font-black">
            <Coins size={18} /> <span className="tabular-nums">{reward.coins}</span>
          </div>
          <img src={user.photoURL || ''} alt="avatar" className="w-9 h-9 rounded-full border-2 border-slate-200 bg-gray-200 hidden sm:block" referrerPolicy="no-referrer" />
          <button onClick={signOut} className="text-slate-400 hover:text-slate-900 transition-colors"><LogOut size={22} /></button>
        </div>
      </header>

      <main className="flex-grow p-4 sm:p-8 max-w-5xl w-full mx-auto">
        {gameState === 'menu' && (
          <div className="flex flex-col animate-in fade-in slide-in-from-bottom-4 duration-500">
            <header className="mb-6 border-b-2 border-slate-200 pb-4">
              <h2 className="text-2xl sm:text-3xl font-black tracking-tighter text-slate-800 uppercase">レベルをえらぶ</h2>
              <p className="text-sm font-medium text-slate-500">あなたのレベルに合わせて問題を出します（3問1セット）。</p>
            </header>

            <nav className="grid grid-cols-2 md:grid-cols-5 gap-2 mb-6">
              {DIFFICULTIES.map(d => (
                <button key={d.id} onClick={() => startGame(d.id)}
                  className="py-6 px-3 bg-white border-2 border-slate-200 hover:border-slate-900 hover:shadow-[4px_4px_0px_0px_rgba(15,23,42,1)] text-slate-700 font-bold transition-all flex flex-col items-center justify-center gap-2 rounded-xl">
                  <Play size={22} className="text-blue-600" />
                  <span className="text-base">{d.label}</span>
                  <span className="text-[10px] text-slate-400">{d.desc}</span>
                </button>
              ))}
            </nav>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <button onClick={() => { setPull(null); setGameState('gacha'); }} className="flex items-center justify-center gap-2 text-white bg-purple-600 hover:bg-purple-700 font-bold px-4 py-4 rounded-xl border-2 border-slate-900 shadow-[4px_4px_0px_0px_rgba(15,23,42,1)] transition-all">
                <Gift size={20} /> ガチャを引く
              </button>
              <button onClick={() => setGameState('album')} className="flex items-center justify-center gap-2 text-slate-800 bg-white hover:bg-slate-50 font-bold px-4 py-4 rounded-xl border-2 border-slate-900 shadow-[4px_4px_0px_0px_rgba(15,23,42,1)] transition-all">
                <LayoutGrid size={20} /> シールちょう <span className="text-xs text-slate-400">({collectedCount(reward)}/{STICKERS.length})</span>
              </button>
              <button onClick={viewScores} className="flex items-center justify-center gap-2 text-blue-600 bg-white hover:bg-blue-50 font-bold px-4 py-4 rounded-xl border-2 border-blue-600 transition-all">
                <Trophy size={20} /> スコア
              </button>
            </div>
          </div>
        )}

        {gameState === 'playing' && problem && (
          <div className="grid grid-cols-12 gap-6 animate-in fade-in zoom-in-95 duration-300">
            <section className="col-span-12 lg:col-span-8 flex flex-col gap-6">
              <div className="flex-grow bg-white border-2 border-slate-900 rounded-2xl p-6 sm:p-10 flex flex-col relative shadow-[8px_8px_0px_0px_rgba(15,23,42,1)]">
                <span className="absolute top-5 left-6 text-xs font-mono font-bold bg-slate-100 text-slate-500 px-3 py-1 rounded">
                  第 {currentQIndex + 1} 問 / {QUESTIONS_PER_GAME}
                </span>
                <div className="mt-10 flex-grow flex flex-col">
                  <div className="text-2xl sm:text-3xl font-bold text-slate-800 leading-relaxed whitespace-pre-wrap mb-8 flex-grow">
                    {problem.problem}
                  </div>
                  <div className="space-y-3">
                    <label className="block text-xs font-bold uppercase tracking-widest text-slate-500">こたえ</label>
                    <input type="text" value={userAnswer} onChange={(e) => setUserAnswer(e.target.value)} placeholder="答えを入力..." autoFocus
                      className="w-full text-2xl font-bold px-6 py-4 bg-slate-50 border-2 border-slate-200 rounded-xl focus:border-blue-600 outline-none transition-all"
                      onKeyDown={(e) => e.key === 'Enter' && userAnswer.trim() && submitAnswer()} />
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
                    <div className="w-full bg-slate-700 h-2 rounded-full overflow-hidden"><div className="bg-blue-400 h-full transition-all" style={{ width: `${currentQIndex > 0 ? (correctCount / currentQIndex) * 100 : 0}%` }}></div></div>
                  </div>
                  <div>
                    <div className="flex justify-between text-sm font-bold mb-2"><span>すすみ</span><span className="text-green-400">{currentQIndex} / {QUESTIONS_PER_GAME}</span></div>
                    <div className="w-full bg-slate-700 h-2 rounded-full overflow-hidden"><div className="bg-green-400 h-full transition-all" style={{ width: `${(currentQIndex / QUESTIONS_PER_GAME) * 100}%` }}></div></div>
                  </div>
                </div>
              </div>
              <div className="bg-blue-100 p-6 rounded-2xl border-2 border-blue-200">
                <p className="text-xs font-black text-blue-800 uppercase tracking-widest mb-1">レベル</p>
                <p className="text-lg text-blue-700 font-black mb-1">{difficulty}</p>
                <p className="text-xs text-blue-600 font-medium">{tierDesc}</p>
              </div>
            </aside>
          </div>
        )}

        {gameState === 'explanation' && problem && (
          <div className="max-w-3xl mx-auto space-y-6 animate-in slide-in-from-bottom-8 duration-500">
            <div className={`p-6 sm:p-8 rounded-2xl border-2 flex items-start gap-5 shadow-[8px_8px_0px_0px_rgba(15,23,42,1)] bg-white ${isCorrect ? 'border-green-500' : 'border-red-500'}`}>
              {isCorrect ? <CheckCircle2 className="w-12 h-12 shrink-0 text-green-500" /> : <XCircle className="w-12 h-12 shrink-0 text-red-500" />}
              <div>
                <h3 className={`text-3xl font-black mb-3 tracking-tighter ${isCorrect ? 'text-green-600' : 'text-red-600'}`}>{isCorrect ? 'せいかい！' : 'ざんねん'}</h3>
                <p className="text-slate-500 font-bold text-xs uppercase tracking-widest mb-1">正しい答え</p>
                <p className="font-mono font-bold text-2xl text-slate-800 bg-slate-100 inline-block px-3 py-1 rounded mb-3">{problem.solution}</p>
                <p className="text-slate-500 font-bold text-xs uppercase tracking-widest mb-1">あなたの答え</p>
                <p className="font-mono font-bold text-xl text-slate-600">{userAnswer || '（未入力）'}</p>
              </div>
            </div>
            <div className="bg-white p-6 sm:p-8 rounded-2xl border-2 border-slate-200">
              <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-4">かいせつ</h4>
              <div className="text-slate-700 leading-relaxed whitespace-pre-wrap text-lg font-medium">{problem.explanation}</div>
            </div>
            <button onClick={nextQuestion}
              className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white py-5 rounded-xl font-black tracking-widest uppercase transition-all shadow-[8px_8px_0px_0px_rgba(15,23,42,1)] hover:translate-y-1 hover:shadow-[4px_4px_0px_0px_rgba(15,23,42,1)] text-lg">
              {currentQIndex + 1 >= QUESTIONS_PER_GAME ? 'けっかを見る' : 'つぎの問題'} <ArrowRight size={22} />
            </button>
          </div>
        )}

        {gameState === 'result' && (
          <div className="max-w-2xl mx-auto bg-white p-8 sm:p-12 rounded-3xl border-2 border-slate-900 shadow-[8px_8px_0px_0px_rgba(15,23,42,1)] text-center animate-in zoom-in-95 duration-500">
            <div className="w-24 h-24 bg-blue-600 text-white rounded-2xl border-4 border-slate-900 flex items-center justify-center mx-auto mb-6 shadow-[4px_4px_0px_0px_rgba(15,23,42,1)] -rotate-3"><Trophy size={48} /></div>
            <h2 className="text-3xl sm:text-4xl font-black tracking-tighter text-slate-900 mb-1 uppercase">クリア！</h2>
            <p className="text-sm font-bold text-slate-500 uppercase tracking-widest mb-8">レベル: {difficulty}</p>
            <div className="bg-slate-50 rounded-2xl p-6 mb-4 border-2 border-slate-200">
              <div className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">せいかい</div>
              <div className="text-6xl font-black text-blue-600 tracking-tighter">{correctCount}<span className="text-3xl text-slate-300 mx-2">/</span>{QUESTIONS_PER_GAME}</div>
            </div>
            <div className="flex items-center justify-center gap-2 bg-amber-100 border-2 border-amber-300 text-amber-700 rounded-2xl py-3 mb-8 font-black text-xl">
              <Coins size={22} /> +{earnedCoins} コイン ゲット！
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <button onClick={() => setGameState('menu')} className="flex items-center justify-center gap-2 bg-slate-900 hover:bg-slate-800 text-white py-4 rounded-xl font-bold transition-all shadow-[4px_4px_0px_0px_rgba(59,130,246,0.5)]"><Home size={18} /> ホーム</button>
              <button onClick={() => { setPull(null); setGameState('gacha'); }} className="flex items-center justify-center gap-2 bg-purple-600 hover:bg-purple-700 text-white py-4 rounded-xl font-bold transition-all shadow-[4px_4px_0px_0px_rgba(15,23,42,1)]"><Gift size={18} /> ガチャへ</button>
              <button onClick={() => startGame(difficulty)} className="flex items-center justify-center gap-2 bg-white border-2 border-slate-900 hover:bg-slate-50 text-slate-900 py-4 rounded-xl font-bold transition-all shadow-[4px_4px_0px_0px_rgba(15,23,42,1)]">もう1回</button>
            </div>
          </div>
        )}

        {gameState === 'gacha' && (
          <div className="max-w-xl mx-auto animate-in fade-in zoom-in-95 duration-300">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl sm:text-3xl font-black tracking-tighter text-purple-700 flex items-center gap-2"><Sparkles /> シールガチャ</h2>
              <button onClick={() => setGameState('menu')} className="text-slate-500 hover:text-slate-900 flex items-center gap-1 font-bold text-sm"><ArrowLeft size={18} /> もどる</button>
            </div>
            <div className="bg-white border-2 border-slate-900 rounded-2xl p-8 shadow-[8px_8px_0px_0px_rgba(15,23,42,1)] text-center">
              <div className="flex items-center justify-center gap-2 text-amber-600 font-black text-lg mb-6"><Coins size={22} /> もっているコイン: <span className="tabular-nums">{reward.coins}</span></div>

              <div className={`mx-auto mb-6 w-40 h-40 rounded-3xl border-4 flex items-center justify-center text-7xl transition-all ${pull ? `${RARITY[pull.sticker.rarity].bg} ${RARITY[pull.sticker.rarity].ring}` : 'bg-slate-100 border-slate-200'}`}>
                {pull ? <span className="animate-in zoom-in-50 duration-500">{pull.sticker.emoji}</span> : <Gift className="text-slate-300" size={64} />}
              </div>

              {pull && (
                <div className="mb-6 animate-in fade-in duration-500">
                  <span className={`inline-block text-xs font-black px-3 py-1 rounded-full border-2 ${RARITY[pull.sticker.rarity].ring} ${RARITY[pull.sticker.rarity].text} ${RARITY[pull.sticker.rarity].bg}`}>{RARITY[pull.sticker.rarity].label}</span>
                  <p className="text-2xl font-black text-slate-800 mt-2">{pull.sticker.name}</p>
                  <p className={`text-sm font-bold mt-1 ${pull.isNew ? 'text-green-600' : 'text-slate-400'}`}>{pull.isNew ? '✨ 新しいシール！' : `かぶり… +${DUP_REFUND}コイン もどってきた`}</p>
                </div>
              )}

              <button onClick={doPull} disabled={reward.coins < GACHA_COST}
                className="w-full flex items-center justify-center gap-2 bg-purple-600 hover:bg-purple-700 text-white py-5 rounded-xl font-black text-lg transition-all disabled:opacity-40 disabled:cursor-not-allowed shadow-[4px_4px_0px_0px_rgba(15,23,42,1)]">
                <Gift size={22} /> 1回引く（{GACHA_COST}コイン）
              </button>
              {reward.coins < GACHA_COST && <p className="text-xs text-slate-400 mt-3 font-bold">コインが足りません。問題をといて集めよう！</p>}

              <button onClick={() => setGameState('album')} className="mt-4 text-purple-600 font-bold text-sm flex items-center justify-center gap-1 mx-auto hover:underline"><LayoutGrid size={16} /> シールちょうを見る（{collectedCount(reward)}/{STICKERS.length}）</button>
            </div>
          </div>
        )}

        {gameState === 'album' && (
          <div className="max-w-4xl mx-auto animate-in fade-in duration-300">
            <div className="flex items-center justify-between mb-6 border-b-2 border-slate-200 pb-4">
              <h2 className="text-2xl sm:text-3xl font-black tracking-tighter text-slate-800 flex items-center gap-2"><LayoutGrid /> シールちょう
                <span className="text-base text-slate-400 font-bold">{collectedCount(reward)} / {STICKERS.length}</span>
              </h2>
              <button onClick={() => setGameState('menu')} className="text-slate-500 hover:text-slate-900 flex items-center gap-1 font-bold text-sm"><Home size={18} /> ホーム</button>
            </div>
            <div className="grid grid-cols-3 sm:grid-cols-5 md:grid-cols-6 gap-3">
              {STICKERS.map(s => {
                const count = reward.stickers[s.id] || 0;
                const owned = count > 0;
                return (
                  <div key={s.id} className={`aspect-square rounded-2xl border-2 flex flex-col items-center justify-center relative transition-all ${owned ? `${RARITY[s.rarity].bg} ${RARITY[s.rarity].ring}` : 'bg-slate-100 border-slate-200'}`}>
                    <span className={`text-4xl sm:text-5xl ${owned ? '' : 'grayscale opacity-20'}`}>{owned ? s.emoji : '❓'}</span>
                    <span className={`text-[10px] font-bold mt-1 ${owned ? RARITY[s.rarity].text : 'text-slate-300'}`}>{owned ? s.name : '？？？'}</span>
                    {count > 1 && <span className="absolute top-1 right-1 bg-slate-900 text-white text-[10px] font-black px-1.5 rounded-full">×{count}</span>}
                  </div>
                );
              })}
            </div>
            <div className="mt-6 flex justify-center">
              <button onClick={() => { setPull(null); setGameState('gacha'); }} className="flex items-center gap-2 bg-purple-600 hover:bg-purple-700 text-white font-bold px-6 py-3 rounded-xl border-2 border-slate-900 shadow-[4px_4px_0px_0px_rgba(15,23,42,1)]"><Gift size={18} /> ガチャを引く</button>
            </div>
          </div>
        )}

        {gameState === 'scores' && (
          <div className="max-w-3xl mx-auto animate-in fade-in duration-300">
            <header className="flex items-end justify-between mb-6 border-b-2 border-slate-200 pb-4">
              <h2 className="text-2xl sm:text-3xl font-black tracking-tighter text-slate-800 uppercase">スコア</h2>
              <button onClick={() => setGameState('menu')} className="text-slate-500 hover:text-slate-900 flex items-center gap-2 font-bold text-sm"><Home size={18} /> ホーム</button>
            </header>
            <div className="bg-white border-2 border-slate-900 rounded-2xl shadow-[8px_8px_0px_0px_rgba(15,23,42,1)] overflow-hidden">
              {scores.length === 0 ? (
                <div className="p-16 text-center text-slate-500 font-bold">まだ記録がありません。</div>
              ) : (
                <ul className="divide-y-2 divide-slate-100">
                  {scores.map((s, i) => (
                    <li key={s.id} className="p-5 sm:p-6 flex items-center justify-between hover:bg-slate-50 transition-colors">
                      <div className="flex items-center gap-5">
                        <div className="text-slate-300 font-black text-2xl w-8 text-center">{i + 1}</div>
                        <div className="space-y-1">
                          <div className="font-black text-lg text-slate-800">{s.difficulty}</div>
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
          </div>
        )}
      </main>
    </div>
  );
}
