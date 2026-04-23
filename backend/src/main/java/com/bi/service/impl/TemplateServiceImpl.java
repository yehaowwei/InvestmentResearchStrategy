package com.bi.service.impl;

import com.bi.common.JsonSnapshotSupport;
import com.bi.service.TemplateService;
import com.bi.vo.TemplateVo;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Map;

@Service
public class TemplateServiceImpl implements TemplateService {
    private final JdbcTemplate jdbcTemplate;
    private final JsonSnapshotSupport jsonSnapshotSupport;

    public TemplateServiceImpl(JdbcTemplate jdbcTemplate, JsonSnapshotSupport jsonSnapshotSupport) {
        this.jdbcTemplate = jdbcTemplate;
        this.jsonSnapshotSupport = jsonSnapshotSupport;
    }

    @Override
    public List<TemplateVo> listTemplates() {
        return jdbcTemplate.query(
                "SELECT template_code, template_name, renderer_code, capability_json, default_dsl_json FROM bi_template ORDER BY id",
                (rs, rowNum) -> mapTemplate(rs.getString("template_code"), rs.getString("template_name"), rs.getString("renderer_code"), rs.getString("capability_json"), rs.getString("default_dsl_json"))
        );
    }

    @Override
    public TemplateVo getTemplate(String templateCode) {
        List<TemplateVo> templates = jdbcTemplate.query(
                "SELECT template_code, template_name, renderer_code, capability_json, default_dsl_json FROM bi_template WHERE template_code = ?",
                (rs, rowNum) -> mapTemplate(rs.getString("template_code"), rs.getString("template_name"), rs.getString("renderer_code"), rs.getString("capability_json"), rs.getString("default_dsl_json")),
                templateCode
        );
        return templates.stream().findFirst().orElseThrow(() -> new IllegalArgumentException("Unknown template: " + templateCode));
    }

    @SuppressWarnings("unchecked")
    private TemplateVo mapTemplate(String templateCode, String templateName, String rendererCode, String capabilityJson, String defaultDslJson) {
        return TemplateVo.builder()
                .templateCode(templateCode)
                .templateName(templateName)
                .rendererCode(rendererCode)
                .capability(jsonSnapshotSupport.fromJson(capabilityJson, Map.class))
                .defaultDsl(jsonSnapshotSupport.fromJson(defaultDslJson, Map.class))
                .build();
    }
}
