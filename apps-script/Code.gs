/**
 * CPA Study Tracker ⇄「CPA学習計画シート」同期スクリプト
 *
 * ・「ToDo・実績」の各行（と復習①〜④の日付）を読み、アプリのカレンダーに予定として渡す
 * ・アプリで計測した勉強時間・休憩を「アプリ記録」タブに1件ずつ書き込む
 * ・アプリで「終わった」を押したタスクは、「ToDo・実績」の達成（H列）か復習の済チェックだけを書き換える
 * ・レポートの「ひとこと」を「アプリメモ」タブに書き込む
 * ・「答練結果」「答練の小問」タブ（Claude が書く）を読み、アプリの記録タブに渡す
 *
 * 設定方法は apps-script/README.md を参照。
 */

// このスクリプトの版。アプリはこの数字を見て、使える機能を決める
const VERSION = 7;

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

const NOTE_SHEET = 'アプリメモ';
const NOTE_HEADERS = ['日付', 'ひとこと', '更新'];
const DONE_MARK = '〇';

// 答練（Claude が書くタブ。アプリは読むだけ）
const EXAM_SHEET = '答練結果';
const EXAM_KEYS = ['id', 'date', 'subject', 'name', 'part', 'topic', 'score', 'full', 'avg', 'pass', 'dev', 'rate', 'rank', 'takers', 'grade'];
const EXAM_ITEM_SHEET = '答練の小問';
const EXAM_ITEM_KEYS = ['id', 'subject', 'part', 'q', 'sub', 'topic', 'kind', 'full', 'score', 'avg', 'diff', 'correct', 'level', 'miss', 'memo', 'reviewed', 'field'];

function spreadsheet_() {
  return SPREADSHEET_ID ? SpreadsheetApp.openById(SPREADSHEET_ID) : SpreadsheetApp.getActiveSpreadsheet();
}

function doGet(e) {
  const p = (e && e.parameter) || {};
  if (!isAuthorized_(p.token)) return json_({ ok: false, error: '合言葉が違います' });
  if (p.action === 'ping') return json_({ ok: true, version: VERSION });
  if (p.action === 'schedule') {
    const ss = spreadsheet_();
    return json_({ ok: true, version: VERSION, items: readSchedule_(ss), subjects: readSubjects_(ss) });
  }
  if (p.action === 'exams') {
    const ss = spreadsheet_();
    return json_({ ok: true, version: VERSION, results: readTable_(ss, EXAM_SHEET, EXAM_KEYS), items: readTable_(ss, EXAM_ITEM_SHEET, EXAM_ITEM_KEYS) });
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
  const actions = {
    logs: function (ss) { writeLogs_(ss, body.upsert || [], body.remove || []); },
    done: function (ss) { writeDone_(ss, body); },
    notes: function (ss) { writeNotes_(ss, body.notes || []); },
  };
  if (!actions[body.action]) return json_({ ok: false, error: '不明な操作です' });

  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    actions[body.action](spreadsheet_());
  } catch (err) {
    return json_({ ok: false, error: err.message });
  } finally {
    lock.releaseLock();
  }
  return json_({ ok: true, version: VERSION });
}

function isAuthorized_(token) {
  return typeof token === 'string' && token.length > 0 && token === TOKEN && TOKEN !== 'ここを自分だけの合言葉に変える';
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

// ── 読み込み ──

// 日付セルを "yyyy-MM-dd" にする。日付オブジェクトとして読めなければ、表示されている文字から読む
function dateKey_(v, tz, shown) {
  if (v && typeof v.getTime === 'function' && !isNaN(v.getTime())) return Utilities.formatDate(v, tz, 'yyyy-MM-dd');
  const texts = [String(v), String(shown || '')];
  for (let i = 0; i < texts.length; i++) {
    const m = texts[i].trim().match(/^(\d{4})[\/\-.年](\d{1,2})[\/\-.月](\d{1,2})/);
    if (m) return m[1] + '-' + ('0' + m[2]).slice(-2) + '-' + ('0' + m[3]).slice(-2);
  }
  return '';
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
      date: dateKey_(v[C_DATE - 1], tz, shown[i][C_DATE - 1]),
      category: String(v[C_CAT - 1]).trim(),
      subject: String(v[C_SUBJECT - 1]).trim(),
      content: String(v[C_CONTENT - 1]).trim(),
      plan: shown[i][C_PLAN - 1],
      actual: shown[i][C_ACTUAL - 1],
      achieved: shown[i][C_ACHIEVED - 1],
      memo: String(v[C_MEMO - 1]).trim(),
      review: v[C_REVIEW - 1] === true,
      reviews: REVIEWS.map(function (r) {
        return { date: dateKey_(v[r.date - 1], tz, shown[i][r.date - 1]), done: v[r.done - 1] === true, label: r.label };
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
      plan: r.plan, actual: r.actual, achieved: r.achieved, note: r.memo, row: r.row, src: r.content,
    });
    if (!r.review) return;
    r.reviews.forEach(function (rv, i) {
      if (!rv.date) return;
      items.push({
        date: rv.date, category: rv.label, subject: r.subject, content: r.content + '（' + rv.label + '）',
        done: rv.done, review: true, row: r.row, reviewIndex: i, src: r.content,
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

// 1行目が見出しの表を、keys の名前を付けて読む（数字は数のまま、日付は yyyy-mm-dd）
function readTable_(ss, name, keys) {
  const sh = ss.getSheetByName(name);
  if (!sh || sh.getLastRow() < 2) return [];
  const tz = ss.getSpreadsheetTimeZone();
  const cols = Math.min(keys.length, sh.getMaxColumns());
  const range = sh.getRange(2, 1, sh.getLastRow() - 1, cols);
  const values = range.getValues();
  const shown = range.getDisplayValues();
  return values.filter(function (v) { return String(v[0]).trim(); }).map(function (v, i) {
    const o = {};
    keys.forEach(function (k, j) {
      const x = j < cols ? v[j] : '';
      o[k] = k === 'date' ? dateKey_(x, tz, j < cols ? shown[i][j] : '') : typeof x === 'number' || typeof x === 'boolean' ? x : String(x).trim();
    });
    return o;
  });
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

// アプリで「終わった」を押したとき、その行の達成（H列）か、復習の済チェックだけを書き換える。
// 行番号がずれていたら書き換えない（アプリが予定を読み直してからやり直す）
function writeDone_(ss, body) {
  const sh = ss.getSheetByName(TODO_SHEET);
  if (!sh) throw new Error('「' + TODO_SHEET + '」シートが見つかりません');
  const row = Number(body.row);
  if (!(row >= TODO_FIRST_ROW) || row > sh.getLastRow()) throw new Error('予定の行が見つかりません');
  const tz = ss.getSpreadsheetTimeZone();
  const range = sh.getRange(row, 1, 1, TODO_COLS);
  const v = range.getValues()[0], shown = range.getDisplayValues()[0];
  const review = body.reviewIndex === undefined || body.reviewIndex === null ? null : REVIEWS[Number(body.reviewIndex)];
  const dateCol = review ? review.date : C_DATE;
  if (String(v[C_CONTENT - 1]).trim() !== String(body.content || '').trim()
      || dateKey_(v[dateCol - 1], tz, shown[dateCol - 1]) !== String(body.date || '')) {
    throw new Error('シートの予定が変わっています。予定を読み直してからもう一度押してください');
  }
  if (review) sh.getRange(row, review.done).setValue(!!body.value);
  else sh.getRange(row, C_ACHIEVED).setValue(body.value ? DONE_MARK : '');
}

// レポートの「ひとこと」を「アプリメモ」に書く（日付で照合。空なら行を消す）
function writeNotes_(ss, notes) {
  let sh = ss.getSheetByName(NOTE_SHEET);
  if (!sh) {
    sh = ss.insertSheet(NOTE_SHEET);
    sh.getRange(1, 1, 1, NOTE_HEADERS.length).setValues([NOTE_HEADERS]).setFontWeight('bold');
    sh.setFrozenRows(1);
  }
  const last = sh.getLastRow();
  const index = {};
  if (last > 1) {
    sh.getRange(2, 1, last - 1, 1).getDisplayValues().forEach(function (r, i) { index[r[0]] = i + 2; });
  }
  const stamp = Utilities.formatDate(new Date(), ss.getSpreadsheetTimeZone(), 'yyyy-MM-dd HH:mm');
  const removes = [];
  notes.forEach(function (n) {
    const date = String(n.date || ''), text = String(n.text || '').trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return;
    const at = index[date];
    if (!text) { if (at) removes.push(at); return; }
    if (at) {
      sh.getRange(at, 2, 1, 2).setValues([[text, stamp]]);
    } else {
      const r = sh.getLastRow() + 1;
      sh.getRange(r, 1).setNumberFormat('@');
      sh.getRange(r, 1, 1, 3).setValues([[date, text, stamp]]);
      index[date] = r;
    }
  });
  removes.sort(function (a, b) { return b - a; }).forEach(function (r) { sh.deleteRow(r); });
}
