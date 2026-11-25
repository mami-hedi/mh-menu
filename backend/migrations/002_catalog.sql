-- 002_catalog : menu, catégories, produits, images, variantes, suppléments
-- Isolation au niveau base : chaque table enfant référence (id, restaurant_id) du parent.
-- Une ligne ne peut donc jamais pointer vers le produit/la catégorie d'un autre restaurant.

CREATE TABLE menus (
  restaurant_id BIGINT UNSIGNED NOT NULL,
  template ENUM('classic','modern','compact') NOT NULL DEFAULT 'classic',
  cart_enabled TINYINT(1) NOT NULL DEFAULT 1,
  is_published TINYINT(1) NOT NULL DEFAULT 1,
  allow_indexing TINYINT(1) NOT NULL DEFAULT 0,
  show_popular TINYINT(1) NOT NULL DEFAULT 1,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (restaurant_id),
  CONSTRAINT fk_menus_restaurant FOREIGN KEY (restaurant_id) REFERENCES restaurants (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE categories (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  restaurant_id BIGINT UNSIGNED NOT NULL,
  name VARCHAR(100) NOT NULL,
  description VARCHAR(255) NULL,
  image_url VARCHAR(500) NULL,
  image_public_id VARCHAR(255) NULL,
  sort_order INT NOT NULL DEFAULT 0,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_categories_tenant (id, restaurant_id),
  KEY idx_categories_order (restaurant_id, sort_order),
  CONSTRAINT fk_categories_restaurant FOREIGN KEY (restaurant_id) REFERENCES restaurants (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE products (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  restaurant_id BIGINT UNSIGNED NOT NULL,
  category_id BIGINT UNSIGNED NOT NULL,
  name VARCHAR(150) NOT NULL,
  description TEXT NULL,
  price DECIMAL(10,3) NOT NULL,
  promo_price DECIMAL(10,3) NULL,
  is_promo TINYINT(1) NOT NULL DEFAULT 0,
  is_available TINYINT(1) NOT NULL DEFAULT 1,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  is_popular TINYINT(1) NOT NULL DEFAULT 0,
  sort_order INT NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_products_tenant (id, restaurant_id),
  KEY idx_products_category (restaurant_id, category_id, sort_order),
  KEY idx_products_status (restaurant_id, is_active, is_available),
  CONSTRAINT fk_products_restaurant FOREIGN KEY (restaurant_id) REFERENCES restaurants (id) ON DELETE CASCADE,
  CONSTRAINT fk_products_category FOREIGN KEY (category_id, restaurant_id) REFERENCES categories (id, restaurant_id) ON DELETE CASCADE,
  CONSTRAINT chk_products_price CHECK (price >= 0),
  CONSTRAINT chk_products_promo CHECK (promo_price IS NULL OR (promo_price >= 0 AND promo_price < price))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE product_images (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  restaurant_id BIGINT UNSIGNED NOT NULL,
  product_id BIGINT UNSIGNED NOT NULL,
  url VARCHAR(500) NOT NULL,
  public_id VARCHAR(255) NULL,
  sort_order INT NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_product_images_product (restaurant_id, product_id, sort_order),
  CONSTRAINT fk_product_images_restaurant FOREIGN KEY (restaurant_id) REFERENCES restaurants (id) ON DELETE CASCADE,
  CONSTRAINT fk_product_images_product FOREIGN KEY (product_id, restaurant_id) REFERENCES products (id, restaurant_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Variantes (Petite/Moyenne/Grande, Simple/Double...) : price_delta s'ajoute au prix de base du produit
CREATE TABLE product_variants (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  restaurant_id BIGINT UNSIGNED NOT NULL,
  product_id BIGINT UNSIGNED NOT NULL,
  name VARCHAR(80) NOT NULL,
  price_delta DECIMAL(10,3) NOT NULL DEFAULT 0,
  is_default TINYINT(1) NOT NULL DEFAULT 0,
  sort_order INT NOT NULL DEFAULT 0,
  PRIMARY KEY (id),
  KEY idx_product_variants_product (restaurant_id, product_id, sort_order),
  CONSTRAINT fk_product_variants_restaurant FOREIGN KEY (restaurant_id) REFERENCES restaurants (id) ON DELETE CASCADE,
  CONSTRAINT fk_product_variants_product FOREIGN KEY (product_id, restaurant_id) REFERENCES products (id, restaurant_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Suppléments / options, obligatoires ou facultatifs
CREATE TABLE product_extras (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  restaurant_id BIGINT UNSIGNED NOT NULL,
  product_id BIGINT UNSIGNED NOT NULL,
  name VARCHAR(80) NOT NULL,
  price DECIMAL(10,3) NOT NULL DEFAULT 0,
  is_required TINYINT(1) NOT NULL DEFAULT 0,
  sort_order INT NOT NULL DEFAULT 0,
  PRIMARY KEY (id),
  KEY idx_product_extras_product (restaurant_id, product_id, sort_order),
  CONSTRAINT fk_product_extras_restaurant FOREIGN KEY (restaurant_id) REFERENCES restaurants (id) ON DELETE CASCADE,
  CONSTRAINT fk_product_extras_product FOREIGN KEY (product_id, restaurant_id) REFERENCES products (id, restaurant_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
