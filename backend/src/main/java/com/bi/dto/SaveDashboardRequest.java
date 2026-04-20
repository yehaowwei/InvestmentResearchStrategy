package com.bi.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

@Data
public class SaveDashboardRequest {
    @NotBlank
    private String dashboardCode;
    @NotNull
    @Valid
    private DashboardDraftDto draft;
}
