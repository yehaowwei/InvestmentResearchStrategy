package com.bi.dto;

import lombok.Data;

@Data
public class ExternalResourceRequest {
    private String title;
    private String href;
    private String resourceType;
    private String sectionName;
    private String thirdLevelName;
}
