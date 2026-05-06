package com.bi.service;

import com.bi.dto.ExternalResourceGroupDto;
import com.bi.dto.ExternalResourceGroupRequest;
import com.bi.dto.ExternalResourceRequest;
import java.util.List;
import org.springframework.web.multipart.MultipartFile;

public interface ExternalResourceService {
    List<ExternalResourceGroupDto> listGroups();

    ExternalResourceGroupDto getGroupBySlug(String slug);

    ExternalResourceGroupDto createGroup(ExternalResourceGroupRequest request);

    ExternalResourceGroupDto uploadFiles(
        String groupId,
        MultipartFile[] files,
        String resourceName,
        String sectionName,
        String thirdLevelName
    );

    ExternalResourceGroupDto createLinkResource(String groupId, ExternalResourceRequest request);

    ExternalResourceGroupDto reorderFiles(String groupId, List<String> fileIds);

    void deleteFile(String groupId, String fileId);

    void deleteGroup(String groupId);
}
