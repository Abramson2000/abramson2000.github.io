/* Move the real answer and its listeners; never copy or replace typed input. */
(function(root){
  'use strict';
  let active=null,serial=0;
  const selector='#taskCard .fill, .hw-item .hw-ans';
  function viewport(){
    if(!active)return;
    const v=root.visualViewport;
    active.screen.style.top=(v ? v.offsetTop : 0)+'px';
    active.screen.style.height=(v ? v.height : root.innerHeight)+'px';
  }
  function close(fromHistory){
    if(!active)return;
    const a=active;active=null;
    a.input.blur();
    if(a.marker.isConnected){a.marker.parentNode.insertBefore(a.block,a.marker);a.marker.remove();}
    a.screen.remove();document.body.classList.remove('tl-writing-open');
    a.hidden.forEach(([el,value])=>el.inert=value);
    root.scrollTo(0,a.scrollY);
    if(!fromHistory && a.history && root.history.state && root.history.state.tingliWriting===a.history)root.history.back();
  }
  function open(input){
    if(active || !input.matches(selector))return;
    const block=input.closest('#taskCard, .hw-item');
    if(!block)return;
    const screen=document.createElement('section');
    screen.className='tl-writing';screen.setAttribute('role','dialog');screen.setAttribute('aria-modal','true');screen.setAttribute('aria-label','Письменный ответ');
    screen.innerHTML='<header class="tl-writing-head"><button class="tl-writing-back" type="button" aria-label="Вернуться к уроку">←</button><div class="tl-writing-brand"><img src="logo.png?v=5.35.0" alt=""><div class="top-title">小山听力</div></div></header><div class="tl-writing-body"></div>';
    const body=screen.querySelector('.tl-writing-body'),marker=document.createComment('writing answer location');
    const hidden=[...document.body.children].filter(el=>!['SCRIPT','STYLE','LINK'].includes(el.tagName)).map(el=>[el,el.inert]);
    const selection=[input.selectionStart,input.selectionEnd],scrollY=root.scrollY;
    // A long homework source stays accessible, without duplicating answer examples.
    const context=block.classList.contains('hw-item') && block.parentNode.querySelector(':scope > .script.show');
    if(context){
      const details=document.createElement('details'),summary=document.createElement('summary');
      details.className='tl-writing-context';summary.textContent='Текст задания';details.appendChild(summary);
      const copy=context.cloneNode(true);copy.removeAttribute('id');copy.querySelectorAll('[id]').forEach(el=>el.removeAttribute('id'));details.appendChild(copy);body.appendChild(details);
    }
    block.parentNode.insertBefore(marker,block);body.appendChild(block);document.body.appendChild(screen);
    let history=null;
    try{history='writing-'+(++serial);root.history.pushState(Object.assign({},root.history.state,{tingliWriting:history}),'');}catch(_){history=null;}
    active={screen,block,input,marker,hidden,selection,scrollY,history};
    hidden.forEach(([el])=>el.inert=true);document.body.classList.add('tl-writing-open');
    screen.querySelector('.tl-writing-back').addEventListener('click',()=>close(false));
    viewport();
    // Focus synchronously within the user gesture so iOS keeps its keyboard.
    input.focus({preventScroll:true});
    if(selection[0]!==null)try{input.setSelectionRange(selection[0],selection[1]);}catch(_){}
  }
  document.addEventListener('focusin',e=>{if(e.target.matches && e.target.matches(selector))open(e.target);});
  document.addEventListener('keydown',e=>{
    if(!active)return;
    if(e.key==='Escape'){e.preventDefault();close(false);return;}
    if(e.key==='Tab'){
      const all=[...active.screen.querySelectorAll('button:not([disabled]),input,textarea,summary,a[href]')].filter(el=>!el.closest('[hidden]'));
      const i=all.indexOf(document.activeElement);
      if(e.shiftKey && i<=0){e.preventDefault();all.at(-1).focus();}
      else if(!e.shiftKey && i===all.length-1){e.preventDefault();all[0].focus();}
    }
  });
  root.addEventListener('popstate',()=>{if(active && (!root.history.state || root.history.state.tingliWriting!==active.history))close(true);});
  root.addEventListener('resize',viewport);
  if(root.visualViewport){root.visualViewport.addEventListener('resize',viewport);root.visualViewport.addEventListener('scroll',viewport);}
  new MutationObserver(()=>{if(active && !active.marker.isConnected)close(false);}).observe(document.body,{childList:true,subtree:true});
  root.TingliWritingFocus={isOpen:()=>!!active,close:()=>close(false)};
})(window);
