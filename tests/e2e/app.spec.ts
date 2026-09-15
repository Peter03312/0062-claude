import { expect, test } from '@playwright/test';

// 界面失效测试：结论、错误定位、编辑失效、草稿恢复与 SVG 渲染。
// 默认打开的就是反例 σ1² vs σ2²。

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.clear());
  await page.goto('/');
});

test('反例：同排列不等价，给出首个不同分量', async ({ page }) => {
  await expect(page.getByTestId('root-A')).toHaveValue(/σ1 σ1/);
  await expect(page.getByTestId('verdict-notequal')).toBeVisible();
  await expect(page.getByTestId('first-diff')).toContainText('首个不同分量：第 1 个分量');
  await expect(page.getByTestId('first-diff')).toContainText('排列相同不足以判等');
  await expect(page.getByTestId('perm-row')).toContainText('末端排列相同');
});

test('辫关系示例：三类公理之一给出等价结论并可封存展签', async ({ page }) => {
  await page.getByTestId('example-picker').selectOption('braid-eq');
  await expect(page.getByTestId('verdict-equal')).toBeVisible();
  await page.getByTestId('seal-btn').click();
  await expect(page.getByTestId('label-card')).toBeVisible();
  await expect(page.getByTestId('label-card')).toContainText('过程等价');
});

test('公理用错（对相邻下标用远交换）被判错并定位', async ({ page }) => {
  // 直接在路线 B 起始词 σ2 σ2 上加一步错误的远交换
  await page.getByTestId('add-step-B').click();
  const step = page.getByTestId('step-b-0');
  await step.getByTestId('axiom-select').selectOption('commute');
  await step.getByTestId('seg-start').fill('0');
  await step.getByTestId('seg-end').fill('2');
  await step.getByTestId('step-word').fill('σ1 σ2');
  await expect(step).toContainText('不满足远交换');
  await expect(page.getByTestId('verdict-illegal')).toBeVisible();
});

test('越界下标被按步序指出首个越界位置', async ({ page }) => {
  await page.getByTestId('root-A').fill('σ1 σ9 σ2');
  await expect(page.getByTestId('root-error-A')).toContainText('σ9 越界');
  await expect(page.getByTestId('root-error-A')).toContainText('词内索引 1');
});

test('断裂前序：把第 2 步改挂到“起始词”即线性断裂', async ({ page }) => {
  await page.getByTestId('example-picker').selectOption('cancel-commute');
  // 路线 B 有两步；把第 2 步前序从第 1 步改成起始词
  const step1 = page.getByTestId('step-b-1');
  await step1.getByTestId('parent-select').selectOption({ index: 0 });
  await expect(step1).toContainText('线性论证在此断裂');
});

test('编辑后旧结论自动清除（封存 -> 改词 -> 失效提示）', async ({ page }) => {
  await page.getByTestId('example-picker').selectOption('braid-eq');
  await page.getByTestId('seal-btn').click();
  await expect(page.getByTestId('label-card')).toBeVisible();
  await page.getByTestId('root-A').fill('σ1 σ2 σ1 σ1');
  await expect(page.getByTestId('verdict-stale')).toBeVisible();
  await expect(page.getByTestId('label-card')).toHaveCount(0);
});

test('草稿备份可恢复', async ({ page }) => {
  await page.getByTestId('root-A').fill('σ1 σ1 σ2');
  await page.getByTestId('snap-name').fill('课堂稿');
  await page.getByTestId('snap-save').click();
  await page.getByTestId('root-A').fill('σ2');
  const restoreBtn = page.locator('[data-testid^="snap-restore-"]').first();
  await restoreBtn.click();
  await expect(page.getByTestId('root-A')).toHaveValue('σ1 σ1 σ2');
});

test('SVG 同步绘制编带与选中片段', async ({ page }) => {
  await page.getByTestId('example-picker').selectOption('cancel-commute');
  await page.getByTestId('add-step-A').click();
  const step = page.getByTestId('step-a-0');
  await step.getByTestId('axiom-select').selectOption('cancel');
  await step.getByTestId('seg-start').fill('1');
  await step.getByTestId('seg-end').fill('3');
  await step.locator('.step-no').click(); // 展开选中片段视图（避免点到控件）
  const svg = page.getByTestId('step-svg-a-0');
  await expect(svg).toBeVisible();
  // 高亮矩形（选中片段 [1,3) 覆盖第 2、3 两个交叉列）
  await expect(svg.locator('rect[fill="#fde68a"]')).toHaveCount(2);
  // 标签列出生成元
  await expect(svg).toContainText(/σ₃⁻¹|σ3/);
});
