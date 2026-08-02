const fs = require('fs');
const data = JSON.parse(fs.readFileSync('C:/Users/also1/Downloads/plana_mapped.json', 'utf8'));

const issues = [];

const allowedEnglish = ['EX', 'HP', 'CC', 'COST', 'SS', 'D', 'B', 'S', 'A', 'C', 'NS', 'PS', 'SS', 'TS'];

const hasDisallowedEnglish = (text) => {
    if (!text) return false;
    const words = text.match(/[a-zA-Z]+/g) || [];
    return words.some(word => !allowedEnglish.includes(word.toUpperCase()));
};

data.forEach(student => {
    const studentIssues = [];

    // Check unique weapon effects
    if (student.uniqueWeaponEffects) {
        Object.entries(student.uniqueWeaponEffects).forEach(([key, value]) => {
            if (value && typeof value === 'string') {
                if (value.includes('[') || value.includes(']')) {
                    studentIssues.push(`고유무기(${key}) 괄호 포함: ${value}`);
                }
                if (hasDisallowedEnglish(value)) {
                    studentIssues.push(`고유무기(${key}) 영어 포함: ${value}`);
                }
            }
        });
    }

    // Check skills
    if (student.skills) {
        student.skills.forEach(skillSet => {
            ['ex', 'normal', 'passive', 'sub'].forEach(skillType => {
                const skill = skillSet[skillType];
                if (skill) {
                    const desc = skill.descriptionTemplate;
                    if (!desc || desc.trim() === '') {
                        studentIssues.push(`스킬(${skillType}) 설명 비어있음`);
                    } else {
                        if (desc.includes('[') || desc.includes(']')) {
                            studentIssues.push(`스킬(${skillType}) 괄호 포함: ${desc}`);
                        }
                        if (hasDisallowedEnglish(desc)) {
                            studentIssues.push(`스킬(${skillType}) 영어 포함: ${desc}`);
                        }
                    }
                }
            });
        });
    }

    if (studentIssues.length > 0) {
        issues.push({ name: student.name, issues: studentIssues });
    }
});

fs.writeFileSync('C:/Users/also1/Documents/ba_archive/ba_archive/planaaiWebsite/scratch_anomalies.json', JSON.stringify(issues, null, 2));
console.log(`Found issues in ${issues.length} students.`);
