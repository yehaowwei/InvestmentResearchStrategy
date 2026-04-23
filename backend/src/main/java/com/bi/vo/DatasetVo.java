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
    private String tableName;
    private String sourceSql;
    private String createTableSql;
    private boolean deletable;
    private String modelCode;
    private String description;
    @Builder.Default
    private Map<String, Object> modelConfig = new LinkedHashMap<>();
    private List<FieldMetaVo> fields;
}
