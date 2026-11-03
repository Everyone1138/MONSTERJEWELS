
import {initializeApp} from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js';
import {getAuth,signInAnonymously} from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js';
import {getDatabase,ref,get,onValue,runTransaction} from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-database.js';
import {MONSTERS,monsterSVG} from './monsters.js';
import {mountMonster,playMonsterAttack} from './three-monsters.js';

const $=id=>document.getElementById(id);
const icons=['🔥','💧','⚡','🔮','🍀'];
const colors=['#ff6c63','#5dcdf8','#ffdc61','#bb91ff','#71e7a1'];
const COST=9;

let db,auth,uid,room='',seat=-1,state=null;
let unsubscribe=null,selected=-1,demo=false,busy=false;
let chosen=0,lastFx='',botTimer=null;
let renderedMonsters=[-1,-1];

const configured=!!(
  window.FIREBASE_CONFIG?.apiKey &&
  window.FIREBASE_CONFIG?.databaseURL
);

$('network').textContent=configured?'ONLINE READY':'LOCAL DEMO';

function show(id){
  for(const x of ['lobby','waiting','game'])
    $(x).classList.toggle('hidden',x!==id);
}

function error(e){
  $('error').textContent=e?.message||String(e);
}

function rand(n){
  return Math.floor(Math.random()*n);
}

function matches(b){
  const out=new Set();
  for(let r=0;r<7;r++){
    for(let c=0;c<7;c++){
      const i=r*7+c;
      for(const [dr,dc] of [[0,1],[1,0]]){
        const run=[i];
        let rr=r+dr,cc=c+dc;
        while(rr<7&&cc<7&&b[rr*7+cc]===b[i]){
          run.push(rr*7+cc);
          rr+=dr;
          cc+=dc;
        }
        if(run.length>=3)run.forEach(x=>out.add(x));
      }
    }
  }
  return [...out];
}

function hasMove(b){
  for(let i=0;i<49;i++){
    for(const j of [i+1,i+7]){
      if(j>=49||(j===i+1&&i%7===6))continue;
      const a=[...b];
      [a[i],a[j]]=[a[j],a[i]];
      if(matches(a).length)return true;
    }
  }
  return false;
}

function makeBoard(){
  let b;
  do{
    b=Array.from({length:49},()=>rand(5));
  }while(matches(b).length||!hasMove(b));
  return b;
}

function initial(p1,p2){
  return {
    players:[p1,p2],
    hp:[100,100],
    energy:[0,0],
    turn:0,
    round:1,
    board:makeBoard(),
    winner:-1,
    last:'Battle begins! Match your monster’s element to charge an attack.',
    attack:null,
    created:Date.now()
  };
}

function updateMove(s,a,b,who){
  if(s.winner!==-1||s.turn!==who||
    !Number.isInteger(a)||!Number.isInteger(b)||
    a<0||b<0||a>=49||b>=49)return null;

  if(!(Math.abs(a-b)===7||
    (Math.abs(a-b)===1&&
    Math.floor(a/7)===Math.floor(b/7))))return null;

  const board=[...s.board];
  [board[a],board[b]]=[board[b],board[a]];

  const found=matches(board);
  if(!found.length)return null;

  const element=MONSTERS[s.players[who].monster??0].element;
  const gained=found.filter(i=>board[i]===element).length;

  const next={
    ...s,
    board,
    hp:[...s.hp],
    energy:[...(s.energy||[0,0])],
    round:s.round+1,
    attack:null
  };

  next.energy[who]+=gained;

  for(const i of found)next.board[i]=rand(5);

  let loops=0;
  while(matches(next.board).length&&loops++<30){
    for(const i of matches(next.board))
      next.board[i]=rand(5);
  }

  if(!hasMove(next.board))next.board=makeBoard();

  next.last=`${s.players[who].name} matched ${found.length} gems. +${gained} ${icons[element]} energy.`;

  if(next.energy[who]>=COST){
    next.energy[who]-=COST;
    const damage=22+(found.length>=4?7:0);

    next.hp[1-who]=Math.max(0,next.hp[1-who]-damage);
    next.attack={from:who,damage,nonce:next.round};

    next.last=`💥 ${MONSTERS[s.players[who].monster??0].name} used ${MONSTERS[s.players[who].monster??0].ability}! ${damage} damage!`;
  }

  next.turn=1-who;

  if(next.hp[1-who]===0){
    next.winner=who;
    next.last=`🏆 ${s.players[who].name} wins the battle!`;
  }

  return next;
}

function drawPicker(){
  const el=$('roster');
  el.replaceChildren();

  MONSTERS.forEach((m,i)=>{
    const b=document.createElement('button');
    b.className='monster-choice'+(chosen===i?' picked':'');
    b.style.setProperty('--monster',m.primary);

    b.innerHTML=`
      <div class="mini-monster">${monsterSVG(i,'pick'+i)}</div>
      <strong>${m.name}</strong>
      <small>${icons[m.element]} ${m.ability}</small>
    `;

    b.onclick=()=>{
      chosen=i;
      drawPicker();
    };
    el.append(b);
  });

  $('chosen').textContent=`Selected: ${MONSTERS[chosen].name} · ${icons[MONSTERS[chosen].element]} ${MONSTERS[chosen].ability}`;
}

function render(){
  if(!state||!state.players?.[1])return;

  show('game');

  for(let i=0;i<2;i++){
    const p=state.players[i];
    const m=MONSTERS[p.monster??(i?1:0)];

    $('n'+i).textContent=p.name+' · '+m.name;
    $('h'+i).style.width=state.hp[i]+'%';
    $('s'+i).textContent=state.hp[i]+' / 100 HP';

    $('f'+i).classList.toggle(
      'active',
      state.turn===i&&state.winner===-1
    );

    if(renderedMonsters[i] !== (p.monster??(i?1:0))){
      renderedMonsters[i]=p.monster??(i?1:0);

      mountMonster($('art'+i),renderedMonsters[i],i)
        .catch(()=>{
          $('art'+i).classList.add('fallback');
          $('art'+i).innerHTML=monsterSVG(
            renderedMonsters[i],'arena'+i
          );
          $('renderstatus').textContent='2D fallback active';
        });
    }

    $('energy'+i).style.width=
      Math.min(100,(state.energy?.[i]||0)/COST*100)+'%';

    $('charge'+i).textContent=
      `${icons[m.element]} ${state.energy?.[i]||0}/${COST}`;

    $('f'+i).style.setProperty('--monster',m.primary);
  }

  $('turnstatus').textContent=state.winner>=0
    ?(state.winner===seat?'🏆 You won!':'💀 Your rival won!')
    :(state.turn===seat
      ?'✨ YOUR TURN — MATCH YOUR COLOR'
      :'⏳ OPPONENT’S TURN');

  $('moves').textContent=`TURN ${state.round}`;
  $('log').textContent=state.last;

  const mine=MONSTERS[state.players[seat]?.monster??0];

  $('target').innerHTML=`
    <span class="target-dot" style="background:${colors[mine.element]}">
      ${icons[mine.element]}
    </span>
    <span>
      MATCH <b>${icons[mine.element]}
      ${['RED','BLUE','YELLOW','PURPLE','GREEN'][mine.element]}</b> GEMS
      <br>
      <small>Charge ${mine.ability} ·
      ${state.energy?.[seat]||0}/${COST}</small>
    </span>
  `;

  const board=$('board');
  board.replaceChildren();

  state.board.forEach((v,i)=>{
    const t=document.createElement('button');

    t.className='tile'
      +(selected===i?' selected':'')
      +(v===mine.element?' target-gem':'');

    t.dataset.t=v;
    t.textContent=icons[v];
    t.setAttribute('aria-label',`Gem ${i+1}: ${icons[v]}`);

    t.disabled=state.winner!==-1||
      state.turn!==seat||busy;

    t.onclick=()=>tap(i);
    board.append(t);
  });

  $('restart').classList.toggle('hidden',!demo);

  const fx=state.attack;
  if(fx&&lastFx!==`${room}:${fx.nonce}`){
    lastFx=`${room}:${fx.nonce}`;
    animateAttack(fx);
  }
}

function animateAttack(fx){
  playMonsterAttack(fx.from);

  const attacker=$('art'+fx.from);
  const defender=$('art'+(1-fx.from));

  attacker.classList.remove('striking');
  defender.classList.remove('hit');
  void attacker.offsetWidth;

  attacker.classList.add('striking');

  setTimeout(()=>{
    defender.classList.add('hit');

    const flash=$('attackflash');
    flash.textContent=`⚔️ −${fx.damage} HP`;
    flash.classList.remove('hidden');
    flash.classList.remove('blast');
    void flash.offsetWidth;
    flash.classList.add('blast');

    setTimeout(()=>flash.classList.add('hidden'),950);
  },300);
}

function botMove(){
  if(!demo||!state||state.winner!==-1||state.turn!==1)return;

  const moves=[];

  for(let x=0;x<49;x++){
    for(const y of [x+1,x+7]){
      if(y>=49||(y===x+1&&x%7===6))continue;

      const b=[...state.board];
      [b[x],b[y]]=[b[y],b[x]];

      const found=matches(b);
      if(found.length){
        moves.push({
          x,y,
          score:found.filter(i=>
            b[i]===MONSTERS[state.players[1].monster].element
          ).length*10+found.length
        });
      }
    }
  }

  moves.sort((a,b)=>b.score-a.score);

  if(moves.length){
    const pick=moves[rand(Math.min(3,moves.length))];
    state=updateMove(state,pick.x,pick.y,1);
    render();
  }
}

async function tap(i){
  if(busy||!state||state.turn!==seat)return;

  if(selected===-1){
    selected=i;
    render();
    return;
  }

  const a=selected;
  selected=-1;

  if(a===i){
    render();
    return;
  }

  if(demo){
    const n=updateMove(state,a,i,0);

    if(n){
      state=n;
      render();
      if(state.winner===-1)
        botTimer=setTimeout(botMove,950);
    }else render();

    return;
  }

  busy=true;

  try{
    const result=await runTransaction(
      ref(db,'rooms/'+room),
      s=>{
        if(!s||s.players?.[seat]?.uid!==uid||
          s.players?.length!==2)return;

        return updateMove(s,a,i,seat)||undefined;
      },
      {applyLocally:false}
    );

    if(!result.committed){
      console.info('Move was not committed.');
    }
  }catch(e){
    console.error('Move failed:',e);
    alert(e.message);
  }finally{
    busy=false;
    render();
  }
}

function name(){
  return $('nickname').value.trim().slice(0,18)||'Trainer';
}

async function connect(){
  if(!configured){
    throw Error(
      'Add your Firebase configuration to config.js to enable online rooms.'
    );
  }

  if(!db){
    const app=initializeApp(window.FIREBASE_CONFIG);
    db=getDatabase(app);
    auth=getAuth(app);
  }

  if(!uid){
    const cred=await signInAnonymously(auth);
    uid=cred.user.uid;
  }
}

function watch(code){
  if(unsubscribe)unsubscribe();

  room=code;

  unsubscribe=onValue(
    ref(db,'rooms/'+code),
    snap=>{
      const s=snap.val();

      if(!s){
        alert('Room was closed.');
        leave();
        return;
      }

      state=s;
      seat=s.players?.findIndex(p=>p?.uid===uid)??-1;

      if(seat<0){
        alert('This room is full.');
        leave();
        return;
      }

      if(s.players?.[1]){
        render();
      }else{
        show('waiting');
        $('roomcode').textContent=code;
        $('waitinfo').textContent='Waiting for player two…';
      }
    },
    e=>{
      console.error('Room listener failed:',e);
      alert(e.message);
    }
  );
}

function roomCode(){
  const alphabet='ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  return Array.from(
    {length:6},
    ()=>alphabet[rand(alphabet.length)]
  ).join('');
}

// HOST: CREATE ROOM
$('create').onclick=async()=>{
  try{
    $('error').textContent='';
    await connect();

    let code,done=false;

    for(let tries=0;tries<8&&!done;tries++){
      code=roomCode();

      const result=await runTransaction(
        ref(db,'rooms/'+code),
        s=>s===null?{
          players:[{uid,name:name(),monster:chosen}],
          hp:[100,100],
          energy:[0,0],
          turn:0,
          round:1,
          board:makeBoard(),
          winner:-1,
          last:'Waiting for rival…',
          created:Date.now()
        }:undefined,
        {applyLocally:false}
      );

      done=result.committed;
    }

    if(!done){
      throw Error('Could not create a unique room. Try again.');
    }

    history.replaceState(
      null,'',
      location.pathname+'?room='+code
    );

    watch(code);

  }catch(e){
    console.error('Create room failed:',e);
    error(e);
  }
};

// GUEST: JOIN ROOM
$('join').onclick=async()=>{
  try{
    $('error').textContent='';
    await connect();

    const code=$('joincode').value.trim().toUpperCase();

    if(!/^[A-Z2-9]{6}$/.test(code)){
      throw Error('Enter a valid six-character room code.');
    }

    const roomRef=ref(db,'rooms/'+code);

    // Confirm the room exists on Firebase.
    const snapshot=await get(roomRef);

    if(!snapshot.exists()){
      throw Error(
        'Room does not exist. Check the code and keep the host screen open.'
      );
    }

    const current=snapshot.val();

    if(!current.players?.[0]?.uid){
      throw Error('This room has no host.');
    }

    if(Date.now()-current.created>86400000){
      throw Error('This room has expired. Create a new room.');
    }

    if(
      current.players?.[1] &&
      !current.players.some(p=>p?.uid===uid)
    ){
      throw Error('This room already has two players.');
    }

    const player={
      uid,
      name:name(),
      monster:chosen
    };

    // Add only player two. Preserve the existing board,
    // HP, turn, creation time, and other room data.
    const result=await runTransaction(
      roomRef,
      s=>{
        if(!s||!s.players?.[0]?.uid)return;

        // Already a member: no update needed.
        if(s.players.some(p=>p?.uid===uid))return;

        if(s.players[1]||Date.now()-s.created>86400000){
          return;
        }

        return {
          ...s,
          players:[s.players[0],player],
          last:'Both players connected! Battle begins!'
        };
      },
      {applyLocally:false}
    );

    // A previously joined player may not need a write.
    const finalSnap=result.committed
      ?result.snapshot
      :await get(roomRef);

    if(
      !finalSnap.exists()||
      !finalSnap.val().players?.some(p=>p?.uid===uid)
    ){
      throw Error(
        'Could not join this room. It may be full or the join was rejected.'
      );
    }

    history.replaceState(
      null,'',
      location.pathname+'?room='+code
    );

    watch(code);

  }catch(e){
    console.error('Join failed:',e);
    error(e);
  }
};

// OFFLINE DEMO
$('demo').onclick=()=>{
  demo=true;
  room='demo';
  seat=0;

  state=initial(
    {name:name(),monster:chosen},
    {
      name:'CPU Rival',
      monster:(chosen+1+rand(9))%10
    }
  );

  selected=-1;
  lastFx='';
  render();
};

$('restart').onclick=()=>{
  $('demo').click();
};

function leave(){
  renderedMonsters=[-1,-1];

  if(botTimer)clearTimeout(botTimer);
  if(unsubscribe)unsubscribe();

  unsubscribe=null;
  state=null;
  room='';
  demo=false;
  seat=-1;
  selected=-1;

  history.replaceState(null,'',location.pathname);
  show('lobby');
}

$('leave').onclick=leave;

// SHARE INVITATION
$('share').onclick=async()=>{
  const url=new URL(location.href);
  url.searchParams.set('room',room);

  try{
    await navigator.clipboard.writeText(url.href);
    $('share').textContent='✓ Link copied!';
  }catch{
    prompt('Copy this invitation link:',url.href);
  }
};

// AUTO-FILL INVITATION CODE
const invited=new URLSearchParams(location.search).get('room');

if(invited){
  $('joincode').value=invited.toUpperCase();
  $('error').textContent=
    'Invitation detected! Pick a monster, enter your nickname and tap Join.';
}

drawPicker();
