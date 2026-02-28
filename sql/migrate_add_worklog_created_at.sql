-- 已有库增量迁移：为工时记录增加登记时间（created_at）
-- 执行：
--   mysql -h mysql.ops.lizhi.fm -u root -p mini_agile < sql/migrate_add_worklog_created_at.sql

USE `mini_agile`;

ALTER TABLE `work_log`
  ADD COLUMN `created_at` DATETIME NULL DEFAULT CURRENT_TIMESTAMP AFTER `date`;

ALTER TABLE `bug_work_log`
  ADD COLUMN `created_at` DATETIME NULL DEFAULT CURRENT_TIMESTAMP AFTER `date`;

ALTER TABLE `sprint_work_log`
  ADD COLUMN `created_at` DATETIME NULL DEFAULT CURRENT_TIMESTAMP AFTER `date`;

-- 回填历史数据：若 created_at 为空，用 date 的 00:00:00 回填
UPDATE `work_log`
SET `created_at` = CONCAT(`date`, ' 00:00:00')
WHERE `created_at` IS NULL AND `date` IS NOT NULL;

UPDATE `bug_work_log`
SET `created_at` = CONCAT(`date`, ' 00:00:00')
WHERE `created_at` IS NULL AND `date` IS NOT NULL;

UPDATE `sprint_work_log`
SET `created_at` = CONCAT(`date`, ' 00:00:00')
WHERE `created_at` IS NULL AND `date` IS NOT NULL;
