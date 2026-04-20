package com.bi.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

import java.util.LinkedHashMap;
import java.util.Map;

@Data
public class CreateCalculatedMetricRequest {
    @NotBlank
    private String fieldCode;
    @NotBlank
    private String fieldName;
    @NotBlank
    private String baseFieldCode;
    private String calcType = "avg";
    private String aggType = "avg";
    private Map<String, Object> calcConfig = new LinkedHashMap<>();
}
