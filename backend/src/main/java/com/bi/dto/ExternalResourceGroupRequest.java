package com.bi.dto;

import lombok.Data;

@Data
public class ExternalResourceGroupRequest {
    private String name;
    private String slug;
    private String parentName;
}
