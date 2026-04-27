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
                "SELECT state_json FROM bi_shared_state WHERE state_key = ?",
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
                "MERGE INTO bi_shared_state(state_key, state_json, updated_at) KEY(state_key) VALUES (?, ?, CURRENT_TIMESTAMP)",
                stateKey,
                stateJson
        );
        return state;
    }

    private void ensureTable() {
        jdbcTemplate.execute("""
                CREATE TABLE IF NOT EXISTS bi_shared_state (
                  state_key VARCHAR(128) PRIMARY KEY,
                  state_json CLOB NOT NULL,
                  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
                """);
    }
}
