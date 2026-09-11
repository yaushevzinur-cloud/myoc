const $=s=>document.querySelector(s); const app=$("#app");
const state=JSON.parse(localStorage.getItem("myos02")||'{"mode":"Вахта","books":[{"name":"Казахский","icon":"🇰🇿","daily":5,"done":0,"page":1,"total":250},{"name":"Граф Монте-Кристо","icon":"📕","daily":10,"done":0,"page":436,"total":1100},{"name":"Профессиональная книга","icon":"🛢️","daily":10,"done":0,"page":72,"total":360},{"name":"Фитнес / анатомия","icon":"🏋️","daily":10,"done":0,"page":38,"total":300}]}');
function save(){localStorage.setItem("myos02",JSON.stringify(state))}
function shell(body){app.className="app";app.innerHTML=body}
function header(title,sub=""){return `<div class="top"><div><span class="eyebrow">MYOS · V0.2</span><h1>${title}</h1><div class="muted">${sub}</div></div><button class="mode" id="mode">${state.mode==="Вахта"?"⛺":"🏠"} ${state.mode}</button></div>`}
function bindMode(){let b=$("#mode");if(b)b.onclick=()=>{state.mode=state.mode==="Вахта"?"Дом":"Вахта";save();render(current)}}
let current="today";
function today(){
 const date=new Date().toLocaleDateString("ru-RU",{weekday:"long",day:"numeric",month:"long"});
 shell(header("Добрый день, Зинур",date)+`
 <section class="score card"><div><span class="kicker">БАЛАНС ДНЯ</span><strong>76%</strong><small class="muted">Хороший темп. Береги вечер.</small></div><div class="ring">76</div></section>
 <div class="sectionTitle"><h2>Фокус дня</h2><span>3 главных</span></div><div class="focus">
 ${task("💼","Рабочая задача","Глубокая работа · 60–90 мин")}
 ${task("🇰🇿","Казахский","5 страниц сегодня")}
 ${task("🏋️","Тренировка",state.mode==="Вахта"?"Штанга · гантели · турник · резинка":"Зал · программа на массу")}
 </div><button class="ai" id="ai">✨ Что мне лучше сделать сейчас?</button><div class="aiBox" id="aiBox"></div>
 <div class="sectionTitle"><h2>Мой день</h2><span>Кластеры</span></div><section class="timeline card">
 ${time("09:00","💼 Глубокая работа","Высокая концентрация")}${time("11:00","🇰🇿 Казахский","5 страниц")}${time("13:00","🍽 Обед + восстановление","Перерыв")}${time("18:30","🏋️ Тренировка",state.mode==="Вахта"?"Вахта · 45 мин":"Зал · 60–75 мин")}${time("21:00","📖 Чтение","10 страниц")}${time("22:30","🌙 Закрыть день","Дневник · 5 минут")}</section>
 <div class="sectionTitle"><h2>Сегодня в цифрах</h2></div><section class="grid">
 ${mini("🍽 ПИТАНИЕ","1 640 / 2 350","ккал · осталось 710")}${mini("🔥 СЕРИЯ","6 дней","привычки")}${mini("📚 ЧТЕНИЕ",state.books.reduce((a,b)=>a+b.done,0)+" стр.","сегодня")}${mini("💪 ТЕЛО","3 / 4","тренировки недели")}</section>`);
 bindMode(); document.querySelectorAll(".task").forEach(x=>x.onclick=()=>x.classList.toggle("done"));
 $("#ai").onclick=()=>{let x=$("#aiBox");x.style.display="block";x.innerHTML=`<b>Предложение:</b> выполни дневную норму казахского — <b>5 страниц</b>. Затем 10 минут перерыва. ${state.mode==="Вахта"?"Тренировку с доступным инвентарём оставь на вечер.":"Основную тренировку в зале оставь на вечер."}`};
}
function task(i,n,s){return `<button class="task"><b>${i}</b><span><strong>${n}</strong><small>${s}</small></span><i>○</i></button>`}
function time(t,n,s){return `<div class="timeRow"><time>${t}</time><span class="dot"></span><p><b>${n}</b><small>${s}</small></p></div>`}
function mini(k,v,s){return `<article class="mini card"><span class="kicker">${k}</span><strong>${v}</strong><small>${s}</small></article>`}
function plan(){
 shell(header("План","День · неделя · цели")+`<div class="sectionTitle"><h2>Кластеры дня</h2><span>перетаскивание позже</span></div><section class="timeline card">${time("08–11","🧠 Фокус","Сложная работа · обучение")}${time("11–14","💼 Работа","Текущие задачи · коммуникации")}${time("14–18","⚙️ Выполнение","Работа · рутина")}${time("18–20","🏋️ Тело","Тренировка · прогулка")}${time("20–23","🌙 Личное","Книги · отношения · дневник")}</section>
 <div class="sectionTitle"><h2>Kanban</h2><span>неделя</span></div><div class="kanban">
 <section class="column card"><h3>НА ЭТОЙ НЕДЕЛЕ</h3><div class="kanTask">🇰🇿 35 страниц казахского</div><div class="kanTask">🏋️ 4 тренировки</div><div class="kanTask">📚 Продвинуть 4 книги</div></section>
 <section class="column card"><h3>СЕГОДНЯ</h3><div class="kanTask">💼 Главная рабочая задача</div><div class="kanTask">🇰🇿 Казахский · 5 стр.</div><div class="kanTask">📖 Книга · 10 стр.</div></section>
 <section class="column card"><h3>ГОТОВО</h3><div class="kanTask">✓ Утренний ритуал</div></section></div>`);
 bindMode();
}
function add(){
 shell(header("Добавить","Быстрая запись — без лишних экранов")+`<div class="sectionTitle"><h2>Что записать?</h2></div><section class="quickGrid">
 ${quick("🍽","Еду")}${quick("🏋️","Тренировку")}${quick("✓","Задачу")}${quick("📚","Чтение")}${quick("🇰🇿","Язык")}${quick("📝","Заметку")}${quick("📖","Дневник")}${quick("⚖️","Вес")}</section>
 <div class="sectionTitle"><h2>Чтение сегодня</h2><span>по страницам</span></div><div class="books">${booksHTML()}</div>`);
 bindMode(); bindBooks();
}
function quick(i,t){return `<button class="quick"><b>${i}</b>${t}</button>`}
function booksHTML(){return state.books.map((b,i)=>`<article class="book card"><div class="bookTop"><div><h3>${b.icon} ${b.name}</h3><small>стр. ${b.page} / ${b.total}</small></div><strong>${b.done}/${b.daily} стр.</strong></div><div class="bar"><i style="width:${Math.min(100,b.done/b.daily*100)}%"></i></div><div class="bookActions"><small>Норма: ${b.daily} стр./день</small><button data-book="${i}">+1 стр.</button></div></article>`).join("")}
function bindBooks(){document.querySelectorAll("[data-book]").forEach(btn=>btn.onclick=()=>{let b=state.books[+btn.dataset.book];b.done++;b.page=Math.min(b.total,b.page+1);save();add()})}
function progress(){
 shell(header("Прогресс","Неделя · месяц · год")+`<div class="sectionTitle"><h2>Сферы жизни</h2><span>эта неделя</span></div><section class="area card">
 ${area("Здоровье",78)}${area("Работа",84)}${area("Развитие",69)}${area("Отдых",52)}${area("Отношения",61)}</section>
 <div class="sectionTitle"><h2>Развитие</h2></div><section class="grid">${mini("🇰🇿 КАЗАХСКИЙ","5 стр./день","главный фокус")}${mini("📚 КНИГИ","4 активных","по 10 стр.")}${mini("🏋️ ТРЕНИРОВКИ","3 / 4","эта неделя")}${mini("💼 ПРОФЕССИЯ","↑","нефть и газ")}</section>`);
 bindMode();
}
function area(n,v){return `<p><span>${n}</span><progress value="${v}" max="100"></progress><b>${v}</b></p>`}
function me(){
 shell(header("Я","Моя система")+`<section class="profile card" style="margin-top:22px"><span class="kicker">ТЕКУЩИЙ РЕЖИМ</span><h3>${state.mode==="Вахта"?"⛺ Вахта":"🏠 Дом"}</h3><small class="muted">Планирование и тренировки адаптируются под режим.</small></section>
 <div class="sectionTitle"><h2>Мои направления</h2></div><section class="settings">
 <button>🎯 Цели и приоритеты</button><button>🇰🇿🇬🇧🇨🇳 Языки</button><button>🛢 Профессиональное развитие</button><button>🏋️ Фитнес и тело</button><button>📚 Моя библиотека</button><button>🔔 Ритуалы и напоминания</button><button>⚙️ Настройки MyOS</button></section>`);
 bindMode();
}
function render(p){current=p;document.querySelectorAll("nav button").forEach(b=>b.classList.toggle("active",b.dataset.page===p));({today,plan,add,progress,me}[p]||today)();scrollTo(0,0)}
document.querySelectorAll("nav button").forEach(b=>b.onclick=()=>render(b.dataset.page));render("today");