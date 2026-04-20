package com.bi.vo;

import lombok.Builder;
import lombok.Data;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@Data
@Builder
public class DatasetVo {
    private String dataPoolCode;
    private String dataPoolName;
    private String dataPoolType;
    @Builder.Default
    private Map<String, Object> dataPoolConfig = new LinkedHashMap<>();
    private String datasetCode;
    private String datasetName;
    private String tableName;
    private String sourceSql;
    private String createTableSql;
    private boolean deletable;
    private String modelCode;
    private String modelName;
    private String modelType;
    private String description;
    @Builder.Default
    private Map<String, Object> modelConfig = new LinkedHashMap<>();
    private List<FieldMetaVo> fields;
}
