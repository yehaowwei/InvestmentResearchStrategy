package com.bi.service.impl;

import com.bi.common.JsonSnapshotSupport;
import com.bi.dto.CreateCalculatedMetricRequest;
import com.bi.dto.CreateDataPoolRequest;
import com.bi.service.DatasetService;
import com.bi.service.dataset.DatasetMetadataSupport;
import com.bi.service.dataset.DatasetQueryTableSupport;
import com.bi.service.dataset.DatasetSqlSupport;
import com.bi.service.dataset.DatasetQuerySqlPlan;
import com.bi.vo.DatasetVo;
import com.bi.vo.FieldMetaVo;
import com.bi.vo.SourceTableVo;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@Service
public class DatasetServiceImpl implements DatasetService {
    private final JdbcTemplate jdbcTemplate;
    private final JsonSnapshotSupport jsonSnapshotSupport;
    private final DatasetSqlSupport datasetSqlSupport;
    private final DatasetMetadataSupport datasetMetadataSupport;
    private final DatasetQueryTableSupport datasetQueryTableSupport;

    public DatasetServiceImpl(JdbcTemplate jdbcTemplate,
                              JsonSnapshotSupport jsonSnapshotSupport,
                              DatasetSqlSupport datasetSqlSupport,
                              DatasetMetadataSupport datasetMetadataSupport,
                              DatasetQueryTableSupport datasetQueryTableSupport) {
        this.jdbcTemplate = jdbcTemplate;
        this.jsonSnapshotSupport = jsonSnapshotSupport;
        this.datasetSqlSupport = datasetSqlSupport;
        this.datasetMetadataSupport = datasetMetadataSupport;
        this.datasetQueryTableSupport = datasetQueryTableSupport;
    }

    @Override
    public List<DatasetVo> listDatasets() {
        return datasetMetadataSupport.listDatasets();
    }

    @Override
    public DatasetVo getDataset(String modelCode) {
        return datasetMetadataSupport.getDataset(modelCode);
    }

    @Override
    @Transactional
    public DatasetVo createDataPool(CreateDataPoolRequest request) {
        String dataPoolCode = datasetSqlSupport.safeIdentifier(request.getDataPoolCode(), "dataPoolCode");
        String dataPoolType = datasetSqlSupport.normalizeDataPoolType(request.getDataPoolType());
        if (datasetMetadataSupport.existsModel(dataPoolCode)
                || ("QUERY_TABLE".equals(dataPoolType) && datasetMetadataSupport.existsTable(dataPoolCode))) {
            throw new IllegalArgumentException("数据池编码或物理表已存在: " + dataPoolCode);
        }

        String dataPoolName = datasetSqlSupport.requireText(request.getDataPoolName(), "dataPoolName");
        String physicalTableName;
        String sourceSql;
        String createTableSql = null;
        boolean deletable;
        Map<String, Object> dataPoolConfig;

        if ("SOURCE_TABLE".equals(dataPoolType)) {
            String sourceTable = datasetSqlSupport.safeIdentifier(request.getSourceTable(), "sourceTable");
            String sourceAlias = datasetSqlSupport.safeIdentifier(
                    datasetSqlSupport.defaultText(request.getSourceAlias(), "t"),
                    "sourceAlias"
            );
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
            sourceSql = datasetSqlSupport.resolveQuerySourceSql(request, physicalTableName);
            DatasetQuerySqlPlan querySqlPlan = datasetSqlSupport.buildQuerySqlPlan(sourceSql);
            createTableSql = datasetSqlSupport.buildCreateTableSql(physicalTableName, querySqlPlan.rewrittenSql());
            jdbcTemplate.execute(createTableSql);
            deletable = true;
            dataPoolConfig = datasetQueryTableSupport.buildQueryTableConfig(
                    physicalTableName,
                    dataPoolName,
                    sourceSql,
                    createTableSql
            );
        }

        try {
            jdbcTemplate.update(
                    """
                    INSERT INTO dataset_model(
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
                        ? datasetMetadataSupport.buildFieldsFromQuerySql(sourceSql)
                        : datasetMetadataSupport.inferFields(
                            physicalTableName,
                            datasetSqlSupport.defaultText(request.getSourceAlias(), "t")
                        ))
                    : datasetMetadataSupport.normalizeRequestedFields(
                        request.getFields(),
                        "SOURCE_TABLE".equals(dataPoolType)
                                ? datasetSqlSupport.defaultText(request.getSourceAlias(), "t")
                                : "dp",
                        "QUERY_TABLE".equals(dataPoolType)
                    );
            datasetMetadataSupport.insertFields(dataPoolCode, fields);
            return datasetMetadataSupport.getDataset(dataPoolCode);
        } catch (RuntimeException ex) {
            if (deletable) {
                jdbcTemplate.execute(
                        "DROP TABLE IF EXISTS " + datasetSqlSupport.safeIdentifier(physicalTableName, "physicalTableName")
                );
            }
            throw ex;
        }
    }

    @Override
    @Transactional
    public DatasetVo updateDataPool(String dataPoolCode, CreateDataPoolRequest request) {
        String safeDataPoolCode = datasetSqlSupport.safeIdentifier(dataPoolCode, "dataPoolCode");
        DatasetVo current = datasetMetadataSupport.getDataset(safeDataPoolCode);
        String nextName = request.getDataPoolName() == null || request.getDataPoolName().isBlank()
                ? current.getDataPoolName()
                : request.getDataPoolName().trim();
        String nextDescription = request.getDescription() == null ? current.getDescription() : request.getDescription();
        String nextSql = current.getSourceSql();
        Map<String, Object> nextConfig = current.getModelConfig() == null
                ? new LinkedHashMap<>()
                : new LinkedHashMap<>(current.getModelConfig());
        boolean fieldsShouldRefresh = request.getFields() != null && !request.getFields().isEmpty();

        if (current.isDeletable() && datasetSqlSupport.hasQueryUpdate(request)) {
            nextSql = datasetSqlSupport.resolveQuerySourceSql(request, current.getTableName());
            if (!nextSql.equals(current.getSourceSql())) {
                datasetQueryTableSupport.rebuildQueryTable(current.getTableName(), nextSql);
                fieldsShouldRefresh = true;
            }
            DatasetQuerySqlPlan querySqlPlan = datasetSqlSupport.buildQuerySqlPlan(nextSql);
            nextConfig = datasetQueryTableSupport.buildQueryTableConfig(
                    current.getTableName(),
                    nextName,
                    nextSql,
                    datasetSqlSupport.buildCreateTableSql(current.getTableName(), querySqlPlan.rewrittenSql())
            );
        }

        jdbcTemplate.update(
                """
                UPDATE dataset_model
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
            jdbcTemplate.update("DELETE FROM dataset_field WHERE model_code = ?", safeDataPoolCode);
            String alias = current.isDeletable()
                    ? "dp"
                    : datasetMetadataSupport.resolveMainTableAlias(current);
            List<CreateDataPoolRequest.DataPoolFieldRequest> fields = request.getFields() == null || request.getFields().isEmpty()
                    ? (current.isDeletable()
                        ? datasetMetadataSupport.buildFieldsFromQuerySql(nextSql)
                        : datasetMetadataSupport.inferFields(current.getTableName(), alias))
                    : datasetMetadataSupport.normalizeRequestedFields(request.getFields(), alias, current.isDeletable());
            datasetMetadataSupport.insertFields(safeDataPoolCode, fields);
        }

        return datasetMetadataSupport.getDataset(safeDataPoolCode);
    }

    @Override
    public List<FieldMetaVo> previewDataPoolFields(CreateDataPoolRequest request) {
        return datasetMetadataSupport.previewDataPoolFields(request);
    }

    @Override
    @Transactional
    public DatasetVo addCalculatedMetric(String dataPoolCode, CreateCalculatedMetricRequest request) {
        String safeDataPoolCode = datasetSqlSupport.safeIdentifier(dataPoolCode, "dataPoolCode");
        FieldMetaVo baseField = datasetMetadataSupport.loadFields(safeDataPoolCode).stream()
                .filter(field -> field.getFieldCode().equals(request.getBaseFieldCode()))
                .findFirst()
                .orElseThrow(() -> new IllegalArgumentException("未知基础字段: " + request.getBaseFieldCode()));
        if (!"number".equalsIgnoreCase(baseField.getDataType())) {
            throw new IllegalArgumentException("计算字段必须基于数值类型字段");
        }

        Integer nextSortNo = jdbcTemplate.queryForObject(
                "SELECT COALESCE(MAX(sort_no), 0) + 1 FROM dataset_field WHERE model_code = ?",
                Integer.class,
                safeDataPoolCode
        );
        String calcType = datasetSqlSupport.normalizeCalcType(request.getCalcType());
        Map<String, Object> calcConfig = request.getCalcConfig() == null ? new LinkedHashMap<>() : request.getCalcConfig();
        if ("rolling_3y_avg".equals(calcType) && !calcConfig.containsKey("windowRows")) {
            calcConfig.put("windowRows", 755);
        }

        jdbcTemplate.update(
                """
                INSERT INTO dataset_field(
                    model_code, field_code, field_name, data_type, field_role, agg_type,
                    source_expr, calc_type, base_field_code, calc_config_json, sort_no
                ) VALUES (?, ?, ?, ?, 'attribute', ?, ?, ?, ?, ?, ?)
                """,
                safeDataPoolCode,
                datasetSqlSupport.safeIdentifier(request.getFieldCode(), "fieldCode"),
                datasetSqlSupport.requireText(request.getFieldName(), "fieldName"),
                baseField.getDataType(),
                null,
                datasetSqlSupport.safeQualifiedIdentifier(baseField.getSourceExpr(), "base sourceExpr"),
                calcType,
                datasetSqlSupport.safeIdentifier(baseField.getFieldCode(), "baseFieldCode"),
                jsonSnapshotSupport.toJson(calcConfig),
                nextSortNo == null ? 100 : nextSortNo
        );
        return datasetMetadataSupport.getDataset(safeDataPoolCode);
    }

    @Override
    @Transactional
    public void deleteDataPool(String dataPoolCode) {
        String safeDataPoolCode = datasetSqlSupport.safeIdentifier(dataPoolCode, "dataPoolCode");
        DatasetVo dataset = datasetMetadataSupport.getDataset(safeDataPoolCode);
        if (!dataset.isDeletable()) {
            throw new IllegalArgumentException("源数据池不能删除: " + dataPoolCode);
        }
        Integer usedCount = jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM dashboard_component WHERE model_code = ?",
                Integer.class,
                safeDataPoolCode
        );
        if (usedCount != null && usedCount > 0) {
            throw new IllegalArgumentException("数据池正在被图表组件使用，不能删除: " + dataPoolCode);
        }
        jdbcTemplate.update("DELETE FROM dataset_field WHERE model_code = ?", safeDataPoolCode);
        jdbcTemplate.update("DELETE FROM dataset_model WHERE model_code = ?", safeDataPoolCode);
        jdbcTemplate.execute(
                "DROP TABLE IF EXISTS " + datasetSqlSupport.safeIdentifier(dataset.getTableName(), "physicalTableName")
        );
    }

    @Override
    public List<SourceTableVo> listSourceTables() {
        return datasetMetadataSupport.listSourceTables();
    }
}
