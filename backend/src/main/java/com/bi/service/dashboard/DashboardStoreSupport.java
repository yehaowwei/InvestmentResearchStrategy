package com.bi.service.dashboard;

import com.bi.common.JsonSnapshotSupport;
import com.bi.dto.ChartComponentDto;
import com.bi.dto.DashboardDraftDto;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.support.GeneratedKeyHolder;
import org.springframework.jdbc.support.KeyHolder;
import org.springframework.stereotype.Component;

import java.sql.PreparedStatement;
import java.sql.Timestamp;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@Component
public class DashboardStoreSupport {
    private final JdbcTemplate jdbcTemplate;
    private final JsonSnapshotSupport jsonSnapshotSupport;

    public DashboardStoreSupport(JdbcTemplate jdbcTemplate, JsonSnapshotSupport jsonSnapshotSupport) {
        this.jdbcTemplate = jdbcTemplate;
        this.jsonSnapshotSupport = jsonSnapshotSupport;
    }

    public List<DashboardDraftDto> listDashboards() {
        return jdbcTemplate.query(
                "SELECT dashboard_code, name, status, published_version, created_at, updated_at FROM dashboard_definition ORDER BY id",
                (rs, rowNum) -> mapDashboardDraft(
                        rs.getString("dashboard_code"),
                        rs.getString("name"),
                        rs.getString("status"),
                        rs.getInt("published_version"),
                        rs.getTimestamp("created_at"),
                        rs.getTimestamp("updated_at")
                )
        );
    }

    public DashboardDraftDto loadDashboard(String dashboardCode) {
        List<DashboardDraftDto> dashboards = jdbcTemplate.query(
                "SELECT dashboard_code, name, status, published_version, created_at, updated_at FROM dashboard_definition WHERE dashboard_code = ?",
                (rs, rowNum) -> mapDashboardDraft(
                        rs.getString("dashboard_code"),
                        rs.getString("name"),
                        rs.getString("status"),
                        rs.getInt("published_version"),
                        rs.getTimestamp("created_at"),
                        rs.getTimestamp("updated_at")
                ),
                dashboardCode
        );
        return dashboards.stream()
                .findFirst()
                .orElseThrow(() -> new IllegalArgumentException("Dashboard not found: " + dashboardCode));
    }

    public boolean existsDashboard(String dashboardCode) {
        Integer existing = jdbcTemplate.queryForObject(
                "SELECT COUNT(1) FROM dashboard_definition WHERE dashboard_code = ?",
                Integer.class,
                dashboardCode
        );
        return existing != null && existing > 0;
    }

    public String insertDashboardAndGenerateCode(String dashboardName) {
        String placeholderCode = "pending_" + UUID.randomUUID().toString().replace("-", "");
        KeyHolder keyHolder = new GeneratedKeyHolder();
        jdbcTemplate.update(connection -> {
            PreparedStatement statement = connection.prepareStatement(
                    "INSERT INTO dashboard_definition(dashboard_code, name, status, published_version) VALUES (?, ?, 'DRAFT', 0)",
                    new String[]{"id"}
            );
            statement.setString(1, placeholderCode);
            statement.setString(2, dashboardName);
            return statement;
        }, keyHolder);

        Number generatedId = keyHolder.getKey();
        if (generatedId == null) {
            throw new IllegalStateException("Failed to generate dashboard id");
        }

        String dashboardCode = "chart_" + generatedId.longValue();
        jdbcTemplate.update(
                "UPDATE dashboard_definition SET dashboard_code = ? WHERE id = ?",
                dashboardCode,
                generatedId.longValue()
        );
        return dashboardCode;
    }

    public void insertDashboard(String dashboardCode, String dashboardName) {
        jdbcTemplate.update(
                "INSERT INTO dashboard_definition(dashboard_code, name, status, published_version) VALUES (?, ?, 'DRAFT', 0)",
                dashboardCode,
                dashboardName
        );
    }

    public void updateDashboardDraft(String dashboardCode, String dashboardName) {
        jdbcTemplate.update(
                "UPDATE dashboard_definition SET name = ?, status = 'DRAFT' WHERE dashboard_code = ?",
                dashboardName,
                dashboardCode
        );
    }

    public void replaceComponents(String dashboardCode, List<ChartComponentDto> components) {
        jdbcTemplate.update("DELETE FROM dashboard_component WHERE dashboard_code = ?", dashboardCode);
        int sortNo = 1;
        for (ChartComponentDto component : components) {
            insertComponent(dashboardCode, component, sortNo++);
        }
    }

    public Integer publishDashboard(String dashboardCode) {
        jdbcTemplate.update(
                "UPDATE dashboard_definition SET status = 'PUBLISHED', published_version = published_version + 1 WHERE dashboard_code = ?",
                dashboardCode
        );
        return jdbcTemplate.queryForObject(
                "SELECT published_version FROM dashboard_definition WHERE dashboard_code = ?",
                Integer.class,
                dashboardCode
        );
    }

    public boolean deleteDashboard(String dashboardCode) {
        if (!existsDashboard(dashboardCode)) {
            return false;
        }
        jdbcTemplate.update("DELETE FROM dashboard_component WHERE dashboard_code = ?", dashboardCode);
        jdbcTemplate.update("DELETE FROM dashboard_definition WHERE dashboard_code = ?", dashboardCode);
        return true;
    }

    @SuppressWarnings("unchecked")
    public List<ChartComponentDto> loadComponents(String dashboardCode) {
        return jdbcTemplate.query(
                "SELECT component_code, component_type, title, template_code, model_code, dsl_config_json FROM dashboard_component WHERE dashboard_code = ? ORDER BY sort_no, id",
                (rs, rowNum) -> {
                    Map<String, Object> dslConfig = jsonSnapshotSupport.fromJson(rs.getString("dsl_config_json"), Map.class);
                    ChartComponentDto component = new ChartComponentDto();
                    component.setComponentCode(rs.getString("component_code"));
                    component.setComponentType(rs.getString("component_type"));
                    component.setTitle(rs.getString("title"));
                    component.setTemplateCode(rs.getString("template_code"));
                    component.setModelCode(rs.getString("model_code"));
                    component.setDslConfig(dslConfig);
                    return component;
                },
                dashboardCode
        );
    }

    private DashboardDraftDto mapDashboardDraft(String dashboardCode,
                                                String name,
                                                String status,
                                                Integer publishedVersion,
                                                Timestamp createdAt,
                                                Timestamp updatedAt) {
        DashboardDraftDto draft = new DashboardDraftDto();
        draft.setDashboardCode(dashboardCode);
        draft.setName(name);
        draft.setStatus(status);
        draft.setPublishedVersion(publishedVersion);
        draft.setCreatedAt(toDateTime(createdAt));
        draft.setUpdatedAt(toDateTime(updatedAt));
        return draft;
    }

    private void insertComponent(String dashboardCode, ChartComponentDto component, int sortNo) {
        jdbcTemplate.update(
                "INSERT INTO dashboard_component(dashboard_code, component_code, component_type, title, template_code, model_code, dsl_config_json, sort_no) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
                dashboardCode,
                component.getComponentCode(),
                normalizeComponentType(component),
                component.getTitle(),
                component.getTemplateCode(),
                component.getModelCode(),
                jsonSnapshotSupport.toJson(component.getDslConfig()),
                sortNo
        );
    }

    private String normalizeComponentType(ChartComponentDto component) {
        return component.getComponentType() == null || component.getComponentType().isBlank()
                ? "chart"
                : component.getComponentType();
    }

    private String toDateTime(Timestamp timestamp) {
        return timestamp == null ? null : timestamp.toLocalDateTime().toString();
    }
}
