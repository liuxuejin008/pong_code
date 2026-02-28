-- Mini-Agile MySQL 初始化脚本
-- 用途：首次部署时创建数据库、用户（可选）和所有表结构
-- 执行示例：
--   mysql -u root -p < sql/init_mysql.sql

-- 1) 建库
CREATE DATABASE IF NOT EXISTS `mini_agile`
  DEFAULT CHARACTER SET utf8mb4
  DEFAULT COLLATE utf8mb4_unicode_ci;

USE `mini_agile`;

-- 2) 可选：建应用账号（已有可跳过）
-- 注意：很多托管 MySQL（或受限 root）不允许 CREATE USER/GRANT。
-- 为保证脚本可直接执行，默认不做账号授权操作。
-- 如你有管理员权限，可手动执行：
-- CREATE USER 'mini_agile_user'@'%' IDENTIFIED BY 'YourPassword';
-- GRANT ALL PRIVILEGES ON `mini_agile`.* TO 'mini_agile_user'@'%';
-- FLUSH PRIVILEGES;

-- 3) 核心表
CREATE TABLE IF NOT EXISTS `user` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `username` VARCHAR(64) NULL,
  `email` VARCHAR(120) NULL,
  `password_hash` VARCHAR(255) NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_user_username` (`username`),
  UNIQUE KEY `uq_user_email` (`email`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `organization` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `name` VARCHAR(64) NULL,
  `owner_id` INT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_organization_name` (`name`),
  KEY `ix_organization_owner_id` (`owner_id`),
  CONSTRAINT `fk_organization_owner_id_user`
    FOREIGN KEY (`owner_id`) REFERENCES `user` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `team` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `name` VARCHAR(64) NULL,
  `description` TEXT NULL,
  `organization_id` INT NULL,
  `created_at` DATETIME NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `ix_team_organization_id` (`organization_id`),
  CONSTRAINT `fk_team_organization_id_organization`
    FOREIGN KEY (`organization_id`) REFERENCES `organization` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `project` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `name` VARCHAR(64) NULL,
  `description` TEXT NULL,
  `organization_id` INT NULL,
  PRIMARY KEY (`id`),
  KEY `ix_project_organization_id` (`organization_id`),
  CONSTRAINT `fk_project_organization_id_organization`
    FOREIGN KEY (`organization_id`) REFERENCES `organization` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `sprint` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `name` VARCHAR(64) NULL,
  `start_date` DATE NULL,
  `end_date` DATE NULL,
  `status` VARCHAR(20) NULL DEFAULT 'active',
  `description` TEXT NULL,
  `goal` TEXT NULL,
  `category` VARCHAR(50) NULL,
  `project_id` INT NULL,
  `owner_id` INT NULL,
  PRIMARY KEY (`id`),
  KEY `ix_sprint_project_id` (`project_id`),
  KEY `ix_sprint_owner_id` (`owner_id`),
  CONSTRAINT `fk_sprint_project_id_project`
    FOREIGN KEY (`project_id`) REFERENCES `project` (`id`),
  CONSTRAINT `fk_sprint_owner_id_user`
    FOREIGN KEY (`owner_id`) REFERENCES `user` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `requirement` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `title` VARCHAR(200) NOT NULL,
  `content` TEXT NOT NULL,
  `priority` INT NULL DEFAULT 3,
  `expected_delivery_date` DATE NULL,
  `status` VARCHAR(20) NULL DEFAULT 'pending',
  `created_at` DATETIME NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `project_id` INT NOT NULL,
  `creator_id` INT NOT NULL,
  `sprint_id` INT NULL,
  PRIMARY KEY (`id`),
  KEY `ix_requirement_project_id` (`project_id`),
  KEY `ix_requirement_creator_id` (`creator_id`),
  KEY `ix_requirement_sprint_id` (`sprint_id`),
  CONSTRAINT `fk_requirement_project_id_project`
    FOREIGN KEY (`project_id`) REFERENCES `project` (`id`),
  CONSTRAINT `fk_requirement_creator_id_user`
    FOREIGN KEY (`creator_id`) REFERENCES `user` (`id`),
  CONSTRAINT `fk_requirement_sprint_id_sprint`
    FOREIGN KEY (`sprint_id`) REFERENCES `sprint` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `issue` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `title` VARCHAR(120) NULL,
  `description` TEXT NULL,
  `status` VARCHAR(20) NULL DEFAULT 'todo',
  `priority` INT NULL DEFAULT 3,
  `time_estimate` INT NULL DEFAULT 0,
  `assignee_id` INT NULL,
  `project_id` INT NULL,
  `sprint_id` INT NULL,
  `requirement_id` INT NULL,
  PRIMARY KEY (`id`),
  KEY `ix_issue_assignee_id` (`assignee_id`),
  KEY `ix_issue_project_id` (`project_id`),
  KEY `ix_issue_sprint_id` (`sprint_id`),
  KEY `ix_issue_requirement_id` (`requirement_id`),
  CONSTRAINT `fk_issue_assignee_id_user`
    FOREIGN KEY (`assignee_id`) REFERENCES `user` (`id`),
  CONSTRAINT `fk_issue_project_id_project`
    FOREIGN KEY (`project_id`) REFERENCES `project` (`id`),
  CONSTRAINT `fk_issue_sprint_id_sprint`
    FOREIGN KEY (`sprint_id`) REFERENCES `sprint` (`id`),
  CONSTRAINT `fk_issue_requirement_id_requirement`
    FOREIGN KEY (`requirement_id`) REFERENCES `requirement` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `bug` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `title` VARCHAR(200) NOT NULL,
  `description` TEXT NOT NULL,
  `severity` INT NULL DEFAULT 3,
  `status` VARCHAR(20) NULL DEFAULT 'open',
  `steps_to_reproduce` TEXT NULL,
  `time_estimate` FLOAT NULL DEFAULT 0,
  `expected_result` TEXT NULL,
  `actual_result` TEXT NULL,
  `environment` VARCHAR(200) NULL,
  `created_at` DATETIME NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `resolved_at` DATETIME NULL,
  `project_id` INT NOT NULL,
  `reporter_id` INT NOT NULL,
  `assignee_id` INT NULL,
  `sprint_id` INT NULL,
  `requirement_id` INT NULL,
  PRIMARY KEY (`id`),
  KEY `ix_bug_project_id` (`project_id`),
  KEY `ix_bug_reporter_id` (`reporter_id`),
  KEY `ix_bug_assignee_id` (`assignee_id`),
  KEY `ix_bug_sprint_id` (`sprint_id`),
  KEY `ix_bug_requirement_id` (`requirement_id`),
  CONSTRAINT `fk_bug_project_id_project`
    FOREIGN KEY (`project_id`) REFERENCES `project` (`id`),
  CONSTRAINT `fk_bug_reporter_id_user`
    FOREIGN KEY (`reporter_id`) REFERENCES `user` (`id`),
  CONSTRAINT `fk_bug_assignee_id_user`
    FOREIGN KEY (`assignee_id`) REFERENCES `user` (`id`),
  CONSTRAINT `fk_bug_sprint_id_sprint`
    FOREIGN KEY (`sprint_id`) REFERENCES `sprint` (`id`),
  CONSTRAINT `fk_bug_requirement_id_requirement`
    FOREIGN KEY (`requirement_id`) REFERENCES `requirement` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `sprint_work_log` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `sprint_id` INT NOT NULL,
  `user_id` INT NOT NULL,
  `date` DATE NULL,
  `created_at` DATETIME NULL DEFAULT CURRENT_TIMESTAMP,
  `hours` FLOAT NOT NULL,
  `description` VARCHAR(255) NULL,
  PRIMARY KEY (`id`),
  KEY `ix_sprint_work_log_sprint_id` (`sprint_id`),
  KEY `ix_sprint_work_log_user_id` (`user_id`),
  CONSTRAINT `fk_sprint_work_log_sprint_id_sprint`
    FOREIGN KEY (`sprint_id`) REFERENCES `sprint` (`id`),
  CONSTRAINT `fk_sprint_work_log_user_id_user`
    FOREIGN KEY (`user_id`) REFERENCES `user` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `work_log` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `issue_id` INT NOT NULL,
  `user_id` INT NOT NULL,
  `date` DATE NULL,
  `created_at` DATETIME NULL DEFAULT CURRENT_TIMESTAMP,
  `hours` FLOAT NOT NULL,
  `description` VARCHAR(255) NULL,
  PRIMARY KEY (`id`),
  KEY `ix_work_log_issue_id` (`issue_id`),
  KEY `ix_work_log_user_id` (`user_id`),
  CONSTRAINT `fk_work_log_issue_id_issue`
    FOREIGN KEY (`issue_id`) REFERENCES `issue` (`id`),
  CONSTRAINT `fk_work_log_user_id_user`
    FOREIGN KEY (`user_id`) REFERENCES `user` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `bug_work_log` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `bug_id` INT NOT NULL,
  `user_id` INT NOT NULL,
  `date` DATE NULL,
  `created_at` DATETIME NULL DEFAULT CURRENT_TIMESTAMP,
  `hours` FLOAT NOT NULL,
  `description` VARCHAR(255) NULL,
  PRIMARY KEY (`id`),
  KEY `ix_bug_work_log_bug_id` (`bug_id`),
  KEY `ix_bug_work_log_user_id` (`user_id`),
  CONSTRAINT `fk_bug_work_log_bug_id_bug`
    FOREIGN KEY (`bug_id`) REFERENCES `bug` (`id`),
  CONSTRAINT `fk_bug_work_log_user_id_user`
    FOREIGN KEY (`user_id`) REFERENCES `user` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 多对多关联表
CREATE TABLE IF NOT EXISTS `organization_members` (
  `user_id` INT NOT NULL,
  `organization_id` INT NOT NULL,
  `role` VARCHAR(20) NULL DEFAULT 'member',
  PRIMARY KEY (`user_id`, `organization_id`),
  KEY `ix_organization_members_org_id` (`organization_id`),
  CONSTRAINT `fk_organization_members_user_id_user`
    FOREIGN KEY (`user_id`) REFERENCES `user` (`id`),
  CONSTRAINT `fk_organization_members_org_id_organization`
    FOREIGN KEY (`organization_id`) REFERENCES `organization` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `team_members` (
  `user_id` INT NOT NULL,
  `team_id` INT NOT NULL,
  `role` VARCHAR(20) NULL DEFAULT 'member',
  PRIMARY KEY (`user_id`, `team_id`),
  KEY `ix_team_members_team_id` (`team_id`),
  CONSTRAINT `fk_team_members_user_id_user`
    FOREIGN KEY (`user_id`) REFERENCES `user` (`id`),
  CONSTRAINT `fk_team_members_team_id_team`
    FOREIGN KEY (`team_id`) REFERENCES `team` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
