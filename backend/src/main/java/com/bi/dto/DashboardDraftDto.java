package com.bi.dto;

import lombok.Data;

import java.util.ArrayList;
import java.util.List;

@Data
public class DashboardDraftDto {
    private String dashboardCode;
    private String name;
    private String status;
    private Integer publishedVersion;
    private String createdAt;
    private String updatedAt;
    private List<ChartComponentDto> components = new ArrayList<>();
}
