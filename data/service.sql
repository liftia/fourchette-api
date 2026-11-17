INSERT INTO orders (id, table_number, allergies) VALUES
  (1, 6, '[]'),
  (2, 1, '[]'),
  (3, 2, '[]'),
  (4, 7, '[]'),
  (5, 5, '[]'),
  (6, 3, '[]'),
  (7, 4, '["arachide"]');

INSERT INTO dispatches (number, order_id) VALUES
  (1, 1), (2, 2), (3, 1), (4, 3), (5, 4), (6, 2), (7, 5), (8, 5), (9, 3), (10, 1), (11, 5), (12, 2);

INSERT INTO lines (order_id, dish_id, quantity, note, dispatch) VALUES
  (1, 2, 1, NULL, 1),
  (1, 4, 1, NULL, 1),
  (1, 14, 2, NULL, 1),
  (2, 1, 2, NULL, 2),
  (1, 7, 1, NULL, 3),
  (1, 9, 1, NULL, 3),
  (3, 6, 1, NULL, 4),
  (3, 8, 1, NULL, 4),
  (4, 15, 2, NULL, 5),
  (4, 13, 1, NULL, 5),
  (4, 16, 1, NULL, 5),
  (2, 5, 1, 'sans oignon', 6),
  (2, 9, 1, NULL, 6),
  (5, 1, 1, NULL, 7),
  (5, 3, 1, NULL, 7),
  (5, 14, 1, NULL, 7),
  (5, 7, 1, NULL, 8),
  (5, 5, 1, NULL, 8),
  (3, 10, 2, NULL, 9),
  (1, 10, 1, NULL, 10),
  (1, 12, 1, NULL, 10),
  (5, 11, 1, NULL, 11),
  (2, 10, 1, NULL, 12),
  (2, 16, 1, NULL, 12),
  (6, 7, 1, NULL, NULL),
  (6, 15, 1, NULL, NULL),
  (7, 6, 1, NULL, NULL),
  (7, 11, 1, NULL, NULL);
