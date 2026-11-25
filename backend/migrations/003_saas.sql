-- 003_saas : QR codes, abonnements, paiements manuels, statistiques de consultation, support

CREATE TABLE qr_codes (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  restaurant_id BIGINT UNSIGNED NOT NULL,
  -- NULL = QR Code principal du restaurant ; sinon étiquette de table (ex. "12", "Terrasse 3")
  table_label VARCHAR(40) NULL,
  style JSON NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_qr_table (restaurant_id, table_label),
  CONSTRAINT fk_qr_restaurant FOREIGN KEY (restaurant_id) REFERENCES restaurants (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE subscriptions (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  restaurant_id BIGINT UNSIGNED NOT NULL,
  plan_id BIGINT UNSIGNED NOT NULL,
  status ENUM('trial','active','expired','cancelled') NOT NULL,
  starts_at DATETIME NOT NULL,
  ends_at DATETIME NOT NULL,
  activated_by BIGINT UNSIGNED NULL,
  notes VARCHAR(255) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_subscriptions_tenant (id, restaurant_id),
  KEY idx_subscriptions_restaurant (restaurant_id, id),
  KEY idx_subscriptions_status_end (status, ends_at),
  CONSTRAINT fk_subscriptions_restaurant FOREIGN KEY (restaurant_id) REFERENCES restaurants (id) ON DELETE CASCADE,
  CONSTRAINT fk_subscriptions_plan FOREIGN KEY (plan_id) REFERENCES subscription_plans (id),
  CONSTRAINT fk_subscriptions_admin FOREIGN KEY (activated_by) REFERENCES users (id) ON DELETE SET NULL,
  CONSTRAINT chk_subscriptions_dates CHECK (ends_at > starts_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Paiements enregistrés manuellement par le Super Admin (aucune intégration bancaire)
CREATE TABLE subscription_payments (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  restaurant_id BIGINT UNSIGNED NOT NULL,
  subscription_id BIGINT UNSIGNED NOT NULL,
  amount_dt DECIMAL(10,3) NOT NULL,
  method VARCHAR(30) NOT NULL DEFAULT 'manual',
  reference VARCHAR(100) NULL,
  paid_at DATETIME NOT NULL,
  recorded_by BIGINT UNSIGNED NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_payments_restaurant (restaurant_id, paid_at),
  CONSTRAINT fk_payments_subscription FOREIGN KEY (subscription_id, restaurant_id) REFERENCES subscriptions (id, restaurant_id) ON DELETE CASCADE,
  CONSTRAINT fk_payments_restaurant FOREIGN KEY (restaurant_id) REFERENCES restaurants (id) ON DELETE CASCADE,
  CONSTRAINT fk_payments_user FOREIGN KEY (recorded_by) REFERENCES users (id) ON DELETE SET NULL,
  CONSTRAINT chk_payments_amount CHECK (amount_dt >= 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Aucune donnée personnelle : seulement un horodatage, la table éventuelle et un hash de visiteur salé et quotidien
CREATE TABLE menu_views (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  restaurant_id BIGINT UNSIGNED NOT NULL,
  viewed_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  table_label VARCHAR(40) NULL,
  visitor_hash CHAR(64) NULL,
  PRIMARY KEY (id),
  KEY idx_menu_views_restaurant_date (restaurant_id, viewed_at),
  CONSTRAINT fk_menu_views_restaurant FOREIGN KEY (restaurant_id) REFERENCES restaurants (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE support_tickets (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  restaurant_id BIGINT UNSIGNED NOT NULL,
  user_id BIGINT UNSIGNED NULL,
  subject VARCHAR(150) NOT NULL,
  message TEXT NOT NULL,
  status ENUM('open','in_progress','resolved','closed') NOT NULL DEFAULT 'open',
  admin_reply TEXT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_tickets_restaurant (restaurant_id, status),
  KEY idx_tickets_status (status, created_at),
  CONSTRAINT fk_tickets_restaurant FOREIGN KEY (restaurant_id) REFERENCES restaurants (id) ON DELETE CASCADE,
  CONSTRAINT fk_tickets_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
