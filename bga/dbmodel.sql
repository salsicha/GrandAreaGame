-- SQL scaffold for Grand Area BGA module
-- Stores public map state, hidden/runtime state, player hands, and commit/reveal payloads.

CREATE TABLE IF NOT EXISTS territories (
  game_id INT NOT NULL,
  territory_key VARCHAR(64) NOT NULL,
  family VARCHAR(64),
  type VARCHAR(32),
  clientOf VARCHAR(64) NULL,
  resources_json TEXT NOT NULL,
  resource_needs_json TEXT NOT NULL,
  neighbors_json TEXT NOT NULL,
  wealth INT DEFAULT 0,
  happiness INT DEFAULT 0,
  stash INT DEFAULT 0,
  blackBudget INT DEFAULT 0,
  socialCapital INT DEFAULT 0,
  politicalCapital INT DEFAULT 0,
  education INT DEFAULT 0,
  development INT DEFAULT 0,
  debt INT DEFAULT 0,
  tributeHoliday INT DEFAULT 0,
  protectionDeal INT DEFAULT 0,
  realignmentPressure INT DEFAULT 0,
  rivalryPressure INT DEFAULT 0,
  independenceSentiment INT DEFAULT 0,
  governanceChangeSentiment INT DEFAULT 0,
  factionalDivision INT DEFAULT 0,
  fear INT DEFAULT 0,
  defiance INT DEFAULT 0,
  defianceMajorityRounds INT DEFAULT 0,
  armies INT DEFAULT 0,
  invaded TINYINT(1) DEFAULT 0,
  protected TINYINT(1) DEFAULT 0,
  protectedBy VARCHAR(64) NULL,
  sanctioned TINYINT(1) DEFAULT 0,
  outcome VARCHAR(16) NULL,
  PRIMARY KEY(game_id, territory_key)
);

CREATE TABLE IF NOT EXISTS player_state (
  game_id INT NOT NULL,
  player_id INT NOT NULL,
  family_name VARCHAR(64),
  hand_json TEXT NOT NULL,
  PRIMARY KEY(game_id, player_id)
);

CREATE TABLE IF NOT EXISTS secret_submissions (
  game_id INT NOT NULL,
  round_number INT NOT NULL DEFAULT 0,
  player_id INT NOT NULL,
  commit_hash VARCHAR(128) NOT NULL,
  submitted_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  revealed TINYINT(1) DEFAULT 0,
  reveal_payload TEXT NULL,
  PRIMARY KEY(game_id, player_id)
);

CREATE TABLE IF NOT EXISTS game_runtime (
  game_id INT NOT NULL,
  state_key VARCHAR(64) NOT NULL,
  state_json MEDIUMTEXT NOT NULL,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY(game_id, state_key)
);
