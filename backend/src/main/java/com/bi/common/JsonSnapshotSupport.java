package com.bi.common;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.stereotype.Component;

@Component
public class JsonSnapshotSupport {
    private final ObjectMapper objectMapper;

    public JsonSnapshotSupport(ObjectMapper objectMapper) {
        this.objectMapper = objectMapper;
    }

    public <T> T copy(T source, Class<T> type) {
        return objectMapper.convertValue(source, type);
    }

    public <T> T convert(Object source, Class<T> type) {
        return objectMapper.convertValue(source, type);
    }

    public String toJson(Object source) {
        try {
            return objectMapper.writeValueAsString(source);
        } catch (JsonProcessingException exception) {
            throw new IllegalArgumentException("Failed to serialize snapshot", exception);
        }
    }

    public <T> T fromJson(String source, Class<T> type) {
        try {
            return objectMapper.readValue(source, type);
        } catch (JsonProcessingException exception) {
            throw new IllegalArgumentException("Failed to deserialize snapshot", exception);
        }
    }
}
