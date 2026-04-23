package com.bi.dto;

import lombok.Data;

@Data
public class MetricConfig {
    private String fieldCode;
    private String displayName;
    private String aggType = "sum";
    private String chartType = "line";
    private String color;
    private String yAxis = "left";
    private boolean smooth = false;
}
