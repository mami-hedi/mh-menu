-- 004_settings_images : identifiants Cloudinary du logo et de la couverture (pour pouvoir supprimer l'ancienne image)

ALTER TABLE restaurant_settings
  ADD COLUMN logo_public_id VARCHAR(255) NULL AFTER logo_url,
  ADD COLUMN cover_public_id VARCHAR(255) NULL AFTER cover_url;
