package com.bi.service.dataset;

import com.bi.common.JsonSnapshotSupport;
import com.bi.dto.CreateDataPoolRequest;
import com.bi.vo.DatasetVo;
import com.bi.vo.FieldMetaVo;
import com.bi.vo.SourceTableVo;
import org.springframework.jdbc.core.ConnectionCallback;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

import java.sql.ResultSetMetaData;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.stream.Collectors;

@Component
public class DatasetMetadataSupport {
    private final JdbcTemplate jdbcTemplate;
    private final JsonSnapshotSupport jsonSnapshotSupport;
    private final DatasetSqlSupport datasetSqlSupport;

    public DatasetMetadataSupport(JdbcTemplate jdbcTemplate,
                                  JsonSnapshotSupport jsonSnapshotSupport,
                                  DatasetSqlSupport datasetSqlSupport) {
        this.jdbcTemplate = jdbcTemplate;
        this.jsonSnapshotSupport = jsonSnapshotSupport;
        this.datasetSqlSupport = datasetSqlSupport;
    }

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

    public DatasetVo getDataset(String modelCode) {
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
                modelCode
        );
        return datasets.stream()
                .findFirst()
                .orElseThrow(() -> new IllegalArgumentException("未知数据池: " + modelCode));
    }

    public List<FieldMetaVo> loadFields(String modelCode) {
        return jdbcTemplate.query(
                """
                SELECT field_code, field_name, data_type, field_role, agg_type,
                       source_expr, calc_type, base_field_code
                FROM bi_dataset_field
                WHERE model_code = ?
                ORDER BY sort_no, id
                """,
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
        );
    }

    public boolean existsModel(String modelCode) {
        Integer count = jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM bi_dataset_model WHERE model_code = ?",
                Integer.class,
                modelCode
        );
        return count != null && count > 0;
    }

    public boolean existsTable(String tableName) {
        String schemaName = currentSchemaName();
        Integer count = jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = ? AND table_name = ?",
                Integer.class,
                schemaName,
                tableName
        );
        return count != null && count > 0;
    }

    public List<FieldMetaVo> previewDataPoolFields(CreateDataPoolRequest request) {
        String dataPoolType = datasetSqlSupport.normalizeDataPoolType(request.getDataPoolType());
        if ("SOURCE_TABLE".equals(dataPoolType)) {
            String sourceTable = datasetSqlSupport.safeIdentifier(request.getSourceTable(), "sourceTable");
            String sourceAlias = datasetSqlSupport.safeIdentifier(
                    datasetSqlSupport.defaultText(request.getSourceAlias(), "t"),
                    "sourceAlias"
            );
            return inferFields(sourceTable, sourceAlias).stream().map(field -> toFieldMeta(field, sourceAlias)).toList();
        }
        return previewSqlFields(datasetSqlSupport.resolvePreviewSql(request));
    }

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

    public List<CreateDataPoolRequest.DataPoolFieldRequest> normalizeRequestedFields(
            List<CreateDataPoolRequest.DataPoolFieldRequest> fields,
            String sourceAlias,
            boolean forcePhysicalSourceExpr
    ) {
        List<CreateDataPoolRequest.DataPoolFieldRequest> normalized = new ArrayList<>();
        for (CreateDataPoolRequest.DataPoolFieldRequest field : fields) {
            CreateDataPoolRequest.DataPoolFieldRequest next = new CreateDataPoolRequest.DataPoolFieldRequest();
            String fieldCode = datasetSqlSupport.safeIdentifier(field.getFieldCode(), "fieldCode");
            next.setFieldCode(fieldCode);
            next.setFieldName(datasetSqlSupport.requireText(field.getFieldName(), "fieldName"));
            next.setDataType(datasetSqlSupport.normalizeDataType(field.getDataType()));
            next.setFieldRole(datasetSqlSupport.normalizeFieldRole(field.getFieldRole(), next.getDataType()));
            next.setAggType(field.getAggType());
            next.setSourceExpr(
                    forcePhysicalSourceExpr
                            ? sourceAlias + "." + fieldCode
                            : datasetSqlSupport.safeQualifiedIdentifier(field.getSourceExpr(), "sourceExpr")
            );
            normalized.add(next);
        }
        return normalized;
    }

    public void insertFields(String dataPoolCode, List<CreateDataPoolRequest.DataPoolFieldRequest> fields) {
        int sortNo = 1;
        for (CreateDataPoolRequest.DataPoolFieldRequest field : fields) {
            String role = datasetSqlSupport.normalizeFieldRole(field.getFieldRole(), field.getDataType());
            jdbcTemplate.update(
                    """
                    INSERT INTO bi_dataset_field(
                        model_code, field_code, field_name, data_type, field_role, agg_type, source_expr, sort_no
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                    """,
                    dataPoolCode,
                    datasetSqlSupport.safeIdentifier(field.getFieldCode(), "fieldCode"),
                    datasetSqlSupport.requireText(field.getFieldName(), "fieldName"),
                    datasetSqlSupport.normalizeDataType(field.getDataType()),
                    role,
                    "metric".equalsIgnoreCase(role) ? datasetSqlSupport.normalizeAggType(field.getAggType()) : null,
                    datasetSqlSupport.safeQualifiedIdentifier(field.getSourceExpr(), "sourceExpr"),
                    sortNo++
            );
        }
    }

    public List<CreateDataPoolRequest.DataPoolFieldRequest> inferFields(String tableName, String alias) {
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
                    String dataType = datasetSqlSupport.normalizeDataType(rs.getString("data_type"));
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

    public List<CreateDataPoolRequest.DataPoolFieldRequest> buildFieldsFromQuerySql(String sql) {
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

    public String loadConfiguredTableName(String tableName) {
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

    public String resolveMainTableAlias(DatasetVo dataset) {
        if (dataset.getModelConfig() == null) {
            return "t";
        }
        Object mainTable = dataset.getModelConfig().get("mainTable");
        if (mainTable instanceof Map<?, ?> mainTableMap) {
            return Objects.toString(mainTableMap.get("alias"), "t");
        }
        return "t";
    }

    private DatasetVo buildDatasetVo(String modelCode,
                                     String modelName,
                                     String modelType,
                                     String description,
                                     String physicalTableName,
                                     String sourceSql,
                                     boolean deletable,
                                     String modelConfigJson) {
        @SuppressWarnings("unchecked")
        Map<String, Object> modelConfig = jsonSnapshotSupport.fromJson(modelConfigJson, Map.class);
        if (modelConfig == null) {
            modelConfig = new LinkedHashMap<>();
        }
        String createTableSql = Objects.toString(modelConfig.get("createTableSql"), null);
        return DatasetVo.builder()
                .dataPoolCode(modelCode)
                .dataPoolName(modelName)
                .dataPoolType(modelType)
                .tableName(physicalTableName)
                .sourceSql(sourceSql)
                .createTableSql(createTableSql)
                .deletable(deletable)
                .modelCode(modelCode)
                .description(description)
                .modelConfig(modelConfig)
                .fields(loadFields(modelCode))
                .build();
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
                .fieldName(field.getFieldName())
                .dataType(field.getDataType())
                .fieldRole(field.getFieldRole())
                .aggType(field.getAggType())
                .sourceExpr(alias + "." + field.getFieldCode())
                .build();
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
        DatasetQuerySqlPlan querySqlPlan = datasetSqlSupport.buildQuerySqlPlan(sql);
        List<DatasetSelectFieldSpec> selectFieldSpecs = querySqlPlan.selectFieldSpecs();
        Map<String, String> aliasToTable = datasetSqlSupport.parseTableAliasMap(sql);
        Map<String, FieldMetaVo> sourceFieldMap = buildSourceFieldMap();
        return jdbcTemplate.query("SELECT * FROM (" + querySqlPlan.rewrittenSql() + ") dp_preview WHERE 1 = 0", rs -> {
            ResultSetMetaData metaData = rs.getMetaData();
            List<FieldMetaVo> fields = new ArrayList<>();
            for (int index = 1; index <= metaData.getColumnCount(); index++) {
                String columnName = datasetSqlSupport.safeIdentifier(metaData.getColumnLabel(index), "sql column alias");
                String dataType = datasetSqlSupport.normalizeDataType(metaData.getColumnTypeName(index));
                DatasetSelectFieldSpec spec = index - 1 < selectFieldSpecs.size() ? selectFieldSpecs.get(index - 1) : null;
                String fieldName = spec == null
                        ? columnName
                        : datasetSqlSupport.resolveFieldDisplayName(spec, aliasToTable, sourceFieldMap, columnName);
                fields.add(FieldMetaVo.builder()
                        .fieldCode(columnName)
                        .fieldName(fieldName)
                        .dataType(dataType)
                        .fieldRole("attribute")
                        .aggType(null)
                        .sourceExpr("dp." + columnName)
                        .build());
            }
            return fields;
        });
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
}
