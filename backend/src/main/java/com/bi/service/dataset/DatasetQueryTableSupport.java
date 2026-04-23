package com.bi.service.dataset;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@Component
public class DatasetQueryTableSupport {
    private final JdbcTemplate jdbcTemplate;
    private final DatasetSqlSupport datasetSqlSupport;
    private final DatasetMetadataSupport datasetMetadataSupport;

    public DatasetQueryTableSupport(JdbcTemplate jdbcTemplate,
                                    DatasetSqlSupport datasetSqlSupport,
                                    DatasetMetadataSupport datasetMetadataSupport) {
        this.jdbcTemplate = jdbcTemplate;
        this.datasetSqlSupport = datasetSqlSupport;
        this.datasetMetadataSupport = datasetMetadataSupport;
    }

    public void rebuildQueryTable(String tableName, String sqlText) {
        String safeTableName = datasetSqlSupport.safeIdentifier(tableName, "physicalTableName");
        String tempTableName = datasetSqlSupport.safeIdentifier(tableName + "_tmp", "tempPhysicalTableName");
        try {
            jdbcTemplate.execute("DROP TABLE IF EXISTS " + tempTableName);
            jdbcTemplate.execute(
                    datasetSqlSupport.buildCreateTableSql(
                            tempTableName,
                            datasetSqlSupport.buildQuerySqlPlan(sqlText).rewrittenSql()
                    )
            );
            jdbcTemplate.execute("DROP TABLE " + safeTableName);
            jdbcTemplate.execute("RENAME TABLE " + tempTableName + " TO " + safeTableName);
        } catch (RuntimeException ex) {
            jdbcTemplate.execute("DROP TABLE IF EXISTS " + tempTableName);
            throw ex;
        }
    }

    public Map<String, Object> buildQueryTableConfig(String tableName,
                                                     String tableNameCn,
                                                     String sourceSql,
                                                     String createTableSql) {
        Map<String, String> aliasToTable = datasetSqlSupport.parseTableAliasMap(sourceSql);
        List<Map<String, Object>> joinTables = aliasToTable.entrySet().stream()
                .filter(entry -> !entry.getKey().equals(entry.getValue()))
                .map(entry -> Map.<String, Object>of(
                        "table", entry.getValue(),
                        "alias", entry.getKey(),
                        "tableNameCn", datasetMetadataSupport.loadConfiguredTableName(entry.getValue())
                ))
                .toList();
        return new LinkedHashMap<>(Map.of(
                "mainTable", Map.of("table", tableName, "alias", "dp", "tableNameCn", tableNameCn),
                "joinTables", joinTables,
                "sourceKind", "QUERY_TABLE",
                "createTableSql", createTableSql
        ));
    }
}
