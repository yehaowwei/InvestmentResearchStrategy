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
import java.util.Set;
import java.util.stream.Collectors;

@Service
public class TkfAgentServiceImpl implements TkfAgentService {
    private static final List<String> LIQUIDITY_DEMO_TITLES = List.of(
            "市场融资余额变化(亿元)",
            "分板块融资余额周度变化(亿元)"
    );

    private static final Set<String> SUPPORTED_ROLES = Set.of("system", "assistant", "user");

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
        TkfAgentResponseVo deterministic = buildDeterministicDemoResponse(request);
        if (deterministic != null) {
            return deterministic;
        }

        if (!apiKey.isBlank()) {
            try {
                return callDeepSeek(request);
            } catch (Exception exception) {
                return buildFallback(request, true);
            }
        }
        return buildFallback(request, true);
    }

    private TkfAgentResponseVo buildDeterministicDemoResponse(TkfAgentRequest request) {
        String conversationPrompt = conversationPrompt(request);
        if (!isLiquidityDemoPrompt(conversationPrompt)) {
            return null;
        }

        List<TkfChartCandidateDto> selected = selectLiquidityDemoCharts(request.getAvailableCharts());
        if (selected.isEmpty()) {
            return null;
        }

        List<TkfChartReasonVo> chartReasons = selected.stream()
                .map(item -> new TkfChartReasonVo(item.getChartId(), buildRecentChangeReason(item)))
                .toList();

        return TkfAgentResponseVo.builder()
                .intent("create")
                .reply(buildLiquidityReply(conversationPrompt, selected))
                .strategyName("流动性策略观察")
                .strategyDescription(buildLiquidityDescription(selected))
                .selectedChartIds(selected.stream().map(TkfChartCandidateDto::getChartId).toList())
                .chartReasons(chartReasons)
                .fallback(false)
                .build();
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
        return normalizeModelResponse(parsed, request.getAvailableCharts(), conversationPrompt(request));
    }

    private TkfAgentResponseVo normalizeModelResponse(Map<String, Object> parsed,
                                                      List<TkfChartCandidateDto> availableCharts,
                                                      String prompt) {
        if (isLiquidityDemoPrompt(prompt)) {
            List<TkfChartCandidateDto> selected = selectLiquidityDemoCharts(availableCharts);
            if (!selected.isEmpty()) {
                List<TkfChartReasonVo> chartReasons = selected.stream()
                        .map(item -> new TkfChartReasonVo(item.getChartId(), buildRecentChangeReason(item)))
                        .toList();
                return TkfAgentResponseVo.builder()
                        .intent("create")
                        .reply(buildLiquidityReply(prompt, selected))
                        .strategyName("流动性策略观察")
                        .strategyDescription(buildLiquidityDescription(selected))
                        .selectedChartIds(selected.stream().map(TkfChartCandidateDto::getChartId).toList())
                        .chartReasons(chartReasons)
                        .fallback(false)
                        .build();
            }
        }

        Map<String, TkfChartCandidateDto> chartMap = availableCharts.stream()
                .collect(Collectors.toMap(TkfChartCandidateDto::getChartId, item -> item, (left, right) -> left, LinkedHashMap::new));
        List<String> selectedChartIds = coerceStringList(parsed.get("selectedChartIds")).stream()
                .filter(chartMap::containsKey)
                .distinct()
                .limit(2)
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
                    .map(chartId -> new TkfChartReasonVo(chartId, buildRecentChangeReason(chartMap.get(chartId))))
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
        return buildFallbackFromPrompt(conversationPrompt(request), request.getAvailableCharts(), fallback);
    }

    private TkfAgentResponseVo buildFallbackFromPrompt(String prompt, List<TkfChartCandidateDto> availableCharts, boolean fallback) {
        String normalizedPrompt = safeLower(prompt);
        if (isLiquidityDemoPrompt(normalizedPrompt)) {
            List<TkfChartCandidateDto> selected = selectLiquidityDemoCharts(availableCharts);
            if (!selected.isEmpty()) {
                List<TkfChartReasonVo> chartReasons = selected.stream()
                        .map(item -> new TkfChartReasonVo(item.getChartId(), buildRecentChangeReason(item)))
                        .toList();
                return TkfAgentResponseVo.builder()
                        .intent("create")
                        .reply(buildLiquidityReply(prompt, selected))
                        .strategyName("流动性策略观察")
                        .strategyDescription(buildLiquidityDescription(selected))
                        .selectedChartIds(selected.stream().map(TkfChartCandidateDto::getChartId).toList())
                        .chartReasons(chartReasons)
                        .fallback(fallback)
                        .build();
            }
        }

        List<TkfChartCandidateDto> rankedCharts = availableCharts.stream()
                .sorted(Comparator.comparingInt((TkfChartCandidateDto item) -> matchScore(item, normalizedPrompt)).reversed())
                .toList();

        List<TkfChartCandidateDto> selected = rankedCharts.stream()
                .filter(item -> matchScore(item, normalizedPrompt) > 0)
                .limit(2)
                .toList();
        if (selected.isEmpty()) {
            selected = rankedCharts.stream().limit(Math.min(2, rankedCharts.size())).toList();
        }

        String focus = inferFocus(normalizedPrompt, selected);
        List<TkfChartReasonVo> chartReasons = selected.stream()
                .map(item -> new TkfChartReasonVo(item.getChartId(), buildRecentChangeReason(item)))
                .toList();

        return TkfAgentResponseVo.builder()
                .intent("create")
                .reply("我先为你整理了一套偏演示型的“" + focus + "策略观察”。它会结合项目里的图表数据来解释最近一段时间的状态变化，不直接给出交易或决策结论。")
                .strategyName(focus + "策略观察")
                .strategyDescription("这套策略主要用于解释最近一段时间" + focus + "相关图表的变化情况，通过多张图的联动展示当前状态、变化节奏和结构差异，方便做汇报与说明。")
                .selectedChartIds(selected.stream().map(TkfChartCandidateDto::getChartId).toList())
                .chartReasons(chartReasons)
                .fallback(fallback)
                .build();
    }

    private List<TkfChartCandidateDto> selectLiquidityDemoCharts(List<TkfChartCandidateDto> availableCharts) {
        List<TkfChartCandidateDto> selected = new ArrayList<>();

        TkfChartCandidateDto chart10 = availableCharts.stream()
                .filter(item -> "chart_10".equals(item.getChartCode()))
                .findFirst()
                .orElse(null);
        TkfChartCandidateDto chart11 = availableCharts.stream()
                .filter(item -> "chart_11".equals(item.getChartCode()))
                .findFirst()
                .orElse(null);

        if (chart10 != null) {
            selected.add(chart10);
        }
        if (chart11 != null && selected.stream().noneMatch(item -> item.getChartId().equals(chart11.getChartId()))) {
            selected.add(chart11);
        }

        if (selected.size() < 2) {
            LIQUIDITY_DEMO_TITLES.stream()
                    .map(title -> findByExactLiquidityTitle(availableCharts, title))
                    .filter(Objects::nonNull)
                    .filter(item -> selected.stream().noneMatch(existing -> existing.getChartId().equals(item.getChartId())))
                    .forEach(selected::add);
        }

        return selected.stream().limit(2).toList();
    }

    private TkfChartCandidateDto findByExactLiquidityTitle(List<TkfChartCandidateDto> availableCharts, String title) {
        return availableCharts.stream()
                .filter(item -> containsTitle(item, title))
                .findFirst()
                .orElse(null);
    }

    private boolean containsTitle(TkfChartCandidateDto item, String title) {
        return safeText(item.getComponentTitle(), "").contains(title)
                || safeText(item.getChartName(), "").contains(title);
    }

    private String buildLiquidityReply(String prompt, List<TkfChartCandidateDto> selected) {
        boolean interpretPrompt = isInterpretPrompt(prompt);
        String prefix = interpretPrompt
                ? "这里我直接根据你项目里的这两张流动性图做一份演示型策略解读。"
                : "我先为你整理了一套偏演示型的“流动性策略观察”。这次只保留两张流动性相关图表，主要说明这两个指标分别反映什么，不直接给出交易或决策结论。";
        String details = selected.stream()
                .map(interpretPrompt ? this::buildInterpretationSentence : this::buildPurposeSentence)
                .collect(Collectors.joining(" "));
        return prefix + " " + details;
    }

    private String buildLiquidityDescription(List<TkfChartCandidateDto> selected) {
        String details = selected.stream()
                .map(this::buildShortDescriptionFragment)
                .collect(Collectors.joining("；"));
        return "这套策略围绕融资余额相关图表展开，用于解释最近一段时间流动性变化节奏与结构特征。"
                + (details.isBlank() ? "" : " 当前可重点展示：" + details + "。");
    }

    private String buildInterpretationSentence(TkfChartCandidateDto chart) {
        String title = resolveTitle(chart);
        String summary = safeText(chart.getRecentSummary(), "");
        if (!summary.isBlank()) {
            return "从“" + title + "”来看，" + summary;
        }
        return "“" + title + "”可以用来辅助说明最近一段时间流动性变化的节奏和结构。";
    }

    private String buildPurposeSentence(TkfChartCandidateDto chart) {
        String title = resolveTitle(chart);
        if (title.contains("市场融资余额变化")) {
            return "“" + title + "”主要反映整体融资资金的增减节奏，适合观察市场层面的流动性变化方向。";
        }
        if (title.contains("分板块融资余额周度变化")) {
            return "“" + title + "”主要反映不同板块之间融资资金流向的分化情况，适合观察结构上的强弱切换。";
        }
        return "“" + title + "”主要用于说明这个策略关注的指标在市场里反映什么状态。";
    }

    private String buildShortDescriptionFragment(TkfChartCandidateDto chart) {
        String title = resolveTitle(chart);
        String summary = safeText(chart.getRecentSummary(), "");
        if (!summary.isBlank()) {
            return title + "：" + summary;
        }
        return title + "用于观察最近一段时间的变化情况";
    }

    private String buildRecentChangeReason(TkfChartCandidateDto chart) {
        String title = resolveTitle(chart);
        String recentSummary = safeText(chart.getRecentSummary(), "");
        if (!recentSummary.isBlank()) {
            return "用“" + title + "”来解释这个策略对应指标最近的变化情况。最近可重点关注：" + recentSummary;
        }
        return "用“" + title + "”来直观看这个策略关注的变化节奏和结构特征，只做状态说明，不做结论推导。";
    }

    private String buildReply(String strategyName, List<TkfChartReasonVo> chartReasons) {
        String details = chartReasons.stream()
                .map(TkfChartReasonVo::getReason)
                .collect(Collectors.joining(" "));
        if (!details.isBlank()) {
            return "我已经为你整理出“" + strategyName + "”的演示版策略。" + details;
        }
        return "我已经为你整理出“" + strategyName + "”的演示版策略。它会围绕相关图表解释最近一段时间的状态和变化，不直接输出决策建议。";
    }

    private String buildDescription(List<TkfChartReasonVo> chartReasons) {
        return "这是一套偏解释型的策略视图，通过相关图表展示最近一段时间的状态、变化节奏和结构差异，用于说明策略反映了什么，而不是给出决策结论。";
    }

    private String buildSystemPrompt(List<TkfChartCandidateDto> availableCharts) {
        String chartCatalog = availableCharts.stream()
                .map(item -> String.format(Locale.ROOT,
                        "- chartId=%s | chartName=%s | componentTitle=%s | category=%s | indicatorTag=%s | recentSummary=%s",
                        item.getChartId(),
                        safeText(item.getChartName(), item.getChartCode()),
                        safeText(item.getComponentTitle(), item.getComponentCode()),
                        safeText(item.getCategory(), ""),
                        safeText(item.getIndicatorTag(), ""),
                        safeText(item.getRecentSummary(), "无")
                ))
                .collect(Collectors.joining("\n"));

        return """
                你是 TKF 策略讲解助手，用中文回答。
                你的任务是根据用户诉求，从给定图表清单中挑选最合适的图表，组织成一个用于演示和解释的策略。
                你必须遵守：
                1. 不给出买卖、配置、择时、收益预测等决策性结论。
                2. 只说明这个策略关注什么、应该看哪些图、这些图能直观反映什么状态。
                3. 如果图表提供了 recentSummary，优先用它来解释最近变化情况，不要编造没有提供的数据。
                4. 只能从给定图表清单中选择 chartId，最多 2 个。
                5. 对话里不要输出思考过程、推理步骤、链路分析或“我为什么这样选”的过程化表达。
                6. 如果上下文出现市场融资余额变化(亿元)和分板块融资余额周度变化(亿元)，优先只选择这两张图。
                7. 输出必须是 JSON 对象，不要输出 Markdown，不要输出代码块。
                8. 如果用户是在“构建策略”场景，就只需简要说明每个指标反映什么，不要展开最近变化解读；只有“策略解读”场景才解释最近变化。

                JSON 字段要求：
                {
                  "intent": "create",
                  "reply": "给用户展示的自然语言说明",
                  "strategyName": "生成的策略名",
                  "strategyDescription": "对该策略的简短说明",
                  "selectedChartIds": ["chartA:cmp1", "chartB:cmp2"],
                  "chartReasons": [
                    {"chartId": "chartA:cmp1", "reason": "该图如何用于解释最近变化情况"}
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
        return SUPPORTED_ROLES.contains(normalized) ? normalized : "user";
    }

    private String conversationPrompt(TkfAgentRequest request) {
        if (request == null || request.getMessages() == null || request.getMessages().isEmpty()) {
            return "";
        }
        return request.getMessages().stream()
                .map(TkfAgentMessageDto::getContent)
                .filter(Objects::nonNull)
                .collect(Collectors.joining(" "));
    }

    private boolean isLiquidityDemoPrompt(String prompt) {
        String normalized = safeLower(prompt);
        return normalized.contains("流动性")
                || normalized.contains("融资")
                || normalized.contains("两融")
                || normalized.contains("liquidity")
                || normalized.contains("市场融资余额变化")
                || normalized.contains("分板块融资余额周度变化");
    }

    private boolean isInterpretPrompt(String prompt) {
        String normalized = safeLower(prompt);
        return normalized.contains("策略解读")
                || normalized.contains("解读")
                || normalized.contains("解释");
    }

    private int matchScore(TkfChartCandidateDto item, String prompt) {
        String haystack = String.join(" ",
                safeLower(item.getChartName()),
                safeLower(item.getComponentTitle()),
                safeLower(item.getIndicatorTag()),
                safeLower(item.getCategory())
        );
        int score = 0;
        if (containsAny(prompt, "融资", "两融", "流动性") && containsAny(haystack, "融资", "两融", "流动性")) {
            score += 8;
        }
        if (containsAny(prompt, "风险溢价", "估值") && containsAny(haystack, "风险溢价", "估值")) {
            score += 8;
        }
        if (prompt.contains("情绪") && haystack.contains("情绪")) {
            score += 8;
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
        if (containsAny(prompt, "融资", "两融", "流动性")) {
            return "流动性";
        }
        if (containsAny(prompt, "风险溢价", "估值")) {
            return "风险溢价";
        }
        if (prompt.contains("情绪")) {
            return "情绪";
        }
        String combined = charts.stream()
                .map(item -> safeLower(item.getComponentTitle()) + " " + safeLower(item.getIndicatorTag()))
                .collect(Collectors.joining(" "));
        if (containsAny(combined, "融资", "两融", "流动性")) {
            return "流动性";
        }
        if (combined.contains("风险溢价")) {
            return "风险溢价";
        }
        return "市场状态";
    }

    private boolean containsAny(String text, String... keywords) {
        for (String keyword : keywords) {
            if (text.contains(keyword)) {
                return true;
            }
        }
        return false;
    }

    private String resolveTitle(TkfChartCandidateDto chart) {
        String title = safeText(chart.getComponentTitle(), "");
        return title.isBlank() ? safeText(chart.getChartName(), chart.getChartCode()) : title;
    }

    private String safeText(Object value, String fallback) {
        String text = Objects.toString(value, "").trim();
        return text.isBlank() ? fallback : text;
    }

    private String safeLower(String value) {
        return value == null ? "" : value.toLowerCase(Locale.ROOT);
    }
}
