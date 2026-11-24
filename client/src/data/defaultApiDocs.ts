export interface ApiParamDoc {
  name: string;
  location: string;
  type: string;
  required: boolean;
  description: string;
}

export interface ApiCodeExamples {
  curl: string;
  javascript: string;
  python: string;
}

export interface ApiEndpointDoc {
  id: string;
  method: string;
  path: string;
  altPath?: string;
  badge: string;
  title: string;
  summary: string;
  description: string;
  parameters: ApiParamDoc[];
  codeExamples: ApiCodeExamples;
  responseExample: string;
  notes: string[];
}

export interface ApiDocsConfig {
  terminalLabel: string;
  title: string;
  disclaimer?: string;
  baseUrl: string;
  rateLimit: string;
  corsPolicy: string;
  cachePolicy: string;
  authPolicy: string;
  overview: string;
  endpoints: ApiEndpointDoc[];
}

export const DEFAULT_API_DOCS: ApiDocsConfig = {
  terminalLabel: 'Plana.AI OPEN API',
  title: 'Plana.AI API Docs',
  disclaimer:
    'PlanaAI에서 제공하는 OpenAPI는 넥슨이나 블루 아카이브로부터 공식적으로 지원을 받아 만들어지지 않았으며 자체 구축한 비공식 API임을 알려드립니다.\n\n필수 사항은 아니지만, API를 유용하게 활용해주셨다면 서비스 구석 한편이라도 "API Powered by PlanaAI" 같은 작은 문구 하나만 함께 기재해 주시면 감사하겠습니다.',
  baseUrl: 'https://api.plan4ai.fyi',
  rateLimit: '60 / MIN',
  corsPolicy: 'CORS *',
  cachePolicy: 'max-age=300 (5분)',
  authPolicy: '불필요 (공개 GET · API Key 없음)',
  overview:
    'Plana.AI 학생 마스터 데이터를 외부 도구·시트·봇에서 조회할 수 있는 읽기 전용 공개 API입니다. 모든 식별자는 고유 정수 id 단일 기준이며, 전체 상세 일괄 조회(GET /v1/students) 대신 아래 3종 경량 엔드포인트를 제공합니다.',
  endpoints: [
    {
      id: 'students-names',
      method: 'GET',
      path: '/v1/students/names',
      altPath: '/v1/students/names?format=map',
      badge: 'INDEX',
      title: '학생 이름 목록 및 ID 매핑 조회',
      summary: '전체 학생의 이름 배열 또는 { id, name } 매핑 배열을 id 오름차순으로 반환합니다.',
      description:
        '기본 호출 시 학생 이름 문자열 배열(string[])을 반환합니다. ?format=map 쿼리 파라미터를 전달하면 고유 정수 id와 이름(name)이 묶인 객체 배열로 반환합니다. 전체 학생 색인이 필요할 때 가장 먼저 호출하세요.',
      parameters: [
        {
          name: 'format',
          location: 'query',
          type: 'string',
          required: false,
          description:
            "'map' 지정 시 각 학생의 고유 정수 id와 이름이 묶인 [{ id: number, name: string }] 객체 배열을 반환합니다. 이후 /v1/students/{id} 상세 조회에 필요한 id를 한 번에 수집할 때 유용합니다. (미지정 또는 다른 값 전달 시 string[] 이름 문자열 배열 반환)",
        },
      ],
      codeExamples: {
        curl: `# 1) 기본 이름 배열 조회 (string[])
curl -X GET "https://api.plan4ai.fyi/v1/students/names" \\
  -H "Accept: application/json"

# 2) 고유 ID + 이름 매핑 배열 조회 (?format=map)
curl -X GET "https://api.plan4ai.fyi/v1/students/names?format=map" \\
  -H "Accept: application/json"`,
        javascript: `// 고유 ID + 학생 이름 매핑 목록 조회 (?format=map)
const res = await fetch('https://api.plan4ai.fyi/v1/students/names?format=map', {
  headers: { Accept: 'application/json' },
});
if (!res.ok) throw new Error(\`HTTP \${res.status}\`);

const students = await res.json();
console.log(students.slice(0, 4));
        // [{ id: 1, name: "나기사" }, { id: 2, name: "나츠" }, ...]`,
        python: `import requests

res = requests.get(
    "https://api.plan4ai.fyi/v1/students/names",
    params={"format": "map"},
    timeout=5,
)
res.raise_for_status()

students = res.json()
for item in students[:4]:
    print(item["id"], item["name"])`,
      },
      responseExample: `[
  {
    "id": 1,
    "name": "나기사"
  },
  {
    "id": 2,
    "name": "나츠"
  },
  {
    "id": 3,
    "name": "네루"
  },
  {
    "id": 4,
    "name": "네루(바니걸)"
  }
]`,
      notes: [
        '응답은 항상 학생 고유 id 오름차순으로 정렬됩니다.',
        'format=map 사용 시 반환되는 id는 /v1/students/:id 단건 조회의 경로 파라미터로 바로 사용할 수 있습니다.',
        'Cache-Control: public, max-age=300 헤더가 포함되어 5분간 캐싱됩니다.',
      ],
    },
    {
      id: 'students-id-lookup',
      method: 'GET',
      path: '/v1/students/id/:name',
      altPath: '/v1/students/id?name={name}&exact=false',
      badge: 'LOOKUP',
      title: '학생 이름으로 고유 ID 조회 및 검색',
      summary: '학생 이름으로 고유 id를 조회합니다. 정규화 정확 일치 및 부분 일치 검색(?exact=false)을 지원합니다.',
      description:
        "NFKC 유니코드 정규화(전각 괄호·별표·중복 공백 정리)를 거쳐 학생 이름을 매칭합니다. '시로코*테러', '하나코(수영복)', '미사카 미코토'처럼 특수문자·괄호·공백이 포함된 이름은 쿼리 파라미터(/v1/students/id?name=...) 또는 URL 인코딩(encodeURIComponent)으로 호출하세요. ?exact=false 전달 시 부분 일치 결과를 최대 20건까지 반환합니다.",
      parameters: [
        {
          name: 'name',
          location: 'path / query',
          type: 'string',
          required: true,
          description: '조회할 학생 이름 (예: 나기사, 시로코*테러, 하나코(수영복))',
        },
        {
          name: 'exact',
          location: 'query',
          type: 'string',
          required: false,
          description: "'false' 지정 시 부분 일치 검색 수행 (최대 20건, { count, results } 반환)",
        },
      ],
      codeExamples: {
        curl: `# 1) 정확 일치 ID 조회 (쿼리 스트링 방식 권장)
curl -G "https://api.plan4ai.fyi/v1/students/id" \\
  --data-urlencode "name=시로코*테러"

# 2) 경로 파라미터 방식 (URL 인코딩 필수)
curl -X GET "https://api.plan4ai.fyi/v1/students/id/%EB%82%98%EA%B8%B0%EC%82%AC"

# 3) 부분 일치 검색 (?exact=false, 최대 20건)
curl -G "https://api.plan4ai.fyi/v1/students/id" \\
  --data-urlencode "name=시로코" \\
  --data-urlencode "exact=false"`,
        javascript: `// 1) 정확 일치 조회
const target = encodeURIComponent('시로코*테러');
const exactRes = await fetch(\`https://api.plan4ai.fyi/v1/students/id?name=\${target}\`);
const exactData = await exactRes.json();
console.log(exactData);
// { id: 68, name: "시로코*테러" }

// 2) 부분 일치 검색 (?exact=false)
const keyword = encodeURIComponent('시로코');
const searchRes = await fetch(
  \`https://api.plan4ai.fyi/v1/students/id?name=\${keyword}&exact=false\`
);
const searchData = await searchRes.json();
console.log(searchData);
        // { count: 4, results: [{ id: 65, name: "시로코" }, ...] }`,
        python: `import requests

# 1) 정확 일치 조회
r_exact = requests.get(
    "https://api.plan4ai.fyi/v1/students/id",
    params={"name": "시로코*테러"},
    timeout=5,
)
print(r_exact.json())  # {'id': 68, 'name': '시로코*테러'}

# 2) 부분 일치 검색 (exact=false)
r_search = requests.get(
    "https://api.plan4ai.fyi/v1/students/id",
    params={"name": "시로코", "exact": "false"},
    timeout=5,
)
print(r_search.json())  # {'count': 4, 'results': [...]}`,
      },
      responseExample: `{
  "id": 68,
  "name": "시로코*테러"
}

// ?exact=false 부분 일치 검색 시 응답:
{
  "count": 4,
  "results": [
    {
      "id": 65,
      "name": "시로코"
    },
    {
      "id": 66,
      "name": "시로코(라이딩)"
    },
    {
      "id": 67,
      "name": "시로코(수영복)"
    },
    {
      "id": 68,
      "name": "시로코*테러"
    }
  ]
}`,
      notes: [
        'name 파라미터가 비어 있으면 400 Bad Request가 반환됩니다.',
        '일치하는 학생이 없으면 404 Not Found가 반환됩니다.',
      ],
    },
    {
      id: 'students-detail',
      method: 'GET',
      path: '/v1/students/:id',
      altPath: '',
      badge: 'DETAIL',
      title: '단일 학생 상세 마스터 데이터 조회',
      summary: '고유 정수 id 기준으로 단일 학생의 프로필, 장비·오파츠, 지형 적성, 스킬 및 선호 선물(preferredGifts)을 반환합니다.',
      description:
        '1 이상의 양의 정수 id(선행 0 불허, 예: /v1/students/1)를 경로 파라미터로 전달하면 해당 학생의 전체 마스터 데이터를 반환합니다. 내부 관리용 필드인 studentNumber는 제외되며, 선물 DB와 연동된 선호 선물(preferredGifts: { level4, level3, level2 })이 자동 포함됩니다.',
      parameters: [
        {
          name: 'id',
          location: 'path',
          type: 'integer',
          required: true,
          description: '학생 고유 정수 ID (1 이상의 양의 정수, 선행 0 불가)',
        },
      ],
      codeExamples: {
        curl: `# 고유 ID(예: 1 = 나기사)로 단일 학생 상세 조회
        curl - X GET "https://api.plan4ai.fyi/v1/students/1" \\
  - H "Accept: application/json"`,
        javascript: `// 이름으로 ID를 먼저 찾은 뒤 상세 데이터 조회
const lookupRes = await fetch(
  \`https://api.plan4ai.fyi/v1/students/id?name=\${encodeURIComponent('나기사')}\`
);
const { id } = await lookupRes.json();

const detailRes = await fetch(\`https://api.plan4ai.fyi/v1/students/\${id}\`);
if (!detailRes.ok) throw new Error(\`HTTP \${detailRes.status}\`);

const student = await detailRes.json();
console.log(student.name, student.school, student.preferredGifts);`,
        python: `import requests

student_id = 1
res = requests.get(f"https://api.plan4ai.fyi/v1/students/{student_id}", timeout=5)
res.raise_for_status()

student = res.json()
print("이름:", student["name"])
print("학원:", student.get("school"))
print("선호 선물:", student.get("preferredGifts"))`,
      },
      responseExample: `{
  "id": 1,
  "name": "나기사",
  "school": "Trinity",
  "club": "티파티",
  "fieldType": "Special",
  "Role": "DamageDealer",
  "Role2": "",
  "attackType": "Explosion",
  "armorType": "HeavyArmor",
  "weaponType": "HG",
  "position": "Back",
  "position2": "",
  "starNum": 3,
  "hasFavoriteItem": false,
  "equipmentSlot1": "Hat",
  "equipmentSlot2": "Bag",
  "equipmentSlot3": "Watch",
  "portraitUrls": [
    "/uploads/portraits/ico/img-1783065007275-172645610.png",
    "/uploads/portraits/img-1783065017597-985601067.png"
  ],
  "primaryOopart": "Wolfsegg",
  "secondaryOopart": "ether",
  "terrainAffinity": {
    "urban": "D",
    "outdoor": "B",
    "indoor": "S"
  },
  "uniqueWeaponName": "로얄 블렌드",
  "uniqueWeaponEffects": {
    "star2": "강화 스킬 Pride of Tea Party를 Pride of Tea Party+로 강화",
    "star3": "실내 지형전투력을 SS로 강화",
    "star4": "코스트 상한 +0.5"
  },
  "uniqueWeaponUrl": "",
  "favoriteItemUrl": "",
  "favoriteItemEffects": {
    "t1": "",
    "t2": ""
  },
  "skills": [
    {
      "modeName": "",
      "portraitUrl": "",
      "fullIllustUrl": "",
      "ex": {
        "name": "Time On Target",
        "descriptionTemplate": "원형 범위 내의 적에게 공격력 {1}% 대미지\\n대상이 경장갑인 경우 공격 전 방어력 {2}% 감소 (15초간)",
        "parameters": {
          "1": ["482", "554", "627", "699", "772"],
          "2": ["30.9", "30.9", "35.6", "35.6", "40.2"]
        },
        "iconUrl": "/uploads/skillIco/comp/나기사/나기사_ex.png"
      },
      "normal": {
        "name": "Afternoon Tea",
        "descriptionTemplate": "50초마다 체력이 가장 낮은 아군 1인에게 치유력 {1}% 회복\\n대상이 트리니티 학원 소속일 경우 치유력 {2}% 회복",
        "parameters": {
          "1": ["147", "154", "161", "191", "198", "205", "235", "242", "249", "279"],
          "2": ["207", "217", "227", "269", "279", "290", "331", "341", "352", "393"]
        },
        "iconUrl": "/uploads/skillIco/comp/나기사/나기사_basic.png"
      },
      "passive": {
        "name": "Pride of Tea Party",
        "descriptionTemplate": "공격력 {1}% 증가",
        "parameters": {
          "1": ["14", "14.7", "15.4", "18.2", "18.9", "19.6", "22.4", "23.1", "23.8", "26.6"]
        },
        "iconUrl": "/uploads/skillIco/comp/나기사/나기사_sub.png"
      },
      "sub": {
        "name": "Noblesse oblige",
        "descriptionTemplate": "폭발 타입 아군의 치명 대미지 {1}% 증가",
        "parameters": {
          "1": ["12.7", "13.4", "14", "16.5", "17.2", "17.8", "20.4", "21", "21.7", "24.2"]
        },
        "iconUrl": "/uploads/skillIco/comp/나기사/나기사_sub.png"
      },
      "normalPlus": {
        "name": "",
        "descriptionTemplate": "",
        "parameters": {},
        "iconUrl": ""
      },
      "passivePlus": {
        "name": "",
        "descriptionTemplate": "공격력 {1}% 증가\\n치명 대미지 {2} 증가",
        "parameters": {
          "1": ["14", "14.7", "15.4", "18.2", "18.9", "19.6", "22.4", "23.1", "23.8", "26.6"],
          "2": ["2000", "2100", "2200", "2600", "2700", "2800", "3200", "3300", "3400", "3800"]
        },
        "iconUrl": "/uploads/skillIco/comp/나기사/나기사_sub.png"
      },
      "uniqueWeaponName": "로얄 블렌드",
      "uniqueWeaponEffects": {
        "star2": "강화 스킬 Pride of Tea Party를 Pride of Tea Party+로 강화",
        "star3": "실내 지형전투력을 SS로 강화",
        "star4": "코스트 상한 +0.5"
      }
    }
  ],
  "preferredGifts": {
    "level4": [
      {
        "key": "gift_001",
        "name": "고풍스러운 달걀 공예품"
      }
    ],
    "level3": [
      {
        "key": "GIFT_042",
        "name": "태엽장치 오르골"
      }
    ],
    "level2": [
      {
        "key": "GIFT_012",
        "name": "비싸보이는 금박 욕망의 항아리"
      },
      {
        "key": "GIFT_018",
        "name": "세상에서 가장 쓸데없는 기계"
      },
      {
        "key": "GIFT_027",
        "name": "고급 쿠키 세트"
      },
      {
        "key": "GIFT_037",
        "name": "매장금의 지도"
      }
    ]
  }
}`,
      notes: [
        '숫자가 아니거나 0 이하, 선행 0(예: /api/students/01) 요청 시 400 Bad Request ({ "error": "Invalid student id" })가 반환됩니다.',
        '존재하지 않는 ID 요청 시 404 Not Found ({ "error": "Student not found", "id": 9999 })가 반환됩니다.',
        '숫자가 아니거나 0 이하, 선행 0이 포함된 ID 요청 시 400 Bad Request가 반환됩니다.',
        '존재하지 않는 ID 요청 시 404 Not Found가 반환됩니다.',
      ],
    },
  ],
};
