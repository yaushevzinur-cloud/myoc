
const $=s=>document.querySelector(s), app=$("#app");
const defaults={
  mode:"Вахта",
  books:[
    {id:1,name:"Казахский",icon:"🇰🇿",daily:5,page:1,total:250,history:{}},
    {id:2,name:"Граф Монте-Кристо",icon:"📕",daily:10,page:436,total:1100,history:{}},
    {id:3,name:"Профессиональная книга",icon:"🛢️",daily:10,page:72,total:360,history:{}},
    {id:4,name:"Фитнес / анатомия",icon:"🏋️",daily:10,page:38,total:300,history:{}}
  ]
};
let state=JSON.parse(localStorage.getItem("myos03")||"null")||defaults;
if(!state.tasks) state.tasks=[
 {id:101,title:"Главная рабочая задача",status:"todo",priority:"Высокий",mins:60,area:"Работа"},
 {id:102,title:"Казахский — 5 страниц",status:"todo",priority:"Обычный",mins:20,area:"Обучение"}
];
if(!state.books) state.books=defaults.books;

const MYOS_LOCAL_KEY="myos03";
const MYOS_USER_KEY="zinur";
const MYOS_CFG=window.MYOS_CONFIG||{};
let cloudTimer=null, cloudReady=false, cloudBusy=false;

function restBase(){
  let u=(MYOS_CFG.SUPABASE_URL||"").trim().replace(/\/+$/,"");
  if(!u || u.includes("PASTE_")) return "";
  if(u.endsWith("/rest/v1")) return u;
  if(u.endsWith("/rest/v1/")) return u.slice(0,-1);
  return u+"/rest/v1";
}
function cloudConfigured(){
  const k=(MYOS_CFG.SUPABASE_KEY||"").trim();
  return !!restBase() && !!k && !k.includes("PASTE_");
}
function cloudHeaders(extra={}){
  const k=(MYOS_CFG.SUPABASE_KEY||"").trim();
  return Object.assign({
    "apikey":k,
    "Authorization":"Bearer "+k,
    "Content-Type":"application/json"
  },extra);
}
function setSyncStatus(text,ok=true){
  window.MYOS_SYNC_STATUS=text;
  const el=document.getElementById("cloudSync");
  if(el){el.textContent=text;el.classList.toggle("syncBad",!ok)}
}
function save(){
  state._updatedAt=Date.now();
  localStorage.setItem(MYOS_LOCAL_KEY,JSON.stringify(state));
  scheduleCloudSave();
}
function scheduleCloudSave(){
  if(!cloudReady || !cloudConfigured()) return;
  clearTimeout(cloudTimer);
  setSyncStatus("☁ Сохранение…");
  cloudTimer=setTimeout(pushCloud,450);
}
async function pushCloud(){
  if(cloudBusy || !cloudConfigured()) return;
  cloudBusy=true;
  try{
    const url=restBase()+"/myos_data?on_conflict=user_key";
    const r=await fetch(url,{
      method:"POST",
      headers:cloudHeaders({"Prefer":"resolution=merge-duplicates,return=minimal"}),
      body:JSON.stringify({user_key:MYOS_USER_KEY,data:state,updated_at:new Date().toISOString()})
    });
    if(!r.ok) throw new Error("HTTP "+r.status+" "+await r.text());
    setSyncStatus("☁ Сохранено");
  }catch(e){
    console.error("MyOS cloud save:",e);
    setSyncStatus("☁ Ошибка синхр.",false);
  }finally{cloudBusy=false}
}
async function initCloud(){
  if(!cloudConfigured()){
    cloudReady=false;
    setSyncStatus("☁ Локально",false);
    return;
  }
  setSyncStatus("☁ Подключение…");
  try{
    const url=restBase()+"/myos_data?user_key=eq."+encodeURIComponent(MYOS_USER_KEY)+"&select=data&limit=1";
    const r=await fetch(url,{headers:cloudHeaders()});
    if(!r.ok) throw new Error("HTTP "+r.status+" "+await r.text());
    const rows=await r.json();
    const localTs=Number(state&&state._updatedAt||0);
    const cloudState=rows&&rows[0]&&rows[0].data;
    const cloudTs=Number(cloudState&&cloudState._updatedAt||0);
    if(cloudState && cloudTs>=localTs){
      state=cloudState;
      localStorage.setItem(MYOS_LOCAL_KEY,JSON.stringify(state));
    }else if(!cloudState || localTs>cloudTs){
      cloudReady=true;
      await pushCloud();
    }
    cloudReady=true;
    setSyncStatus("☁ Синхр.");
    render(current||"today");
  }catch(e){
    console.error("MyOS cloud load:",e);
    cloudReady=false;
    setSyncStatus("☁ Локально",false);
  }
}

function keyToday(){return new Date().toISOString().slice(0,10)}
function readToday(b){return (b.history&&b.history[keyToday()])||0}
function addRead(b,n){b.history=b.history||{};b.history[keyToday()]=Math.max(0,readToday(b)+n);b.page=Math.min(b.total,Math.max(1,b.page+n));save()}
function shell(body){app.className="app";app.innerHTML=body}
function header(title,sub=""){return `<div class="top"><div><span class="eyebrow">MYOS · V0.8.2</span><h1>${title}</h1><div class="muted">${sub}</div><span id="cloudSync" class="cloudSync">${window.MYOS_SYNC_STATUS||"☁ Проверка…"}</span></div><button class="mode" id="mode">${state.mode==="Вахта"?"⛺":"🏠"} ${state.mode}</button></div>`}
function bindMode(){const b=$("#mode");if(b)b.onclick=()=>{state.mode=state.mode==="Вахта"?"Дом":"Вахта";save();render(current)}}
if(!state.plannerVersion){
 state.tasks=(state.tasks||[]).map(t=>Object.assign({horizon:"today",created:new Date().toISOString(),completed:null,waitingFor:""},t));
 state.plannerVersion=4; save();
}
const AREAS={work:["💼","Работа","areaWork"],health:["🏋️","Здоровье","areaHealth"],develop:["🧠","Развитие","areaDevelop"],lang:["🌐","Языки","areaLang"],finance:["💰","Финансы","areaFinance"],relations:["❤️","Отношения","areaRelations"],rest:["🌴","Отдых","areaRest"],home:["🏠","Личное / быт","areaHome"]};
state.tasks=(state.tasks||[]).map(t=>Object.assign({lifeArea:t.lifeArea||"work"},t));save();
let selectedArea="work", progressPeriod="month";
const nowCal=new Date();
let calYear=nowCal.getFullYear(), calMonth=nowCal.getMonth(), calDate=isoLocal(nowCal);
function isoLocal(d){return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`}
function monthName(m){return ["Январь","Февраль","Март","Апрель","Май","Июнь","Июль","Август","Сентябрь","Октябрь","Ноябрь","Декабрь"][m]}
function weekRange(dateStr){
 let d=dateStr?new Date(dateStr+"T12:00:00"):new Date(), day=(d.getDay()+6)%7;
 let a=new Date(d);a.setDate(d.getDate()-day);let b=new Date(a);b.setDate(a.getDate()+6);
 const fmt=x=>`${x.getDate()} ${monthName(x.getMonth()).toLowerCase()}`;
 return {start:isoLocal(a),end:isoLocal(b),label:`${fmt(a)} — ${fmt(b)}`};
}
state.tasks=(state.tasks||[]).map(t=>{
 if(!t.planYear)t.planYear=calYear;
 if(t.horizon==="month"&&!t.planMonth)t.planMonth=calMonth+1;
 if(t.horizon==="week"&&!t.planWeek) t.planWeek=weekRange(calDate).start;
 if(t.horizon==="today"&&!t.planDate)t.planDate=calDate;
 return t;
});save();
let horizonView="today", mobileStatusView="todo";
let current="today";
function task(i,n,s){return `<button class="task"><b>${i}</b><span><strong>${n}</strong><small>${s}</small></span><i>○</i></button>`}
function time(t,n,s){return `<div class="timeRow"><time>${t}</time><span class="dot"></span><p><b>${n}</b><small>${s}</small></p></div>`}
function mini(k,v,s){return `<article class="mini card"><span class="kicker">${k}</span><strong>${v}</strong><small>${s}</small></article>`}
function readingSummary(){
 const done=state.books.reduce((a,b)=>a+readToday(b),0), target=state.books.reduce((a,b)=>a+b.daily,0);
 return {done,target,left:Math.max(0,target-done)};
}
function today(){
 const date=new Date().toLocaleDateString("ru-RU",{weekday:"long",day:"numeric",month:"long"}), rs=readingSummary();
 shell(header("Добрый день, Зинур",date)+`
 <section class="score card"><div><span class="kicker">БАЛАНС ДНЯ</span><strong>76%</strong><small class="muted">Хороший темп. Береги вечер.</small></div><div class="ring">76</div></section>
 <div class="sectionTitle"><h2>Фокус дня</h2><span>3 главных</span></div><div class="focus">
 ${task("💼","Рабочая задача","Глубокая работа · 60–90 мин")}
 ${task("🇰🇿","Казахский",`${readToday(state.books[0])}/${state.books[0].daily} страниц`)}
 ${task("🏋️","Тренировка",state.mode==="Вахта"?"Штанга · гантели · турник · резинка":"Зал · программа на массу")}
 </div><button class="ai" id="ai">✨ Что мне лучше сделать сейчас?</button><div class="aiBox" id="aiBox"></div>
 <div class="sectionTitle"><h2>Чтение сегодня</h2><span>${rs.done}/${rs.target} стр.</span></div>
 <section class="readingHero card"><span class="kicker">ОСТАЛОСЬ НА СЕГОДНЯ</span><strong>${rs.left} стр.</strong><small>${rs.left? "Можно закрывать по книгам в удобном порядке":"Дневная норма выполнена ✅"}</small></section>
 <div class="sectionTitle"><h2>Мой день</h2><span>Кластеры</span></div><section class="timeline card">
 ${time("09:00","💼 Глубокая работа","Высокая концентрация")}${time("11:00","🇰🇿 Казахский","5 страниц")}${time("13:00","🍽 Обед + восстановление","Перерыв")}${time("18:30","🏋️ Тренировка",state.mode==="Вахта"?"Вахта · 45 мин":"Зал · 60–75 мин")}${time("21:00","📖 Чтение","по дневным нормам")}${time("22:30","🌙 Закрыть день","Дневник · 5 минут")}</section>
 <div class="sectionTitle"><h2>Сегодня в цифрах</h2></div><section class="grid">
 ${mini("🍽 ПИТАНИЕ","1 640 / 2 350","ккал · осталось 710")}${mini("🔥 СЕРИЯ","6 дней","привычки")}${mini("📚 ЧТЕНИЕ",rs.done+" стр.","из "+rs.target)}${mini("💪 ТЕЛО","3 / 4","тренировки недели")}</section>`);
 bindMode();document.querySelectorAll(".task").forEach(x=>x.onclick=()=>x.classList.toggle("done"));
 $("#ai").onclick=()=>{let x=$("#aiBox");x.style.display="block";let k=state.books.find(b=>readToday(b)<b.daily);x.innerHTML=k?`Сейчас лучше закрыть <b>${k.name}</b>: осталось <b>${k.daily-readToday(k)} стр.</b> по дневной норме.`:`Чтение на сегодня закрыто. Можно переключиться на тренировку или отдых.`}
}
function plan(){
 const tabs=[["inbox","📥 Входящие"],["year","Год"],["month","Месяц"],["week","Неделя"],["today","Сегодня"],["archive","✅ Выполнено"]];
 shell(header("План","Входящие → Год → Месяц → Неделя → Сегодня")+`<div class="horizonTabs">${tabs.map(x=>`<button data-horizon="${x[0]}" class="${horizonView===x[0]?"active":""}">${x[1]}</button>`).join("")}</div>${plannerBody()}`);
 bindMode();document.querySelectorAll("[data-horizon]").forEach(b=>b.onclick=()=>{horizonView=b.dataset.horizon;plan()});bindPlanner();
}
function plannerBody(){
 if(horizonView==="today")return todayBoard();
 if(horizonView==="archive")return archiveView();
 const names={inbox:"Входящие",year:"План на год",month:"План на месяц",week:"План на неделю"};
 const list=state.tasks.filter(t=>{
  if(t.horizon!==horizonView||t.status==="done") return false;
  if(horizonView==="year") return Number(t.planYear||calYear)===calYear;
  if(horizonView==="month") return Number(t.planYear||calYear)===calYear && Number(t.planMonth||calMonth+1)===calMonth+1;
  if(horizonView==="week") return (t.planWeek||weekRange(calDate).start)===weekRange(calDate).start;
  return true;
 });
 return `<section class="planSummary card"><div><small>${names[horizonView]}</small><b>${list.length}</b></div><div><small>Активных всего</small><b>${state.tasks.filter(t=>t.status!=="done").length}</b></div></section>
 <div class="sectionTitle"><h2>${names[horizonView]}</h2><span>единые карточки</span></div>
 ${calendarStrip()}<section class="addTask card"><input id="plannerTitle" placeholder="Быстро записать задачу">${areaPicker()}<button class="primary" id="plannerAdd">＋ Добавить</button></section>
 <div class="horizonList">${list.length?list.map(horizonCard).join(""):'<article class="hCard card"><small>Здесь пока пусто.</small></article>'}</div>`;
}

function shortDate(dateStr){
 if(!dateStr)return "";
 return new Date(dateStr+"T12:00:00").toLocaleDateString("ru-RU",{day:"numeric",month:"long"});
}
function openPlanDateDialog(taskId, mode="week"){
 const t=state.tasks.find(x=>x.id==taskId); if(!t)return;
 const old=document.getElementById("planDateModal"); if(old)old.remove();
 const suggested=t.planDate||calDate||isoLocal(new Date());
 const title=mode==="week"?"Выбрать неделю / дату":"Назначить день";
 const hint=mode==="week"
   ?"Выбери дату. MyOS сам определит нужную неделю. Дата сохранится для следующего шага."
   :"Выбери конкретный день задачи.";
 const wrap=document.createElement("div");
 wrap.id="planDateModal"; wrap.className="modalShade";
 wrap.innerHTML=`<section class="planModal card">
   <button class="modalClose" id="planDateCancel">×</button>
   <span class="kicker">📅 ПЛАНИРОВАНИЕ</span>
   <h2>${title}</h2>
   <p class="muted">${hint}</p>
   <label class="dateLabel">Дата<input id="planDateInput" type="date" value="${suggested}"></label>
   <div class="modalPreview" id="modalPreview"></div>
   <button class="primary" id="planDateApply">${mode==="week"?"Назначить в эту неделю":"Назначить на этот день"}</button>
 </section>`;
 document.body.appendChild(wrap);
 const inp=document.getElementById("planDateInput"), preview=document.getElementById("modalPreview");
 const refresh=()=>{
   if(!inp.value){preview.textContent="Выбери дату";return}
   const w=weekRange(inp.value);
   preview.innerHTML=`<b>${shortDate(inp.value)}</b><small>Неделя: ${w.label}</small>`;
 };
 refresh(); inp.onchange=refresh;
 document.getElementById("planDateCancel").onclick=()=>wrap.remove();
 wrap.onclick=e=>{if(e.target===wrap)wrap.remove()};
 document.getElementById("planDateApply").onclick=()=>{
   if(!inp.value)return alert("Выбери дату.");
   const d=new Date(inp.value+"T12:00:00"), w=weekRange(inp.value);
   t.planYear=d.getFullYear(); t.planMonth=d.getMonth()+1; t.planWeek=w.start; t.planDate=inp.value;
   t.horizon=mode==="week"?"week":"today"; t.status="todo";
   t.plannedHistory=t.plannedHistory||[];
   t.plannedHistory.push({at:new Date().toISOString(),date:inp.value,week:w.start,stage:t.horizon});
   calYear=d.getFullYear(); calMonth=d.getMonth(); calDate=inp.value;
   save(); wrap.remove(); plan();
 };
}

function horizonCard(t){
 let action="";
 if(t.horizon==="inbox") action=`<button data-to="${t.id}:year">→ В год</button>`;
 if(t.horizon==="year") action=`<button data-to="${t.id}:month">→ В месяц</button>`;
 if(t.horizon==="month") action=`<button data-pickweek="${t.id}">📅 Выбрать дату</button>`;
 if(t.horizon==="week"){
   action=`<button data-pickday="${t.id}">${t.planDate?"→ На "+shortDate(t.planDate):"📅 Выбрать день"}</button>
           <button data-pickweek="${t.id}">↻ Перенести</button>`;
 }
 return `<article class="hCard card ${areaCls(t)}"><strong>${t.priority==="Высокий"?"🔥 ":""}${t.title}</strong>${areaTag(t)}
 <small>${periodLabel(t)}${t.planDate&&t.horizon==="week"?" · день: "+shortDate(t.planDate):""} · ${t.priority||"Обычный"} · ${t.mins||30} мин</small>
 <div class="hActions">${action}<button data-doneplan="${t.id}">✓ Выполнено</button><button data-remove="${t.id}">Удалить</button></div></article>`;
}
function todayBoard(){
 const cols=[["todo","📥 Нужно"],["doing","🏃 В работе"],["waiting","🏓 Жду"],["done","✅ Готово"]];
 const active=state.tasks.filter(t=>t.horizon==="today"&&(t.planDate||calDate)===calDate);
 return `${calendarStrip()}<section class="addTask card"><input id="taskTitle" placeholder="Что нужно сделать сегодня?">${areaPicker()}<div class="row2"><select id="taskPriority"><option>Высокий</option><option selected>Обычный</option><option>Низкий</option></select><select id="taskMins"><option value="15">15 мин</option><option value="30">30 мин</option><option value="60" selected>60 мин</option><option value="90">90 мин</option></select></div><button class="primary" id="createTask">＋ Добавить на сегодня</button></section>
 <div class="sectionTitle"><h2>Сегодня</h2><span>${active.filter(t=>t.status==="done").length}/${active.length} выполнено</span></div>
 <div class="mobileStatus">${cols.map(c=>`<button data-statusview="${c[0]}" class="${mobileStatusView===c[0]?"active":""}">${c[1]} (${active.filter(t=>t.status===c[0]).length})</button>`).join("")}</div>
 <div class="dailyBoard">${cols.map(c=>boardColumn(c[0],c[1])).join("")}</div>`;
}
function boardColumn(status,label){
 let items=state.tasks.filter(t=>t.horizon==="today"&&t.status===status&&(t.planDate||calDate)===calDate);
 return `<section class="boardCol card ${mobileStatusView===status?"show":""}" data-colstatus="${status}"><h3>${label}<span>${items.length}</span></h3>${items.length?items.map(boardTask).join(""):'<small class="muted">Пусто</small>'}</section>`;
}
function boardTask(t){
 const moves={todo:[["doing","В работу →"],["waiting","Жду →"],["done","✓ Готово"]],doing:[["todo","← В список"],["waiting","Жду →"],["done","✓ Готово"]],waiting:[["todo","← Вернуть"],["doing","В работу →"],["done","✓ Готово"]],done:[["todo","↩ Вернуть"]]}[t.status];
 return `<article class="boardTask ${areaCls(t)}" draggable="true" data-taskid="${t.id}"><strong>${t.priority==="Высокий"?"🔥 ":""}${t.title}</strong>${areaTag(t)}<small>${t.priority||"Обычный"} · ${t.mins||30} мин${t.waitingFor?" · ждём: "+t.waitingFor:""}</small><div class="taskMoves">${moves.map(m=>`<button data-move="${t.id}:${m[0]}">${m[1]}</button>`).join("")}<button data-back="${t.id}">В неделю</button><button data-remove="${t.id}">Удалить</button></div></article>`;
}
function archiveView(){
 let list=state.tasks.filter(t=>t.status==="done");
 return `<section class="planSummary card"><div><small>Выполнено</small><b>${list.length}</b></div><div><small>История</small><b>2026</b></div></section><div class="sectionTitle"><h2>Результаты</h2><span>архив</span></div><div class="horizonList">${list.length?list.map(t=>`<article class="hCard card"><strong>✅ ${t.title}</strong><small>${t.completed?new Date(t.completed).toLocaleDateString("ru-RU"):"выполнено"}</small><div class="hActions"><button data-reopen="${t.id}">↩ Вернуть</button></div></article>`).join(""):'<article class="hCard card"><small>Выполненных задач пока нет.</small></article>'}</div>`;
}
function periodLabel(t){
 if(t.horizon==="year") return String(t.planYear||calYear);
 if(t.horizon==="month") return `${monthName(Number(t.planMonth||calMonth+1)-1)} ${t.planYear||calYear}`;
 if(t.horizon==="week") return `Неделя ${t.planWeek||weekRange(calDate).start}`;
 if(t.horizon==="today") return new Date((t.planDate||calDate)+"T12:00:00").toLocaleDateString("ru-RU",{day:"numeric",month:"short"});
 return "Без периода";
}
function areaCls(t){return (AREAS[t.lifeArea]||AREAS.work)[2]}
function areaTag(t){let a=AREAS[t.lifeArea]||AREAS.work;return `<span class="areaTag ${a[2]}"><i></i>${a[0]} ${a[1]}</span>`}
function areaPicker(){return `<div class="areaPicker">${Object.entries(AREAS).map(([k,a])=>`<button type="button" data-area="${k}" class="${a[2]} ${selectedArea===k?"active":""}">${a[0]} ${a[1]}</button>`).join("")}</div>`}
function bindAreaPicker(){document.querySelectorAll("[data-area]").forEach(b=>b.onclick=()=>{selectedArea=b.dataset.area;document.querySelectorAll("[data-area]").forEach(x=>x.classList.toggle("active",x.dataset.area===selectedArea))})}

function calendarStrip(){
 if(horizonView==="year") return `<section class="calendarStrip card"><button id="prevYear">‹</button><strong>${calYear}</strong><button id="nextYear">›</button></section>`;
 if(horizonView==="month") return `<section class="calendarStrip card"><button id="prevMonth">‹</button><strong>${monthName(calMonth)} ${calYear}</strong><button id="nextMonth">›</button></section>`;
 if(horizonView==="week") return `<section class="calendarStrip card"><button id="prevWeek">‹</button><strong>${weekRange(calDate).label}</strong><button id="nextWeek">›</button></section>`;
 if(horizonView==="today") return `<section class="calendarStrip card"><button id="prevDay">‹</button><strong>${new Date(calDate+"T12:00:00").toLocaleDateString("ru-RU",{weekday:"short",day:"numeric",month:"long"})}</strong><button id="nextDay">›</button></section>`;
 return "";
}

function bindPlanner(){
 bindAreaPicker();
 const py=$("#prevYear"),ny=$("#nextYear"),pm=$("#prevMonth"),nm=$("#nextMonth"),pw=$("#prevWeek"),nw=$("#nextWeek"),pd=$("#prevDay"),nd=$("#nextDay");
 if(py)py.onclick=()=>{calYear--;plan()}; if(ny)ny.onclick=()=>{calYear++;plan()};
 if(pm)pm.onclick=()=>{calMonth--;if(calMonth<0){calMonth=11;calYear--}plan()};
 if(nm)nm.onclick=()=>{calMonth++;if(calMonth>11){calMonth=0;calYear++}plan()};
 if(pw)pw.onclick=()=>{let d=new Date(calDate+"T12:00:00");d.setDate(d.getDate()-7);calDate=isoLocal(d);plan()};
 if(nw)nw.onclick=()=>{let d=new Date(calDate+"T12:00:00");d.setDate(d.getDate()+7);calDate=isoLocal(d);calYear=d.getFullYear();calMonth=d.getMonth();plan()};
 if(pd)pd.onclick=()=>{let d=new Date(calDate+"T12:00:00");d.setDate(d.getDate()-1);calDate=isoLocal(d);calYear=d.getFullYear();calMonth=d.getMonth();plan()};
 if(nd)nd.onclick=()=>{let d=new Date(calDate+"T12:00:00");d.setDate(d.getDate()+1);calDate=isoLocal(d);calYear=d.getFullYear();calMonth=d.getMonth();plan()};
 let p=$("#plannerAdd");if(p)p.onclick=()=>{let v=$("#plannerTitle").value.trim();if(!v)return;state.tasks.unshift({id:Date.now(),title:v,status:"todo",priority:"Обычный",mins:30,lifeArea:selectedArea,horizon:horizonView,planYear:calYear,
 planMonth:horizonView==="month"?calMonth+1:null,
 planWeek:horizonView==="week"?weekRange(calDate).start:null,
 planDate:horizonView==="today"?calDate:null,created:new Date().toISOString(),completed:null,waitingFor:""});save();plan()};
 let c=$("#createTask");if(c)c.onclick=()=>{let v=$("#taskTitle").value.trim();if(!v)return;state.tasks.unshift({id:Date.now(),title:v,status:"todo",priority:$("#taskPriority").value,mins:+$("#taskMins").value,lifeArea:selectedArea,horizon:"today",planYear:calYear,planMonth:calMonth+1,planWeek:weekRange(calDate).start,planDate:calDate,created:new Date().toISOString(),completed:null,waitingFor:""});save();plan()};
 document.querySelectorAll("[data-statusview]").forEach(b=>b.onclick=()=>{mobileStatusView=b.dataset.statusview;plan()});
 document.querySelectorAll("[data-to]").forEach(b=>b.onclick=()=>{let [id,h]=b.dataset.to.split(":");let t=state.tasks.find(x=>x.id==id);if(t){t.horizon=h;t.planYear=calYear;if(h==="month")t.planMonth=calMonth+1;if(h==="week"){t.planMonth=calMonth+1;t.planWeek=weekRange(calDate).start}if(h==="today"){t.planMonth=calMonth+1;t.planWeek=weekRange(calDate).start;t.planDate=calDate;t.status="todo"}save();plan()}});
 document.querySelectorAll("[data-pickweek]").forEach(b=>b.onclick=()=>openPlanDateDialog(+b.dataset.pickweek,"week"));
 document.querySelectorAll("[data-pickday]").forEach(b=>b.onclick=()=>{
   let t=state.tasks.find(x=>x.id==b.dataset.pickday); if(!t)return;
   if(t.planDate){
     let d=new Date(t.planDate+"T12:00:00");
     t.horizon="today";t.status="todo";t.planYear=d.getFullYear();t.planMonth=d.getMonth()+1;t.planWeek=weekRange(t.planDate).start;
     calYear=d.getFullYear();calMonth=d.getMonth();calDate=t.planDate;save();plan();
   }else openPlanDateDialog(t.id,"today");
 });
 document.querySelectorAll("[data-doneplan]").forEach(b=>b.onclick=()=>{let t=state.tasks.find(x=>x.id==b.dataset.doneplan);if(t){t.status="done";t.completed=new Date().toISOString();save();plan()}});
 document.querySelectorAll("[data-move]").forEach(b=>b.onclick=()=>{let [id,s]=b.dataset.move.split(":");let t=state.tasks.find(x=>x.id==id);if(t){t.status=s;if(s==="waiting"){let w=prompt("От кого или чего ждём?","");if(w!==null)t.waitingFor=w}if(s==="done")t.completed=new Date().toISOString();save();plan()}});
 document.querySelectorAll("[data-back]").forEach(b=>b.onclick=()=>{let t=state.tasks.find(x=>x.id==b.dataset.back);if(t){t.horizon="week";t.status="todo";t.planWeek=t.planWeek||weekRange(t.planDate||calDate).start;save();plan()}});
 document.querySelectorAll("[data-remove]").forEach(b=>b.onclick=()=>{if(confirm("Удалить задачу?")){state.tasks=state.tasks.filter(x=>x.id!=b.dataset.remove);save();plan()}});
 document.querySelectorAll("[data-reopen]").forEach(b=>b.onclick=()=>{let t=state.tasks.find(x=>x.id==b.dataset.reopen);if(t){t.status="todo";t.horizon="today";t.completed=null;save();plan()}});
 let dragged=null;document.querySelectorAll("[data-taskid]").forEach(el=>el.ondragstart=()=>dragged=el.dataset.taskid);
 document.querySelectorAll("[data-colstatus]").forEach(col=>{col.ondragover=e=>e.preventDefault();col.ondrop=e=>{e.preventDefault();let t=state.tasks.find(x=>x.id==dragged);if(t){t.status=col.dataset.colstatus;if(t.status==="done")t.completed=new Date().toISOString();save();plan()}}});
}
function quick(i,t,action=""){return `<button class="quick" ${action?`data-action="${action}"`:""}><b>${i}</b>${t}</button>`}
function add(){
 shell(header("Добавить","Быстрая запись — без лишних экранов")+`<div class="sectionTitle"><h2>Что записать?</h2></div><section class="quickGrid">
 ${quick("🍽","Еду")}${quick("🏋️","Тренировку")}${quick("✓","Задачу")}${quick("📚","Чтение","reading")}${quick("🇰🇿","Язык")}${quick("📝","Заметку")}${quick("📖","Дневник")}${quick("⚖️","Вес")}</section>
 <div class="sectionTitle"><h2>Чтение сегодня</h2><span>по страницам</span></div><div class="books">${booksHTML()}</div>
 <div class="sectionTitle"><h2>Добавить книгу</h2></div>
 <section class="form card">
  <label>Название<input id="newName" placeholder="Например: Атомные привычки"></label>
  <div class="row2"><label>Текущая страница<input id="newPage" type="number" value="1" min="1"></label><label>Всего страниц<input id="newTotal" type="number" value="300" min="1"></label></div>
  <label>Дневная норма, страниц<input id="newDaily" type="number" value="10" min="1"></label>
  <button class="primary" id="addBook">Добавить книгу</button>
 </section>`);
 bindMode();bindBooks();$("#addBook").onclick=()=>{
  const name=$("#newName").value.trim(), page=+$("#newPage").value, total=+$("#newTotal").value, daily=+$("#newDaily").value;
  if(!name||!total||!daily)return alert("Заполни название, объём и дневную норму.");
  state.books.push({id:Date.now(),name,icon:"📘",daily,page:Math.min(page,total),total,history:{}});save();add();
 };
 document.querySelector('[data-action="reading"]').onclick=()=>document.querySelector(".books").scrollIntoView({behavior:"smooth"});
}
function booksHTML(){
 const rs=readingSummary();
 return `<section class="summaryLine card"><span class="kicker">СЕГОДНЯ</span><strong>${rs.done}/${rs.target} стр.</strong><small class="muted">${state.books.filter(b=>readToday(b)>=b.daily).length} из ${state.books.length} книг по норме</small></section>`+
 state.books.map((b,i)=>{
  const done=readToday(b), pct=Math.round(b.page/b.total*100), left=Math.max(0,b.daily-done), remaining=Math.max(0,b.total-b.page), days=Math.ceil(remaining/Math.max(1,b.daily));
  return `<article class="book readCompact card"><div class="bookTop"><div><h3>${b.icon} ${b.name}</h3><small>Текущая: ${b.page}/${b.total} · ${pct}%</small></div><strong>${done}/${b.daily}</strong></div>
  <div class="bar"><i style="width:${Math.min(100,done/b.daily*100)}%"></i></div>
  <div class="bookActions"><button data-plus1="${i}">+1</button><button data-plus5="${i}">+5</button><button data-plus10="${i}">+10</button><button class="primary" data-norm="${i}">${left?`✓ Норма +${left}`:"Норма ✓"}</button><button data-details="${i}">•••</button></div>
  <div class="details" id="details${i}">До конца: ${remaining} стр. · примерно ${days} дн. при текущей норме.<br><br><button class="secondary" data-edit="${i}">Изменить</button> <button class="danger" data-del="${i}">Удалить</button></div></article>`
 }).join("")
}
function bindBooks(){
 document.querySelectorAll("[data-norm]").forEach(b=>b.onclick=()=>{let x=state.books[+b.dataset.norm], left=Math.max(0,x.daily-readToday(x));if(left){addRead(x,left);add()}});
 document.querySelectorAll("[data-details]").forEach(b=>b.onclick=()=>{let d=$("#details"+b.dataset.details);d.style.display=d.style.display==="block"?"none":"block"});
 document.querySelectorAll("[data-plus1]").forEach(b=>b.onclick=()=>{addRead(state.books[+b.dataset.plus1],1);add()});
 document.querySelectorAll("[data-plus5]").forEach(b=>b.onclick=()=>{addRead(state.books[+b.dataset.plus5],5);add()});
 document.querySelectorAll("[data-plus10]").forEach(b=>b.onclick=()=>{addRead(state.books[+b.dataset.plus10],10);add()});
 document.querySelectorAll("[data-del]").forEach(b=>b.onclick=()=>{const i=+b.dataset.del;if(confirm("Удалить эту книгу из списка?")){state.books.splice(i,1);save();add()}});
 document.querySelectorAll("[data-edit]").forEach(b=>b.onclick=()=>editBook(+b.dataset.edit));
}
function editBook(i){
 const b=state.books[i];
 const name=prompt("Название книги:",b.name); if(name===null)return;
 const daily=+prompt("Дневная норма страниц:",b.daily); if(!daily)return;
 const page=+prompt("Текущая страница:",b.page); if(!page)return;
 const total=+prompt("Всего страниц:",b.total); if(!total)return;
 Object.assign(b,{name:name.trim()||b.name,daily,page:Math.min(page,total),total});save();add();
}
function progress(){
 const rs=readingSummary();
 shell(header("Прогресс","Неделя · месяц · год")+`<div class="sectionTitle"><h2>Сферы жизни</h2><span>эта неделя</span></div><section class="area card">
 ${area("Здоровье",78)}${area("Работа",84)}${area("Развитие",69)}${area("Отдых",52)}${area("Отношения",61)}</section>
 <div class="sectionTitle"><h2>Чтение</h2><span>сегодня</span></div><section class="grid">${mini("📚 ПРОЧИТАНО",rs.done+" стр.","сегодня")}${mini("🎯 НОРМА",rs.target+" стр.","по всем книгам")}${mini("📘 КНИГ",""+state.books.length,"активных")}${mini("✅ ОСТАЛОСЬ",rs.left+" стр.","на сегодня")}</section>`);
 bindMode();
}
function area(n,v){return `<p><span>${n}</span><progress value="${v}" max="100"></progress><b>${v}</b></p>`}
function me(){
 shell(header("Я","Моя система")+`<section class="profile card" style="margin-top:22px"><span class="kicker">ТЕКУЩИЙ РЕЖИМ</span><h3>${state.mode==="Вахта"?"⛺ Вахта":"🏠 Дом"}</h3><small class="muted">Планирование и тренировки адаптируются под режим.</small></section>
 <div class="sectionTitle"><h2>Мои направления</h2></div><section class="settings">
 <button>🎯 Цели и приоритеты</button><button>🇰🇿🇬🇧🇨🇳 Языки</button><button>🛢 Профессиональное развитие</button><button>🏋️ Фитнес и тело</button><button onclick="current='add';render('add')">📚 Моя библиотека</button><button>🔔 Ритуалы и напоминания</button><button>⚙️ Настройки MyOS</button></section>`);
 bindMode();
}
function render(p){current=p;document.querySelectorAll("nav button").forEach(b=>b.classList.toggle("active",b.dataset.page===p));({today,plan,add,progress,me}[p]||today)();scrollTo(0,0)}
document.querySelectorAll("nav button").forEach(b=>b.onclick=()=>render(b.dataset.page));
render("today");
initCloud();
