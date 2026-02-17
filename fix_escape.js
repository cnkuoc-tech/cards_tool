const fs = require('fs');
const content = fs.readFileSync('cloudflare-worker-complete.js', 'utf8');

// 將 FRONTEND_JS 內的 \\\\ 改為 \
// 將 FRONTEND_JS 內的 \\$ 改為 \$
const fixed = content.replace(/(\nconst FRONTEND_JS = `)([^]*?)(\n`\n)/, (match, p1, p2, p3) => {
  const fixed = p2
    .replace(/\\\\\\\\/g, '\\')  // 4個反斜線 → 1個
    .replace(/\\\\\$/g, '\\$');  // 2個反斜線+$ → 1個反斜線+$
  return p1 + fixed + p3;
});

fs.writeFileSync('cloudflare-worker-complete.js', fixed);
console.log('修正完成');
