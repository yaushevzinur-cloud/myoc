
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
if(!state.goals) state.goals=[];
if(!state.work) state.work={contracts:[],projects:[],jobs:[],stock:[]};
if(!state.work.contracts) state.work.contracts=[];
if(!state.work.projects) state.work.projects=[];
if(!state.work.jobs) state.work.jobs=[];
if(!state.work.stock) state.work.stock=[];

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
function header(title,sub=""){return `<div class="top"><div><span class="eyebrow">MYOS · V0.19.1.0</span><h1>${title}</h1><div class="muted">${sub}</div><span id="cloudSync" class="cloudSync">${window.MYOS_SYNC_STATUS||"☁ Проверка…"}</span></div><button class="mode" id="mode">${state.mode==="Вахта"?"⛺":"🏠"} ${state.mode}</button></div>`}
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

function taskDateParts(dateStr){
 const d=new Date((dateStr||isoLocal(new Date()))+"T12:00:00");
 return {year:d.getFullYear(),month:d.getMonth()+1,week:weekRange(isoLocal(d)).start,date:isoLocal(d)};
}
function rememberPlan(t, action){
 t.plannedHistory=t.plannedHistory||[];
 t.plannedHistory.push({
   at:new Date().toISOString(),
   action:action||"Перепланировано",
   horizon:t.horizon,
   year:t.planYear||null,
   month:t.planMonth||null,
   week:t.planWeek||null,
   date:t.planDate||null
 });
}
function applyExactDate(t,dateStr,horizon="today",action="Назначена дата"){
 const p=taskDateParts(dateStr);
 t.planYear=p.year;t.planMonth=p.month;t.planWeek=p.week;t.planDate=p.date;
 t.horizon=horizon;t.status=t.status==="done"?"todo":t.status;
 rememberPlan(t,action);
}
function moveUp(t,target){
 const base=t.planDate||t.planWeek||calDate;
 const p=taskDateParts(base);
 t.planYear=p.year;
 if(target==="week"){
   t.horizon="week";t.planMonth=p.month;t.planWeek=p.week;t.status="todo";
 }else if(target==="month"){
   t.horizon="month";t.planMonth=p.month;t.status="todo";
 }else if(target==="year"){
   t.horizon="year";t.status="todo";
 }
 rememberPlan(t,"Перенесено в "+target);
}
function isOverdueTask(t){
 const today=isoLocal(new Date());
 return t.horizon==="today" && t.status!=="done" && !!t.planDate && t.planDate<today;
}

function openPlanDateDialog(taskId, mode="week"){
 const t=state.tasks.find(x=>x.id==taskId); if(!t)return;
 const old=document.getElementById("planDateModal"); if(old)old.remove();
 const suggested=t.planDate||calDate||isoLocal(new Date());
 const title=mode==="week"?"Выбрать дату для недели":mode==="replan"?"Перепланировать задачу":"Назначить день";
 const hint=mode==="week"
   ?"Выбери дату — MyOS сам определит неделю."
   :mode==="replan"?"Выбери новую конкретную дату. Карточка останется той же, история сохранится."
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
   <button class="primary" id="planDateApply">${mode==="week"?"Назначить в эту неделю":"Сохранить дату"}</button>
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
   const d=new Date(inp.value+"T12:00:00");
   if(mode==="week") applyExactDate(t,inp.value,"week","Назначена неделя по дате");
   else applyExactDate(t,inp.value,"today",mode==="replan"?"Перепланирована дата":"Назначен день");
   calYear=d.getFullYear(); calMonth=d.getMonth(); calDate=inp.value;
   save(); wrap.remove(); plan();
 };
}
function horizonCard(t){
 let action="";
 if(t.horizon==="inbox") action=`<button data-to="${t.id}:year">→ В год</button>`;
 if(t.horizon==="year") action=`<button data-to="${t.id}:month">→ В месяц</button>`;
 if(t.horizon==="month") action=`<button data-pickweek="${t.id}">📅 Назначить дату</button><button data-up="${t.id}:year">↑ В год</button>`;
 if(t.horizon==="week"){
   action=`<button data-pickday="${t.id}">${t.planDate?"→ На "+shortDate(t.planDate):"📅 Выбрать день"}</button>
           <button data-replan="${t.id}">📅 Перенести</button>
           <button data-up="${t.id}:month">↑ В месяц</button>`;
 }
 return `<article class="hCard card ${areaCls(t)}"><strong>${t.priority==="Высокий"?"🔥 ":""}${t.title}</strong>${areaTag(t)}
 <small>${periodLabel(t)}${t.planDate&&t.horizon==="week"?" · день: "+shortDate(t.planDate):""} · ${t.priority||"Обычный"} · ${t.mins||30} мин</small>
 <div class="hActions">${action}<button data-doneplan="${t.id}">✓ Выполнено</button><button data-remove="${t.id}">Удалить</button></div></article>`;
}
function isTodayDate(dateStr){
 const today=isoLocal(new Date());
 return dateStr===today;
}
function selectedDayLabel(dateStr){
 if(!dateStr || isTodayDate(dateStr)) return "Сегодня";
 return shortDate(dateStr);
}
function selectedDayButtonLabel(dateStr){
 if(!dateStr || isTodayDate(dateStr)) return "＋ Добавить на сегодня";
 return "＋ Добавить на " + shortDate(dateStr);
}

function todayBoard(){
 const cols=[["todo","📥 Нужно"],["doing","🏃 В работе"],["waiting","🏓 Жду"],["done","✅ Готово"]];
 const active=state.tasks.filter(t=>t.horizon==="today"&&(t.planDate||calDate)===calDate);
 const todayKey=isoLocal(new Date());
 const overdue=calDate===todayKey?state.tasks.filter(isOverdueTask):[];
 const overdueHTML=overdue.length?`<section class="overdueBox card"><div class="sectionTitle"><h2>⚠ Просрочено</h2><span>${overdue.length}</span></div>
   <p class="muted">Невыполненные задачи с прошлых дат. Перенеси их на сегодня или выбери новую дату.</p>
   <div class="overdueList">${overdue.map(t=>`<article class="overdueTask ${areaCls(t)}"><strong>${t.title}</strong><small>${shortDate(t.planDate)} · ${t.priority||"Обычный"}</small><div class="taskMoves"><button data-carrytoday="${t.id}">→ На сегодня</button><button data-replan="${t.id}">📅 Перенести</button></div></article>`).join("")}</div></section>`:"";
 return `${calendarStrip()}${overdueHTML}<section class="addTask card"><input id="taskTitle" placeholder="${isTodayDate(calDate)?"Что нужно сделать сегодня?":"Что нужно сделать "+shortDate(calDate)+"?"}">${areaPicker()}<div class="row2"><select id="taskPriority"><option>Высокий</option><option selected>Обычный</option><option>Низкий</option></select><select id="taskMins"><option value="15">15 мин</option><option value="30">30 мин</option><option value="60" selected>60 мин</option><option value="90">90 мин</option></select></div><button class="primary" id="createTask">${selectedDayButtonLabel(calDate)}</button></section>
 <div class="sectionTitle"><h2>${selectedDayLabel(calDate)}</h2><span>${active.filter(t=>t.status==="done").length}/${active.length} выполнено</span></div>
 <div class="mobileStatus">${cols.map(c=>`<button data-statusview="${c[0]}" class="${mobileStatusView===c[0]?"active":""}">${c[1]} (${active.filter(t=>t.status===c[0]).length})</button>`).join("")}</div>
 <div class="dailyBoard">${cols.map(c=>boardColumn(c[0],c[1])).join("")}</div>`;
}
function boardColumn(status,label){
 let items=state.tasks.filter(t=>t.horizon==="today"&&t.status===status&&(t.planDate||calDate)===calDate);
 return `<section class="boardCol card ${mobileStatusView===status?"show":""}" data-colstatus="${status}"><h3>${label}<span>${items.length}</span></h3>${items.length?items.map(boardTask).join(""):'<small class="muted">Пусто</small>'}</section>`;
}
function boardTask(t){
 const moves={todo:[["doing","В работу →"],["waiting","Жду →"],["done","✓ Готово"]],doing:[["todo","← В список"],["waiting","Жду →"],["done","✓ Готово"]],waiting:[["todo","← Вернуть"],["doing","В работу →"],["done","✓ Готово"]],done:[["todo","↩ Вернуть"]]}[t.status];
 return `<article class="boardTask ${areaCls(t)}" draggable="true" data-taskid="${t.id}"><strong>${t.priority==="Высокий"?"🔥 ":""}${t.title}</strong>${areaTag(t)}<small>${t.priority||"Обычный"} · ${t.mins||30} мин${t.waitingFor?" · ждём: "+t.waitingFor:""}</small><div class="taskMoves">${moves.map(m=>`<button data-move="${t.id}:${m[0]}">${m[1]}</button>`).join("")}<button data-replan="${t.id}">📅 Перенести</button><button data-up="${t.id}:week">↑ В неделю</button><button data-up="${t.id}:month">↑ В месяц</button><button data-remove="${t.id}">Удалить</button></div></article>`;
}
function archiveView(){
 let all=state.tasks.filter(t=>t.status==="done");
 let list=all.filter(t=>{
   if(!t.completed)return Number(t.planYear||calYear)===calYear;
   return new Date(t.completed).getFullYear()===calYear;
 });
 const months=Array.from({length:12},(_,m)=>{
   const n=list.filter(t=>t.completed&&new Date(t.completed).getMonth()===m).length;
   return n?`<span>${monthName(m).slice(0,3)} <b>${n}</b></span>`:"";
 }).join("");
 return `${calendarStrip()}<section class="planSummary card"><div><small>Выполнено за ${calYear}</small><b>${list.length}</b></div><div><small>Всего в архиве</small><b>${all.length}</b></div></section>
 <section class="archiveMonths card"><span class="kicker">ПО МЕСЯЦАМ</span><div>${months||'<small class="muted">Пока нет выполненных задач за этот год.</small>'}</div></section>
 <div class="sectionTitle"><h2>Результаты ${calYear}</h2><span>архив</span></div><div class="horizonList">${list.length?list.map(t=>`<article class="hCard card ${areaCls(t)}"><strong>✅ ${t.title}</strong>${areaTag(t)}<small>${t.completed?new Date(t.completed).toLocaleDateString("ru-RU"):"выполнено"}${t.planDate?" · план: "+shortDate(t.planDate):""}</small><div class="hActions"><button data-reopen="${t.id}">↩ Вернуть</button></div></article>`).join(""):'<article class="hCard card"><small>Выполненных задач за этот год пока нет.</small></article>'}</div>`;
}
function periodLabel(t){
 const months=["января","февраля","марта","апреля","мая","июня","июля","августа","сентября","октября","ноября","декабря"];
 if(t.horizon==="day" && t.date){
   const d=new Date(t.date+"T12:00:00");
   return `${d.getDate()} ${months[d.getMonth()]}`;
 }
 if(t.planLevel==="inbox" || t.horizon==="inbox") return "📥 Входящие";
 if(t.horizon==="year") return String(t.planYear||calYear);
 if(t.horizon==="month") return monthNames[(t.planMonth||1)-1]+" "+(t.planYear||calYear);
 if(t.horizon==="week"){
   const raw=t.weekStart||t.planWeek||t.date||"";
   if(!raw)return "Неделя";
   const a=new Date(raw+"T12:00:00"), b=new Date(a); b.setDate(a.getDate()+6);
   return a.getMonth()===b.getMonth()
     ? `${a.getDate()}–${b.getDate()} ${months[b.getMonth()]}`
     : `${a.getDate()} ${months[a.getMonth()]} – ${b.getDate()} ${months[b.getMonth()]}`;
 }
 return "Без периода";
}
function areaCls(t){return (AREAS[t.lifeArea]||AREAS.work)[2]}
function areaTag(t){let a=AREAS[t.lifeArea]||AREAS.work;return `<span class="areaTag ${a[2]}"><i></i>${a[0]} ${a[1]}</span>`}
function areaPicker(){return `<div class="areaPicker">${Object.entries(AREAS).map(([k,a])=>`<button type="button" data-area="${k}" class="${a[2]} ${selectedArea===k?"active":""}">${a[0]} ${a[1]}</button>`).join("")}</div>`}
function bindAreaPicker(){document.querySelectorAll("[data-area]").forEach(b=>b.onclick=()=>{selectedArea=b.dataset.area;document.querySelectorAll("[data-area]").forEach(x=>x.classList.toggle("active",x.dataset.area===selectedArea))})}

function calendarStrip(){
 if(horizonView==="year"||horizonView==="archive") return `<section class="calendarStrip card"><button id="prevYear">‹</button><strong>${calYear}</strong><button id="nextYear">›</button></section>`;
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
 document.querySelectorAll("[data-replan]").forEach(b=>b.onclick=()=>openPlanDateDialog(+b.dataset.replan,"replan"));
 document.querySelectorAll("[data-up]").forEach(b=>b.onclick=()=>{
   let [id,target]=b.dataset.up.split(":");let t=state.tasks.find(x=>x.id==id);if(!t)return;
   moveUp(t,target);save();plan();
 });
 document.querySelectorAll("[data-carrytoday]").forEach(b=>b.onclick=()=>{
   let t=state.tasks.find(x=>x.id==b.dataset.carrytoday);if(!t)return;
   applyExactDate(t,isoLocal(new Date()),"today","Просроченная перенесена на сегодня");
   save();plan();
 });
 document.querySelectorAll("[data-doneplan]").forEach(b=>b.onclick=()=>{let t=state.tasks.find(x=>x.id==b.dataset.doneplan);if(t){t.status="done";t.completed=new Date().toISOString();syncProfessionalFromTask(t);save();plan()}});
 document.querySelectorAll("[data-move]").forEach(b=>b.onclick=()=>{let [id,s]=b.dataset.move.split(":");let t=state.tasks.find(x=>x.id==id);if(t){t.status=s;if(s==="waiting"){let w=prompt("От кого или чего ждём?","");if(w!==null)t.waitingFor=w}if(s==="done")t.completed=new Date().toISOString();if(s!=="done")t.completed=null;syncProfessionalFromTask(t);save();plan()}});
 document.querySelectorAll("[data-back]").forEach(b=>b.onclick=()=>{let t=state.tasks.find(x=>x.id==b.dataset.back);if(t){moveUp(t,"week");save();plan()}});
 document.querySelectorAll("[data-remove]").forEach(b=>b.onclick=()=>{if(confirm("Удалить задачу?")){state.tasks=state.tasks.filter(x=>x.id!=b.dataset.remove);save();plan()}});
 document.querySelectorAll("[data-reopen]").forEach(b=>b.onclick=()=>{let t=state.tasks.find(x=>x.id==b.dataset.reopen);if(t){t.completed=null;applyExactDate(t,calDate,"today","Возвращена из архива");syncProfessionalFromTask(t);save();plan()}});
 let dragged=null;document.querySelectorAll("[data-taskid]").forEach(el=>el.ondragstart=()=>dragged=el.dataset.taskid);
 document.querySelectorAll("[data-colstatus]").forEach(col=>{col.ondragover=e=>e.preventDefault();col.ondrop=e=>{e.preventDefault();let t=state.tasks.find(x=>x.id==dragged);if(t){t.status=col.dataset.colstatus;if(t.status==="done")t.completed=new Date().toISOString();else t.completed=null;syncProfessionalFromTask(t);save();plan()}}});
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

let progressRange="week";

function rangeBounds(type){
 const now=new Date(), today=isoLocal(now);
 if(type==="week"){
   const w=weekRange(today);
   return {start:w.start,end:w.end,label:w.label};
 }
 if(type==="month"){
   const y=now.getFullYear(),m=now.getMonth();
   const start=`${y}-${String(m+1).padStart(2,"0")}-01`;
   const end=isoLocal(new Date(y,m+1,0));
   return {start,end,label:monthName(m)+" "+y};
 }
 const y=now.getFullYear();
 return {start:`${y}-01-01`,end:`${y}-12-31`,label:String(y)};
}
function inDateRange(dateStr,r){
 return !!dateStr && dateStr>=r.start && dateStr<=r.end;
}
function completedDate(t){
 return t.completed?isoLocal(new Date(t.completed)):null;
}
function taskPlanDate(t){
 if(t.planDate)return t.planDate;
 if(t.planWeek)return t.planWeek;
 if(t.planYear&&t.planMonth)return `${t.planYear}-${String(t.planMonth).padStart(2,"0")}-01`;
 if(t.planYear)return `${t.planYear}-01-01`;
 return null;
}
function analyticsFor(type){
 const r=rangeBounds(type), tasks=state.tasks||[];
 const completed=tasks.filter(t=>t.status==="done"&&inDateRange(completedDate(t),r));
 const planned=tasks.filter(t=>inDateRange(taskPlanDate(t),r));
 const plannedDone=planned.filter(t=>t.status==="done").length;
 const open=planned.filter(t=>t.status!=="done").length;
 const overdue=tasks.filter(t=>isOverdueTask(t)).length;
 const moved=tasks.filter(t=>(t.plannedHistory||[]).some(h=>{
   const d=h.at?isoLocal(new Date(h.at)):null;
   return inDateRange(d,r) && /Переплан|перенес|Назнач|назнач/i.test(h.action||"");
 })).length;
 const rate=planned.length?Math.round(plannedDone/planned.length*100):0;

 const areas=Object.keys(AREAS).map(k=>{
   const total=planned.filter(t=>(t.lifeArea||"work")===k).length;
   const done=planned.filter(t=>(t.lifeArea||"work")===k&&t.status==="done").length;
   return {key:k,total,done,pct:total?Math.round(done/total*100):0};
 });

 return {r,planned,completed,plannedDone,open,overdue,moved,rate,areas};
}
function analyticsTrend(){
 const today=isoLocal(new Date()), current=weekRange(today).start;
 let cur=new Date(current+"T12:00:00");
 const rows=[];
 for(let i=5;i>=0;i--){
   let d=new Date(cur); d.setDate(d.getDate()-7*i);
   let start=isoLocal(d), wr=weekRange(start), end=wr.end;
   let planned=(state.tasks||[]).filter(t=>inDateRange(taskPlanDate(t),{start,end})).length;
   let done=(state.tasks||[]).filter(t=>t.status==="done"&&inDateRange(completedDate(t),{start,end})).length;
   rows.push({label:shortDate(start),planned,done,pct:planned?Math.round(done/planned*100):0});
 }
 return rows;
}
function analyticsAreaRow(a){
 const meta=AREAS[a.key]||AREAS.work;
 return `<div class="analyticsAreaRow"><div><span>${meta[0]} ${meta[1]}</span><small>${a.done}/${a.total} выполнено</small></div><div class="analyticsBar"><i style="width:${a.pct}%"></i></div><b>${a.pct}%</b></div>`;
}


function shiftRange(type,r){
 const s=new Date(r.start+"T12:00:00"), e=new Date(r.end+"T12:00:00");
 if(type==="week"){s.setDate(s.getDate()-7);e.setDate(e.getDate()-7)}
 else if(type==="month"){s.setMonth(s.getMonth()-1);e.setMonth(e.getMonth()-1)}
 else {s.setFullYear(s.getFullYear()-1);e.setFullYear(e.getFullYear()-1)}
 return {start:isoLocal(s),end:isoLocal(e)};
}
function analyticsPrevious(type){
 const current=rangeBounds(type), r=shiftRange(type,current), tasks=state.tasks||[];
 const planned=tasks.filter(t=>inDateRange(taskPlanDate(t),r));
 const done=planned.filter(t=>t.status==="done").length;
 const rate=planned.length?Math.round(done/planned.length*100):0;
 const now=analyticsFor(type).rate;
 const delta=now-rate;
 return {planned:planned.length,done,rate,delta,deltaText:planned.length?(delta>0?`+${delta}%`:delta<0?`${delta}%`:"0%"):"—"};
}
function analyticsInsight(a,prev){
 if(!a.planned.length)return "В этом периоде пока нет запланированных задач — добавь несколько карточек, и здесь появится сравнение.";
 const active=a.areas.filter(x=>x.total>0).sort((x,y)=>y.pct-x.pct);
 const best=active[0], weak=[...active].sort((x,y)=>x.pct-y.pct)[0];
 const bestMeta=best?(AREAS[best.key]||AREAS.work):null;
 const weakMeta=weak?(AREAS[weak.key]||AREAS.work):null;
 let first=prev.planned?`По сравнению с прошлым периодом выполнение ${prev.delta>0?"выше":prev.delta<0?"ниже":"на том же уровне"} (${a.rate}% против ${prev.rate}%).`:"Для сравнения с прошлым периодом пока недостаточно данных.";
 let second=bestMeta?` Сильнее всего сейчас: ${bestMeta[0]} ${bestMeta[1]} — ${best.pct}%.`:"";
 let third=weakMeta&&weak&&best&&weak.key!==best.key?` Больше внимания просит ${weakMeta[0]} ${weakMeta[1]} — ${weak.pct}%.`:"";
 return first+second+third;
}
function progress(){
 const rs=readingSummary(), a=analyticsFor(progressRange), trend=analyticsTrend();
 const areas=a.areas.filter(x=>x.total>0);
 shell(header("Прогресс","Аналитика выполнения и баланса")+`
 <section class="analyticsTabs">
   <button data-prange="week" class="${progressRange==="week"?"active":""}">Неделя</button>
   <button data-prange="month" class="${progressRange==="month"?"active":""}">Месяц</button>
   <button data-prange="year" class="${progressRange==="year"?"active":""}">Год</button>
 </section>

 <div class="sectionTitle"><h2>${a.r.label}</h2><span>планирование</span></div>
 <section class="analyticsHero card">
   <div class="analyticsRate"><strong>${a.rate}%</strong><span>выполнено из запланированного</span></div>
   <progress value="${a.rate}" max="100"></progress>
 </section>

 
 <section class="compareCard card">
   <div class="compareSide"><small>Текущий период</small><strong>${a.rate}%</strong><span>${a.planned.length} задач</span></div>
   <div class="compareDelta"><b>${analyticsPrevious(progressRange).deltaText}</b><span>к прошлому</span></div>
   <div class="compareSide right"><small>Прошлый период</small><strong>${analyticsPrevious(progressRange).rate}%</strong><span>${analyticsPrevious(progressRange).planned} задач</span></div>
 </section>
 <section class="insightCard card">
   <small>🧠 MYOS INSIGHT</small>
   <p>${analyticsInsight(a,analyticsPrevious(progressRange))}</p>
 </section>

 <section class="grid analyticsGrid">
   ${mini("📋 ЗАПЛАНИРОВАНО",""+a.planned.length,"за период")}
   ${mini("✅ ВЫПОЛНЕНО",""+a.plannedDone,"из плана")}
   ${mini("⏳ ОСТАЛОСЬ",""+a.open,"активных")}
   ${mini("🔁 ПЕРЕНОСИЛОСЬ",""+a.moved,"карточек")}
 </section>

 <div class="sectionTitle"><h2>По сферам</h2><span>${a.planned.length?"из задач периода":"нет задач"}</span></div>
 <section class="analyticsAreas card">
   ${areas.length?areas.map(analyticsAreaRow).join(""):'<small class="muted">Пока недостаточно данных для распределения.</small>'}
 </section>

 <div class="sectionTitle"><h2>Последние 6 недель</h2><span>динамика</span></div>
 <section class="trendCard card">
   ${trend.map(x=>`<div class="trendRow"><span>${x.label}</span><div class="trendTrack"><i style="width:${x.pct}%"></i></div><b>${x.done}/${x.planned}</b><em>${x.pct}%</em></div>`).join("")}
 </section>

 <div class="sectionTitle"><h2>Текущие сигналы</h2></div>
 <section class="analyticsSignals card">
   <div><span>⚠ Просрочено сейчас</span><b>${a.overdue}</b></div>
   <div><span>✅ Выполнено фактически за период</span><b>${a.completed.length}</b></div>
 </section>

 <div class="sectionTitle"><h2>Чтение</h2><span>сегодня</span></div>
 <section class="grid">${mini("📚 ПРОЧИТАНО",rs.done+" стр.","сегодня")}${mini("🎯 НОРМА",rs.target+" стр.","по всем книгам")}${mini("📘 КНИГ",""+state.books.length,"активных")}${mini("✅ ОСТАЛОСЬ",rs.left+" стр.","на сегодня")}</section>`);
 bindMode();
 document.querySelectorAll("[data-prange]").forEach(b=>b.onclick=()=>{progressRange=b.dataset.prange;progress()});
}
function area(n,v){return `<p><span>${n}</span><progress value="${v}" max="100"></progress><b>${v}</b></p>`}
function goalProgress(g){
 const cur=Number(g.current||0), target=Math.max(1,Number(g.target||100));
 return {pct:Math.min(100,Math.round(cur/target*100)),done:cur,total:target};
}
function goalAreaMeta(g){return AREAS[g.lifeArea]||AREAS.develop}
function goalStatusLabel(s){return ({active:"Активна",paused:"На паузе",done:"Выполнена"})[s]||"Активна"}
function goals(){
 let migratedGoalTasks=false;
 (state.tasks||[]).forEach(t=>{
   if(t.goalId && !t.horizon){t.horizon="inbox"; migratedGoalTasks=true}
   if(t.goalId && t.horizon==="inbox" && !t.planLevel){t.planLevel="inbox"; migratedGoalTasks=true}
 });
 if(migratedGoalTasks) save();
 const gs=state.goals||[], active=gs.filter(g=>g.status==="active").length, done=gs.filter(g=>g.status==="done").length;
 shell(header("Цели и приоритеты","Цель → задачи → план → результат")+`
 <section class="goalSummary card"><div><small>Активных</small><b>${active}</b></div><div><small>Выполнено</small><b>${done}</b></div><div><small>Всего целей</small><b>${gs.length}</b></div></section>
 <div class="sectionTitle"><h2>Новая цель</h2><span>измеримый результат</span></div>
 <section class="goalForm goalCreate card"><label class="goalField"><span>Название цели</span><input id="goalTitle" placeholder="Например: 30 подтягиваний"></label><div class="row2"><select id="goalArea">${Object.entries(AREAS).map(([k,a])=>`<option value="${k}">${a[0]} ${a[1]}</option>`).join("")}</select><select id="goalPriority"><option>Высокий</option><option selected>Обычный</option><option>Низкий</option></select></div><div class="row2"><label class="goalField"><span>Целевой результат</span><input id="goalTarget" type="number" min="1" value="30" placeholder="Например: 30"></label><label class="goalField"><span>Единица</span><input id="goalUnit" value="подтягиваний" placeholder="раз, кг, стр."></label></div><label class="goalField"><span>Срок</span><input id="goalDeadline" type="date"></label><button class="primary" id="goalAdd">＋ Создать цель</button></section>
 <div class="sectionTitle"><h2>Мои цели</h2><span>${gs.length}</span></div>
 <div>${gs.length?gs.map(goalCard).join(""):`<section class="goalEmpty card"><b>Пока нет целей</b><small>Создай первую — затем привяжем к ней конкретные задачи.</small></section>`}</div>
 <button class="primary" id="backMe" style="margin-top:14px">← Назад в «Я»</button>`);
 bindMode(); bindGoals();
}
function goalCard(g){
 const p=goalProgress(g), a=goalAreaMeta(g), linked=(state.tasks||[]).filter(t=>String(t.goalId||"")===String(g.id));
 return `<article class="goalCard card ${a[2]}"><div class="goalTop"><div><span class="areaTag ${a[2]}"><i></i>${a[0]} ${a[1]}</span><h3>${g.priority==="Высокий"?"🔥 ":""}${g.title}</h3><small>${goalStatusLabel(g.status)}${g.deadline?" · до "+shortDate(g.deadline):""}</small></div><span class="goalPct">${p.pct}%</span></div><progress value="${p.pct}" max="100"></progress><div class="goalMeta"><span>🎯 ${p.done}/${p.total} ${g.unit||"%"}</span><span>📋 ${linked.filter(t=>t.status==="done").length}/${linked.length} задач</span></div>${linked.length?`<div class="goalTaskList">${linked.slice(0,5).map(t=>`<p class="${t.status==="done"?"done":""}"><button type="button" class="goalTaskToggle" data-goaltoggle="${t.id}">${t.status==="done"?"✅":"○"} ${t.title}</button><small>${periodLabel(t)}</small></p>`).join("")}</div>`:""}<div class="goalActions"><button data-goaltask="${g.id}">＋ Задача</button>${linked.some(t=>t.horizon==="inbox"&&t.status!=="done")?`<button data-goalinbox="${g.id}">📥 Входящие</button>`:""}<button data-goalprogress="${g.id}">Изменить прогресс</button><button data-goalstatus="${g.id}">${g.status==="active"?"⏸ Пауза":"▶ Активировать"}</button><button data-goaldone="${g.id}">✓ Цель выполнена</button><button data-goaldelete="${g.id}">Удалить</button></div></article>`;
}
function bindGoals(){
 const back=document.getElementById("backMe"); if(back)back.onclick=()=>render("me");
 const add=document.getElementById("goalAdd"); if(add)add.onclick=()=>{const title=document.getElementById("goalTitle").value.trim();if(!title)return alert("Напиши цель.");state.goals.push({id:Date.now(),title,lifeArea:document.getElementById("goalArea").value,priority:document.getElementById("goalPriority").value,target:Number(document.getElementById("goalTarget").value)||100,current:0,unit:document.getElementById("goalUnit").value.trim()||"%",deadline:document.getElementById("goalDeadline").value||null,status:"active",created:new Date().toISOString()});save();goals()};
 document.querySelectorAll("[data-goaltask]").forEach(b=>b.onclick=()=>{const g=state.goals.find(x=>x.id==b.dataset.goaltask);if(!g)return;const title=prompt("Задача для цели «"+g.title+"»:");if(!title||!title.trim())return;state.tasks.push({area:g.area||"health",minutes:30,id:Date.now(),title:title.trim(),status:"todo",priority:g.priority||"Обычный",mins:60,lifeArea:g.lifeArea||"develop",goalId:g.id,planLevel:"inbox",horizon:"inbox",created:new Date().toISOString(),completed:null,waitingFor:"",planYear:calYear});save();alert("Задача добавлена во «Входящие» и связана с целью.");goals()});
 document.querySelectorAll("[data-goalinbox]").forEach(b=>b.onclick=()=>{horizonView="inbox";render("plan")});
 document.querySelectorAll("[data-goaltoggle]").forEach(b=>b.onclick=()=>{const t=(state.tasks||[]).find(x=>String(x.id)===String(b.dataset.goaltoggle));if(!t)return;t.status=t.status==="done"?"todo":"done";t.completed=t.status==="done"?new Date().toISOString():null;save();goals()});
 document.querySelectorAll("[data-goalprogress]").forEach(b=>b.onclick=()=>{const g=state.goals.find(x=>x.id==b.dataset.goalprogress);if(!g)return;const v=prompt(`Текущий результат (${g.unit||"%"}), цель ${g.target}:`,g.current||0);if(v===null)return;g.current=Math.max(0,Number(v)||0);if(g.current>=Number(g.target||100))g.status="done";save();goals()});
 document.querySelectorAll("[data-goalstatus]").forEach(b=>b.onclick=()=>{const g=state.goals.find(x=>x.id==b.dataset.goalstatus);if(!g)return;g.status=g.status==="active"?"paused":"active";save();goals()});
 document.querySelectorAll("[data-goaldone]").forEach(b=>b.onclick=()=>{const g=state.goals.find(x=>x.id==b.dataset.goaldone);if(!g)return;g.status="done";g.completed=new Date().toISOString();g.current=Math.max(Number(g.current||0),Number(g.target||100));save();goals()});
 document.querySelectorAll("[data-goaldelete]").forEach(b=>b.onclick=()=>{const id=b.dataset.goaldelete,g=state.goals.find(x=>x.id==id);if(g&&confirm("Удалить цель? Связанные задачи останутся в планировщике.")){state.goals=state.goals.filter(x=>x.id!=id);save();goals()}});
}


function esc(v){
 return String(v==null?"":v)
   .replace(/&/g,"&amp;")
   .replace(/</g,"&lt;")
   .replace(/>/g,"&gt;")
   .replace(/"/g,"&quot;")
   .replace(/'/g,"&#39;");
}
function ensureLanguages(){
 const defaults=[
   {id:"kk",name:"Казахский",flag:"🇰🇿",target:10,goal:"Свободнее говорить в жизни и на работе",history:{},notes:[]},
   {id:"en",name:"Английский",flag:"🇬🇧",target:10,goal:"Понимать речь, тексты и расширять словарь",history:{},notes:[]},
   {id:"zh",name:"Китайский",flag:"🇨🇳",target:10,goal:"Поддерживать и улучшать профессиональный уровень",history:{},notes:[]}
 ];
 const oldList=Array.isArray(state.languages)?state.languages:[];
 state.languages=defaults.map(d=>{
   const old=oldList.find(x=>x&&x.id===d.id)||{};
   const history=(old.history&&typeof old.history==="object"&&!Array.isArray(old.history))?old.history:{};
   const notes=Array.isArray(old.notes)?old.notes.filter(n=>n&&typeof n==="object").map(n=>({
     date:String(n.date||new Date().toISOString()),
     minutes:Math.max(1,Number(n.minutes)||1),
     text:String(n.text||"Практика")
   })).slice(0,50):[];
   return {...d,...old,target:Math.max(1,Number(old.target)||d.target),history,notes};
 });
}
function langToday(l){const h=(l&&l.history&&typeof l.history==="object")?l.history:{};return Number(h[keyToday()]||0)}
function langPct(l){return Math.min(100,Math.round(langToday(l)/Math.max(1,Number(l.target)||10)*100))}
function languageStreak(l){
 const h=l.history||{}; let n=0,d=new Date();
 for(let i=0;i<365;i++){
   const k=d.toISOString().slice(0,10);
   if(Number(h[k]||0)>0){n++;d.setDate(d.getDate()-1)}
   else break;
 }
 return n;
}
function langTotalToday(){ensureLanguages();return state.languages.reduce((a,l)=>a+langToday(l),0)}
function langDoneToday(){ensureLanguages();return state.languages.filter(l=>langToday(l)>=Number(l.target||10)).length}
function languageCard(l){
 const today=langToday(l), pct=langPct(l), streak=languageStreak(l);
 const last=(l.notes||[])[0];
 return `<article class="languageCard card">
   <div class="languageTop"><div><span class="languageFlag">${l.flag}</span><div><h3>${l.name}</h3><small>${l.goal||""}</small></div></div><b>${pct}%</b></div>
   <progress value="${pct}" max="100"></progress>
   <div class="languageMeta"><span>⏱ ${today}/${l.target} мин сегодня</span><span>🔥 ${streak} дн.</span></div>
   ${last?`<div class="languageLast"><small>Последняя запись</small><span>${esc(last.text)} · ${last.minutes} мин</span><button class="langDeleteLast" data-langdelete="${l.id}">Удалить запись</button></div>`:""}
   <div class="languageQuick">
     <button data-langadd="${l.id}" data-min="5">+5 мин</button>
     <button data-langadd="${l.id}" data-min="10">+10 мин</button>
     <button data-langsession="${l.id}">＋ Занятие</button>
   </div>
   <div class="languageActions">
     <button data-langplan="${l.id}">📥 В план</button>
     <button data-langfix="${l.id}">✏ Сегодня</button>
     <button data-langedit="${l.id}">⚙ Норма</button>
   </div>
   <div class="langForm" id="langform-${l.id}" data-mode="session" style="display:none">
     <small class="langFormTitle" id="langtitle-${l.id}">Новое занятие</small>
     <input id="langmin-${l.id}" type="number" min="0" value="${Number(l.target)||10}" inputmode="numeric" aria-label="Минуты">
     <input id="langnote-${l.id}" type="text" placeholder="Что делал: разговор, чтение, слова…" aria-label="Описание занятия">
     <div><button data-langcancel="${l.id}">Отмена</button><button data-langsave="${l.id}">Сохранить</button></div>
   </div>
 </article>`;
}
function languages(){
 ensureLanguages();
 const total=langTotalToday(), done=langDoneToday();
 shell(header("Языки","Казахский · Английский · Китайский")+`
 <section class="languageSummary card">
   <div><small>Сегодня</small><b>${total} мин</b></div>
   <div><small>Норма выполнена</small><b>${done}/3</b></div>
   <div><small>Фокус</small><b>🇰🇿 Казахский</b></div>
 </section>
 <div class="sectionTitle"><h2>Сегодня</h2><span>ежедневная практика</span></div>
 <div class="languageGrid">${state.languages.map(languageCard).join("")}</div>
 <section class="languageHint card">
   <b>Как пользоваться</b>
   <small>Фиксируй реальные минуты практики. «В план» создаёт обычную задачу во Входящих, которую можно провести через год → месяц → неделю → день.</small>
 </section>
 <button class="primary" id="backMeLang" style="margin-top:14px">← Назад в «Я»</button>`);
 bindMode(); bindLanguages();
}
function bindLanguages(){
 const back=document.getElementById("backMeLang"); if(back)back.onclick=()=>render("me");

 const openForm=(id,mode)=>{
   ensureLanguages();
   const l=state.languages.find(x=>x.id===id); if(!l)return;
   const f=document.getElementById("langform-"+id);
   const m=document.getElementById("langmin-"+id);
   const n=document.getElementById("langnote-"+id);
   const t=document.getElementById("langtitle-"+id);
   if(!f||!m)return;
   f.dataset.mode=mode;
   if(mode==="session"){
     m.min="1"; m.value=String(Number(l.target)||10);
     if(n){n.style.display="block";n.value=""}
     if(t)t.textContent="Новое занятие";
   }else if(mode==="fix"){
     m.min="0"; m.value=String(langToday(l));
     if(n)n.style.display="none";
     if(t)t.textContent="Исправить минуты за сегодня";
   }else if(mode==="norm"){
     m.min="1"; m.value=String(Number(l.target)||10);
     if(n)n.style.display="none";
     if(t)t.textContent="Ежедневная норма";
   }
   f.style.display="grid";
 };

 document.querySelectorAll("[data-langadd]").forEach(b=>b.onclick=()=>{
   ensureLanguages();
   const l=state.languages.find(x=>x.id===b.dataset.langadd); if(!l)return;
   const n=Number(b.dataset.min)||5;
   l.history[keyToday()]=langToday(l)+n;
   l.notes.unshift({date:new Date().toISOString(),minutes:n,text:`Быстрый учёт +${n}`});
   l.notes=l.notes.slice(0,50);
   save(); languages();
 });

 document.querySelectorAll("[data-langsession]").forEach(b=>b.onclick=()=>openForm(b.dataset.langsession,"session"));
 document.querySelectorAll("[data-langfix]").forEach(b=>b.onclick=()=>openForm(b.dataset.langfix,"fix"));
 document.querySelectorAll("[data-langedit]").forEach(b=>b.onclick=()=>openForm(b.dataset.langedit,"norm"));

 document.querySelectorAll("[data-langcancel]").forEach(b=>b.onclick=()=>{
   const f=document.getElementById("langform-"+b.dataset.langcancel);
   if(f)f.style.display="none";
 });

 document.querySelectorAll("[data-langsave]").forEach(b=>b.onclick=()=>{
   ensureLanguages();
   const id=b.dataset.langsave;
   const l=state.languages.find(x=>x.id===id); if(!l)return;
   const f=document.getElementById("langform-"+id);
   const m=document.getElementById("langmin-"+id);
   const n=document.getElementById("langnote-"+id);
   const mode=(f&&f.dataset.mode)||"session";

   if(mode==="norm"){
     l.target=Math.max(1,Number(m&&m.value)||10);
   }else if(mode==="fix"){
     l.history[keyToday()]=Math.max(0,Number(m&&m.value)||0);
   }else{
     const minutes=Math.max(1,Number(m&&m.value)||Number(l.target)||10);
     const text=((n&&n.value)||"").trim()||"Практика";
     l.history[keyToday()]=langToday(l)+minutes;
     l.notes.unshift({date:new Date().toISOString(),minutes,text});
     l.notes=l.notes.slice(0,50);
   }
   save(); languages();
 });

 document.querySelectorAll("[data-langdelete]").forEach(b=>b.onclick=()=>{
   ensureLanguages();
   const l=state.languages.find(x=>x.id===b.dataset.langdelete); if(!l||!l.notes.length)return;
   const last=l.notes[0];
   const lastKey=String(last.date||"").slice(0,10);
   if(lastKey===keyToday()){
     l.history[keyToday()]=Math.max(0,langToday(l)-Math.max(0,Number(last.minutes)||0));
   }
   l.notes.shift();
   save(); languages();
 });

 document.querySelectorAll("[data-langplan]").forEach(b=>b.onclick=()=>{
   ensureLanguages(); const l=state.languages.find(x=>x.id===b.dataset.langplan); if(!l)return;
   state.tasks=state.tasks||[];
   state.tasks.push({
     id:Date.now(),title:`${l.flag} ${l.name} — ${l.target} мин`,
     status:"todo",priority:"Обычный",mins:Number(l.target)||10,minutes:Number(l.target)||10,
     lifeArea:"lang",area:"Обучение",horizon:"inbox",planLevel:"inbox",
     created:new Date().toISOString(),completed:null,waitingFor:"",planYear:calYear
   });
   save(); alert(`Задача «${l.name} — ${l.target} мин» добавлена во «Входящие».`); languages();
 });
}


function ensureProfessional(){
 if(!state.professional||typeof state.professional!=="object")state.professional={};
 if(!Array.isArray(state.professional.tracks))state.professional.tracks=[
  {id:"oil",icon:"🛢️",name:"Нефтегаз",goal:"Углублять инженерные знания и разбор реальных работ"},
  {id:"management",icon:"📋",name:"ПТО и управление",goal:"Планирование, документы, договоры и организация работ"},
  {id:"fitness",icon:"🏋️",name:"Фитнес-тренер",goal:"Системно изучать тренировки и подготовку тренера"}
 ];
 if(!Array.isArray(state.professional.items))state.professional.items=[];
 if(!state.professional.knowledge||typeof state.professional.knowledge!=="object"){
   state.professional.knowledge={
     oil:[
       {id:"ct",name:"ГНКТ",icon:"🧰",topics:[
         {id:"gaslift",name:"Газлифт",blocks:[
           {id:"theory",name:"Теория"},
           {id:"equipment",name:"Оборудование / компоновка"},
           {id:"technology",name:"Технология работ"},
           {id:"calculations",name:"Расчёты"},
           {id:"cases",name:"Реальные кейсы"}
         ]},
         {id:"cleanout",name:"Промывка / фрезерование",blocks:[
           {id:"theory",name:"Теория"},{id:"equipment",name:"Оборудование"},{id:"technology",name:"Технология работ"},{id:"cases",name:"Реальные кейсы"}
         ]}
       ]},
       {id:"frac",name:"КРП",icon:"🧪",topics:[
         {id:"design",name:"Дизайн и технология",blocks:[
           {id:"theory",name:"Теория"},{id:"chemistry",name:"Химия"},{id:"calculations",name:"Расчёты"},{id:"cases",name:"Реальные кейсы"}
         ]}
       ]},
       {id:"well",name:"Скважины и оборудование",icon:"⚙️",topics:[
         {id:"completion",name:"Заканчивание / компоновка",blocks:[
           {id:"equipment",name:"Оборудование"},{id:"schemes",name:"Схемы"},{id:"cases",name:"Реальные кейсы"}
         ]}
       ]}
     ],
     management:[
       {id:"pto",name:"ПТО",icon:"📋",topics:[
         {id:"docs",name:"Документы и отчётность",blocks:[{id:"templates",name:"Шаблоны"},{id:"practice",name:"Практика"}]},
         {id:"planning",name:"Планирование работ",blocks:[{id:"theory",name:"Подходы"},{id:"practice",name:"Практика"}]}
       ]}
     ],
     fitness:[
       {id:"training",name:"Тренировочный процесс",icon:"🏋️",topics:[
         {id:"strength",name:"Силовая подготовка",blocks:[{id:"theory",name:"Теория"},{id:"programming",name:"Программирование"},{id:"practice",name:"Практика"}]},
         {id:"anatomy",name:"Анатомия и биомеханика",blocks:[{id:"theory",name:"Теория"},{id:"practice",name:"Практика"}]}
       ]}
     ]
   };
 }
 state.professional.items.forEach(x=>{
   if(x&&x.trackId==="oil"&&!x.knowledgePath&&/гнкт/i.test(String(x.title||""))&&/газлифт/i.test(String(x.title||""))){
     x.knowledgePath={areaId:"ct",topicId:"gaslift",blockId:"technology"};
   }
 });
}

function professionalTrack(id){
 ensureProfessional();
 return state.professional.tracks.find(x=>x.id===id);
}
function professionalItem(id){
 ensureProfessional();
 return state.professional.items.find(x=>String(x.id)===String(id));
}

function ensureProfessionalItemDetail(x){
 if(!x) return;
 if(typeof x.learningGoal!=="string") x.learningGoal=typeof x.note==="string"?x.note:"";
 if(typeof x.summary!=="string") x.summary="";
 if(typeof x.practice!=="string") x.practice="";
 if(typeof x.result!=="string") x.result="";
}
let profDetailId=null;

function linkedProfessionalTask(itemId){
 return (state.tasks||[]).find(t=>String(t.professionalItemId||"")===String(itemId));
}
function syncProfessionalFromTask(t){
 if(!t || !t.professionalItemId) return;
 const x=professionalItem(t.professionalItemId);
 if(!x) return;
 const done=t.status==="done";
 x.status=done?"done":"todo";
 x.completed=done?(t.completed||new Date().toISOString()):null;
}
function setProfessionalItemStatus(x,status){
 if(!x) return;
 const done=status==="done";
 x.status=done?"done":"todo";
 x.completed=done?new Date().toISOString():null;
 const t=linkedProfessionalTask(x.id);
 if(t){
   t.status=done?"done":"todo";
   t.completed=done?x.completed:null;
 }
}
function sendProfessionalItemToPlanner(itemId){
 ensureProfessional();
 const x=professionalItem(itemId); if(!x) return false;
 const existing=linkedProfessionalTask(x.id);
 if(existing){
   alert(`«${x.title}» уже связано с Планировщиком.`);
   return false;
 }
 const tr=professionalTrack(x.trackId);
 const task={
   id:Date.now(),
   title:`${tr?tr.icon:"🛢️"} ${x.title}`,
   status:x.status==="done"?"done":"todo",
   priority:"Обычный",
   mins:30,minutes:30,
   lifeArea:"work",area:"Работа",
   horizon:x.status==="done"?"inbox":"inbox",
   planLevel:"inbox",
   created:new Date().toISOString(),
   completed:x.status==="done"?(x.completed||new Date().toISOString()):null,
   waitingFor:"",
   planYear:calYear,
   professionalItemId:x.id,
   professionalTrackId:x.trackId
 };
 state.tasks=state.tasks||[];
 state.tasks.push(task);
 return true;
}



function knowledgeAreas(trackId){
 ensureProfessional();
 return Array.isArray(state.professional.knowledge[trackId])?state.professional.knowledge[trackId]:[];
}
function knowledgeArea(trackId,areaId){
 return knowledgeAreas(trackId).find(x=>x.id===areaId);
}
function knowledgeTopic(trackId,areaId,topicId){
 const a=knowledgeArea(trackId,areaId);
 return a&&Array.isArray(a.topics)?a.topics.find(x=>x.id===topicId):null;
}
function knowledgeBlock(trackId,areaId,topicId,blockId){
 const t=knowledgeTopic(trackId,areaId,topicId);
 return t&&Array.isArray(t.blocks)?t.blocks.find(x=>x.id===blockId):null;
}
function knowledgePathLabel(x){
 if(!x||!x.knowledgePath)return "";
 const p=x.knowledgePath,a=knowledgeArea(x.trackId,p.areaId),t=knowledgeTopic(x.trackId,p.areaId,p.topicId),b=knowledgeBlock(x.trackId,p.areaId,p.topicId,p.blockId);
 return [a&&a.name,t&&t.name,b&&b.name].filter(Boolean).join(" → ");
}
let profKnowledgeView={trackId:null,areaId:null,topicId:null};

function professionalKnowledge(trackId,areaId=null,topicId=null){
 ensureProfessional();
 const tr=professionalTrack(trackId); if(!tr){professional();return}
 profKnowledgeView={trackId,areaId,topicId};
 const items=state.professional.items.filter(x=>x.trackId===trackId);
 let body="";
 if(!areaId){
   body=knowledgeAreas(trackId).map(a=>{
     const own=items.filter(x=>x.knowledgePath&&x.knowledgePath.areaId===a.id);
     const done=own.filter(x=>x.status==="done").length;
     const pct=own.length?Math.round(done/own.length*100):0;
     return `<button class="knowledgeNode" data-karea="${a.id}">
       <span class="knowledgeIcon">${a.icon||"📚"}</span>
       <span><b>${esc(a.name)}</b><small>${own.length} тем · ${pct}% выполнено</small></span>
       <strong>→</strong>
     </button>`;
   }).join("")||`<div class="emptyKnowledge">Структура пока не настроена</div>`;
 }else if(!topicId){
   const a=knowledgeArea(trackId,areaId); if(!a){professionalKnowledge(trackId);return}
   body=`<div class="knowledgeCrumb">${tr.icon} ${esc(tr.name)} → ${esc(a.name)}</div>`+
   (a.topics||[]).map(t=>{
     const own=items.filter(x=>x.knowledgePath&&x.knowledgePath.areaId===a.id&&x.knowledgePath.topicId===t.id);
     const done=own.filter(x=>x.status==="done").length;
     const pct=own.length?Math.round(done/own.length*100):0;
     return `<button class="knowledgeNode" data-ktopic="${t.id}">
       <span class="knowledgeIcon">📘</span>
       <span><b>${esc(t.name)}</b><small>${own.length} элементов · ${pct}% выполнено</small></span>
       <strong>→</strong>
     </button>`;
   }).join("");
 }else{
   const a=knowledgeArea(trackId,areaId),t=knowledgeTopic(trackId,areaId,topicId);
   if(!a||!t){professionalKnowledge(trackId,areaId);return}
   body=`<div class="knowledgeCrumb">${tr.icon} ${esc(tr.name)} → ${esc(a.name)} → ${esc(t.name)}</div>`+
   (t.blocks||[]).map(b=>{
     const own=items.filter(x=>x.knowledgePath&&x.knowledgePath.areaId===a.id&&x.knowledgePath.topicId===t.id&&x.knowledgePath.blockId===b.id);
     const done=own.filter(x=>x.status==="done").length;
     return `<section class="knowledgeBlock card">
       <div class="knowledgeBlockHead"><div><small>БЛОК</small><h3>${esc(b.name)}</h3></div><b>${done}/${own.length}</b></div>
       <div class="knowledgeBlockItems">${own.map(x=>`<button data-profopen="${x.id}" class="${x.status==="done"?"done":""}">${x.status==="done"?"✓":"○"} ${esc(x.title)} <span>→</span></button>`).join("")||`<small class="muted">Пока пусто</small>`}</div>
       <button class="knowledgeAdd" data-kadd="${b.id}">＋ Добавить в этот блок</button>
     </section>`;
   }).join("");
 }
 shell(`<section class="screen knowledgeScreen">
   <div class="screenTop"><button id="backKnowledge" class="backBtn">← Назад</button><div><small>V0.15</small><h2>🗂 Структура знаний</h2></div></div>
   <div class="knowledgeTrack card"><small>НАПРАВЛЕНИЕ</small><h3>${tr.icon} ${esc(tr.name)}</h3><p>${esc(tr.goal)}</p></div>
   <div class="knowledgeBody">${body}</div>
   <div class="profForm card" id="knowledgeForm" style="display:none">
     <h3 id="knowledgeFormTitle">Новый элемент</h3>
     <input id="knowledgeTitle" type="text" placeholder="Название темы или навыка">
     <select id="knowledgeType"><option value="study">Обучение</option><option value="practice">Практика</option><option value="material">Материал</option></select>
     <textarea id="knowledgeNote" rows="3" placeholder="Цель / чему хочу научиться"></textarea>
     <div><button id="knowledgeCancel">Отмена</button><button id="knowledgeSave">Сохранить</button></div>
   </div>
 </section>`);
 bindMode(); bindProfessionalKnowledge();
}
let profKnowledgeDraftBlock=null;
function bindProfessionalKnowledge(){
 const back=document.getElementById("backKnowledge"); if(back)back.onclick=()=>{
   const v=profKnowledgeView;
   if(v.topicId)professionalKnowledge(v.trackId,v.areaId);
   else if(v.areaId)professionalKnowledge(v.trackId);
   else professional();
 };
 document.querySelectorAll("[data-karea]").forEach(b=>b.onclick=()=>professionalKnowledge(profKnowledgeView.trackId,b.dataset.karea));
 document.querySelectorAll("[data-ktopic]").forEach(b=>b.onclick=()=>professionalKnowledge(profKnowledgeView.trackId,profKnowledgeView.areaId,b.dataset.ktopic));
 document.querySelectorAll("[data-profopen]").forEach(b=>b.onclick=()=>professionalDetail(b.dataset.profopen));
 document.querySelectorAll("[data-kadd]").forEach(b=>b.onclick=()=>{
   profKnowledgeDraftBlock=b.dataset.kadd;
   const block=knowledgeBlock(profKnowledgeView.trackId,profKnowledgeView.areaId,profKnowledgeView.topicId,profKnowledgeDraftBlock);
   const f=document.getElementById("knowledgeForm"); if(!f)return;
   document.getElementById("knowledgeFormTitle").textContent=`Новый элемент · ${block?block.name:"блок"}`;
   document.getElementById("knowledgeTitle").value="";
   document.getElementById("knowledgeNote").value="";
   f.style.display="grid";
 });
 const cancel=document.getElementById("knowledgeCancel"); if(cancel)cancel.onclick=()=>{const f=document.getElementById("knowledgeForm");if(f)f.style.display="none";profKnowledgeDraftBlock=null};
 const saveBtn=document.getElementById("knowledgeSave"); if(saveBtn)saveBtn.onclick=()=>{
   const title=(document.getElementById("knowledgeTitle").value||"").trim(); if(!title)return;
   state.professional.items.unshift({
     id:Date.now(),trackId:profKnowledgeView.trackId,title,
     type:document.getElementById("knowledgeType").value||"study",
     note:(document.getElementById("knowledgeNote").value||"").trim(),
     status:"todo",created:new Date().toISOString(),
     knowledgePath:{areaId:profKnowledgeView.areaId,topicId:profKnowledgeView.topicId,blockId:profKnowledgeDraftBlock}
   });
   save(); professionalKnowledge(profKnowledgeView.trackId,profKnowledgeView.areaId,profKnowledgeView.topicId);
 };
}

function professionalDetail(itemId){
 ensureProfessional();
 const x=professionalItem(itemId); if(!x){professional();return}
 ensureProfessionalItemDetail(x);
 profDetailId=x.id;
 const tr=professionalTrack(x.trackId);
 const linked=linkedProfessionalTask(x.id);
 const typeLabel=x.type==="study"?"Обучение":x.type==="practice"?"Практика":"Материал";
 shell(`<section class="screen professionalDetailScreen">
   <div class="screenTop"><button id="backProfessional" class="backBtn">← Профразвитие</button><div><small>V0.15</small><h2>${tr?tr.icon:"🛢️"} ${esc(x.title)}</h2></div></div>
   <div class="profDetailMeta card">
     <div><small>НАПРАВЛЕНИЕ</small><b>${tr?esc(tr.name):"Профразвитие"}</b></div>
     <div><small>ТИП</small><b>${typeLabel}</b></div>
     <div><small>СТАТУС</small><b>${x.status==="done"?"✓ Завершено":"○ В работе"}</b></div>
   </div>
   ${knowledgePathLabel(x)?`<div class="knowledgeBreadcrumb card"><small>СТРУКТУРА ЗНАНИЙ</small><b>${esc(knowledgePathLabel(x))}</b></div>`:""}

   <section class="profDetailCard card">
     <h3>🎯 Цель изучения</h3>
     <textarea id="profLearningGoal" rows="3" placeholder="Что именно хочу понять или уметь">${esc(x.learningGoal)}</textarea>
   </section>

   <section class="profDetailCard card">
     <h3>📝 Заметки / конспект</h3>
     <textarea id="profSummary" rows="5" placeholder="Ключевые мысли, схемы, термины, выводы">${esc(x.summary)}</textarea>
   </section>

   <section class="profDetailCard card">
     <h3>🛠 Практика</h3>
     <textarea id="profPractice" rows="4" placeholder="Где применил или как хочу отработать на практике">${esc(x.practice)}</textarea>
   </section>

   <section class="profDetailCard card">
     <h3>🏁 Результат</h3>
     <textarea id="profResult" rows="4" placeholder="Чему научился, что теперь могу сделать">${esc(x.result)}</textarea>
   </section>

   <div class="profDetailActions">
     <button id="profDetailSave" class="primaryAction">Сохранить карточку</button>
     <button id="profDetailToggle">${x.status==="done"?"↩ Вернуть в работу":"✓ Завершить"}</button>
     <button id="profDetailPlan" class="${linked?"linked":""}">${linked?"🔗 Уже в плане":"📥 В план"}</button>
   </div>
 </section>`);
 bindMode(); bindProfessionalDetail();
}
function bindProfessionalDetail(){
 const back=document.getElementById("backProfessional"); if(back)back.onclick=()=>professional();
 const saveBtn=document.getElementById("profDetailSave"); if(saveBtn)saveBtn.onclick=()=>{
   const x=professionalItem(profDetailId); if(!x)return;
   ensureProfessionalItemDetail(x);
   x.learningGoal=(document.getElementById("profLearningGoal").value||"").trim();
   x.summary=(document.getElementById("profSummary").value||"").trim();
   x.practice=(document.getElementById("profPractice").value||"").trim();
   x.result=(document.getElementById("profResult").value||"").trim();
   save(); professionalDetail(x.id);
 };
 const toggle=document.getElementById("profDetailToggle"); if(toggle)toggle.onclick=()=>{
   const x=professionalItem(profDetailId); if(!x)return;
   setProfessionalItemStatus(x,x.status==="done"?"todo":"done");
   save(); professionalDetail(x.id);
 };
 const plan=document.getElementById("profDetailPlan"); if(plan)plan.onclick=()=>{
   const x=professionalItem(profDetailId); if(!x)return;
   if(sendProfessionalItemToPlanner(x.id)){
     save();
     alert(`«${x.title}» добавлено во «Входящие» и связано с Профразвитием.`);
     professionalDetail(x.id);
   }
 };
}

function professional(){
 ensureProfessional();
 (state.tasks||[]).filter(t=>t.professionalItemId).forEach(syncProfessionalFromTask);
 const items=state.professional.items,total=items.length,done=items.filter(x=>x.status==="done").length;
 const cards=state.professional.tracks.map(t=>{
  const own=items.filter(x=>x.trackId===t.id),od=own.filter(x=>x.status==="done").length,pct=own.length?Math.round(od/own.length*100):0;
  return `<article class="profCard"><div class="profHead"><div><h3>${t.icon} ${esc(t.name)}</h3><p>${esc(t.goal)}</p></div><b>${pct}%</b></div>
  <div class="languageBar"><i style="width:${pct}%"></i></div><div class="profStats"><span>${od}/${own.length} завершено</span><span>${own.length-od} открыто</span></div>
  <div class="profItems">${own.slice(0,6).map(x=>{
   const linked=linkedProfessionalTask(x.id);
   return `<div class="profItemRow ${x.status==="done"?"done":""}">
     <button class="profStatusBtn" data-proftoggle="${x.id}" aria-label="${x.status==="done"?"Вернуть":"Отметить выполненным"}">${x.status==="done"?"✓":"○"}</button>
     <button class="profItemMain" data-profopen="${x.id}">
       <span>${esc(x.title)}</span>
       <small>${x.type==="study"?"Обучение":x.type==="practice"?"Практика":"Материал"} · открыть →</small>
     </button>
     <button class="profItemPlan ${linked?"linked":""}" data-profitemplan="${x.id}">${linked?"🔗 В плане":"📥 В план"}</button>
   </div>`;
  }).join("")||`<small class="muted">Пока нет элементов</small>`}</div>
  <div class="languageActions"><button data-profadd="${t.id}">＋ Добавить</button><button data-profknowledge="${t.id}">🗂 Структура</button></div></article>`;
 }).join("");
 shell(`<section class="screen professionalScreen"><div class="screenTop"><button id="backMeProf" class="backBtn">← Я</button><div><small>V0.15</small><h2>🛢️ Профессиональное развитие</h2></div></div>
 <div class="profSummary card"><div><small>ВСЕГО</small><b>${total}</b></div><div><small>ЗАВЕРШЕНО</small><b>${done}</b></div><div><small>ПРОГРЕСС</small><b>${total?Math.round(done/total*100):0}%</b></div></div>
 <p class="sectionLead">Знания → практика → задача → результат. Обучение можно связать с Планировщиком MyOS.</p><div class="profGrid">${cards}</div>
 <div class="profForm card" id="profForm" style="display:none"><h3 id="profFormTitle">Новый элемент</h3><input id="profTitle" type="text" placeholder="Что изучить или отработать"><select id="profType"><option value="study">Обучение</option><option value="practice">Практика</option><option value="material">Материал</option></select><textarea id="profNote" rows="3" placeholder="Заметка / чему хочу научиться"></textarea><div><button id="profCancel">Отмена</button><button id="profSave">Сохранить</button></div></div>
 <button id="backMeProfBottom" class="primaryBack">← Назад в «Я»</button></section>`);
 bindMode(); bindProfessional();
}
let profTrackDraft=null;
function bindProfessional(){
 const back=()=>render("me"); const a=document.getElementById("backMeProf");if(a)a.onclick=back;const z=document.getElementById("backMeProfBottom");if(z)z.onclick=back;
 document.querySelectorAll("[data-profknowledge]").forEach(b=>b.onclick=()=>professionalKnowledge(b.dataset.profknowledge));
 document.querySelectorAll("[data-profadd]").forEach(b=>b.onclick=()=>{ensureProfessional();profTrackDraft=b.dataset.profadd;const t=state.professional.tracks.find(x=>x.id===profTrackDraft),f=document.getElementById("profForm");if(!f)return;document.getElementById("profFormTitle").textContent=`${t.icon} ${t.name} — новый элемент`;document.getElementById("profTitle").value="";document.getElementById("profNote").value="";f.style.display="grid"});
 const c=document.getElementById("profCancel");if(c)c.onclick=()=>{document.getElementById("profForm").style.display="none";profTrackDraft=null};
 const sv=document.getElementById("profSave");if(sv)sv.onclick=()=>{ensureProfessional();const title=(document.getElementById("profTitle").value||"").trim();if(!title)return;state.professional.items.unshift({id:Date.now(),trackId:profTrackDraft||"oil",title,type:document.getElementById("profType").value||"study",note:(document.getElementById("profNote").value||"").trim(),status:"todo",created:new Date().toISOString()});save();professional()};
 document.querySelectorAll("[data-profopen]").forEach(b=>b.onclick=()=>{
   const x=professionalItem(b.dataset.profopen); if(!x)return;
   professionalDetail(x.id);
 });
 document.querySelectorAll("[data-proftoggle]").forEach(b=>b.onclick=()=>{
   ensureProfessional();
   const x=professionalItem(b.dataset.proftoggle); if(!x)return;
   setProfessionalItemStatus(x,x.status==="done"?"todo":"done");
   save(); professional();
 });
 document.querySelectorAll("[data-profitemplan]").forEach(b=>b.onclick=()=>{
   const x=professionalItem(b.dataset.profitemplan); if(!x)return;
   if(sendProfessionalItemToPlanner(x.id)){
     save();
     alert(`«${x.title}» добавлено во «Входящие» и связано с Профразвитием.`);
     professional();
   }
 });
}


function ensureWorkContracts(){
 if(!state.work) state.work={contracts:[],projects:[],jobs:[],stock:[]};
 state.work.contracts=state.work.contracts||[];
 const known=[
  {id:"contract-1607R",number:"1607Р",date:"2026-05-28",type:"Химреагенты для КРП",status:"active",verified:true,positions:[
   {name:"Загуститель",unit:"т",limit:8.4,used:0},
   {name:"Ингибитор коррозии",unit:"т",limit:33.6,used:0},
   {name:"Стабилизатор ионов железа",unit:"т",limit:5.04,used:0},
   {name:"Ускоритель выпуска",unit:"т",limit:7.56,used:0},
   {name:"Деэмульгатор",unit:"т",limit:6.72,used:0},
   {name:"Пенообразователь / ПАВ",unit:"т",limit:3.36,used:0}
  ],contractLimitMoney:177460308},
  {id:"contract-1392R",number:"1392Р",date:"2026-05-04",type:"Договор",status:"active",verified:false,positions:[]},
  {id:"contract-1011R",number:"1011Р",date:"2026-03-19",type:"Договор",status:"active",verified:false,positions:[]},
  {id:"contract-2875R",number:"2875Р",date:"2025-12-30",type:"Договор",status:"active",verified:false,positions:[]}
 ];
 let changed=false;
 known.forEach(k=>{if(!state.work.contracts.some(x=>x.id===k.id||x.number===k.number)){state.work.contracts.push(k);changed=true}});
 if(changed) save();
}
function ensureWorkProjects(){
 ensureWorkContracts();
 state.work.projects=state.work.projects||[];
 const project5220={id:"project-5220-20260422",well:"5220",title:"КРП скважины 5220с",date:"2026-04-22",operation:"Поинтервальная кислотная обработка / КРП",contractId:"contract-1607R",status:"active",verified:true,version:"22.04.2026",requirements:[
  {contractName:"Ингибитор коррозии",projectName:"HAY-06 缓蚀剂",qty:6.3,unit:"т",supplier:"Подрядчик"},
  {contractName:"Стабилизатор ионов железа",projectName:"HY-3 铁离子稳定剂",qty:1.26,unit:"т",supplier:"Подрядчик"},
  {contractName:"Загуститель",projectName:"HY-2 增稠剂",qty:1.575,unit:"т",supplier:"Подрядчик"},
  {contractName:"Деэмульгатор",projectName:"HY-4 破乳剂",qty:1.68,unit:"т",supplier:"Подрядчик"},
  {contractName:"Ускоритель выпуска",projectName:"HY-8 助排剂",qty:2.1,unit:"т",supplier:"Подрядчик"},
  {contractName:"Пенообразователь / ПАВ",projectName:"起泡剂",qty:0.84,unit:"т",supplier:"Подрядчик"}
 ],customerMaterials:[{name:"Соляная кислота HCl 23%",qty:364,unit:"т",supplier:"Заказчик"}],note:"Проектная потребность. Не считается фактическим расходом договора до подтверждения выполненной работы / акта."};
 if(!state.work.projects.some(x=>x.id===project5220.id||x.well==="5220")){state.work.projects.push(project5220);save()}
}
function workStat(icon,label,value,sub){
 return `<article class="workStat card"><span>${icon}</span><div><small>${label}</small><b>${value}</b><em>${sub}</em></div></article>`
}
function work(){
 ensureWorkProjects();
 const w=state.work||{contracts:[],projects:[],jobs:[],stock:[]};
 const activeContracts=(w.contracts||[]).filter(x=>x.status!=="closed").length;
 const activeProjects=(w.projects||[]).filter(x=>x.status!=="closed").length;
 const activeJobs=(w.jobs||[]).filter(x=>x.status!=="closed").length;
 const stockNames=new Set((w.stock||[]).map(x=>x.materialId||x.name).filter(Boolean)).size;
 shell(header("Работа","Договоры · проекты · скважины · склад")+`
 <section class="workHero card"><span class="kicker">РАБОЧАЯ СИСТЕМА</span><h2>От договора до закрытия работы</h2><p>Связываем договор, проект, скважину, материалы, фактическую выдачу со склада и акт выполненных работ.</p></section>
 <div class="workStats">${workStat("📑","Активные договоры",activeContracts,"договорные лимиты")}${workStat("📋","Проекты",activeProjects,"версии и потребность")}${workStat("🛢️","Работы",activeJobs,"скважины / операции")}${workStat("📦","Склад",stockNames,"позиций в учёте")}</div>
 <div class="sectionTitle"><h2>Разделы</h2><span>можно дополнять</span></div>
 <section class="workMenu">
 <button data-work-section="contracts"><span class="workIcon">📑</span><span><b>Договоры</b><small>Номер, срок, заказчик, позиции, лимиты и остаток по договору</small></span><i>›</i></button>
 <button data-work-section="projects"><span class="workIcon">📋</span><span><b>Проекты</b><small>Проект по скважине, версии, требуемая химия, проппант и оборудование</small></span><i>›</i></button>
 <button data-work-section="jobs"><span class="workIcon">🛢️</span><span><b>Работы / скважины</b><small>Договор → проект → резерв → отгрузка → факт → акт</small></span><i>›</i></button>
 <button data-work-section="stock"><span class="workIcon">📦</span><span><b>Склад</b><small>Физический остаток, резерв, вывоз, возврат и доступный объём</small></span><i>›</i></button></section>
 <section class="workNote card"><span class="kicker">ВАЖНО</span><b>Основное название материала — из договора.</b><p>Названия из проекта, акта, китайские марки и внутренние обозначения храним как соответствия одной договорной позиции.</p></section>`);
 bindMode(); document.querySelectorAll("[data-work-section]").forEach(b=>b.onclick=()=>workSection(b.dataset.workSection));
}
function fmtContractDate(x){if(!x)return "—";const d=new Date(x+"T12:00:00");return d.toLocaleDateString("ru-RU")}
function contractCard(c){
 const total=(c.positions||[]).reduce((a,p)=>a+(+p.limit||0),0),used=(c.positions||[]).reduce((a,p)=>a+(+p.used||0),0);
 return `<button class="contractCard card" data-contract="${c.id}"><div class="contractTop"><span>📑</span><div><small>ДОГОВОР</small><h3>№${c.number}</h3><p>от ${fmtContractDate(c.date)} · ${c.type||"Договор"}</p></div><i>›</i></div>${c.verified?`<div class="contractNumbers"><span><small>Позиций</small><b>${c.positions.length}</b></span><span><small>Лимит химии</small><b>${total.toLocaleString("ru-RU")} т</b></span><span><small>Использовано</small><b>${used.toLocaleString("ru-RU")} т</b></span></div><div class="contractBadge ok">✓ позиции проверены</div>`:`<div class="contractBadge pending">Документы есть · позиции ещё сопоставляем</div>`}</button>`
}
function contractsScreen(){
 ensureWorkContracts(); const a=state.work.contracts||[];
 shell(`<section class="screen workSectionScreen"><div class="screenTop"><button id="backWork" class="backBtn">← Работа</button><div><small>MYOS · V0.19.1</small><h2>📑 Договоры</h2></div></div><p class="sectionLead">Договор — главный источник официальных названий и лимитов.</p><section class="contractList">${a.map(contractCard).join("")}</section><button class="workPrimary" id="addContract">＋ Добавить договор</button><small class="workComing">Новые договоры можно добавлять по мере появления. Позиции без подтверждения документами не считаются расходом.</small></section>`);
 document.getElementById("backWork").onclick=()=>work();
 document.querySelectorAll("[data-contract]").forEach(b=>b.onclick=()=>contractDetail(b.dataset.contract));
 document.getElementById("addContract").onclick=()=>alert("Следующим шагом подключим форму ручного добавления договора и загрузку его позиций.");
}
function contractDetail(id){
 ensureWorkContracts(); const c=state.work.contracts.find(x=>x.id===id); if(!c)return contractsScreen();
 const ps=c.positions||[], total=ps.reduce((a,p)=>a+(+p.limit||0),0), used=ps.reduce((a,p)=>a+(+p.used||0),0);
 shell(`<section class="screen workSectionScreen"><div class="screenTop"><button id="backContracts" class="backBtn">← Договоры</button><div><small>MYOS · V0.19.1</small><h2>№${c.number}</h2></div></div>
 <section class="contractHero card"><span class="kicker">${c.verified?"ПРОВЕРЕНО ПО ДОКУМЕНТАМ":"КАРТОЧКА ДОГОВОРА"}</span><h3>${c.type||"Договор"}</h3><p>Дата: ${fmtContractDate(c.date)}</p>${c.contractLimitMoney?`<p>Лимит договора без НДС: <b>${c.contractLimitMoney.toLocaleString("ru-RU")} ₸</b></p>`:""}</section>
 ${c.verified?`<div class="contractSummary card"><div><small>Позиций</small><b>${ps.length}</b></div><div><small>Лимит химии</small><b>${total.toLocaleString("ru-RU")} т</b></div><div><small>Остаток</small><b>${(total-used).toLocaleString("ru-RU")} т</b></div></div><div class="sectionTitle"><h2>Позиции договора</h2></div><section class="contractPositions">${ps.map(p=>{const r=(+p.limit||0)-(+p.used||0),pct=p.limit?Math.min(100,Math.round((+p.used||0)/p.limit*100)):0;return `<article class="contractPosition card"><div><b>${p.name}</b><small>${p.unit}</small></div><div class="positionNums"><span>Лимит <b>${(+p.limit).toLocaleString("ru-RU")}</b></span><span>Исп. <b>${(+p.used||0).toLocaleString("ru-RU")}</b></span><span>Ост. <b>${r.toLocaleString("ru-RU")}</b></span></div><div class="positionBar"><i style="width:${pct}%"></i></div></article>`}).join("")}</section>`:`<section class="workEmpty card"><span class="workEmptyIcon">📄</span><h3>Договор найден</h3><p>Номер и дата уже занесены. Позиции и лимиты добавим только после проверки самого договора и связанных актов.</p></section>`}
 ${(()=>{ensureWorkProjects();const linked=(state.work.projects||[]).filter(x=>x.contractId===c.id);return linked.length?`<div class="sectionTitle"><h2>Связанные проекты</h2></div><section class="projectList">${linked.map(projectCard).join("")}</section>`:""})()}
 </section>`);
 document.getElementById("backContracts").onclick=()=>contractsScreen();
 document.querySelectorAll("[data-project]").forEach(b=>b.onclick=()=>projectDetail(b.dataset.project));
}
function projectCard(p){
 const c=(state.work.contracts||[]).find(x=>x.id===p.contractId);
 const qty=(p.requirements||[]).reduce((a,x)=>a+(+x.qty||0),0);
 return `<button class="contractCard card projectCard" data-project="${p.id}"><div class="contractTop"><span>📋</span><div><small>СКВАЖИНА</small><h3>№${p.well}</h3><p>${p.operation||"Проект"} · версия ${p.version||"—"}</p></div><i>›</i></div><div class="contractNumbers"><span><small>Договор</small><b>${c?"№"+c.number:"—"}</b></span><span><small>Наших позиций</small><b>${(p.requirements||[]).length}</b></span><span><small>Потребность</small><b>${qty.toLocaleString("ru-RU")} т</b></span></div><div class="contractBadge ok">✓ проект сопоставлен с договором</div></button>`
}
function projectsScreen(){
 ensureWorkProjects(); const a=state.work.projects||[];
 shell(`<section class="screen workSectionScreen"><div class="screenTop"><button id="backWork" class="backBtn">← Работа</button><div><small>MYOS · V0.19.1</small><h2>📋 Проекты</h2></div></div><p class="sectionLead">Проект показывает потребность по скважине. Это ещё не фактическое списание.</p><section class="projectList">${a.map(projectCard).join("")}</section><button class="workPrimary" id="addProject">＋ Добавить проект</button></section>`);
 document.getElementById("backWork").onclick=()=>work();
 document.querySelectorAll("[data-project]").forEach(b=>b.onclick=()=>projectDetail(b.dataset.project));
 document.getElementById("addProject").onclick=()=>alert("Следующим этапом подключим добавление новых проектов и версий.");
}
function ensureWorkStock(){
 ensureWorkProjects(); state.work.stock=state.work.stock||[];
 const defs=(state.work.contracts.find(x=>x.id==="contract-1607R")||{}).positions||[];
 defs.forEach(p=>{if(!state.work.stock.some(x=>x.name===p.name)) state.work.stock.push({id:"stock-"+p.name.toLowerCase().replace(/[^a-zа-я0-9]+/gi,"-"),name:p.name,packType:p.name==="Загуститель"?"bag":"drum",fullDrums:0,partialLiters:0,bags:0,partialKg:0,drumLiters:p.name==="Загуститель"?null:200,drumKg:p.name==="Ингибитор коррозии"?200:null,bagKg:p.name==="Загуститель"?25:null})});
 // Packaging migration: all liquid chemistry uses 200 L drums; thickener uses 25 kg bags.
 state.work.stock.forEach(x=>{if(x.name==="Загуститель"){x.packType="bag";x.bagKg=25;x.drumLiters=null;x.drumKg=null;}else{x.packType="drum";x.drumLiters=200;}});
}
function stockItem(name){ensureWorkStock();return state.work.stock.find(x=>x.name===name)}
function drumCalc(reqTon,st){
 if(!st||!st.drumKg||!st.drumLiters)return null;
 const kg=reqTon*1000, full=Math.floor(kg/st.drumKg), remKg=Math.round((kg-full*st.drumKg)*1000)/1000;
 const liters=Math.round((remKg/(st.drumKg/st.drumLiters))*10)/10;
 return {full,liters,total:full+(liters>0?1:0),kg};
}
function projectDetail(id){
 ensureWorkProjects(); ensureWorkStock(); const p=state.work.projects.find(x=>x.id===id); if(!p)return projectsScreen();
 const c=state.work.contracts.find(x=>x.id===p.contractId);
 const rows=(p.requirements||[]).map(r=>{const cp=c&&(c.positions||[]).find(x=>x.name===r.contractName),remain=cp?(+cp.limit||0)-(+cp.used||0):null,enough=remain==null?null:remain>=r.qty,st=stockItem(r.contractName),dc=packCalc(r.qty,st);return `<article class="contractPosition card projectReq"><div><b>${r.contractName}</b><small>В проекте: ${r.projectName}</small></div><div class="positionNums"><span>Нужно <b>${r.qty.toLocaleString("ru-RU")} ${r.unit}</b></span><span>Ост. договора <b>${remain==null?"—":remain.toLocaleString("ru-RU")+" т"}</b></span><span><b>${enough===null?"—":enough?"✓ хватает":"! не хватает"}</b></span></div>${dc?`<div class="drumHint"><b>${dc.type==="bag"?`▣ К погрузке: ${dc.full} меш.${dc.remKg?` + ${dc.remKg.toLocaleString("ru-RU")} кг`:``}`:`🛢 К погрузке: ${dc.full} полн.${dc.liters?` + ${dc.liters.toLocaleString("ru-RU")} л`:``}`}</b><span>Физически подготовить ${dc.total} ${dc.type==="bag"?"меш.":"боч."}</span></div>`:`<div class="drumHint mutedHint">🛢 Для жидкости укажите массу нетто 200-л бочки</div>`}</article>`}).join("");
 shell(`<section class="screen workSectionScreen"><div class="screenTop"><button id="backProjects" class="backBtn">← Проекты</button><div><small>MYOS · V0.19.1</small><h2>Скважина №${p.well}</h2></div></div><section class="contractHero card"><span class="kicker">ПРОЕКТ · ${p.version}</span><h3>${p.operation}</h3><p>Договор: <b>${c?"№"+c.number:"не привязан"}</b></p><p>Статус: проектная потребность</p></section><button class="workPrimary" id="loadSheet">📦 Лист загрузки по упаковкам</button><div class="sectionTitle"><h2>Наша поставка по проекту</h2><span>${(p.requirements||[]).length} позиций</span></div><section class="contractPositions">${rows}</section>${(p.customerMaterials||[]).length?`<div class="sectionTitle"><h2>Поставляет заказчик</h2></div><section class="contractPositions">${p.customerMaterials.map(x=>`<article class="contractPosition card"><div><b>${x.name}</b><small>${x.supplier}</small></div><div class="positionNums"><span>По проекту <b>${x.qty} ${x.unit}</b></span></div></article>`).join("")}</section>`:""}</section>`);
 document.getElementById("backProjects").onclick=()=>projectsScreen(); document.getElementById("loadSheet").onclick=()=>loadingSheet(p.id);
}
function loadingSheet(id){
 ensureWorkStock(); const p=state.work.projects.find(x=>x.id===id); if(!p)return projectsScreen();
 const rows=(p.requirements||[]).map(r=>{const st=stockItem(r.contractName),dc=packCalc(r.qty,st),have=st?(st.packType==="bag"?(+st.bags||0):(+st.fullDrums||0)):0;return `<article class="loadRow card"><div><b>${r.contractName}</b><small>${r.qty} т по проекту</small></div>${dc?`<div class="loadBig">${dc.type==="bag"?`${dc.full} меш.${dc.remKg?` + ${dc.remKg} кг`:``}`:`${dc.full} полн.${dc.liters?` + ${dc.liters} л`:``}`}</div><div class="loadMeta"><span>Подготовить: <b>${dc.total} ${dc.type==="bag"?"меш.":"боч."}</b></span><span>На складе: <b>${have} ${dc.type==="bag"?"меш.":"полн. боч."}</b></span></div>`:`<div class="contractBadge pending">Укажите массу нетто полной 200-л бочки</div>`}</article>`}).join("");
 shell(`<section class="screen workSectionScreen"><div class="screenTop"><button id="backProject" class="backBtn">← Скважина ${p.well}</button><div><small>MYOS · V0.19.1</small><h2>📦 Лист загрузки</h2></div></div><p class="sectionLead">Сколько физически подготовить на базе: жидкости — в 200-л бочках, загуститель — в мешках по 25 кг.</p><section class="loadList">${rows}</section><section class="workNote card"><b>Расчёт упаковки не списывает склад.</b><p>Фактическое списание будет только после подтверждения отгрузки.</p></section></section>`);
 document.getElementById("backProject").onclick=()=>projectDetail(id);
}
function stockScreen(){
 ensureWorkStock(); const rows=state.work.stock.map((x,i)=>`<article class="stockCard card"><div class="stockHead"><div><b>${x.name}</b><small>${x.packType==="bag"?`Мешок ${x.bagKg||25} кг`:`Бочка ${x.drumLiters||200} л${x.drumKg?` · ${x.drumKg} кг нетто`:" · укажите массу нетто"}`}</small></div>${x.packType==="drum"?`<button data-pack="${i}">⚙️</button>`:""}</div><div class="stockInputs">${x.packType==="bag"?`<label>Полных мешков<input inputmode="numeric" type="number" min="0" step="1" value="${x.bags||0}" data-stock-bags="${i}"></label><label>Остаток, кг<input inputmode="decimal" type="number" min="0" step="0.1" value="${x.partialKg||0}" data-stock-kg="${i}"></label>`:`<label>Полных бочек<input inputmode="numeric" type="number" min="0" step="1" value="${x.fullDrums||0}" data-stock-full="${i}"></label><label>Остаток, л<input inputmode="decimal" type="number" min="0" step="0.1" value="${x.partialLiters||0}" data-stock-part="${i}"></label>`}</div></article>`).join("");
 shell(`<section class="screen workSectionScreen"><div class="screenTop"><button id="backWork" class="backBtn">← Работа</button><div><small>MYOS · V0.19.1</small><h2>📦 Склад · упаковка</h2></div></div><p class="sectionLead">Жидкая химия — 200-литровые бочки. Загуститель — мешки по 25 кг.</p><section class="stockList">${rows}</section><button class="workPrimary" id="saveStock">Сохранить склад</button></section>`);
 document.getElementById("backWork").onclick=()=>work();
 document.querySelectorAll('[data-pack]').forEach(b=>b.onclick=()=>editPack(+b.dataset.pack));
 document.getElementById("saveStock").onclick=()=>{document.querySelectorAll('[data-stock-full]').forEach(e=>state.work.stock[+e.dataset.stockFull].fullDrums=Math.max(0,+e.value||0));document.querySelectorAll('[data-stock-part]').forEach(e=>state.work.stock[+e.dataset.stockPart].partialLiters=Math.max(0,+e.value||0));save();stockScreen()};
}
function editPack(i){const x=state.work.stock[i];if(x.packType==="bag")return;const kg=prompt(`Масса нетто полной 200-литровой бочки, кг
${x.name}`,x.drumKg||"");if(kg===null)return;if(+kg>0){x.drumKg=+kg;x.drumLiters=200;save();stockScreen()}else alert("Укажите массу больше нуля.")}
function workSection(section){
 if(section==="contracts") return contractsScreen(); if(section==="projects") return projectsScreen(); if(section==="stock") return stockScreen();
 const w=state.work||{},arr=w.jobs||[];
 shell(`<section class="screen workSectionScreen"><div class="screenTop"><button id="backWork" class="backBtn">← Работа</button><div><small>MYOS · V0.19.1</small><h2>🛢️ Работы / скважины</h2></div></div><p class="sectionLead">Фактическое выполнение и связь с актами</p><section class="workEmpty card"><span class="workEmptyIcon">🛢️</span><h3>${arr.length?`Записей: ${arr.length}`:"Раздел готов к наполнению"}</h3><p>Здесь будет фактическая цепочка: договор → проект → отгрузка → работа → акт.</p></section><button class="workPrimary" id="workAddPlaceholder">＋ Добавить</button></section>`);
 document.getElementById("backWork").onclick=()=>work();document.getElementById("workAddPlaceholder").onclick=()=>alert("Подключим после склада и отгрузок.");
}

function me(){
 shell(header("Я","Моя система")+`<section class="profile card" style="margin-top:22px"><span class="kicker">ТЕКУЩИЙ РЕЖИМ</span><h3>${state.mode==="Вахта"?"⛺ Вахта":"🏠 Дом"}</h3><small class="muted">Планирование и тренировки адаптируются под режим.</small></section>
 <div class="sectionTitle"><h2>Мои направления</h2></div><section class="settings">
 <button type="button" onclick="render('work')">💼 Работа</button><button data-open-goals><span id="openGoals">🎯 Цели и приоритеты</span></button><button type="button" onclick="render('languages')">🇰🇿🇬🇧🇨🇳 Языки</button><button type="button" onclick="render('professional')">🛢 Профессиональное развитие</button><button>🏋️ Фитнес и тело</button><button onclick="current='add';render('add')">📚 Моя библиотека</button><button>🔔 Ритуалы и напоминания</button><button>⚙️ Настройки MyOS</button></section>`);
 bindMode();
 const g=document.querySelector("[data-open-goals]"); if(g) g.onclick=()=>render("goals");
}
function render(p){current=p;document.querySelectorAll("nav button").forEach(b=>b.classList.toggle("active",b.dataset.page===p));({today,plan,add,progress,me,goals,languages,professional,work}[p]||today)();scrollTo(0,0)}
document.querySelectorAll("nav button").forEach(b=>b.onclick=()=>render(b.dataset.page));
render("today");
initCloud();
