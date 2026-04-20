package com.bi.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@Data
public class CreateDataPoolRequest {
    @NotBlank
    private String dataPoolCode;
    @NotBlank
    private String dataPoolName;
    private String dataPoolType = "SOURCE_TABLE";
    private String description;
    private String sourceTable;
    private String sourceAlias = "t";
    private String sqlText;
    private String createTableSql;
    private Map<String, Object> dataPoolConfig = new LinkedHashMap<>();
    private List<DataPoolFieldRequest> fields = new ArrayList<>();

    @Data
    public static class DataPoolFieldRequest {
        @NotBlank
        private String fieldCode;
        @NotBlank
        private String fieldName;
        private String dataType = "number";
        private String fieldRole = "attribute";
        private String aggType;
        @NotBlank
        private String sourceExpr;
    }
}
