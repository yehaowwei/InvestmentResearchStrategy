package com.bi.service.chart;

import com.bi.common.JsonSnapshotSupport;
import com.bi.dto.ChartPreviewRequest;
import com.bi.dto.QueryDsl;
import com.bi.vo.ChartPreviewVo;
import com.bi.vo.FieldMetaVo;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@Component
public class ChartPreviewSupport {
    private final JdbcTemplate jdbcTemplate;
    private final JsonSnapshotSupport jsonSnapshotSupport;

    public ChartPreviewSupport(JdbcTemplate jdbcTemplate, JsonSnapshotSupport jsonSnapshotSupport) {
        this.jdbcTemplate = jdbcTemplate;
        this.jsonSnapshotSupport = jsonSnapshotSupport;
    }

    @SuppressWarnings("unchecked")
    public QueryDsl resolveQueryDsl(ChartPreviewRequest request) {
        if (request.getDslConfig() != null && request.getDslConfig().get("queryDsl") != null) {
            QueryDsl queryDsl = jsonSnapshotSupport.convert(request.getDslConfig().get("queryDsl"), QueryDsl.class);
            if (queryDsl.getModelCode() == null || queryDsl.getModelCode().isBlank()) {
                queryDsl.setModelCode(request.getModelCode());
            }
            return queryDsl;
        }
        if (request.getQueryDsl() != null) {
            if (request.getQueryDsl().getModelCode() == null || request.getQueryDsl().getModelCode().isBlank()) {
                request.getQueryDsl().setModelCode(request.getModelCode());
            }
            return request.getQueryDsl();
        }
        throw new IllegalArgumentException("queryDsl is required for preview");
    }

    @SuppressWarnings("unchecked")
    public Map<String, Object> loadModelConfig(String modelCode) {
        List<Map<String, Object>> configs = jdbcTemplate.query(
                "SELECT model_config_json FROM bi_dataset_model WHERE model_code = ?",
                (rs, rowNum) -> jsonSnapshotSupport.fromJson(rs.getString("model_config_json"), Map.class),
                modelCode
        );
        return configs.stream().findFirst().orElseThrow(() -> new IllegalArgumentException("Unknown model: " + modelCode));
    }

    public Map<String, FieldMetaVo> loadFieldMap(String modelCode) {
        return jdbcTemplate.query(
                "SELECT field_code, field_name, data_type, field_role, agg_type, source_expr, calc_type, base_field_code FROM bi_dataset_field WHERE model_code = ? ORDER BY sort_no, id",
                (rs, rowNum) -> FieldMetaVo.builder()
                        .fieldCode(rs.getString("field_code"))
                        .fieldName(rs.getString("field_name"))
                        .dataType(rs.getString("data_type"))
                        .fieldRole(rs.getString("field_role"))
                        .aggType(rs.getString("agg_type"))
                        .sourceExpr(rs.getString("source_expr"))
                        .calcType(rs.getString("calc_type"))
                        .baseFieldCode(rs.getString("base_field_code"))
                        .build(),
                modelCode
        ).stream().collect(Collectors.toMap(FieldMetaVo::getFieldCode, item -> item, (left, right) -> left, LinkedHashMap::new));
    }

    public boolean isPreviewSelectionEmpty(QueryDsl queryDsl) {
        boolean hasDimensions = !queryDsl.resolveDimensionFields().isEmpty();
        boolean hasMetrics = queryDsl.getMetrics() != null && !queryDsl.getMetrics().isEmpty();
        return !hasDimensions && !hasMetrics;
    }

    public ChartPreviewVo buildPreview(String modelCode,
                                       QueryDsl queryDsl,
                                       List<Map<String, Object>> rows,
                                       Map<String, Object> dslConfig) {
        return ChartPreviewVo.builder()
                .modelCode(modelCode)
                .queryDsl(queryDsl)
                .rows(rows)
                .dslConfig(dslConfig)
                .build();
    }
}
