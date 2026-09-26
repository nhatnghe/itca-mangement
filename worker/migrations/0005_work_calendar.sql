-- =========================================================
-- ITCA-Management - Work calendar configuration
-- =========================================================

-- Giờ làm việc
INSERT OR IGNORE INTO SYSTEM_SETTINGS (setting_key, setting_value)
VALUES ('work_morning_start', '08:00');

INSERT OR IGNORE INTO SYSTEM_SETTINGS (setting_key, setting_value)
VALUES ('work_morning_end', '11:30');

INSERT OR IGNORE INTO SYSTEM_SETTINGS (setting_key, setting_value)
VALUES ('work_afternoon_start', '13:00');

INSERT OR IGNORE INTO SYSTEM_SETTINGS (setting_key, setting_value)
VALUES ('work_afternoon_end', '17:00');


-- Ngày làm việc trong tuần.
-- Quy ước:
-- 1 = Thứ Hai
-- 2 = Thứ Ba
-- 3 = Thứ Tư
-- 4 = Thứ Năm
-- 5 = Thứ Sáu
-- 6 = Thứ Bảy
-- 0 = Chủ Nhật
INSERT OR IGNORE INTO SYSTEM_SETTINGS (setting_key, setting_value)
VALUES ('work_weekdays', '[1,2,3,4,5]');


-- Ngày ngoại lệ.
-- is_working = 0: ngày nghỉ theo QĐ / ngày lễ
-- is_working = 1: ngày làm việc đặc biệt / làm bù
CREATE TABLE IF NOT EXISTS WORK_CALENDAR_DAYS (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  work_date TEXT NOT NULL UNIQUE,
  is_working INTEGER NOT NULL DEFAULT 0
    CHECK (is_working IN (0, 1)),
  name TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_work_calendar_days_date
ON WORK_CALENDAR_DAYS(work_date);