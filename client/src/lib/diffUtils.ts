export function computeDiff(baseStr: string, newStr: string): string {
  if (!baseStr) return newStr;
  if (!newStr) return '';

  const baseWords = baseStr.split(/(<[^>]+>|\s+)/).filter(Boolean);
  const newWords = newStr.split(/(<[^>]+>|\s+)/).filter(Boolean);

  // Create LCS matrix
  const m = baseWords.length;
  const n = newWords.length;
  const dp: number[][] = Array(m + 1).fill(null).map(() => Array(n + 1).fill(0));

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (baseWords[i - 1] === newWords[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1] + 1;
      } else {
        dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
      }
    }
  }

  // Backtrack to find the differences
  let i = m;
  let j = n;
  const result: { word: string; isNew: boolean }[] = [];

  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && baseWords[i - 1] === newWords[j - 1]) {
      result.unshift({ word: newWords[j - 1], isNew: false });
      i--;
      j--;
    } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
      result.unshift({ word: newWords[j - 1], isNew: true });
      j--;
    } else if (i > 0 && (j === 0 || dp[i][j - 1] < dp[i - 1][j])) {
      // word deleted from base, we ignore deletions because we only want to highlight added/changed things
      i--;
    }
  }

  // Combine consecutive 'new' words to wrap them cleanly
  let finalStr = '';
  let inYellow = false;

  for (const item of result) {
    // If it's just whitespace and we are currently highlighting, we can keep the whitespace inside the highlight or outside.
    // It's usually safer to just treat whitespace as whatever state we are in if it's surrounded by new words, but simple toggle is fine.
    const isSpaceOrBr = /^(\s+)$/.test(item.word) || item.word === '<br />' || item.word === '<br/>' || item.word === '\n';
    
    if (item.isNew && !isSpaceOrBr) {
      if (!inYellow) {
        finalStr += '<span class="text-yellow-400 font-bold">';
        inYellow = true;
      }
      finalStr += item.word;
    } else if (!item.isNew && !isSpaceOrBr) {
      if (inYellow) {
        finalStr += '</span>';
        inYellow = false;
      }
      finalStr += item.word;
    } else {
      // It's a space or br. Keep the current state so we don't spam <span> </span> tags.
      finalStr += item.word;
    }
  }

  if (inYellow) {
    finalStr += '</span>';
  }

  return finalStr;
}
