CREATE TABLE IF NOT EXISTS SYSTEM_SETTINGS (
    setting_key TEXT PRIMARY KEY,
    setting_value TEXT NOT NULL,
    description TEXT,
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

INSERT OR IGNORE INTO SYSTEM_SETTINGS
    (setting_key, setting_value, description)
VALUES
    ('approval_LATE', '1', 'Đi muộn cần phê duyệt'),

    ('approval_EARLY_LEAVE', '1', 'Về sớm cần phê duyệt'),

    ('approval_MORNING_LEAVE', '1', 'Nghỉ buổi sáng cần phê duyệt'),

    ('approval_AFTERNOON_LEAVE', '1', 'Nghỉ buổi chiều cần phê duyệt'),

    ('approval_FULL_DAY_LEAVE', '1', 'Nghỉ cả ngày cần phê duyệt'),

    ('approval_ANNUAL_LEAVE', '1', 'Nghỉ phép nhiều ngày cần phê duyệt'),

    ('approval_REMOTE', '1', 'Làm từ xa cần phê duyệt');