package com.bi.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

@Data
public class TkfAgentMessageDto {
    @NotBlank
    private String role;
    @NotBlank
    private String content;
}
