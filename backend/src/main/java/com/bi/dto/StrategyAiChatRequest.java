package com.bi.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

import java.util.ArrayList;
import java.util.List;

@Data
public class StrategyAiChatRequest {
    @NotBlank
    private String strategyName;

    @NotBlank
    private String prompt;

    private List<StrategyAiChartContextDto> charts = new ArrayList<>();
}
