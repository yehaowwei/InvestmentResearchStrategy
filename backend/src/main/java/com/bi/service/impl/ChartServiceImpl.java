package com.bi.service.impl;

import com.bi.dto.ChartPreviewRequest;
import com.bi.dto.QueryDsl;
import com.bi.service.ChartService;
import com.bi.service.chart.ChartPreviewSupport;
import com.bi.service.chart.ChartSqlBuilder;
import com.bi.vo.ChartCompatibilityVo;
import com.bi.vo.ChartPreviewVo;
import com.bi.vo.FieldMetaVo;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@Service
public class ChartServiceImpl implements ChartService {
    private final JdbcTemplate jdbcTemplate;
    private final ChartPreviewSupport chartPreviewSupport;
    private final ChartSqlBuilder chartSqlBuilder;

    public ChartServiceImpl(JdbcTemplate jdbcTemplate,
                            ChartPreviewSupport chartPreviewSupport,
                            ChartSqlBuilder chartSqlBuilder) {
        this.jdbcTemplate = jdbcTemplate;
        this.chartPreviewSupport = chartPreviewSupport;
        this.chartSqlBuilder = chartSqlBuilder;
    }

    @Override
    @SuppressWarnings("unchecked")
    public ChartPreviewVo preview(ChartPreviewRequest request) {
        QueryDsl queryDsl = chartPreviewSupport.resolveQueryDsl(request);
        String modelCode = queryDsl.getModelCode();
        if (modelCode == null || modelCode.isBlank()) {
            throw new IllegalArgumentException("modelCode is required for preview");
        }
        Map<String, Object> dslConfig = request.getDslConfig() == null ? new LinkedHashMap<>() : new LinkedHashMap<>(request.getDslConfig());
        if (chartPreviewSupport.isPreviewSelectionEmpty(queryDsl)) {
            return chartPreviewSupport.buildPreview(modelCode, queryDsl, List.of(), dslConfig);
        }
        Map<String, FieldMetaVo> fieldMap = chartPreviewSupport.loadFieldMap(modelCode);
        Map<String, Object> modelConfig = chartPreviewSupport.loadModelConfig(modelCode);
        String sql = chartSqlBuilder.buildSql(modelConfig, fieldMap, queryDsl);
        List<Map<String, Object>> rows = jdbcTemplate.queryForList(sql);
        return chartPreviewSupport.buildPreview(modelCode, queryDsl, rows, dslConfig);
    }

    @Override
    public ChartCompatibilityVo compatibility(QueryDsl queryDsl) {
        return ChartCompatibilityVo.builder()
                .chartTypes(List.of("line", "area", "bar", "table"))
                .recommended("line")
                .build();
    }

}

