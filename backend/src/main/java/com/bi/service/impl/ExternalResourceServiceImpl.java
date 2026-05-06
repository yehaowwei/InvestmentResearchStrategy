package com.bi.service.impl;

import com.bi.common.JsonSnapshotSupport;
import com.bi.dto.ExternalResourceFileDto;
import com.bi.dto.ExternalResourceGroupDto;
import com.bi.dto.ExternalResourceGroupRequest;
import com.bi.dto.ExternalResourceRequest;
import com.bi.service.ExternalResourceService;
import com.bi.service.SharedStateService;
import java.io.IOException;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.nio.file.StandardCopyOption;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Comparator;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Objects;
import java.util.Set;
import java.util.UUID;
import java.util.regex.Pattern;
import java.util.stream.Collectors;
import lombok.Data;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

@Service
public class ExternalResourceServiceImpl implements ExternalResourceService {
    private static final String STATE_KEY = "strategy-dashboard-external-resource-groups";
    private static final Pattern HTML_FILE_PATTERN = Pattern.compile("(?i)^.+\\.(html|htm)$");
    private static final Pattern SLUG_SANITIZE_PATTERN = Pattern.compile("[^a-z0-9_-]+");

    private final SharedStateService sharedStateService;
    private final JsonSnapshotSupport jsonSnapshotSupport;
    private final Path resourceRoot;

    public ExternalResourceServiceImpl(SharedStateService sharedStateService, JsonSnapshotSupport jsonSnapshotSupport) {
        this.sharedStateService = sharedStateService;
        this.jsonSnapshotSupport = jsonSnapshotSupport;
        this.resourceRoot = resolveResourceRoot();
        ensureResourceRoot();
        seedDefaultConvertibleBoard();
    }

    @Override
    public List<ExternalResourceGroupDto> listGroups() {
        return readGroups().stream()
            .sorted(Comparator.comparingInt(ExternalResourceGroupState::getOrder))
            .map(this::toDto)
            .collect(Collectors.toCollection(ArrayList::new));
    }

    @Override
    public ExternalResourceGroupDto getGroupBySlug(String slug) {
        ExternalResourceGroupState group = readGroups().stream()
            .filter(item -> item.getSlug().equals(slug))
            .findFirst()
            .orElseThrow(() -> new IllegalArgumentException("External resource group not found"));
        return toDto(group);
    }

    @Override
    public ExternalResourceGroupDto createGroup(ExternalResourceGroupRequest request) {
        String name = normalizeRequiredText(request.getName(), "Group name is required");
        String slug = normalizeSlug(request.getSlug(), name);
        List<ExternalResourceGroupState> groups = readGroups();
        if (groups.stream().anyMatch(item -> item.getSlug().equals(slug))) {
            throw new IllegalArgumentException("External resource slug already exists");
        }
        String now = now();
        ExternalResourceGroupState created = new ExternalResourceGroupState();
        created.setGroupId("external-resource-" + UUID.randomUUID());
        created.setName(name);
        created.setSlug(slug);
        created.setDescription(normalizeOptionalText(request.getDescription()));
        created.setParentName(resolveParentName(request.getParentName()));
        created.setOrder(groups.size() + 1);
        created.setCreatedAt(now);
        created.setUpdatedAt(now);
        groups.add(created);
        saveGroups(groups);
        createDirectory(groupDirectory(created));
        return toDto(created);
    }

    @Override
    public ExternalResourceGroupDto uploadFiles(
        String groupId,
        MultipartFile[] files,
        String resourceName,
        String sectionName,
        String thirdLevelName
    ) {
        if (files == null || files.length == 0) {
            throw new IllegalArgumentException("Please select at least one HTML file");
        }
        List<ExternalResourceGroupState> groups = readGroups();
        ExternalResourceGroupState group = findGroup(groups, groupId);
        Path directory = groupDirectory(group);
        createDirectory(directory);

        List<String> uploadedFileNames = Arrays.stream(files)
            .filter(Objects::nonNull)
            .map(file -> saveHtmlFile(directory, file))
            .collect(Collectors.toCollection(ArrayList::new));

        if (group.getFileOrder() == null) {
            group.setFileOrder(new ArrayList<>());
        }
        if (group.getResources() == null) {
            group.setResources(new ArrayList<>());
        }
        uploadedFileNames.forEach(fileName -> {
            group.getFileOrder().remove(fileName);
            group.getFileOrder().add(fileName);
            ExternalResourceState resource = findResourceByFileName(group, fileName);
            if (resource == null) {
                resource = new ExternalResourceState();
                resource.setResourceId(fileName);
                resource.setFileName(fileName);
                resource.setResourceType("HTML");
                group.getResources().add(resource);
            }
            if (uploadedFileNames.size() == 1) {
                String normalizedTitle = normalizeOptionalText(resourceName);
                resource.setTitle(normalizedTitle.isEmpty() ? stripHtmlExtension(fileName) : normalizedTitle);
                resource.setSectionName(normalizeOptionalText(sectionName));
                resource.setThirdLevelName(normalizeOptionalText(thirdLevelName));
            } else if (normalizeOptionalText(resource.getTitle()).isEmpty()) {
                resource.setTitle(stripHtmlExtension(fileName));
            }
            resource.setUpdatedAt(now());
        });

        group.setUpdatedAt(now());
        saveGroups(groups);
        return toDto(group);
    }

    @Override
    public ExternalResourceGroupDto createLinkResource(String groupId, ExternalResourceRequest request) {
        List<ExternalResourceGroupState> groups = readGroups();
        ExternalResourceGroupState group = findGroup(groups, groupId);
        String title = normalizeRequiredText(request.getTitle(), "Resource name is required");
        String href = normalizeRequiredText(request.getHref(), "Resource link is required");
        if (!href.startsWith("http://") && !href.startsWith("https://")) {
            throw new IllegalArgumentException("Resource link must start with http:// or https://");
        }
        if (group.getResources() == null) {
            group.setResources(new ArrayList<>());
        }
        if (group.getFileOrder() == null) {
            group.setFileOrder(new ArrayList<>());
        }
        String now = now();
        ExternalResourceState resource = new ExternalResourceState();
        resource.setResourceId("link-" + UUID.randomUUID());
        resource.setTitle(title);
        resource.setHref(href);
        resource.setResourceType("LINK");
        resource.setSectionName(normalizeOptionalText(request.getSectionName()));
        resource.setThirdLevelName(normalizeOptionalText(request.getThirdLevelName()));
        resource.setUpdatedAt(now);
        group.getResources().add(resource);
        group.getFileOrder().add(resource.getResourceId());
        group.setUpdatedAt(now);
        saveGroups(groups);
        return toDto(group);
    }

    @Override
    public ExternalResourceGroupDto reorderFiles(String groupId, List<String> fileIds) {
        List<ExternalResourceGroupState> groups = readGroups();
        ExternalResourceGroupState group = findGroup(groups, groupId);
        List<ExternalResourceFileDto> files = listFiles(group);
        Set<String> existingOrderKeys = files.stream()
            .map(this::toOrderKey)
            .collect(Collectors.toCollection(HashSet::new));

        List<String> orderKeys = (fileIds == null ? List.<String>of() : fileIds).stream()
            .map(fileId -> files.stream()
                .filter(file -> file.getFileId().equals(fileId))
                .findFirst()
                .map(this::toOrderKey)
                .orElse(decodeFileId(fileId)))
            .collect(Collectors.toCollection(ArrayList::new));
        Set<String> providedOrderKeys = new HashSet<>(orderKeys);

        if (!providedOrderKeys.equals(existingOrderKeys) || orderKeys.size() != existingOrderKeys.size()) {
            throw new IllegalArgumentException("Invalid file order payload");
        }

        group.setFileOrder(orderKeys);
        group.setUpdatedAt(now());
        saveGroups(groups);
        return toDto(group);
    }

    @Override
    public void deleteFile(String groupId, String fileId) {
        List<ExternalResourceGroupState> groups = readGroups();
        ExternalResourceGroupState group = findGroup(groups, groupId);
        String fileName = decodeFileId(fileId);
        ExternalResourceState linkResource = findResourceById(group, fileId);
        if (linkResource != null && "LINK".equalsIgnoreCase(linkResource.getResourceType())) {
            group.getResources().remove(linkResource);
        } else {
            Path filePath = groupDirectory(group).resolve(fileName).normalize();
            ensureInsideGroup(groupDirectory(group), filePath);
            try {
                Files.deleteIfExists(filePath);
            } catch (IOException exception) {
                throw new IllegalStateException("Failed to delete external resource file", exception);
            }
            ExternalResourceState fileResource = findResourceByFileName(group, fileName);
            if (fileResource != null) {
                group.getResources().remove(fileResource);
            }
        }
        if (group.getFileOrder() != null) {
            group.getFileOrder().remove(fileName);
            group.getFileOrder().remove(fileId);
        }
        group.setUpdatedAt(now());
        saveGroups(groups);
    }

    @Override
    public void deleteGroup(String groupId) {
        List<ExternalResourceGroupState> groups = readGroups();
        ExternalResourceGroupState group = findGroup(groups, groupId);
        deleteDirectory(groupDirectory(group));
        List<ExternalResourceGroupState> nextGroups = groups.stream()
            .filter(item -> !item.getGroupId().equals(groupId))
            .collect(Collectors.toCollection(ArrayList::new));
        for (int index = 0; index < nextGroups.size(); index++) {
            nextGroups.get(index).setOrder(index + 1);
        }
        saveGroups(nextGroups);
    }

    private ExternalResourceGroupDto toDto(ExternalResourceGroupState state) {
        return new ExternalResourceGroupDto(
            state.getGroupId(),
            state.getName(),
            state.getSlug(),
            state.getDescription(),
            resolveParentName(state.getParentName()),
            state.getOrder(),
            state.getCreatedAt(),
            state.getUpdatedAt(),
            listFiles(state)
        );
    }

    private List<ExternalResourceFileDto> listFiles(ExternalResourceGroupState group) {
        Path directory = groupDirectory(group);
        List<ExternalResourceFileDto> fileResources = new ArrayList<>();
        try {
            if (Files.exists(directory)) {
                try (var stream = Files.list(directory)) {
                fileResources = stream
                    .filter(Files::isRegularFile)
                    .filter(path -> HTML_FILE_PATTERN.matcher(path.getFileName().toString()).matches())
                    .sorted((pathA, pathB) -> {
                        String fileA = pathA.getFileName().toString();
                        String fileB = pathB.getFileName().toString();
                        int orderA = resolveOrderIndex(group.getFileOrder(), fileA);
                        int orderB = resolveOrderIndex(group.getFileOrder(), fileB);
                        if (orderA != orderB) {
                            return Integer.compare(orderA, orderB);
                        }
                        return fileA.compareTo(fileB);
                    })
                    .map(path -> toFileDto(group, path))
                    .collect(Collectors.toCollection(ArrayList::new));
                }
            }
            List<ExternalResourceFileDto> linkResources = safeResources(group).stream()
                .filter(resource -> "LINK".equalsIgnoreCase(resource.getResourceType()))
                .map(this::toLinkDto)
                .collect(Collectors.toCollection(ArrayList::new));
            fileResources.addAll(linkResources);
            fileResources.sort((fileA, fileB) -> {
                int orderA = resolveOrderIndex(group.getFileOrder(), toOrderKey(fileA));
                int orderB = resolveOrderIndex(group.getFileOrder(), toOrderKey(fileB));
                if (orderA != orderB) {
                    return Integer.compare(orderA, orderB);
                }
                return fileA.getTitle().compareTo(fileB.getTitle());
            });
            return fileResources;
        } catch (IOException exception) {
            throw new IllegalStateException("Failed to read external resource files", exception);
        }
    }

    private ExternalResourceFileDto toFileDto(ExternalResourceGroupState group, Path path) {
        try {
            String fileName = path.getFileName().toString();
            String encodedFileName = URLEncoder.encode(fileName, StandardCharsets.UTF_8).replace("+", "%20");
            ExternalResourceState resource = findResourceByFileName(group, fileName);
            return new ExternalResourceFileDto(
                encodedFileName,
                resolveResourceTitle(resource, stripHtmlExtension(fileName)),
                fileName,
                "/external-resources/" + group.getSlug() + "/" + encodedFileName,
                "HTML",
                resource == null ? "" : normalizeOptionalText(resource.getSectionName()),
                resource == null ? inferDefaultThirdLevel(stripHtmlExtension(fileName)) : normalizeOptionalText(resource.getThirdLevelName()),
                Files.size(path),
                resolveUpdatedAt(resource, Files.getLastModifiedTime(path).toInstant().atOffset(ZoneOffset.UTC).format(DateTimeFormatter.ISO_OFFSET_DATE_TIME))
            );
        } catch (IOException exception) {
            throw new IllegalStateException("Failed to describe external resource file", exception);
        }
    }

    private List<ExternalResourceGroupState> readGroups() {
        Object raw = sharedStateService.getState(STATE_KEY);
        if (raw == null) {
            return new ArrayList<>();
        }
        ExternalResourceGroupState[] groups = jsonSnapshotSupport.convert(raw, ExternalResourceGroupState[].class);
        return groups == null ? new ArrayList<>() : Arrays.stream(groups)
            .filter(Objects::nonNull)
            .sorted(Comparator.comparingInt(ExternalResourceGroupState::getOrder))
            .collect(Collectors.toCollection(ArrayList::new));
    }

    private void saveGroups(List<ExternalResourceGroupState> groups) {
        sharedStateService.saveState(STATE_KEY, groups);
    }

    private ExternalResourceGroupState findGroup(List<ExternalResourceGroupState> groups, String groupId) {
        return groups.stream()
            .filter(item -> item.getGroupId().equals(groupId))
            .findFirst()
            .orElseThrow(() -> new IllegalArgumentException("External resource group not found"));
    }

    private String saveHtmlFile(Path directory, MultipartFile file) {
        String originalFileName = normalizeRequiredText(file.getOriginalFilename(), "HTML file name is required");
        if (!HTML_FILE_PATTERN.matcher(originalFileName).matches()) {
            throw new IllegalArgumentException("Only .html or .htm files are supported");
        }
        Path targetFile = directory.resolve(originalFileName).normalize();
        ensureInsideGroup(directory, targetFile);
        try {
            Files.copy(file.getInputStream(), targetFile, StandardCopyOption.REPLACE_EXISTING);
        } catch (IOException exception) {
            throw new IllegalStateException("Failed to save external resource file", exception);
        }
        return originalFileName;
    }

    private void ensureInsideGroup(Path directory, Path filePath) {
        if (!filePath.startsWith(directory)) {
            throw new IllegalArgumentException("Invalid file path");
        }
    }

    private Path groupDirectory(ExternalResourceGroupState group) {
        return resourceRoot.resolve(group.getSlug()).normalize();
    }

    private void deleteDirectory(Path directory) {
        if (!Files.exists(directory)) {
            return;
        }
        try (var walk = Files.walk(directory)) {
            walk.sorted(Comparator.reverseOrder()).forEach(path -> {
                try {
                    Files.deleteIfExists(path);
                } catch (IOException exception) {
                    throw new IllegalStateException("Failed to delete external resource group", exception);
                }
            });
        } catch (IOException exception) {
            throw new IllegalStateException("Failed to delete external resource group", exception);
        }
    }

    private void ensureResourceRoot() {
        createDirectory(resourceRoot);
    }

    private void createDirectory(Path directory) {
        try {
            Files.createDirectories(directory);
        } catch (IOException exception) {
            throw new IllegalStateException("Failed to create external resource directory", exception);
        }
    }

    private Path resolveResourceRoot() {
        return Paths.get(System.getProperty("user.dir"))
            .resolve("..")
            .resolve(".runtime")
            .resolve("external-resources")
            .normalize();
    }

    private void seedDefaultConvertibleBoard() {
        List<ExternalResourceGroupState> groups = readGroups();
        ExternalResourceGroupState existingConvertibleBoard = groups.stream()
            .filter(item -> item.getSlug().equals("convertible-board"))
            .findFirst()
            .orElse(null);
        boolean hasConvertibleBoard = existingConvertibleBoard != null;
        if (!hasConvertibleBoard) {
            ExternalResourceGroupState group = new ExternalResourceGroupState();
            String now = now();
            group.setGroupId("external-resource-convertible-board");
            group.setName("转债研究");
            group.setSlug("convertible-board");
            group.setDescription("转债研究友情链接");
            group.setParentName("友情链接");
            group.setOrder(groups.size() + 1);
            group.setCreatedAt(now);
            group.setUpdatedAt(now);
            groups.add(group);
            saveGroups(groups);
        } else if (
            !"转债研究".equals(existingConvertibleBoard.getName())
                || !"转债研究友情链接".equals(existingConvertibleBoard.getDescription())
                || !"友情链接".equals(existingConvertibleBoard.getParentName())
        ) {
            existingConvertibleBoard.setName("转债研究");
            existingConvertibleBoard.setDescription("转债研究友情链接");
            existingConvertibleBoard.setParentName("友情链接");
            existingConvertibleBoard.setUpdatedAt(now());
            saveGroups(groups);
        }

        Path sourceDirectory = Paths.get(System.getProperty("user.dir"))
            .resolve("..")
            .resolve("frontend")
            .resolve("public")
            .resolve("convertible-board")
            .resolve("pages")
            .normalize();
        Path targetDirectory = resourceRoot.resolve("convertible-board").normalize();
        createDirectory(targetDirectory);

        if (!Files.exists(sourceDirectory)) {
            return;
        }
        try (var stream = Files.list(sourceDirectory)) {
            stream
                .filter(Files::isRegularFile)
                .filter(path -> HTML_FILE_PATTERN.matcher(path.getFileName().toString()).matches())
                .forEach(path -> {
                    Path targetFile = targetDirectory.resolve(path.getFileName().toString()).normalize();
                    if (Files.exists(targetFile)) {
                        return;
                    }
                    try {
                        Files.copy(path, targetFile, StandardCopyOption.REPLACE_EXISTING);
                    } catch (IOException exception) {
                        throw new IllegalStateException("Failed to seed default external resources", exception);
                    }
                });
        } catch (IOException exception) {
            throw new IllegalStateException("Failed to read default external resources", exception);
        }
    }

    private String normalizeRequiredText(String value, String message) {
        String normalized = normalizeOptionalText(value);
        if (normalized.isEmpty()) {
            throw new IllegalArgumentException(message);
        }
        return normalized;
    }

    private String normalizeOptionalText(String value) {
        return value == null ? "" : value.trim();
    }

    private String resolveParentName(String value) {
        String normalized = normalizeOptionalText(value);
        return normalized.isEmpty() ? "友情链接" : normalized;
    }

    private String inferDefaultThirdLevel(String title) {
        if (List.of("估值速览表", "相对估值图", "相对估值分位数", "绝对估值图", "绝对估值分位数", "分层溢价率图", "历史回归溢价率图").contains(title)) {
            return "估值面";
        }
        if (List.of("二级债基回撤情况", "二级债基当年收益").contains(title)) {
            return "资金面";
        }
        if (List.of("转债市场平价与债底", "转债量价情绪", "转债综合情绪指数", "跟涨能力", "波动率跟踪", "新券溢价").contains(title)) {
            return "市场面";
        }
        if (List.of("转债正股盈利情况（待开发）").contains(title)) {
            return "基本面";
        }
        if (List.of("股债比价图", "偏债转债与债券YTM比价图", "分评级YTM差").contains(title)) {
            return "资产配置";
        }
        return "";
    }

    private String normalizeSlug(String rawSlug, String fallbackName) {
        String base = normalizeOptionalText(rawSlug).isEmpty() ? fallbackName : rawSlug;
        String slug = SLUG_SANITIZE_PATTERN.matcher(base.trim().toLowerCase(Locale.ROOT).replace(' ', '-')).replaceAll("-");
        slug = slug.replaceAll("^-+|-+$", "");
        if (slug.isEmpty()) {
            slug = "external-resource-" + UUID.randomUUID().toString().substring(0, 8);
        }
        return slug;
    }

    private String stripHtmlExtension(String fileName) {
        return fileName.replaceFirst("(?i)\\.(html|htm)$", "");
    }

    private String decodeFileId(String fileId) {
        return java.net.URLDecoder.decode(fileId, StandardCharsets.UTF_8);
    }

    private String now() {
        return OffsetDateTime.now(ZoneOffset.UTC).format(DateTimeFormatter.ISO_OFFSET_DATE_TIME);
    }

    private int resolveOrderIndex(List<String> fileOrder, String fileName) {
        if (fileOrder == null || fileOrder.isEmpty()) {
            return Integer.MAX_VALUE;
        }
        int index = fileOrder.indexOf(fileName);
        return index >= 0 ? index : Integer.MAX_VALUE;
    }

    private ExternalResourceFileDto toLinkDto(ExternalResourceState resource) {
        return new ExternalResourceFileDto(
            resource.getResourceId(),
            resolveResourceTitle(resource, "未命名链接"),
            "",
            normalizeOptionalText(resource.getHref()),
            "LINK",
            normalizeOptionalText(resource.getSectionName()),
            normalizeOptionalText(resource.getThirdLevelName()),
            0,
            resolveUpdatedAt(resource, now())
        );
    }

    private String toOrderKey(ExternalResourceFileDto file) {
        if ("LINK".equalsIgnoreCase(file.getResourceType())) {
            return file.getFileId();
        }
        return normalizeOptionalText(file.getFileName());
    }

    private String resolveResourceTitle(ExternalResourceState resource, String fallback) {
        if (resource == null || normalizeOptionalText(resource.getTitle()).isEmpty()) {
            return fallback;
        }
        return normalizeOptionalText(resource.getTitle());
    }

    private String resolveUpdatedAt(ExternalResourceState resource, String fallback) {
        if (resource == null || normalizeOptionalText(resource.getUpdatedAt()).isEmpty()) {
            return fallback;
        }
        return normalizeOptionalText(resource.getUpdatedAt());
    }

    private List<ExternalResourceState> safeResources(ExternalResourceGroupState group) {
        if (group.getResources() == null) {
            group.setResources(new ArrayList<>());
        }
        return group.getResources();
    }

    private ExternalResourceState findResourceByFileName(ExternalResourceGroupState group, String fileName) {
        return safeResources(group).stream()
            .filter(resource -> fileName.equals(resource.getFileName()))
            .findFirst()
            .orElse(null);
    }

    private ExternalResourceState findResourceById(ExternalResourceGroupState group, String resourceId) {
        return safeResources(group).stream()
            .filter(resource -> resourceId.equals(resource.getResourceId()))
            .findFirst()
            .orElse(null);
    }

    @Data
    private static class ExternalResourceGroupState {
        private String groupId;
        private String name;
        private String slug;
        private String description;
        private String parentName = "友情链接";
        private int order;
        private String createdAt;
        private String updatedAt;
        private List<String> fileOrder = new ArrayList<>();
        private List<ExternalResourceState> resources = new ArrayList<>();
    }

    @Data
    private static class ExternalResourceState {
        private String resourceId;
        private String title;
        private String fileName;
        private String href;
        private String resourceType;
        private String sectionName;
        private String thirdLevelName;
        private String updatedAt;
    }
}
