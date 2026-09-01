const express = require('express');
const { requireAuth } = require('../middleware/auth');
const { prisma } = require('../db');

const router = express.Router();

const DISCORD_CLIENT_ID = process.env.DISCORD_CLIENT_ID;
const DISCORD_CLIENT_SECRET = process.env.DISCORD_CLIENT_SECRET;

// POST /api/discord/callback
// 프론트엔드에서 Discord OAuth2 인가 코드와 선택한 설정값을 받아 처리
router.post('/callback', requireAuth, async (req, res) => {
  const { code, redirectUri, customData } = req.body;
  const userId = req.user.id;

  if (!code || !redirectUri) {
    return res.status(400).json({ error: '잘못된 요청입니다. (code 또는 redirectUri 누락)' });
  }

  try {
    // 1. 인가 코드를 액세스 토큰으로 교환
    const tokenParams = new URLSearchParams({
      client_id: DISCORD_CLIENT_ID,
      client_secret: DISCORD_CLIENT_SECRET,
      grant_type: 'authorization_code',
      code: code,
      redirect_uri: redirectUri
    });

    const tokenResponse = await fetch('https://discord.com/api/v10/oauth2/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: tokenParams.toString()
    });
    
    if (!tokenResponse.ok) {
        throw new Error(await tokenResponse.text());
    }

    const tokenData = await tokenResponse.json();
    const discordAccessToken = tokenData.access_token;

    // 2. DB에서 유저의 실제 스탯 조회 (프론트에서 넘어온 플래그에 따라)
    let metadata = {};

    if (customData.show_students) {
      const studentsOwned = await prisma.collection.count({
        where: { userId: userId, isOwned: true }
      });
      metadata.students_owned = studentsOwned;
      
      const ue50Students = await prisma.growthPlan.count({
        where: { userId: userId, currentWeaponStar: 3 }
      });
      metadata.ue50_students = ue50Students;
    }

    if (customData.show_tactics) {
      const tacticsShared = await prisma.sharedRaidParty.count({
        where: { authorId: userId }
      });
      metadata.tactics_shared = tacticsShared;
    }

    // (favorite_student is not supported by Discord linked role metadata as it only accepts numbers/booleans)

    if (customData.bond_level) {
      metadata.bond_level = parseInt(customData.bond_level, 10);
    }
    
    if (customData.teacher_level) {
      metadata.teacher_level = parseInt(customData.teacher_level, 10);
    }

    // 3. 디스코드 프로필 메타데이터(Role Connections) 업데이트
    const userPlatformName = req.user.nickname || req.user.username || '선생님';
    
    const putResponse = await fetch(`https://discord.com/api/v10/users/@me/applications/${DISCORD_CLIENT_ID}/role-connection`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${discordAccessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            platform_name: "PlanaAI",
            platform_username: userPlatformName,
            metadata: metadata
        })
    });
    
    if (!putResponse.ok) {
        throw new Error(await putResponse.text());
    }
    const responseJson = await putResponse.json();
    console.log("Discord PUT response:", JSON.stringify(responseJson));

    // 성공적으로 전송 완료 (discordAccessToken은 여기서 스코프가 종료되며 파기됨)
    return res.json({ success: true, message: '디스코드 프로필이 성공적으로 갱신되었습니다.', data: responseJson });

  } catch (error) {
    console.error('Discord sync error:', error.message || error);
    return res.status(500).json({ error: '디스코드 연동 중 오류가 발생했습니다.' });
  }
});

module.exports = router;
