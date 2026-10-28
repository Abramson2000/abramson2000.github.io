'use strict';
const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
(async()=>{
 const browser=await chromium.launch({headless:true});
 let failures=[];
 fs.mkdirSync('spin/tests/screenshots',{recursive:true});
 async function runScenario(width,height){
  const context=await browser.newContext({viewport:{width,height},serviceWorkers:'block'});
  const page=await context.newPage();
  const runtimeErrors=[];
  page.on('pageerror',e=>runtimeErrors.push(e.message));
  await page.goto('http://127.0.0.1:8765/spin/index.4.0.0.html?review=1',{waitUntil:'domcontentloaded'});
  await page.locator('#program.view.active').waitFor({timeout:15000});
  const mobile=width<=760;
  const nav=page.locator(mobile ? '.mobile-nav' : '.nav-list');
  const labels=['Программа','Теория','Дополнения','Практика','Шпаргалки','Прогресс'];
  for(const [i,name] of labels.entries()){
   const btn=nav.locator('button').nth(i);
   assert.equal(await btn.getAttribute('data-tab'),['program','theory','extras','practice','cheat','progress'][i]);
   assert.ok(await btn.isVisible(), 'hidden nav button: '+name+' at '+width);
  }
  const backgrounds=['01_program_everest','02_theory_kailash','03_extras_yamdrok','04_practice_namtso','05_cheatsheets_shangrila','06_progress_drepung_stupa','07_login_pagoda'];
  for(const name of backgrounds){
    const url='/spin/np40/'+(mobile?'mobile/'+name+'_960':' '+name).trim()+'.webp';
    const response=await page.request.get('http://127.0.0.1:8765'+url);
    assert.equal(response.status(),200,'missing '+url);
  }
  const sections=['program','theory','extras','practice','cheat','progress'];
  for(const id of sections){
   await nav.locator('button[data-tab="'+id+'"]').click();
   await page.locator('#'+id+'.view.active').waitFor({timeout:10000});
   const bg=await page.locator('#'+id).evaluate(el=>getComputedStyle(el,'::before').backgroundImage);
   assert.match(bg,/np40/,'missing landscape for '+id);
   if(id==='theory'){
     const lessons=page.locator('#theoryBody .lesson-item');
     assert.ok(await lessons.count()>0,'Theory lesson list empty');
     const selector=page.locator('#theoryBody #npCourseSelect');
     assert.ok(await selector.count()===1,'Course selector missing');
     if(width===390){
       const toggle=page.locator('#theoryBody .np-rail-toggle');
       await toggle.click();
       assert.equal(await toggle.getAttribute('aria-expanded'),'true');
     }
   }
   if(id==='extras'){
     const cards=page.locator('#extrasBody [data-np-extra]');
     assert.ok(await cards.count()>0,'Extra catalog empty');
     await cards.first().click();
     assert.ok(await page.locator('#extrasBody .lesson-content h1').count()===1,'Extra lesson not opened');
     const back=page.locator('#extrasBody [data-np-extra-back]');
     await back.click();
     assert.ok(await page.locator('#extrasBody [data-np-extra]').count()>0,'Extra index did not reopen');
   }
   const overflow=await page.evaluate(()=>Math.max(document.body.scrollWidth,document.documentElement.scrollWidth)-window.innerWidth);
   if (overflow>1) {
     const offenders=await page.evaluate(()=>[...document.querySelectorAll('body *')].filter(el=>{
       const cs=getComputedStyle(el);
       if(cs.display==='none'||cs.visibility==='hidden')return false;
       const r=el.getBoundingClientRect();
       return r.right>window.innerWidth+1&&r.width>0;
     }).map(el=>({tag:el.tagName,cls:el.className?.toString().slice(0,90),text:el.textContent?.trim().slice(0,48),right:Math.round(el.getBoundingClientRect().right),width:Math.round(el.getBoundingClientRect().width)})).sort((a,b)=>b.right-a.right).slice(0,15));
     console.error('OVERFLOW DIAGNOSTIC',width,id,JSON.stringify(offenders));
     await page.screenshot({path:'spin/tests/screenshots/overflow-'+width+'-'+id+'.png',fullPage:true});
   }
   if(overflow>1) failures.push('Horizontal overflow '+overflow+'px on '+id+' at '+width);
  }
  await nav.locator('button[data-tab="program"]').click();
  await page.screenshot({path:'spin/tests/screenshots/np40-'+width+'.png',fullPage:true});
  assert.deepEqual(runtimeErrors,[],'Browser exceptions at '+width);
  await context.close();
  console.log('PASS '+width+'x'+height+': nav, 6 views, lesson, extras, images, no horizontal overflow');
 }
 try {
  for (const width of [320,390,1440]) await runScenario(width,900);
  const context=await browser.newContext({serviceWorkers:'block'});
  const page=await context.newPage();
  await page.goto('http://127.0.0.1:8765/spin/index.4.0.0.html',{waitUntil:'domcontentloaded'});
  await page.locator('#loginScreen:not(.hidden)').waitFor({timeout:12000});
  assert.equal(await page.locator('#loginPass').count(),1,'Password field missing');
  await context.close();
  console.log('PASS login screen visible without review param');
  if (failures.length) throw new Error('Responsive layout failures:\\n'+failures.join('\\n'));
 }catch(error){
  console.error('FAIL',error.stack||error.message);
  process.exitCode=1;
 }finally{await browser.close();}
})();
