const { OpenAI } = require('openai');
const { GoogleGenerativeAI } = require('@google/generative-ai');
require('dotenv').config();

const nvidiaApiKey = process.env.NVIDIA_API_KEY;
const geminiApiKey = process.env.GEMINI_API_KEY;

// NVIDIA 클라이언트 초기화
const nvidiaClient = nvidiaApiKey ? new OpenAI({
  baseURL: "https://integrate.api.nvidia.com/v1",
  apiKey: nvidiaApiKey
}) : null;

// Gemini 클라이언트 초기화
const genAI = geminiApiKey ? new GoogleGenerativeAI(geminiApiKey) : null;
const geminiModel = genAI ? genAI.getGenerativeModel({ model: "gemini-2.5-flash" }) : null;

const MODEL_NAME = "nvidia/nemotron-3-nano-omni-30b-a3b-reasoning";

const GOLDEN_PROMPT = `Extract data from the game screenshot and output the result STRICTLY as a raw JSON object.

CRITICAL RULES:
1. Do NOT wrap the JSON in markdown blocks (e.g., no \`\`\`json).
2. Do NOT output any conversational text. Your entire response MUST start with { and end with }.
3. The stats are in a 2x2 grid. For example, if you see "최대체력 84075 공격력 5987", it means HP is 84075 and Attack is 5987. Do NOT mix them up.
4. Affinity is the 1 or 2-digit number INSIDE the pink heart next to the name. NEVER extract the long EXP fraction (e.g., 32/125645).
5. If the yellow stars reach the end of the text background width, it is always 5. Do not miscount 5 as 4.

Use the following JSON schema:

{
  "student_info": {
    "affinity": "Find the pink heart icon. Extract ONLY the 1-2 digit number inside it. DO NOT output the EXP bar.",
    "name": "Extract full name including parentheses",
    "level": "Extract level number only"
  },
  "stats": {
    "hp": {
      "value": "Find the label '최대체력' and extract the number that belongs to it.",
      "ability_release_level": "Extract the number inside the small '능력 개방 Lv.' box located strictly below the HP stat. If there is NO such box below the stat, YOU MUST output 0. Do NOT extract skill levels here."
    },
    "attack": {
      "value": "Find the label '공격력' and extract the number that belongs to it.",
      "ability_release_level": "Extract the number inside the small '능력 개방 Lv.' box located strictly below the attack stat. If there is NO such box below the stat, YOU MUST output 0. Do NOT extract skill levels here."
    },
    "defense": {
      "value": "Find the label '방어력' and extract the number that belongs to it."
    },
    "healing": {
      "value": "Find the label '치유력' and extract the number that belongs to it.",
      "ability_release_level": "Extract the number inside the small '능력 개방 Lv.' box located strictly below the healing stat. If there is NO such box below the stat, YOU MUST output 0. Do NOT extract skill levels here."
    }
  },
  "skills": {
    "ex": "extract EX skill level, e.g., '3' or 'MAX'",
    "normal": "extract normal skill level",
    "enhanced": "extract enhanced skill level",
    "sub": "extract sub skill level"
  },
  "weapon": {
    "level": "Look carefully at the top-left of the weapon area. There is faint white italic text like 'Lv.50'. Extract this text. Only output '0' if there is a giant lock icon."
  },
  "equipment": {
    "slot1": "extract tier like 'T9', if empty ''",
    "slot2": "extract tier like 'T7', if empty ''. Look closely at the bottom-left of the icon.",
    "slot3": "extract tier like 'T8', if empty ''",
    "favorite_item": "Look to the right of slot 3 for a 4th item (Favorite Item). Extract its tier (usually 'T1' or 'T2'). If there is no 4th item, output ''."
  },
  "equipment_level": {
    "slot1": "extract level like '65', if empty ''",
    "slot2": "extract level like '55', if empty ''",
    "slot3": "extract level like '60', if empty ''"
  },
  "star_counts": {
    "student_stars_yellow": "Count the exact number of filled yellow stars. If the yellow stars fill the entire text background width, it is always 5. OUTPUT AS INTEGER.",
    "weapon_stars_blue": "Count the exact number of filled blue stars. OUTPUT AS INTEGER."
  },
  "has_unique_weapon": "Output false (boolean) ONLY if there is a giant black lock icon in the center of the weapon area. Otherwise, output true (boolean)."
}`;

let currentApi = nvidiaApiKey ? "nvidia" : (geminiApiKey ? "gemini" : "none");
let nvidiaLimitHitTime = 0;

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function callNvidiaApi(base64Image, mimeType) {
  if (!nvidiaClient) throw new Error("NVIDIA_API_KEY is not configured.");
  const completion = await nvidiaClient.chat.completions.create({
    model: MODEL_NAME,
    messages: [
      {
        role: "user",
        content: [
          { type: "text", text: GOLDEN_PROMPT },
          { type: "image_url", image_url: { url: `data:${mimeType};base64,${base64Image}` } }
        ]
      }
    ],
    temperature: 0.6,
    top_p: 0.95,
    max_tokens: 65536,
    extra_body: {
      chat_template_kwargs: { enable_thinking: true },
      reasoning_budget: 16384
    }
  });

  let resultText = completion.choices[0]?.message?.content;
  if (!resultText) {
    throw new Error("NVIDIA API returned empty content or does not support vision formatting.");
  }
  resultText = resultText.trim();
  if (resultText.startsWith("\`\`\`json")) resultText = resultText.substring(7);
  if (resultText.startsWith("\`\`\`")) resultText = resultText.substring(3);
  if (resultText.endsWith("\`\`\`")) resultText = resultText.substring(0, resultText.length - 3);
  return JSON.parse(resultText.trim());
}

async function callGeminiApi(base64Image, mimeType) {
  if (!geminiModel) throw new Error("GEMINI_API_KEY is not configured.");
  
  const imagePart = {
    inlineData: {
      data: base64Image,
      mimeType: mimeType
    }
  };

  const result = await geminiModel.generateContent([GOLDEN_PROMPT, imagePart]);
  const response = await result.response;
  let resultText = response.text().trim();
  
  if (resultText.startsWith("\`\`\`json")) resultText = resultText.substring(7);
  if (resultText.startsWith("\`\`\`")) resultText = resultText.substring(3);
  if (resultText.endsWith("\`\`\`")) resultText = resultText.substring(0, resultText.length - 3);
  return JSON.parse(resultText.trim());
}

async function parseImageWithRetry(base64Image, mimeType) {
  let nvidiaRetryCount = 0;
  while (true) {
    if (currentApi === "none") {
      throw new Error("API_KEY is not configured (Neither NVIDIA nor GEMINI).");
    }
    if (currentApi === "gemini" && (Date.now() - nvidiaLimitHitTime >= 60000)) {
      console.log("⏳ 1분 경과하여 다시 NVIDIA API로 전환합니다.");
      currentApi = "nvidia";
      nvidiaRetryCount = 0;
    }

    if (currentApi === "nvidia") {
      try {
        console.log("🚀 [전송 중 - NVIDIA] 분석 시작...");
        const result = await callNvidiaApi(base64Image, mimeType);
        return result;
      } catch (error) {
        console.error("NVIDIA API Error:", error.message);
        if (error.status === 429 || (error.message && error.message.includes('429'))) {
          console.log("⚠️ NVIDIA API 1분 한도 초과!");
          nvidiaLimitHitTime = Date.now();
          
          if (geminiApiKey) {
            console.log("🔄 Gemini API로 전환합니다.");
            currentApi = "gemini";
            continue;
          } else {
            console.log("⏳ GEMINI_API_KEY가 없어 60초 대기합니다...");
            await delay(60000);
            continue;
          }
        } else {
          console.log("⚠️ NVIDIA API 오류 발생. 5초 후 재시도합니다...");
          await delay(5000);
          continue;
        }
      }
    } else if (currentApi === "gemini") {
      try {
        console.log("🚀 [전송 중 - GEMINI] 분석 시작...");
        const result = await callGeminiApi(base64Image, mimeType);
        return result;
      } catch (error) {
        console.error("GEMINI API Error:", error.message);
        if (error.status === 429 || (error.message && error.message.includes('429'))) {
          console.log("⚠️ Gemini API도 한도 초과! NVIDIA 제한 해제 시까지 대기합니다.");
          const elapsed = Date.now() - nvidiaLimitHitTime;
          const sleepNeeded = Math.max(0, 60000 - elapsed);
          if (sleepNeeded > 0) {
            console.log(`⏳ ${sleepNeeded / 1000}초 대기...`);
            await delay(sleepNeeded);
          }
          currentApi = "nvidia";
          continue;
        }
        throw error;
      }
    }
  }
}

module.exports = { parseImageWithRetry };
