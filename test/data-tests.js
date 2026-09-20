// ScoreMate データ処理テスト
// 実行: node test/data-tests.js
// jsdom + fake-indexeddb 上で index.html のグローバル関数を直接呼び出して検証する。
// 「データを失わないこと」を最優先で検証する（要件書 第13章）。

const fs = require('fs');
const path = require('path');
const assert = require('assert');
const { JSDOM } = require('jsdom');

const html = fs.readFileSync(path.join(__dirname, '../index.html'), 'utf8');

async function setup() {
  const FDBFactory = require('fake-indexeddb/lib/FDBFactory');
  const dom = new JSDOM(html, {
    runScripts: 'dangerously',
    url: 'https://example.com/',
    pretendToBeVisual: true,
    beforeParse(window) {
      window.indexedDB = new FDBFactory();
    },
  });
  const { window } = dom;
  // File System Access API / Google認証など、ブラウザ専用APIは未定義のままでよい
  // （コード側が `'showSaveFilePicker' in window` 等で存在チェックしているため安全）
  await new Promise(resolve => {
    if (window.document.readyState === 'complete') resolve();
    else window.addEventListener('load', resolve);
  });
  // 初期化IIFE（openIdb等）の完了を待つ
  await new Promise(r => setTimeout(r, 300));
  // let宣言のグローバル変数はwindowのプロパティにならないため、参照用にエイリアスする
  window.eval('window.db = db; window.composerMaster = composerMaster; window.partMaster = partMaster;');
  return window;
}

let passed = 0, failed = 0;
async function test(name, fn) {
  try {
    await fn();
    console.log('  OK  ' + name);
    passed++;
  } catch (err) {
    console.log('  NG  ' + name);
    console.log('      ' + err.message);
    failed++;
  }
}

async function main() {
  console.log('== ScoreMate データ処理テスト ==\n');
  const w = await setup();

  await test('楽曲・楽譜の登録', async () => {
    const work = await w.addOrGetWork({ title: 'テスト曲A', composer: '作曲家A' });
    const score = await w.addScore({ workId: work.id, partName: 'Flute', memo: '', imageFileId: null, imageType: null, imageFileName: null });
    assert.ok(w.db.works.find(x => x.id === work.id), '作品が登録されていること');
    assert.ok(w.db.scores.find(x => x.id === score.id), '楽譜が登録されていること');
    assert.strictEqual(w.db.composers.filter(c => c.name === '作曲家A').length, 1, '作曲家が重複せず1件であること');
  });

  await test('同じ曲名は作品を共有する', async () => {
    const before = w.db.works.length;
    const work = await w.addOrGetWork({ title: 'テスト曲A', composer: '作曲家A' });
    await w.addScore({ workId: work.id, partName: 'Clarinet', memo: '', imageFileId: null, imageType: null, imageFileName: null });
    assert.strictEqual(w.db.works.length, before, '作品数が増えていないこと（共有されること）');
  });

  let deletedScoreId, fileId;
  await test('楽譜削除後もファイル本体は残る', async () => {
    const work = await w.addOrGetWork({ title: 'テスト曲B', composer: '作曲家B' });
    const blob = new w.Blob(['dummy'], { type: 'application/pdf' });
    blob.type = 'application/pdf';
    const saved = await w.saveImageFile(blob);
    fileId = saved.id;
    const score = await w.addScore({ workId: work.id, partName: 'Oboe', memo: '', imageFileId: saved.id, imageType: 'application/pdf', imageFileName: saved.fileName });
    deletedScoreId = score.id;
    await w.deleteScore(score.id);
    assert.ok(!w.db.scores.find(x => x.id === deletedScoreId), '楽譜自体は削除されていること');
    const fileRec = await w.idbGet('files', fileId);
    assert.ok(fileRec, 'ファイル本体はIndexedDBに残っていること');
  });

  await test('マスタ統合で参照が付け替わる', async () => {
    const work = await w.addOrGetWork({ title: 'テスト曲C', composer: '仮の表記' });
    const composerA = w.db.composers.find(c => c.name === '仮の表記');
    const composerB = await w.composerMaster.addOrGet('正式な表記');
    await w.mergeComposerInto(composerA.id, composerB.id);
    const updatedWork = w.db.works.find(x => x.id === work.id);
    assert.strictEqual(updatedWork.composer_id, composerB.id, '作品の参照が統合先に付け替わっていること');
    assert.ok(!w.db.composers.find(c => c.id === composerA.id), '統合元は削除されていること');
  });

  await test('バックアップ書き出し→取り込みでデータ件数が変わらない', async () => {
    const beforeWorks = w.db.works.length;
    const beforeScores = w.db.scores.length;
    const data = await w.buildExportData();
    await w.applyRemoteWithLocalOverlay(data);
    assert.strictEqual(w.db.works.length, beforeWorks, '作品数が変わらないこと');
    assert.strictEqual(w.db.scores.length, beforeScores, '楽譜数が変わらないこと');
  });

  await test('不正な形式のバックアップは拒否される', async () => {
    const invalid = { works: 'not-an-array' };
    const result = w.validateBackupData(invalid);
    assert.strictEqual(result.ok, false, '不正データが ok:false になること');
  });

  await test('壊れたリモートデータで既存データが破壊されない（ケース10）', async () => {
    const beforeWorks = JSON.parse(JSON.stringify(w.db.works));
    let threw = false;
    try {
      await w.applyRemoteWithLocalOverlay({ works: 'broken' });
    } catch (err) {
      threw = true;
    }
    assert.ok(threw, '不正データ適用時に例外が発生すること');
    assert.strictEqual(w.db.works.length, beforeWorks.length, '既存データの件数が変化していないこと');
  });

  await test('診断：存在しない作曲家参照を修復できる', async () => {
    const work = await w.addOrGetWork({ title: 'テスト曲D', composer: '一時的な作曲家' });
    const composer = w.db.composers.find(c => c.id === work.composer_id);
    await w.idbDelete('composers', composer.id);
    w.db.composers = w.db.composers.filter(c => c.id !== composer.id);
    const issues = await w.runDiagnostics();
    const issue = issues.find(i => i.key === 'orphan_composer');
    assert.ok(issue, '不整合が検出されること');
    await issue.fix();
    const fixedWork = w.db.works.find(x => x.id === work.id);
    assert.strictEqual(fixedWork.composer_id, null, '修復後は参照がnullになること');
  });

  console.log(`\n合計: ${passed}件成功 / ${failed}件失敗`);
  process.exit(failed > 0 ? 1 : 0);
}

main().catch(err => { console.error(err); process.exit(1); });
