package com.bi.dto;

import java.util.ArrayList;
import java.util.List;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class ExternalResourceGroupDto {
    private String groupId;
    private String name;
    private String slug;
    private String description;
    private String parentName;
    private int order;
    private String createdAt;
    private String updatedAt;
    private List<ExternalResourceFileDto> files = new ArrayList<>();
}
