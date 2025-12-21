import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Fish, Trophy, Info, Sparkles, BrainCircuit, MessageSquare, ArrowUp, ArrowDown, Check, Link as LinkIcon, X, BookOpen, Copy, Users, Monitor, Smartphone, RotateCcw, RotateCw } from 'lucide-react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, onAuthStateChanged, signInWithCustomToken } from 'firebase/auth';
import { getFirestore, collection, doc, setDoc, getDoc, onSnapshot, updateDoc } from 'firebase/firestore';

// --- CONFIGURACIÓ FIREBASE ---
const firebaseConfig = JSON.parse(__firebase_config);
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';

// --- ICONA PERSONALITZADA: TAURÓ ---
const SharkIcon = ({ size = 24, className = "", color = "currentColor", fill="none" }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill={fill} stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
  <path d="M22 14c-1.5 0-3-1-4.5-3-1.5-2-3.5-6-3.5-6s-2 3-4.5 4C6.5 10 4 11 2 11c3 5 8 6 13 5 3-.5 5-2 7-2z" />
  <path d="M14 5c.5 2 1 4 2 6" />
  <circle cx="18" cy="11" r="1" fill={color} stroke="none" />
  </svg>
);

// --- COMPONENT NOU: INDICADOR DE BOQUES (PUNTS) ---
const SharkMouthIcon = ({ type, size = 20, className = "" }) => {
  // Coordenades relatives per a un viewBox 0 0 24 24
  // Centre 12,12. Radi ~8.
  // Angles: 0 (top), 60, 120, 180...
  const points = [];

  if (type === PIECE_TYPES.SHARK_SMALL) {
    points.push({ cx: 12, cy: 4 }); // Top
  } else if (type === PIECE_TYPES.SHARK_BIG_60) {
    points.push({ cx: 12, cy: 4 }); // Top
    points.push({ cx: 19, cy: 8 }); // Top-Right (60)
  } else if (type === PIECE_TYPES.SHARK_BIG_120) {
    points.push({ cx: 12, cy: 4 }); // Top
    points.push({ cx: 19, cy: 16 }); // Bottom-Right (120)
  } else if (type === PIECE_TYPES.SHARK_BIG_180) {
    points.push({ cx: 12, cy: 4 }); // Top
    points.push({ cx: 12, cy: 20 }); // Bottom (180)
  } else if (type === 'GENERIC_BIG') { // Per al supply board general
    points.push({ cx: 12, cy: 4 });
    points.push({ cx: 12, cy: 20 });
  }

  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={className}>
    <circle cx="12" cy="12" r="11" fill="none" stroke="currentColor" strokeWidth="2" className="opacity-30" />
    {points.map((p, i) => (
      <circle key={i} cx={p.cx} cy={p.cy} r="3" fill="#f43f5e" /> // Rose-500
    ))}
    </svg>
  );
};

// --- FONS MARÍ MINIMALISTA ---
const MarinePattern = () => (
  <div className="absolute inset-0 z-[-1] pointer-events-none overflow-hidden">
  <svg width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
  <defs>
  <pattern id="waves" x="0" y="0" width="120" height="80" patternUnits="userSpaceOnUse">
  <path d="M0 40 Q 30 20, 60 40 T 120 40" fill="none" stroke="#0f172a" strokeWidth="1.5" opacity="0.15"/>
  <path d="M0 60 Q 30 40, 60 60 T 120 60" fill="none" stroke="#0f172a" strokeWidth="1" opacity="0.1"/>
  </pattern>
  </defs>
  <rect width="100%" height="100%" fill="url(#waves)" />
  </svg>
  <div className="absolute inset-0 bg-radial-gradient from-transparent to-cyan-950 opacity-40"></div>
  </div>
);

// --- CONSTANTS ---
const PLAYERS = { WHITE: 'white', BLACK: 'black' };
const PIECE_TYPES = {
  FISH: 'fish',
  SHARK_SMALL: 'shark_small',
  SHARK_BIG_60: 'shark_big_60',
  SHARK_BIG_120: 'shark_big_120',
  SHARK_BIG_180: 'shark_big_180',
};
const INITIAL_SUPPLY = {
  [PLAYERS.WHITE]: { fish: 14, shark_small: 3, shark_big_60: 1, shark_big_120: 1, shark_big_180: 1 },
  [PLAYERS.BLACK]: { fish: 14, shark_small: 3, shark_big_60: 1, shark_big_120: 1, shark_big_180: 1 },
};
const WINNING_CHAIN = 10;

// --- GEOMETRIA HEXAGONAL ---
const LAYOUT_SIZE = 60;
const DRAW_SIZE = 56;
const HEX_WIDTH = Math.sqrt(3) * DRAW_SIZE;
const HEX_HEIGHT = 2 * DRAW_SIZE;
const hexToPixel = (q, r) => ({ x: LAYOUT_SIZE * Math.sqrt(3) * (q + r/2), y: LAYOUT_SIZE * (3/2) * r });

const generateBoardCells = () => {
  const cells = [];
  const rows = [{ r: 0, qMin: -1, count: 3 }, { r: 1, qMin: -2, count: 4 }, { r: 2, qMin: -3, count: 5 }, { r: 3, qMin: -4, count: 6 }, { r: 4, qMin: -4, count: 5 }, { r: 5, qMin: -4, count: 4 }, { r: 6, qMin: -4, count: 3 }];
  rows.forEach(({ r, qMin, count }) => { for (let i = 0; i < count; i++) cells.push({ q: qMin + i, r: r, type: null, owner: null }); });
  return cells;
};
const getNeighbors = (q, r) => [{dq: 1, dr: 0}, {dq: 1, dr: -1}, {dq: 0, dr: -1}, {dq: -1, dr: 0}, {dq: -1, dr: 1}, {dq: 0, dr: 1}].map(d => ({ q: q + d.dq, r: r + d.dr }));

// --- TRADUCCIONS ---
const TRANSLATIONS = {
  ca: {
    title: "XOK", edition: "Edició Digital", turn: "Torn", white: "BLANC", black: "NEGRE",
    actions: "Accions", rules: "Regles", supply: "Disponibles", chain: "Cadena",
    fish_btn: "2 Peixos", fish_sub: "Adjacents", shark_btn: "1 Tauró", shark_sub: "Menja enemic",
    lobby_create: "Crear Sala En Línia", lobby_join: "Unir-se a Sala", lobby_id_ph: "Codi de sala...", lobby_enter: "Entrar",
    lobby_local: "Jugar en Local (Passa i Juga)",
    lobby_waiting: "Esperant oponent...", lobby_share: "Comparteix aquest codi:",
    lobby_online_divider: "EN LÍNIA",
    game_over: "FINAL", win_msg: "GUANYA!", play_again: "Jugar de nou", exit_lobby: "Sortir al Menú",
    log_welcome: "Benvingut!", log_turn: "Torn de",
    win_reason: "Cadena de 10 peces!",
    config_shark: "Configurar Tauró", rotate_hint: "Clica direcció",
    you_are: "Ets el jugador",
    err_full: "Sala plena o no existeix.", err_auth: "Error d'autenticació.",
    local_mode_badge: "MODE LOCAL", online_mode_badge: "EN LÍNIA",
    tap_confirm: "Clica de nou per confirmar"
  },
  en: {
    title: "XOK", edition: "Digital Edition", turn: "Turn", white: "WHITE", black: "BLACK",
    actions: "Actions", rules: "Rules", supply: "Available", chain: "Chain",
    fish_btn: "2 Fish", fish_sub: "Adjacent", shark_btn: "1 Shark", shark_sub: "Eats enemy",
    lobby_create: "Create Online Room", lobby_join: "Join Room", lobby_id_ph: "Room Code...", lobby_enter: "Enter",
    lobby_local: "Play Local (Pass & Play)",
    lobby_waiting: "Waiting for opponent...", lobby_share: "Share code:",
    lobby_online_divider: "ONLINE",
    game_over: "GAME OVER", win_msg: "WINS!", play_again: "Play Again", exit_lobby: "Exit to Menu",
    log_welcome: "Welcome!", log_turn: "Turn of",
    win_reason: "Chain of 10 pieces!",
    config_shark: "Shark Config", rotate_hint: "Click direction",
    you_are: "You are",
    err_full: "Room full or not found.", err_auth: "Auth error.",
    local_mode_badge: "LOCAL MODE", online_mode_badge: "ONLINE",
    tap_confirm: "Tap again to confirm"
  },
  es: {
    title: "XOK", edition: "Edición Digital", turn: "Turno", white: "BLANCO", black: "NEGRO",
    actions: "Acciones", rules: "Reglas", supply: "Disponibles", chain: "Cadena",
    fish_btn: "2 Peces", fish_sub: "Adyacentes", shark_btn: "1 Tiburón", shark_sub: "Come enemigo",
    lobby_create: "Crear Sala En Línea", lobby_join: "Unirse a Sala", lobby_id_ph: "Código de sala...", lobby_enter: "Entrar",
    lobby_local: "Jugar en Local (Pasa y Juega)",
    lobby_waiting: "Esperando oponente...", lobby_share: "Comparte este código:",
    lobby_online_divider: "EN LÍNEA",
    game_over: "FINAL", win_msg: "GANA!", play_again: "Jugar de nuevo", exit_lobby: "Salir al Menú",
    log_welcome: "¡Bienvenido!", log_turn: "Turno de",
    win_reason: "¡Cadena de 10 piezas!",
    config_shark: "Configurar Tiburón", rotate_hint: "Clic dirección",
    you_are: "Eres el jugador",
    err_full: "Sala llena o no existe.", err_auth: "Error de autenticación.",
    local_mode_badge: "MODO LOCAL", online_mode_badge: "EN LÍNEA",
    tap_confirm: "Pulsa de nuevo para confirmar"
  }
};

// --- API IA ---
const callGeminiAPI = async (prompt) => {
  const apiKey = "";
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${apiKey}`;
  const payload = { contents: [{ parts: [{ text: prompt }] }] };
  try {
    const response = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    if (!response.ok) throw new Error('API Error');
    const data = await response.json();
    return data.candidates?.[0]?.content?.parts?.[0]?.text || "Error.";
  } catch (error) { return "Error."; }
};

// --- COMPONENTS UI ---
const Button = ({ onClick, disabled, children, className = "", variant = "primary" }) => {
  const variants = {
    primary: "bg-teal-600 text-white hover:bg-teal-500 disabled:bg-slate-300 disabled:shadow-none shadow-teal-900/20",
    secondary: "bg-indigo-600 text-white hover:bg-indigo-500 disabled:bg-slate-300 shadow-indigo-900/20",
    outline: "border-2 border-slate-300 hover:bg-slate-50 text-slate-700",
    magic: "bg-gradient-to-r from-purple-600 to-pink-600 text-white hover:from-purple-500 hover:to-pink-500 shadow-purple-900/20",
    ghost: "bg-transparent hover:bg-slate-100 text-slate-600"
  };
  return <button onClick={onClick} disabled={disabled} className={`px-4 py-3 rounded-xl font-bold transition-all transform active:scale-95 flex items-center justify-center gap-2 shadow-sm text-sm ${variants[variant]} ${className}`}>{children}</button>;
};

const Modal = ({ title, children, onClose }) => (
  <div className="fixed inset-0 bg-slate-900/60 z-50 flex items-center justify-center p-4 backdrop-blur-md">
  <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full p-8 animate-in fade-in zoom-in duration-300 border border-white/50 relative">
  <button onClick={onClose} className="absolute top-4 right-4 text-slate-400 hover:text-slate-600"><X size={24} /></button>
  <h3 className="text-3xl font-black text-slate-800 mb-6 font-mono uppercase tracking-tighter text-center">{title}</h3>
  <div className="mb-8 max-h-[60vh] overflow-y-auto">{children}</div>
  </div>
  </div>
);

const AIResponseBox = ({ loading, response, type, onClose }) => {
  if (!loading && !response) return null;
  return (
    <div className="mt-4 p-4 rounded-xl bg-gradient-to-br from-indigo-50 to-purple-50 border border-indigo-100 shadow-inner relative animate-in slide-in-from-top-4">
    <div className="flex items-center gap-2 mb-2 text-indigo-700 font-bold uppercase text-xs tracking-widest"><Sparkles size={14} /> {type === 'tactics' ? 'Consell' : 'Comentar'}</div>
    {loading ? <div className="text-slate-500 text-xs animate-pulse">...</div> : <div className="text-slate-700 text-sm leading-relaxed">{response}</div>}
    {!loading && <button onClick={onClose} className="absolute top-2 right-2 text-indigo-300 hover:text-indigo-500"><X size={16} /></button>}
    </div>
  );
};

// --- SUBCOMPONENTS EXTRETS ---

const SupplyBoard = ({ turn, supply, chainLengths, playerColor, isLocal, t }) => (
  <div className="grid grid-cols-2 gap-3 mb-6 bg-slate-50 p-3 rounded-2xl border border-slate-200">
  <div className={`text-center p-2 rounded-xl transition-all ${turn === PLAYERS.WHITE ? 'bg-white shadow-md ring-2 ring-teal-500' : 'opacity-50 grayscale'}`}>
  <div className="font-black text-slate-800 text-sm mb-2">{t('white')} {playerColor === PLAYERS.WHITE && !isLocal && "(TU)"}</div>
  <div className="flex flex-col gap-1 text-xs mb-2 items-center">
  <div className="flex justify-between items-center w-full px-4"><Fish size={14}/> <b>{supply.white.fish}</b></div>
  <div className="flex justify-between items-center w-full px-4 mt-1"><SharkMouthIcon type={PIECE_TYPES.SHARK_SMALL} size={14} className="text-slate-500"/> <b>{supply.white.shark_small}</b></div>
  <div className="flex justify-between items-center w-full px-4 mt-1"><SharkMouthIcon type="GENERIC_BIG" size={14} className="text-slate-500"/> <b>{supply.white.shark_big_60 + supply.white.shark_big_120 + supply.white.shark_big_180}</b></div>
  </div>
  <div className={`mt-2 pt-1 border-t border-slate-100 flex justify-between items-center ${chainLengths.white >= 10 ? 'text-green-600 font-bold' : 'text-slate-600'}`}>
  <span className="text-[10px] uppercase font-bold tracking-tighter">{t('chain')}</span>
  <span className="flex items-center gap-1"><LinkIcon size={12}/> {chainLengths.white}</span>
  </div>
  </div>
  <div className={`text-center p-2 rounded-xl transition-all ${turn === PLAYERS.BLACK ? 'bg-slate-900 text-white shadow-md ring-2 ring-teal-500' : 'opacity-50 grayscale'}`}>
  <div className="font-black text-white text-sm mb-2">{t('black')} {playerColor === PLAYERS.BLACK && !isLocal && "(TU)"}</div>
  <div className="flex flex-col gap-1 text-xs mb-2 items-center">
  <div className="flex justify-between items-center w-full px-4"><Fish size={14}/> <b>{supply.black.fish}</b></div>
  <div className="flex justify-between items-center w-full px-4 mt-1"><SharkMouthIcon type={PIECE_TYPES.SHARK_SMALL} size={14} className="text-slate-400"/> <b>{supply.black.shark_small}</b></div>
  <div className="flex justify-between items-center w-full px-4 mt-1"><SharkMouthIcon type="GENERIC_BIG" size={14} className="text-slate-400"/> <b>{supply.black.shark_big_60 + supply.black.shark_big_120 + supply.black.shark_big_180}</b></div>
  </div>
  <div className={`mt-2 pt-1 border-t border-slate-700 flex justify-between items-center ${chainLengths.black >= 10 ? 'text-green-400 font-bold' : 'text-slate-300'}`}>
  <span className="text-[10px] uppercase font-bold tracking-tighter">{t('chain')}</span>
  <span className="flex items-center gap-1"><LinkIcon size={12}/> {chainLengths.black}</span>
  </div>
  </div>
  </div>
);

const SharkConfigPanel = ({ sharkSelection, setSharkSelection, supply, turn, currentMouths, t }) => {
  const rotate = (direction) => setSharkSelection(prev => ({ ...prev, rotation: direction === 'cw' ? (prev.rotation + 1) % 6 : (prev.rotation + 5) % 6 }));
  const currentType = sharkSelection.type;
  const count = supply[turn][currentType];

  const btnCls = (type) => {
    const num = supply[turn][type];
    const isActive = currentType === type;
    const isDisabled = num === 0;
    let base = `flex-1 py-2 rounded-lg border flex flex-col items-center justify-center gap-1 transition-all `;
    if (isActive) return base + 'bg-white border-teal-500 text-teal-700 shadow-sm ring-1 ring-teal-200';
    if (isDisabled) return base + 'bg-slate-50 border-slate-100 text-slate-300 decoration-red-400 line-through decoration-2 opacity-60';
    return base + 'bg-slate-100 border-transparent text-slate-400 hover:bg-slate-200';
  };

  return (
    <div className="mt-4 p-4 bg-slate-50 rounded-xl border border-slate-200 animate-in slide-in-from-left-4">
    <h4 className="text-xs font-black uppercase text-slate-400 mb-3 tracking-wider">{t('config_shark')}</h4>
    <div className="grid grid-cols-4 gap-1 mb-4">
    <button onClick={() => setSharkSelection({type: PIECE_TYPES.SHARK_SMALL, rotation: 0})} className={btnCls(PIECE_TYPES.SHARK_SMALL)} disabled={supply[turn].shark_small === 0}>
    <SharkMouthIcon type={PIECE_TYPES.SHARK_SMALL} />
    </button>
    <button onClick={() => setSharkSelection({type: PIECE_TYPES.SHARK_BIG_60, rotation: 0})} className={btnCls(PIECE_TYPES.SHARK_BIG_60)} disabled={supply[turn].shark_big_60 === 0}>
    <SharkMouthIcon type={PIECE_TYPES.SHARK_BIG_60} />
    </button>
    <button onClick={() => setSharkSelection({type: PIECE_TYPES.SHARK_BIG_120, rotation: 0})} className={btnCls(PIECE_TYPES.SHARK_BIG_120)} disabled={supply[turn].shark_big_120 === 0}>
    <SharkMouthIcon type={PIECE_TYPES.SHARK_BIG_120} />
    </button>
    <button onClick={() => setSharkSelection({type: PIECE_TYPES.SHARK_BIG_180, rotation: 0})} className={btnCls(PIECE_TYPES.SHARK_BIG_180)} disabled={supply[turn].shark_big_180 === 0}>
    <SharkMouthIcon type={PIECE_TYPES.SHARK_BIG_180} />
    </button>
    </div>
    <div className="flex items-center justify-between mb-4">
    {/* Left Button: Action CCW, Icon RotateCw (Swapped image) */}
    <button onClick={() => rotate('ccw')} className="w-12 h-12 p-2 bg-white rounded-full border border-slate-200 hover:bg-teal-50 text-slate-500 hover:text-teal-600 shadow-sm transition-all active:scale-95 flex items-center justify-center">
    <RotateCw size={24} strokeWidth={2.5}/>
    </button>

    <div className="relative w-24 h-24">
    <div className="absolute inset-0 flex items-center justify-center pointer-events-none"><SharkIcon size={24} color="#64748b" /></div>
    {[0, 1, 2, 3, 4, 5].map(dir => {
      const angle = [0, 300, 240, 180, 120, 60][dir]; const rad = (angle * Math.PI) / 180;
      const x = Math.cos(rad) * 38 + 48 - 6; const y = Math.sin(rad) * 38 + 48 - 6;
      return <div key={dir} style={{ left: x, top: y }} className={`absolute w-3 h-3 rounded-full border transition-all ${currentMouths.includes(dir) ? 'bg-rose-500 border-rose-600 scale-125 shadow-sm' : 'bg-slate-200 border-slate-300'}`} />
    })}
    </div>

    {/* Right Button: Action CW, Icon RotateCcw (Swapped image) */}
    <button onClick={() => rotate('cw')} className="w-12 h-12 p-2 bg-white rounded-full border border-slate-200 hover:bg-teal-50 text-slate-500 hover:text-teal-600 shadow-sm transition-all active:scale-95 flex items-center justify-center">
    <RotateCcw size={24} strokeWidth={2.5}/>
    </button>
    </div>
    <div className="pt-3 border-t border-slate-200 text-center">
    <div className="text-[10px] uppercase font-bold text-slate-400 mb-2">{t('supply')}</div>
    <div className="flex justify-center gap-1">{Array.from({length: count}).map((_, i) => <div key={i} className="w-6 h-6 rounded border bg-white border-slate-200 flex items-center justify-center shadow-sm"><SharkIcon size={14} color="#64748b" /></div>)} {count === 0 && <span className="text-xs text-rose-500 font-bold">0</span>}</div>
    </div>
    </div>
  );
};

// --- APP PRINCIPAL ---
export default function XokGameHex() {
  // --- ESTATS FIREBASE / MULTIJUGADOR ---
  const [user, setUser] = useState(null);
  const [roomId, setRoomId] = useState(null);
  const [playerColor, setPlayerColor] = useState(null);
  const [isJoined, setIsJoined] = useState(false);
  const [isLocal, setIsLocal] = useState(false);
  const [inputRoomId, setInputRoomId] = useState('');

  // --- ESTATS DE JOC ---
  const [board, setBoard] = useState(generateBoardCells);
  const [turn, setTurn] = useState(PLAYERS.WHITE);
  const [supply, setSupply] = useState(JSON.parse(JSON.stringify(INITIAL_SUPPLY)));
  const [winner, setWinner] = useState(null);
  const [winReason, setWinReason] = useState('');
  const [gameLog, setGameLog] = useState(["Benvingut a XOK!"]);

  // --- ESTATS UI ---
  const [phase, setPhase] = useState('SELECT_ACTION');
  const [selectedAction, setSelectedAction] = useState(null);
  const [tempMove, setTempMove] = useState({});
  const [confirmMove, setConfirmMove] = useState(null); // { q, r } per confirmar
  const [aiState, setAiState] = useState({ loading: false, response: null, type: null });
  const [hoverCell, setHoverCell] = useState(null);
  const [sharkSelection, setSharkSelection] = useState({ type: PIECE_TYPES.SHARK_SMALL, rotation: 0 });
  const [lang, setLang] = useState('ca');
  const [showRules, setShowRules] = useState(false);

  const t = (key) => TRANSLATIONS[lang][key] || key;

  // 1. INIT AUTH
  useEffect(() => {
    const initAuth = async () => {
      if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
        await signInWithCustomToken(auth, __initial_auth_token);
      } else {
        await signInAnonymously(auth);
      }
    };
    initAuth();
    const unsubscribe = onAuthStateChanged(auth, setUser);
    return () => unsubscribe();
  }, []);

  // 2. ROOM SYNC
  useEffect(() => {
    if (!user || !roomId || isLocal) return;
    const roomRef = doc(db, 'artifacts', appId, 'public', 'data', 'xok_rooms', roomId);
    const unsubscribe = onSnapshot(roomRef, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data();
        setBoard(JSON.parse(data.board));
        setTurn(data.turn);
        setSupply(data.supply);
        setWinner(data.winner);
        setWinReason(data.winReason);
        if (data.logs) setGameLog(data.logs);
        // Si canvia el torn, reset confirm
        if (data.turn !== turn) setConfirmMove(null);
      }
    }, (error) => console.error("Error sync:", error));
    return () => unsubscribe();
  }, [user, roomId, isLocal]);

  // --- FUNCIONS DE SALA ---
  const createRoom = async () => {
    if (!user) return;
    const newRoomId = Math.random().toString(36).substring(2, 8).toUpperCase();
    const roomRef = doc(db, 'artifacts', appId, 'public', 'data', 'xok_rooms', newRoomId);
    const initialState = {
      board: JSON.stringify(generateBoardCells()),
      turn: PLAYERS.WHITE,
      supply: INITIAL_SUPPLY,
      winner: null,
      winReason: '',
      logs: [t('log_welcome')],
      createdAt: new Date().toISOString()
    };
    await setDoc(roomRef, initialState);
    setRoomId(newRoomId);
    setPlayerColor(PLAYERS.WHITE);
    setIsLocal(false);
    setIsJoined(true);
  };

  const joinRoom = async () => {
    if (!user || !inputRoomId) return;
    const cleanId = inputRoomId.toUpperCase().trim();
    const roomRef = doc(db, 'artifacts', appId, 'public', 'data', 'xok_rooms', cleanId);
    const snap = await getDoc(roomRef);
    if (snap.exists()) {
      setRoomId(cleanId);
      setPlayerColor(PLAYERS.BLACK);
      setIsLocal(false);
      setIsJoined(true);
    } else {
      alert(t('err_full'));
    }
  };

  const startLocalGame = () => {
    setRoomId(null); setPlayerColor(null); setIsLocal(true); setIsJoined(true);
    setBoard(generateBoardCells()); setSupply(JSON.parse(JSON.stringify(INITIAL_SUPPLY))); setTurn(PLAYERS.WHITE);
    setGameLog([t('log_welcome')]);
  };

  const exitLobby = () => {
    setIsJoined(false); setRoomId(null); setIsLocal(false); setWinner(null);
    setBoard(generateBoardCells()); setSupply(JSON.parse(JSON.stringify(INITIAL_SUPPLY)));
  };

  const updateGameState = async (newBoard, newSupply, nextTurn, newLogs, newWinner = null, newReason = '') => {
    if (isLocal) {
      setBoard(newBoard); setSupply(newSupply); setTurn(nextTurn); setGameLog(newLogs);
      if (newWinner) { setWinner(newWinner); setWinReason(newReason); }
      return;
    }
    if (!roomId) return;
    const roomRef = doc(db, 'artifacts', appId, 'public', 'data', 'xok_rooms', roomId);
    await updateDoc(roomRef, {
      board: JSON.stringify(newBoard), supply: newSupply, turn: nextTurn, logs: newLogs,
                    winner: newWinner, winReason: newReason
    });
  };

  // --- LÒGICA DE JOC ---
  const calculateChains = useCallback((currentBoard) => {
    const visited = new Set();
    const cellMap = new Map();
    currentBoard.forEach(c => cellMap.set(`${c.q},${c.r}`, c));
    const getChainSize = (startQ, startR, player) => {
      const stack = [{q: startQ, r: startR}];
      const seen = new Set([`${startQ},${startR}`]);
      let size = 0;
      while(stack.length){
        const {q, r} = stack.pop();
        const cell = cellMap.get(`${q},${r}`);
        if(cell && (cell.type === PIECE_TYPES.FISH || cell.type.includes('shark'))) size++;
        getNeighbors(q, r).forEach(n => {
          const key = `${n.q},${n.r}`;
          const nCell = cellMap.get(key);
          if(nCell && nCell.owner === player && !seen.has(key)) { seen.add(key); stack.push(n); }
        });
      }
      return size;
    };
    let maxChains = { [PLAYERS.WHITE]: 0, [PLAYERS.BLACK]: 0 };
    currentBoard.forEach(cell => {
      if(cell.owner && !visited.has(`${cell.q},${cell.r}`)) {
        const size = getChainSize(cell.q, cell.r, cell.owner);
        if(size > maxChains[cell.owner]) maxChains[cell.owner] = size;
        visited.add(`${cell.q},${cell.r}`);
      }
    });
    return maxChains;
  }, []);

  const chainLengths = useMemo(() => calculateChains(board), [board, calculateChains]);

  const checkWinLocal = (currentBoard) => {
    const maxChains = calculateChains(currentBoard);
    if (maxChains[turn] >= WINNING_CHAIN) return { winner: turn, reason: t('win_reason') };
    if (maxChains[turn === 'white' ? 'black' : 'white'] >= WINNING_CHAIN) return { winner: turn === 'white' ? 'black' : 'white', reason: t('win_reason') };
    return null;
  };

  const getActiveMouths = useCallback((type, rotation) => {
    if (type === PIECE_TYPES.SHARK_SMALL) return [rotation];
    if (type === PIECE_TYPES.SHARK_BIG_60) return [rotation, (rotation + 1) % 6];
    if (type === PIECE_TYPES.SHARK_BIG_120) return [rotation, (rotation + 2) % 6];
    if (type === PIECE_TYPES.SHARK_BIG_180) return [rotation, (rotation + 3) % 6];
    return [rotation];
  }, []);

  const currentMouths = useMemo(() => getActiveMouths(sharkSelection.type, sharkSelection.rotation), [sharkSelection, getActiveMouths]);

  const getImpactedCells = (targetQ, targetR) => {
    if (selectedAction !== 'shark') return [];
    const targetCell = board.find(c => c.q === targetQ && c.r === targetR);
    if (!targetCell || (targetCell.owner === turn) || (targetCell.type && targetCell.type.includes('shark'))) return [];
    const impacted = [];
    if (targetCell.type === PIECE_TYPES.FISH && targetCell.owner !== turn) impacted.push({ q: targetQ, r: targetR });
    const neighbors = getNeighbors(targetQ, targetR);
    currentMouths.forEach(dirIdx => {
      const nCoords = neighbors[dirIdx];
      const nCell = board.find(c => c.q === nCoords.q && c.r === nCoords.r);
      if (nCell && nCell.type === PIECE_TYPES.FISH && nCell.owner !== turn && !impacted.some(ic => ic.q === nCoords.q && ic.r === nCoords.r)) {
        impacted.push({ q: nCoords.q, r: nCoords.r });
      }
    });
    return impacted;
  };
  const impactedCells = useMemo(() => {
    // Use confirmMove coordinates if exists, otherwise hover
    const target = confirmMove || hoverCell;
    return (target && selectedAction === 'shark') ? getImpactedCells(target.q, target.r) : [];
  }, [confirmMove, hoverCell, selectedAction, currentMouths, board, turn]);

  // --- EXECUCIÓ DE TORNS ---
  const endTurnDB = async (newBoard, newSupply) => {
    const winResult = checkWinLocal(newBoard);
    const nextPlayer = turn === PLAYERS.WHITE ? PLAYERS.BLACK : PLAYERS.WHITE;
    const logMsg = `${turn === 'white' ? t('white') : t('black')} ha mogut.`;
    const newLogs = [logMsg, ...gameLog].slice(0, 5);

    await updateGameState(
      newBoard,
      newSupply,
      nextPlayer,
      newLogs,
      winResult ? winResult.winner : null,
      winResult ? winResult.reason : ''
    );

    setPhase('SELECT_ACTION'); setSelectedAction(null); setTempMove({}); setConfirmMove(null);
    const nextSupply = newSupply[nextPlayer];
    setSharkSelection({ type: nextSupply.shark_small > 0 ? PIECE_TYPES.SHARK_SMALL : (nextSupply.shark_big_60 > 0 ? PIECE_TYPES.SHARK_BIG_60 : (nextSupply.shark_big_120 > 0 ? PIECE_TYPES.SHARK_BIG_120 : PIECE_TYPES.SHARK_BIG_180)), rotation: 0 });
  };

  const handleCellClick = (cell) => {
    if (winner || !cell) return;
    if (!isLocal && turn !== playerColor) return;

    const { q, r } = cell;

    // --- LÒGICA DE CONFIRMACIÓ ---

    if (selectedAction === 'shark' || phase === 'PLACING_FISH_2') {
      if (!confirmMove || confirmMove.q !== q || confirmMove.r !== r) {
        // Validar abans de seleccionar si és possible
        let valid = false;
        if (selectedAction === 'shark') {
          valid = !(cell.owner === turn || (cell.type && cell.type.includes('shark')));
        } else if (phase === 'PLACING_FISH_2') {
          const neighbors = getNeighbors(tempMove.q1, tempMove.r1);
          valid = !cell.type && neighbors.some(n => n.q === q && n.r === r);
        }

        if (valid) {
          setConfirmMove({ q, r });
        } else if (selectedAction === 'shark') {
          addLog(t('log_shark_invalid'));
        } else {
          addLog(t('log_fish_adj'));
        }
        return; // Esperem confirmació
      }
    }

    // SI ARRIBEM AQUÍ, ÉS QUE HEM CLICAT LA MATEIXA CE·LLA -> EXECUTAR

    if (selectedAction === 'fish') {
      if (supply[turn].fish < 2) return;
      if (phase === 'PLACING_FISH_1') {
        if (cell.type) return;
        setTempMove({ q1: q, r1: r });
        setPhase('PLACING_FISH_2');
      } else if (phase === 'PLACING_FISH_2') {
        // Ejecutar Fish 2 (Ja sabem que és vàlid per la lògica de confirmació anterior)
        const newBoard = board.map(c => ((c.q === tempMove.q1 && c.r === tempMove.r1) || (c.q === q && c.r === r)) ? { ...c, type: PIECE_TYPES.FISH, owner: turn } : c);
        const newSupply = { ...supply, [turn]: { ...supply[turn], fish: supply[turn].fish - 2 } };
        endTurnDB(newBoard, newSupply);
      }
    }

    if (selectedAction === 'shark') {
      const sharkType = sharkSelection.type;
      if (supply[turn][sharkType] <= 0) return;

      const fishToEatIndices = getImpactedCells(q, r).map(ic => board.findIndex(c => c.q === ic.q && c.r === ic.r));
      if (fishToEatIndices.length === 0) { addLog(t('log_shark_must_eat')); return; }

      const newBoard = board.map(c => ({...c}));
      const newSupply = JSON.parse(JSON.stringify(supply));
      const targetCellIndex = newBoard.findIndex(c => c.q === q && c.r === r);

      fishToEatIndices.forEach(idx => {
        const c = newBoard[idx];
        newSupply[c.owner].fish += 1;
        if (c.q !== q || c.r !== r) { newBoard[idx].type = null; newBoard[idx].owner = null; }
      });
      newBoard[targetCellIndex].type = sharkType;
      newBoard[targetCellIndex].owner = turn;
      newBoard[targetCellIndex].mouths = currentMouths;
      newSupply[turn][sharkType] -= 1;
      endTurnDB(newBoard, newSupply);
    }
  };

  const handleActionChange = (action) => {
    setSelectedAction(action);
    setPhase(action === 'fish' ? 'PLACING_FISH_1' : 'SELECT_ACTION');
    setTempMove({});
    setConfirmMove(null); // Netejar confirmació en canviar d'eina
  };

  const renderCell = (cell) => {
    const { x, y } = hexToPixel(cell.q, cell.r);
    const centerX = 0; const centerY = -270;

    // Estat de confirmació té prioritat sobre hover
    const isConfirmedPos = confirmMove && confirmMove.q === cell.q && confirmMove.r === cell.r;
    const isHovered = !isConfirmedPos && hoverCell && hoverCell.q === cell.q && hoverCell.r === cell.r;

    let isHighlight = false, isValidTarget = false, isImpacted = false, showGhostShark = false, showGhostFish = false;

    // Logic peixos
    if (turn === playerColor || isLocal) {
      if (selectedAction === 'fish') {
        if (phase === 'PLACING_FISH_1' && !cell.type) isValidTarget = true;
        if (phase === 'PLACING_FISH_2') {
          // Highlight first selection
          if (tempMove.q1 === cell.q && tempMove.r1 === cell.r) isHighlight = true;

          // Logic for second fish
          if (!cell.type) {
            const ns = getNeighbors(tempMove.q1, tempMove.r1);
            if (ns.some(n => n.q === cell.q && n.r === cell.r)) {
              isValidTarget = true;
              // Show ghost if confirming or hovering this cell
              if (isConfirmedPos || isHovered) showGhostFish = true;
            }
          }
        }
      }
      if (selectedAction === 'shark') {
        const canPlaceShark = !cell.owner || (cell.owner !== turn && (!cell.type || !cell.type.includes('shark')));
        if (canPlaceShark) isValidTarget = true;

        // Show preview if confirmed pos or hover
        if ((isConfirmedPos || isHovered) && canPlaceShark) {
          showGhostShark = true;
          // Calculate impacts for this specific cell (either confirmed or hovered)
          const targetCells = getImpactedCells(cell.q, cell.r);
          if (targetCells.length > 0) {
            // Aquesta cel·la genera impactes, però els impactes són altres cel·les.
            // La lògica global 'impactedCells' gestiona el highlight vermell de les altres.
          }
        }

        // Highlight vermell si algú (hover o confirm) m'està apuntant a mi
        // 'impactedCells' es calcula basant-se en 'confirmMove' O 'hoverCell' al useMemo principal
        if (impactedCells.some(ic => ic.q === cell.q && ic.r === cell.r)) isImpacted = true;
      }
    }

    const isWhite = cell.owner === PLAYERS.WHITE;
    const pieceColor = isWhite ? 'text-slate-900' : 'text-white';
    const bgColor = isWhite ? 'bg-white border-2 border-slate-200' : 'bg-slate-900 border-2 border-slate-700';

    return (
      <div key={`${cell.q},${cell.r}`} onClick={() => handleCellClick(cell)} onMouseEnter={() => setHoverCell(cell)} onMouseLeave={() => setHoverCell(null)}
      style={{ position: 'absolute', left: `calc(50% + ${x + centerX}px)`, top: `calc(50% + ${y + centerY}px)`, width: `${HEX_WIDTH}px`, height: `${HEX_HEIGHT}px`, marginLeft: `-${HEX_WIDTH/2}px`, marginTop: `-${HEX_HEIGHT/2}px`, clipPath: "polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)", zIndex: isConfirmedPos ? 50 : 10, cursor: (isLocal || turn === playerColor) ? 'pointer' : 'default' }}
      className={`flex items-center justify-center transition-all duration-200 ${isImpacted ? 'bg-rose-500/80 animate-pulse border-rose-600 border-2' : ''} ${!isImpacted && isValidTarget && !isConfirmedPos ? 'bg-teal-400 hover:bg-teal-300' : ''} ${!isImpacted && !isValidTarget ? 'bg-white/20 hover:bg-white/30' : ''} ${isHighlight ? 'bg-teal-500' : ''} ${!isValidTarget && !isHighlight && !isImpacted && !isConfirmedPos ? 'backdrop-blur-[1px]' : ''} ${isConfirmedPos ? 'bg-teal-200 ring-4 ring-teal-400 z-50 scale-105' : ''}`}>

      {/* Pieces */}
      {cell.type === PIECE_TYPES.FISH && <div className={`w-12 h-12 rounded-full ${bgColor} flex items-center justify-center shadow-md ${isImpacted ? 'opacity-50 grayscale' : ''}`}><Fish className={pieceColor} size={26} strokeWidth={2.5} /></div>}
      {cell.type && cell.type.includes('shark') && <div className={`w-14 h-14 rounded-xl ${bgColor} flex items-center justify-center relative shadow-lg`}><SharkIcon color={isWhite ? "#0f172a" : "#ffffff"} size={32} />{cell.mouths.map((m, i) => <div key={i} className="absolute w-full h-full pointer-events-none" style={{ transform: `rotate(${[0, -60, -120, 180, 120, 60][m]}deg)` }}><div className="absolute right-[-8px] top-1/2 -mt-2 w-0 h-0 border-l-[10px] border-l-rose-500 border-y-[7px] border-y-transparent"></div></div>)}</div>}

      {/* Ghost Shark */}
      {showGhostShark && <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-60 z-20"><div className={`w-14 h-14 rounded-xl ${turn === PLAYERS.WHITE ? 'bg-white border-slate-300' : 'bg-slate-800 border-slate-600'} border-2 flex items-center justify-center relative shadow-lg`}><SharkIcon color={turn === PLAYERS.WHITE ? "#0f172a" : "#ffffff"} size={32} />{currentMouths.map((m, i) => <div key={i} className="absolute w-full h-full" style={{ transform: `rotate(${[0, -60, -120, 180, 120, 60][m]}deg)` }}><div className="absolute right-[-8px] top-1/2 -mt-2 w-0 h-0 border-l-[10px] border-l-rose-500/70 border-y-[7px] border-y-transparent"></div></div>)}</div></div>}

      {/* Ghost Fish (2nd placement) */}
      {showGhostFish && <Fish className="text-teal-300 animate-pulse w-10 h-10 z-20 pointer-events-none" />}
      {phase === 'PLACING_FISH_2' && tempMove.q1 === cell.q && tempMove.r1 === cell.r && <Fish className="text-teal-300 animate-pulse w-10 h-10" />}

      {/* Confirmation Overlay Button (Small floating bubble - centered top) */}
      {isConfirmedPos && (
        <div className="absolute z-50 left-1/2 -translate-x-1/2 -mt-1 w-6 h-6 bg-green-500 text-white rounded-full flex items-center justify-center shadow-lg animate-in fade-in zoom-in duration-200 ring-2 ring-white hover:scale-110 cursor-pointer" style={{ top: '20%' }}>
        <Check size={14} strokeWidth={4} />
        </div>
      )}
      </div>
    );
  };

  // ... (rest of Lobby and Main UI structure remains similar)

  // --- LOBBY SCREEN ---
  if (!isJoined) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
      <MarinePattern />
      <div className="bg-white rounded-3xl shadow-2xl p-8 max-w-md w-full animate-in fade-in zoom-in duration-300 relative">
      <div className="absolute top-4 right-4 flex gap-2">
      <button onClick={() => setLang('ca')} className={`text-xs font-bold px-1 ${lang==='ca' ? 'text-teal-600 underline' : 'text-slate-400'}`}>CA</button>
      <button onClick={() => setLang('en')} className={`text-xs font-bold px-1 ${lang==='en' ? 'text-teal-600 underline' : 'text-slate-400'}`}>EN</button>
      <button onClick={() => setLang('es')} className={`text-xs font-bold px-1 ${lang==='es' ? 'text-teal-600 underline' : 'text-slate-400'}`}>ES</button>
      </div>
      <div className="flex justify-center mb-6"><div className="p-4 bg-teal-100 rounded-full"><SharkIcon size={48} color="#0d9488" /></div></div>
      <h1 className="text-4xl font-black text-center text-slate-800 mb-2">XOK</h1>
      <p className="text-center text-slate-500 mb-8">{t('edition')}</p>
      <div className="space-y-3">
      <Button onClick={startLocalGame} className="w-full py-4 text-lg shadow-teal-500/30 bg-indigo-600 hover:bg-indigo-700 gap-3"><Monitor size={20}/> {t('lobby_local')}</Button>
      <div className="relative py-2"><div className="absolute inset-0 flex items-center"><div className="w-full border-t border-slate-200"></div></div><div className="relative flex justify-center text-xs uppercase"><span className="bg-white px-2 text-slate-400">{t('lobby_online_divider')}</span></div></div>
      <Button onClick={createRoom} className="w-full py-3 gap-3" variant="secondary"><Users size={20}/> {t('lobby_create')}</Button>
      <div className="flex gap-2"><input type="text" placeholder={t('lobby_id_ph')} className="flex-1 px-4 py-3 rounded-xl border-2 border-slate-200 focus:border-teal-500 focus:ring-2 focus:ring-teal-200 outline-none font-mono uppercase text-center" value={inputRoomId} onChange={(e) => setInputRoomId(e.target.value)} /><Button onClick={joinRoom} variant="outline">{t('lobby_enter')}</Button></div>
      </div>
      </div>
      </div>
    );
  }

  // --- MAIN GAME UI ---
  return (
    <div className="min-h-screen bg-slate-100 font-sans text-slate-800 flex flex-col md:flex-row overflow-hidden">
    {/* SIDEBAR */}
    <div className="w-full md:w-80 bg-white shadow-xl flex flex-col z-20 border-r border-slate-200">
    <div className="p-6 border-b border-slate-100 bg-white flex flex-col gap-4">
    <div className="flex items-center justify-between">
    <div className="flex items-center gap-3">
    <div className="bg-teal-600 p-2 rounded-lg text-white shadow-lg"><SharkIcon size={24} color="white" /></div>
    <div><h1 className="text-2xl font-black text-slate-900 leading-none">XOK</h1><span className="text-[10px] font-bold text-slate-400 tracking-wider">{isLocal ? t('local_mode_badge') : t('online_mode_badge')}</span></div>
    </div>
    <button onClick={exitLobby} className="text-xs font-bold text-slate-400 hover:text-red-500 flex flex-col items-center"><X size={16}/> {t('exit_lobby')}</button>
    </div>
    {!isLocal && (<div className="bg-slate-100 p-3 rounded-xl flex items-center justify-between border border-slate-200"><div className="flex items-center gap-2 text-xs text-slate-500 font-bold"><Users size={14}/> ID: <span className="font-mono text-slate-800 text-sm select-all">{roomId}</span></div><button onClick={() => {navigator.clipboard.writeText(roomId); alert("ID Copiat!")}} className="p-1 hover:bg-white rounded"><Copy size={14} className="text-slate-400"/></button></div>)}
    <div className={`text-xs font-bold text-center py-1 px-2 rounded-lg ${turn === playerColor || isLocal ? 'bg-green-100 text-green-700 animate-pulse' : 'bg-slate-100 text-slate-400'}`}>{isLocal ? `${t('log_turn')} ${turn === PLAYERS.WHITE ? t('white') : t('black')}` : (turn === playerColor ? "ÉS EL TEU TORN!" : "ESPERANT RIVAL...")}</div>
    </div>
    <div className="p-6 flex-1 flex flex-col gap-4 overflow-y-auto">
    <SupplyBoard turn={turn} supply={supply} chainLengths={chainLengths} playerColor={playerColor} isLocal={isLocal} t={t} />
    <div className="space-y-2"><div className="grid grid-cols-2 gap-2"><Button variant="magic" className="py-2 px-2 text-xs" onClick={() => handleAskAI('tactics')}><BrainCircuit size={16} /> {t('ai_advice')}</Button><Button variant="secondary" className="py-2 px-2 text-xs" onClick={() => handleAskAI('commentary')}><MessageSquare size={16} /> {t('ai_comment')}</Button></div><AIResponseBox loading={aiState.loading} response={aiState.response} type={aiState.type} onClose={() => setAiState({ loading: false, response: null, type: null })} /></div>
    {!winner && (isLocal || turn === playerColor) && (
      <div className="space-y-3 pt-4 border-t border-slate-100">
      <h3 className="font-bold text-slate-400 text-[10px] uppercase tracking-widest">{t('actions')}</h3>
      <Button onClick={() => handleActionChange('fish')} disabled={supply[turn].fish < 2} className={`w-full justify-between transition-all ${selectedAction === 'fish' ? 'ring-2 ring-teal-500 bg-teal-50 border-teal-200 text-teal-800' : ''}`} variant={selectedAction === 'fish' ? 'ghost' : 'primary'}><div className="flex items-center gap-2"><Fish size={20}/> {t('fish_btn')}</div><div className="text-xs opacity-70">{t('fish_sub')}</div></Button>
      <Button onClick={() => handleActionChange('shark')} disabled={supply[turn].shark_small === 0 && supply[turn].shark_big_60 === 0 && supply[turn].shark_big_120 === 0 && supply[turn].shark_big_180 === 0} className={`w-full justify-between transition-all ${selectedAction === 'shark' ? 'ring-2 ring-rose-500 bg-rose-50 border-rose-200 text-rose-800' : ''}`} variant={selectedAction === 'shark' ? 'ghost' : 'primary'}><div className="flex items-center gap-2"><SharkIcon size={20} /> {t('shark_btn')}</div><div className="text-xs opacity-70">{t('shark_sub')}</div></Button>
      {selectedAction === 'shark' && <SharkConfigPanel sharkSelection={sharkSelection} setSharkSelection={setSharkSelection} supply={supply} turn={turn} currentMouths={currentMouths} t={t} />}
      {selectedAction === 'fish' && <div className="mt-2 p-3 bg-teal-50 text-teal-800 text-xs rounded-lg border border-teal-100 flex gap-2"><Info size={14} className="shrink-0 mt-0.5" />{phase === 'PLACING_FISH_1' ? t('instr_fish_1') : t('instr_fish_2')}</div>}
      </div>
    )}
    </div>
    <div className="p-3 bg-slate-50 border-t border-slate-200 h-24 overflow-y-auto font-mono text-[10px] text-slate-500">{gameLog.map((l, i) => <div key={i} className="mb-1 border-b border-slate-100 pb-1 last:border-0">› {l}</div>)}</div>
    </div>
    <div className="flex-1 bg-cyan-900 overflow-hidden relative"><MarinePattern /><div className="absolute inset-0 flex items-center justify-center"><div className="relative w-[800px] h-[800px]">{board.map(cell => renderCell(cell))}</div></div></div>
    {winner && <Modal title={t('game_over')} onClose={exitLobby}><div className="text-center py-4"><Trophy size={48} className="mx-auto text-yellow-500 mb-4 animate-bounce" /><h2 className="text-4xl font-black text-slate-800 mb-2">{winner === PLAYERS.WHITE ? t('white') : t('black')} {t('win_msg')}</h2><div className="bg-teal-50 text-teal-800 px-4 py-2 rounded-lg font-bold">{winReason}</div><Button onClick={exitLobby} className="w-full mt-6">{t('exit_lobby')}</Button></div></Modal>}
    {showRules && <Modal title={t('rules_title')} onClose={() => setShowRules(false)}><div className="space-y-4 text-slate-600 text-sm"><p className="bg-slate-50 p-3 rounded-lg border border-slate-200">{t('rules_goal')}</p><div><h4 className="font-bold text-teal-700">{t('rules_action1_title')}</h4><p>{t('rules_action1_desc')}</p></div><div><h4 className="font-bold text-rose-700">{t('rules_action2_title')}</h4><p>{t('rules_action2_desc')}</p><p className="mt-2 text-xs bg-rose-50 p-2 rounded text-rose-800">{t('rules_shark_eat')}</p></div><p className="text-xs text-slate-400 italic border-t pt-2">{t('rules_shark_types')}</p></div></Modal>}
    </div>
  );
}
