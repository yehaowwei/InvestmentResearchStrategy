package com.bi.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

@Data
public class TkfChartCandidateDto {
    @NotBlank
    private String chartId;
    @NotBlank
    private String chartCode;
    @NotBlank
    private String chartName;
    @NotBlank
    private String componentCode;
    @NotBlank
    private String componentTitle;
    private String category;
    private String indicatorTag;
    private String recentSummary;
}
