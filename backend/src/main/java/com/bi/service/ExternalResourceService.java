package com.bi.service;

import com.bi.dto.ExternalResourceGroupDto;
import com.bi.dto.ExternalResourceGroupRequest;
import com.bi.dto.ExternalResourceRequest;
import com.bi.dto.ExternalResourceDirectoryDto;
import java.util.List;
import org.springframework.web.multipart.MultipartFile;

public interface ExternalResourceService {
    List<ExternalResourceGroupDto> listGroups();

    List<ExternalResourceDirectoryDto> listResourceDirectories();

    ExternalResourceGroupDto getGroupBySlug(String slug);

    ExternalResourceGroupDto createGroup(ExternalResourceGroupRequest request);

    ExternalResourceGroupDto updateGroup(String groupId, ExternalResourceGroupRequest request);

    ExternalResourceGroupDto createThirdLevelDirectory(String groupId, String name);

    ExternalResourceGroupDto uploadFiles(
        String groupId,
        MultipartFile[] files,
        String resourceName,
        String sectionName,
        String thirdLevelName
    );

    ExternalResourceGroupDto createLinkResource(String groupId, ExternalResourceRequest request);

    ExternalResourceGroupDto updateResource(String groupId, String fileId, ExternalResourceRequest request);

    ExternalResourceGroupDto reorderFiles(String groupId, List<String> fileIds);

    void deleteFile(String groupId, String fileId);

    void deleteGroup(String groupId);
}
