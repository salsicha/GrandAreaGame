-- SQL scaffold for Grand Area BGA module
-- Tables: territories, player_state, secret_submissions

CREATE TABLE IF NOT EXISTS territories (
  game_id INT NOT NULL,
  territory_key VARCHAR(64) NOT NULL,
  family VARCHAR(64),
  wealth INT DEFAULT 0,
  happiness INT DEFAULT 0,
  stash INT DEFAULT 0,
  socialCapital INT DEFAULT 0,
  politicalCapital INT DEFAULT 0,
  development INT DEFAULT 0,
  defiance INT DEFAULT 0,
  invaded TINYINT(1) DEFAULT 0,
  PRIMARY KEY(game_id, territory_key)
);

CREATE TABLE IF NOT EXISTS player_state (
  game_id INT NOT NULL,
  player_id INT NOT NULL,
  family_name VARCHAR(64),
  stash INT DEFAULT 0,
  socialCapital INT DEFAULT 0,
  politicalCapital INT DEFAULT 0,
  PRIMARY KEY(game_id, player_id)
);

CREATE TABLE IF NOT EXISTS secret_submissions (
  game_id INT NOT NULL,
  player_id INT NOT NULL,
  commit_hash VARCHAR(128) NOT NULL,
  submitted_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  revealed TINYINT(1) DEFAULT 0,
  reveal_payload TEXT NULL,
  PRIMARY KEY(game_id, player_id)
);
