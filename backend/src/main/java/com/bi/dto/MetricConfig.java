package com.bi.dto;

import lombok.Data;

@Data
public class MetricConfig {
    private String datasetCode;
    private String fieldCode;
    private String displayName;
    private String agg = "sum";
    private String aggType = "sum";
    private String seriesType = "line";
    private String chartType = "line";
    private String color;
    private String axis = "left";
    private String yAxis = "left";
    private String formatter = "percent_2";
    private boolean smooth = false;
    private boolean stack = false;
    private boolean visible = true;
}
