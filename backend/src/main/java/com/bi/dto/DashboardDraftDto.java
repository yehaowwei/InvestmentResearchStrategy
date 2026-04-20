package com.bi.dto;

import lombok.Data;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@Data
public class DashboardDraftDto {
    private String dashboardCode;
    private String name;
    private String status;
    private Integer publishedVersion;
    private List<ChartComponentDto> components = new ArrayList<>();
    private List<FilterCondition> pageFilters = new ArrayList<>();
    private Map<String, Object> meta = new LinkedHashMap<>();
}
