/**
 * CPA Study Tracker ⇄「CPA学習計画シート」同期スクリプト
 *
 * ・「ToDo・実績」の各行（と復習①〜④の日付）を、アプリのカレンダーに予定として渡す
 * ・アプリで計測した勉強時間を「アプリ記録」タブに1件ずつ残し、
 *   その合計を「ToDo・実績」の該当行の 実績(分) に書き込む
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
const LOG_HEADERS = ['ID', '日付', '種類', '科目', '開始', '終了', '分', '手動', 'やること', '反映先'];
const L_ID = 0, L_DATE = 1, L_TYPE = 2, L_SUBJECT = 3, L_MIN = 6, L_TASK = 8, L_TARGET = 9;
const LOG_TEXT_COLUMNS = 6; // ID〜終了 は文字列のまま保存する

// 予定から選ばずに科目だけで計測した時間を入れる行の「やること」
const AUTO_TASK = 'アプリ計測';
// 手入力の実績があって書き込まなかった記録の「反映先」に付ける印
const SKIPPED_PREFIX = '未反映：';

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

function writeLogs_(ss, upsert, remove) {
  const sh = logSheet_(ss);
  const last = sh.getLastRow();
  const index = {};
  const touched = {}; // 実績を計算し直す「日付|科目|やること」
  const dates = {};   // 計算し直す日付
  const managed = {}; // これまでにアプリが実績を書き込んだ行
  if (last > 1) {
    sh.getRange(2, 1, last - 1, LOG_HEADERS.length).getValues().forEach(function (r, i) {
      index[String(r[L_ID])] = { row: i + 2, date: String(r[L_DATE]), subject: String(r[L_SUBJECT]), target: String(r[L_TARGET]) };
      if (r[L_TARGET]) managed[r[L_DATE] + '|' + r[L_SUBJECT] + '|' + r[L_TARGET]] = true;
    });
  }
  function touchOld(id) {
    const old = index[id];
    if (!old || old.row < 0) return;
    dates[old.date] = true;
    if (old.target) touched[old.date + '|' + old.subject + '|' + old.target] = true;
  }

  const appends = [];
  upsert.forEach(function (r) {
    const id = String(r.id);
    const row = [
      id, String(r.date), r.type === 'break' ? '休憩' : '勉強', String(r.subject || ''),
      String(r.start), String(r.end), Number(r.minutes) || 0, r.manual ? '○' : '', String(r.task || ''), '',
    ];
    dates[row[L_DATE]] = true;
    touchOld(id);
    const at = index[id];
    if (at && at.row > 0) {
      sh.getRange(at.row, 1, 1, row.length).setValues([row]);
    } else if (!at) {
      appends.push(row);
      index[id] = { row: -1 };
    }
  });
  if (appends.length) {
    const start = sh.getLastRow() + 1;
    sh.getRange(start, 1, appends.length, LOG_TEXT_COLUMNS).setNumberFormat('@');
    sh.getRange(start, 1, appends.length, LOG_HEADERS.length).setValues(appends);
  }

  remove.forEach(function (id) { touchOld(String(id)); });
  remove.map(function (id) { return index[String(id)] && index[String(id)].row; })
    .filter(function (row) { return row > 0; })
    .sort(function (a, b) { return b - a; })
    .forEach(function (row) { sh.deleteRow(row); });

  applyActuals_(ss, sh, Object.keys(dates), touched, managed);
}

// アプリ記録の合計を ToDo・実績 の 実績(分) に反映する
function applyActuals_(ss, logSh, dates, touched, managed) {
  if (!dates.length) return;
  const wanted = {};
  dates.forEach(function (d) { wanted[d] = true; });
  const todo = readTodo_(ss);
  const find = function (date, subject, content) {
    return todo.rows.filter(function (r) { return r.date === date && r.subject === subject && r.content === content; })[0];
  };

  const last = logSh.getLastRow();
  if (last < 2) {
    writeActuals_(todo, find, {}, touched, managed);
    return;
  }
  const logs = logSh.getRange(2, 1, last - 1, LOG_HEADERS.length).getValues();
  const sums = {};
  const targetCol = logs.map(function (r) { return [r[L_TARGET]]; });
  const keyOf = {};
  logs.forEach(function (r, i) {
    const date = String(r[L_DATE]), subject = String(r[L_SUBJECT]);
    if (!wanted[date] || r[L_TYPE] !== '勉強') return;
    let target = '';
    const task = String(r[L_TASK]);
    if (task && find(date, subject, task)) {
      target = task;
    } else {
      const same = todo.rows.filter(function (t) { return t.date === date && t.subject === subject && t.content !== AUTO_TASK; });
      target = same.length === 1 ? same[0].content : AUTO_TASK;
    }
    const key = date + '|' + subject + '|' + target;
    sums[key] = (sums[key] || 0) + (Number(r[L_MIN]) || 0);
    keyOf[i] = { key: key, target: target };
  });
  const skipped = writeActuals_(todo, find, sums, touched, managed);
  Object.keys(keyOf).forEach(function (i) {
    // 手入力の実績があって書き込まなかった分は、反映先に「未反映」と残す
    targetCol[i][0] = skipped[keyOf[i].key] ? SKIPPED_PREFIX + keyOf[i].target : keyOf[i].target;
  });
  logSh.getRange(2, L_TARGET + 1, targetCol.length, 1).setValues(targetCol);
}

// 手で入れた実績は上書きしない（空欄か、前にアプリが書いた行だけ書き換える）
function writeActuals_(todo, find, sums, touched, managed) {
  const skipped = {};
  const keys = {};
  Object.keys(sums).forEach(function (k) { keys[k] = true; });
  Object.keys(touched).forEach(function (k) { keys[k] = true; });
  Object.keys(keys).forEach(function (key) {
    const parts = key.split('|');
    const date = parts[0], subject = parts[1], content = parts.slice(2).join('|');
    const minutes = Math.round(sums[key] || 0);
    let row = find(date, subject, content);
    if (!row && content === AUTO_TASK && minutes > 0) row = addAutoRow_(todo, date, subject);
    if (!row) return;
    if (content === AUTO_TASK && minutes === 0) {
      // 計測がなくなった「アプリ計測」行は空に戻す
      todo.sh.getRange(row.row, C_DATE, 1, C_CONTENT).clearContent();
      todo.sh.getRange(row.row, C_ACTUAL).clearContent();
      row.date = '';
      return;
    }
    if (content !== AUTO_TASK && row.actual !== '' && !managed[key]) {
      skipped[key] = true;
      return;
    }
    todo.sh.getRange(row.row, C_ACTUAL).setValue(minutes > 0 ? minutes : '');
    row.actual = minutes > 0 ? String(minutes) : '';
  });
  return skipped;
}

function addAutoRow_(todo, date, subject) {
  let target = todo.rows.filter(function (r) { return !r.date && !r.subject && !r.content; })[0];
  const rowNum = target ? target.row : todo.sh.getLastRow() + 1;
  const day = Utilities.parseDate(date, todo.tz, 'yyyy-MM-dd');
  todo.sh.getRange(rowNum, C_DATE, 1, C_CONTENT).setValues([[day, '自習', subject, AUTO_TASK]]);
  if (target) {
    target.date = date; target.subject = subject; target.content = AUTO_TASK; target.category = '自習';
    return target;
  }
  const added = { row: rowNum, date: date, subject: subject, content: AUTO_TASK, category: '自習' };
  todo.rows.push(added);
  return added;
}
