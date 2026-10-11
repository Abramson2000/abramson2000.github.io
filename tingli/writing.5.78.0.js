/* Move the real answer and its listeners; never copy or replace typed input. */
(function(root){
  'use strict';
  let active=null;
  const selector='#taskCard .fill, .hw-item .hw-ans';
  function viewport(){
    if(!active)return;
    const v=root.visualViewport;
    active.screen.style.top=(v ? v.offsetTop : 0)+'px';
    active.screen.style.height=(v ? v.height : root.innerHeight)+'px';
  }
  function saveAnswer(){
    if(!active || !active.input.matches('.hw-ans'))return true;
    if(typeof root.hwSave !== 'function')return false;
    const saved=root.hwSave(Number(active.input.dataset.i));
    active.screen.querySelector('.tl-writing-save-error').hidden=saved!==false;
    return saved!==false;
  }
  function restoreBlock(a){
    if(a.marker.isConnected){a.marker.parentNode.insertBefore(a.block,a.marker);a.marker.remove();}
  }
  /* Homework answers are buttons on the page; they become a real textarea only
     inside this writing panel. Autosave mirrors the old inline behaviour. */
  function hwToTextarea(btn){
    const ta=document.createElement('textarea');
    ta.className='hw-ans'; ta.dataset.i=btn.dataset.i; ta.rows=6;
    try { ta.value=(root.hwLoad && root.curUnit && root.curPart) ? (root.hwLoad(root.curUnit.unit, root.curPart.id, Number(btn.dataset.i)) || '') : ''; } catch(e) {}
    ta.placeholder='Твой ответ иероглифами…';
    ta.addEventListener('input', function(){ if(typeof root.hwSave==='function') root.hwSave(Number(ta.dataset.i)); });
    btn.replaceWith(ta);
    return ta;
  }
  function hwToButton(ta){
    const btn=document.createElement('button');
    btn.type='button'; btn.className='hw-ans-btn'; btn.dataset.i=ta.dataset.i;
    const v=(ta.value||'').trim();
    btn.textContent = v ? ('✏️ ' + (v.length>40 ? v.slice(0,40)+'…' : v)) : '✏️ Написать ответ';
    if(!v) btn.classList.add('empty');
    ta.replaceWith(btn);
    return btn;
  }
  function showStep(){
    if(!active || !active.items)return;
    const a=active,nav=a.screen.querySelector('.tl-writing-nav');
    nav.querySelector('.tl-writing-prev').disabled=a.index===0;
    nav.querySelector('.tl-writing-count').textContent=(a.index+1)+' / '+a.items.length;
    nav.querySelector('.tl-writing-next').textContent=a.index===a.items.length-1 ? 'К списку' : 'Дальше →';
  }
  function step(delta){
    if(!active || !active.items || !saveAnswer())return;
    const a=active,next=a.index+delta;
    if(next<0)return;
    if(next>=a.items.length){close();return;}
    const item=a.items[next];
    if(!a.marker.isConnected || !item.block.isConnected)return;
    a.input.blur();
    if(a.input.matches('.hw-ans')){ a.items[a.index].input=hwToButton(a.input); }
    restoreBlock(a);
    a.index=next;a.block=item.block;
    a.input=item.input.matches('.hw-ans-btn') ? hwToTextarea(item.input) : item.input;
    a.items[next].input=a.input;
    a.marker=document.createComment('writing answer location');
    a.block.parentNode.insertBefore(a.marker,a.block);
    a.screen.querySelector('.tl-writing-body').appendChild(a.block);
    a.screen.querySelector('.tl-writing-body').scrollTop=0;
    showStep();viewport();
    a.input.focus({preventScroll:true});
  }
  function close(){
    if(!active)return;
    if(active.marker.isConnected && !saveAnswer())return;
    const a=active;active=null;
    a.input.blur();
    if(a.input.matches('.hw-ans')){ hwToButton(a.input); }
    restoreBlock(a);
    a.screen.remove();document.body.classList.remove('tl-writing-open');
    a.hidden.forEach(([el,value])=>el.inert=value);
    root.scrollTo(0,a.scrollY);
  }
  function open(input){
    if(active || !input.matches(selector))return;
    const block=input.closest('#taskCard, .hw-item');
    if(!block)return;
    const items=block.classList.contains('hw-item') ? [...block.parentNode.querySelectorAll(':scope > .hw-item')].map(function(b){return {block:b,input:b.querySelector('.hw-ans-btn, .hw-ans')};}).filter(function(item){return item.input;}) : null;
    const screen=document.createElement('section');
    screen.className='tl-writing';screen.setAttribute('role','dialog');screen.setAttribute('aria-modal','true');screen.setAttribute('aria-label','Письменный ответ');
    screen.innerHTML='<header class="tl-writing-head"><button class="tl-writing-back back" type="button" aria-label="Вернуться к уроку">←</button><div class="tl-writing-brand"><img src="logo.png?v=5.35.0" alt=""><div class="tl-writing-titles"><div class="top-title"></div><div class="sub"></div></div></div></header><div class="tl-writing-label"></div><div class="tl-writing-body"></div>';
    const heading=typeof root.TingliWritingHeading==='function' ? root.TingliWritingHeading() : {title:'作业',subtitle:'Домашнее задание',label:''};
    screen.querySelector('.top-title').textContent=heading.title;
    screen.querySelector('.sub').textContent=heading.subtitle;
    screen.querySelector('.tl-writing-label').textContent=heading.label;
    screen.querySelector('.tl-writing-label').hidden=!heading.label;
    if(items){
      const nav=document.createElement('footer');nav.className='tl-writing-nav';
      nav.innerHTML='<div class="tl-writing-save-error" role="alert" hidden>Не удалось сохранить ответ. Оставь экран открытым и попробуй ещё раз.</div><div class="tl-writing-nav-row"><button class="tl-writing-prev" type="button" aria-label="Предыдущий пункт ДЗ">←</button><span class="tl-writing-count" aria-live="polite"></span><button class="tl-writing-next" type="button">Дальше →</button></div>';
      screen.appendChild(nav);
      nav.querySelector('.tl-writing-prev').addEventListener('click',()=>step(-1));
      nav.querySelector('.tl-writing-next').addEventListener('click',()=>step(1));
    }
    const body=screen.querySelector('.tl-writing-body'),marker=document.createComment('writing answer location');
    const hidden=[...document.body.children].filter(el=>!['SCRIPT','STYLE','LINK'].includes(el.tagName)).map(el=>[el,el.inert]);
    const selection=[input.selectionStart,input.selectionEnd],scrollY=root.scrollY;
    // A long homework source stays accessible, without duplicating answer examples.
    const context=block.classList.contains('hw-item') && (block.parentNode.querySelector(':scope > .script.show') || block.parentNode.querySelector(':scope > .hw-src .script'));
    if(context){
      const details=document.createElement('details'),summary=document.createElement('summary');
      details.className='tl-writing-context';summary.textContent='Текст задания';details.appendChild(summary);
      const copy=context.cloneNode(true);copy.removeAttribute('id');copy.querySelectorAll('[id]').forEach(el=>el.removeAttribute('id'));details.appendChild(copy);body.appendChild(details);
    }
    block.parentNode.insertBefore(marker,block);body.appendChild(block);document.body.appendChild(screen);
    // Tingli navigates in-place. This panel must not add browser history entries.
    active={screen,block,input,marker,hidden,selection,scrollY,items,index:items ? items.findIndex(function(item){return item.block===block;}) : 0};
    hidden.forEach(([el])=>el.inert=true);document.body.classList.add('tl-writing-open');
    screen.querySelector('.tl-writing-back').addEventListener('click',()=>close());
    // The keyboard's translucent accessory bar belongs to iOS, not this page.
    // Finish editing before checking so it closes together with the keyboard.
    screen.addEventListener('click',e=>{
      const button=e.target.closest && e.target.closest('button');
      if(!active || !button || !active.block.contains(button) || !button.matches('.hw-chk, #taskCard button[onclick="checkTask()"]'))return;
      if(!saveAnswer()){e.preventDefault();e.stopImmediatePropagation();return;}
      active.input.blur();
    },true);
    showStep();viewport();
    // Focus synchronously within the user gesture so iOS keeps its keyboard.
    input.focus({preventScroll:true});
    if(selection[0]!==null)try{input.setSelectionRange(selection[0],selection[1]);}catch(_){}
  }
  document.addEventListener('focusin',e=>{if(e.target.matches && e.target.matches(selector))open(e.target);});
  document.addEventListener('click',function(e){
    const btn=e.target && e.target.closest ? e.target.closest('.hw-ans-btn') : null;
    if(!btn || active)return;
    open(hwToTextarea(btn));
  });
  document.addEventListener('keydown',e=>{
    if(!active)return;
    if(e.key==='Escape'){e.preventDefault();close();return;}
    if(e.key==='Tab'){
      const all=[...active.screen.querySelectorAll('button:not([disabled]),input,textarea,summary,a[href]')].filter(el=>!el.closest('[hidden]'));
      const i=all.indexOf(document.activeElement);
      if(e.shiftKey && i<=0){e.preventDefault();all.at(-1).focus();}
      else if(!e.shiftKey && i===all.length-1){e.preventDefault();all[0].focus();}
    }
  });
  root.addEventListener('resize',viewport);
  if(root.visualViewport){root.visualViewport.addEventListener('resize',viewport);root.visualViewport.addEventListener('scroll',viewport);}
  new MutationObserver(()=>{if(active && !active.marker.isConnected)close();}).observe(document.body,{childList:true,subtree:true});
  root.TingliWritingFocus={isOpen:()=>!!active,close:()=>close()};
})(window);
