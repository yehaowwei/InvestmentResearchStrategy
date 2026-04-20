package com.bi.dto;

import lombok.Data;

@Data
public class MetricViewConfig {
    private String displayName;
    private String color;
    private String axis = "left";
    private String formatter = "number";
    private boolean visible = true;
}
