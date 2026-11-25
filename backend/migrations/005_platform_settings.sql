-- Réglages globaux de la plateforme (gérés par le Super Admin), ex. coordonnées de paiement affichées aux restaurants
CREATE TABLE platform_settings (
  setting_key VARCHAR(60) NOT NULL,
  setting_value TEXT NOT NULL,
  updated_by BIGINT UNSIGNED NULL,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (setting_key),
  CONSTRAINT fk_platform_settings_user FOREIGN KEY (updated_by) REFERENCES users (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
