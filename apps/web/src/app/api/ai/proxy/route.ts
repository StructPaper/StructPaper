import { NextRequest, NextResponse } from 'next/server';

const ALLOWED_ACTIONS = [
  'metadata',
  'table',
  'extractFrontMatter',
  'extractMetadata',
  'suggestKeywords',
  'refineAbstract',
  'fixGrammar',
] as const;
type AllowedAction = (typeof ALLOWED_ACTIONS)[number];

const ALLOWED_MODELS = ['gpt-4o-mini', 'gpt-5.4-mini', 'gpt-4o'] as const;
const DEFAULT_MODEL = 'gpt-4o-mini';

const MAX_TEXT_LENGTH = 15000; // <= 15000 characters (< 50KB)
const MAX_PAYLOAD_BYTES = 50 * 1024; // 50KB

interface AiProxyRequestBody {
  action?: string;
  text?: string;
  tableText?: string;
  payload?: Record<string, any>;
  options?: Record<string, any>;
  model?: string;
  // Note: Client apiKey is intentionally omitted from type definition and discarded if sent
}

function validateOrigin(req: NextRequest): { valid: boolean; error?: string } {
  const secFetchSite = req.headers.get('sec-fetch-site');
  if (secFetchSite === 'cross-site') {
    return {
      valid: false,
      error: 'Yêu cầu bị từ chối: Vi phạm chính sách cùng nguồn gốc (cross-site).',
    };
  }

  const origin = req.headers.get('origin');
  const host = req.headers.get('host');
  if (origin && host) {
    try {
      const originHost = new URL(origin).host;
      if (originHost !== host) {
        return {
          valid: false,
          error: 'Yêu cầu bị từ chối: Nguồn gốc (Origin) không khớp với máy chủ.',
        };
      }
    } catch {
      return {
        valid: false,
        error: 'Nguồn gốc (Origin) không hợp lệ.',
      };
    }
  }

  return { valid: true };
}

export async function POST(req: NextRequest) {
  // 1. Same-Origin & Sec-Fetch-Site validation
  const originCheck = validateOrigin(req);
  if (!originCheck.valid) {
    return NextResponse.json({ error: originCheck.error }, { status: 403 });
  }

  // 2. Content-Length header limit
  const contentLength = req.headers.get('content-length');
  if (contentLength && parseInt(contentLength, 10) > MAX_PAYLOAD_BYTES) {
    return NextResponse.json(
      { error: 'Dung lượng yêu cầu vượt quá giới hạn cho phép (tối đa 50KB).' },
      { status: 413 }
    );
  }

  // 3. Parse request body
  let body: AiProxyRequestBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: 'Định dạng dữ liệu JSON không hợp lệ.' },
      { status: 400 }
    );
  }

  // 4. Action Whitelist validation
  if (!body.action || !ALLOWED_ACTIONS.includes(body.action as AllowedAction)) {
    return NextResponse.json(
      { error: 'Hành động không hợp lệ. Chỉ chấp nhận "metadata" hoặc "table".' },
      { status: 400 }
    );
  }

  // 5. Text length & presence validation
  const text = (body.text || (body.payload && typeof body.payload.text === 'string' ? body.payload.text : '') || '').trim();
  const tableText = (body.tableText || (body.payload && typeof body.payload.tableText === 'string' ? body.payload.tableText : '') || '').trim();
  const hasPayload = body.payload && Object.keys(body.payload).length > 0;

  if (!text && !tableText && !hasPayload) {
    return NextResponse.json(
      { error: 'Thiếu dữ liệu văn bản cần trích xuất.' },
      { status: 400 }
    );
  }

  if (text.length > MAX_TEXT_LENGTH) {
    return NextResponse.json(
      { error: `Kích thước văn bản vượt quá giới hạn cho phép (tối đa ${MAX_TEXT_LENGTH} ký tự).` },
      { status: 413 }
    );
  }

  if (tableText.length > MAX_TEXT_LENGTH) {
    return NextResponse.json(
      { error: `Kích thước văn bản bảng vượt quá giới hạn cho phép (tối đa ${MAX_TEXT_LENGTH} ký tự).` },
      { status: 413 }
    );
  }

  // 6. Forward to Spring Boot Backend if configured or available
  const configuredSpringBase = process.env.SPRING_API_URL;
  let springBaseUrl = configuredSpringBase;

  if (!springBaseUrl && process.env.NODE_ENV !== 'test') {
    // Quick 800ms ping to 127.0.0.1 to avoid hanging on non-responsive ports/wslrelay
    try {
      const probe = await fetch('http://127.0.0.1:8080/api/v1/system/status', {
        method: 'GET',
        signal: AbortSignal.timeout(800),
      });
      if (probe.ok) {
        springBaseUrl = 'http://127.0.0.1:8080';
      }
    } catch {
      // Backend not running; continue to local OpenAI handler
    }
  }

  if (springBaseUrl) {
    try {
      const springAction = body.action === 'metadata' ? 'extractFrontMatter' : body.action;
      const payload = body.payload ?? (tableText ? { tableText, text } : { text });

      const endpoint = `${springBaseUrl.replace(/\/+$/, '')}/api/v1/ai/extract`;
      const clientIp = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || '127.0.0.1';

      const springRes = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Forwarded-For': clientIp,
        },
        body: JSON.stringify({
          action: springAction,
          payload,
          options: body.options,
        }),
        signal: AbortSignal.timeout(15000),
      });

      if (springRes.ok) {
        const result = await springRes.json();
        if (result && (result.data !== undefined || result.action !== undefined)) {
          return NextResponse.json({
            success: true,
            data: result.data,
            action: result.action,
          });
        }
      } else if (springRes.status === 400 || springRes.status === 413) {
        const errJson = await springRes.json().catch(() => ({}));
        return NextResponse.json(
          { error: errJson.message || 'Lỗi yêu cầu từ backend', code: errJson.code },
          { status: springRes.status }
        );
      }
    } catch {
      // Backend not reachable, fall back smoothly to local OpenAI handling below
    }
  }

  // 7. Server OpenAI API Key validation (for local handling fallback)
  const serverApiKey = process.env.OPENAI_API_KEY;
  if (!serverApiKey || !serverApiKey.trim()) {
    return NextResponse.json(
      {
        error:
          'OpenAI API Key chưa được cấu hình trên máy chủ. Vui lòng thiết lập biến môi trường OPENAI_API_KEY.',
      },
      { status: 500 }
    );
  }

  const normalizedAction = body.action === 'extractFrontMatter' ? 'metadata' : body.action;

  // 8. Model selection (whitelist only)
  const requestedModel = body.model as any;
  const selectedModel = ALLOWED_MODELS.includes(requestedModel)
    ? requestedModel
    : DEFAULT_MODEL;

  // 9. Construct strictly server-defined prompts (no arbitrary user prompts allowed)
  try {
    if (normalizedAction === 'table') {
      const tableContent = (tableText || text).slice(0, 10000);
      const tablePrompt = `Bạn là chuyên gia trích xuất dữ liệu khoa học. Hãy phân tích đoạn văn bản chứa bảng sau và trả về đúng định dạng JSON:
{
  "caption": "Tiêu đề bảng (ví dụ: Bảng 1: Các xét nghiệm chẩn đoán...)",
  "headers": ["Tên cột 1", "Tên cột 2", ...],
  "rows": [
    ["Giá trị ô 1", "Giá trị ô 2", ...],
    ["Giá trị ô 3", "Giá trị ô 4", ...]
  ]
}

Nội dung bảng:
${tableContent}`;

      const aiResponse = await callOpenAi(serverApiKey.trim(), selectedModel, tablePrompt);
      return NextResponse.json({ success: true, data: aiResponse });
    }

    if (normalizedAction === 'suggestKeywords') {
      const content = text.slice(0, 10000);
      const keywordsPrompt = `Bạn là chuyên gia biên tập học thuật của Đại học Quốc gia TP.HCM. Hãy đề xuất 5-8 từ khóa tiếng Việt và tiếng Anh cho nội dung bài báo sau.
Trả về định dạng JSON:
{
  "keywords": ["từ khóa 1", "từ khóa 2"],
  "keywordsEn": ["keyword 1", "keyword 2"]
}

Nội dung:
${content}`;
      const aiResponse = await callOpenAi(serverApiKey.trim(), selectedModel, keywordsPrompt);
      return NextResponse.json({ success: true, data: aiResponse });
    }

    if (normalizedAction === 'refineAbstract') {
      const content = text.slice(0, 10000);
      const refinePrompt = `Bạn là chuyên gia biên tập học thuật của Đại học Quốc gia TP.HCM. Hãy trau chuốt và chuẩn hóa đoạn tóm tắt khoa học sau:
Trả về định dạng JSON:
{
  "original": "${content}",
  "refined": "Đoạn tóm tắt đã được trau chuốt...",
  "improvements": ["cải tiến 1", "cải tiến 2"]
}

Tóm tắt:
${content}`;
      const aiResponse = await callOpenAi(serverApiKey.trim(), selectedModel, refinePrompt);
      return NextResponse.json({ success: true, data: aiResponse });
    }

    if (normalizedAction === 'fixGrammar') {
      const content = text.slice(0, 10000);
      const fixPrompt = `Bạn là chuyên gia hiệu đính học thuật của Đại học Quốc gia TP.HCM. Hãy kiểm tra và sửa lỗi ngữ pháp, chính tả cho văn bản sau:
Trả về định dạng JSON:
{
  "original": "${content}",
  "correctedText": "Văn bản đã sửa...",
  "correctionsCount": 1,
  "corrections": [{"type": "spelling/grammar", "original": "từ sai", "replacement": "từ đúng", "reason": "lý do"}]
}

Văn bản:
${content}`;
      const aiResponse = await callOpenAi(serverApiKey.trim(), selectedModel, fixPrompt);
      return NextResponse.json({ success: true, data: aiResponse });
    }

    // Default: 'metadata' (or 'extractFrontMatter', 'extractMetadata')
    const metadataContent = text.slice(0, 10000);
    const metadataPrompt = `Bạn là chuyên gia biên tập xuất bản của Đại học Quốc gia Thành phố Hồ Chí Minh (VNUHCM).
Hãy phân tích phần đầu bản thảo khoa học sau và trích xuất cấu trúc dữ liệu JSON chính xác 100%:

{
  "title": "Tiêu đề tiếng Việt chính của bài báo (không bao gồm tên tạp chí, số trang, ngày tháng)",
  "titleEn": "Tiêu đề tiếng Anh (nếu có trong bài, nếu không có để chuỗi rỗng '')",
  "articleType": "Bài nghiên cứu HOẶC Bài tổng quan",
  "journalId": "Một trong 7 mã định danh sau (chọn chính xác theo lĩnh vực chuyên môn):
    - VNUHCM-ARNS: Khoa học Tự nhiên (Toán, Vật lý, Hóa học, Sinh học...)
    - VNUHCM-EBL: Kinh tế, Quản trị, Luật
    - VNUHCM-EES: Khoa học Trái đất & Môi trường, Khí tượng Thủy văn
    - VNUHCM-HS: Khoa học Sức khỏe, Y học, Dược học, Nha khoa
    - VNUHCM-SSH: Khoa học Xã hội và Nhân văn, Văn học, Lịch sử, Ngôn ngữ
    - VNUHCM-ET: Kỹ thuật & Công nghệ (Xây dựng, Cơ khí, Điện tử, CNTT...)
    - VNUHCM-STDJ: Khoa học & Công nghệ tổng hợp",
  "authors": [
    {
      "name": "Họ và tên tác giả (chuẩn hóa tiếng Việt, bỏ số mũ)",
      "affiliationIds": [1],
      "isCorresponding": true/false
    }
  ],
  "affiliations": [
    {
      "id": 1,
      "name": "Tên đầy đủ của Viện, Trường, Khoa, Bộ môn hoặc Đơn vị công tác"
    }
  ],
  "corresponding": {
    "name": "Tên tác giả liên hệ",
    "email": "Email liên hệ chính xác",
    "affiliation": "Đơn vị tác giả liên hệ"
  },
  "abstract": "Nội dung Tóm tắt tiếng Việt",
  "abstractEn": "Nội dung Abstract tiếng Anh (nếu có, không có để '')",
  "keywords": ["Từ khóa tiếng Việt 1", "Từ khóa 2"],
  "keywordsEn": ["Keyword tiếng Anh 1", "Keyword 2"],
  "dates": {
    "received": "Ngày nhận bài (DD-MM-YYYY nếu có)",
    "revised": "Ngày chỉnh sửa (nếu có)",
    "accepted": "Ngày chấp nhận (nếu có)",
    "published": "Ngày đăng (nếu có)"
  },
  "volume": "Tập (nếu có trong header)",
  "issue": "Số (nếu có trong header)",
  "year": "Năm (nếu có trong header)",
  "doi": "Mã DOI (nếu có trong header)",
  "firstPage": 1,
  "lastPage": 10
}

Văn bản bản thảo:
${metadataContent}`;

    const aiResponse = await callOpenAi(serverApiKey.trim(), selectedModel, metadataPrompt);
    return NextResponse.json({ success: true, data: aiResponse });
  } catch (error: any) {
    console.error('Error in /api/ai/proxy:', error);
    return NextResponse.json(
      { error: error.message || 'Lỗi xử lý trích xuất qua OpenAI API' },
      { status: 500 }
    );
  }
}

async function callOpenAi(apiKey: string, model: string, userPrompt: string): Promise<any> {
  const payload = {
    model: model || DEFAULT_MODEL,
    messages: [
      {
        role: 'system',
        content:
          'Bạn là chuyên gia biên tập học thuật của Đại học Quốc gia TP.HCM. Luôn trả lời bằng định dạng JSON hợp lệ duy nhất, không kèm markdown backticks thừa.',
      },
      {
        role: 'user',
        content: userPrompt,
      },
    ],
    response_format: { type: 'json_object' },
    max_completion_tokens: 3500,
  };

  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const errText = await res.text();
    // Fallback attempt: If primary model encounters an error, try gpt-4o-mini
    if (model !== 'gpt-4o-mini') {
      console.warn(`Calling ${model} failed (${res.status}), attempting fallback to gpt-4o-mini...`);
      return callOpenAi(apiKey, 'gpt-4o-mini', userPrompt);
    }
    throw new Error(`OpenAI API Lỗi (${res.status}): ${errText}`);
  }

  const json = await res.json();
  const rawContent = json.choices?.[0]?.message?.content || '{}';
  return JSON.parse(rawContent);
}
