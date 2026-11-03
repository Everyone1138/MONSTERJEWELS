
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js';
import { getAuth, signInAnonymously } from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js';
import {
  getDatabase,
  ref,
  get,
  onValue,
  runTransaction
} from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-database.js';

import { MONSTERS, monsterSVG } from './monsters.js';
import { mountMonster, playMonsterAttack } from './three-monsters.js';

const $ = id => document.getElementById(id);

const icons = ['🔥', '💧', '⚡', '🔮', '🍀'];
const colors = ['#ff6c63', '#5dcdf8', '#ffdc61', '#bb91ff', '#71e7a1'];
const colorNames = ['RED', 'BLUE', 'YELLOW', 'PURPLE', 'GREEN'];

const COST = 9;
const SIZE = 7;
const ROOM_LIFETIME = 86400000;

let db, auth, uid;
let room = '';
let seat = -1;
let state = null;
let unsubscribe = null;
let selected = -1;
let demo = false;
let busy = false;
let chosen = 0;
let lastFx = '';
let botTimer = null;
let renderedMonsters = [-1, -1];

const configured = !!(
  window.FIREBASE_CONFIG?.apiKey &&
  window.FIREBASE_CONFIG?.databaseURL
);

$('network').textContent = configured ? 'ONLINE READY' : 'LOCAL DEMO';

function show(id) {
  for (const x of ['lobby', 'waiting', 'game']) {
    $(x).classList.toggle('hidden', x !== id);
  }
}

function error(e) {
  $('error').textContent = e?.message || String(e);
}

function rand(n) {
  return Math.floor(Math.random() * n);
}

// Deterministic random generator for synchronized battles.
// The same board and seed produce the same refill gems.
function nextRandom(seed) {
  const next = (Math.imul(seed >>> 0, 1664525) + 1013904223) >>> 0;
  return { seed: next, value: next % 5 };
}

function scanMatches(board) {
  const cells = new Set();
  let longest = 0;

  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) {
      const color = board[r * SIZE + c];

      if (color === null || color === undefined) continue;

      for (const [dr, dc] of [[0, 1], [1, 0]]) {
        const previousR = r - dr;
        const previousC = c - dc;

        if (
          previousR >= 0 && previousR < SIZE &&
          previousC >= 0 && previousC < SIZE &&
          board[previousR * SIZE + previousC] === color
        ) continue;

        const run = [];
        let rr = r;
        let cc = c;

        while (
          rr >= 0 && rr < SIZE &&
          cc >= 0 && cc < SIZE &&
          board[rr * SIZE + cc] === color
        ) {
          run.push(rr * SIZE + cc);
          rr += dr;
          cc += dc;
        }

        if (run.length >= 3) {
          run.forEach(i => cells.add(i));
          longest = Math.max(longest, run.length);
        }
      }
    }
  }

  return { cells: [...cells], longest };
}

function matches(board) {
  return scanMatches(board).cells;
}

function hasMove(board) {
  for (let i = 0; i < 49; i++) {
    for (const j of [i + 1, i + SIZE]) {
      if (j >= 49 || (j === i + 1 && i % SIZE === SIZE - 1)) {
        continue;
      }

      const copy = [...board];
      [copy[i], copy[j]] = [copy[j], copy[i]];

      if (matches(copy).length) return true;
    }
  }

  return false;
}

function makeBoard() {
  let board;

  do {
    board = Array.from({ length: 49 }, () => rand(5));
  } while (matches(board).length || !hasMove(board));

  return board;
}

function applyGravity(board, removed, seed) {
  const empty = new Set(removed);

  for (let col = 0; col < SIZE; col++) {
    const remaining = [];

    for (let row = SIZE - 1; row >= 0; row--) {
      const index = row * SIZE + col;

      if (!empty.has(index)) {
        remaining.push(board[index]);
      }
    }

    let row = SIZE - 1;

    for (const gem of remaining) {
      board[row * SIZE + col] = gem;
      row--;
    }

    while (row >= 0) {
      const random = nextRandom(seed);
      seed = random.seed;
      board[row * SIZE + col] = random.value;
      row--;
    }
  }

  return seed;
}

function initial(p1, p2) {
  return {
    players: [p1, p2],
    hp: [100, 100],
    energy: [0, 0],
    turn: 0,
    movesLeft: 2,
    round: 1,
    board: makeBoard(),
    seed: Math.floor(Math.random() * 4294967295),
    winner: -1,
    last: 'Battle begins! Match your monster element to charge an attack.',
    attack: null,
    created: Date.now()
  };
}

function updateMove(s, a, b, who) {
  if (
    s.winner !== -1 ||
    s.turn !== who ||
    !s.players?.[1] ||
    !Number.isInteger(a) ||
    !Number.isInteger(b) ||
    a < 0 || b < 0 || a >= 49 || b >= 49
  ) return null;

  const adjacent =
    Math.abs(a - b) === SIZE ||
    (
      Math.abs(a - b) === 1 &&
      Math.floor(a / SIZE) === Math.floor(b / SIZE)
    );

  if (!adjacent) return null;

  const board = [...s.board];
  [board[a], board[b]] = [board[b], board[a]];

  const firstMatch = scanMatches(board);

  if (!firstMatch.cells.length) return null;

  const element = MONSTERS[s.players[who].monster ?? 0].element;

  const next = {
    ...s,
    board,
    hp: [...s.hp],
    energy: [...(s.energy || [0, 0])],
    movesLeft: s.movesLeft ?? 2,
    seed: s.seed ?? 123456789,
    attack: null
  };

  let totalMatched = 0;
  let energyGained = 0;
  let cascades = 0;
  const bonusMoves = firstMatch.longest >= 4 ? 1 : 0;

  let current = firstMatch;

  while (current.cells.length && cascades < 30) {
    cascades++;
    totalMatched += current.cells.length;

    for (const index of current.cells) {
      if (next.board[index] === element) {
        energyGained++;
      }
    }

    next.seed = applyGravity(
      next.board,
      current.cells,
      next.seed
    );

    current = scanMatches(next.board);
  }

  // Extremely rare cascade safety fallback.
  if (current.cells.length || !hasMove(next.board)) {
    next.board = makeBoard();
  }

  next.energy[who] += energyGained;

  next.movesLeft = Math.max(
    0,
    next.movesLeft - 1 + bonusMoves
  );

  const playerName = s.players[who].name;

  next.last =
    `${playerName} matched ${totalMatched} gems! ` +
    `+${energyGained} ${icons[element]} energy.` +
    (bonusMoves ? ' ⭐ FOUR MATCH! +1 MOVE!' : '') +
    (cascades > 1 ? ` 🌟 ${cascades}x combo!` : '');

  if (next.energy[who] >= COST) {
    next.energy[who] -= COST;

    const damage = 22 + (firstMatch.cells.length >= 4 ? 7 : 0);

    next.hp[1 - who] = Math.max(
      0,
      next.hp[1 - who] - damage
    );

    next.attack = {
      from: who,
      damage,
      nonce: (s.round || 1) + 1
    };

    const monster = MONSTERS[s.players[who].monster ?? 0];

    next.last +=
      ` 💥 ${monster.name} used ${monster.ability}! ` +
      `${damage} damage!`;
  }

  next.round = (s.round || 1) + 1;

  if (next.hp[1 - who] === 0) {
    next.winner = who;
    next.movesLeft = 0;
    next.last = `🏆 ${playerName} wins the battle!`;
  } else if (next.movesLeft <= 0) {
    next.turn = 1 - who;
    next.movesLeft = 2;
    next.last += ' Next player!';
  } else {
    next.turn = who;
    next.last += ` ${next.movesLeft} move(s) remaining.`;
  }

  return next;
}

function drawPicker() {
  const el = $('roster');
  el.replaceChildren();

  MONSTERS.forEach((m, i) => {
    const b = document.createElement('button');

    b.className = 'monster-choice' + (chosen === i ? ' picked' : '');
    b.style.setProperty('--monster', m.primary);

    b.innerHTML = `
      <div class="mini-monster">${monsterSVG(i, 'pick' + i)}</div>
      <strong>${m.name}</strong>
      <small>${icons[m.element]} ${m.ability}</small>
    `;

    b.onclick = () => {
      chosen = i;
      drawPicker();
    };

    el.append(b);
  });

  const m = MONSTERS[chosen];

  $('chosen').textContent =
    `Selected: ${m.name} · ${icons[m.element]} ${m.ability}`;
}

function render() {
  if (!state || !state.players?.[1]) return;

  show('game');

  for (let i = 0; i < 2; i++) {
    const p = state.players[i];
    const monsterIndex = p.monster ?? (i ? 1 : 0);
    const m = MONSTERS[monsterIndex];

    $('n' + i).textContent = p.name + ' · ' + m.name;
    $('h' + i).style.width = state.hp[i] + '%';
    $('s' + i).textContent = state.hp[i] + ' / 100 HP';

    $('f' + i).classList.toggle(
      'active',
      state.turn === i && state.winner === -1
    );

    if (renderedMonsters[i] !== monsterIndex) {
      renderedMonsters[i] = monsterIndex;

      mountMonster($('art' + i), monsterIndex, i)
        .catch(() => {
          $('art' + i).classList.add('fallback');
          $('art' + i).innerHTML = monsterSVG(
            monsterIndex,
            'arena' + i
          );
          $('renderstatus').textContent = '2D fallback active';
        });
    }

    $('energy' + i).style.width =
      Math.min(100, (state.energy?.[i] || 0) / COST * 100) + '%';

    $('charge' + i).textContent =
      `${icons[m.element]} ${state.energy?.[i] || 0}/${COST}`;

    $('f' + i).style.setProperty('--monster', m.primary);
  }

  $('turnstatus').textContent = state.winner >= 0
    ? (state.winner === seat ? '🏆 You won!' : '💀 Your rival won!')
    : (
      state.turn === seat
        ? '✨ YOUR TURN — MATCH YOUR COLOR'
        : '⏳ OPPONENT’S TURN'
    );

  $('moves').textContent =
    `ROUND ${state.round} · ${state.movesLeft ?? 2} MOVES LEFT`;

  $('log').textContent = state.last;

  const mine = MONSTERS[state.players[seat]?.monster ?? 0];

  $('target').innerHTML = `
    <span class="target-dot" style="background:${colors[mine.element]}">
      ${icons[mine.element]}
    </span>
    <span>
      MATCH <b>${icons[mine.element]}
      ${colorNames[mine.element]}</b> GEMS
      <br>
      <small>Charge ${mine.ability} ·
      ${state.energy?.[seat] || 0}/${COST}</small>
    </span>
  `;

  const board = $('board');
  board.replaceChildren();

  state.board.forEach((v, i) => {
    const t = document.createElement('button');

    t.className =
      'tile' +
      (selected === i ? ' selected' : '') +
      (v === mine.element ? ' target-gem' : '');

    t.dataset.t = v;
    t.textContent = icons[v];
    t.setAttribute('aria-label', `Gem ${i + 1}: ${icons[v]}`);

    t.disabled =
      state.winner !== -1 ||
      state.turn !== seat ||
      busy;

    t.onclick = () => tap(i);
    board.append(t);
  });

  $('restart').classList.toggle('hidden', !demo);

  const fx = state.attack;

  if (fx && lastFx !== `${room}:${fx.nonce}`) {
    lastFx = `${room}:${fx.nonce}`;
    animateAttack(fx);
  }
}

function animateAttack(fx) {
  playMonsterAttack(fx.from);

  const attacker = $('art' + fx.from);
  const defender = $('art' + (1 - fx.from));

  attacker.classList.remove('striking');
  defender.classList.remove('hit');

  void attacker.offsetWidth;

  attacker.classList.add('striking');

  setTimeout(() => {
    defender.classList.add('hit');

    const flash = $('attackflash');
    flash.textContent = `⚔️ −${fx.damage} HP`;
    flash.classList.remove('hidden', 'blast');

    void flash.offsetWidth;

    flash.classList.add('blast');

    setTimeout(() => flash.classList.add('hidden'), 950);
  }, 300);
}

function botMove() {
  if (!demo || !state || state.winner !== -1 || state.turn !== 1) {
    return;
  }

  const moves = [];

  for (let x = 0; x < 49; x++) {
    for (const y of [x + 1, x + SIZE]) {
      if (y >= 49 || (y === x + 1 && x % SIZE === SIZE - 1)) {
        continue;
      }

      const b = [...state.board];
      [b[x], b[y]] = [b[y], b[x]];

      const found = matches(b);

      if (found.length) {
        moves.push({
          x,
          y,
          score: found.filter(
            i => b[i] === MONSTERS[state.players[1].monster].element
          ).length * 10 + found.length
        });
      }
    }
  }

  moves.sort((a, b) => b.score - a.score);

  if (moves.length) {
    const pick = moves[rand(Math.min(3, moves.length))];
    const next = updateMove(state, pick.x, pick.y, 1);

    if (next) {
      state = next;
      render();

      if (state.winner === -1 && state.turn === 1) {
        botTimer = setTimeout(botMove, 950);
      }
    }
  }
}

async function tap(i) {
  if (busy || !state || state.turn !== seat) return;

  if (selected === -1) {
    selected = i;
    render();
    return;
  }

  const a = selected;
  selected = -1;

  if (a === i) {
    render();
    return;
  }

  if (demo) {
    const n = updateMove(state, a, i, 0);

    if (n) {
      state = n;
      render();

      if (state.winner === -1 && state.turn === 1) {
        botTimer = setTimeout(botMove, 950);
      }
    } else {
      render();
    }

    return;
  }

  busy = true;

  try {
    const result = await runTransaction(
      ref(db, 'rooms/' + room),
      s => {
        if (
          !s ||
          s.players?.[seat]?.uid !== uid ||
          !s.players?.[1]
        ) return;

        return updateMove(s, a, i, seat) || undefined;
      },
      { applyLocally: false }
    );

    if (!result.committed) {
      console.info('Move was not committed.');
    }
  } catch (e) {
    console.error('Move failed:', e);
    alert(e.message);
  } finally {
    busy = false;
    render();
  }
}

function name() {
  return $('nickname').value.trim().slice(0, 18) || 'Trainer';
}

async function connect() {
  if (!configured) {
    throw Error('Add Firebase configuration to config.js.');
  }

  if (!db) {
    const app = initializeApp(window.FIREBASE_CONFIG);
    db = getDatabase(app);
    auth = getAuth(app);
  }

  if (!uid) {
    const cred = await signInAnonymously(auth);
    uid = cred.user.uid;
  }
}

function watch(code) {
  if (unsubscribe) unsubscribe();

  room = code;

  unsubscribe = onValue(
    ref(db, 'rooms/' + code),
    snap => {
      const s = snap.val();

      if (!s) {
        alert('Room was closed.');
        leave();
        return;
      }

      state = s;

      seat = s.players?.findIndex(p => p?.uid === uid) ?? -1;

      if (seat < 0) {
        alert('You are not registered in this room.');
        leave();
        return;
      }

      if (s.players?.[1]) {
        render();
      } else {
        show('waiting');
        $('roomcode').textContent = code;
        $('waitinfo').textContent = 'Waiting for player two…';
      }
    },
    e => {
      console.error('Room listener failed:', e);
      alert(e.message);
    }
  );
}

function roomCode() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

  return Array.from(
    { length: 6 },
    () => alphabet[rand(alphabet.length)]
  ).join('');
}

// CREATE MULTIPLAYER ROOM
$('create').onclick = async () => {
  try {
    $('error').textContent = '';
    await connect();

    let code;
    let done = false;

    for (let tries = 0; tries < 8 && !done; tries++) {
      code = roomCode();

      const result = await runTransaction(
        ref(db, 'rooms/' + code),
        s => s === null ? {
          players: [{ uid, name: name(), monster: chosen }],
          hp: [100, 100],
          energy: [0, 0],
          turn: 0,
          movesLeft: 2,
          round: 1,
          board: makeBoard(),
          seed: Math.floor(Math.random() * 4294967295),
          winner: -1,
          last: 'Waiting for rival…',
          created: Date.now()
        } : undefined,
        { applyLocally: false }
      );

      done = result.committed;
    }

    if (!done) {
      throw Error('Could not create a room. Try again.');
    }

    history.replaceState(
      null, '',
      location.pathname + '?room=' + code
    );

    watch(code);

  } catch (e) {
    console.error('Create room failed:', e);
    error(e);
  }
};

// JOIN MULTIPLAYER ROOM
$('join').onclick = async () => {
  try {
    $('error').textContent = '';
    await connect();

    const code = $('joincode').value.trim().toUpperCase();

    if (!/^[A-Z2-9]{6}$/.test(code)) {
      throw Error('Enter a valid six-character room code.');
    }

    const roomRef = ref(db, 'rooms/' + code);
    const snapshot = await get(roomRef);

    if (!snapshot.exists()) {
      throw Error('Room not found. Ask the host for a new code.');
    }

    const data = snapshot.val();

    if (!data.players?.[0]?.uid) {
      throw Error('This room has no host.');
    }

    if (Date.now() - data.created > ROOM_LIFETIME) {
      throw Error('Room expired. Create a new room.');
    }

    const existingSeat = data.players.findIndex(
      p => p?.uid === uid
    );

    if (existingSeat >= 0) {
      seat = existingSeat;

      history.replaceState(
        null, '',
        location.pathname + '?room=' + code
      );

      watch(code);
      return;
    }

    if (data.players[1]) {
      throw Error('This room already has two players.');
    }

    const playerRef = ref(
      db,
      'rooms/' + code + '/players/1'
    );

    const newPlayer = {
      uid,
      name: name(),
      monster: chosen
    };

    const result = await runTransaction(
      playerRef,
      current => {
        if (current === null) {
          return newPlayer;
        }

        if (current.uid === uid) {
          return current;
        }

        return;
      },
      { applyLocally: false }
    );

    if (!result.committed) {
      throw Error(
        'Player 2 slot is occupied or the transaction was cancelled.'
      );
    }

    const joinedPlayer = result.snapshot.val();

    if (joinedPlayer?.uid !== uid) {
      throw Error('Player identity verification failed.');
    }

    seat = 1;

    history.replaceState(
      null, '',
      location.pathname + '?room=' + code
    );

    watch(code);

  } catch (e) {
    console.error('JOIN ERROR:', e.code, e.message);

    if (
      e.code === 'PERMISSION_DENIED' ||
      e.code === 'database/permission-denied'
    ) {
      error('Firebase denied the join. Check database security rules.');
    } else {
      error(e);
    }
  }
};

// OFFLINE DEMO
$('demo').onclick = () => {
  demo = true;
  room = 'demo';
  seat = 0;

  state = initial(
    { name: name(), monster: chosen },
    {
      name: 'CPU Rival',
      monster: (chosen + 1 + rand(9)) % 10
    }
  );

  selected = -1;
  lastFx = '';
  render();
};

$('restart').onclick = () => {
  $('demo').click();
};

function leave() {
  renderedMonsters = [-1, -1];

  if (botTimer) clearTimeout(botTimer);
  if (unsubscribe) unsubscribe();

  unsubscribe = null;
  state = null;
  room = '';
  demo = false;
  seat = -1;
  selected = -1;

  history.replaceState(null, '', location.pathname);
  show('lobby');
}

$('leave').onclick = leave;

// COPY INVITATION LINK
$('share').onclick = async () => {
  const url = new URL(location.href);
  url.searchParams.set('room', room);

  try {
    await navigator.clipboard.writeText(url.href);
    $('share').textContent = '✓ Link copied!';
  } catch {
    prompt('Copy this invitation link:', url.href);
  }
};

// DETECT INVITATION LINK
const invited = new URLSearchParams(location.search).get('room');

if (invited) {
  $('joincode').value = invited.toUpperCase();

  $('error').textContent =
    'Invitation detected! Pick a monster, enter your nickname and tap Join.';
}

drawPicker();
