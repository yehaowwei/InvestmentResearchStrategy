package com.bi.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

import java.util.ArrayList;
import java.util.List;

@Data
public class QueryDsl {
    @NotBlank
    private String modelCode;
    private List<String> dimensionFields = new ArrayList<>();
    private List<String> seriesFields = new ArrayList<>();
    private List<MetricConfig> metrics = new ArrayList<>();
    private List<FilterCondition> filters = new ArrayList<>();
    private List<SortCondition> orders = new ArrayList<>();
    private Integer limit = 500;

    public List<String> resolveDimensionFields() {
        if (dimensionFields != null && !dimensionFields.isEmpty()) {
            return dimensionFields;
        }
        return new ArrayList<>();
    }
}
