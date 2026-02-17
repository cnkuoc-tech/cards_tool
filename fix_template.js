const fs = require('fs');
const content = fs.readFileSync('cloudflare-worker-complete.js', 'utf8');

// 將 String.raw` 改為 `
// 然後將 FRONTEND_JS 內的 ` 改為 \`
// 將 FRONTEND_JS 內的 $ 改為 \$

const fixed = content.replace(/String\.raw\`/, '`')
  .replace(/(\nconst FRONTEND_JS = \`)([^]*?)(\n\`\n)/, (match, p1, p2, p3) => {
    // 跳脫 FRONTEND_JS 內容中的 ` 和 $
    const escaped = p2
      .replace(/\`/g, '\\`')
      .replace(/\$/g, '\\$');
    return p1 + escaped + p3;
  });

fs.writeFileSync('cloudflare-worker-complete.js', fixed);
console.log('修正完成');
