package com.bi.service.impl;

import com.bi.common.JsonSnapshotSupport;
import com.bi.dto.TkfAgentMessageDto;
import com.bi.dto.TkfAgentRequest;
import com.bi.dto.TkfChartCandidateDto;
import com.bi.service.TkfAgentService;
import com.bi.vo.TkfAgentResponseVo;
import com.bi.vo.TkfChartReasonVo;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.io.IOException;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.stream.Collectors;

@Service
public class TkfAgentServiceImpl implements TkfAgentService {
    private final JsonSnapshotSupport jsonSnapshotSupport;
    private final HttpClient httpClient;
    private final String apiKey;
    private final String baseUrl;
    private final String model;

    public TkfAgentServiceImpl(JsonSnapshotSupport jsonSnapshotSupport,
                               @Value("${tkf.agent.deepseek.api-key:}") String apiKey,
                               @Value("${tkf.agent.deepseek.base-url:https://api.deepseek.com}") String baseUrl,
                               @Value("${tkf.agent.deepseek.model:deepseek-v4-flash}") String model) {
        this.jsonSnapshotSupport = jsonSnapshotSupport;
        this.apiKey = apiKey == null ? "" : apiKey.trim();
        this.baseUrl = baseUrl == null ? "https://api.deepseek.com" : baseUrl.trim();
        this.model = model == null || model.isBlank() ? "deepseek-v4-flash" : model.trim();
        this.httpClient = HttpClient.newBuilder()
                .connectTimeout(Duration.ofSeconds(20))
                .build();
    }

    @Override
    public TkfAgentResponseVo chat(TkfAgentRequest request) {
        if (!apiKey.isBlank()) {
            try {
                return callDeepSeek(request);
            } catch (Exception exception) {
                return buildFallback(request, true);
            }
        }
        return buildFallback(request, true);
    }

    private TkfAgentResponseVo callDeepSeek(TkfAgentRequest request) throws IOException, InterruptedException {
        List<Map<String, Object>> messages = new ArrayList<>();
        messages.add(Map.of(
                "role", "system",
                "content", buildSystemPrompt(request.getAvailableCharts())
        ));
        for (TkfAgentMessageDto message : request.getMessages()) {
            messages.add(Map.of(
                    "role", normalizeRole(message.getRole()),
                    "content", message.getContent()
            ));
        }

        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("model", model);
        payload.put("messages", messages);
        payload.put("max_tokens", 900);
        payload.put("response_format", Map.of("type", "json_object"));
        payload.put("thinking", Map.of("type", "disabled"));

        HttpRequest httpRequest = HttpRequest.newBuilder()
                .uri(URI.create(baseUrl + "/chat/completions"))
                .timeout(Duration.ofSeconds(60))
                .header("Authorization", "Bearer " + apiKey)
                .header("Content-Type", "application/json")
                .POST(HttpRequest.BodyPublishers.ofString(jsonSnapshotSupport.toJson(payload), StandardCharsets.UTF_8))
                .build();

        HttpResponse<String> response = httpClient.send(httpRequest, HttpResponse.BodyHandlers.ofString(StandardCharsets.UTF_8));
        if (response.statusCode() < 200 || response.statusCode() >= 300) {
            throw new IllegalStateException("DeepSeek request failed: " + response.statusCode());
        }

        @SuppressWarnings("unchecked")
        Map<String, Object> root = jsonSnapshotSupport.fromJson(response.body(), Map.class);
        Object choicesObject = root.get("choices");
        if (!(choicesObject instanceof List<?> choices) || choices.isEmpty()) {
            throw new IllegalStateException("DeepSeek returned empty choices");
        }
        Object firstChoice = choices.get(0);
        if (!(firstChoice instanceof Map<?, ?> choiceMap)) {
            throw new IllegalStateException("DeepSeek choice format invalid");
        }
        Object messageObject = choiceMap.get("message");
        if (!(messageObject instanceof Map<?, ?> messageMap)) {
            throw new IllegalStateException("DeepSeek message format invalid");
        }
        String content = Objects.toString(messageMap.get("content"), "").trim();
        if (content.isBlank()) {
            throw new IllegalStateException("DeepSeek returned empty content");
        }

        @SuppressWarnings("unchecked")
        Map<String, Object> parsed = jsonSnapshotSupport.fromJson(extractJson(content), Map.class);
        return normalizeModelResponse(parsed, request.getAvailableCharts());
    }

    private TkfAgentResponseVo normalizeModelResponse(Map<String, Object> parsed, List<TkfChartCandidateDto> availableCharts) {
        Map<String, TkfChartCandidateDto> chartMap = availableCharts.stream()
                .collect(Collectors.toMap(TkfChartCandidateDto::getChartId, item -> item, (left, right) -> left, LinkedHashMap::new));
        List<String> selectedChartIds = coerceStringList(parsed.get("selectedChartIds")).stream()
                .filter(chartMap::containsKey)
                .distinct()
                .limit(4)
                .toList();
        if (selectedChartIds.isEmpty()) {
            return buildFallbackFromPrompt(Objects.toString(parsed.get("reply"), ""), availableCharts, false);
        }

        List<TkfChartReasonVo> chartReasons = new ArrayList<>();
        Object reasonsObject = parsed.get("chartReasons");
        if (reasonsObject instanceof List<?> reasons) {
            for (Object item : reasons) {
                if (item instanceof Map<?, ?> reasonMap) {
                    String chartId = Objects.toString(reasonMap.get("chartId"), "");
                    String reason = Objects.toString(reasonMap.get("reason"), "").trim();
                    if (!chartId.isBlank() && !reason.isBlank() && chartMap.containsKey(chartId)) {
                        chartReasons.add(new TkfChartReasonVo(chartId, reason));
                    }
                }
            }
        }
        if (chartReasons.isEmpty()) {
            chartReasons = selectedChartIds.stream()
                    .map(chartId -> new TkfChartReasonVo(chartId, buildReason(chartMap.get(chartId))))
                    .toList();
        }

        String strategyName = safeText(parsed.get("strategyName"), "TKF策略演示");
        String reply = safeText(parsed.get("reply"), buildReply(strategyName, chartReasons));
        String description = safeText(parsed.get("strategyDescription"), buildDescription(chartReasons));
        String intent = safeText(parsed.get("intent"), "create");
        return TkfAgentResponseVo.builder()
                .intent(intent)
                .reply(reply)
                .strategyName(strategyName)
                .strategyDescription(description)
                .selectedChartIds(selectedChartIds)
                .chartReasons(chartReasons)
                .fallback(false)
                .build();
    }

    private TkfAgentResponseVo buildFallback(TkfAgentRequest request, boolean fallback) {
        String latestPrompt = request.getMessages().isEmpty()
                ? ""
                : request.getMessages().get(request.getMessages().size() - 1).getContent();
        return buildFallbackFromPrompt(latestPrompt, request.getAvailableCharts(), fallback);
    }

    private TkfAgentResponseVo buildFallbackFromPrompt(String prompt, List<TkfChartCandidateDto> availableCharts, boolean fallback) {
        String normalizedPrompt = prompt == null ? "" : prompt.toLowerCase(Locale.ROOT);
        List<TkfChartCandidateDto> rankedCharts = availableCharts.stream()
                .sorted(Comparator.comparingInt((TkfChartCandidateDto item) -> matchScore(item, normalizedPrompt)).reversed())
                .collect(Collectors.toList());

        List<TkfChartCandidateDto> selected = rankedCharts.stream()
                .filter(item -> matchScore(item, normalizedPrompt) > 0)
                .limit(4)
                .collect(Collectors.toList());
        if (selected.isEmpty()) {
            selected = rankedCharts.stream().limit(Math.min(3, rankedCharts.size())).collect(Collectors.toList());
        }

        String focus = inferFocus(normalizedPrompt, selected);
        String strategyName = focus + "策略观察";
        List<TkfChartReasonVo> chartReasons = selected.stream()
                .map(item -> new TkfChartReasonVo(item.getChartId(), buildReason(item)))
                .toList();
        String reply = "我先为你整理了一套偏演示型的“" + strategyName + "”。它会用中性的图表组合去展示这个策略关注的市场状态，不直接给出交易或决策结论。";
        String description = "这个策略主要用于观察" + focus + "相关的图表变化，通过多张图的联动展示当前状态、强弱节奏和结构差异，方便做汇报与说明。";

        return TkfAgentResponseVo.builder()
                .intent("create")
                .reply(reply)
                .strategyName(strategyName)
                .strategyDescription(description)
                .selectedChartIds(selected.stream().map(TkfChartCandidateDto::getChartId).toList())
                .chartReasons(chartReasons)
                .fallback(fallback)
                .build();
    }

    private int matchScore(TkfChartCandidateDto item, String prompt) {
        String haystack = String.join(" ",
                safeLower(item.getChartName()),
                safeLower(item.getComponentTitle()),
                safeLower(item.getIndicatorTag()),
                safeLower(item.getCategory())
        );
        int score = 0;
        if (prompt.contains("融资") || prompt.contains("两融") || prompt.contains("流动性")) {
            if (haystack.contains("融资") || haystack.contains("两融") || haystack.contains("流动性")) {
                score += 8;
            }
        }
        if (prompt.contains("风险溢价") || prompt.contains("估值")) {
            if (haystack.contains("风险溢价") || haystack.contains("估值")) {
                score += 8;
            }
        }
        if (prompt.contains("情绪")) {
            if (haystack.contains("情绪")) {
                score += 8;
            }
        }
        for (String token : List.of("融资", "两融", "流动性", "风险", "溢价", "估值", "情绪", "板块", "波动")) {
            if (prompt.contains(token) && haystack.contains(token)) {
                score += 2;
            }
        }
        if (score == 0 && prompt.contains("策略")) {
            score = 1;
        }
        return score;
    }

    private String inferFocus(String prompt, List<TkfChartCandidateDto> charts) {
        if (prompt.contains("融资") || prompt.contains("两融") || prompt.contains("流动性")) {
            return "流动性";
        }
        if (prompt.contains("风险溢价") || prompt.contains("估值")) {
            return "风险溢价";
        }
        if (prompt.contains("情绪")) {
            return "情绪";
        }
        String combined = charts.stream()
                .map(item -> safeLower(item.getComponentTitle()) + " " + safeLower(item.getIndicatorTag()))
                .collect(Collectors.joining(" "));
        if (combined.contains("融资") || combined.contains("两融")) {
            return "流动性";
        }
        if (combined.contains("风险溢价")) {
            return "风险溢价";
        }
        return "市场状态";
    }

    private String buildReason(TkfChartCandidateDto chart) {
        String title = chart.getComponentTitle() == null || chart.getComponentTitle().isBlank()
                ? chart.getChartName()
                : chart.getComponentTitle();
        return "用“" + title + "”来直观看这个策略关注的变化节奏和结构特征，只做状态说明，不做结论推导。";
    }

    private String buildReply(String strategyName, List<TkfChartReasonVo> chartReasons) {
        return "我已经为你整理出“" + strategyName + "”的演示版策略。它会围绕相关图表解释当前状态和变化，不直接输出决策建议。";
    }

    private String buildDescription(List<TkfChartReasonVo> chartReasons) {
        return "这是一套偏解释型的策略视图，通过相关图表把当前状态、变化节奏和结构差异展示出来，用于说明策略反映了什么，而不是给出决策结论。";
    }

    private String buildSystemPrompt(List<TkfChartCandidateDto> availableCharts) {
        String chartCatalog = availableCharts.stream()
                .map(item -> String.format(Locale.ROOT,
                        "- chartId=%s | chartName=%s | componentTitle=%s | category=%s | indicatorTag=%s",
                        item.getChartId(),
                        safeText(item.getChartName(), item.getChartCode()),
                        safeText(item.getComponentTitle(), item.getComponentCode()),
                        safeText(item.getCategory(), ""),
                        safeText(item.getIndicatorTag(), "")
                ))
                .collect(Collectors.joining("\n"));

        return """
                你是TKF策略讲解助手，用中文回答。
                你的任务是根据用户诉求，从给定图表清单中挑选最合适的图表，组织成一个“用于演示和解释”的策略。
                你必须遵守：
                1. 不给出买卖、配置、择时、收益预测等决策性结论。
                2. 只说明这个策略关注什么、应该看哪些图、这些图能直观反映什么状态。
                3. 只能从给定图表清单中选择 chartId，最多 4 个。
                4. 如果用户主要是在问“这个策略是什么意思”，也要给出一个便于演示的策略名和解释，但 selectedChartIds 可以少量。
                5. 输出必须是 JSON 对象，不要输出 Markdown，不要输出代码块。

                JSON 字段要求：
                {
                  "intent": "create",
                  "reply": "给用户展示的自然语言说明",
                  "strategyName": "生成的策略名",
                  "strategyDescription": "对该策略的简短说明",
                  "selectedChartIds": ["chartA:cmp1", "chartB:cmp2"],
                  "chartReasons": [
                    {"chartId": "chartA:cmp1", "reason": "为什么选它"}
                  ]
                }

                可用图表如下：
                %s
                """.formatted(chartCatalog);
    }

    private String extractJson(String content) {
        String trimmed = content.trim();
        int firstBrace = trimmed.indexOf('{');
        int lastBrace = trimmed.lastIndexOf('}');
        if (firstBrace >= 0 && lastBrace > firstBrace) {
            return trimmed.substring(firstBrace, lastBrace + 1);
        }
        return trimmed;
    }

    private List<String> coerceStringList(Object value) {
        if (!(value instanceof List<?> list)) {
            return List.of();
        }
        return list.stream()
                .map(item -> Objects.toString(item, "").trim())
                .filter(item -> !item.isBlank())
                .toList();
    }

    private String normalizeRole(String role) {
        String normalized = role == null ? "user" : role.trim().toLowerCase(Locale.ROOT);
        return List.of("system", "assistant", "user").contains(normalized) ? normalized : "user";
    }

    private String safeText(Object value, String fallback) {
        String text = Objects.toString(value, "").trim();
        return text.isBlank() ? fallback : text;
    }

    private String safeLower(String value) {
        return value == null ? "" : value.toLowerCase(Locale.ROOT);
    }
}
