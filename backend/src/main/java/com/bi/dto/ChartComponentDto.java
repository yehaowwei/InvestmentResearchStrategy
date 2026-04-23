package com.bi.dto;

import lombok.Data;

import java.util.LinkedHashMap;
import java.util.Map;

@Data
public class ChartComponentDto {
    private String componentCode;
    private String componentType;
    private String templateCode;
    private String modelCode;
    private String title;
    private Map<String, Object> dslConfig = new LinkedHashMap<>();
}
