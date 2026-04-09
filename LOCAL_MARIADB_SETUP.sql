-- Local MariaDB setup for POS Bengkel
-- Adjust the password if needed before running.

CREATE DATABASE IF NOT EXISTS pos_bengkel_local
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

CREATE DATABASE IF NOT EXISTS pos_bengkel_go_local
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

-- Optional shared user for both Laravel and Go local development.
-- If you already use root locally, you can skip this block.
CREATE USER IF NOT EXISTS 'pos_bengkel'@'localhost' IDENTIFIED BY 'pos_bengkel_password';
CREATE USER IF NOT EXISTS 'pos_bengkel'@'127.0.0.1' IDENTIFIED BY 'pos_bengkel_password';

GRANT ALL PRIVILEGES ON pos_bengkel_local.* TO 'pos_bengkel'@'localhost';
GRANT ALL PRIVILEGES ON pos_bengkel_go_local.* TO 'pos_bengkel'@'localhost';
GRANT ALL PRIVILEGES ON pos_bengkel_local.* TO 'pos_bengkel'@'127.0.0.1';
GRANT ALL PRIVILEGES ON pos_bengkel_go_local.* TO 'pos_bengkel'@'127.0.0.1';

FLUSH PRIVILEGES;

-- Suggested local env values:
-- Laravel:
-- DB_HOST=127.0.0.1
-- DB_PORT=3306
-- DB_DATABASE=pos_bengkel_local
-- DB_USERNAME=pos_bengkel
-- DB_PASSWORD=pos_bengkel_password
--
-- Go:
-- DB_HOST=127.0.0.1
-- DB_PORT=3306
-- DB_DATABASE=pos_bengkel_go_local
-- DB_USERNAME=pos_bengkel
-- DB_PASSWORD=pos_bengkel_password
