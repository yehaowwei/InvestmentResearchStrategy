package com.bi.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class ExternalResourceFileDto {
    private String fileId;
    private String title;
    private String fileName;
    private String href;
    private String resourceType;
    private String sectionName;
    private String thirdLevelName;
    private long size;
    private String updatedAt;
}
