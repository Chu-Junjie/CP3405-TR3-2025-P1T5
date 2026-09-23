const { chromium } = require('playwright');
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const root = process.cwd();
const server = http.createServer((req, res) => {
  const file = path.join(root, decodeURIComponent(req.url.split('?')[0] === '/' ? '/index.html' : req.url.split('?')[0]));
  if (!file.startsWith(root + path.sep)) { res.writeHead(403).end(); return; }
  fs.readFile(file, (error, data) => {
    if (error) return res.writeHead(404).end();
    res.setHeader('Content-Type', ({'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.png':'image/png','.jpg':'image/jpeg'})[path.extname(file)] || 'application/octet-stream');
    res.end(data);
  });
});
(async () => {
 await new Promise(resolve => server.listen(0,'127.0.0.1',resolve));
 const base = `http://127.0.0.1:${server.address().port}/`;
 const browser = await chromium.launch({headless:true, executablePath: process.env.BROWSER_PATH || undefined});
 const context = await browser.newContext();
 let submittedSeat = null;
 const reservation = {id:1,seat_code:'A01',seat_type:'standard',status:'active',created_at:'2026-09-23T09:00:00Z'};
 await context.route('**/api/**', route => {
  const url=route.request().url();
  if (route.request().method() === 'POST' && url.endsWith('/api/reservations')) submittedSeat = route.request().postDataJSON().seat_code;
  let data=[];
  if (url.endsWith('/api/auth/me')) data={name:'Test Student',email:'test@example.com'};
  else if (url.endsWith('/api/seats')) data=Array.from({length:48},(_,i)=>({seat_code: `${'ABCDEF'[Math.floor(i/8)]}${String(i%8+1).padStart(2,'0')}`,seat_type:i%7===0?'accessible':'standard',status:i===2?'booked':'available'}));
  else if (url.includes('/api/reservations')) data=route.request().method()==='POST'?reservation:[reservation];
  route.fulfill({status:200,contentType:'application/json',headers:{'Access-Control-Allow-Origin':'*'},body:JSON.stringify(data)});
 });
 await context.addInitScript(() => {localStorage.setItem('demo_token','test');localStorage.setItem('selectedRoomInfo',JSON.stringify({room:'C2-04',campus:'singapore'}));localStorage.setItem('last_reservation',JSON.stringify({id:1,seat_code:'A01',seat_type:'standard',status:'active',created_at:'2026-09-23T09:00:00Z'}));});
 const page=await context.newPage();
 const errors=[]; page.on('pageerror',e=>errors.push(e.message));
 const files=fs.readdirSync(root).filter(f=>/^[ABC]\d.*\.html$/.test(f));
 const issues=[];
 try {
  for (const width of [320,390,768,1440]) {
   await page.setViewportSize({width,height:844});
   for (const file of files) {
    await page.goto(base+file,{waitUntil:'networkidle'});
    await page.waitForTimeout(80);
    assert.equal(await page.getAttribute('html','lang'),'en',file);
    assert.equal(await page.locator('.language-toolbar').count(),1,file);
    const overflow=await page.evaluate(()=>({scroll:document.documentElement.scrollWidth,width:innerWidth,offenders:[...document.querySelectorAll('body *')].filter(e=>{const r=e.getBoundingClientRect();return r.right>innerWidth+1&&r.width>0&&!e.closest('.seat-map-viewport,.sidebar,.overflow-x-auto');}).slice(0,8).map(e=>e.className)}));
    if(overflow.scroll>width+1) issues.push({file,width,...overflow});
    if(process.env.SCREENSHOT_DIR && width===390&&['A01_signin_credentials.html','B02_home.html','B03_seat_selection.html','C01_lecturer_home.html'].includes(file)) await page.screenshot({path:path.join(process.env.SCREENSHOT_DIR,file+'.png'),fullPage:true});
   }
  }
  console.log('LAYOUT',JSON.stringify(issues));
  console.log('PAGE ERRORS',JSON.stringify([...new Set(errors)]));
  await page.goto(base+'A01_signin_credentials.html');
  await page.locator('#username').fill('student@example.com');
  await page.locator('[data-language="en"]').click();
  assert.equal(await page.locator('#username').inputValue(),'student@example.com');
  assert.equal(await page.title(),'Smart Seat Login');
  await page.reload(); assert.equal(await page.getAttribute('html','lang'),'en');
  await page.locator('[data-language="zh-CN"]').click();
  await page.reload();
  assert.equal(await page.getAttribute('html','lang'),'zh-CN', 'Saved Chinese preference survives reload');
  await page.goto(base+'B06_room_selection.html');
  await page.locator('[data-block="C"]').click();
  await page.locator('[data-room="4"]').click();
  assert.equal(await page.locator('#selected-room').innerText(),'C1-04');
  await page.locator('[data-language="en"]').click();
  assert.equal(await page.locator('#selected-room').innerText(),'C1-04');
  await page.locator('[data-language="zh-CN"]').click();
  await page.goto(base+'B03_seat_selection.html');
  await page.locator('.seat[data-code="A02"]').click();
  assert.equal(await page.locator('#seat-type').innerText(),'普通座位');
  assert.equal(await page.locator('#available-seat-count').innerText(),'47 个座位可用');
  await page.locator('[data-language="en"]').click();
  assert.equal(await page.locator('#seat-type').innerText(),'standard');
  assert.equal(await page.locator('.seat.selected').getAttribute('data-code'),'A02');
  await page.locator('[data-language="zh-CN"]').click();
  await page.setViewportSize({width:390,height:844});
  await page.goto(base+'C01_lecturer_home.html');
  await page.locator('#openSidebar').click();
  assert.equal(await page.locator('#openSidebar').getAttribute('aria-expanded'),'true');
  await page.locator('#closeSidebar').click();
  assert.equal(await page.locator('#openSidebar').getAttribute('aria-expanded'),'false');

  await page.goto(base+'B04_check_reservations.html');
  await page.locator('#search-input').fill('普通座位');
  await page.waitForTimeout(400);
  assert.equal(await page.locator('.reservation-card').count(),1);
  await page.goto(base+'B03_seat_selection.html');
  const viewport=page.locator('.seat-map-viewport');
  assert.ok(await viewport.evaluate(el=>el.scrollWidth>el.clientWidth));
  await viewport.evaluate(el=>el.scrollLeft=el.scrollWidth);
  assert.ok(await viewport.evaluate(el=>el.scrollLeft>0));
  await page.locator('.seat[data-code="F08"]').click();
  await page.locator('#confirm-seat').click();
  await page.waitForURL('**/B05_success.html');
  assert.equal(submittedSeat, 'F08', 'Localized UI must submit unchanged seat codes');
  assert.equal(await page.locator('#res-seat').innerText(),'A01');
  await page.locator('[data-language="en"]').click();
  for (const file of files) {
    await page.goto(base+file,{waitUntil:'networkidle'});
    assert.equal(await page.getAttribute('html','lang'),'en');
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),file+' English overflow');
  }
  await page.goto(base+'C03_usage_statistics.html',{waitUntil:'networkidle'});
  await page.locator('[data-language="zh-CN"]').click();
  assert.ok(await page.evaluate(()=>Object.values(Chart.instances).some(chart=>chart.data.labels.includes('第 1 周'))));
  assert.ok(await page.evaluate(()=>Object.values(Chart.instances).some(chart=>chart.options.scales.y.title.text==='使用率（%）')));
  await page.locator('[data-language="en"]').click();
  assert.ok(await page.evaluate(()=>Object.values(Chart.instances).some(chart=>chart.data.labels.includes('Week 1'))));
  await page.goto(base+'B05_success.html');
  await page.locator('[data-language="zh-CN"]').click();
  const dialogMessage=new Promise(resolve=>page.once('dialog',async dialog=>{resolve(dialog.message());await dialog.dismiss();}));
  await page.locator('#cancel-btn').click();
  assert.equal(await dialogMessage,'确定取消此预约吗？');
  const blocked = await browser.newContext();
  await blocked.addInitScript(()=>{Storage.prototype.getItem=()=>{throw new Error('Storage disabled');};Storage.prototype.setItem=()=>{throw new Error('Storage disabled');};});
  const blockedPage=await blocked.newPage();
  await blockedPage.goto(base+'A01_signin_credentials.html');
  assert.equal(await blockedPage.getAttribute('html','lang'),'en');
  await blockedPage.locator('[data-language="zh-CN"]').click();
  assert.equal(await blockedPage.getAttribute('html','lang'),'zh-CN');
  await blockedPage.locator('[data-language="en"]').click();
  assert.equal(await blockedPage.getAttribute('html','lang'),'en');
  await blocked.close();
  console.log('Interaction checks passed');
  assert.deepEqual(errors, [], 'Uncaught page errors');
  assert.equal(issues.length,0,'Viewport overflow');
 } finally {await browser.close();server.close();}
})().catch(error=>{console.error(error);server.close();process.exitCode=1;});
