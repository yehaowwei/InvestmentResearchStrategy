package com.bi.service.impl;

import com.bi.common.JsonSnapshotSupport;
import com.bi.dto.ExternalResourceFileDto;
import com.bi.dto.ExternalResourceGroupDto;
import com.bi.dto.ExternalResourceGroupRequest;
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
        created.setOrder(groups.size() + 1);
        created.setCreatedAt(now);
        created.setUpdatedAt(now);
        groups.add(created);
        saveGroups(groups);
        createDirectory(groupDirectory(created));
        return toDto(created);
    }

    @Override
    public ExternalResourceGroupDto uploadFiles(String groupId, MultipartFile[] files) {
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
        uploadedFileNames.forEach(fileName -> {
            group.getFileOrder().remove(fileName);
            group.getFileOrder().add(fileName);
        });

        group.setUpdatedAt(now());
        saveGroups(groups);
        return toDto(group);
    }

    @Override
    public ExternalResourceGroupDto reorderFiles(String groupId, List<String> fileIds) {
        List<ExternalResourceGroupState> groups = readGroups();
        ExternalResourceGroupState group = findGroup(groups, groupId);
        List<ExternalResourceFileDto> files = listFiles(group);
        Set<String> existingFileNames = files.stream()
            .map(ExternalResourceFileDto::getFileName)
            .collect(Collectors.toCollection(HashSet::new));

        List<String> decodedFileNames = (fileIds == null ? List.<String>of() : fileIds).stream()
            .map(this::decodeFileId)
            .collect(Collectors.toCollection(ArrayList::new));
        Set<String> providedFileNames = new HashSet<>(decodedFileNames);

        if (!providedFileNames.equals(existingFileNames) || decodedFileNames.size() != existingFileNames.size()) {
            throw new IllegalArgumentException("Invalid file order payload");
        }

        group.setFileOrder(decodedFileNames);
        group.setUpdatedAt(now());
        saveGroups(groups);
        return toDto(group);
    }

    @Override
    public void deleteFile(String groupId, String fileId) {
        List<ExternalResourceGroupState> groups = readGroups();
        ExternalResourceGroupState group = findGroup(groups, groupId);
        String fileName = decodeFileId(fileId);
        Path filePath = groupDirectory(group).resolve(fileName).normalize();
        ensureInsideGroup(groupDirectory(group), filePath);
        try {
            Files.deleteIfExists(filePath);
        } catch (IOException exception) {
            throw new IllegalStateException("Failed to delete external resource file", exception);
        }
        if (group.getFileOrder() != null) {
            group.getFileOrder().remove(fileName);
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
            state.getOrder(),
            state.getCreatedAt(),
            state.getUpdatedAt(),
            listFiles(state)
        );
    }

    private List<ExternalResourceFileDto> listFiles(ExternalResourceGroupState group) {
        Path directory = groupDirectory(group);
        if (!Files.exists(directory)) {
            return new ArrayList<>();
        }
        try (var stream = Files.list(directory)) {
            return stream
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
        } catch (IOException exception) {
            throw new IllegalStateException("Failed to read external resource files", exception);
        }
    }

    private ExternalResourceFileDto toFileDto(ExternalResourceGroupState group, Path path) {
        try {
            String fileName = path.getFileName().toString();
            String encodedFileName = URLEncoder.encode(fileName, StandardCharsets.UTF_8).replace("+", "%20");
            return new ExternalResourceFileDto(
                encodedFileName,
                stripHtmlExtension(fileName),
                fileName,
                "/external-resources/" + group.getSlug() + "/" + encodedFileName,
                Files.size(path),
                Files.getLastModifiedTime(path).toInstant().atOffset(ZoneOffset.UTC).format(DateTimeFormatter.ISO_OFFSET_DATE_TIME)
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
        boolean hasConvertibleBoard = groups.stream().anyMatch(item -> item.getSlug().equals("convertible-board"));
        if (!hasConvertibleBoard) {
            ExternalResourceGroupState group = new ExternalResourceGroupState();
            String now = now();
            group.setGroupId("external-resource-convertible-board");
            group.setName("转债看板");
            group.setSlug("convertible-board");
            group.setDescription("转债相关外部 HTML 资源");
            group.setOrder(groups.size() + 1);
            group.setCreatedAt(now);
            group.setUpdatedAt(now);
            groups.add(group);
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

    @Data
    private static class ExternalResourceGroupState {
        private String groupId;
        private String name;
        private String slug;
        private String description;
        private int order;
        private String createdAt;
        private String updatedAt;
        private List<String> fileOrder = new ArrayList<>();
    }
}
