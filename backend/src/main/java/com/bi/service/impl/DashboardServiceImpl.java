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
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

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
                "SELECT dashboard_code, name, status, published_version FROM bi_dashboard ORDER BY id",
                (rs, rowNum) -> {
                    DashboardDraftDto draft = new DashboardDraftDto();
                    draft.setDashboardCode(rs.getString("dashboard_code"));
                    draft.setName(rs.getString("name"));
                    draft.setStatus(rs.getString("status"));
                    draft.setPublishedVersion(rs.getInt("published_version"));
                    return draft;
                }
        );
    }

    @Override
    public DashboardDraftDto getDraft(String dashboardCode) {
        List<DashboardDraftDto> dashboards = jdbcTemplate.query(
                "SELECT dashboard_code, name, status, published_version FROM bi_dashboard WHERE dashboard_code = ?",
                (rs, rowNum) -> {
                    DashboardDraftDto draft = new DashboardDraftDto();
                    draft.setDashboardCode(rs.getString("dashboard_code"));
                    draft.setName(rs.getString("name"));
                    draft.setStatus(rs.getString("status"));
                    draft.setPublishedVersion(rs.getInt("published_version"));
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
        Integer existing = jdbcTemplate.queryForObject(
                "SELECT COUNT(1) FROM bi_dashboard WHERE dashboard_code = ?",
                Integer.class,
                request.getDashboardCode()
        );
        if (existing == null || existing == 0) {
            jdbcTemplate.update(
                    "INSERT INTO bi_dashboard(dashboard_code, name, status, published_version) VALUES (?, ?, 'DRAFT', 0)",
                    request.getDashboardCode(),
                    draft.getName()
            );
        } else {
            jdbcTemplate.update(
                    "UPDATE bi_dashboard SET name = ?, status = 'DRAFT' WHERE dashboard_code = ?",
                    draft.getName(),
                    request.getDashboardCode()
            );
        }
        jdbcTemplate.update("DELETE FROM bi_component WHERE dashboard_code = ?", request.getDashboardCode());

        int sortNo = 1;
        for (ChartComponentDto component : draft.getComponents()) {
            Map<String, Object> dslConfig = normalizeDslConfig(component);
            jdbcTemplate.update(
                    "INSERT INTO bi_component(dashboard_code, component_code, component_type, title, template_code, model_code, dsl_config_json, sort_no) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
                    request.getDashboardCode(),
                    component.getComponentCode(),
                    component.getComponentType() == null || component.getComponentType().isBlank() ? "chart" : component.getComponentType(),
                    component.getTitle(),
                    component.getTemplateCode(),
                    component.getModelCode(),
                    jsonSnapshotSupport.toJson(dslConfig),
                    sortNo++
            );
        }

        return getDraft(request.getDashboardCode());
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

