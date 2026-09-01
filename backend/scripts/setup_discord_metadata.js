require('dotenv').config();

const DISCORD_CLIENT_ID = process.env.DISCORD_CLIENT_ID;
const DISCORD_BOT_TOKEN = process.env.DISCORD_BOT_TOKEN;

if (!DISCORD_CLIENT_ID || !DISCORD_BOT_TOKEN) {
  console.error("DISCORD_CLIENT_ID and DISCORD_BOT_TOKEN must be set in .env");
  process.exit(1);
}

const url = `https://discord.com/api/v10/applications/${DISCORD_CLIENT_ID}/role-connections/metadata`;

const metadata = [
  {
    key: "students_owned",
    name: "보유 학생 수",
    description: "PlanaAI에 등록된 전체 보유 학생 수",
    type: 2 // INTEGER_GREATER_THAN_OR_EQUAL
  },
  {
    key: "ue50_students",
    name: "전무 3성 학생 수",
    description: "PlanaAI에 등록된 전무 3성(고유무기 최대 강화) 학생 수",
    type: 2
  },
  {
    key: "tactics_shared",
    name: "택틱 공유 수",
    description: "PlanaAI에 공유한 총력전/대결전 택틱 수",
    type: 2
  },
  {
    key: "favorite_student",
    name: "최애 학생",
    description: "선생님의 최애 학생 이름",
    type: 1 // STRING_EQUAL
  },
  {
    key: "bond_level",
    name: "인연 레벨",
    description: "최애 학생의 인연 레벨",
    type: 2
  }
];

async function setupMetadata() {
  try {
    const response = await fetch(url, {
      method: 'PUT',
      headers: {
        'Authorization': `Bot ${DISCORD_BOT_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(metadata)
    });
    const data = await response.json();
    if (!response.ok) throw new Error(JSON.stringify(data, null, 2));
    
    console.log("Discord Metadata Schema has been successfully configured!");
    console.log(data);
  } catch (error) {
    console.error("Failed to setup metadata:", error.message);
  }
}

setupMetadata();
