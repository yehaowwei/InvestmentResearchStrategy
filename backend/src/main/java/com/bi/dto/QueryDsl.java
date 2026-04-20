package com.bi.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

import java.util.ArrayList;
import java.util.List;

@Data
public class QueryDsl {
    @NotBlank
    private String modelCode;
    private String datasetCode;
    private String dimensionField;
    private List<String> dimensionFields = new ArrayList<>();
    private String dimensionDatasetCode;
    private List<String> datasetCodes = new ArrayList<>();
    private List<String> series = new ArrayList<>();
    private List<String> seriesFields = new ArrayList<>();
    private List<MetricConfig> metrics = new ArrayList<>();
    private List<FilterCondition> filters = new ArrayList<>();
    private List<SortCondition> orders = new ArrayList<>();
    private Integer limit = 500;

    public String getDimension() {
        return getPrimaryDimensionField();
    }

    public void setDimension(String dimension) {
        setDimensionField(dimension);
    }

    public String getXAxis() {
        return getPrimaryDimensionField();
    }

    public void setXAxis(String xAxis) {
        setDimensionField(xAxis);
    }

    public String getPrimaryDimensionField() {
        if (dimensionFields != null && !dimensionFields.isEmpty()) {
            return dimensionFields.get(0);
        }
        return dimensionField;
    }

    public List<String> resolveDimensionFields() {
        if (dimensionFields != null && !dimensionFields.isEmpty()) {
            return dimensionFields;
        }
        if (dimensionField == null || dimensionField.isBlank()) {
            return new ArrayList<>();
        }
        return new ArrayList<>(List.of(dimensionField));
    }

    public void setDimensionField(String dimensionField) {
        this.dimensionField = dimensionField;
        if ((this.dimensionFields == null || this.dimensionFields.isEmpty()) && dimensionField != null && !dimensionField.isBlank()) {
            this.dimensionFields = new ArrayList<>(List.of(dimensionField));
        }
    }
}
