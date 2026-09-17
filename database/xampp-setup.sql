CREATE DATABASE IF NOT EXISTS edupath_xi CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER IF NOT EXISTS 'edupath_app'@'localhost' IDENTIFIED BY 'EduPathDev123!';
CREATE USER IF NOT EXISTS 'edupath_app'@'127.0.0.1' IDENTIFIED BY 'EduPathDev123!';
GRANT ALL PRIVILEGES ON edupath_xi.* TO 'edupath_app'@'localhost';
GRANT ALL PRIVILEGES ON edupath_xi.* TO 'edupath_app'@'127.0.0.1';
FLUSH PRIVILEGES;
