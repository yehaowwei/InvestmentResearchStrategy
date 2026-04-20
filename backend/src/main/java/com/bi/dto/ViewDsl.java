package com.bi.dto;

import com.fasterxml.jackson.annotation.JsonAlias;
import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.Data;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;

@Data
public class ViewDsl {
    private String title;
    private String subtitle;
    private String chartType = "line";
    private boolean legend = true;
    private boolean tooltip = true;
    private boolean label = false;
    @JsonProperty("xAxisTitle")
    @JsonAlias({"xaxisTitle", "XAxisTitle"})
    private String xAxisTitle;
    @JsonProperty("yAxisTitle")
    @JsonAlias({"yaxisTitle", "YAxisTitle"})
    private String yAxisTitle;
    private boolean smooth = true;
    private boolean stack = false;
    private boolean dualAxis = false;
    private String barWidth = "40%";
    private boolean areaStyle = false;
    private String formatter = "number";
    private String timeFormatter = "yyyy-MM-dd";
    private List<TableColumnDsl> tableColumns = new ArrayList<>();
    private boolean dataZoom = true;
    private Integer zoomStart = 40;
    private Integer zoomEnd = 100;
    private String renderMode = "chart";
    private Map<String, MetricViewConfig> metricView;
}
