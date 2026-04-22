package com.bi.service.impl;

import com.bi.common.JsonSnapshotSupport;
import com.bi.dto.ChartComponentDto;
import com.bi.dto.DashboardDraftDto;
import com.bi.dto.LayoutDto;
import com.bi.dto.QueryDsl;
import com.bi.dto.SaveDashboardRequest;
import com.bi.dto.ViewDsl;
import com.bi.service.DashboardService;
import com.bi.vo.PublishResultVo;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.support.GeneratedKeyHolder;
import org.springframework.jdbc.support.KeyHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.sql.PreparedStatement;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@Service
public class DashboardServiceImpl implements DashboardService {
    private final JdbcTemplate jdbcTemplate;
    private final JsonSnapshotSupport jsonSnapshotSupport;

    public DashboardServiceImpl(JdbcTemplate jdbcTemplate, JsonSnapshotSupport jsonSnapshotSupport) {
        this.jdbcTemplate = jdbcTemplate;
        this.jsonSnapshotSupport = jsonSnapshotSupport;
    }

    @Override
    public List<DashboardDraftDto> listDashboards() {
        return jdbcTemplate.query(
                "SELECT dashboard_code, name, status, published_version, created_at, updated_at FROM bi_dashboard ORDER BY id",
                (rs, rowNum) -> {
                    DashboardDraftDto draft = new DashboardDraftDto();
                    draft.setDashboardCode(rs.getString("dashboard_code"));
                    draft.setName(rs.getString("name"));
                    draft.setStatus(rs.getString("status"));
                    draft.setPublishedVersion(rs.getInt("published_version"));
                    draft.setCreatedAt(rs.getTimestamp("created_at") == null ? null : rs.getTimestamp("created_at").toLocalDateTime().toString());
                    draft.setUpdatedAt(rs.getTimestamp("updated_at") == null ? null : rs.getTimestamp("updated_at").toLocalDateTime().toString());
                    return draft;
                }
        );
    }

    @Override
    public DashboardDraftDto getDraft(String dashboardCode) {
        List<DashboardDraftDto> dashboards = jdbcTemplate.query(
                "SELECT dashboard_code, name, status, published_version, created_at, updated_at FROM bi_dashboard WHERE dashboard_code = ?",
                (rs, rowNum) -> {
                    DashboardDraftDto draft = new DashboardDraftDto();
                    draft.setDashboardCode(rs.getString("dashboard_code"));
                    draft.setName(rs.getString("name"));
                    draft.setStatus(rs.getString("status"));
                    draft.setPublishedVersion(rs.getInt("published_version"));
                    draft.setCreatedAt(rs.getTimestamp("created_at") == null ? null : rs.getTimestamp("created_at").toLocalDateTime().toString());
                    draft.setUpdatedAt(rs.getTimestamp("updated_at") == null ? null : rs.getTimestamp("updated_at").toLocalDateTime().toString());
                    return draft;
                },
                dashboardCode
        );

        DashboardDraftDto draft = dashboards.stream()
                .findFirst()
                .orElseThrow(() -> new IllegalArgumentException("Dashboard not found: " + dashboardCode));
        draft.setComponents(loadComponents(dashboardCode));
        return draft;
    }

    @Override
    @Transactional
    public DashboardDraftDto saveDraft(SaveDashboardRequest request) {
        DashboardDraftDto draft = request.getDraft();
        if (draft.getComponents() == null || draft.getComponents().isEmpty()) {
            throw new IllegalArgumentException("Dashboard must contain at least one component");
        }
        String requestedCode = request.getDashboardCode();
        String effectiveDashboardCode = requestedCode == null || requestedCode.isBlank()
                ? draft.getDashboardCode()
                : requestedCode;
        boolean creatingNewDashboard = effectiveDashboardCode == null || effectiveDashboardCode.isBlank();

        Integer existing = creatingNewDashboard
                ? 0
                : jdbcTemplate.queryForObject(
                "SELECT COUNT(1) FROM bi_dashboard WHERE dashboard_code = ?",
                Integer.class,
                effectiveDashboardCode
        );
        if (existing == null || existing == 0) {
            if (creatingNewDashboard) {
                effectiveDashboardCode = insertDashboardAndGenerateCode(draft.getName());
            } else {
                jdbcTemplate.update(
                        "INSERT INTO bi_dashboard(dashboard_code, name, status, published_version) VALUES (?, ?, 'DRAFT', 0)",
                        effectiveDashboardCode,
                        draft.getName()
                );
            }
        } else {
            jdbcTemplate.update(
                    "UPDATE bi_dashboard SET name = ?, status = 'DRAFT' WHERE dashboard_code = ?",
                    draft.getName(),
                    effectiveDashboardCode
            );
        }
        jdbcTemplate.update("DELETE FROM bi_component WHERE dashboard_code = ?", effectiveDashboardCode);

        int sortNo = 1;
        for (ChartComponentDto component : draft.getComponents()) {
            Map<String, Object> dslConfig = normalizeDslConfig(component);
            jdbcTemplate.update(
                    "INSERT INTO bi_component(dashboard_code, component_code, component_type, title, template_code, model_code, dsl_config_json, sort_no) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
                    effectiveDashboardCode,
                    component.getComponentCode(),
                    component.getComponentType() == null || component.getComponentType().isBlank() ? "chart" : component.getComponentType(),
                    component.getTitle(),
                    component.getTemplateCode(),
                    component.getModelCode(),
                    jsonSnapshotSupport.toJson(dslConfig),
                    sortNo++
            );
        }

        return getDraft(effectiveDashboardCode);
    }

    private String insertDashboardAndGenerateCode(String dashboardName) {
        String placeholderCode = "pending_" + UUID.randomUUID().toString().replace("-", "");
        KeyHolder keyHolder = new GeneratedKeyHolder();
        jdbcTemplate.update(connection -> {
            PreparedStatement statement = connection.prepareStatement(
                    "INSERT INTO bi_dashboard(dashboard_code, name, status, published_version) VALUES (?, ?, 'DRAFT', 0)",
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
                "UPDATE bi_dashboard SET dashboard_code = ? WHERE id = ?",
                dashboardCode,
                generatedId.longValue()
        );
        return dashboardCode;
    }

    @Override
    @Transactional
    public PublishResultVo publish(String dashboardCode, String publishNote) {
        jdbcTemplate.update("UPDATE bi_dashboard SET status = 'PUBLISHED', published_version = published_version + 1 WHERE dashboard_code = ?", dashboardCode);
        Integer versionNo = jdbcTemplate.queryForObject("SELECT published_version FROM bi_dashboard WHERE dashboard_code = ?", Integer.class, dashboardCode);
        return PublishResultVo.builder()
                .dashboardCode(dashboardCode)
                .versionNo(versionNo)
                .build();
    }

    @Override
    @Transactional
    public boolean deleteDashboard(String dashboardCode) {
        Integer existing = jdbcTemplate.queryForObject(
                "SELECT COUNT(1) FROM bi_dashboard WHERE dashboard_code = ?",
                Integer.class,
                dashboardCode
        );
        if (existing == null || existing == 0) {
            return false;
        }
        jdbcTemplate.update("DELETE FROM bi_component WHERE dashboard_code = ?", dashboardCode);
        jdbcTemplate.update("DELETE FROM bi_dashboard WHERE dashboard_code = ?", dashboardCode);
        return true;
    }

    @SuppressWarnings("unchecked")
    private List<ChartComponentDto> loadComponents(String dashboardCode) {
        return jdbcTemplate.query(
                "SELECT component_code, component_type, title, template_code, model_code, dsl_config_json FROM bi_component WHERE dashboard_code = ? ORDER BY sort_no, id",
                (rs, rowNum) -> {
                    Map<String, Object> dslConfig = jsonSnapshotSupport.fromJson(rs.getString("dsl_config_json"), Map.class);
                    ChartComponentDto component = new ChartComponentDto();
                    component.setComponentCode(rs.getString("component_code"));
                    component.setComponentType(rs.getString("component_type"));
                    component.setTitle(rs.getString("title"));
                    component.setTemplateCode(rs.getString("template_code"));
                    component.setModelCode(rs.getString("model_code"));
                    component.setDslConfig(dslConfig);
                    component.setLayout(extractLayout(dslConfig));
                    if (dslConfig.get("queryDsl") != null) {
                        component.setQueryDsl(jsonSnapshotSupport.convert(dslConfig.get("queryDsl"), QueryDsl.class));
                    }
                    if (dslConfig.get("visualDsl") != null) {
                        component.setViewDsl(jsonSnapshotSupport.convert(dslConfig.get("visualDsl"), ViewDsl.class));
                    }
                    return component;
                },
                dashboardCode
        );
    }

    @SuppressWarnings("unchecked")
    private Map<String, Object> normalizeDslConfig(ChartComponentDto component) {
        Map<String, Object> dslConfig = component.getDslConfig() == null ? new LinkedHashMap<>() : new LinkedHashMap<>(component.getDslConfig());
        if (!dslConfig.containsKey("queryDsl") && component.getQueryDsl() != null) {
            dslConfig.put("queryDsl", jsonSnapshotSupport.convert(component.getQueryDsl(), Map.class));
        }
        if (!dslConfig.containsKey("visualDsl") && component.getViewDsl() != null) {
            dslConfig.put("visualDsl", jsonSnapshotSupport.convert(component.getViewDsl(), Map.class));
        }
        if (component.getLayout() != null) {
            dslConfig.put("layout", jsonSnapshotSupport.convert(component.getLayout(), Map.class));
        } else if (!dslConfig.containsKey("layout")) {
            dslConfig.put("layout", Map.of("x", 0, "y", 0, "w", 12, "h", 8));
        }
        return dslConfig;
    }

    @SuppressWarnings("unchecked")
    private LayoutDto extractLayout(Map<String, Object> dslConfig) {
        Object layout = dslConfig.get("layout");
        if (layout == null) {
            LayoutDto dto = new LayoutDto();
            dto.setX(0);
            dto.setY(0);
            dto.setW(12);
            dto.setH(8);
            return dto;
        }
        return jsonSnapshotSupport.convert(layout, LayoutDto.class);
    }
}

