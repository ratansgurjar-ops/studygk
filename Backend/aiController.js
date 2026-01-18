const fs = require('fs');
const path = require('path');

// Helper to read settings locally for the controller
const settingsFile = path.join(__dirname, '..', '..', 'data', 'settings.json');

function readSettings() {
  try {
    if (!fs.existsSync(settingsFile)) return {};
    return JSON.parse(fs.readFileSync(settingsFile, 'utf8') || '{}') || {};
  } catch (e) {
    return {};
  }
}

const generateQuestions = async (req, res) => {
  const { exam, subject, chapter, count, difficulty, type, mode, pypDetails } = req.body;
  const settings = readSettings();
  const aiConfig = settings.ai_config || {};
  
  if (!aiConfig.apiKey) return res.status(400).json({ error: 'AI API Key not configured in Settings' });

  let prompt = '';

  if (mode === 'pyp') {
    // Previous Year Paper Prompt
    prompt = `You are a strict exam paper database.
    Task: Retrieve and generate exactly ${count} questions from the **${exam}** Previous Year Paper held in **${pypDetails?.year || 'recent years'}** ${pypDetails?.date ? `(Date: ${pypDetails.date})` : ''} ${pypDetails?.shift ? `(Shift: ${pypDetails.shift})` : ''}.
    
    CRITICAL RULES:
    1. **Difficulty**: The questions MUST match the actual difficulty of **${exam}**. Do NOT simplify them. (e.g., if NEET/JEE, questions must be Class 11/12 advanced level, NOT Class 9/10).
    2. **Authenticity**: Strictly adhere to the original paper's content if available. If the specific year/shift is not in your training data (or is in the future), generate high-quality questions that strictly mimic the pattern, syllabus, and difficulty of ${exam} for that year.
    3. **No Deviation**: Do not generate generic or easy questions. Stay strictly within the scope of ${exam}.

    - Maintain exact wording, options, and correct answers.
    - If the question contains **Math formulas**, use LaTeX format (e.g., $E=mc^2$).
    - If the question contains **Special Symbols** or **Shapes**, include them or describe them clearly.
    - If the question originally had an **Image, Chart, or Diagram**, provide a detailed text description in the 'image_description' field so it can be rendered or understood.
    
    Format: JSON array of objects with keys:
    - question_english (string)
    - question_hindi (string, optional)
    - options_1_english (string)
    - options_2_english (string)
    - options_3_english (string)
    - options_4_english (string)
    - options_1_hindi (string, optional)
    - options_2_hindi (string, optional)
    - options_3_hindi (string, optional)
    - options_4_hindi (string, optional)
    - answer (string, one of: A, B, C, D)
    - solution (string, explanation)
    - category (string, Subject name e.g. History, Math)
    - chapter_name (string, Topic name)
    - difficulty_level (string: Easy, Medium, Hard)
    - marks (number, default 4)
    - negative_marks (number, default 1)
    - image_description (string, optional)

    Return a JSON array of objects. Do not include markdown formatting.`;
  } else {
    // Standard Generation Prompt
    prompt = `Act as a strict examiner for **${exam}**.
    Generate ${count} ${difficulty} ${type} questions for ${exam} exam.
Subject: ${subject}.
Chapter: ${chapter}.

    CRITICAL RULES:
    1. **Difficulty**: The questions MUST be strictly '${difficulty}' level for **${exam}**. Do not generate easy or elementary questions if the exam is advanced.
    2. **Syllabus**: Strictly follow the syllabus of ${exam} for the topic "${chapter}".
    3. **No Deviation**: Do not include questions from other subjects or lower grade levels.

    Language: English and Hindi (if possible, else English).
Format: JSON array of objects with keys:
- question_english (string, use LaTeX for math formulas if needed)
- question_hindi (string, optional)
- options_1_english (string)
- options_2_english (string)
- options_3_english (string)
- options_4_english (string)
- options_1_hindi (string, optional)
- options_2_hindi (string, optional)
- options_3_hindi (string, optional)
- options_4_hindi (string, optional)
- answer (string, one of: A, B, C, D)
- solution (string, explanation)
- difficulty_level (string: Easy, Medium, Hard)
- marks (number, default 4)
- negative_marks (number, default 1)
- image_description (string, optional: describe diagram/chart if required)

Ensure questions are unique, high quality, and strictly follow the syllabus of ${exam}.`;
  }

  prompt += `
Support diagram-based questions by providing a detailed 'image_description' or 'svg_code' if applicable.
Support Math formulas using LaTeX format (e.g. $E=mc^2$).
Do not include any markdown formatting (like \`\`\`json). Just the raw JSON array.`;

  const apiUrl = aiConfig.baseUrl || 'https://api.openai.com/v1/chat/completions';
  const model = aiConfig.model || 'gpt-3.5-turbo';
  
  try {
    // Use global fetch (Node 18+)
    const aiRes = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${aiConfig.apiKey}`
      },
      body: JSON.stringify({
        model: model,
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.7
      })
    });
    
    if (!aiRes.ok) {
      const errText = await aiRes.text();
      throw new Error(`AI API Error: ${aiRes.status} ${errText}`);
    }
    
    const aiData = await aiRes.json();
    const content = aiData.choices?.[0]?.message?.content || '';
    
    let questions = [];
    try {
      const clean = content.replace(/```json/g, '').replace(/```/g, '').trim();
      questions = JSON.parse(clean);
    } catch (e) {
      console.error('Failed to parse AI response', content);
      throw new Error('AI returned invalid JSON format');
    }
    
    res.json({ questions });
  } catch (err) {
    console.error('AI Generation failed', err);
    res.status(500).json({ error: err.message });
  }
};

module.exports = { generateQuestions };