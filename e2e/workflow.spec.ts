import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
test('import, search, filter, select, export, replace confirmation and reset stay local', async ({
  page,
}, testInfo) => {
  const unexpected: string[] = [];
  page.on('request', (request) => {
    const url = new URL(request.url());
    if (url.origin !== 'http://127.0.0.1:4174' || request.method() !== 'GET' || request.postData())
      unexpected.push(request.method() + ' ' + url.origin);
  });
  await page.goto('/');
  await expect(page.getByRole('button', { name: 'Export selected', exact: true })).toBeDisabled();
  await page.getByLabel('Import contacts file').setInputFiles('public/sample-contacts.vcf');
  await expect(page.getByRole('status').filter({ hasText: 'Imported 8 contacts' })).toBeVisible();
  await page.getByRole('checkbox', { name: 'Keep Aarav Mehta', exact: true }).check();
  await page.getByLabel('Search contacts').fill('9000000002');
  await expect(
    page.getByRole('checkbox', { name: 'Keep अनन्या शर्मा', exact: true }),
  ).toBeVisible();
  await page.getByRole('checkbox', { name: 'Select visible contacts', exact: true }).check();
  await page.getByLabel('Clear search').click();
  await expect(page.getByRole('checkbox', { name: 'Keep Aarav Mehta', exact: true })).toBeChecked();
  await expect(
    page.getByRole('checkbox', { name: 'Select visible contacts', exact: true }),
  ).toHaveJSProperty('indeterminate', true);
  if (testInfo.project.name === 'android-layout') {
    const row = await page.locator('tbody tr').first().boundingBox();
    const panel = await page.locator('.contacts-panel').boundingBox();
    expect(row!.width).toBeGreaterThan(panel!.width - 5);
  }
  await page.screenshot({ path: `docs/contacts-${testInfo.project.name}.png`, fullPage: true });
  await page.getByLabel('Filter contacts').selectOption('selected');
  await expect(page.locator('tbody tr')).toHaveCount(2);
  await page.getByRole('button', { name: 'Export selected', exact: true }).click();
  await expect(page.getByRole('dialog')).toContainText('2 selected · 2 contacts to export');
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download VCF', exact: true }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe('My_Contacts.vcf');
  const path = await download.path();
  const contents = readFileSync(path!, 'utf8');
  expect(contents.match(/BEGIN:VCARD/g)).toHaveLength(2);
  expect(contents).toContain('अनन्या शर्मा');
  expect(contents).not.toContain('Dev Kapoor');
  await page.getByLabel('Import contacts file').setInputFiles('public/sample-contacts.csv');
  await expect(page.getByRole('dialog')).toContainText('Replace this session?');
  await page.getByRole('button', { name: 'Keep current session' }).click();
  await expect(page.locator('tbody tr')).toHaveCount(2);
  await page
    .getByLabel('Import contacts file')
    .setInputFiles({ name: 'bad.vcf', mimeType: 'text/vcard', buffer: Buffer.from('invalid') });
  await page.getByRole('button', { name: 'Replace and import' }).click();
  await expect(page.getByRole('alert')).toBeVisible();
  await expect(page.locator('tbody tr')).toHaveCount(2);
  await page.getByLabel('Filter contacts').selectOption('all');
  await page.getByLabel('Switch to dark mode').click();
  await page.getByLabel('Switch to light mode').click();
  await expect(page.locator('body')).toHaveJSProperty(
    'scrollWidth',
    await page.evaluate(() => window.innerWidth),
  );
  expect(
    await page.evaluate(() => ({ local: localStorage.length, session: sessionStorage.length })),
  ).toEqual({ local: 0, session: 0 });
  await page.getByLabel('Clear uploaded contacts').first().click();
  await page
    .getByRole('dialog')
    .getByRole('button', { name: 'Clear uploaded contacts', exact: true })
    .click();
  await expect(page.getByText('A lighter contact list starts here.')).toBeVisible();
  expect(unexpected).toEqual([]);
});
test('CSV replacement, detail review and keyboard accessible dialogs', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: /Try fictional sample contacts/ }).click();
  await page.getByLabel('Import contacts file').setInputFiles('public/sample-contacts.csv');
  await page.getByRole('button', { name: 'Replace and import' }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Imported 2 contacts' })).toBeVisible();
  await page.getByRole('button', { name: 'Details for Aarav Mehta' }).click();
  await expect(page.getByRole('dialog')).toContainText('Multiline notes are supported.');
  await page.getByRole('button', { name: 'Keep this contact', exact: true }).click();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.getByLabel('Filter contacts').selectOption('selected');
  await expect(page.locator('tbody tr')).toHaveCount(1);
});
test('progress survives refresh; selection and uploaded data can be cleared independently', async ({
  page,
}) => {
  await page.goto('/');
  await expect(page.getByLabel('Save status')).toContainText('Progress saves automatically');
  await page.getByRole('button', { name: /Try fictional sample contacts/ }).click();
  await page.getByRole('checkbox', { name: 'Keep Aarav Mehta', exact: true }).check();
  await page.getByRole('button', { name: 'Save progress', exact: true }).click();
  await expect(page.getByLabel('Save status')).toContainText('Progress saved');
  await page.reload();
  await expect(page.getByRole('checkbox', { name: 'Keep Aarav Mehta', exact: true })).toBeChecked();
  await expect(page.locator('tbody tr')).toHaveCount(8);
  await page.getByRole('button', { name: 'Clear selection', exact: true }).click();
  await expect(page.getByLabel('Save status')).toContainText('Progress saved');
  await page.reload();
  await expect(page.locator('tbody tr')).toHaveCount(8);
  await expect(
    page.getByRole('checkbox', { name: 'Keep Aarav Mehta', exact: true }),
  ).not.toBeChecked();
  await page.getByLabel('Clear uploaded contacts').click();
  await page
    .getByRole('dialog')
    .getByRole('button', { name: 'Clear uploaded contacts', exact: true })
    .click();
  await page.getByRole('button', { name: /Try fictional sample contacts/ }).click();
  await expect(page.getByLabel('Save status')).toContainText('Progress saved');
  await page.getByLabel('Clear uploaded contacts').click();
  await page
    .getByRole('dialog')
    .getByRole('button', { name: 'Clear uploaded contacts', exact: true })
    .click();
  await expect(page.getByText('A lighter contact list starts here.')).toBeVisible();
  await page.reload();
  await expect(page.getByText('A lighter contact list starts here.')).toBeVisible();
});
test('5,000-contact import keeps selection across pagination and search', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByLabel('Save status')).toContainText('Progress saves automatically');
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  const backup = Array.from(
    { length: 5000 },
    (_, i) =>
      `BEGIN:VCARD\r\nVERSION:3.0\r\nFN:Person ${String(i).padStart(5, '0')}\r\nTEL:+919${String(i).padStart(9, '0')}\r\nEND:VCARD\r\n`,
  ).join('');
  await page.getByLabel('Import contacts file').setInputFiles({
    name: 'fictional-large.vcf',
    mimeType: 'text/vcard',
    buffer: Buffer.from(backup),
  });
  await expect(
    page.getByRole('status').filter({ hasText: 'Imported 5,000 contacts' }),
  ).toBeVisible();
  await expect(page.locator('tbody tr')).toHaveCount(50);
  await page.getByRole('checkbox', { name: 'Keep Person 00000', exact: true }).check();
  await page.getByLabel('Next page').click();
  await page.getByRole('checkbox', { name: 'Keep Person 00050', exact: true }).check();
  await page.getByLabel('Search contacts').fill('Person 04999');
  await page.getByRole('button', { name: 'Select all 1 matching', exact: true }).click();
  await page.getByLabel('Clear search').click();
  await page.getByLabel('Filter contacts').selectOption('selected');
  await expect(page.locator('tbody tr')).toHaveCount(3);
  await page.getByRole('button', { name: 'Save progress', exact: true }).click();
  await expect(page.getByLabel('Save status')).toContainText('Progress saved');
  await page.reload();
  await page.getByLabel('Filter contacts').selectOption('selected');
  await expect(page.locator('tbody tr')).toHaveCount(3);
  expect(errors).toEqual([]);
});
