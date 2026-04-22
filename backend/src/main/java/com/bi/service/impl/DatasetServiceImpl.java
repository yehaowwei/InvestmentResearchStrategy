package com.bi.service.impl;

import com.bi.common.JsonSnapshotSupport;
import com.bi.dto.CreateCalculatedMetricRequest;
import com.bi.dto.CreateDataPoolRequest;
import com.bi.service.DatasetService;
import com.bi.vo.DatasetVo;
import com.bi.vo.FieldMetaVo;
import com.bi.vo.SourceTableVo;
import org.springframework.jdbc.core.ConnectionCallback;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.regex.Pattern;
import java.util.stream.Collectors;
import java.sql.ResultSetMetaData;

@Service
public class DatasetServiceImpl implements DatasetService {
    private static final Pattern SQL_IDENTIFIER = Pattern.compile("[A-Za-z_][A-Za-z0-9_]*");
    private static final Pattern SQL_QUALIFIED_IDENTIFIER = Pattern.compile("[A-Za-z_][A-Za-z0-9_]*(\\.[A-Za-z_][A-Za-z0-9_]*)?");
    private static final Pattern SQL_SELECT_PREFIX = Pattern.compile("(?is)^(select|with)\\b[\\s\\S]*$");
    private static final Pattern TABLE_ALIAS_PATTERN = Pattern.compile("(?i)(?:from|join)\\s+([A-Za-z_][A-Za-z0-9_]*)(?:\\s+(?:as\\s+)?)?([A-Za-z_][A-Za-z0-9_]*)?");
    private static final Pattern CREATE_TABLE_AS_PATTERN = Pattern.compile("(?is)^create\\s+table\\s+([A-Za-z_][A-Za-z0-9_]*)\\s+as\\s+(select\\b.*)$");
    private static final Set<String> BLOCKED_SQL_WORDS = Set.of(
            "insert", "update", "delete", "drop", "alter", "truncate", "create", "replace", "merge", "grant", "revoke"
    );

    private final JdbcTemplate jdbcTemplate;
    private final JsonSnapshotSupport jsonSnapshotSupport;

    public DatasetServiceImpl(JdbcTemplate jdbcTemplate, JsonSnapshotSupport jsonSnapshotSupport) {
        this.jdbcTemplate = jdbcTemplate;
        this.jsonSnapshotSupport = jsonSnapshotSupport;
    }

    @Override
    public List<DatasetVo> listDatasets() {
        return jdbcTemplate.query(
                """
                SELECT model_code, model_name, model_type, description, physical_table_name,
                       source_sql, deletable, model_config_json
                FROM bi_dataset_model
                ORDER BY id
                """,
                (rs, rowNum) -> buildDatasetVo(
                        rs.getString("model_code"),
                        rs.getString("model_name"),
                        rs.getString("model_type"),
                        rs.getString("description"),
                        rs.getString("physical_table_name"),
                        rs.getString("source_sql"),
                        rs.getBoolean("deletable"),
                        rs.getString("model_config_json")
                )
        );
    }

    @Override
    public DatasetVo getDataset(String datasetCode) {
        List<DatasetVo> datasets = jdbcTemplate.query(
                """
                SELECT model_code, model_name, model_type, description, physical_table_name,
                       source_sql, deletable, model_config_json
                FROM bi_dataset_model
                WHERE model_code = ?
                """,
                (rs, rowNum) -> buildDatasetVo(
                        rs.getString("model_code"),
                        rs.getString("model_name"),
                        rs.getString("model_type"),
                        rs.getString("description"),
                        rs.getString("physical_table_name"),
                        rs.getString("source_sql"),
                        rs.getBoolean("deletable"),
                        rs.getString("model_config_json")
                ),
                datasetCode
        );
        return datasets.stream().findFirst().orElseThrow(() -> new IllegalArgumentException("未知数据池: " + datasetCode));
    }

    @SuppressWarnings("unchecked")
    private DatasetVo buildDatasetVo(String modelCode,
                                     String modelName,
                                     String modelType,
                                     String description,
                                     String physicalTableName,
                                     String sourceSql,
                                     boolean deletable,
                                     String modelConfigJson) {
        Map<String, Object> modelConfig = jsonSnapshotSupport.fromJson(modelConfigJson, Map.class);
        if (modelConfig == null) {
            modelConfig = new LinkedHashMap<>();
        }
        String createTableSql = Objects.toString(modelConfig.get("createTableSql"), null);
        return DatasetVo.builder()
                .dataPoolCode(modelCode)
                .dataPoolName(modelName)
                .dataPoolType(modelType)
                .dataPoolConfig(modelConfig)
                .datasetCode(modelCode)
                .datasetName(modelName)
                .tableName(physicalTableName)
                .sourceSql(sourceSql)
                .createTableSql(createTableSql)
                .deletable(deletable)
                .modelCode(modelCode)
                .modelName(modelName)
                .modelType(modelType)
                .description(description)
                .modelConfig(modelConfig)
                .fields(loadFields(modelCode))
                .build();
    }

    private List<FieldMetaVo> loadFields(String modelCode) {
        return jdbcTemplate.query(
                """
                SELECT field_code, field_name, data_type, field_role, agg_type,
                       source_expr, calc_type, base_field_code
                FROM bi_dataset_field
                WHERE model_code = ?
                ORDER BY sort_no, id
                """,
                (rs, rowNum) -> {
                    String fieldRole = rs.getString("field_role");
                    String dataType = rs.getString("data_type");
                    String aggType = rs.getString("agg_type");
                    String fieldName = rs.getString("field_name");
                    return FieldMetaVo.builder()
                            .fieldCode(rs.getString("field_code"))
                            .columnName(rs.getString("field_code"))
                            .fieldNameCn(fieldName)
                            .fieldNameEn(fieldName)
                            .fieldName(fieldName)
                            .fieldType(dataType)
                            .dataType(dataType)
                            .fieldRole(fieldRole)
                            .dimension("dimension".equalsIgnoreCase(fieldRole))
                            .metric("metric".equalsIgnoreCase(fieldRole))
                            .aggType(aggType)
                            .sourceExpr(rs.getString("source_expr"))
                            .calcType(rs.getString("calc_type"))
                            .baseFieldCode(rs.getString("base_field_code"))
                            .aggs(resolveAggs(fieldRole, aggType))
                            .build();
                },
                modelCode
        );
    }

    private List<String> resolveAggs(String fieldRole, String aggType) {
        if (!"metric".equalsIgnoreCase(fieldRole)) {
            return List.of();
        }
        if (aggType != null && !aggType.isBlank()) {
            return List.of(aggType, "sum", "avg", "max", "min", "count").stream().distinct().toList();
        }
        return List.of("sum", "avg", "max", "min", "count");
    }

    @Override
    @Transactional
    public DatasetVo createDataPool(CreateDataPoolRequest request) {
        String dataPoolCode = safeIdentifier(request.getDataPoolCode(), "dataPoolCode");
        String dataPoolType = normalizeDataPoolType(request.getDataPoolType());
        if (existsModel(dataPoolCode) || ("QUERY_TABLE".equals(dataPoolType) && existsTable(dataPoolCode))) {
            throw new IllegalArgumentException("数据池编码或物理表已存在: " + dataPoolCode);
        }

        String dataPoolName = requireText(request.getDataPoolName(), "dataPoolName");
        String physicalTableName;
        String sourceSql;
        String createTableSql = null;
        boolean deletable;
        Map<String, Object> dataPoolConfig;

        if ("SOURCE_TABLE".equals(dataPoolType)) {
            String sourceTable = safeIdentifier(request.getSourceTable(), "sourceTable");
            String sourceAlias = safeIdentifier(defaultText(request.getSourceAlias(), "t"), "sourceAlias");
            physicalTableName = sourceTable;
            sourceSql = "SELECT * FROM " + sourceTable;
            deletable = false;
            dataPoolConfig = Map.of(
                    "mainTable", Map.of("table", sourceTable, "alias", sourceAlias),
                    "joinTables", List.of(),
                    "sourceKind", "SOURCE_TABLE"
            );
        } else {
            physicalTableName = dataPoolCode;
            sourceSql = resolveQuerySourceSql(request, physicalTableName);
            QuerySqlPlan querySqlPlan = buildQuerySqlPlan(sourceSql);
            createTableSql = buildCreateTableSql(physicalTableName, querySqlPlan.rewrittenSql());
            jdbcTemplate.execute(createTableSql);
            deletable = true;
            dataPoolConfig = buildQueryTableConfig(physicalTableName, dataPoolName, sourceSql, createTableSql);
        }

        try {
            jdbcTemplate.update(
                    """
                    INSERT INTO bi_dataset_model(
                        model_code, model_name, model_type, description, physical_table_name,
                        source_sql, deletable, model_config_json
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                    """,
                    dataPoolCode,
                    dataPoolName,
                    dataPoolType,
                    request.getDescription(),
                    physicalTableName,
                    sourceSql,
                    deletable,
                    jsonSnapshotSupport.toJson(dataPoolConfig)
            );

            List<CreateDataPoolRequest.DataPoolFieldRequest> fields = request.getFields() == null || request.getFields().isEmpty()
                    ? ("QUERY_TABLE".equals(dataPoolType)
                        ? buildFieldsFromQuerySql(sourceSql)
                        : inferFields(physicalTableName, defaultText(request.getSourceAlias(), "t")))
                    : normalizeRequestedFields(request.getFields(), "SOURCE_TABLE".equals(dataPoolType) ? defaultText(request.getSourceAlias(), "t") : "dp", "QUERY_TABLE".equals(dataPoolType));
            insertFields(dataPoolCode, fields);
            return getDataset(dataPoolCode);
        } catch (RuntimeException ex) {
            if (deletable) {
                jdbcTemplate.execute("DROP TABLE IF EXISTS " + safeIdentifier(physicalTableName, "physicalTableName"));
            }
            throw ex;
        }
    }

    @Override
    @Transactional
    public DatasetVo updateDataPool(String dataPoolCode, CreateDataPoolRequest request) {
        String safeDataPoolCode = safeIdentifier(dataPoolCode, "dataPoolCode");
        DatasetVo current = getDataset(safeDataPoolCode);
        String nextName = request.getDataPoolName() == null || request.getDataPoolName().isBlank()
                ? current.getDataPoolName()
                : request.getDataPoolName().trim();
        String nextDescription = request.getDescription() == null ? current.getDescription() : request.getDescription();
        String nextSql = current.getSourceSql();
        Map<String, Object> nextConfig = current.getModelConfig() == null
                ? new LinkedHashMap<>()
                : new LinkedHashMap<>(current.getModelConfig());
        boolean fieldsShouldRefresh = request.getFields() != null && !request.getFields().isEmpty();

        if (current.isDeletable() && hasQueryUpdate(request)) {
            nextSql = resolveQuerySourceSql(request, current.getTableName());
            if (!nextSql.equals(current.getSourceSql())) {
                rebuildQueryTable(current.getTableName(), nextSql);
                fieldsShouldRefresh = true;
            }
            QuerySqlPlan querySqlPlan = buildQuerySqlPlan(nextSql);
            nextConfig = buildQueryTableConfig(current.getTableName(), nextName, nextSql, buildCreateTableSql(current.getTableName(), querySqlPlan.rewrittenSql()));
        }

        jdbcTemplate.update(
                """
                UPDATE bi_dataset_model
                SET model_name = ?, description = ?, source_sql = ?, model_config_json = ?
                WHERE model_code = ?
                """,
                nextName,
                nextDescription,
                nextSql,
                jsonSnapshotSupport.toJson(nextConfig),
                safeDataPoolCode
        );

        if (fieldsShouldRefresh) {
            jdbcTemplate.update("DELETE FROM bi_dataset_field WHERE model_code = ?", safeDataPoolCode);
            String alias = current.isDeletable()
                    ? "dp"
                    : Objects.toString(((Map<?, ?>) current.getModelConfig().get("mainTable")).get("alias"), "t");
            List<CreateDataPoolRequest.DataPoolFieldRequest> fields = request.getFields() == null || request.getFields().isEmpty()
                    ? (current.isDeletable() ? buildFieldsFromQuerySql(nextSql) : inferFields(current.getTableName(), alias))
                    : normalizeRequestedFields(request.getFields(), alias, current.isDeletable());
            insertFields(safeDataPoolCode, fields);
        }

        return getDataset(safeDataPoolCode);
    }

    @Override
    public List<FieldMetaVo> previewDataPoolFields(CreateDataPoolRequest request) {
        String dataPoolType = normalizeDataPoolType(request.getDataPoolType());
        if ("SOURCE_TABLE".equals(dataPoolType)) {
            String sourceTable = safeIdentifier(request.getSourceTable(), "sourceTable");
            String sourceAlias = safeIdentifier(defaultText(request.getSourceAlias(), "t"), "sourceAlias");
            return inferFields(sourceTable, sourceAlias).stream().map(field -> toFieldMeta(field, sourceAlias)).toList();
        }
        String sql = resolvePreviewSql(request);
        return previewSqlFields(sql);
    }

    @Override
    @Transactional
    public DatasetVo addCalculatedMetric(String dataPoolCode, CreateCalculatedMetricRequest request) {
        String safeDataPoolCode = safeIdentifier(dataPoolCode, "dataPoolCode");
        FieldMetaVo baseField = loadFields(safeDataPoolCode).stream()
                .filter(field -> field.getFieldCode().equals(request.getBaseFieldCode()))
                .findFirst()
                .orElseThrow(() -> new IllegalArgumentException("未知基础字段: " + request.getBaseFieldCode()));
        if (!"number".equalsIgnoreCase(baseField.getDataType())) {
            throw new IllegalArgumentException("计算字段必须基于数值类型字段");
        }

        Integer nextSortNo = jdbcTemplate.queryForObject(
                "SELECT COALESCE(MAX(sort_no), 0) + 1 FROM bi_dataset_field WHERE model_code = ?",
                Integer.class,
                safeDataPoolCode
        );
        String calcType = normalizeCalcType(request.getCalcType());
        String aggType = "rolling_3y_avg".equals(calcType) ? "avg" : normalizeAggType(request.getAggType());
        Map<String, Object> calcConfig = request.getCalcConfig() == null ? new LinkedHashMap<>() : request.getCalcConfig();
        if ("rolling_3y_avg".equals(calcType) && !calcConfig.containsKey("windowRows")) {
            calcConfig.put("windowRows", 755);
        }

        jdbcTemplate.update(
                """
                INSERT INTO bi_dataset_field(
                    model_code, field_code, field_name, data_type, field_role, agg_type,
                    source_expr, calc_type, base_field_code, calc_config_json, sort_no
                ) VALUES (?, ?, ?, ?, 'attribute', ?, ?, ?, ?, ?, ?)
                """,
                safeDataPoolCode,
                safeIdentifier(request.getFieldCode(), "fieldCode"),
                requireText(request.getFieldName(), "fieldName"),
                baseField.getDataType(),
                null,
                safeQualifiedIdentifier(baseField.getSourceExpr(), "base sourceExpr"),
                calcType,
                safeIdentifier(baseField.getFieldCode(), "baseFieldCode"),
                jsonSnapshotSupport.toJson(calcConfig),
                nextSortNo == null ? 100 : nextSortNo
        );
        return getDataset(safeDataPoolCode);
    }

    @Override
    @Transactional
    public void deleteDataPool(String dataPoolCode) {
        String safeDataPoolCode = safeIdentifier(dataPoolCode, "dataPoolCode");
        DatasetVo dataset = getDataset(safeDataPoolCode);
        if (!dataset.isDeletable()) {
            throw new IllegalArgumentException("源数据池不能删除: " + dataPoolCode);
        }
        Integer usedCount = jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM bi_component WHERE model_code = ?",
                Integer.class,
                safeDataPoolCode
        );
        if (usedCount != null && usedCount > 0) {
            throw new IllegalArgumentException("数据池正在被图表组件使用，不能删除: " + dataPoolCode);
        }
        jdbcTemplate.update("DELETE FROM bi_dataset_field WHERE model_code = ?", safeDataPoolCode);
        jdbcTemplate.update("DELETE FROM bi_dataset_model WHERE model_code = ?", safeDataPoolCode);
        jdbcTemplate.execute("DROP TABLE IF EXISTS " + safeIdentifier(dataset.getTableName(), "physicalTableName"));
    }

    @Override
    public List<SourceTableVo> listSourceTables() {
        String schemaName = currentSchemaName();
        List<SourceTableVo> managedTables = jdbcTemplate.query(
                """
                SELECT model_code, model_name, physical_table_name
                FROM bi_dataset_model
                ORDER BY id
                """,
                (rs, rowNum) -> SourceTableVo.builder()
                        .tableName(rs.getString("physical_table_name"))
                        .tableNameCn(rs.getString("model_name"))
                        .fields(loadFields(rs.getString("model_code")))
                        .build()
        );
        Set<String> managedTableSet = managedTables.stream()
                .map(SourceTableVo::getTableName)
                .filter(Objects::nonNull)
                .map(name -> name.toLowerCase(Locale.ROOT))
                .collect(Collectors.toSet());
        List<String> tableNames = jdbcTemplate.queryForList(
                """
                SELECT table_name
                FROM information_schema.tables
                WHERE table_schema = ?
                  AND table_type = 'BASE TABLE'
                  AND table_name NOT LIKE 'bi_%'
                ORDER BY table_name
                """,
                String.class,
                schemaName
        );
        List<SourceTableVo> unmanagedTables = tableNames.stream()
                .filter(table -> !managedTableSet.contains(table.toLowerCase(Locale.ROOT)))
                .map(table -> SourceTableVo.builder()
                        .tableName(table)
                        .tableNameCn(loadConfiguredTableName(table))
                        .fields(loadSourceFields(table))
                        .build())
                .toList();
        List<SourceTableVo> merged = new ArrayList<>(managedTables);
        merged.addAll(unmanagedTables);
        return merged;
    }

    private boolean existsModel(String modelCode) {
        Integer count = jdbcTemplate.queryForObject("SELECT COUNT(*) FROM bi_dataset_model WHERE model_code = ?", Integer.class, modelCode);
        return count != null && count > 0;
    }

    private boolean existsTable(String tableName) {
        String schemaName = currentSchemaName();
        Integer count = jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = ? AND table_name = ?",
                Integer.class,
                schemaName,
                tableName
        );
        return count != null && count > 0;
    }

    private String loadConfiguredTableName(String tableName) {
        List<String> names = jdbcTemplate.queryForList(
                """
                SELECT model_name
                FROM bi_dataset_model
                WHERE physical_table_name = ? AND deletable = 0
                ORDER BY id
                LIMIT 1
                """,
                String.class,
                tableName
        );
        return names.stream().findFirst().orElse(tableName);
    }

    private List<FieldMetaVo> loadSourceFields(String tableName) {
        List<String> modelCodes = jdbcTemplate.queryForList(
                """
                SELECT model_code
                FROM bi_dataset_model
                WHERE physical_table_name = ? AND deletable = 0
                ORDER BY id
                LIMIT 1
                """,
                String.class,
                tableName
        );
        if (!modelCodes.isEmpty()) {
            return loadFields(modelCodes.get(0));
        }
        return inferFields(tableName, "t").stream().map(field -> toFieldMeta(field, "t")).toList();
    }

    private FieldMetaVo toFieldMeta(CreateDataPoolRequest.DataPoolFieldRequest field, String alias) {
        return FieldMetaVo.builder()
                .fieldCode(field.getFieldCode())
                .columnName(field.getFieldCode())
                .fieldName(field.getFieldName())
                .fieldNameCn(field.getFieldName())
                .fieldNameEn(field.getFieldName())
                .fieldType(field.getDataType())
                .dataType(field.getDataType())
                .fieldRole(field.getFieldRole())
                .dimension("dimension".equalsIgnoreCase(field.getFieldRole()))
                .metric("metric".equalsIgnoreCase(field.getFieldRole()))
                .aggType(field.getAggType())
                .sourceExpr(alias + "." + field.getFieldCode())
                .aggs(resolveAggs(field.getFieldRole(), field.getAggType()))
                .build();
    }

    private void insertFields(String dataPoolCode, List<CreateDataPoolRequest.DataPoolFieldRequest> fields) {
        int sortNo = 1;
        for (CreateDataPoolRequest.DataPoolFieldRequest field : fields) {
            String role = normalizeFieldRole(field.getFieldRole(), field.getDataType());
            jdbcTemplate.update(
                    """
                    INSERT INTO bi_dataset_field(
                        model_code, field_code, field_name, data_type, field_role, agg_type, source_expr, sort_no
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                    """,
                    dataPoolCode,
                    safeIdentifier(field.getFieldCode(), "fieldCode"),
                    requireText(field.getFieldName(), "fieldName"),
                    normalizeDataType(field.getDataType()),
                    role,
                    "metric".equalsIgnoreCase(role) ? normalizeAggType(field.getAggType()) : null,
                    safeQualifiedIdentifier(field.getSourceExpr(), "sourceExpr"),
                    sortNo++
            );
        }
    }

    private void rebuildQueryTable(String tableName, String sqlText) {
        String safeTableName = safeIdentifier(tableName, "physicalTableName");
        String tempTableName = safeIdentifier(tableName + "_tmp", "tempPhysicalTableName");
        try {
            jdbcTemplate.execute("DROP TABLE IF EXISTS " + tempTableName);
            jdbcTemplate.execute(buildCreateTableSql(tempTableName, buildQuerySqlPlan(sqlText).rewrittenSql()));
            jdbcTemplate.execute("DROP TABLE " + safeTableName);
            jdbcTemplate.execute("RENAME TABLE " + tempTableName + " TO " + safeTableName);
        } catch (RuntimeException ex) {
            jdbcTemplate.execute("DROP TABLE IF EXISTS " + tempTableName);
            throw ex;
        }
    }

    private List<CreateDataPoolRequest.DataPoolFieldRequest> normalizeRequestedFields(List<CreateDataPoolRequest.DataPoolFieldRequest> fields,
                                                                                     String sourceAlias,
                                                                                     boolean forcePhysicalSourceExpr) {
        List<CreateDataPoolRequest.DataPoolFieldRequest> normalized = new ArrayList<>();
        for (CreateDataPoolRequest.DataPoolFieldRequest field : fields) {
            CreateDataPoolRequest.DataPoolFieldRequest next = new CreateDataPoolRequest.DataPoolFieldRequest();
            String fieldCode = safeIdentifier(field.getFieldCode(), "fieldCode");
            next.setFieldCode(fieldCode);
            next.setFieldName(requireText(field.getFieldName(), "fieldName"));
            next.setDataType(normalizeDataType(field.getDataType()));
            next.setFieldRole(normalizeFieldRole(field.getFieldRole(), next.getDataType()));
            next.setAggType(field.getAggType());
            next.setSourceExpr(forcePhysicalSourceExpr ? sourceAlias + "." + fieldCode : safeQualifiedIdentifier(field.getSourceExpr(), "sourceExpr"));
            normalized.add(next);
        }
        return normalized;
    }

    private String buildCreateTableSql(String tableName, String sqlText) {
        return "CREATE TABLE " + safeIdentifier(tableName, "physicalTableName") + " AS SELECT * FROM (" + sqlText + ") dp_source";
    }

    private List<CreateDataPoolRequest.DataPoolFieldRequest> inferFields(String tableName, String alias) {
        String schemaName = currentSchemaName();
        return jdbcTemplate.query(
                """
                SELECT column_name, data_type
                FROM information_schema.columns
                WHERE table_schema = ? AND table_name = ?
                  ORDER BY ordinal_position
                """,
                (rs, rowNum) -> {
                    String columnName = rs.getString("column_name");
                    String dataType = normalizeDataType(rs.getString("data_type"));
                    CreateDataPoolRequest.DataPoolFieldRequest field = new CreateDataPoolRequest.DataPoolFieldRequest();
                    field.setFieldCode(columnName);
                    field.setFieldName(columnName);
                    field.setDataType(dataType);
                    field.setFieldRole("attribute");
                    field.setAggType(null);
                    field.setSourceExpr(alias + "." + columnName);
                    return field;
                },
                schemaName,
                tableName
        );
    }

    private String currentSchemaName() {
        return jdbcTemplate.execute((ConnectionCallback<String>) connection -> {
            String schema = connection.getSchema();
            if (schema != null && !schema.isBlank()) {
                return schema;
            }
            String catalog = connection.getCatalog();
            if (catalog != null && !catalog.isBlank()) {
                return catalog;
            }
            return "PUBLIC";
        });
    }

    private List<FieldMetaVo> previewSqlFields(String sql) {
        QuerySqlPlan querySqlPlan = buildQuerySqlPlan(sql);
        List<SelectFieldSpec> selectFieldSpecs = querySqlPlan.selectFieldSpecs();
        Map<String, String> aliasToTable = parseTableAliasMap(sql);
        Map<String, FieldMetaVo> sourceFieldMap = buildSourceFieldMap();
        return jdbcTemplate.query("SELECT * FROM (" + querySqlPlan.rewrittenSql() + ") dp_preview WHERE 1 = 0", rs -> {
            ResultSetMetaData metaData = rs.getMetaData();
            List<FieldMetaVo> fields = new ArrayList<>();
            for (int index = 1; index <= metaData.getColumnCount(); index++) {
                String columnName = safeIdentifier(metaData.getColumnLabel(index), "sql column alias");
                String dataType = normalizeDataType(metaData.getColumnTypeName(index));
                SelectFieldSpec spec = index - 1 < selectFieldSpecs.size() ? selectFieldSpecs.get(index - 1) : null;
                String fieldName = spec == null ? columnName : resolveFieldDisplayName(spec, aliasToTable, sourceFieldMap, columnName);
                String role = "attribute";
                String aggType = null;
                fields.add(FieldMetaVo.builder()
                        .fieldCode(columnName)
                        .columnName(columnName)
                        .fieldName(fieldName)
                        .fieldNameCn(fieldName)
                        .fieldNameEn(columnName)
                        .fieldType(dataType)
                        .dataType(dataType)
                        .fieldRole(role)
                        .dimension("dimension".equals(role))
                        .metric("metric".equals(role))
                        .aggType(aggType)
                        .sourceExpr("dp." + columnName)
                        .aggs(resolveAggs(role, aggType))
                        .build());
            }
            return fields;
        });
    }

    private List<CreateDataPoolRequest.DataPoolFieldRequest> buildFieldsFromQuerySql(String sql) {
        return previewSqlFields(sql).stream().map(fieldMeta -> {
            CreateDataPoolRequest.DataPoolFieldRequest field = new CreateDataPoolRequest.DataPoolFieldRequest();
            field.setFieldCode(fieldMeta.getFieldCode());
            field.setFieldName(fieldMeta.getFieldName());
            field.setDataType(fieldMeta.getDataType());
            field.setFieldRole("attribute");
            field.setAggType(null);
            field.setSourceExpr("dp." + fieldMeta.getFieldCode());
            return field;
        }).toList();
    }

    private QuerySqlPlan buildQuerySqlPlan(String sql) {
        List<SelectFieldSpec> specs = parseSelectFieldSpecs(sql);
        if (specs.isEmpty()) {
            return new QuerySqlPlan(sql, specs);
        }
        int selectIndex = indexOfTopLevelKeyword(sql.toLowerCase(Locale.ROOT), "select");
        int fromIndex = indexOfTopLevelKeyword(sql.toLowerCase(Locale.ROOT), "from");
        if (selectIndex < 0 || fromIndex <= selectIndex) {
            return new QuerySqlPlan(sql, specs);
        }
        String prefix = sql.substring(0, selectIndex + 6);
        String suffix = sql.substring(fromIndex);
        List<String> rewrittenItems = new ArrayList<>();
        int fallbackIndex = 1;
        for (SelectFieldSpec spec : specs) {
            String rewrittenAlias = spec.safeAlias();
            if (rewrittenAlias == null || rewrittenAlias.isBlank()) {
                rewrittenAlias = buildSafeFieldCode(spec.expression(), fallbackIndex++);
            }
            rewrittenItems.add(spec.expression() + " AS " + rewrittenAlias);
        }
        return new QuerySqlPlan(prefix + " " + String.join(", ", rewrittenItems) + " " + suffix, specs);
    }

    private String buildSafeFieldCode(String expression, int index) {
        String candidate = stripWrapping(expression);
        if (SQL_QUALIFIED_IDENTIFIER.matcher(candidate).matches()) {
            String[] parts = candidate.split("\\.");
            candidate = parts[parts.length - 1];
        }
        candidate = candidate.replaceAll("[^A-Za-z0-9_]", "_");
        candidate = candidate.replaceAll("_+", "_");
        candidate = candidate.replaceAll("^_+", "");
        candidate = candidate.replaceAll("_+$", "");
        if (candidate.isBlank()) {
            candidate = "field_" + index;
        }
        if (!Character.isLetter(candidate.charAt(0)) && candidate.charAt(0) != '_') {
            candidate = "f_" + candidate;
        }
        return safeIdentifier(candidate, "generated fieldCode");
    }

    private boolean hasQueryUpdate(CreateDataPoolRequest request) {
        return (request.getSqlText() != null && !request.getSqlText().isBlank())
                || (request.getCreateTableSql() != null && !request.getCreateTableSql().isBlank());
    }

    private String resolveQuerySourceSql(CreateDataPoolRequest request, String tableName) {
        if (request.getSqlText() != null && !request.getSqlText().isBlank()) {
            return normalizeSelectSql(request.getSqlText());
        }
        if (request.getCreateTableSql() != null && !request.getCreateTableSql().isBlank()) {
            return extractSelectSqlFromCreateTable(request.getCreateTableSql(), tableName);
        }
        return normalizeSelectSql(request.getSqlText());
    }

    private String resolvePreviewSql(CreateDataPoolRequest request) {
        if (request.getSqlText() != null && !request.getSqlText().isBlank()) {
            String sqlText = request.getSqlText().trim();
            String lower = sqlText.toLowerCase(Locale.ROOT);
            if (lower.startsWith("create table ")) {
                return extractSelectSqlFromAnyCreateTable(sqlText);
            }
            return normalizeSelectSql(sqlText);
        }
        if (request.getCreateTableSql() != null && !request.getCreateTableSql().isBlank()) {
            return extractSelectSqlFromAnyCreateTable(request.getCreateTableSql());
        }
        return normalizeSelectSql(request.getSqlText());
    }

    private Map<String, Object> buildQueryTableConfig(String tableName,
                                                      String tableNameCn,
                                                      String sourceSql,
                                                      String createTableSql) {
        Map<String, String> aliasToTable = parseTableAliasMap(sourceSql);
        List<Map<String, Object>> joinTables = aliasToTable.entrySet().stream()
                .filter(entry -> !entry.getKey().equals(entry.getValue()))
                .map(entry -> Map.<String, Object>of(
                        "table", entry.getValue(),
                        "alias", entry.getKey(),
                        "tableNameCn", loadConfiguredTableName(entry.getValue())
                ))
                .toList();
        return new LinkedHashMap<>(Map.of(
                "mainTable", Map.of("table", tableName, "alias", "dp", "tableNameCn", tableNameCn),
                "joinTables", joinTables,
                "sourceKind", "QUERY_TABLE",
                "createTableSql", createTableSql
        ));
    }

    private String extractSelectSqlFromCreateTable(String createTableSql, String expectedTableName) {
        String sql = requireText(createTableSql, "createTableSql").trim();
        while (sql.endsWith(";")) {
            sql = sql.substring(0, sql.length() - 1).trim();
        }
        if (sql.contains(";") || sql.contains("--") || sql.contains("/*") || sql.contains("*/")) {
            throw new IllegalArgumentException("建表语句不能包含多语句或注释");
        }
        var matcher = CREATE_TABLE_AS_PATTERN.matcher(sql);
        if (!matcher.matches()) {
            throw new IllegalArgumentException("建表语句仅支持 CREATE TABLE <table> AS SELECT ...");
        }
        String tableName = safeIdentifier(matcher.group(1), "physicalTableName");
        if (!tableName.equals(expectedTableName)) {
            throw new IllegalArgumentException("建表语句中的表名必须与数据池编码一致: " + expectedTableName);
        }
        return normalizeSelectSql(matcher.group(2));
    }

    private String extractSelectSqlFromAnyCreateTable(String createTableSql) {
        String sql = requireText(createTableSql, "sqlText").trim();
        while (sql.endsWith(";")) {
            sql = sql.substring(0, sql.length() - 1).trim();
        }
        if (sql.contains(";") || sql.contains("--") || sql.contains("/*") || sql.contains("*/")) {
            throw new IllegalArgumentException("建表语句不能包含多语句或注释");
        }
        var matcher = CREATE_TABLE_AS_PATTERN.matcher(sql);
        if (!matcher.matches()) {
            throw new IllegalArgumentException("数据池 SQL 只能是 SELECT 查询，或 CREATE TABLE ... AS SELECT ...");
        }
        return normalizeSelectSql(matcher.group(2));
    }

    private Map<String, FieldMetaVo> buildSourceFieldMap() {
        Map<String, FieldMetaVo> fieldMap = new HashMap<>();
        for (SourceTableVo table : listSourceTables()) {
            for (FieldMetaVo field : table.getFields()) {
                fieldMap.put((table.getTableName() + "." + field.getFieldCode()).toLowerCase(Locale.ROOT), field);
            }
        }
        return fieldMap;
    }

    private Map<String, String> parseTableAliasMap(String sql) {
        var matcher = TABLE_ALIAS_PATTERN.matcher(collapseWhitespace(sql));
        Map<String, String> aliasMap = new LinkedHashMap<>();
        while (matcher.find()) {
            String tableName = safeIdentifier(matcher.group(1), "tableName");
            String alias = matcher.group(2);
            String resolvedAlias = alias == null || alias.isBlank() ? tableName : safeIdentifier(alias, "tableAlias");
            aliasMap.put(resolvedAlias, tableName);
            aliasMap.putIfAbsent(tableName, tableName);
        }
        return aliasMap;
    }

    private List<SelectFieldSpec> parseSelectFieldSpecs(String sql) {
        String lowerSql = sql.toLowerCase(Locale.ROOT);
        int selectIndex = indexOfTopLevelKeyword(lowerSql, "select");
        int fromIndex = indexOfTopLevelKeyword(lowerSql, "from");
        if (selectIndex < 0 || fromIndex <= selectIndex) {
            return List.of();
        }
        String selectClause = sql.substring(selectIndex + 6, fromIndex).trim();
        if (selectClause.isBlank()) {
            return List.of();
        }
        return splitTopLevel(selectClause, ',').stream()
                .map(this::parseSelectField)
                .toList();
    }

    private SelectFieldSpec parseSelectField(String rawItem) {
        String item = rawItem.trim();
        String expression = item;
        String alias = null;
        String safeAlias = null;
        int asIndex = lastTopLevelAsIndex(item);
        if (asIndex >= 0) {
            expression = item.substring(0, asIndex).trim();
            alias = stripWrapping(item.substring(asIndex + 4).trim());
            safeAlias = SQL_IDENTIFIER.matcher(alias).matches() ? alias : null;
        }
        return new SelectFieldSpec(item, expression, alias, safeAlias);
    }

    private String resolveFieldDisplayName(SelectFieldSpec spec,
                                           Map<String, String> aliasToTable,
                                           Map<String, FieldMetaVo> sourceFieldMap,
                                           String fallback) {
        if (spec.alias() != null && !spec.alias().isBlank()) {
            return spec.alias();
        }
        String expression = stripWrapping(spec.expression());
        if (!SQL_QUALIFIED_IDENTIFIER.matcher(expression).matches()) {
            return fallback;
        }
        String[] parts = expression.split("\\.");
        String alias = parts.length == 2 ? parts[0] : "";
        String fieldCode = parts.length == 2 ? parts[1] : parts[0];
        String tableName = parts.length == 2 ? aliasToTable.getOrDefault(alias, alias) : "";
        if (!tableName.isBlank()) {
            FieldMetaVo fieldMeta = sourceFieldMap.get((tableName + "." + fieldCode).toLowerCase(Locale.ROOT));
            if (fieldMeta != null && fieldMeta.getFieldName() != null && !fieldMeta.getFieldName().isBlank()) {
                return fieldMeta.getFieldName();
            }
        }
        return fallback;
    }

    private int indexOfTopLevelKeyword(String sql, String keyword) {
        int level = 0;
        boolean singleQuote = false;
        boolean doubleQuote = false;
        for (int index = 0; index <= sql.length() - keyword.length(); index++) {
            char current = sql.charAt(index);
            if (current == '\'' && !doubleQuote) {
                singleQuote = !singleQuote;
            } else if (current == '"' && !singleQuote) {
                doubleQuote = !doubleQuote;
            } else if (!singleQuote && !doubleQuote) {
                if (current == '(') {
                    level++;
                } else if (current == ')') {
                    level = Math.max(0, level - 1);
                }
            }
            if (level == 0 && !singleQuote && !doubleQuote && sql.startsWith(keyword, index)) {
                boolean leftBoundary = index == 0 || !Character.isLetterOrDigit(sql.charAt(index - 1));
                boolean rightBoundary = index + keyword.length() >= sql.length()
                        || !Character.isLetterOrDigit(sql.charAt(index + keyword.length()));
                if (leftBoundary && rightBoundary) {
                    return index;
                }
            }
        }
        return -1;
    }

    private List<String> splitTopLevel(String text, char delimiter) {
        List<String> parts = new ArrayList<>();
        StringBuilder current = new StringBuilder();
        int level = 0;
        boolean singleQuote = false;
        boolean doubleQuote = false;
        for (int index = 0; index < text.length(); index++) {
            char ch = text.charAt(index);
            if (ch == '\'' && !doubleQuote) {
                singleQuote = !singleQuote;
            } else if (ch == '"' && !singleQuote) {
                doubleQuote = !doubleQuote;
            } else if (!singleQuote && !doubleQuote) {
                if (ch == '(') {
                    level++;
                } else if (ch == ')') {
                    level = Math.max(0, level - 1);
                } else if (ch == delimiter && level == 0) {
                    parts.add(current.toString().trim());
                    current.setLength(0);
                    continue;
                }
            }
            current.append(ch);
        }
        if (!current.isEmpty()) {
            parts.add(current.toString().trim());
        }
        return parts;
    }

    private int lastTopLevelAsIndex(String text) {
        String lower = text.toLowerCase(Locale.ROOT);
        int level = 0;
        boolean singleQuote = false;
        boolean doubleQuote = false;
        int result = -1;
        for (int index = 0; index <= lower.length() - 4; index++) {
            char ch = lower.charAt(index);
            if (ch == '\'' && !doubleQuote) {
                singleQuote = !singleQuote;
            } else if (ch == '"' && !singleQuote) {
                doubleQuote = !doubleQuote;
            } else if (!singleQuote && !doubleQuote) {
                if (ch == '(') {
                    level++;
                } else if (ch == ')') {
                    level = Math.max(0, level - 1);
                }
            }
            if (level == 0 && !singleQuote && !doubleQuote && lower.startsWith(" as ", index)) {
                result = index;
            }
        }
        return result;
    }

    private String stripWrapping(String text) {
        String value = text == null ? "" : text.trim();
        if ((value.startsWith("`") && value.endsWith("`")) || (value.startsWith("\"") && value.endsWith("\""))) {
            return value.substring(1, value.length() - 1);
        }
        return value;
    }

    private String collapseWhitespace(String text) {
        return text == null ? "" : text.replaceAll("\\s+", " ").trim();
    }

    private record SelectFieldSpec(String raw, String expression, String alias, String safeAlias) {
    }

    private record QuerySqlPlan(String rewrittenSql, List<SelectFieldSpec> selectFieldSpecs) {
    }

    private String normalizeSelectSql(String sqlText) {
        String sql = requireText(sqlText, "sqlText").trim();
        while (sql.endsWith(";")) {
            sql = sql.substring(0, sql.length() - 1).trim();
        }
        String lower = sql.toLowerCase(Locale.ROOT);
        if (!SQL_SELECT_PREFIX.matcher(sql).matches()) {
            throw new IllegalArgumentException("数据池 SQL 只能是 SELECT 查询");
        }
        if (sql.contains(";") || lower.contains("--") || lower.contains("/*") || lower.contains("*/")) {
            throw new IllegalArgumentException("数据池 SQL 不能包含多语句或注释");
        }
        for (String word : BLOCKED_SQL_WORDS) {
            if (Pattern.compile("(^|\\W)" + word + "(\\W|$)", Pattern.CASE_INSENSITIVE).matcher(sql).find()) {
                throw new IllegalArgumentException("数据池 SQL 不能包含写操作关键字: " + word);
            }
        }
        return sql;
    }

    private String normalizeDataPoolType(String dataPoolType) {
        String type = defaultText(dataPoolType, "SOURCE_TABLE").toUpperCase(Locale.ROOT);
        if ("SINGLE_TABLE".equals(type)) {
            return "SOURCE_TABLE";
        }
        if ("MULTI_TABLE".equals(type) || "QUERY_TABLE".equals(type)) {
            return "QUERY_TABLE";
        }
        if (!"SOURCE_TABLE".equals(type)) {
            throw new IllegalArgumentException("不支持的数据池类型: " + dataPoolType);
        }
        return type;
    }

    private String normalizeFieldRole(String fieldRole, String dataType) {
        String role = defaultText(fieldRole, "attribute").toLowerCase(Locale.ROOT);
        if (!List.of("dimension", "metric", "attribute").contains(role)) {
            throw new IllegalArgumentException("不支持的字段角色: " + fieldRole);
        }
        return role;
    }

    private String normalizeDataType(String databaseType) {
        String type = defaultText(databaseType, "string").toLowerCase(Locale.ROOT);
        if (List.of("int", "integer", "bigint", "decimal", "double", "float", "numeric", "smallint", "tinyint", "number").contains(type)) {
            return "number";
        }
        if (List.of("date", "datetime", "timestamp", "time").contains(type)) {
            return "date";
        }
        return "string";
    }

    private String normalizeAggType(String aggType) {
        String agg = defaultText(aggType, "sum").toLowerCase(Locale.ROOT);
        if (!List.of("sum", "avg", "max", "min", "count").contains(agg)) {
            throw new IllegalArgumentException("不支持的聚合方式: " + aggType);
        }
        return agg;
    }

    private String normalizeCalcType(String calcType) {
        String type = defaultText(calcType, "avg").toLowerCase(Locale.ROOT);
        if (!List.of("avg", "sum", "max", "min", "rolling_3y_avg").contains(type)) {
            throw new IllegalArgumentException("不支持的计算指标类型: " + calcType);
        }
        return type;
    }

    private String requireText(String value, String context) {
        if (value == null || value.isBlank()) {
            throw new IllegalArgumentException(context + " 不能为空");
        }
        return value.trim();
    }

    private String defaultText(String value, String fallback) {
        return value == null || value.isBlank() ? fallback : value.trim();
    }

    private String safeIdentifier(String value, String context) {
        if (value == null || !SQL_IDENTIFIER.matcher(value).matches()) {
            throw new IllegalArgumentException("不安全的标识符 " + context + ": " + value);
        }
        return value;
    }

    private String safeQualifiedIdentifier(String value, String context) {
        if (value == null || !SQL_QUALIFIED_IDENTIFIER.matcher(value).matches()) {
            throw new IllegalArgumentException("不安全的 SQL 表达式 " + context + ": " + value);
        }
        return value;
    }
}
