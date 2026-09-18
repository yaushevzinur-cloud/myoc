# MyOS V0.24.0 — AI питание

Добавлено:
- выбор: фото / описание / вручную;
- фото с камеры или медиатеки;
- предварительный просмотр;
- AI-анализ через серверный `/api/analyze-food`;
- экран проверки оценки и ручной корректировки перед сохранением;
- безопасная схема: ключ OpenAI берётся только из переменной окружения Vercel `OPENAI_API_KEY`, не из `config.js`;
- safe-area для экрана питания на iPhone.

Важно: без `OPENAI_API_KEY` интерфейс работает, но AI-анализ сообщает, что подключение ещё не настроено.


V0.23.3: Universal MYOS Import — accepts full ChatGPT response, extracts MYOS JSON, supports single meal, arrays, products and day totals.
