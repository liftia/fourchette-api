INSERT INTO tables (number, seats) VALUES
  (1, 2), (2, 2), (3, 2), (4, 2), (5, 4), (6, 4), (7, 4), (8, 6);

INSERT INTO categories (name, station) VALUES
  ('starter', 'kitchen'), ('main', 'kitchen'), ('dessert', 'kitchen'), ('drink', 'bar');

INSERT INTO dishes (id, name, category, price_cents, set_menu, portions, contains, traces) VALUES
  (1, 'Soupe à l''oignon « retour d''expérience »', 'starter', 750, 1, NULL, '["gluten","lait"]', '[]'),
  (2, 'Œuf mayonnaise « valeur sûre »', 'starter', 500, 1, NULL, '["œuf"]', '[]'),
  (3, 'Salade de chèvre chaud « quick win »', 'starter', 850, 1, NULL, '["lait","gluten"]', '["fruits à coque"]'),
  (4, 'Foie gras « premium »', 'starter', 1400, 0, NULL, '[]', '["gluten"]'),
  (5, 'Entrecôte-frites « hors budget »', 'main', 2600, 0, NULL, '[]', '[]'),
  (6, 'Pad thaï « offshore »', 'main', 1550, 1, NULL, '["arachide","œuf"]', '["poisson"]'),
  (7, 'Blanquette de veau « legacy »', 'main', 1600, 1, NULL, '["lait"]', '[]'),
  (8, 'Poisson du jour « sous réserve de livraison »', 'main', 1700, 1, 5, '["poisson"]', '[]'),
  (9, 'Croque-monsieur « MVP »', 'main', 1100, 1, NULL, '["gluten","lait"]', '[]'),
  (10, 'Tarte Tatin « best-seller »', 'dessert', 800, 1, 6, '["gluten","lait"]', '[]'),
  (11, 'Fondant au chocolat « livrable »', 'dessert', 850, 1, NULL, '["gluten","œuf","lait"]', '["arachide"]'),
  (12, 'Crème brûlée « à valider »', 'dessert', 750, 1, NULL, '["lait","œuf"]', '[]'),
  (13, 'Carafe d''eau « open source »', 'drink', 0, 0, NULL, '[]', '[]'),
  (14, 'Verre de rouge « afterwork »', 'drink', 600, 0, NULL, '[]', '[]'),
  (15, 'Limonade maison « scalable »', 'drink', 450, 0, NULL, '[]', '[]'),
  (16, 'Café « daily »', 'drink', 250, 0, NULL, '[]', '[]');
