(function(){
  const stage=document.getElementById('stage');
  const slides=[...stage.querySelectorAll('.slide')];
  const bar=document.getElementById('progress');
  // each module file declares where it sits in the day: <body data-start data-total data-prev data-next>
  const cfg=document.body.dataset;
  const START=+cfg.start||1, TOTAL=+cfg.total||slides.length;
  let i=0;

  // keep paths, @mentions and /commands left-to-right inside Hebrew text
  const TOKEN=/(@?(?:[A-Za-z0-9_.][A-Za-z0-9_.\-]*)?\/[A-Za-z0-9_.\-\/]*|@[A-Za-z0-9_.][A-Za-z0-9_.\-\/]*)/g;
  const walker=document.createTreeWalker(stage,NodeFilter.SHOW_TEXT,{acceptNode:n=>
    n.parentElement.closest('code,.en,script,style,.code:not(.he)')||!new RegExp(TOKEN.source).test(n.data)
      ?NodeFilter.FILTER_REJECT:NodeFilter.FILTER_ACCEPT});
  const hits=[]; while(walker.nextNode())hits.push(walker.currentNode);
  hits.forEach(n=>{
    const frag=document.createDocumentFragment();
    n.data.split(TOKEN).forEach((part,k)=>{
      if(!part)return;
      if(k%2){const s=document.createElement('span');s.className='en';s.dir='ltr';s.textContent=part;frag.appendChild(s)}
      else frag.appendChild(document.createTextNode(part));
    });
    n.replaceWith(frag);
  });

  // footer with slide number on every slide
  slides.forEach((s,n)=>{
    const f=document.createElement('div'); f.className='foot';
    f.innerHTML='<span>Claude Code for Everyone · יום '+(cfg.day||'א׳')+'</span><span dir="ltr">'+(START+n)+' / '+TOTAL+'</span>';
    s.appendChild(f);
  });

  function fit(){
    const k=Math.min(innerWidth/1600, innerHeight/900);
    stage.style.transform='translate(-50%,-50%) scale('+k+')';
  }
  // elements marked .reveal stay hidden until Next (or a click on their spot); Next then moves on only when none are left
  function advance(){
    const hidden=slides[i].querySelector('.reveal:not(.shown)');
    if(hidden){hidden.classList.add('shown');return}
    go(i+1);
  }
  // a click shows the next hidden card in order (1, 2, 3, ...), wherever you click on the slide; the last click lets the slide stay as is
  stage.addEventListener('click',e=>{
    if(e.target.closest('button,a,input,textarea,select,.opt,.fc,.copy,.timer,[data-poll],[data-quiz]'))return;
    const hidden=slides[i].querySelector('.reveal:not(.shown)');
    if(hidden)hidden.classList.add('shown');
  });
  function go(n){
    // stepping past either edge opens the neighbouring module file
    if(n>=slides.length&&cfg.next){location.href=cfg.next;return}
    if(n<0&&cfg.prev){location.href=cfg.prev+(cfg.prev==='index.html'?'':'#last');return}
    const i0=i;
    i=Math.max(0,Math.min(slides.length-1,n));
    const back=n<i0;
    slides.forEach((s,k)=>s.classList.toggle('active',k===i));
    // arriving forwards hides the reveals again; arriving backwards shows them all
    slides[i].querySelectorAll('.reveal').forEach(el=>el.classList.toggle('shown',back));
    const acc=getComputedStyle(slides[i]).getPropertyValue('--acc');
    bar.style.width=((START+i)/TOTAL*100)+'%'; bar.style.background=acc;
    history.replaceState(null,'','#'+(START+i));
  }

  addEventListener('resize',fit);
  addEventListener('keydown',e=>{
    if(['ArrowRight','PageDown',' ','Enter'].includes(e.key)){e.preventDefault();advance()}
    else if(['ArrowLeft','PageUp','Backspace'].includes(e.key)){e.preventDefault();go(i-1)}
    else if(e.key==='Home')go(0);
    else if(e.key==='End')go(slides.length-1);
    else if(e.key==='f')toggleFs();
  });
  function toggleFs(){document.fullscreenElement?document.exitFullscreen():document.documentElement.requestFullscreen()}
  document.getElementById('next').onclick=advance;
  document.getElementById('prev').onclick=()=>go(i-1);
  document.getElementById('fs').onclick=toggleFs;

  // flashcards
  stage.querySelectorAll('.fc').forEach(c=>c.addEventListener('click',()=>c.classList.toggle('flipped')));

  // quiz: one answer, reveal explanation
  stage.querySelectorAll('[data-quiz]').forEach(box=>{
    const ex=box.parentElement.querySelector('.explain');
    box.querySelectorAll('.opt').forEach(b=>b.addEventListener('click',()=>{
      if(box.dataset.done)return; box.dataset.done=1;
      box.querySelectorAll('.opt').forEach(o=>{if(o.hasAttribute('data-correct'))o.classList.add('right')});
      if(!b.hasAttribute('data-correct'))b.classList.add('wrong');
      ex&&ex.classList.add('show');
    }));
  });
  // poll: no right answer, just highlight + reveal takeaway
  stage.querySelectorAll('[data-poll]').forEach(box=>{
    const ex=box.parentElement.querySelector('.explain');
    box.querySelectorAll('.opt').forEach(b=>b.addEventListener('click',()=>{
      box.querySelectorAll('.opt').forEach(o=>o.classList.remove('right'));
      b.classList.add('right'); ex&&ex.classList.add('show');
    }));
  });

  // copy buttons
  stage.querySelectorAll('.copy').forEach(btn=>btn.addEventListener('click',e=>{
    e.stopPropagation();
    const txt=btn.parentElement.innerText.replace(btn.innerText,'').trim();
    navigator.clipboard.writeText(txt).then(()=>{btn.textContent='הועתק ✓';btn.classList.add('done');
      setTimeout(()=>{btn.textContent='העתק';btn.classList.remove('done')},1500)});
  }));

  // workshop countdown: click the timer to start/pause
  stage.querySelectorAll('.timer').forEach(t=>{
    let left=null,h=null;
    t.style.cursor='pointer';
    t.addEventListener('click',()=>{
      if(left===null){const [m,s]=t.textContent.split(':');left=+m*60+ +s}
      if(h){clearInterval(h);h=null;return}
      h=setInterval(()=>{left=Math.max(0,left-1);
        t.textContent=String(Math.floor(left/60)).padStart(2,'0')+':'+String(left%60).padStart(2,'0');
        if(!left){clearInterval(h);t.style.background='var(--red)'}},1000);
    });
  });

  // ---- presenter view: press P (or the notes button) to open notes in a second window ----
  // The popup polls this page with postMessage, so it keeps working when you move between module files.
  const slideTitle=el=>{
    if(!el)return '';
    const h=el.querySelector('h1,h2,.q');
    return ((h?h.textContent:(el.querySelector('.kicker')||{}).textContent)||'').replace(/\s+/g,' ').trim();
  };
  const viewState=()=>({
    n:START+i, total:TOTAL, title:slideTitle(slides[i]),
    notes:(slides[i].querySelector('.notes')||{}).innerHTML||'<p>אין הערות לשקף הזה.</p>',
    next:i+1<slides.length?slideTitle(slides[i+1]):(cfg.next?'המודול הבא':'סוף')
  });
  addEventListener('message',e=>{
    const d=e.data||{};
    if(d.req&&e.source)e.source.postMessage({state:viewState()},'*');
    if(d.go===1)advance();else if(d.go)go(i+d.go);
  });
  function openPresenter(){
    // a real page (presenter.html) instead of an empty about:blank window, so it also works in embedded browsers
    const w=window.open('presenter.html','presenter','width=900,height=720');
    if(!w){alert('הדפדפן חסם את החלון. אפשרו חלונות קופצים לדף הזה ונסו שוב.');return}
    setTimeout(()=>w.postMessage({state:viewState()},'*'),700);
  }
  const navBox=document.getElementById('nav');

  // module jump menu: button in the nav bar (or key M) lists every module; a file with no hash opens on its first slide
  const MODULES=[
    {t:'דף הבית',f:'index.html'},
    {t:'פתיחה + מודול 1 · מצ׳אט לסוכן',f:'module1.html'},
    {t:'מודול 2 · Context Engineering',f:'module2.html'},
    {t:'מודול 3 · CLAUDE.md ומצבי הרשאה',f:'module3.html'},
    {t:'מודול 4 · Skills',f:'module4.html'},
    {t:'מודול 5 · שרשרת עם שער אנושי',f:'module5.html'},
    {t:'מודול 6 · חיבור לעולם (MCP)',f:'module6.html'},
    {t:'מודול 7 · סוכני-משנה',f:'module7.html'},
    {t:'מודול 8 · אוטומציות והוקים',f:'module8.html'},
    {t:'מודול 9 · התהליך האישי ושיתוף',f:'module9.html'}
  ];
  if(navBox){
    const menu=document.createElement('div'); menu.id='modmenu'; menu.hidden=true;
    const here=location.pathname.split('/').pop()||'index.html';
    MODULES.forEach(m=>{
      const a=document.createElement(m.soon?'span':'a');
      a.textContent=m.t+(m.soon?' (בקרוב)':'');
      if(m.soon)a.className='soon'; else a.href=m.f;
      if(m.f===here)a.className='cur';
      menu.appendChild(a);
    });
    document.body.appendChild(menu);
    const mb=document.createElement('button'); mb.textContent='מודולים'; mb.title='M';
    const toggleMenu=()=>{menu.hidden=!menu.hidden};
    mb.onclick=e=>{e.stopPropagation();toggleMenu()};
    navBox.insertBefore(mb,navBox.firstChild);
    const sb=document.createElement('button');sb.textContent='⏮';sb.title='להתחלה';sb.setAttribute('aria-label','להתחלה');
    sb.onclick=()=>{if(location.pathname.split('/').pop()==='module1.html')go(0);else location.href='module1.html#1'};
    navBox.insertBefore(sb,mb.nextSibling);
    addEventListener('click',()=>{menu.hidden=true});
    addEventListener('keydown',e=>{if(e.key==='m'||e.key==='M')toggleMenu();else if(e.key==='Escape')menu.hidden=true});
  }

  fit();
  // hash is the day-wide slide number (module2.html#30), or #last
  const h=location.hash.slice(1);
  go(h==='last'?slides.length-1:(parseInt(h)||START)-START);
})();


// ---- interactive Claude Code mascot: <div class="cc-mascot" data-say="msg 1|msg 2|..."> ----
(function(){
  const NS='http://www.w3.org/2000/svg';
  document.querySelectorAll('.cc-mascot').forEach(box=>{
    const msgs=(box.dataset.say||'שלום!').split('|');
    box.innerHTML=
      '<div class="cc-shadow"></div>'+
      '<svg viewBox="0 0 160 140" role="img" aria-label="Claude Code">'+
        '<g class="cc-all">'+
          '<rect class="cc-leg a" x="34" y="96" width="11" height="30"/><rect class="cc-leg b" x="58" y="96" width="11" height="30"/>'+
          '<rect class="cc-leg b" x="91" y="96" width="11" height="30"/><rect class="cc-leg a" x="115" y="96" width="11" height="30"/>'+
          '<rect class="cc-arm l cc-body" x="4" y="58" width="22" height="26"/><rect class="cc-arm r cc-body" x="134" y="58" width="22" height="26"/>'+
          '<rect class="cc-body" x="22" y="12" width="116" height="86"/>'+
          '<g class="cc-eyes"><rect class="cc-eye" x="45" y="38" width="10" height="24"/><rect class="cc-eye" x="105" y="38" width="10" height="24"/></g>'+
        '</g>'+
      '</svg>'+
      '<div class="cc-bubble"></div>';
    const eyes=box.querySelector('.cc-eyes'), bubble=box.querySelector('.cc-bubble');
    let i=0,t=null;
    // eyes follow the pointer, a few pixels either way
    addEventListener('pointermove',e=>{
      const r=box.getBoundingClientRect(), k=1;
      const dx=e.clientX-(r.left+r.width/2), dy=e.clientY-(r.top+r.height*0.4);
      const d=Math.hypot(dx,dy)||1, m=Math.min(1,d/300);
      eyes.style.transform='translate('+(dx/d*7*m)+'px,'+(dy/d*5*m)+'px)';
    });
    function say(txt){bubble.textContent=txt;bubble.classList.add('on');clearTimeout(t);t=setTimeout(()=>bubble.classList.remove('on'),2800)}
    // runs by itself, in a loop: jump, wave and say the next line (only while this slide is on screen)
    function beat(){
      const slide=box.closest('.slide');
      if(slide&&!slide.classList.contains('active'))return;
      box.classList.remove('jump'); void box.offsetWidth; box.classList.add('jump');
      box.classList.add('talk'); setTimeout(()=>box.classList.remove('talk'),1800);
      say(msgs[i++%msgs.length]);
    }
    setTimeout(()=>{beat();setInterval(beat,3800)},900);
    box.addEventListener('animationend',e=>{if(e.animationName==='cc-jump')box.classList.remove('jump')});
  });
})();

// ---- opening slides: hand-drawn background art (network clusters, hands, steps, icons) ----
(function(){
  const hand=(x,y,rot,cls)=>'<g transform="translate('+x+' '+y+') rotate('+rot+')"><g class="float '+(cls||'')+'">'+
    '<rect class="ink" x="-6" y="-92" width="30" height="96" rx="15"/><rect class="ink" x="30" y="-108" width="30" height="112" rx="15"/>'+
    '<rect class="ink" x="66" y="-98" width="30" height="102" rx="15"/><rect class="ink" x="100" y="-76" width="28" height="82" rx="14"/>'+
    '<path class="ink" d="M-6 -6 C-40 -30 -64 -10 -52 14 C-44 34 -12 40 -6 56 L128 56 L128 -6 Z"/></g></g>';
  const net=(pts,edges,flow)=>'<g>'+edges.map(e=>'<line class="ln'+(flow?' flow':'')+'" x1="'+pts[e[0]][0]+'" y1="'+pts[e[0]][1]+'" x2="'+pts[e[1]][0]+'" y2="'+pts[e[1]][1]+'"/>').join('')+
    pts.map(p=>'<circle class="nd" cx="'+p[0]+'" cy="'+p[1]+'" r="'+p[2]+'"/>').join('')+'</g>';
  const svg=(flip)=>'<svg viewBox="0 0 1600 900" preserveAspectRatio="xMidYMid slice" aria-hidden="true"><g'+(flip?' transform="translate(1600 0) scale(-1 1)"':'')+'>'+
    // top-left network
    net([[60,64,24],[250,128,20],[130,214,28],[430,56,18],[340,200,16]],[[0,1],[0,2],[1,2],[1,3],[1,4]],true)+
    // top-right network + reaching hand
    net([[1560,210,22],[1400,120,24],[1290,196,18],[1180,70,16]],[[0,1],[1,2],[1,3],[2,0]],true)+
    hand(1490,150,160,'')+
    // bottom-left: hand and a person made of nodes
    hand(30,775,-8,'b')+
    '<g transform="translate(190 0)"><g class="float b"><path class="ink nf" d="M170 840 C170 790 200 770 235 770 C270 770 300 790 300 840"/><circle class="ink" cx="235" cy="738" r="30"/>'+
    '<circle class="nd" cx="215" cy="806" r="7"/><circle class="nd" cx="255" cy="812" r="7"/><circle class="nd" cx="235" cy="780" r="6"/>'+
    '<line class="ln" x1="215" y1="806" x2="255" y2="812" style="stroke-width:3"/><line class="ln" x1="235" y1="780" x2="215" y2="806" style="stroke-width:3"/></g></g>'+
    // bottom-centre: steps
    '<g class="float"><rect class="ink" x="690" y="740" width="220" height="30"/><rect class="ink" x="660" y="770" width="280" height="30"/><rect class="ink" x="630" y="800" width="340" height="30"/><rect class="ink" x="600" y="830" width="400" height="40"/></g>'+
    // bottom-right: small icon boards
    '<g class="float b"><rect class="ink" x="1380" y="660" width="70" height="70" rx="4"/><circle class="ink nf" cx="1415" cy="695" r="16"/><circle cx="1415" cy="695" r="6" fill="#14182B"/>'+
    '<rect class="ink" x="1460" y="680" width="100" height="76" rx="4"/><ellipse class="ink nf" cx="1510" cy="718" rx="30" ry="16"/><circle class="blink" cx="1510" cy="718" r="9" fill="#14182B"/>'+
    '<rect class="ink" x="1388" y="744" width="46" height="46" rx="4"/><path class="ink nf" d="M1400 756 V778 H1422"/></g>'+
    '</g></svg>';
  document.querySelectorAll('.cover-art').forEach(el=>{el.innerHTML=svg(el.dataset.flip==='1')});
})();
