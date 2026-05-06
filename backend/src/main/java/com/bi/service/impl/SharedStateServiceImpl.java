package com.bi.service.impl;

import com.bi.common.JsonSnapshotSupport;
import com.bi.service.SharedStateService;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
public class SharedStateServiceImpl implements SharedStateService {
    private final JdbcTemplate jdbcTemplate;
    private final JsonSnapshotSupport jsonSnapshotSupport;

    public SharedStateServiceImpl(JdbcTemplate jdbcTemplate, JsonSnapshotSupport jsonSnapshotSupport) {
        this.jdbcTemplate = jdbcTemplate;
        this.jsonSnapshotSupport = jsonSnapshotSupport;
        ensureTable();
    }

    @Override
    public Object getState(String stateKey) {
        List<String> states = jdbcTemplate.query(
                "SELECT state_json FROM shared_state WHERE state_key = ?",
                (rs, rowNum) -> rs.getString("state_json"),
                stateKey
        );
        if (states.isEmpty()) {
            return null;
        }
        return jsonSnapshotSupport.fromJson(states.get(0), Object.class);
    }

    @Override
    public Object saveState(String stateKey, Object state) {
        String stateJson = jsonSnapshotSupport.toJson(state);
        jdbcTemplate.update(
                """
                        INSERT INTO shared_state(state_key, state_json, updated_at)
                        VALUES (?, ?, CURRENT_TIMESTAMP(6))
                        ON DUPLICATE KEY UPDATE
                          state_json = VALUES(state_json),
                          updated_at = CURRENT_TIMESTAMP(6)
                        """,
                stateKey,
                stateJson
        );
        return state;
    }

    private void ensureTable() {
        jdbcTemplate.execute("""
                CREATE TABLE IF NOT EXISTS shared_state (
                  state_key VARCHAR(128) PRIMARY KEY,
                  state_json LONGTEXT NOT NULL,
                  updated_at DATETIME(6) DEFAULT CURRENT_TIMESTAMP(6)
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
                """);
    }
}
