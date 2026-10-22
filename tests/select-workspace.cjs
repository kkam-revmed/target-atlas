// Explicit fixture selection: the real workspace intentionally starts empty.
module.exports = async function selectWorkspace(page) {
 await page.locator('#runSearch').fill('RMC-0741051');
 await page.locator('#runCompound').selectOption('RMC-0741051-001');
 await page.locator('#runAdd').click();
 await page.locator('#runAssay').selectOption('selectivity');
 await page.locator('#runTarget').selectOption('Cyclin D3');
 await page.locator('#runGraph svg').waitFor();
};
