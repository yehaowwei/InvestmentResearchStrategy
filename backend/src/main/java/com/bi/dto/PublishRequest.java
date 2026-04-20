package com.bi.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

@Data
public class PublishRequest {
    @NotBlank
    private String dashboardCode;
    private String publishNote;
}
