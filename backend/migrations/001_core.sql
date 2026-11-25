-- 001_core : plans, restaurants, utilisateurs, paramètres, réinitialisation de mot de passe, journal d'activité
-- Tous les identifiants sont en BIGINT UNSIGNED (TiDB réserve des plages d'AUTO_INCREMENT par lot).

CREATE TABLE subscription_plans (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  code VARCHAR(20) NOT NULL,
  name VARCHAR(60) NOT NULL,
  price_dt DECIMAL(10,3) NOT NULL DEFAULT 0,
  duration_days SMALLINT UNSIGNED NOT NULL,
  is_public TINYINT(1) NOT NULL DEFAULT 1,
  PRIMARY KEY (id),
  UNIQUE KEY uq_plan_code (code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO subscription_plans (code, name, price_dt, duration_days, is_public) VALUES
  ('trial',   'Essai gratuit', 0.000,   3,   0),
  ('monthly', 'Mensuel',       29.000,  30,  1),
  ('yearly',  'Annuel',        290.000, 365, 1);

CREATE TABLE restaurants (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  name VARCHAR(120) NOT NULL,
  slug VARCHAR(80) NOT NULL,
  status ENUM('active','suspended') NOT NULL DEFAULT 'active',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_restaurants_slug (slug),
  KEY idx_restaurants_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE users (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  restaurant_id BIGINT UNSIGNED NULL,
  name VARCHAR(120) NOT NULL,
  email VARCHAR(190) NOT NULL,
  phone VARCHAR(30) NULL,
  password_hash VARCHAR(100) NOT NULL,
  role ENUM('super_admin','owner','manager','editor') NOT NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  token_version INT UNSIGNED NOT NULL DEFAULT 0,
  last_login_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_users_email (email),
  KEY idx_users_restaurant_role (restaurant_id, role),
  CONSTRAINT fk_users_restaurant FOREIGN KEY (restaurant_id) REFERENCES restaurants (id) ON DELETE CASCADE,
  CONSTRAINT chk_users_tenant CHECK (
    (role = 'super_admin' AND restaurant_id IS NULL) OR (role <> 'super_admin' AND restaurant_id IS NOT NULL)
  )
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE restaurant_settings (
  restaurant_id BIGINT UNSIGNED NOT NULL,
  logo_url VARCHAR(500) NULL,
  cover_url VARCHAR(500) NULL,
  description TEXT NULL,
  address VARCHAR(255) NULL,
  phone VARCHAR(30) NULL,
  opening_hours JSON NULL,
  social_links JSON NULL,
  currency VARCHAR(10) NOT NULL DEFAULT 'DT',
  primary_color CHAR(7) NOT NULL DEFAULT '#0B1F4B',
  secondary_color CHAR(7) NOT NULL DEFAULT '#00B8D9',
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (restaurant_id),
  CONSTRAINT fk_settings_restaurant FOREIGN KEY (restaurant_id) REFERENCES restaurants (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE password_resets (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id BIGINT UNSIGNED NOT NULL,
  token_hash CHAR(64) NOT NULL,
  expires_at DATETIME NOT NULL,
  used_at DATETIME NULL,
  requested_ip VARCHAR(45) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_password_resets_token (token_hash),
  KEY idx_password_resets_user (user_id),
  CONSTRAINT fk_password_resets_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE activity_logs (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  restaurant_id BIGINT UNSIGNED NULL,
  user_id BIGINT UNSIGNED NULL,
  action VARCHAR(60) NOT NULL,
  entity VARCHAR(40) NULL,
  entity_id BIGINT UNSIGNED NULL,
  meta JSON NULL,
  ip VARCHAR(45) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_activity_restaurant_date (restaurant_id, created_at),
  KEY idx_activity_user (user_id),
  CONSTRAINT fk_activity_restaurant FOREIGN KEY (restaurant_id) REFERENCES restaurants (id) ON DELETE CASCADE,
  CONSTRAINT fk_activity_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
