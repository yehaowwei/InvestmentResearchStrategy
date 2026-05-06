package com.bi.service.impl;

import com.bi.dto.StrategyAiChartContextDto;
import com.bi.dto.StrategyAiChatRequest;
import com.bi.service.StrategyAiService;
import com.bi.vo.StrategyAiChatResponseVo;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.io.BufferedReader;
import java.io.IOException;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.io.OutputStream;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@Service
public class StrategyAiServiceImpl implements StrategyAiService {
    private final ObjectMapper objectMapper;
    private final HttpClient httpClient;
    private final String apiKey;
    private final String baseUrl;
    private final String model;

    public StrategyAiServiceImpl(ObjectMapper objectMapper,
                                 @Value("${strategy-ai.deepseek.api-key:}") String apiKey,
                                 @Value("${strategy-ai.deepseek.base-url:https://api.deepseek.com}") String baseUrl,
                                 @Value("${strategy-ai.deepseek.model:deepseek-chat}") String model) {
        this.objectMapper = objectMapper;
        this.httpClient = HttpClient.newBuilder()
                .connectTimeout(Duration.ofSeconds(20))
                .build();
        this.apiKey = apiKey;
        this.baseUrl = baseUrl;
        this.model = model;
    }

    @Override
    public StrategyAiChatResponseVo chat(StrategyAiChatRequest request) {
        if (apiKey == null || apiKey.isBlank()) {
            return buildFallback(request, "未配置 DeepSeek API Key。");
        }

        try {
            HttpRequest httpRequest = HttpRequest.newBuilder()
                    .uri(URI.create(normalizeBaseUrl(baseUrl) + "/chat/completions"))
                    .timeout(Duration.ofSeconds(60))
                    .header("Content-Type", "application/json")
                    .header("Authorization", "Bearer " + apiKey)
                    .POST(HttpRequest.BodyPublishers.ofString(objectMapper.writeValueAsString(buildPayload(request, false)), StandardCharsets.UTF_8))
                    .build();

            HttpResponse<String> response = httpClient.send(httpRequest, HttpResponse.BodyHandlers.ofString(StandardCharsets.UTF_8));
            if (response.statusCode() < 200 || response.statusCode() >= 300) {
                return buildFallback(request, explainFailure(response.statusCode(), response.body()));
            }

            String reply = extractReply(response.body());
            if (reply == null || reply.isBlank()) {
                return buildFallback(request, "DeepSeek 返回为空。");
            }
            return new StrategyAiChatResponseVo(reply.trim(), false, "deepseek", null);
        } catch (IOException | InterruptedException ex) {
            if (ex instanceof InterruptedException) {
                Thread.currentThread().interrupt();
            }
            return buildFallback(request, "调用 DeepSeek 失败：" + safeText(ex.getMessage()));
        }
    }

    @Override
    public void streamChat(StrategyAiChatRequest request, OutputStream outputStream) throws IOException {
        if (apiKey == null || apiKey.isBlank()) {
            writeTextChunks(outputStream, buildFallback(request, "未配置 DeepSeek API Key。").getReply());
            return;
        }

        try {
            HttpRequest httpRequest = HttpRequest.newBuilder()
                    .uri(URI.create(normalizeBaseUrl(baseUrl) + "/chat/completions"))
                    .timeout(Duration.ofSeconds(120))
                    .header("Content-Type", "application/json")
                    .header("Authorization", "Bearer " + apiKey)
                    .POST(HttpRequest.BodyPublishers.ofString(objectMapper.writeValueAsString(buildPayload(request, true)), StandardCharsets.UTF_8))
                    .build();

            HttpResponse<InputStream> response = httpClient.send(httpRequest, HttpResponse.BodyHandlers.ofInputStream());
            if (response.statusCode() < 200 || response.statusCode() >= 300) {
                String body = new String(response.body().readAllBytes(), StandardCharsets.UTF_8);
                writeTextChunks(outputStream, buildFallback(request, explainFailure(response.statusCode(), body)).getReply());
                return;
            }

            boolean wroteAny = streamDeepSeekResponse(response.body(), outputStream);
            if (!wroteAny) {
                writeTextChunks(outputStream, buildFallback(request, "DeepSeek 未返回有效内容。").getReply());
            }
        } catch (IOException | InterruptedException ex) {
            if (ex instanceof InterruptedException) {
                Thread.currentThread().interrupt();
            }
            writeTextChunks(outputStream, buildFallback(request, "调用 DeepSeek 失败：" + safeText(ex.getMessage())).getReply());
        }
    }

    private Map<String, Object> buildPayload(StrategyAiChatRequest request, boolean stream) {
        List<Map<String, String>> messages = new ArrayList<>();

        messages.add(Map.of(
                "role", "system",
                "content", """
                        你是策略助手，只用中文回答。
                        请严格基于用户提供的策略名称、指标说明和图表摘要回答。
                        回答要专业、简洁、自然，适合演示。
                        不要输出思考过程、推理过程、分析链路，也不要说“我在思考”。
                        不要编造未提供的具体数值，如果没有原始数值，就明确说是基于当前图表摘要观察。
                        """
        ));

        messages.add(Map.of(
                "role", "user",
                "content", buildUserPrompt(request)
        ));

        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("model", model);
        payload.put("messages", messages);
        payload.put("temperature", 0.4);
        if (stream) {
            payload.put("stream", true);
        }
        return payload;
    }

    private String buildUserPrompt(StrategyAiChatRequest request) {
        StringBuilder builder = new StringBuilder();
        builder.append("策略名称：").append(safeText(request.getStrategyName())).append('\n');
        builder.append("用户问题：").append(safeText(request.getPrompt())).append('\n');
        builder.append("当前图表摘要：").append('\n');
        int index = 1;
        for (StrategyAiChartContextDto chart : request.getCharts()) {
            builder.append(index++).append(". 指标名称：").append(safeText(chart.getTitle())).append('\n');
            builder.append("   指标含义：").append(safeText(chart.getMeaning())).append('\n');
            builder.append("   最近变化：").append(safeText(chart.getSummary())).append('\n');
        }
        builder.append("请直接给出演示场景下可直接使用的回答。");
        return builder.toString();
    }

    private boolean streamDeepSeekResponse(InputStream inputStream, OutputStream outputStream) throws IOException {
        boolean wroteAny = false;
        try (BufferedReader reader = new BufferedReader(new InputStreamReader(inputStream, StandardCharsets.UTF_8))) {
            String line;
            while ((line = reader.readLine()) != null) {
                if (!line.startsWith("data:")) {
                    continue;
                }
                String payload = line.substring(5).trim();
                if (payload.isEmpty()) {
                    continue;
                }
                if ("[DONE]".equals(payload)) {
                    break;
                }
                String chunk = extractStreamReply(payload);
                if (chunk == null || chunk.isEmpty()) {
                    continue;
                }
                outputStream.write(chunk.getBytes(StandardCharsets.UTF_8));
                outputStream.flush();
                wroteAny = true;
            }
        }
        return wroteAny;
    }

    private String extractReply(String body) throws IOException {
        Map<String, Object> parsed = objectMapper.readValue(body, new TypeReference<>() {});
        Object choicesRaw = parsed.get("choices");
        if (!(choicesRaw instanceof List<?> choices) || choices.isEmpty()) {
            return null;
        }
        Object first = choices.get(0);
        if (!(first instanceof Map<?, ?> firstMap)) {
            return null;
        }
        Object messageRaw = firstMap.get("message");
        if (!(messageRaw instanceof Map<?, ?> messageMap)) {
            return null;
        }
        Object content = messageMap.get("content");
        return content instanceof String text ? text : null;
    }

    private String extractStreamReply(String body) throws IOException {
        Map<String, Object> parsed = objectMapper.readValue(body, new TypeReference<>() {});
        Object choicesRaw = parsed.get("choices");
        if (!(choicesRaw instanceof List<?> choices) || choices.isEmpty()) {
            return null;
        }
        Object first = choices.get(0);
        if (!(first instanceof Map<?, ?> firstMap)) {
            return null;
        }
        Object deltaRaw = firstMap.get("delta");
        if (!(deltaRaw instanceof Map<?, ?> deltaMap)) {
            return null;
        }
        Object content = deltaMap.get("content");
        return content instanceof String text ? text : null;
    }

    private StrategyAiChatResponseVo buildFallback(StrategyAiChatRequest request, String reason) {
        StringBuilder builder = new StringBuilder();
        builder.append("当前未成功连接 DeepSeek，我先基于本策略已有图表给你做本地解读。").append('\n');
        for (StrategyAiChartContextDto chart : request.getCharts()) {
            builder.append(safeText(chart.getTitle())).append("：")
                    .append(safeText(chart.getMeaning()));
            if (chart.getSummary() != null && !chart.getSummary().isBlank()) {
                builder.append(" ").append(safeText(chart.getSummary()));
            }
            builder.append('\n');
        }
        if (reason != null && !reason.isBlank()) {
            builder.append('\n').append("未调用成功原因：").append(reason);
        }
        return new StrategyAiChatResponseVo(builder.toString().trim(), true, "fallback", reason);
    }

    private String explainFailure(int statusCode, String body) {
        String normalizedBody = safeText(body);
        if (normalizedBody.contains("Authentication Fails") || normalizedBody.contains("invalid")) {
            return "DeepSeek API Key 无效或已失效。";
        }
        if (normalizedBody.isBlank()) {
            return "DeepSeek 返回状态码 " + statusCode + "。";
        }
        return "DeepSeek 返回状态码 " + statusCode + "：" + normalizedBody;
    }

    private String normalizeBaseUrl(String url) {
        String trimmed = safeText(url);
        if (trimmed.endsWith("/")) {
            return trimmed.substring(0, trimmed.length() - 1);
        }
        return trimmed;
    }

    private void writeTextChunks(OutputStream outputStream, String text) throws IOException {
        for (int index = 0; index < text.length(); index += 24) {
            int end = Math.min(text.length(), index + 24);
            outputStream.write(text.substring(index, end).getBytes(StandardCharsets.UTF_8));
            outputStream.flush();
        }
    }

    private String safeText(String text) {
        return text == null ? "" : text.trim();
    }
}
