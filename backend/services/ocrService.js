/**
 * Backend OCR Service for Blue Archive Student Data Extraction
 *
 * Interacts with NVIDIA NIM OpenAI-compatible API endpoint:
 * Model: deepseek-ai/deepseek-v4.1-flash
 * Auth: process.env.NVIDIA_API_KEY
 * Integrated with ocrQueue for bounded rate limiting.
 */

const { ocrQueue } = require('./ocrQueue');

const NVIDIA_BASE_URL = 'https://integrate.api.nvidia.com/v1/chat/completions';
const DEFAULT_MODEL = 'deepseek-ai/deepseek-v4.1-flash';

const DEFAULT_STUDENT_OCR_PROMPT = `당신은 모바일 게임 '블루 아카이브(Blue Archive)'의 학생 기본 정보 스크린샷을 분석하여 웹 입력 폼용 JSON 데이터를 추출하는 정밀 비전 파서입니다.

반드시 이미지에 보이는 시각 정보만 근거로 판별하며, 추측하지 마십시오. 마크다운 코드블록(\`\`\`json)이나 부연 설명 없이 오직 순수 JSON 객체만 출력하십시오.

[영역별 추출 규칙]

1. 기본 프로필 (좌측 하단 네임플레이트)
- studentName: 분홍색 하트 우측의 학생 이름 문자열 (예: "아루", "하나코(수영복)", "호시노(무장)").
- bondRank: 학생 이름 좌측 분홍색 하트 아이콘 내부의 정수 (인연 랭크).
- level: 이름 아래 노란색/어두운색 경험치 바 좌측 상단의 "Lv.XX"에서 정수만 추출. 경험치 수치(예: 10/125645)나 우측 끝 "MAX" 글자는 무시.
- starGrade: "STRIKER" 또는 "SPECIAL" 배지 바로 왼쪽에 나열된 '노란색 별 아이콘'의 개수를 왼쪽부터 하나씩 직접 세어 정수로 입력 (1~5). 다른 텍스트("MAX" 등)로 유추하지 말고 오직 노란 별 개수만 카운트할 것.

2. 스킬 레벨 (우측 패널 중단, '스킬 성장' 버튼 왼쪽 4개 카드)
- 왼쪽부터 순서대로 ex(EX 스킬), normal(기본 스킬), passive(강화 스킬), sub(서브 스킬). 스킬명 뒤의 "+" 기호는 무시.
- 각 카드 하단 텍스트 확인:
  - "Lv.숫자" 표기 시: 해당 숫자(정수) 입력.
  - "MAX" 표기 시: ex는 5, normal/passive/sub는 각각 10으로 변환하여 입력.

3. 전용 무기 (우측 패널 하단 위쪽, '무기 성장' 버튼 왼쪽 영역)
- 무기가 잠겨 있거나(자물쇠/미해금 표시) 장착되지 않은 경우:
  - { "unequipped": true, "starGrade": null, "level": null }
- 무기가 표시된 경우:
  - unequipped: false
  - level: 무기 일러스트 좌측 상단 "Lv.XX"의 정수 (예: 50, 60).
  - starGrade: 무기 일러스트 우측 하단에 나열된 '하늘색(청록색) 별 아이콘'의 개수를 왼쪽부터 하나씩 직접 세어 정수로 입력 (1~4). (주의: 별이 3개인지 4개인지 끝까지 정확히 셀 것)

4. 장비 및 애용품 (우측 패널 최하단, '장비 성장' 버튼 왼쪽 4개 슬롯)
- 왼쪽부터 1, 2, 3번 슬롯은 일반 장비(equipments 배열, 길이 3):
  - 슬롯에 "EMPTY" 또는 잠금 표시가 있으면: { "slot": 슬롯번호, "unequipped": true, "tier": null, "level": null }
  - 아이템이 장착되어 있으면:
    - unequipped: false
    - tier: 슬롯 좌측 하단 하늘색 원형 배지 안의 "T숫자"에서 정수만 추출 (예: T10 -> 10, T8 -> 8, T7 -> 7).
    - level: 슬롯 좌측 상단 흰색 테두리 글씨 "Lv.숫자"에서 정수만 추출 (아이템 배경과 겹쳐 있어도 정밀 판독, 예: Lv.70 -> 70, Lv.1 -> 1).
- 4번째 슬롯은 애용품(favoriteItem 객체):
  - "EMPTY" 또는 빈 슬롯이면: { "unequipped": true, "tier": null }
  - 아이템 아이콘이 있고 좌측 하단에 "T1" 또는 "T2" 배지가 있으면: { "unequipped": false, "tier": 배지의 정수(1 또는 2) }

5. 상세 스탯 및 능력 개방 (우측 패널 상단 '능력치' 아래 2x2 표)
- 항목 매핑: 최대체력(hp), 공격력(atk), 방어력(def), 치유력(heal).
- value: 각 항목 이름 오른쪽의 검은색 기본 스탯 정수.
- releaseLevel: 스탯 숫자 바로 오른쪽에 '초록색(올리브색) 사각형 배지(Lv.XX)'가 붙어 있는지 확인:
  - 초록색 배지가 있으면 배지 안의 "Lv.숫자"에서 정수만 추출 (예: Lv.25 -> 25, 배지 위의 작은 MAX 글자는 무시).
  - 초록색 배지가 아예 없으면 반드시 null로 설정 (절대 0이나 1을 임의로 넣지 말 것).

[출력 JSON 스키마]
{
  "studentName": "string",
  "level": 90,
  "starGrade": 5,
  "bondRank": 20,
  "skills": {
    "ex": 5,
    "normal": 10,
    "passive": 10,
    "sub": 10
  },
  "equipments": [
    { "slot": 1, "unequipped": false, "tier": 8, "level": 60 },
    { "slot": 2, "unequipped": false, "tier": 8, "level": 60 },
    { "slot": 3, "unequipped": false, "tier": 8, "level": 60 }
  ],
  "favoriteItem": {
    "unequipped": true,
    "tier": null
  },
  "weapon": {
    "unequipped": false,
    "starGrade": 3,
    "level": 50
  },
  "stats": {
    "hp": { "value": 0, "releaseLevel": null },
    "atk": { "value": 0, "releaseLevel": null },
    "def": { "value": 0, "releaseLevel": null },
    "heal": { "value": 0, "releaseLevel": null }
  }
}`;

function toOptionalInt(val) {
  if (val === null || val === undefined || typeof val === 'boolean') {
    return null;
  }
  if (typeof val === 'number') {
    return isNaN(val) ? null : Math.floor(val);
  }
  const text = String(val).trim();
  if (!text || ['null', 'none', 'empty', '-', 'undefined'].includes(text.toLowerCase())) {
    return null;
  }
  const cleaned = text.replace(/,/g, '');
  const match = cleaned.match(/\d+/);
  return match ? parseInt(match[0], 10) : null;
}

function toSkillLevel(val, isEx) {
  const maxLv = isEx ? 5 : 10;
  if (typeof val === 'string') {
    const upper = val.trim().toUpperCase();
    if (upper === 'M' || upper.includes('MAX')) {
      return maxLv;
    }
  }
  const parsed = toOptionalInt(val);
  if (parsed === null) {
    return 1;
  }
  return Math.max(1, Math.min(maxLv, parsed));
}

function extractJsonObject(rawText) {
  if (typeof rawText !== 'string') {
    throw new Error('응답 텍스트가 유효하지 않습니다.');
  }

  // 1. Strip <think>...</think> tags from reasoning models (including unclosed tags)
  let cleaned = rawText.replace(/<think>[\s\S]*?(?:<\/think>|$)/gi, '').trim();

  // 2. Strip markdown code fences ```json ... ``` or ``` ... ```
  cleaned = cleaned.replace(/```(?:json)?\s*([\s\S]*?)(?:```|$)/gi, '$1').trim();

  const tryParse = (str) => {
    try {
      const parsed = JSON.parse(str);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        return parsed;
      }
    } catch {
      // ignore
    }

    // Try sanitizing comments and trailing commas
    try {
      const sanitized = str
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .replace(/\/\/.*$/gm, '')
        .replace(/,(\s*,)+/g, ',')
        .replace(/,\s*([\]}])/g, '$1');

      try {
        const parsed = JSON.parse(sanitized);
        if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
          return parsed;
        }
      } catch {
        const doubleQuoted = sanitized
          .replace(/'([^'\\]*(?:\\.[^'\\]*)*)'/g, '"$1"')
          .replace(/,\s*([\]}])/g, '$1');
        const quotedKeys = doubleQuoted.replace(/([{,]\s*)([a-zA-Z_][a-zA-Z0-9_]*)\s*:/g, '$1"$2":');
        const parsed = JSON.parse(quotedKeys);
        if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
          return parsed;
        }
      }
    } catch {
      // ignore
    }
    return null;
  };

  const direct = tryParse(cleaned);
  if (direct) return direct;

  // Fallback: locate outermost '{' and '}'
  const startIdx = cleaned.indexOf('{');
  const endIdx = cleaned.lastIndexOf('}');
  if (startIdx === -1 || endIdx === -1 || endIdx <= startIdx) {
    throw new Error("응답에서 유효한 JSON 객체('{...}')를 찾을 수 없습니다.");
  }

  const candidate = cleaned.slice(startIdx, endIdx + 1);
  const candidateParsed = tryParse(candidate);
  if (candidateParsed) {
    return candidateParsed;
  }

  throw new Error('추출된 JSON 최상위 구조를 해석할 수 없습니다.');
}

function normalizeEquipmentSlot(slotNum, item) {
  if (!item || typeof item !== 'object') {
    return { slot: slotNum, unequipped: true, tier: null, level: null };
  }
  const tier = toOptionalInt(item.tier);
  const level = toOptionalInt(item.level);
  let unequipped = Boolean(item.unequipped);

  if (tier === null && level === null) {
    unequipped = true;
  }

  if (unequipped) {
    return { slot: slotNum, unequipped: true, tier: null, level: null };
  }

  return {
    slot: slotNum,
    unequipped: false,
    tier: tier !== null ? tier : 1,
    level: level !== null ? level : 1
  };
}

function normalizeStatEntry(item) {
  if (item && typeof item === 'object') {
    const val = toOptionalInt(item.value ?? item.val ?? item.stat ?? item['값']);
    let rel = toOptionalInt(
      item.releaseLevel ?? item.release_level ?? item.potential ?? item['능력개방'] ?? item['개방레벨']
    );
    if (rel !== null && rel <= 0) {
      rel = null;
    } else if (rel !== null) {
      rel = Math.min(25, rel);
    }
    return { value: val !== null ? val : 0, releaseLevel: rel };
  }

  const val = toOptionalInt(item);
  return { value: val !== null ? val : 0, releaseLevel: null };
}

function normalizeOcrData(raw) {
  if (!raw || typeof raw !== 'object') {
    throw new Error('정규화할 원본 데이터가 올바른 객체가 아닙니다.');
  }

  const rawName = String(raw.studentName || raw.student_name || raw.name || raw.student || '')
    .trim()
    .replace(/^["'`]|["'`]$/g, '');
  const studentName = rawName;

  const rawLevel = toOptionalInt(raw.level ?? raw.lvl);
  const level = rawLevel && rawLevel > 0 ? Math.min(90, Math.max(1, rawLevel)) : 1;

  const rawStar = toOptionalInt(raw.starGrade ?? raw.star_grade ?? raw.stars ?? raw.star);
  const starGrade = rawStar && rawStar > 0 ? Math.min(5, Math.max(1, rawStar)) : 3;

  const rawBond = toOptionalInt(raw.bondRank ?? raw.bond_rank ?? raw.bond ?? raw.bondLevel);
  const bondRank = rawBond && rawBond > 0 ? Math.min(100, Math.max(1, rawBond)) : null;

  // skills
  const rawSkills = raw.skills || raw.skill_levels || raw.skillLevels || {};
  let exRaw, normalRaw, passiveRaw, subRaw;

  if (Array.isArray(rawSkills)) {
    exRaw = rawSkills[0];
    normalRaw = rawSkills[1];
    passiveRaw = rawSkills[2];
    subRaw = rawSkills[3];
  } else if (typeof rawSkills === 'object' && rawSkills !== null) {
    exRaw = rawSkills.ex ?? rawSkills.exSkill ?? rawSkills.ex_skill;
    normalRaw = rawSkills.normal ?? rawSkills.basic ?? rawSkills.normal_skill ?? rawSkills.normalSkill;
    passiveRaw = rawSkills.passive ?? rawSkills.enhanced ?? rawSkills.enh ?? rawSkills.passive_skill ?? rawSkills.passiveSkill;
    subRaw = rawSkills.sub ?? rawSkills.sub_skill ?? rawSkills.subSkill;
  }

  const skills = {
    ex: toSkillLevel(exRaw, true),
    normal: toSkillLevel(normalRaw, false),
    passive: toSkillLevel(passiveRaw, false),
    sub: toSkillLevel(subRaw, false)
  };

  // equipments
  let rawEquips = [];
  if (Array.isArray(raw.equipments)) {
    rawEquips = raw.equipments;
  } else if (Array.isArray(raw.equipment)) {
    rawEquips = raw.equipment;
  } else if (Array.isArray(raw.gear)) {
    rawEquips = raw.gear;
  } else if (typeof raw.equipments === 'object' && raw.equipments !== null) {
    rawEquips = [
      raw.equipments.slot1 || raw.equipments['1'],
      raw.equipments.slot2 || raw.equipments['2'],
      raw.equipments.slot3 || raw.equipments['3'],
      raw.equipments.slot4 || raw.equipments['4']
    ];
  } else if (typeof raw.equipment === 'object' && raw.equipment !== null) {
    rawEquips = [
      raw.equipment.slot1 || raw.equipment['1'],
      raw.equipment.slot2 || raw.equipment['2'],
      raw.equipment.slot3 || raw.equipment['3'],
      raw.equipment.slot4 || raw.equipment['4']
    ];
  }

  const equipments = [];
  for (let idx = 0; idx < 3; idx++) {
    equipments.push(normalizeEquipmentSlot(idx + 1, rawEquips[idx]));
  }

  // favoriteItem
  const rawFav =
    raw.favoriteItem ??
    raw.favorite_item ??
    raw.favItem ??
    raw.item ??
    (rawEquips.length >= 4 ? rawEquips[3] : undefined);
  let favTier = null;
  let favUnequipped = false;

  if (rawFav === null || rawFav === undefined) {
    favUnequipped = true;
  } else if (typeof rawFav === 'number' || typeof rawFav === 'string') {
    favTier = toOptionalInt(rawFav);
    favUnequipped = favTier === null;
  } else if (typeof rawFav === 'object') {
    favTier = toOptionalInt(rawFav.tier ?? rawFav.level);
    favUnequipped = Boolean(rawFav.unequipped || favTier === null);
  } else {
    favUnequipped = true;
  }

  const favoriteItem =
    favUnequipped || favTier === null
      ? { unequipped: true, tier: null }
      : { unequipped: false, tier: Math.max(1, Math.min(2, favTier)) };

  // weapon
  const rawWp = raw.weapon ?? raw.uniqueWeapon ?? raw.unique_weapon;
  let wpStar = null;
  let wpLevel = null;
  let wpUnequipped = false;

  if (rawWp === null || rawWp === undefined) {
    wpUnequipped = true;
  } else if (typeof rawWp === 'number') {
    wpStar = toOptionalInt(rawWp);
    wpLevel = 50;
    wpUnequipped = wpStar === null || wpStar <= 0;
  } else if (typeof rawWp === 'object') {
    const wpStarSrc = rawWp.starGrade ?? rawWp.star_grade ?? rawWp.stars ?? rawWp.star;
    wpStar = toOptionalInt(wpStarSrc);
    wpLevel = toOptionalInt(rawWp.level ?? rawWp.lvl);
    wpUnequipped = Boolean(rawWp.unequipped);
    if ((wpStar === null || wpStar <= 0) && wpLevel === null) {
      wpUnequipped = true;
    }
  } else {
    wpUnequipped = true;
  }

  const weapon = wpUnequipped
    ? { unequipped: true, starGrade: null, level: null }
    : {
        unequipped: false,
        starGrade: Math.max(1, Math.min(4, wpStar || 1)),
        level: wpLevel !== null ? Math.max(1, Math.min(60, wpLevel)) : 1
      };

  // stats
  const rawStats = raw.stats || raw.status || raw.stat || {};
  const hpRaw = rawStats.hp ?? rawStats.maxHP ?? rawStats.max_hp ?? rawStats['최대체력'] ?? rawStats['체력'];
  const atkRaw = rawStats.atk ?? rawStats.attack ?? rawStats.attackPower ?? rawStats['공격력'];
  const defRaw = rawStats.def ?? rawStats.defense ?? rawStats.defensePower ?? rawStats['방어력'];
  const healRaw = rawStats.heal ?? rawStats.healing ?? rawStats.healPower ?? rawStats['치유력'];

  const stats = {
    hp: normalizeStatEntry(hpRaw),
    atk: normalizeStatEntry(atkRaw),
    def: normalizeStatEntry(defRaw),
    heal: normalizeStatEntry(healRaw)
  };

  return {
    studentName,
    level,
    starGrade,
    bondRank,
    skills,
    equipments,
    favoriteItem,
    weapon,
    stats,
    // Cross-contract convenience aliases for Project Spec
    equipment: {
      slot1: equipments[0]?.tier ?? null,
      slot2: equipments[1]?.tier ?? null,
      slot3: equipments[2]?.tier ?? null
    },
    uniqueWeapon: weapon.unequipped ? null : { star: weapon.starGrade, level: weapon.level },
    bondLevel: bondRank
  };
}

/**
 * Execute raw completion call to NVIDIA NIM Chat Completions endpoint
 */
async function callNvidiaChatCompletions(payload, { signal, apiKey } = {}) {
  const token = (apiKey || process.env.NVIDIA_API_KEY || '').trim().replace(/^["']|["']$/g, '');
  if (!token) {
    const authErr = new Error('NVIDIA API Key가 설정되지 않았습니다. 서버 환경 변수를 확인해주세요.');
    authErr.status = 401;
    throw authErr;
  }

  const resp = await fetch(NVIDIA_BASE_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      Accept: 'application/json'
    },
    body: JSON.stringify(payload),
    signal
  });

  if (!resp.ok) {
    const errorBody = await resp.text().catch(() => '');
    const error = new Error(`NVIDIA NIM API 오류 (${resp.status}): ${errorBody || resp.statusText}`);
    error.status = resp.status;
    error.statusCode = resp.status;
    throw error;
  }

  return await resp.json();
}

/**
 * High-level OCR execution for a single base64 image
 */
async function processOcr(imageDataUrl, { signal, prompt, apiKey } = {}) {
  if (!imageDataUrl || typeof imageDataUrl !== 'string') {
    const badInputErr = new Error('유효한 이미지 데이터가 전달되지 않았습니다.');
    badInputErr.status = 400;
    throw badInputErr;
  }

  const trimmed = imageDataUrl.trim();
  if (!trimmed.startsWith('data:image/')) {
    const badFormatErr = new Error('이미지 형식이 올바르지 않습니다. (data:image/... 형식이 필요합니다)');
    badFormatErr.status = 400;
    throw badFormatErr;
  }

  const payload = {
    model: DEFAULT_MODEL,
    messages: [
      {
        role: 'user',
        content: [
          { type: 'text', text: prompt || DEFAULT_STUDENT_OCR_PROMPT },
          { type: 'image_url', image_url: { url: trimmed } }
        ]
      }
    ],
    temperature: 0.1,
    top_p: 0.95,
    max_tokens: 8192,
    chat_template_kwargs: { enable_thinking: true }
  };

  const responseJson = await callNvidiaChatCompletions(payload, { signal, apiKey });

  const choice = responseJson.choices?.[0];
  const message = choice?.message || {};

  // Extract from message content or reasoning content fallback
  let textToParse = message.content || '';
  if (!textToParse && message.reasoning_content) {
    textToParse = message.reasoning_content;
  }

  const parsedObject = extractJsonObject(textToParse);
  const normalizedData = normalizeOcrData(parsedObject);

  return {
    success: true,
    data: normalizedData,
    usage: responseJson.usage || null,
    model: DEFAULT_MODEL
  };
}

/**
 * Enqueue an OCR task into the rate-limited FIFO queue
 */
function enqueueOcr(imageDataUrl, { signal, prompt, apiKey } = {}) {
  return ocrQueue.enqueue(
    (taskSignal) => processOcr(imageDataUrl, { signal: taskSignal, prompt, apiKey }),
    { signal }
  );
}

module.exports = {
  NVIDIA_BASE_URL,
  DEFAULT_MODEL,
  DEFAULT_STUDENT_OCR_PROMPT,
  toOptionalInt,
  toSkillLevel,
  extractJsonObject,
  normalizeEquipmentSlot,
  normalizeStatEntry,
  normalizeOcrData,
  callNvidiaChatCompletions,
  processOcr,
  enqueueOcr
};
