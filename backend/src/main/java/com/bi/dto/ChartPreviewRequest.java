package com.bi.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import lombok.Data;

import java.util.LinkedHashMap;
import java.util.Map;

@Data
public class ChartPreviewRequest {
    @NotBlank
    private String modelCode;
    @Valid
    private QueryDsl queryDsl;
    private ViewDsl viewDsl;
    private Map<String, Object> dslConfig = new LinkedHashMap<>();
}
