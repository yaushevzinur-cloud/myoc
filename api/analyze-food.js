module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({error:'Метод не поддерживается.'});
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return res.status(503).json({error:'AI-анализ ещё не подключён: в Vercel не задан OPENAI_API_KEY.'});
  try {
    const { image, description = '', mealType = '' } = req.body || {};
    if (!image && !description) return res.status(400).json({error:'Нужно фото или описание еды.'});
    const content = [{type:'input_text', text:`Оцени приём пищи для личного дневника питания. Приём: ${mealType}. Комментарий пользователя: ${description || 'нет'}. Определи видимые/описанные продукты и примерную массу каждого. Оцени калории, белки, жиры, углеводы. Не выдавай оценку как точное измерение. Верни ТОЛЬКО JSON без markdown: {"name":"краткое название блюда","details":"состав и примерные граммовки одной строкой","items":[{"name":"продукт","grams":123}],"kcal":500,"protein":30,"fat":20,"carbs":50,"confidence":"низкая|средняя|высокая"}. Числа должны быть числами.`}];
    if (image) content.push({type:'input_image', image_url:image});
    const r = await fetch('https://api.openai.com/v1/responses', {
      method:'POST', headers:{'Authorization':`Bearer ${apiKey}`,'Content-Type':'application/json'},
      body:JSON.stringify({model:'gpt-5.6-luna', input:[{role:'user',content}]})
    });
    const data = await r.json();
    if (!r.ok) return res.status(r.status).json({error:data?.error?.message || 'Ошибка AI API.'});
    let text = data.output_text || '';
    if (!text && Array.isArray(data.output)) for (const o of data.output) if (Array.isArray(o.content)) for (const c of o.content) if (c.type==='output_text' && c.text) text += c.text;
    text = text.trim().replace(/^```json\s*/i,'').replace(/```$/,'').trim();
    let parsed; try { parsed=JSON.parse(text); } catch { return res.status(502).json({error:'AI вернул ответ, который не удалось разобрать.'}); }
    return res.status(200).json(parsed);
  } catch (e) { return res.status(500).json({error:e.message || 'Ошибка сервера.'}); }
}
