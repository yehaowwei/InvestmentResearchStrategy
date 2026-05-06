package com.bi.service;

import com.bi.dto.ExternalResourceGroupDto;
import com.bi.dto.ExternalResourceGroupRequest;
import java.util.List;
import org.springframework.web.multipart.MultipartFile;

public interface ExternalResourceService {
    List<ExternalResourceGroupDto> listGroups();

    ExternalResourceGroupDto getGroupBySlug(String slug);

    ExternalResourceGroupDto createGroup(ExternalResourceGroupRequest request);

    ExternalResourceGroupDto uploadFiles(String groupId, MultipartFile[] files);

    ExternalResourceGroupDto reorderFiles(String groupId, List<String> fileIds);

    void deleteFile(String groupId, String fileId);

    void deleteGroup(String groupId);
}
