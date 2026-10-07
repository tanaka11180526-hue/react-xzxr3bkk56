/**
 * CPA Study Tracker ⇄「CPA学習計画シート」同期スクリプト
 *
 * ・「ToDo・実績」の各行（と復習①〜④の日付）を読み、アプリのカレンダーに予定として渡す（書き込みはしない）
 * ・アプリで計測した勉強時間・休憩を「アプリ記録」タブに1件ずつ書き込む
 *
 * 設定方法は apps-script/README.md を参照。
 */

// アプリの設定にも同じ合言葉を入れる
const TOKEN = 'ここを自分だけの合言葉に変える';
// 同期するスプレッドシートの ID（URL の /d/ と /edit の間）。空ならこのスクリプトを開いたスプレッドシート
const SPREADSHEET_ID = '';

const TODO_SHEET = 'ToDo・実績';
const TODO_FIRST_ROW = 5; // 1〜4行目は見出し
const TODO_COLS = 18;     // A〜R
// ToDo・実績 の列（1始まり）
const C_DATE = 1, C_CAT = 2, C_SUBJECT = 3, C_CONTENT = 4, C_PLAN = 6, C_ACTUAL = 7, C_ACHIEVED = 8, C_MEMO = 9, C_REVIEW = 10;
const REVIEWS = [
  { date: 11, done: 12, label: '復習①' },
  { date: 13, done: 14, label: '復習②' },
  { date: 15, done: 16, label: '復習③' },
  { date: 17, done: 18, label: '復習④' },
];
const SETTINGS_SHEET = '設定';
const SETTINGS_SUBJECT_RANGE = 'C4:C';

const LOG_SHEET = 'アプリ記録';
const LOG_HEADERS = ['ID', '日付', '種類', '科目', '開始', '終了', '分', '手動', 'やること'];
const LOG_TEXT_COLUMNS = 6; // ID〜終了 は文字列のまま保存する

function spreadsheet_() {
  return SPREADSHEET_ID ? SpreadsheetApp.openById(SPREADSHEET_ID) : SpreadsheetApp.getActiveSpreadsheet();
}

function doGet(e) {
  const p = (e && e.parameter) || {};
  if (!isAuthorized_(p.token)) return json_({ ok: false, error: '合言葉が違います' });
  if (p.action === 'ping') return json_({ ok: true });
  if (p.action === 'schedule') {
    const ss = spreadsheet_();
    return json_({ ok: true, items: readSchedule_(ss), subjects: readSubjects_(ss) });
  }
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
  lock.waitLock(30000);
  try {
    writeLogs_(spreadsheet_(), body.upsert || [], body.remove || []);
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

// ── 読み込み ──

function dateKey_(v, tz) {
  if (v instanceof Date) return Utilities.formatDate(v, tz, 'yyyy-MM-dd');
  const m = String(v).trim().match(/^(\d{4})[\/\-.年](\d{1,2})[\/\-.月](\d{1,2})/);
  return m ? m[1] + '-' + ('0' + m[2]).slice(-2) + '-' + ('0' + m[3]).slice(-2) : '';
}

function readTodo_(ss) {
  const sh = ss.getSheetByName(TODO_SHEET);
  if (!sh) throw new Error('「' + TODO_SHEET + '」シートが見つかりません');
  const tz = ss.getSpreadsheetTimeZone();
  const last = sh.getLastRow();
  if (last < TODO_FIRST_ROW) return { sh: sh, tz: tz, rows: [] };
  const range = sh.getRange(TODO_FIRST_ROW, 1, last - TODO_FIRST_ROW + 1, TODO_COLS);
  const values = range.getValues();
  const shown = range.getDisplayValues();
  const rows = values.map(function (v, i) {
    return {
      row: TODO_FIRST_ROW + i,
      date: dateKey_(v[C_DATE - 1], tz),
      category: String(v[C_CAT - 1]).trim(),
      subject: String(v[C_SUBJECT - 1]).trim(),
      content: String(v[C_CONTENT - 1]).trim(),
      plan: shown[i][C_PLAN - 1],
      actual: shown[i][C_ACTUAL - 1],
      achieved: shown[i][C_ACHIEVED - 1],
      memo: String(v[C_MEMO - 1]).trim(),
      review: v[C_REVIEW - 1] === true,
      reviews: REVIEWS.map(function (r) {
        return { date: dateKey_(v[r.date - 1], tz), done: v[r.done - 1] === true, label: r.label };
      }),
    };
  });
  return { sh: sh, tz: tz, rows: rows };
}

function readSchedule_(ss) {
  const items = [];
  readTodo_(ss).rows.forEach(function (r) {
    if (!r.date) return;
    items.push({
      date: r.date, category: r.category, subject: r.subject, content: r.content,
      plan: r.plan, actual: r.actual, achieved: r.achieved, note: r.memo,
    });
    if (!r.review) return;
    r.reviews.forEach(function (rv) {
      if (!rv.date) return;
      items.push({
        date: rv.date, category: rv.label, subject: r.subject, content: r.content + '（' + rv.label + '）',
        done: rv.done, review: true,
      });
    });
  });
  return items;
}

function readSubjects_(ss) {
  const sh = ss.getSheetByName(SETTINGS_SHEET);
  if (!sh) return [];
  return sh.getRange(SETTINGS_SUBJECT_RANGE).getValues()
    .map(function (r) { return String(r[0]).trim(); })
    .filter(function (s) { return s; });
}

// ── 書き込み ──

function logSheet_(ss) {
  let sh = ss.getSheetByName(LOG_SHEET);
  if (!sh) {
    sh = ss.insertSheet(LOG_SHEET);
    sh.getRange(1, 1, 1, LOG_HEADERS.length).setValues([LOG_HEADERS]).setFontWeight('bold');
    sh.setFrozenRows(1);
  }
  return sh;
}

// 「アプリ記録」にアプリの記録を追加・更新・削除する（ID で照合）
function writeLogs_(ss, upsert, remove) {
  const sh = logSheet_(ss);
  const last = sh.getLastRow();
  const index = {};
  if (last > 1) {
    sh.getRange(2, 1, last - 1, 1).getValues().forEach(function (r, i) { index[String(r[0])] = i + 2; });
  }

  const appends = [];
  upsert.forEach(function (r) {
    const id = String(r.id);
    const row = [
      id, String(r.date), r.type === 'break' ? '休憩' : '勉強', String(r.subject || ''),
      String(r.start), String(r.end), Number(r.minutes) || 0, r.manual ? '○' : '', String(r.task || ''),
    ];
    const at = index[id];
    if (at > 0) {
      sh.getRange(at, 1, 1, row.length).setValues([row]);
    } else if (!at) {
      appends.push(row);
      index[id] = -1; // 同じ送信内の重複を防ぐ
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
