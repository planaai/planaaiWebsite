const fs = require('fs');
const files = [
  'src/app/student/detail/page.tsx',
  'src/app/archive/student/detail/page.tsx',
  'src/app/notices/detail/page.tsx',
  'src/app/notices/edit/page.tsx',
  'src/app/tactics/pve/detail/page.tsx',
  'src/app/tactics/pve/edit/page.tsx',
  'src/app/tactics/pvp/detail/page.tsx',
  'src/app/tactics/pvp/edit/page.tsx'
];

for (const file of files) {
  if (!fs.existsSync(file)) {
    console.log('Not found:', file);
    continue;
  }
  let content = fs.readFileSync(file, 'utf8');
  
  // Remove edge runtime
  content = content.replace(/export const runtime = 'edge';\n?/g, '');
  
  // Replace useSearchParams
  content = content.replace(/useParams(,\s*)?(useRouter)?/g, 'useSearchParams, $2');
  content = content.replace(/useRouter(,\s*)?useParams/g, 'useRouter, useSearchParams');
  if (!content.includes('useSearchParams')) {
    content = content.replace(/'next\/navigation';/, 'useSearchParams } from \\\'next/navigation\\\';');
  }

  // Rename main component
  const match = content.match(/export default function ([A-Za-z0-9_]+)\(\)/);
  if (match) {
    const compName = match[1];
    content = content.replace(new RegExp(`export default function ${compName}\\(\\)`), `function ${compName}Content()`);
    
    // Replace param hooks
    content = content.replace(/const params = useParams\(\);/g, 'const searchParams = useSearchParams();');
    
    // Replace id extraction
    content = content.replace(/const id = Number\(params\.id\);/g, 'const id = Number(searchParams.get(\'id\'));');
    content = content.replace(/const \{ id \} = params as \{ id: string \};/g, 'const id = searchParams.get(\'id\') as string;');
    content = content.replace(/const \{ code \} = params as \{ code: string \};/g, 'const code = searchParams.get(\'code\') as string;');
    content = content.replace(/const id = params\.id;/g, 'const id = searchParams.get(\'id\');');
    content = content.replace(/const code = params\.code;/g, 'const code = searchParams.get(\'code\');');
    
    // Append wrapper
    content += `\n\nimport { Suspense } from 'react';\n\nexport default function ${compName}() {\n  return (\n    <Suspense fallback={<div className="p-12 text-center text-gray-500">Loading...</div>}>\n      <${compName}Content />\n    </Suspense>\n  );\n}\n`;
    
    fs.writeFileSync(file, content);
    console.log('Updated:', file);
  }
}
