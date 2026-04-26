package com.bi.dto;

import jakarta.validation.constraints.NotEmpty;
import lombok.Data;

import java.util.ArrayList;
import java.util.List;

@Data
public class TkfAgentRequest {
    @NotEmpty
    private List<TkfAgentMessageDto> messages = new ArrayList<>();
    @NotEmpty
    private List<TkfChartCandidateDto> availableCharts = new ArrayList<>();
}
