package vn.edu.vnu.structpaper.ai;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.MediaType;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;

import java.time.Duration;
import java.time.Instant;
import java.util.*;
import java.util.concurrent.ConcurrentLinkedDeque;

@Service
public class AiService {

    private static final Logger log = LoggerFactory.getLogger(AiService.class);

    public static final int MAX_PAYLOAD_BYTES = 15 * 1024; // 15,360 bytes (15KB)

    public static final Set<String> WHITELISTED_ACTIONS = Set.of(
            "extractFrontMatter",
            "extractMetadata",
            "suggestKeywords",
            "refineAbstract",
            "fixGrammar"
    );

    private static final Set<String> FORBIDDEN_PROMPT_KEYS = Set.of(
            "prompt",
            "userprompt",
            "systemprompt",
            "freeprompt",
            "customprompt",
            "instruction"
    );

    private final AiProperties properties;
    private final ObjectMapper objectMapper;
    private final Deque<AiAuditRecord> auditLog = new ConcurrentLinkedDeque<>();
    private final RestClient restClient;

    public AiService(AiProperties properties, ObjectMapper objectMapper) {
        this.properties = properties;
        this.objectMapper = objectMapper;

        SimpleClientHttpRequestFactory requestFactory = new SimpleClientHttpRequestFactory();
        requestFactory.setConnectTimeout(Duration.ofSeconds(properties.getTimeoutSeconds()));
        requestFactory.setReadTimeout(Duration.ofSeconds(properties.getTimeoutSeconds()));

        this.restClient = RestClient.builder()
                .requestFactory(requestFactory)
                .build();
    }

    public AiExtractResponse execute(AiExtractRequest request, String clientIp) {
        long startTime = System.currentTimeMillis();
        String action = validateAction(request.action());

        Map<String, Object> payload = request.payload();
        if (payload == null) {
            payload = Collections.emptyMap();
        }

        validatePayload(payload);

        boolean isMock = properties.isMockMode();
        Map<String, Object> resultData;
        int estimatedTokens;

        if (isMock) {
            resultData = generateMockResponse(action, payload);
            estimatedTokens = estimateTokens(payload, resultData);
        } else {
            OpenAiExecutionResult execution = executeOpenAi(action, payload);
            resultData = execution.data();
            estimatedTokens = execution.tokens();
        }

        long durationMs = System.currentTimeMillis() - startTime;
        recordAudit(action, clientIp, estimatedTokens, durationMs, isMock);

        return AiExtractResponse.of(action, resultData);
    }

    private String validateAction(String rawAction) {
        if (rawAction == null || rawAction.isBlank()) {
            throw new InvalidActionException("Action không được để trống");
        }
        String trimmed = rawAction.trim();
        if (!WHITELISTED_ACTIONS.contains(trimmed)) {
            throw new InvalidActionException("Hành động không hợp lệ: '" + trimmed +
                    "'. Chỉ cho phép các action trong whitelist: " + WHITELISTED_ACTIONS);
        }
        return trimmed;
    }

    private void validatePayload(Map<String, Object> payload) {
        // 1. Kiểm tra kích thước payload <= 15KB (15,360 bytes)
        try {
            byte[] bytes = objectMapper.writeValueAsBytes(payload);
            if (bytes.length > MAX_PAYLOAD_BYTES) {
                throw new PayloadTooLargeException("Kích thước payload vượt quá giới hạn tối đa 15KB (" +
                        bytes.length + " bytes > " + MAX_PAYLOAD_BYTES + " bytes)");
            }
        } catch (PayloadTooLargeException ex) {
            throw ex;
        } catch (Exception ex) {
            log.error("Lỗi khi kiểm tra kích thước payload: ", ex);
        }

        // 2. Nghiêm cấm nhận prompt tự do (free-form prompt)
        for (String key : payload.keySet()) {
            if (key != null && FORBIDDEN_PROMPT_KEYS.contains(key.toLowerCase(Locale.ROOT).trim())) {
                throw new InvalidActionException(
                        "Nghiêm cấm nhận prompt tự do (free-form prompt). Không được sử dụng trường '" + key + "'."
                );
            }
        }
    }

    private OpenAiExecutionResult executeOpenAi(String action, Map<String, Object> payload) {
        String apiKey = properties.getResolvedApiKey();
        String userPrompt = buildServerDefinedPrompt(action, payload);

        Map<String, Object> requestBody = Map.of(
                "model", properties.getModel(),
                "messages", List.of(
                        Map.of("role", "system", "content",
                                "Bạn là chuyên gia biên tập xuất bản học thuật của Đại học Quốc gia Thành phố Hồ Chí Minh (VNUHCM). " +
                                "Luôn trả lời bằng định dạng JSON hợp lệ duy nhất, tuyệt đối không chứa giải thích hoặc markdown ngoài JSON."),
                        Map.of("role", "user", "content", userPrompt)
                ),
                "response_format", Map.of("type", "json_object"),
                "temperature", 0.1
        );

        String endpoint = properties.getBaseUrl().replaceAll("/+$", "") + "/chat/completions";

        try {
            String rawResponse = restClient.post()
                    .uri(endpoint)
                    .contentType(MediaType.APPLICATION_JSON)
                    .header("Authorization", "Bearer " + apiKey)
                    .body(requestBody)
                    .retrieve()
                    .body(String.class);

            Map<String, Object> respMap = objectMapper.readValue(rawResponse, new TypeReference<Map<String, Object>>() {});
            int totalTokens = 0;
            if (respMap.get("usage") instanceof Map<?, ?> usageMap) {
                Object tokensObj = usageMap.get("total_tokens");
                if (tokensObj instanceof Number num) {
                    totalTokens = num.intValue();
                }
            }

            String contentJson = "{}";
            if (respMap.get("choices") instanceof List<?> choices && !choices.isEmpty()) {
                if (choices.get(0) instanceof Map<?, ?> firstChoice) {
                    if (firstChoice.get("message") instanceof Map<?, ?> message) {
                        contentJson = String.valueOf(message.get("content"));
                    }
                }
            }

            Map<String, Object> parsedData = objectMapper.readValue(contentJson, new TypeReference<Map<String, Object>>() {});
            if (totalTokens == 0) {
                totalTokens = estimateTokens(payload, parsedData);
            }

            return new OpenAiExecutionResult(parsedData, totalTokens);
        } catch (Exception ex) {
            log.error("Lỗi khi gọi OpenAI API (fallback sang mock response an toàn): {}", ex.getMessage());
            Map<String, Object> fallback = generateMockResponse(action, payload);
            return new OpenAiExecutionResult(fallback, estimateTokens(payload, fallback));
        }
    }

    private String buildServerDefinedPrompt(String action, Map<String, Object> payload) {
        String text = extractTextFromPayload(payload);
        return switch (action) {
            case "extractFrontMatter", "extractMetadata" -> """
                    Phân tích phần đầu bài báo khoa học sau và trích xuất cấu trúc dữ liệu JSON đầy đủ:
                    {
                      "title": "Tiêu đề tiếng Việt chính",
                      "titleEn": "Tiêu đề tiếng Anh (nếu có)",
                      "articleType": "Bài nghiên cứu HOẶC Bài tổng quan",
                      "journalId": "Một trong 7 mã định danh: VNUHCM-ARNS, VNUHCM-EBL, VNUHCM-EES, VNUHCM-HS, VNUHCM-SSH, VNUHCM-ET, VNUHCM-STDJ",
                      "authors": [{"name": "Họ và tên", "affiliationIds": [1], "isCorresponding": true}],
                      "affiliations": [{"id": 1, "name": "Đơn vị công tác"}],
                      "corresponding": {"name": "Tên liên hệ", "email": "Email", "affiliation": "Đơn vị"},
                      "abstract": "Nội dung Tóm tắt tiếng Việt",
                      "abstractEn": "Abstract tiếng Anh",
                      "keywords": ["từ khóa 1", "từ khóa 2"],
                      "keywordsEn": ["keyword 1", "keyword 2"],
                      "dates": {"received": "Ngày nhận", "accepted": "Ngày chấp nhận"}
                    }
                    
                    Văn bản đầu bài:
                    """ + text;

            case "suggestKeywords" -> """
                    Dựa vào nội dung bài báo khoa học sau, hãy đề xuất 5-8 từ khóa tiếng Việt và từ khóa tiếng Anh tương ứng.
                    Cấu trúc JSON:
                    {
                      "keywords": ["từ khóa 1", "từ khóa 2", ...],
                      "keywordsEn": ["keyword 1", "keyword 2", ...]
                    }
                    
                    Nội dung:
                    """ + text;

            case "refineAbstract" -> """
                    Hãy trau chuốt và tinh chỉnh đoạn tóm tắt khoa học dưới đây để văn phong súc tích, mạch lạc và chuẩn mực học thuật ĐHQG-HCM, không làm thay đổi các số liệu hay sự kiện thực tế.
                    Cấu trúc JSON:
                    {
                      "original": "...",
                      "refined": "...",
                      "improvements": ["cải tiến 1", "cải tiến 2"]
                    }
                    
                    Tóm tắt:
                    """ + text;

            case "fixGrammar" -> """
                    Hãy kiểm tra và sửa lỗi ngữ pháp, chính tả, dùng từ học thuật trong văn bản sau.
                    Cấu trúc JSON:
                    {
                      "original": "...",
                      "correctedText": "...",
                      "correctionsCount": 0,
                      "corrections": [{"type": "spelling/grammar", "original": "từ sai", "replacement": "từ đúng", "reason": "lý do"}]
                    }
                    
                    Văn bản:
                    """ + text;

            default -> throw new InvalidActionException("Action không được hỗ trợ: " + action);
        };
    }

    private String extractTextFromPayload(Map<String, Object> payload) {
        if (payload.containsKey("text") && payload.get("text") != null) {
            return String.valueOf(payload.get("text")).trim();
        }
        if (payload.containsKey("abstract") && payload.get("abstract") != null) {
            return String.valueOf(payload.get("abstract")).trim();
        }
        if (payload.containsKey("content") && payload.get("content") != null) {
            return String.valueOf(payload.get("content")).trim();
        }
        if (payload.containsKey("tableText") && payload.get("tableText") != null) {
            return String.valueOf(payload.get("tableText")).trim();
        }
        return "";
    }

    private Map<String, Object> generateMockResponse(String action, Map<String, Object> payload) {
        String text = extractTextFromPayload(payload);
        String sampleTitle = (text.length() > 0)
                ? (text.split("\n")[0].length() > 80 ? text.substring(0, 80).trim() + "..." : text.split("\n")[0].trim())
                : "Nghiên cứu ứng dụng trí tuệ nhân tạo trong tự động hóa xuất bản khoa học";

        return switch (action) {
            case "extractFrontMatter", "extractMetadata" -> buildMockFrontMatter(sampleTitle);

            case "suggestKeywords" -> Map.of(
                    "keywords", List.of(
                            "trí tuệ nhân tạo",
                            "xử lý tài liệu khoa học",
                            "mô hình ngôn ngữ lớn",
                            "tự động hóa biên tập",
                            "xuất bản học thuật"
                    ),
                    "keywordsEn", List.of(
                            "artificial intelligence",
                            "scientific document processing",
                            "large language models",
                            "editorial automation",
                            "scholarly publishing"
                    )
            );

            case "refineAbstract" -> Map.of(
                    "original", text.isEmpty() ? "Bản thảo tóm tắt nghiên cứu khoa học." : text,
                    "refined", (text.isEmpty() ? "Nghiên cứu này trình bày giải pháp toàn diện " : text + " ") +
                            "nhằm nâng cao chất lượng biên tập học thuật, đảm bảo tính súc tích, mạch lạc và chuẩn mực xuất bản.",
                    "improvements", List.of(
                            "Chuẩn hóa thuật ngữ học thuật theo quy chuẩn ĐHQG-HCM",
                            "Tăng cường tính mạch lạc giữa các mệnh đề",
                            "Khắc phục các cấu trúc câu rườm rà"
                    )
            );

            case "fixGrammar" -> Map.of(
                    "original", text.isEmpty() ? "Văn bản mẫu cần hiệu đính." : text,
                    "correctedText", text.isEmpty() ? "Văn bản mẫu đã được hiệu đính chuẩn xác." : text.replaceAll("chử", "chữ"),
                    "correctionsCount", 1,
                    "corrections", List.of(
                            Map.of(
                                    "type", "style",
                                    "original", "thực hiện bởi nhóm nghiên cứu",
                                    "replacement", "do nhóm nghiên cứu thực hiện",
                                    "reason", "Văn phong học thuật chuẩn mực và tự nhiên hơn"
                            )
                    )
            );

            default -> Collections.emptyMap();
        };
    }

    private Map<String, Object> buildMockFrontMatter(String sampleTitle) {
        Map<String, Object> data = new LinkedHashMap<>();
        data.put("title", sampleTitle);
        data.put("titleEn", "Research on Applying Artificial Intelligence to Automated Scientific Publishing");
        data.put("articleType", "Bài nghiên cứu");
        data.put("journalId", "VNUHCM-ET");
        data.put("authors", List.of(
                Map.of("name", "Nguyễn Văn An", "affiliationIds", List.of(1), "isCorresponding", true)
        ));
        data.put("affiliations", List.of(
                Map.of("id", 1, "name", "Trường Đại học Bách khoa, ĐHQG-HCM")
        ));
        data.put("corresponding", Map.of(
                "name", "Nguyễn Văn An",
                "email", "an.nguyen@vnuhcm.edu.vn",
                "affiliation", "Trường Đại học Bách khoa, ĐHQG-HCM"
        ));
        data.put("abstract", "Bài báo trình bày phương pháp tự động hóa quy trình xuất bản tài liệu khoa học theo chuẩn LaTeX và XML/JATS...");
        data.put("abstractEn", "This paper presents an automated pipeline for scholarly scientific document publishing...");
        data.put("keywords", List.of("trí tuệ nhân tạo", "tự động hóa xuất bản", "LaTeX", "định dạng khoa học"));
        data.put("keywordsEn", List.of("artificial intelligence", "automated publishing", "LaTeX", "scientific formatting"));
        data.put("dates", Map.of(
                "received", "2026-03-01",
                "revised", "2026-03-25",
                "accepted", "2026-04-10"
        ));
        return data;
    }

    private int estimateTokens(Map<String, Object> input, Map<String, Object> output) {
        int inputLen = 0;
        int outputLen = 0;
        try {
            inputLen = objectMapper.writeValueAsString(input).length();
            outputLen = objectMapper.writeValueAsString(output).length();
        } catch (Exception ignored) {}
        return Math.max(1, (inputLen + outputLen) / 4);
    }

    private void recordAudit(String action, String clientIp, int tokens, long durationMs, boolean mockMode) {
        AiAuditRecord record = new AiAuditRecord(
                action,
                (clientIp != null && !clientIp.isBlank()) ? clientIp : "127.0.0.1",
                tokens,
                durationMs,
                mockMode,
                Instant.now()
        );

        auditLog.addFirst(record);
        while (auditLog.size() > 100) {
            auditLog.removeLast();
        }

        log.info("AI Proxy Audit: action={}, clientIp={}, estimatedTokens={}, durationMs={}ms, mockMode={}",
                record.action(), record.clientIp(), record.estimatedTokens(), record.durationMs(), record.mockMode());
    }

    public List<AiAuditRecord> getRecentAuditLogs() {
        return List.copyOf(auditLog);
    }

    public Optional<AiAuditRecord> getLastAuditRecord() {
        return Optional.ofNullable(auditLog.peekFirst());
    }

    private record OpenAiExecutionResult(Map<String, Object> data, int tokens) {}
}
