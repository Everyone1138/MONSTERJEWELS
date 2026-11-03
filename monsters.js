export const MONSTERS=[
{name:'Pyrofang',element:0,kind:'dragon',primary:'#f45a48',accent:'#ffd077',ability:'Inferno Claw'},
{name:'Tidehorn',element:1,kind:'serpent',primary:'#39b9eb',accent:'#b2faff',ability:'Tidal Crash'},
{name:'Voltiger',element:2,kind:'cat',primary:'#f5c746',accent:'#fff5a5',ability:'Thunder Pounce'},
{name:'Umbra',element:3,kind:'wolf',primary:'#8a6af0',accent:'#dfbaff',ability:'Shadow Rift'},
{name:'Thornback',element:4,kind:'turtle',primary:'#48bc80',accent:'#c9f69b',ability:'Vine Slam'},
{name:'Cindrake',element:0,kind:'phoenix',primary:'#ff8142',accent:'#ffe2a1',ability:'Meteor Wing'},
{name:'Glacielle',element:1,kind:'fox',primary:'#75cfff',accent:'#f0ffff',ability:'Frost Nova'},
{name:'Stormram',element:2,kind:'ram',primary:'#dbb65b',accent:'#fff0bc',ability:'Static Charge'},
{name:'Nightmaw',element:3,kind:'bat',primary:'#a477dd',accent:'#f0a7ef',ability:'Eclipse Bite'},
{name:'Mossgolem',element:4,kind:'golem',primary:'#65a775',accent:'#c4ed90',ability:'Forest Quake'}];
const shapes={
 dragon:`<path d="M65 114 Q18 80 36 37 L83 66 110 27 138 64 178 40 Q184 86 151 115Z" fill="url(#wing)" stroke="#17243b" stroke-width="5"/><path d="M124 156 Q194 181 177 110" fill="none" stroke="${'ACC'}" stroke-width="22" stroke-linecap="round"/>`,
 serpent:`<path d="M79 159 Q14 143 45 110 Q73 84 109 120 Q145 154 169 104" fill="none" stroke="${'ACC'}" stroke-width="32" stroke-linecap="round"/><path d="M50 95 Q29 53 55 33 L90 74" fill="url(#wing)" stroke="#17243b" stroke-width="5"/>`,
 cat:`<path d="M60 75 L47 22 91 57 123 57 167 22 154 81" fill="url(#wing)" stroke="#17243b" stroke-width="6"/><path d="M137 149 Q189 149 173 102" fill="none" stroke="${'ACC'}" stroke-width="17" stroke-linecap="round"/>`,
 wolf:`<path d="M55 88 L32 20 88 54 126 54 175 20 159 91" fill="url(#wing)" stroke="#17243b" stroke-width="6"/><path d="M59 150 L34 172 84 158" fill="${'ACC'}"/>`,
 turtle:`<ellipse cx="109" cy="116" rx="84" ry="63" fill="url(#wing)" stroke="#17243b" stroke-width="6"/><path d="M50 107 L110 57 169 107 142 162 76 162Z" fill="none" stroke="${'ACC'}" stroke-width="7"/>`,
 phoenix:`<path d="M75 118 Q6 105 13 31 Q57 62 91 77 Q114 12 134 25 Q133 61 169 79 L202 31 Q203 105 151 124Z" fill="url(#wing)" stroke="#17243b" stroke-width="5"/>`,
 fox:`<path d="M58 81 L28 21 89 56 131 56 185 21 158 84" fill="url(#wing)" stroke="#17243b" stroke-width="5"/><path d="M125 151 Q208 179 185 112" fill="none" stroke="${'ACC'}" stroke-width="28" stroke-linecap="round"/>`,
 ram:`<path d="M73 80 Q11 88 30 38 Q44 13 74 34 M148 80 Q207 88 190 38 Q177 13 145 34" fill="none" stroke="${'ACC'}" stroke-width="19" stroke-linecap="round"/>`,
 bat:`<path d="M78 92 Q35 39 5 80 L17 111 42 99 54 125 86 110 M139 92 Q182 39 211 80 L200 111 175 99 162 125 131 110" fill="url(#wing)" stroke="#17243b" stroke-width="5"/><path d="M79 67 L75 28 105 58 132 58 153 28 148 67" fill="${'ACC'}"/>`,
 golem:`<path d="M56 91 L24 68 7 106 34 139 65 126 M153 91 L187 68 206 106 177 139 149 126" fill="url(#wing)" stroke="#17243b" stroke-width="6"/><path d="M71 50 L90 22 114 42 143 18 158 61" fill="${'ACC'}" stroke="#17243b" stroke-width="5"/>`};
export function monsterSVG(index,unique='m'){
 const m=MONSTERS[index]||MONSTERS[0],p=m.primary,a=m.accent,id=`${unique}-${index}`;
 const decor=shapes[m.kind].replaceAll('ACC',a).replaceAll('url(#wing)',`url(#w${id})`);
 const spikes=Array.from({length:5},(_,i)=>`<path d="M${67+i*20} ${77-Math.sin(i/4*Math.PI)*18} l-8 -${18+i%2*9} 22 17Z" fill="url(#metal${id})" stroke="#121a30" stroke-width="2"/>`).join('');
 const scales=Array.from({length:16},(_,i)=>{let x=71+(i%4)*25,y=115+Math.floor(i/4)*13;return `<path d="M${x-8} ${y}q8 -8 16 0" fill="none" stroke="${i%3===0?a:'#101a31'}" stroke-width="2" opacity=".45"/>`}).join('');
 const armor=m.kind==='golem'||m.kind==='turtle'?`<path d="M73 98L109 79 148 100 139 143 108 160 77 140Z" fill="url(#metal${id})" opacity=".75" stroke="${a}" stroke-width="3"/><path d="M109 79v80M73 98l66 45M148 100l-71 40" stroke="#fff" opacity=".2" stroke-width="2"/>`:scales;
 const eyes=m.kind==='bat'||m.kind==='wolf'? '#ff81d9':a;
 return `<svg viewBox="0 0 220 205" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="${m.name}"><defs>
 <radialGradient id="b${id}" cx="30%" cy="18%" r="90%"><stop stop-color="${a}"/><stop offset=".3" stop-color="${p}"/><stop offset=".72" stop-color="${p}"/><stop offset="1" stop-color="#121827"/></radialGradient>
 <linearGradient id="w${id}" x1="0" y1="0" x2="1" y2="1"><stop stop-color="${a}"/><stop offset=".38" stop-color="${p}"/><stop offset="1" stop-color="#111827"/></linearGradient>
 <linearGradient id="metal${id}" x1="0" y1="0" x2=".9" y2="1"><stop stop-color="#fff5db"/><stop offset=".25" stop-color="${a}"/><stop offset=".75" stop-color="#34405a"/><stop offset="1" stop-color="#111827"/></linearGradient>
 <radialGradient id="glow${id}"><stop stop-color="${a}" stop-opacity=".7"/><stop offset="1" stop-color="${p}" stop-opacity="0"/></radialGradient>
 <filter id="shadow${id}" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="6"/></filter>
 <filter id="eye${id}"><feGaussianBlur stdDeviation="2"/></filter></defs>
 <ellipse cx="110" cy="182" rx="77" ry="17" fill="${p}" opacity=".38" filter="url(#shadow${id})"/>
 <ellipse cx="110" cy="101" rx="102" ry="93" fill="url(#glow${id})" opacity=".4"/>
 <g stroke-linejoin="round">${decor}${spikes}
 <path d="M65 158 Q37 137 56 91 Q73 56 111 60 Q150 54 164 90 Q184 136 155 159 Q109 181 65 158Z" fill="url(#b${id})" stroke="#101a2b" stroke-width="6"/>
 <path d="M70 150 Q55 178 81 185 L99 167 M137 167 L153 185 Q176 179 157 151" fill="url(#metal${id})" stroke="#111827" stroke-width="5"/>
 ${armor}
 <path d="M68 90 Q108 64 151 88" fill="none" stroke="white" opacity=".28" stroke-width="7" stroke-linecap="round"/>
 <path d="M73 101Q90 87 101 100 M120 100Q136 86 149 101" fill="none" stroke="#101a2b" stroke-width="8" stroke-linecap="round"/>
 <ellipse cx="89" cy="110" rx="12" ry="14" fill="#091223"/><ellipse cx="134" cy="110" rx="12" ry="14" fill="#091223"/>
 <ellipse cx="89" cy="109" rx="7" ry="9" fill="${eyes}" filter="url(#eye${id})"/><ellipse cx="134" cy="109" rx="7" ry="9" fill="${eyes}" filter="url(#eye${id})"/>
 <ellipse cx="89" cy="109" rx="5" ry="7" fill="${eyes}"/><ellipse cx="134" cy="109" rx="5" ry="7" fill="${eyes}"/>
 <circle cx="86" cy="105" r="3" fill="#fff"/><circle cx="131" cy="105" r="3" fill="#fff"/>
 <path d="M95 135Q110 147 126 135L120 146 113 140 105 147Z" fill="#171626" stroke="#111827" stroke-width="3"/>
 <path d="M100 137l5 10 5-7 7 7 4-10" fill="#f5f7ff"/>
 <path d="M55 117Q47 130 56 145 M165 113Q174 129 164 145" fill="none" stroke="${a}" opacity=".5" stroke-width="4"/>
 </g></svg>`;
}
