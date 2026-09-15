#!/usr/bin/env node
// 首页冒烟：对已构建的静态站点发 HTTP 请求，检查 HTML 与打包资源可达。
// 用法：node scripts/smoke.mjs [baseUrl]   （默认 http://127.0.0.1:8080）
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const base = (process.argv[2] || process.env.SMOKE_URL || 'http://127.0.0.1:8080').replace(/\/$/, '');

async function fetchText(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url} -> HTTP ${res.status}`);
  return { body: await res.text(), res };
}

const failures = [];
try {
  const { body: html } = await fetchText(`${base}/`);
  if (!html.includes('<div id="root">')) throw new Error('首页缺少 #root 挂载点');
  if (!/<script[^>]+src="\.?\/assets\//.test(html)) throw new Error('首页未引用本地打包脚本（离线要求）');
  if (/https?:\/\/(?!127\.0\.0\.1|localhost)[a-z0-9.-]+\/.*(cdn|unpkg|jsdelivr)/i.test(html)) {
    throw new Error('首页引用了外部 CDN，违反纯前端离线要求');
  }

  // 取出本地 JS/CSS 资源逐一验证
  const assets = [...html.matchAll(/(?:src|href)="\.?(\/assets\/[^"]+)"/g)].map((m) => m[1]);
  if (assets.length === 0) throw new Error('未发现打包资源');
  for (const a of assets) {
    const { res } = await fetchText(`${base}${a}`);
    if (res.headers.get('content-type') && !/javascript|css/.test(res.headers.get('content-type') || '')) {
      throw new Error(`${a} 内容类型异常：${res.headers.get('content-type')}`);
    }
  }
  console.log(`冒烟通过：${base}/ 及 ${assets.length} 个本地资源全部可达`);
} catch (err) {
  failures.push(err);
}

// 额外：直接检查 dist/index.html 里没有外部 URL（双保险）
try {
  const localHtml = await readFile(resolve('dist/index.html'), 'utf8');
  if (/https?:\/\/(?!127\.0\.0\.1|localhost)[^"']*(cdn|unpkg|jsdelivr|googleapis)/i.test(localHtml)) {
    throw new Error('dist/index.html 含外部资源引用');
  }
} catch (err) {
  if (err.code !== 'ENOENT') failures.push(err);
}

if (failures.length) {
  for (const f of failures) console.error('冒烟失败：', f.message);
  process.exit(1);
}
