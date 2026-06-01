export async function actionDelay(page, ms = 2000) {
  await page.waitForTimeout(ms);
}

export async function sellerSpriteLoadDelay(page) {
  await page.waitForTimeout(10000);
}
