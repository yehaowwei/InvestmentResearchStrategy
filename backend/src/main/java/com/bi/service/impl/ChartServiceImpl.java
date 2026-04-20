package com.bi.service.impl;

import com.bi.common.JsonSnapshotSupport;
import com.bi.dto.ChartPreviewRequest;
import com.bi.dto.FilterCondition;
import com.bi.dto.MetricConfig;
import com.bi.dto.QueryDsl;
import com.bi.dto.SortCondition;
import com.bi.dto.ViewDsl;
import com.bi.service.ChartService;
import com.bi.vo.ChartCompatibilityVo;
import com.bi.vo.ChartPreviewVo;
import com.bi.vo.FieldMetaVo;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.stream.Collectors;
import java.util.regex.Pattern;

@Service
public class ChartServiceImpl implements ChartService {
    private static final Pattern SQL_IDENTIFIER = Pattern.compile("[A-Za-z_][A-Za-z0-9_]*");
    private static final Pattern SQL_QUALIFIED_IDENTIFIER = Pattern.compile("[A-Za-z_][A-Za-z0-9_]*(\\.[A-Za-z_][A-Za-z0-9_]*)?");
    private static final Set<String> ALLOWED_JOIN_TYPES = Set.of("LEFT", "RIGHT", "INNER");
    private static final Set<String> ALLOWED_FILTER_OPERATORS = Set.of("eq", "gte", "lte", "like", "in");

    private final JdbcTemplate jdbcTemplate;
    private final JsonSnapshotSupport jsonSnapshotSupport;

    public ChartServiceImpl(JdbcTemplate jdbcTemplate, JsonSnapshotSupport jsonSnapshotSupport) {
        this.jdbcTemplate = jdbcTemplate;
        this.jsonSnapshotSupport = jsonSnapshotSupport;
    }

    @Override
    @SuppressWarnings("unchecked")
    public ChartPreviewVo preview(ChartPreviewRequest request) {
        QueryDsl queryDsl = resolveQueryDsl(request);
        String modelCode = queryDsl.getModelCode();
        if (modelCode == null || modelCode.isBlank()) {
            throw new IllegalArgumentException("modelCode is required for preview");
        }
        Map<String, Object> dslConfig = request.getDslConfig() == null ? new LinkedHashMap<>() : new LinkedHashMap<>(request.getDslConfig());
        if (!dslConfig.containsKey("queryDsl")) {
            dslConfig.put("queryDsl", jsonSnapshotSupport.convert(queryDsl, Map.class));
        }
        boolean hasDimensions = !queryDsl.resolveDimensionFields().isEmpty();
        boolean hasMetrics = queryDsl.getMetrics() != null && !queryDsl.getMetrics().isEmpty();
        if (!hasDimensions && !hasMetrics) {
            return ChartPreviewVo.builder()
                    .modelCode(modelCode)
                    .queryDsl(queryDsl)
                    .viewDsl(request.getViewDsl())
                    .generatedSql("")
                    .rows(List.of())
                    .dimensions(queryDsl.resolveDimensionFields())
                    .metrics(hasMetrics ? queryDsl.getMetrics().stream().map(MetricConfig::getFieldCode).toList() : List.of())
                    .datasetCode(modelCode)
                    .dslConfig(dslConfig)
                    .build();
        }
        Map<String, FieldMetaVo> fieldMap = loadFieldMap(modelCode);
        Map<String, Object> modelConfig = loadModelConfig(modelCode);
        String sql = buildSql(modelConfig, fieldMap, queryDsl);
        List<Map<String, Object>> rows = jdbcTemplate.queryForList(sql);
        return ChartPreviewVo.builder()
                .modelCode(modelCode)
                .queryDsl(queryDsl)
                .viewDsl(request.getViewDsl())
                .generatedSql(sql)
                .rows(rows)
                .dimensions(queryDsl.resolveDimensionFields())
                .metrics(queryDsl.getMetrics().stream().map(MetricConfig::getFieldCode).toList())
                .datasetCode(modelCode)
                .dslConfig(dslConfig)
                .build();
    }

    @Override
    public ChartCompatibilityVo compatibility(QueryDsl queryDsl) {
        return ChartCompatibilityVo.builder()
                .chartTypes(List.of("line", "area", "bar", "table"))
                .recommended("line")
                .build();
    }

    @SuppressWarnings("unchecked")
    private QueryDsl resolveQueryDsl(ChartPreviewRequest request) {
        if (request.getQueryDsl() != null) {
            if (request.getQueryDsl().getModelCode() == null || request.getQueryDsl().getModelCode().isBlank()) {
                request.getQueryDsl().setModelCode(request.getModelCode());
            }
            return request.getQueryDsl();
        }
        if (request.getDslConfig() != null && request.getDslConfig().get("queryDsl") != null) {
            QueryDsl queryDsl = jsonSnapshotSupport.convert(request.getDslConfig().get("queryDsl"), QueryDsl.class);
            if (queryDsl.getModelCode() == null || queryDsl.getModelCode().isBlank()) {
                queryDsl.setModelCode(request.getModelCode());
            }
            return queryDsl;
        }
        throw new IllegalArgumentException("queryDsl is required for preview");
    }

    @SuppressWarnings("unchecked")
    private Map<String, Object> loadModelConfig(String modelCode) {
        List<Map<String, Object>> configs = jdbcTemplate.query(
                "SELECT model_config_json FROM bi_dataset_model WHERE model_code = ?",
                (rs, rowNum) -> jsonSnapshotSupport.fromJson(rs.getString("model_config_json"), Map.class),
                modelCode
        );
        return configs.stream().findFirst().orElseThrow(() -> new IllegalArgumentException("Unknown model: " + modelCode));
    }

    private Map<String, FieldMetaVo> loadFieldMap(String modelCode) {
        return jdbcTemplate.query(
                "SELECT field_code, field_name, data_type, field_role, agg_type, source_expr, calc_type, base_field_code FROM bi_dataset_field WHERE model_code = ? ORDER BY sort_no, id",
                (rs, rowNum) -> FieldMetaVo.builder()
                        .fieldCode(rs.getString("field_code"))
                        .fieldName(rs.getString("field_name"))
                        .fieldNameCn(rs.getString("field_name"))
                        .fieldNameEn(rs.getString("field_name"))
                        .fieldType(rs.getString("data_type"))
                        .dataType(rs.getString("data_type"))
                        .fieldRole(rs.getString("field_role"))
                        .aggType(rs.getString("agg_type"))
                        .sourceExpr(rs.getString("source_expr"))
                        .calcType(rs.getString("calc_type"))
                        .baseFieldCode(rs.getString("base_field_code"))
                        .dimension("dimension".equalsIgnoreCase(rs.getString("field_role")))
                        .metric("metric".equalsIgnoreCase(rs.getString("field_role")))
                        .build(),
                modelCode
        ).stream().collect(Collectors.toMap(FieldMetaVo::getFieldCode, item -> item, (left, right) -> left, LinkedHashMap::new));
    }

    @SuppressWarnings("unchecked")
    private String buildSql(Map<String, Object> modelConfig, Map<String, FieldMetaVo> fieldMap, QueryDsl queryDsl) {
        List<String> dimensionFieldCodes = queryDsl.resolveDimensionFields();
        List<String> seriesFields = queryDsl.getSeriesFields() == null ? List.of() : queryDsl.getSeriesFields();
        List<String> selectParts = new ArrayList<>();
        List<String> groupByParts = new ArrayList<>();

        for (String dimensionFieldCode : dimensionFieldCodes) {
            FieldMetaVo dimensionField = requireField(fieldMap, dimensionFieldCode);
            selectParts.add(safeSourceExpr(dimensionField) + " AS " + safeAlias(dimensionField.getFieldCode()));
            groupByParts.add(safeSourceExpr(dimensionField));
        }

        for (String seriesFieldCode : seriesFields) {
            FieldMetaVo seriesField = requireField(fieldMap, seriesFieldCode);
            selectParts.add(safeSourceExpr(seriesField) + " AS " + safeAlias(seriesFieldCode));
            groupByParts.add(safeSourceExpr(seriesField));
        }

        for (MetricConfig metric : queryDsl.getMetrics()) {
            FieldMetaVo metricField = requireField(fieldMap, metric.getFieldCode());
            selectParts.add(buildMetricSelect(metric, metricField, queryDsl, fieldMap, groupByParts) + " AS " + safeAlias(metric.getFieldCode()));
        }

        if (selectParts.isEmpty()) {
            throw new IllegalArgumentException("At least one dimension or metric field is required");
        }

        StringBuilder sql = new StringBuilder();
        sql.append("SELECT ").append(String.join(", ", selectParts)).append(" ");
        sql.append(buildFrom(modelConfig)).append(" ");

        String whereClause = buildWhereClause(queryDsl.getFilters(), fieldMap);
        if (!whereClause.isBlank()) {
            sql.append("WHERE ").append(whereClause).append(" ");
        }

        if (!groupByParts.isEmpty() && queryDsl.getMetrics() != null && !queryDsl.getMetrics().isEmpty()) {
            sql.append("GROUP BY ").append(String.join(", ", groupByParts)).append(" ");
        }
        String orderBy = buildOrderBy(queryDsl, fieldMap);
        if (!orderBy.isBlank()) {
            sql.append(orderBy);
        }
        sql.append(" LIMIT ").append(safeLimit(queryDsl.getLimit()));
        return sql.toString().trim();
    }

    private String buildMetricSelect(MetricConfig metric, FieldMetaVo metricField, QueryDsl queryDsl, Map<String, FieldMetaVo> fieldMap, List<String> groupByParts) {
        if ("rolling_3y_avg".equalsIgnoreCase(metricField.getCalcType())) {
            String source = safeSourceExpr(metricField);
            List<String> dimensions = queryDsl.resolveDimensionFields();
            if (dimensions.isEmpty()) {
                throw new IllegalArgumentException("rolling_3y_avg requires at least one dimension field");
            }
            String orderExpr = safeSourceExpr(requireField(fieldMap, dimensions.get(0)));
            List<String> partitionParts = groupByParts.size() > 1 ? groupByParts.subList(1, groupByParts.size()) : List.of();
            String partitionClause = partitionParts.isEmpty() ? "" : "PARTITION BY " + String.join(", ", partitionParts) + " ";
            return "AVG(AVG(" + source + ")) OVER (" + partitionClause + "ORDER BY " + orderExpr + " ROWS BETWEEN 755 PRECEDING AND CURRENT ROW)";
        }
        String agg = normalizeAgg(metricField.getAggType() != null ? metricField.getAggType() : (metric.getAggType() != null ? metric.getAggType() : metric.getAgg()));
        return agg + "(" + safeSourceExpr(metricField) + ")";
    }

    @SuppressWarnings("unchecked")
    private String buildFrom(Map<String, Object> modelConfig) {
        Map<String, Object> mainTable = (Map<String, Object>) modelConfig.get("mainTable");
        if (mainTable == null) {
            throw new IllegalArgumentException("modelConfig.mainTable is required");
        }
        StringBuilder builder = new StringBuilder("FROM ")
                .append(safeIdentifier(Objects.toString(mainTable.get("table"), ""), "mainTable.table"))
                .append(" ")
                .append(safeIdentifier(Objects.toString(mainTable.get("alias"), ""), "mainTable.alias"));
        Object joinTables = modelConfig.get("joinTables");
        if (joinTables instanceof List<?> list) {
            for (Object item : list) {
                Map<String, Object> join = (Map<String, Object>) item;
                String joinType = Objects.toString(join.getOrDefault("joinType", "LEFT"), "LEFT").toUpperCase(Locale.ROOT);
                if (!ALLOWED_JOIN_TYPES.contains(joinType)) {
                    throw new IllegalArgumentException("Unsupported join type: " + joinType);
                }
                builder.append(" ").append(joinType).append(" JOIN ")
                        .append(safeIdentifier(Objects.toString(join.get("table"), ""), "joinTables.table"))
                        .append(" ")
                        .append(safeIdentifier(Objects.toString(join.get("alias"), ""), "joinTables.alias"))
                        .append(" ON ");
                List<Map<String, Object>> onList = (List<Map<String, Object>>) join.get("on");
                if (onList == null || onList.isEmpty()) {
                    throw new IllegalArgumentException("joinTables.on must contain at least one join condition");
                }
                builder.append(onList.stream()
                        .map(on -> safeQualifiedIdentifier(Objects.toString(on.get("left"), ""), "joinTables.on.left")
                                + " = "
                                + safeQualifiedIdentifier(Objects.toString(on.get("right"), ""), "joinTables.on.right"))
                        .collect(Collectors.joining(" AND ")));
            }
        }
        return builder.toString();
    }

    private String buildWhereClause(List<FilterCondition> filters, Map<String, FieldMetaVo> fieldMap) {
        if (filters == null || filters.isEmpty()) {
            return "";
        }
        return filters.stream()
                .map(filter -> toFilterSql(filter, fieldMap))
                .filter(sql -> !sql.isBlank())
                .collect(Collectors.joining(" AND "));
    }

    private String toFilterSql(FilterCondition filter, Map<String, FieldMetaVo> fieldMap) {
        FieldMetaVo field = requireField(fieldMap, filter.getFieldCode());
        String operator = filter.getOperator() != null && !filter.getOperator().isBlank() ? filter.getOperator() : filter.getOp();
        if (operator == null || operator.isBlank()) {
            operator = "eq";
        }
        operator = operator.toLowerCase(Locale.ROOT);
        if (!ALLOWED_FILTER_OPERATORS.contains(operator)) {
            throw new IllegalArgumentException("Unsupported filter operator: " + operator);
        }
        List<String> values = new ArrayList<>();
        if (filter.getValues() != null && !filter.getValues().isEmpty()) {
            values.addAll(filter.getValues());
        } else if (filter.getValue() != null && !filter.getValue().isBlank()) {
            values.add(filter.getValue());
        }
        if (values.isEmpty()) {
            return "";
        }
        String expr = safeSourceExpr(field);
        return switch (operator) {
            case "eq" -> expr + " = " + quote(values.get(0));
            case "gte" -> expr + " >= " + quote(values.get(0));
            case "lte" -> expr + " <= " + quote(values.get(0));
            case "like" -> expr + " LIKE " + quote("%" + values.get(0) + "%");
            case "in" -> expr + " IN (" + values.stream().map(this::quote).collect(Collectors.joining(", ")) + ")";
            default -> throw new IllegalArgumentException("Unsupported filter operator: " + operator);
        };
    }

    private String buildOrderBy(QueryDsl queryDsl, Map<String, FieldMetaVo> fieldMap) {
        List<SortCondition> orders = queryDsl.getOrders();
        if (orders == null || orders.isEmpty()) {
            List<String> dimensions = queryDsl.resolveDimensionFields();
            if (!dimensions.isEmpty()) {
                return "ORDER BY " + safeSourceExpr(requireField(fieldMap, dimensions.get(0))) + " ASC ";
            }
            if (queryDsl.getMetrics() != null && !queryDsl.getMetrics().isEmpty()) {
                return "ORDER BY " + safeAlias(queryDsl.getMetrics().get(0).getFieldCode()) + " DESC ";
            }
            return "";
        }
        return "ORDER BY " + orders.stream().map(order -> {
            String direction = "desc".equalsIgnoreCase(order.getDirection()) ? "DESC" : "ASC";
            boolean metricOrder = queryDsl.getMetrics().stream().anyMatch(metric -> metric.getFieldCode().equals(order.getFieldCode()));
            if (metricOrder) {
                return safeAlias(order.getFieldCode()) + " " + direction;
            }
            return safeSourceExpr(requireField(fieldMap, order.getFieldCode())) + " " + direction;
        }).collect(Collectors.joining(", ")) + " ";
    }

    private FieldMetaVo requireField(Map<String, FieldMetaVo> fieldMap, String fieldCode) {
        FieldMetaVo field = fieldMap.get(fieldCode);
        if (field == null) {
            throw new IllegalArgumentException("Unknown field: " + fieldCode);
        }
        return field;
    }

    private String normalizeAgg(String aggType) {
        return switch ((aggType == null ? "sum" : aggType).toLowerCase(Locale.ROOT)) {
            case "avg" -> "AVG";
            case "max" -> "MAX";
            case "min" -> "MIN";
            case "count" -> "COUNT";
            default -> "SUM";
        };
    }

    private String quote(String value) {
        return "'" + value.replace("'", "''") + "'";
    }

    private String safeSourceExpr(FieldMetaVo field) {
        return safeQualifiedIdentifier(field.getSourceExpr(), "source_expr for " + field.getFieldCode());
    }

    private String safeAlias(String alias) {
        return safeIdentifier(alias, "field alias");
    }

    private String safeIdentifier(String value, String context) {
        if (value == null || !SQL_IDENTIFIER.matcher(value).matches()) {
            throw new IllegalArgumentException("Unsafe SQL identifier in " + context + ": " + value);
        }
        return value;
    }

    private String safeQualifiedIdentifier(String value, String context) {
        if (value == null || !SQL_QUALIFIED_IDENTIFIER.matcher(value).matches()) {
            throw new IllegalArgumentException("Unsafe SQL expression in " + context + ": " + value);
        }
        return value;
    }

    private int safeLimit(Integer limit) {
        int resolved = limit == null ? 500 : limit;
        if (resolved < 1 || resolved > 5000) {
            throw new IllegalArgumentException("limit must be between 1 and 5000");
        }
        return resolved;
    }
}

