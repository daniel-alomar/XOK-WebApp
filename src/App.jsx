import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Fish, Trophy, Info, ArrowUp, ArrowDown, Check, Link as LinkIcon, X, BookOpen, Copy, Users, Monitor, Smartphone, RotateCcw, RotateCw, Loader2, Bot, User, Eye, LogOut } from 'lucide-react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, onAuthStateChanged, signInWithCustomToken } from 'firebase/auth';
import { getFirestore, collection, doc, setDoc, getDoc, onSnapshot, updateDoc } from 'firebase/firestore';

// --- VERSIÓ ---
const APP_VERSION = "v2.18 (UI Polish)";

// ******************************************************************************************
// *** 1. ZONA D'EDICIÓ: ENGANXA LES TEVES DADES DE FIREBASE AQUÍ SOTA ***
// ******************************************************************************************

const MY_FIREBASE_CONFIG = {
  apiKey: "AIzaSyC6uaOH6pRttEAWbWKQr3rU_w-jrKWh7ac",
  authDomain: "xok-webapp.firebaseapp.com",
  projectId: "xok-webapp",
  storageBucket: "xok-webapp.firebasestorage.app",
  messagingSenderId: "568536806614",
  appId: "1:568536806614:web:4ffa0d7fd805166bbd8577",
  measurementId: "G-2YB656ZKPN"
};

const MY_APP_ID = 'xok-webapp';

// ******************************************************************************************
// *** FI DE LA ZONA D'EDICIÓ ***
// ******************************************************************************************

// Lògica de configuració segura
let firebaseConfig = MY_FIREBASE_CONFIG;
let appId = MY_APP_ID;

try {
  if (typeof __firebase_config !== 'undefined') {
    const autoConfig = JSON.parse(__firebase_config);
    if (autoConfig) {
      firebaseConfig = autoConfig;
      appId = typeof __app_id !== 'undefined' ? __app_id : MY_APP_ID;
    }
  }
} catch (e) {}

let app, auth, db;
try {
  if (firebaseConfig && firebaseConfig.apiKey && firebaseConfig.apiKey !== "POSA_LA_TEVA_API_KEY_AQUI") {
    app = initializeApp(firebaseConfig);
    auth = getAuth(app);
    db = getFirestore(app);
  } else {
    console.warn("Firebase no configurat. Mode Offline.");
  }
} catch (error) {
  console.error("Error inicialitzant Firebase.", error);
}

// --- ICONA PERSONALITZADA: TAURÓ ---
const SharkIcon = ({ size = 24, className = "", color = "currentColor", fill="none" }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill={fill} stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
  <path d="M22 14c-1.5 0-3-1-4.5-3-1.5-2-3.5-6-3.5-6s-2 3-4.5 4C6.5 10 4 11 2 11c3 5 8 6 13 5 3-.5 5-2 7-2z" />
  <path d="M14 5c.5 2 1 4 2 6" />
  <circle cx="18" cy="11" r="1" fill={color} stroke="none" />
  </svg>
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

// --- COMPONENT: INDICADOR DE BOQUES ---
const SharkMouthIcon = ({ type, size = 20, className = "" }) => {
  const points = [];
  if (type === PIECE_TYPES.SHARK_SMALL) { points.push({ cx: 12, cy: 4 }); }
  else if (type === PIECE_TYPES.SHARK_BIG_60) { points.push({ cx: 12, cy: 4 }); points.push({ cx: 19, cy: 8 }); }
  else if (type === PIECE_TYPES.SHARK_BIG_120) { points.push({ cx: 12, cy: 4 }); points.push({ cx: 19, cy: 16 }); }
  else if (type === PIECE_TYPES.SHARK_BIG_180) { points.push({ cx: 12, cy: 4 }); points.push({ cx: 12, cy: 20 }); }
  else if (type === 'GENERIC_BIG') { points.push({ cx: 12, cy: 4 }); points.push({ cx: 12, cy: 20 }); }

  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={className}>
    <circle cx="12" cy="12" r="11" fill="none" stroke="currentColor" strokeWidth="2" className="opacity-30" />
    {points.map((p, i) => <circle key={i} cx={p.cx} cy={p.cy} r="3" fill="#f43f5e" />)}
    </svg>
  );
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
const BOARD_CENTER = { q: -2, r: 3 };
const getDistance = (q1, r1, q2, r2) => (Math.abs(q1 - q2) + Math.abs(q1 + r1 - q2 - r2) + Math.abs(r1 - r2)) / 2;

// --- TRADUCCIONS ---
const TRANSLATIONS = {
  ca: {
    title: "XOK", edition: "Edició Digital", turn: "Torn", white: "BLANC", black: "NEGRE",
    actions: "Accions", rules: "Regles", supply: "Disponibles", chain: "Cadena",
    fish_btn: "2 Peixos", fish_sub: "Adjacents", shark_btn: "1 Tauró", shark_sub: "Menja enemic",
    lobby_create: "Crear sala en línia", lobby_join: "Unir-se a Sala", lobby_id_ph: "Introdueix codi de sala...", lobby_enter: "Entrar",
    lobby_local: "Jugar en local (passa i juga)", lobby_ai: "Jugar vs CPU (IA)",
    lobby_waiting: "Esperant oponent...", lobby_share: "Comparteix aquest codi:",
    lobby_online_divider: "EN LÍNIA",
    game_over: "FINAL DE PARTIDA", win_msg: "GUANYA!", tie_msg: "EMPAT!", play_again: "Jugar de nou", exit_lobby: "Sortir", view_board: "Veure Taulell",
    log_welcome: "Benvingut!", log_turn: "Torn de", log_reset: "Partida reiniciada.",
    win_reason: "Cadena de 10 peces!",
    tie_reason_stale: "No es poden fer més moviments.",
    tie_reason_length: "Guanya per cadena més llarga.",
    tie_reason_sharks: "Guanya per més taurons a la cadena.",
    tie_reason_draw: "Empat absolut!",
    config_shark: "Configurar Tauró", rotate_hint: "Clica direcció",
    you_are: "Ets el jugador",
    err_full: "Sala plena o no existeix.", err_auth: "Error d'autenticació.",
    err_create: "Error creant la sala. Revisa connexió.", err_firebase_missing: "Sense configuració Firebase. Només Local.",
    local_mode_badge: "MODE LOCAL", online_mode_badge: "EN LÍNIA", ai_mode_badge: "MODE CPU",
    tap_confirm: "Clica de nou per confirmar",
    instr_fish_1: "Col·loca el primer peix",
    instr_fish_2: "Col·loca el segon peix",
    ai_thinking: "La CPU està pensant...",
    rules_title: "Com Jugar a XOK",
    rules_goal: "Connecta 10 peces del teu color (peixos o taurons) en una cadena contínua per guanyar.",
    rules_action1_title: "Acció 1: Jugar 2 Peixos",
    rules_action1_desc: "Col·loca 2 peixos de la teva reserva en dues caselles buides adjacents qualsevol.",
    rules_action2_title: "Acció 2: Jugar 1 Tauró",
    rules_action2_desc: "Col·loca un tauró en una casella buida O sobre un peix de l'oponent.",
    rules_shark_eat: "Important: El tauró HA DE menjar almenys un peix enemic. Menja el peix que té a sota i els que assenyalen les seves boques. Els peixos menjats tornen a la reserva del rival.",
    rules_shark_types: "Tipus: Taurons Petits (1 boca) i Grans (2 bocas amb angles fixos: 60°, 120°, 180°).",
    rules_end_condition: "Si un jugador no pot fer un moviment vàlid, la partida s'acaba. Guanya qui tingui la cadena més llarga. En cas d'empat, guanya qui tingui més taurons a la cadena. Si persisteix l'empat, guanyeu tots dos.",
    rules_links_title: "Enllaços d'interès",
    link_bgg: "Veure a BoardGameGeek",
    link_publisher: "Web oficial (Steffen Spiele)"
  },
  en: {
    title: "XOK", edition: "Digital Edition", turn: "Turn", white: "WHITE", black: "BLACK",
    actions: "Actions", rules: "Rules", supply: "Available", chain: "Chain",
    fish_btn: "2 Fish", fish_sub: "Adjacent", shark_btn: "1 Shark", shark_sub: "Eats enemy",
    lobby_create: "Create Online Room", lobby_join: "Join Room", lobby_id_ph: "Enter room code...", lobby_enter: "Enter",
    lobby_local: "Play Local (Pass & Play)", lobby_ai: "Play vs CPU (AI)",
    lobby_waiting: "Waiting for opponent...", lobby_share: "Share code:",
    lobby_online_divider: "ONLINE",
    game_over: "GAME OVER", win_msg: "WINS!", tie_msg: "DRAW!", play_again: "Play Again", exit_lobby: "Exit", view_board: "View Board",
    log_welcome: "Welcome!", log_turn: "Turn of", log_reset: "Game reset.",
    win_reason: "Chain of 10 pieces!",
    tie_reason_stale: "No valid moves left.",
    tie_reason_length: "Wins by longest chain.",
    tie_reason_sharks: "Wins by most sharks in chain.",
    tie_reason_draw: "It's a draw!",
    config_shark: "Shark Config", rotate_hint: "Click direction",
    you_are: "You are",
    err_full: "Room full or not found.", err_auth: "Auth error.",
    err_create: "Error creating room. Check connection.",
    local_mode_badge: "LOCAL MODE", online_mode_badge: "ONLINE", ai_mode_badge: "CPU MODE",
    tap_confirm: "Tap again to confirm",
    instr_fish_1: "Place the first fish",
    instr_fish_2: "Place the second fish",
    ai_thinking: "CPU is thinking...",
    rules_title: "How to Play XOK",
    rules_goal: "Connect 10 pieces of your color (fish or sharks) in a continuous chain to win.",
    rules_action1_title: "Action 1: Play 2 Fish",
    rules_action1_desc: "Place 2 fish from your supply on any two adjacent empty spaces.",
    rules_action2_title: "Action 2: Play 1 Shark",
    rules_action2_desc: "Place a shark on an empty space OR on top of an opponent's fish.",
    rules_shark_eat: "Important: The shark MUST eat at least one enemy fish. It eats the fish underneath and any fish pointed to by its mouths. Eaten fish return to the opponent's supply.",
    rules_shark_types: "Types: Small Sharks (1 mouth) and Big Sharks (2 mouths with fixed angles: 60°, 120°, 180°).",
    rules_end_condition: "If a player cannot make a valid move, the game ends. The player with the longest chain wins. In case of a tie, the one with most sharks in the chain wins. If still tied, both win.",
    rules_links_title: "Useful Links",
    link_bgg: "View on BoardGameGeek",
    link_publisher: "Official Website (Steffen Spiele)"
  },
  es: {
    title: "XOK", edition: "Edición Digital", turn: "Turno", white: "BLANCO", black: "NEGRO",
    actions: "Acciones", rules: "Reglas", supply: "Disponibles", chain: "Cadena",
    fish_btn: "2 Peces", fish_sub: "Adyacentes", shark_btn: "1 Tiburón", shark_sub: "Come enemigo",
    lobby_create: "Crear Sala En Línea", lobby_join: "Unirse a Sala", lobby_id_ph: "Introducir código...", lobby_enter: "Entrar",
    lobby_local: "Jugar en Local (Pasa y Juega)", lobby_ai: "Jugar vs CPU (IA)",
    lobby_waiting: "Esperando oponente...", lobby_share: "Comparte este código:",
    lobby_online_divider: "EN LÍNEA",
    game_over: "FINAL", win_msg: "GANA!", tie_msg: "¡EMPATE!", play_again: "Jugar de nuevo", exit_lobby: "Salir", view_board: "Ver Tablero",
    log_welcome: "¡Bienvenido!", log_turn: "Turno de",
    win_reason: "¡Cadena de 10 piezas!",
    tie_reason_stale: "No hay movimientos válidos.",
    tie_reason_length: "Gana por cadena más larga.",
    tie_reason_sharks: "Gana por más tiburones.",
    tie_reason_draw: "¡Empate absoluto!",
    config_shark: "Configurar Tiburón", rotate_hint: "Clic dirección",
    you_are: "Eres el jugador",
    err_full: "Sala llena o no existe.", err_auth: "Error de autenticación.",
    err_create: "Error creando sala. Revisa conexión.",
    local_mode_badge: "MODO LOCAL", online_mode_badge: "EN LÍNEA", ai_mode_badge: "MODO CPU",
    tap_confirm: "Pulsa de nuevo para confirmar",
    instr_fish_1: "Coloca el primer pez",
    instr_fish_2: "Coloca el segundo pez",
    ai_thinking: "La CPU está pensando...",
    rules_title: "Cómo Jugar a XOK",
    rules_goal: "Conecta 10 piezas de tu color (peces o tiburones) en una cadena continua para ganar.",
    rules_action1_title: "Acción 1: Jugar 2 Peces",
    rules_action1_desc: "Coloca 2 peces de tu reserva en dos casillas vacías adyacentes cualquiera.",
    rules_action2_title: "Acción 2: Jugar 1 Tiburón",
    rules_action2_desc: "Coloca un tiburón en una casilla vacía O sobre un pez del oponente.",
    rules_shark_eat: "Importante: El tiburón DEBE comer al menos un pez enemigo. Come el pez de abajo y los señalados por sus bocas. Los peces comidos vuelven a la reserva del rival.",
    rules_shark_types: "Tipos: Tiburones Pequeños (1 boca) y Grandes (2 bocas con ángulos fijos: 60°, 120°, 180°).",
    rules_end_condition: "Si un jugador no puede mover, el juego termina. Gana quien tenga la cadena más larga. En caso de empate, gana quien tenga más tiburones en ella. Si persiste, ganáis ambos.",
    rules_links_title: "Enlaces de interés",
    link_bgg: "Ver en BoardGameGeek",
    link_publisher: "Web oficial (Steffen Spiele)"
  }
};

// --- COMPONENTS UI ---
const Button = ({ onClick, disabled, children, className = "", variant = "primary" }) => {
  const variants = {
    primary: "bg-teal-600 text-white hover:bg-teal-500 disabled:bg-slate-500 disabled:opacity-50 disabled:shadow-none shadow-teal-900/30",
    secondary: "bg-indigo-600 text-white hover:bg-indigo-500 disabled:bg-slate-500 shadow-indigo-900/30",
    outline: "border-2 border-white/20 hover:bg-white/10 text-white shadow-sm backdrop-blur-sm",
    magic: "bg-gradient-to-r from-purple-600 to-pink-600 text-white hover:from-purple-500 hover:to-pink-500 shadow-purple-900/20",
    ghost: "bg-white/10 hover:bg-white/20 text-white backdrop-blur-sm border border-white/10"
  };
  return <button onClick={onClick} disabled={disabled} className={`px-4 py-3 rounded-xl font-bold transition-all transform active:scale-95 flex items-center justify-center gap-2 shadow-lg text-sm ${variants[variant]} ${className} pointer-events-auto`}>{children}</button>;
};

const Modal = ({ title, children, onClose }) => (
  <div className="fixed inset-0 bg-slate-900/80 z-[100] flex items-center justify-center p-4 backdrop-blur-md pointer-events-auto">
  <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full p-8 animate-in fade-in zoom-in duration-300 border border-white/20 relative max-h-[90vh] overflow-y-auto">
  <button onClick={onClose} className="absolute top-4 right-4 text-slate-400 hover:text-slate-600"><X size={24} /></button>
  <h3 className="text-3xl font-black text-slate-800 mb-6 font-mono uppercase tracking-tighter text-center">{title}</h3>
  <div className="mb-2">{children}</div>
  </div>
  </div>
);

// --- SUBCOMPONENTS ---

// Single Player Card
const SupplyCard = ({ player, supply, chainLength, isTurn, isLocal, isAI, t, className="" }) => {
  const isWhite = player === PLAYERS.WHITE;
  const label = isWhite ? t('white') : t('black');
  const isPlayer = (player === PLAYERS.WHITE && !isLocal) || (isAI && player === PLAYERS.WHITE);
  const isBot = isAI && player === PLAYERS.BLACK;

  return (
    <div className={`p-2 rounded-xl backdrop-blur-md border transition-all shadow-lg w-32 pointer-events-auto ${isTurn ? (isWhite ? 'bg-white/90 border-teal-400 ring-2 ring-teal-400/50 text-slate-900' : 'bg-slate-900/90 border-teal-400 ring-2 ring-teal-400/50 text-white') : 'bg-black/30 border-white/10 text-white/60'} ${className}`}>
    <div className="font-black text-[10px] mb-1 flex items-center justify-center gap-1 uppercase tracking-wider">
    {label} {isBot && <Bot size={12}/>} {isPlayer && "(TU)"}
    </div>

    <div className="grid grid-cols-1 gap-1 text-[10px]">
    <div className="flex justify-between items-center bg-black/10 rounded px-1.5 py-0.5">
    <div className="flex items-center gap-1"><Fish size={12} className={isTurn ? (isWhite ? "text-slate-600" : "text-white") : "text-white/60"}/></div>
    <b>{supply.fish}</b>
    </div>
    <div className="flex justify-between items-center bg-black/10 rounded px-1.5 py-0.5">
    <div className="flex items-center gap-1">
    <SharkIcon size={10} className={isTurn ? (isWhite ? "text-slate-600" : "text-white") : "text-white/60"} />
    <SharkMouthIcon type={PIECE_TYPES.SHARK_SMALL} size={12} className={isTurn ? (isWhite ? "text-slate-600" : "text-white") : "text-white/60"}/>
    </div>
    <b>{supply.shark_small}</b>
    </div>
    <div className="flex justify-between items-center bg-black/10 rounded px-1.5 py-0.5">
    <div className="flex items-center gap-1">
    <SharkIcon size={10} className={isTurn ? (isWhite ? "text-slate-600" : "text-white") : "text-white/60"} />
    <SharkMouthIcon type="GENERIC_BIG" size={12} className={isTurn ? (isWhite ? "text-slate-600" : "text-white") : "text-white/60"}/>
    </div>
    <b>{supply.shark_big_60 + supply.shark_big_120 + supply.shark_big_180}</b>
    </div>
    </div>

    <div className={`mt-1 pt-1 border-t ${isTurn ? (isWhite ? 'border-slate-300' : 'border-white/20') : 'border-white/10'} flex justify-between items-center`}>
    <div className="flex items-center gap-1 opacity-70">
    <LinkIcon size={10}/>
    <span className="text-[8px] uppercase font-bold tracking-tighter">{t('chain')}</span>
    </div>
    <span className={`font-mono font-bold text-xs ${chainLength >= 10 ? 'text-green-500' : ''}`}>{chainLength}</span>
    </div>
    </div>
  );
};

const SharkConfigPanel = ({ sharkSelection, setSharkSelection, supply, turn, currentMouths, t }) => {
  const rotate = (direction) => setSharkSelection(prev => ({ ...prev, rotation: direction === 'cw' ? (prev.rotation + 1) % 6 : (prev.rotation + 5) % 6 }));
  const currentType = sharkSelection.type;
  const count = supply[turn][currentType];
  const btnCls = (type) => {
    const num = supply[turn][type];
    const isActive = currentType === type;
    const isDisabled = num === 0;
    let base = `flex-1 py-1 rounded-lg border flex flex-col items-center justify-center gap-1 transition-all pointer-events-auto `;
    if (isActive) return base + 'bg-white border-white text-teal-700 shadow-md ring-2 ring-teal-400';
    if (isDisabled) return base + 'bg-white/5 border-transparent text-white/20 decoration-red-400/50 line-through decoration-2';
    return base + 'bg-white/10 border-white/20 text-white/70 hover:bg-white/20';
  };

  return (
    <div className="mt-2 p-2 bg-black/60 backdrop-blur-xl rounded-xl border border-white/10 animate-in slide-in-from-left-4 w-32 pointer-events-auto">
    <div className="flex justify-between items-center mb-1">
    <h4 className="text-[8px] font-black uppercase text-white/50 tracking-wider truncate">{t('config_shark')}</h4>
    <div className="text-white text-[9px] font-bold bg-white/10 px-1 py-0 rounded flex items-center gap-1">
    <span className={count === 0 ? "text-red-400" : "text-teal-400"}>{count}</span>
    </div>
    </div>

    <div className="grid grid-cols-2 gap-1 mb-2">
    <button onClick={() => setSharkSelection({type: PIECE_TYPES.SHARK_SMALL, rotation: 0})} className={btnCls(PIECE_TYPES.SHARK_SMALL)} disabled={supply[turn].shark_small === 0}><SharkMouthIcon type={PIECE_TYPES.SHARK_SMALL} size={14}/></button>
    <button onClick={() => setSharkSelection({type: PIECE_TYPES.SHARK_BIG_60, rotation: 0})} className={btnCls(PIECE_TYPES.SHARK_BIG_60)} disabled={supply[turn].shark_big_60 === 0}><SharkMouthIcon type={PIECE_TYPES.SHARK_BIG_60} size={14}/></button>
    <button onClick={() => setSharkSelection({type: PIECE_TYPES.SHARK_BIG_120, rotation: 0})} className={btnCls(PIECE_TYPES.SHARK_BIG_120)} disabled={supply[turn].shark_big_120 === 0}><SharkMouthIcon type={PIECE_TYPES.SHARK_BIG_120} size={14}/></button>
    <button onClick={() => setSharkSelection({type: PIECE_TYPES.SHARK_BIG_180, rotation: 0})} className={btnCls(PIECE_TYPES.SHARK_BIG_180)} disabled={supply[turn].shark_big_180 === 0}><SharkMouthIcon type={PIECE_TYPES.SHARK_BIG_180} size={14}/></button>
    </div>
    <div className="flex items-center justify-between gap-1">
    <button onClick={() => rotate('ccw')} className="h-6 w-6 bg-white/10 rounded-full border border-white/20 text-white hover:bg-white/20 active:scale-95 flex items-center justify-center pointer-events-auto"><RotateCw size={12}/></button>
    <div className="relative w-8 h-8 shrink-0">
    <div className="absolute inset-0 flex items-center justify-center pointer-events-none"><SharkIcon size={20} color="#ffffff" /></div>
    {[0, 1, 2, 3, 4, 5].map(dir => {
      const rad = ((dir * 60 - 90) * Math.PI) / 180;
      const x = Math.cos(rad) * 12 + 16 - 2;
      const y = Math.sin(rad) * 12 + 16 - 2;
      return <div key={dir} style={{ left: x, top: y }} className={`absolute w-1 h-1 rounded-full border transition-all ${currentMouths.includes(dir) ? 'bg-rose-500 border-rose-600 scale-150 shadow-sm' : 'bg-white/10 border-white/20'}`} />
    })}
    </div>
    <button onClick={() => rotate('cw')} className="h-6 w-6 bg-white/10 rounded-full border border-white/20 text-white hover:bg-white/20 active:scale-95 flex items-center justify-center pointer-events-auto"><RotateCcw size={12}/></button>
    </div>
    </div>
  );
};

// --- APP PRINCIPAL ---
export default function XokGameHex() {
  const [user, setUser] = useState(null);
  const [roomId, setRoomId] = useState(null);
  const [playerColor, setPlayerColor] = useState(null);
  const [isJoined, setIsJoined] = useState(false);
  const [isLocal, setIsLocal] = useState(false);
  const [isAI, setIsAI] = useState(false);
  const [inputRoomId, setInputRoomId] = useState('');
  const [creatingRoom, setCreatingRoom] = useState(false);

  const [board, setBoard] = useState(generateBoardCells);
  const [turn, setTurn] = useState(PLAYERS.WHITE);
  const [supply, setSupply] = useState(JSON.parse(JSON.stringify(INITIAL_SUPPLY)));
  const [winner, setWinner] = useState(null);
  const [winReason, setWinReason] = useState('');
  const [winningCells, setWinningCells] = useState([]);
  const [gameLog, setGameLog] = useState(["Benvingut a XOK!"]);

  const [phase, setPhase] = useState('SELECT_ACTION');
  const [selectedAction, setSelectedAction] = useState(null);
  const [tempMove, setTempMove] = useState({});
  const [confirmMove, setConfirmMove] = useState(null);
  const [hoverCell, setHoverCell] = useState(null);
  const [sharkSelection, setSharkSelection] = useState({ type: PIECE_TYPES.SHARK_SMALL, rotation: 0 });
  const [boardScale, setBoardScale] = useState(1);
  const [showRules, setShowRules] = useState(false);
  const [viewingEndGame, setViewingEndGame] = useState(false);

  const getBrowserLang = () => {
    const navLang = navigator.language || navigator.userLanguage;
    if (navLang?.startsWith('ca')) return 'ca';
    if (navLang?.startsWith('es')) return 'es';
    return 'en';
  };
  const [lang, setLang] = useState(getBrowserLang);
  const t = (key) => TRANSLATIONS[lang][key] || key;

  useEffect(() => {
    const handleResize = () => {
      const availWidth = window.innerWidth;
      const baseWidth = 800;
      const padding = 40;
      if (availWidth < baseWidth + padding) {
        setBoardScale((availWidth - padding) / baseWidth);
      } else {
        setBoardScale(1);
      }
    };
    window.addEventListener('resize', handleResize);
    handleResize();
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    const initAuth = async () => { try { if (auth && typeof __initial_auth_token !== 'undefined' && __initial_auth_token) { await signInWithCustomToken(auth, __initial_auth_token); } else if (auth) { await signInAnonymously(auth); } } catch(e) { console.warn("Auth failed", e); } };
    if (auth) initAuth();
    if (auth) { const unsubscribe = onAuthStateChanged(auth, setUser); return () => unsubscribe(); }
  }, []);

  useEffect(() => {
    if (!user || !roomId || isLocal || isAI || !db) return;
    const roomRef = doc(db, 'artifacts', appId, 'public', 'data', 'xok_rooms', roomId);
    const unsubscribe = onSnapshot(roomRef, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data();
        setBoard(JSON.parse(data.board));
        setTurn(data.turn);
        setSupply(data.supply);
        setWinner(data.winner);
        setWinReason(data.winReason);
        if (data.winningCells) {
          try {
            const wc = JSON.parse(data.winningCells);
            setWinningCells(Array.isArray(wc) ? wc : []);
          } catch(e) { setWinningCells([]); }
        } else { setWinningCells([]); }

        if (data.logs) setGameLog(data.logs);
        if (data.turn !== turn) setConfirmMove(null);
      }
    }, (error) => console.error("Error sync:", error));
    return () => unsubscribe();
  }, [user, roomId, isLocal, isAI, turn]);

  const calculateChains = useCallback((currentBoard) => {
    const visited = new Set();
    const cellMap = new Map();
    currentBoard.forEach(c => cellMap.set(`${c.q},${c.r}`, c));

    const getComponent = (startQ, startR, player) => {
      const stack = [{q: startQ, r: startR}];
      const componentCells = [`${startQ},${startR}`];
      const seen = new Set([`${startQ},${startR}`]);
      let size = 0;
      let sharksInChain = 0;

      while(stack.length){
        const {q, r} = stack.pop();
        const cell = cellMap.get(`${q},${r}`);
        if(cell) {
          size++;
          if (cell.type && cell.type.includes('shark')) sharksInChain++;
        }

        getNeighbors(q, r).forEach(n => {
          const key = `${n.q},${n.r}`;
          const nCell = cellMap.get(key);
          if(nCell && nCell.owner === player && !seen.has(key)) {
            seen.add(key);
            componentCells.push(key);
            stack.push(n);
          }
        });
      }
      return { size, sharks: sharksInChain, cells: componentCells };
    };

    let maxChains = {
      [PLAYERS.WHITE]: { size: 0, sharks: 0 },
      [PLAYERS.BLACK]: { size: 0, sharks: 0 }
    };
    let winCells = [];

    currentBoard.forEach(cell => {
      if(cell.owner && !visited.has(`${cell.q},${cell.r}`)) {
        const { size, sharks, cells } = getComponent(cell.q, cell.r, cell.owner);

        if (size > maxChains[cell.owner].size || (size === maxChains[cell.owner].size && sharks > maxChains[cell.owner].sharks)) {
          maxChains[cell.owner] = { size, sharks };
        }

        cells.forEach(k => visited.add(k));

        if (size >= WINNING_CHAIN) {
          winCells = cells;
        }
      }
    });

    return { maxChains, winCells };
  }, []);

  const chainLengths = useMemo(() => calculateChains(board).maxChains, [board, calculateChains]);

  const canPlayerMove = (player, currentBoard, currentSupply) => {
    if (currentSupply[player].fish >= 2) {
      const emptyCells = currentBoard.filter(c => !c.type);
      for (const cell of emptyCells) {
        const ns = getNeighbors(cell.q, cell.r);
        if (ns.some(n => { const nc = currentBoard.find(b => b.q === n.q && b.r === n.r); return nc && !nc.type; })) return true;
      }
    }

    const sharkTypes = [PIECE_TYPES.SHARK_SMALL, PIECE_TYPES.SHARK_BIG_60, PIECE_TYPES.SHARK_BIG_120, PIECE_TYPES.SHARK_BIG_180];
    const opponent = player === PLAYERS.WHITE ? PLAYERS.BLACK : PLAYERS.WHITE;

    for (const sType of sharkTypes) {
      if (currentSupply[player][sType] > 0) {
        for (const cell of currentBoard) {
          if (cell.owner === player || (cell.type && cell.type.includes('shark'))) continue;

          for (let rot=0; rot<6; rot++) {
            const mouths = getActiveMouths(sType, rot);
            let eaten = 0;
            if (cell.type === PIECE_TYPES.FISH && cell.owner === opponent) eaten++;
            const neighbors = getNeighbors(cell.q, cell.r);
            mouths.forEach(dir => {
              const n = neighbors[dir];
              const nc = currentBoard.find(c => c.q === n.q && c.r === n.r);
              if (nc && nc.type === PIECE_TYPES.FISH && nc.owner === opponent) eaten++;
            });
              if (eaten > 0) return true;
          }
        }
      }
    }
    return false;
  };

  const checkWinLocal = (currentBoard, currentSupply) => {
    const { maxChains, winCells } = calculateChains(currentBoard);

    if (maxChains[turn].size >= WINNING_CHAIN) return { winner: turn, reason: t('win_reason'), winningCells: winCells };
    if (maxChains[turn === 'white' ? 'black' : 'white'].size >= WINNING_CHAIN) {
      return { winner: turn === 'white' ? 'black' : 'white', reason: t('win_reason'), winningCells: winCells };
    }

    const nextPlayer = turn === PLAYERS.WHITE ? PLAYERS.BLACK : PLAYERS.WHITE;
    if (!canPlayerMove(nextPlayer, currentBoard, currentSupply)) {
      const whiteScore = maxChains.white;
      const blackScore = maxChains.black;
      let winner = null;
      let reason = t('tie_reason_stale') + " ";

      if (whiteScore.size > blackScore.size) { winner = PLAYERS.WHITE; reason += t('tie_reason_length'); }
      else if (blackScore.size > whiteScore.size) { winner = PLAYERS.BLACK; reason += t('tie_reason_length'); }
      else { winner = 'DRAW'; reason += t('tie_reason_draw'); }

      return { winner, reason, winningCells: [] };
    }
    return null;
  };

  const addLog = (msg) => setGameLog(prev => [msg, ...prev].slice(0, 5));

  const updateGameState = async (newBoard, newSupply, nextTurn, newLogs, newWinner = null, newReason = '', winCells = []) => {
    if (isLocal || isAI) {
      setBoard(newBoard); setSupply(newSupply); setTurn(nextTurn); setGameLog(newLogs);
      if (newWinner) { setWinner(newWinner); setWinReason(newReason); setWinningCells(winCells); }
      return;
    }
    if (!roomId) return;
    const roomRef = doc(db, 'artifacts', appId, 'public', 'data', 'xok_rooms', roomId);
    await updateDoc(roomRef, { board: JSON.stringify(newBoard), supply: newSupply, turn: nextTurn, logs: newLogs, winner: newWinner, winReason: newReason, winningCells: JSON.stringify(winCells) });
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
    const target = confirmMove || hoverCell;
    return (target && selectedAction === 'shark') ? getImpactedCells(target.q, target.r) : [];
  }, [confirmMove, hoverCell, selectedAction, currentMouths, board, turn]);

  const endTurnDB = async (newBoard, newSupply) => {
    const winResult = checkWinLocal(newBoard, newSupply);
    const nextPlayer = turn === PLAYERS.WHITE ? PLAYERS.BLACK : PLAYERS.WHITE;
    const logMsg = `${turn === 'white' ? t('white') : t('black')} ha mogut.`;
    const newLogs = [logMsg, ...gameLog].slice(0, 5);
    const nextTurnState = winResult ? turn : nextPlayer;

    await updateGameState(newBoard, newSupply, nextTurnState, newLogs, winResult ? winResult.winner : null, winResult ? winResult.reason : '', winResult ? winResult.winningCells : []);

    setPhase('SELECT_ACTION'); setSelectedAction(null); setTempMove({}); setConfirmMove(null);
    if (!winResult) {
      const nextSupplyState = newSupply[nextPlayer];
      setSharkSelection({ type: nextSupplyState.shark_small > 0 ? PIECE_TYPES.SHARK_SMALL : (nextSupplyState.shark_big_60 > 0 ? PIECE_TYPES.SHARK_BIG_60 : (nextSupplyState.shark_big_120 > 0 ? PIECE_TYPES.SHARK_BIG_120 : PIECE_TYPES.SHARK_BIG_180)), rotation: 0 });
    }
  };

  const executeAIMoveAction = (move) => {
    const newBoard = board.map(c => ({...c}));
    const newSupply = JSON.parse(JSON.stringify(supply));
    const cpuColor = PLAYERS.BLACK;

    if (move.type === 'fish') {
      const c1Index = newBoard.findIndex(c => c.q === move.q1 && c.r === move.r1);
      const c2Index = newBoard.findIndex(c => c.q === move.q2 && c.r === move.r2);
      if (c1Index >= 0) { newBoard[c1Index].type = PIECE_TYPES.FISH; newBoard[c1Index].owner = cpuColor; }
      if (c2Index >= 0) { newBoard[c2Index].type = PIECE_TYPES.FISH; newBoard[c2Index].owner = cpuColor; }
      newSupply[cpuColor].fish -= 2;
      addLog(`${t('black')} (CPU) posa 2 peixos.`);
    } else {
      const eatenIndices = [];
      const targetIdx = newBoard.findIndex(c => c.q === move.q && c.r === move.r);
      const targetCell = newBoard[targetIdx];
      if (targetCell.type === PIECE_TYPES.FISH && targetCell.owner !== cpuColor) eatenIndices.push(targetIdx);
      const neighbors = getNeighbors(move.q, move.r);
      move.mouths.forEach(dir => {
        const n = neighbors[dir];
        const idx = newBoard.findIndex(c => c.q === n.q && c.r === n.r);
        if (idx >= 0 && newBoard[idx].type === PIECE_TYPES.FISH && newBoard[idx].owner !== cpuColor) {
          if (!eatenIndices.includes(idx)) eatenIndices.push(idx);
        }
      });
      eatenIndices.forEach(idx => {
        newSupply[newBoard[idx].owner].fish += 1;
        if (idx !== targetIdx) { newBoard[idx].type = null; newBoard[idx].owner = null; }
      });
      newBoard[targetIdx].type = move.sharkType;
      newBoard[targetIdx].owner = cpuColor;
      newBoard[targetIdx].mouths = move.mouths;
      newSupply[cpuColor][move.sharkType] -= 1;
      addLog(`${t('black')} (CPU) menja ${eatenIndices.length} peixos!`);
    }
    endTurnDB(newBoard, newSupply);
  };

  const makeAIMove = () => {
    const cpuColor = PLAYERS.BLACK;
    const opponent = PLAYERS.WHITE;
    const opponentChain = chainLengths[opponent].size;
    const myChain = chainLengths[cpuColor].size;

    const shuffledBoard = [...board].sort(() => Math.random() - 0.5);
    const sharkTypes = [PIECE_TYPES.SHARK_SMALL, PIECE_TYPES.SHARK_BIG_60, PIECE_TYPES.SHARK_BIG_120, PIECE_TYPES.SHARK_BIG_180];
    sharkTypes.sort(() => Math.random() - 0.5);

    const evaluateSharkMove = (minEaten = 1, criticalOnly = false) => {
      for (const sType of sharkTypes) {
        if (supply[cpuColor][sType] > 0) {
          const isBig = sType !== PIECE_TYPES.SHARK_SMALL;
          const targetEat = (isBig && !criticalOnly) ? 3 : minEaten;
          for (const cell of shuffledBoard) {
            if (cell.owner === cpuColor || (cell.type && cell.type.includes('shark'))) continue;
            const rotations = [0, 1, 2, 3, 4, 5].sort(() => Math.random() - 0.5);
            for (const rot of rotations) {
              const mouths = getActiveMouths(sType, rot);
              let eaten = 0;
              let eatsUnder = false;
              if (cell.type === PIECE_TYPES.FISH && cell.owner === opponent) { eaten++; eatsUnder = true; }
              const neighbors = getNeighbors(cell.q, cell.r);
              mouths.forEach(dirIdx => {
                const nC = neighbors[dirIdx];
                const nCell = board.find(c => c.q === nC.q && c.r === nC.r);
                if (nCell && nCell.type === PIECE_TYPES.FISH && nCell.owner === opponent) eaten++;
              });
                const score = eaten + (eatsUnder ? 0.5 : 0) - (getDistance(cell.q, cell.r, BOARD_CENTER.q, BOARD_CENTER.r) * 0.1);
                const threshold = targetEat + (eatsUnder ? 0.5 : 0);
                if (score >= threshold) return { type: 'shark', q: cell.q, r: cell.r, sharkType: sType, mouths: mouths, eatenCount: eaten, score: score };
            }
          }
        }
      }
      return null;
    };

    let bestMove = null;
    const isEmergency = opponentChain >= 6;
    const isOpportunity = myChain >= 8;
    const isEarlyGame = opponentChain < 5 && myChain < 8;

    if (isEmergency || isOpportunity) bestMove = evaluateSharkMove(1, true);

    if (!bestMove && supply[cpuColor].fish >= 2) {
      const occupied = board.filter(c => c.type);
      let candidates = [];
      const candidateSet = new Set();
      occupied.forEach(p => {
        getNeighbors(p.q, p.r).forEach(n => {
          const c = board.find(b => b.q === n.q && b.r === n.r);
          if (c && !c.type) candidateSet.add(c);
        });
      });
      candidates = Array.from(candidateSet);
      if (candidates.length < 2) candidates = shuffledBoard.filter(c => !c.type);
      candidates.sort(() => Math.random() - 0.5);
      for (const c1 of candidates) {
        const ns = getNeighbors(c1.q, c1.r);
        const validNeighbors = ns.map(n => board.find(b => b.q === n.q && b.r === n.r)).filter(b => b && !b.type);
        if (validNeighbors.length > 0) {
          const c2 = validNeighbors[Math.floor(Math.random() * validNeighbors.length)];
          bestMove = { type: 'fish', q1: c1.q, r1: c1.r, q2: c2.q, r2: c2.r };
          if (isEarlyGame) break;
        }
      }
    }

    if (!bestMove && !isEarlyGame) bestMove = evaluateSharkMove(2, false);
    if (!bestMove) bestMove = evaluateSharkMove(1, false);

    if (bestMove) executeAIMoveAction(bestMove);
    else endTurnDB(board, supply);
  };

    useEffect(() => {
      if (isAI && turn === PLAYERS.BLACK && !winner) {
        const timer = setTimeout(() => { makeAIMove(); }, 1500);
        return () => clearTimeout(timer);
      }
    }, [isAI, turn, winner]);


    const createRoom = async () => {
      if (!user) { alert(t('err_auth')); return; }
      setCreatingRoom(true);
      try {
        const newRoomId = Math.random().toString(36).substring(2, 8).toUpperCase();
        const roomRef = doc(db, 'artifacts', appId, 'public', 'data', 'xok_rooms', newRoomId);
        const initialState = { board: JSON.stringify(generateBoardCells()), turn: PLAYERS.WHITE, supply: INITIAL_SUPPLY, winner: null, winReason: '', logs: [t('log_welcome')], createdAt: new Date().toISOString() };
        await setDoc(roomRef, initialState);
        setRoomId(newRoomId); setPlayerColor(PLAYERS.WHITE); setIsLocal(false); setIsAI(false); setIsJoined(true);
      } catch (error) { console.error("Error creant sala:", error); alert(t('err_create') + "\n" + error.message); } finally { setCreatingRoom(false); }
    };

    const joinRoom = async () => {
      if (!user || !inputRoomId) { alert("Error d'autenticació o ID buit"); return; }
      const cleanId = inputRoomId.toUpperCase().trim();
      const roomRef = doc(db, 'artifacts', appId, 'public', 'data', 'xok_rooms', cleanId);
      const snap = await getDoc(roomRef);
      if (snap.exists()) { setRoomId(cleanId); setPlayerColor(PLAYERS.BLACK); setIsLocal(false); setIsAI(false); setIsJoined(true); } else { alert(t('err_full')); }
    };

    const startLocalGame = () => { setRoomId(null); setPlayerColor(null); setIsLocal(true); setIsAI(false); setIsJoined(true); setBoard(generateBoardCells()); setSupply(JSON.parse(JSON.stringify(INITIAL_SUPPLY))); setTurn(PLAYERS.WHITE); setGameLog([t('log_welcome')]); };

    const startAIGame = () => {
      setRoomId(null); setPlayerColor(PLAYERS.WHITE); setIsLocal(false); setIsAI(true); setIsJoined(true);
      setBoard(generateBoardCells()); setSupply(JSON.parse(JSON.stringify(INITIAL_SUPPLY))); setTurn(PLAYERS.WHITE); setGameLog([t('log_welcome')]);
    };

    const exitLobby = () => { setIsJoined(false); setRoomId(null); setIsLocal(false); setIsAI(false); setWinner(null); setBoard(generateBoardCells()); setSupply(JSON.parse(JSON.stringify(INITIAL_SUPPLY))); setWinningCells([]); setViewingEndGame(false); };

    const handleRestart = async () => {
      if (isLocal || isAI) {
        setBoard(generateBoardCells());
        setTurn(PLAYERS.WHITE);
        setSupply(JSON.parse(JSON.stringify(INITIAL_SUPPLY)));
        setWinner(null);
        setWinReason('');
        setWinningCells([]);
        setGameLog([t('log_welcome')]);
        return;
      }

      if (roomId && db) {
        const roomRef = doc(db, 'artifacts', appId, 'public', 'data', 'xok_rooms', roomId);
        const initialState = {
          board: JSON.stringify(generateBoardCells()),
          turn: PLAYERS.WHITE,
          supply: INITIAL_SUPPLY,
          winner: null,
          winReason: '',
          winningCells: JSON.stringify([]),
          logs: [t('log_welcome')]
        };
        await updateDoc(roomRef, initialState);
      }
    };

    const handleCellClick = (cell) => {
      if (winner) return; // No moves after win

      if (!isLocal && !isAI && turn !== playerColor) return;
      if (isAI && turn === PLAYERS.BLACK) return;

      const { q, r } = cell;

      if (selectedAction === 'shark' || phase === 'PLACING_FISH_2') {
        if (!confirmMove || confirmMove.q !== q || confirmMove.r !== r) {
          let valid = false;
          if (selectedAction === 'shark') { valid = !(cell.owner === turn || (cell.type && cell.type.includes('shark'))); }
          else if (phase === 'PLACING_FISH_2') { const neighbors = getNeighbors(tempMove.q1, tempMove.r1); valid = !cell.type && neighbors.some(n => n.q === cell.q && n.r === r); }
          if (valid) { setConfirmMove({ q, r }); } else if (selectedAction === 'shark') { addLog(t('log_shark_invalid')); } else { addLog(t('log_fish_adj')); }
          return;
        }
      }

      if (selectedAction === 'fish') {
        if (supply[turn].fish < 2) return;
        if (phase === 'PLACING_FISH_1') { if (cell.type) return; setTempMove({ q1: q, r1: r }); setPhase('PLACING_FISH_2'); }
        else if (phase === 'PLACING_FISH_2') {
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
        fishToEatIndices.forEach(idx => { const c = newBoard[idx]; newSupply[c.owner].fish += 1; if (c.q !== q || c.r !== r) { newBoard[idx].type = null; newBoard[idx].owner = null; } });
        newBoard[targetCellIndex].type = sharkType;
        newBoard[targetCellIndex].owner = turn;
        newBoard[targetCellIndex].mouths = currentMouths;
        newSupply[turn][sharkType] -= 1;
        endTurnDB(newBoard, newSupply);
      }
    };

    const handleActionChange = (action) => { setSelectedAction(action); setPhase(action === 'fish' ? 'PLACING_FISH_1' : 'SELECT_ACTION'); setTempMove({}); setConfirmMove(null); };

    // --- RENDER CELL DEFINITION INSIDE COMPONENT TO FIX SCOPE ---
    const renderCell = (cell) => {
      const { x, y } = hexToPixel(cell.q, cell.r);

      const isConfirmedPos = confirmMove && confirmMove.q === cell.q && confirmMove.r === cell.r;
      const isHovered = !isConfirmedPos && hoverCell && hoverCell.q === cell.q && hoverCell.r === cell.r;
      let isHighlight = false, isValidTarget = false, isImpacted = false, showGhostShark = false, showGhostFish = false;

      const isWinningPiece = winner && Array.isArray(winningCells) && winningCells.includes(`${cell.q},${cell.r}`);

      if (!winner && (turn === playerColor || isLocal || (isAI && turn === PLAYERS.WHITE))) {
        if (selectedAction === 'fish') {
          if (phase === 'PLACING_FISH_1' && !cell.type) isValidTarget = true;
          if (phase === 'PLACING_FISH_2') {
            if (tempMove.q1 === cell.q && tempMove.r1 === cell.r) isHighlight = true;
            if (!cell.type) { const ns = getNeighbors(tempMove.q1, tempMove.r1); if (ns.some(n => n.q === cell.q && n.r === cell.r)) { isValidTarget = true; if (isConfirmedPos || isHovered) showGhostFish = true; } }
          }
        }
        if (selectedAction === 'shark') {
          const canPlaceShark = !cell.owner || (cell.owner !== turn && (!cell.type || !cell.type.includes('shark')));
          if (canPlaceShark) { isValidTarget = true; if ((isConfirmedPos || isHovered)) showGhostShark = true; }
          if (impactedCells.some(ic => ic.q === cell.q && ic.r === cell.r)) isImpacted = true;
        }
      }

      const isWhite = cell.owner === PLAYERS.WHITE;
      const pieceColor = isWhite ? 'text-slate-900' : 'text-white';
      const bgColor = isWhite ? 'bg-white border-2 border-slate-200' : 'bg-slate-900 border-2 border-slate-700';

      const winClass = isWinningPiece ? 'bg-emerald-500 border-emerald-300 ring-2 ring-emerald-400 z-50 shadow-lg shadow-emerald-500/50' : '';

      return (
        <div key={`${cell.q},${cell.r}`} onClick={() => handleCellClick(cell)} onMouseEnter={() => setHoverCell(cell)} onMouseLeave={() => setHoverCell(null)}
        style={{ position: 'absolute', left: `calc(50% + ${x}px)`, top: `calc(50% + ${y - 270}px)`, width: `${HEX_WIDTH}px`, height: `${HEX_HEIGHT}px`, marginLeft: `-${HEX_WIDTH/2}px`, marginTop: `-${HEX_HEIGHT/2}px`, clipPath: "polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)", zIndex: isConfirmedPos || isWinningPiece ? 50 : 10, cursor: (!winner && (turn === playerColor || isLocal || (isAI && turn === PLAYERS.WHITE))) ? 'pointer' : 'default' }}
        className={`flex items-center justify-center transition-all duration-200 ${winClass} ${isImpacted ? 'bg-rose-500/80 animate-pulse border-rose-600 border-2' : ''} ${!isImpacted && !isWinningPiece && isValidTarget && !isConfirmedPos ? 'bg-teal-400 hover:bg-teal-300' : ''} ${!isImpacted && !isWinningPiece && !isValidTarget ? 'bg-white/20 hover:bg-white/30' : ''} ${isHighlight ? 'bg-teal-500' : ''} ${!isValidTarget && !isHighlight && !isImpacted && !isConfirmedPos && !isWinningPiece ? 'backdrop-blur-[1px]' : ''} ${isConfirmedPos ? 'bg-teal-200 ring-4 ring-teal-400 z-50 scale-105' : ''}`}>
        {cell.type === PIECE_TYPES.FISH && <div className={`w-12 h-12 rounded-full ${isWinningPiece ? 'bg-transparent border-white/50' : bgColor} flex items-center justify-center shadow-md ${isImpacted ? 'opacity-50 grayscale' : ''}`}><Fish className={isWinningPiece ? 'text-white' : pieceColor} size={26} strokeWidth={2.5} /></div>}
        {cell.type && cell.type.includes('shark') && <div className={`w-14 h-14 rounded-xl ${isWinningPiece ? 'bg-transparent border-white/50' : bgColor} flex items-center justify-center relative shadow-lg`}><SharkIcon color={isWinningPiece ? "#ffffff" : (isWhite ? "#0f172a" : "#ffffff")} size={32} />{cell.mouths.map((m, i) => <div key={i} className="absolute w-full h-full pointer-events-none" style={{ transform: `rotate(${[0, -60, -120, 180, 120, 60][m]}deg)` }}><div className="absolute right-[-8px] top-1/2 -mt-2 w-0 h-0 border-l-[10px] border-l-rose-500 border-y-[7px] border-y-transparent"></div></div>)}</div>}
        {showGhostShark && <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-60 z-20"><div className={`w-14 h-14 rounded-xl ${turn === PLAYERS.WHITE ? 'bg-white border-slate-300' : 'bg-slate-800 border-slate-600'} border-2 flex items-center justify-center relative shadow-lg`}><SharkIcon color={turn === PLAYERS.WHITE ? "#0f172a" : "#ffffff"} size={32} />{currentMouths.map((m, i) => <div key={i} className="absolute w-full h-full" style={{ transform: `rotate(${[0, -60, -120, 180, 120, 60][m]}deg)` }}><div className="absolute right-[-8px] top-1/2 -mt-2 w-0 h-0 border-l-[10px] border-l-rose-500/70 border-y-[7px] border-y-transparent"></div></div>)}</div></div>}
        {showGhostFish && <Fish className="text-teal-300 animate-pulse w-10 h-10 z-20 pointer-events-none" />}
        {phase === 'PLACING_FISH_2' && tempMove.q1 === cell.q && tempMove.r1 === cell.r && <Fish className="text-teal-300 animate-pulse w-10 h-10" />}
        {isConfirmedPos && <div className="absolute z-50 inset-0 m-auto w-10 h-10 bg-green-500/20 backdrop-blur-md rounded-full flex items-center justify-center shadow-lg animate-in fade-in zoom-in duration-200 ring-2 ring-green-400 hover:bg-green-500/40 cursor-pointer" style={{ marginTop: '0' }}><Check size={20} strokeWidth={4} className="text-green-600" /></div>}
        </div>
      );
    };

    if (!isJoined) {
      return (
        <div className="min-h-screen bg-cyan-900 flex items-center justify-center p-4">
        <div className="bg-white/90 backdrop-blur-md rounded-3xl shadow-2xl p-8 max-w-md w-full animate-in fade-in zoom-in duration-300 relative border border-white/20">
        <div className="absolute top-4 right-4 flex gap-2"><button onClick={() => setLang('ca')} className={`text-xs font-bold px-1 ${lang==='ca' ? 'text-teal-600 underline' : 'text-slate-400'}`}>CA</button><button onClick={() => setLang('en')} className={`text-xs font-bold px-1 ${lang==='en' ? 'text-teal-600 underline' : 'text-slate-400'}`}>EN</button><button onClick={() => setLang('es')} className={`text-xs font-bold px-1 ${lang==='es' ? 'text-teal-600 underline' : 'text-slate-400'}`}>ES</button></div>
        <div className="flex justify-center mb-6"><div className="p-4 bg-teal-100 rounded-full"><SharkIcon size={48} color="#0d9488" /></div></div>
        <h1 className="text-4xl font-black text-center text-slate-800 mb-2">XOK</h1>
        <p className="text-center text-slate-500 mb-8">{t('edition')}</p>
        <div className="space-y-3">
        <Button onClick={startLocalGame} className="w-full py-4 text-lg shadow-teal-500/30 bg-indigo-600 hover:bg-indigo-700 gap-4"><div className="flex items-center gap-1 bg-indigo-800/0 px-2 py-1 rounded-lg"><User size={18}/><span className="text-[10px] font-black">VS</span><User size={18}/></div><span>{t('lobby_local')}</span></Button>
        <Button onClick={startAIGame} className="w-full py-4 text-lg shadow-purple-500/30 bg-purple-600 hover:bg-purple-700 gap-4"><div className="flex items-center gap-1 bg-purple-800/0 px-2 py-1 rounded-lg"><User size={18}/><span className="text-[10px] font-black">VS</span><Bot size={18}/></div><span>{t('lobby_ai')}</span></Button>
        <div className="relative py-2"><div className="absolute inset-0 flex items-center"><div className="w-full border-t border-slate-200"></div></div><div className="relative flex justify-center text-xs uppercase"><span className="bg-white/50 px-2 text-slate-400">{t('lobby_online_divider')}</span></div></div>
        <Button onClick={createRoom} disabled={creatingRoom} className="w-full py-3 gap-3" variant="secondary">
        {creatingRoom ? <><Loader2 size={20} className="animate-spin"/> Creant...</> : <><Users size={20}/> {t('lobby_create')}</>}
        </Button>
        <div className="flex gap-2"><input type="text" placeholder={t('lobby_id_ph')} className="flex-1 px-4 py-3 rounded-xl border-2 border-slate-200 focus:border-teal-500 focus:ring-2 focus:ring-teal-200 outline-none font-mono uppercase text-center" value={inputRoomId} onChange={(e) => setInputRoomId(e.target.value)} /><Button onClick={joinRoom} variant="primary">{t('lobby_enter')}</Button></div>
        </div>
        </div>
        </div>
      );
    }

    // --- IMMERSIVE LAYOUT ---
    return (
      <div className="relative w-full h-screen bg-cyan-900 overflow-hidden flex flex-col">

      {/* HEADER: TITLE & TURN */}
      <div className="absolute top-0 left-0 w-full p-4 flex justify-between items-start z-50 pointer-events-none">
      <div className="pointer-events-auto flex items-center gap-2">
      <div className="flex items-center gap-2 bg-black/40 backdrop-blur px-3 py-1.5 rounded-full border border-white/10 text-white">
      <SharkIcon size={20} color="white"/>
      <span className="font-black tracking-widest text-sm">XOK</span>
      {isAI && <span className="text-[10px] bg-white/20 px-1 rounded text-white/80">CPU</span>}
      {isLocal && <span className="text-[10px] bg-white/20 px-1 rounded text-white/80">LOCAL</span>}
      {!isLocal && !isAI && <span className="text-[10px] bg-green-500/40 px-1 rounded text-white/90">ONLINE</span>}
      </div>
      </div>

      <div className={`pointer-events-auto px-4 py-1.5 rounded-2xl backdrop-blur-md shadow-2xl border transition-all transform hover:scale-105 absolute left-1/2 -translate-x-1/2 top-4 ${turn === PLAYERS.WHITE ? 'bg-white text-slate-900 border-white' : 'bg-slate-900 text-white border-slate-700'}`}>
      <div className="text-[10px] font-bold opacity-60 uppercase tracking-widest text-center mb-0.5">{t('log_turn')}</div>
      <div className="text-sm font-black flex items-center gap-2">
      {turn === PLAYERS.WHITE ? <div className="w-2.5 h-2.5 bg-white border border-slate-300 rounded-full"/> : <div className="w-2.5 h-2.5 bg-slate-900 border border-white/20 rounded-full"/>}
      {turn === PLAYERS.WHITE ? t('white') : t('black')}
      {isAI && turn === PLAYERS.BLACK && <Loader2 size={14} className="animate-spin ml-1 opacity-50"/>}
      </div>
      </div>

      {/* ROOM ID OVERLAY (TOP RIGHT) - VISIBLE */}
      <div className="pointer-events-auto absolute right-4 top-4 z-50">
      {!isLocal && !isAI && (
        <div className="bg-black/60 backdrop-blur px-3 py-2 rounded-xl border border-white/20 text-white text-xs font-mono flex flex-col items-center gap-1 cursor-pointer hover:bg-black/80 shadow-lg animate-in fade-in slide-in-from-top-4" onClick={() => {navigator.clipboard.writeText(roomId); alert("Copiat!")}}>
        <span className="text-[9px] uppercase font-bold text-white/50">ROOM ID</span>
        <div className="flex items-center gap-2 font-bold text-lg tracking-wider text-teal-400">
        {roomId} <Copy size={14}/>
        </div>
        </div>
      )}
      </div>
      </div>

      {/* LEFT PANEL: SUPPLY & CONTROLS */}
      <div className="absolute top-24 left-2 bottom-4 z-40 w-32 flex flex-col gap-4 pointer-events-none">
      <SupplyCard player={PLAYERS.WHITE} supply={supply.white} chainLength={chainLengths.white.size} isTurn={turn === PLAYERS.WHITE} isLocal={isLocal} isAI={isAI} t={t} />

      {!winner && (isLocal || turn === playerColor || (isAI && turn === PLAYERS.WHITE)) && (
        <div className="flex flex-col gap-2 mt-auto pointer-events-auto">
        <div className="flex gap-2">
        <Button onClick={() => handleActionChange('fish')} disabled={supply[turn].fish < 2} className={`flex-1 flex-col py-3 gap-1 transition-all ${selectedAction === 'fish' ? 'bg-teal-500 text-white shadow-teal-500/50' : 'bg-black/40 text-white/60 border border-white/10'}`} variant={selectedAction === 'fish' ? 'primary' : 'ghost'}>
        <div className="flex items-center gap-2"><Fish size={20}/> {t('fish_btn')}</div>
        </Button>
        <Button onClick={() => handleActionChange('shark')} disabled={supply[turn].shark_small === 0 && supply[turn].shark_big_60 === 0 && supply[turn].shark_big_120 === 0 && supply[turn].shark_big_180 === 0} className={`flex-1 flex-col py-3 gap-1 transition-all ${selectedAction === 'shark' ? 'bg-rose-500 text-white shadow-rose-500/50' : 'bg-black/40 text-white/60 border border-white/10'}`} variant={selectedAction === 'shark' ? 'primary' : 'ghost'}>
        <div className="flex items-center gap-2"><SharkIcon size={20} /> {t('shark_btn')}</div>
        </Button>
        </div>

        {selectedAction === 'shark' && <SharkConfigPanel sharkSelection={sharkSelection} setSharkSelection={setSharkSelection} supply={supply} turn={turn} currentMouths={currentMouths} t={t} />}
        {selectedAction === 'fish' && <div className="mt-2 p-2 bg-teal-500/90 backdrop-blur text-white text-[10px] md:text-xs rounded-lg border border-teal-400 flex gap-2 shadow-lg"><Info size={14} className="shrink-0 mt-0.5" />{phase === 'PLACING_FISH_1' ? t('instr_fish_1') : t('instr_fish_2')}</div>}
        </div>
      )}
      </div>

      {/* RIGHT PANEL: BLACK SUPPLY & VERSION */}
      <div className="absolute top-24 right-2 bottom-4 z-40 w-32 flex flex-col items-end justify-between pointer-events-none">
      <div className="w-full pointer-events-auto">
      <SupplyCard player={PLAYERS.BLACK} supply={supply.black} chainLength={chainLengths.black.size} isTurn={turn === PLAYERS.BLACK} isLocal={isLocal} isAI={isAI} t={t} />
      </div>
      <div className="flex flex-col items-end gap-2 w-full pointer-events-auto">
      <div className="flex flex-col gap-2 w-full">
      <button onClick={() => setShowRules(true)} className="px-3 py-2 rounded-xl bg-white/10 hover:bg-white/20 flex items-center justify-end gap-2 text-white backdrop-blur border border-white/10 text-xs font-bold transition-all shadow-lg w-full">
      {t('rules')} <BookOpen size={16}/>
      </button>
      <button onClick={exitLobby} className="px-3 py-2 rounded-xl bg-red-500/20 hover:bg-red-500/40 flex items-center justify-end gap-2 text-red-100 backdrop-blur border border-red-500/20 text-xs font-bold transition-all shadow-lg w-full">
      {t('exit_lobby')} <LogOut size={16}/>
      </button>
      </div>
      <div className="text-[10px] text-white/30 font-mono text-right mt-2 w-full">{APP_VERSION}</div>
      </div>
      </div>

      {/* BOARD CENTER */}
      <div className="absolute inset-0 flex items-center justify-center z-10 pl-0 md:pl-0 pointer-events-none">
      <div style={{ transform: `scale(${boardScale})` }} className="transition-transform duration-300 pointer-events-auto">
      <div className="relative w-[800px] h-[800px]">
      {board.map(cell => renderCell(cell))}
      </div>
      </div>
      </div>

      {/* GAME OVER OVERLAY (In Sidebar Area) */}
      {winner && (
        <div className="absolute top-24 left-4 z-50 pointer-events-auto w-48 animate-in slide-in-from-left-4">
        <div className="bg-black/60 backdrop-blur border-2 border-teal-500 p-4 rounded-xl shadow-2xl text-center">
        <Trophy size={32} className="mx-auto text-yellow-400 mb-2 animate-bounce" />
        <div className="text-xl font-black text-white mb-1">{winner === 'DRAW' ? t('tie_msg') : (winner === PLAYERS.WHITE ? "BLANC" : "NEGRE")}</div>
        <div className="text-[10px] text-teal-300 font-bold mb-4 uppercase tracking-widest">{winReason}</div>
        <Button onClick={handleRestart} className="w-full shadow-teal-500/20 bg-emerald-500 hover:bg-emerald-400"><RotateCw size={16}/> {t('play_again')}</Button>
        </div>
        </div>
      )}

      {/* RULES MODAL */}
      {showRules && <Modal title={t('rules_title')} onClose={() => setShowRules(false)}>
      <div className="space-y-4 text-slate-600 text-sm">
      <p className="bg-slate-50 p-3 rounded-lg border border-slate-200">{t('rules_goal')}</p>
      <div><h4 className="font-bold text-teal-700">{t('rules_action1_title')}</h4><p>{t('rules_action1_desc')}</p></div>
      <div><h4 className="font-bold text-rose-700">{t('rules_action2_title')}</h4><p>{t('rules_action2_desc')}</p><p className="mt-2 text-xs bg-rose-50 p-2 rounded text-rose-800">{t('rules_shark_eat')}</p></div>
      <p className="text-xs text-slate-400 italic border-t pt-2">{t('rules_shark_types')}</p>
      <div><h4 className="font-bold text-slate-700">{t('rules_end_condition')}</h4></div>
      <div className="mt-4 pt-4 border-t border-slate-200">
      <h4 className="font-bold text-slate-700 mb-2">{t('rules_links_title')}</h4>
      <div className="flex flex-col gap-2 text-xs">
      <a href="https://boardgamegeek.com/boardgame/424373/xok" target="_blank" rel="noreferrer" className="text-teal-600 hover:underline flex items-center gap-1"><LinkIcon size={12}/> {t('link_bgg')}</a>
      <a href="https://steffen-spiele.com/products/xok" target="_blank" rel="noreferrer" className="text-teal-600 hover:underline flex items-center gap-1"><LinkIcon size={12}/> {t('link_publisher')}</a>
      </div>
      </div>
      </div>
      </Modal>}

      </div>
    );
}
