CREATE TABLE tables (
  number INTEGER PRIMARY KEY,
  seats INTEGER NOT NULL
);

CREATE TABLE categories (
  name TEXT PRIMARY KEY,
  station TEXT NOT NULL CHECK (station IN ('kitchen', 'bar'))
);

CREATE TABLE dishes (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  category TEXT NOT NULL REFERENCES categories(name),
  price_cents INTEGER NOT NULL,
  portions INTEGER,
  sold_out INTEGER NOT NULL DEFAULT 0,
  contains TEXT NOT NULL DEFAULT '[]',
  traces TEXT NOT NULL DEFAULT '[]',
  set_menu INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE orders (
  id INTEGER PRIMARY KEY,
  table_number INTEGER NOT NULL REFERENCES tables(number),
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'paid')),
  allergies TEXT NOT NULL DEFAULT '[]'
);

CREATE TABLE dispatches (
  number TEXT PRIMARY KEY,
  order_id INTEGER NOT NULL REFERENCES orders(id)
);

CREATE TABLE lines (
  id INTEGER PRIMARY KEY,
  order_id INTEGER NOT NULL REFERENCES orders(id),
  dish_id INTEGER NOT NULL REFERENCES dishes(id),
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  note TEXT,
  dispatch INTEGER REFERENCES dispatches(number),
  cancelled INTEGER NOT NULL DEFAULT 0,
  modified INTEGER NOT NULL DEFAULT 0
);
