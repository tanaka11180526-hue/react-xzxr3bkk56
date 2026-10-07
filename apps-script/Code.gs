/**
 * CPA Study Tracker ⇄ Google スプレッドシート 同期スクリプト
 *
 * ・アプリは「予定」シートを読み込んでカレンダーに表示する
 * ・アプリで計測した勉強時間／休憩は「記録」シートに書き込まれる
 *
 * 設定方法は apps-script/README.md を参照。
 */

// ↓ 自分だけの合言葉に変えてください（アプリの設定にも同じものを入れる）
const TOKEN = 'ここを自分だけの合言葉に変える';

const SCHEDULE_SHEET = '予定';
const LOG_SHEET = '記録';
const SCHEDULE_HEADERS = ['日付', '開始', '終了', '科目', '内容', 'メモ'];
const LOG_HEADERS = ['ID', '日付', '種類', '科目', '開始', '終了', '分', '手動', '科目ID'];
const LOG_TEXT_COLUMNS = 6; // ID〜終了 は文字列として保存する（日付や時刻への自動変換を防ぐ）

/** 最初に一度だけ実行：シートと見出しを用意する */
function setup() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  ensureSheet_(ss, SCHEDULE_SHEET, SCHEDULE_HEADERS);
  ensureSheet_(ss, LOG_SHEET, LOG_HEADERS).getRange(1, 1, 1000, LOG_TEXT_COLUMNS).setNumberFormat('@');
}

function doGet(e) {
  const p = (e && e.parameter) || {};
  if (!isAuthorized_(p.token)) return json_({ ok: false, error: '合言葉が違います' });
  if (p.action === 'ping') return json_({ ok: true });
  if (p.action === 'schedule') return json_({ ok: true, items: readSchedule_() });
  return json_({ ok: false, error: '不明な操作です' });
}

function doPost(e) {
  let body;
  try {
    body = JSON.parse(e.postData.contents);
  } catch (err) {
    return json_({ ok: false, error: '送信データを読めませんでした' });
  }
  if (!isAuthorized_(body.token)) return json_({ ok: false, error: '合言葉が違います' });
  if (body.action !== 'logs') return json_({ ok: false, error: '不明な操作です' });

  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    writeLogs_(body.upsert || [], body.remove || []);
  } finally {
    lock.releaseLock();
  }
  return json_({ ok: true });
}

function isAuthorized_(token) {
  return typeof token === 'string' && token.length > 0 && token === TOKEN && TOKEN !== 'ここを自分だけの合言葉に変える';
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

function ensureSheet_(ss, name, headers) {
  let sh = ss.getSheetByName(name);
  if (!sh) sh = ss.insertSheet(name);
  if (sh.getLastRow() === 0) {
    sh.getRange(1, 1, 1, headers.length).setValues([headers]).setFontWeight('bold');
    sh.setFrozenRows(1);
  }
  return sh;
}

function readSchedule_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sh = ss.getSheetByName(SCHEDULE_SHEET);
  if (!sh || sh.getLastRow() < 2) return [];
  const tz = ss.getSpreadsheetTimeZone();
  const range = sh.getRange(2, 1, sh.getLastRow() - 1, SCHEDULE_HEADERS.length);
  const values = range.getValues();
  // 時刻セルは getValues だとタイムゾーンの扱いでずれることがあるため、表示どおりの文字列を使う
  const shown = range.getDisplayValues();
  const items = [];
  values.forEach(function (r, i) {
    const date = toDateKey_(r[0], tz);
    if (!date) return;
    items.push({
      date: date,
      start: toClock_(shown[i][1]),
      end: toClock_(shown[i][2]),
      subject: String(shown[i][3]).trim(),
      content: String(shown[i][4]).trim(),
      note: String(shown[i][5]).trim(),
    });
  });
  return items;
}

function toDateKey_(v, tz) {
  if (v instanceof Date) return Utilities.formatDate(v, tz, 'yyyy-MM-dd');
  const m = String(v).trim().match(/^(\d{4})[\/\-.年](\d{1,2})[\/\-.月](\d{1,2})/);
  return m ? m[1] + '-' + ('0' + m[2]).slice(-2) + '-' + ('0' + m[3]).slice(-2) : '';
}

function toClock_(s) {
  const m = String(s).trim().match(/^(\d{1,2}):(\d{2})/);
  return m ? ('0' + m[1]).slice(-2) + ':' + m[2] : '';
}

function writeLogs_(upsert, remove) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sh = ensureSheet_(ss, LOG_SHEET, LOG_HEADERS);
  const last = sh.getLastRow();
  const index = {};
  if (last > 1) {
    sh.getRange(2, 1, last - 1, 1).getValues().forEach(function (r, i) { index[String(r[0])] = i + 2; });
  }

  const appends = [];
  upsert.forEach(function (r) {
    const row = [
      String(r.id), String(r.date), r.type === 'break' ? '休憩' : '勉強', String(r.subject || ''),
      String(r.start), String(r.end), Number(r.minutes) || 0, r.manual ? '○' : '', String(r.subjectId || ''),
    ];
    const at = index[row[0]];
    if (at > 0) {
      sh.getRange(at, 1, 1, row.length).setValues([row]);
    } else if (!at) {
      appends.push(row);
      index[row[0]] = -1; // 同じ送信内の重複を防ぐ
    }
  });
  if (appends.length) {
    const start = sh.getLastRow() + 1;
    sh.getRange(start, 1, appends.length, LOG_TEXT_COLUMNS).setNumberFormat('@');
    sh.getRange(start, 1, appends.length, LOG_HEADERS.length).setValues(appends);
  }

  // 下の行から消さないと行番号がずれる
  remove.map(function (id) { return index[String(id)]; })
    .filter(function (row) { return row > 0; })
    .sort(function (a, b) { return b - a; })
    .forEach(function (row) { sh.deleteRow(row); });
}
