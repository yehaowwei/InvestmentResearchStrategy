package com.bi.controller;

import com.bi.common.ApiResponse;
import com.bi.dto.ExternalResourceDirectoryDto;
import com.bi.dto.ExternalResourceGroupDto;
import com.bi.dto.ExternalResourceOrderRequest;
import com.bi.dto.ExternalResourceGroupRequest;
import com.bi.dto.ExternalResourceRequest;
import com.bi.dto.ExternalResourceThirdLevelRequest;
import com.bi.service.ExternalResourceService;
import java.util.List;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RequestPart;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

@RestController
@RequestMapping("/api/external-resource")
public class ExternalResourceController {
    private final ExternalResourceService externalResourceService;

    public ExternalResourceController(ExternalResourceService externalResourceService) {
        this.externalResourceService = externalResourceService;
    }

    @GetMapping("/group")
    public ApiResponse<List<ExternalResourceGroupDto>> listGroups() {
        return ApiResponse.ok(externalResourceService.listGroups());
    }

    @GetMapping("/directories")
    public ApiResponse<List<ExternalResourceDirectoryDto>> listResourceDirectories() {
        return ApiResponse.ok(externalResourceService.listResourceDirectories());
    }

    @GetMapping("/group/slug/{slug}")
    public ApiResponse<ExternalResourceGroupDto> getGroupBySlug(@PathVariable("slug") String slug) {
        return ApiResponse.ok(externalResourceService.getGroupBySlug(slug));
    }

    @PostMapping("/group")
    public ApiResponse<ExternalResourceGroupDto> createGroup(@org.springframework.web.bind.annotation.RequestBody ExternalResourceGroupRequest request) {
        return ApiResponse.ok(externalResourceService.createGroup(request));
    }

    @PutMapping("/group/{groupId}")
    public ApiResponse<ExternalResourceGroupDto> updateGroup(@PathVariable("groupId") String groupId,
                                                             @RequestBody ExternalResourceGroupRequest request) {
        return ApiResponse.ok(externalResourceService.updateGroup(groupId, request));
    }

    @PostMapping("/group/{groupId}/third-level")
    public ApiResponse<ExternalResourceGroupDto> createThirdLevelDirectory(@PathVariable("groupId") String groupId,
                                                                           @RequestBody ExternalResourceThirdLevelRequest request) {
        return ApiResponse.ok(externalResourceService.createThirdLevelDirectory(groupId, request.getName()));
    }

    @PostMapping(value = "/group/{groupId}/files", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ApiResponse<ExternalResourceGroupDto> uploadFiles(@PathVariable("groupId") String groupId,
                                                             @RequestParam(value = "resourceName", required = false) String resourceName,
                                                             @RequestParam(value = "sectionName", required = false) String sectionName,
                                                             @RequestParam(value = "thirdLevelName", required = false) String thirdLevelName,
                                                             @RequestPart("files") MultipartFile[] files) {
        return ApiResponse.ok(externalResourceService.uploadFiles(groupId, files, resourceName, sectionName, thirdLevelName));
    }

    @PostMapping("/group/{groupId}/resources")
    public ApiResponse<ExternalResourceGroupDto> createLinkResource(@PathVariable("groupId") String groupId,
                                                                    @RequestBody ExternalResourceRequest request) {
        return ApiResponse.ok(externalResourceService.createLinkResource(groupId, request));
    }

    @PutMapping("/group/{groupId}/resources/{fileId}")
    public ApiResponse<ExternalResourceGroupDto> updateResource(@PathVariable("groupId") String groupId,
                                                                @PathVariable("fileId") String fileId,
                                                                @RequestBody ExternalResourceRequest request) {
        return ApiResponse.ok(externalResourceService.updateResource(groupId, fileId, request));
    }

    @PutMapping("/group/{groupId}/file-order")
    public ApiResponse<ExternalResourceGroupDto> reorderFiles(@PathVariable("groupId") String groupId,
                                                              @RequestBody ExternalResourceOrderRequest request) {
        return ApiResponse.ok(externalResourceService.reorderFiles(groupId, request.getFileIds()));
    }

    @DeleteMapping("/group/{groupId}/files/{fileId}")
    public ApiResponse<Boolean> deleteFile(@PathVariable("groupId") String groupId,
                                           @PathVariable("fileId") String fileId) {
        externalResourceService.deleteFile(groupId, fileId);
        return ApiResponse.ok(true);
    }

    @DeleteMapping("/group/{groupId}")
    public ApiResponse<Boolean> deleteGroup(@PathVariable("groupId") String groupId) {
        externalResourceService.deleteGroup(groupId);
        return ApiResponse.ok(true);
    }
}
