import { NextRequest, NextResponse } from 'next/server';
import { DEFAULT_STUDENT_OCR_PROMPT, RECOMMENDED_MODELS, NVIDIA_BASE_URL } from '@/lib/ocr/prompts';
import { extractJsonObject, normalizeOcrData } from '@/lib/ocr/studentOcrParser';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 180; // 180초 비전 추론 타임아웃 지원

interface SseParsedResult {
  content: string;
  reasoning: string;
  usage: { prompt_tokens: number; completion_tokens: number; total_tokens: number };
  streamError?: string;
}

async function parseSseStream(response: Response, signal?: AbortSignal): Promise<SseParsedResult> {
  const reader = response.body?.getReader();
  if (!reader) {
    throw new Error('응답 스트림을 읽을 수 없습니다.');
  }

  const decoder = new TextDecoder('utf-8');
  let buffer = '';
  let content = '';
  let reasoning = '';
  let streamError: string | undefined;
  const usage = { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 };

  const processLine = (rawLine: string): boolean => {
    const line = rawLine.trim();
    if (!line || line.startsWith(':')) return false;
    if (!line.startsWith('data:')) return false;

    const dataStr = line.slice(5).trim();
    if (dataStr === '[DONE]') {
      return true; // Finished
    }

    try {
      const chunk = JSON.parse(dataStr);
      if (chunk.error) {
        const errMsg =
          typeof chunk.error === 'string'
            ? chunk.error
            : chunk.error.message || chunk.error.detail || JSON.stringify(chunk.error);
        streamError = `NVIDIA NIM 스트림 오류: ${errMsg}`;
      }
      if (chunk.usage) {
        usage.prompt_tokens = Number(chunk.usage.prompt_tokens || usage.prompt_tokens);
        usage.completion_tokens = Number(chunk.usage.completion_tokens || usage.completion_tokens);
        usage.total_tokens = Number(chunk.usage.total_tokens || usage.total_tokens);
      }

      const choice = chunk.choices?.[0];
      const delta = choice?.delta;

      // Extract reasoning content (handles string or array of parts)
      let rPiece = '';
      if (delta) {
        const rawR = delta.reasoning_content ?? delta.reasoning;
        if (typeof rawR === 'string') {
          rPiece = rawR;
        } else if (Array.isArray(rawR)) {
          rPiece = rawR.map((part: any) => part?.text || '').join('');
        }
      }
      if (rPiece) reasoning += rPiece;

      // Extract text content (handles string, array of text parts, or completion text fallback)
      let cPiece = '';
      if (delta) {
        if (typeof delta.content === 'string') {
          cPiece = delta.content;
        } else if (Array.isArray(delta.content)) {
          cPiece = delta.content.map((part: any) => part?.text || '').join('');
        } else if (typeof delta.text === 'string') {
          cPiece = delta.text;
        }
      } else if (typeof choice?.text === 'string') {
        cPiece = choice.text;
      }

      if (cPiece) content += cPiece;
    } catch {
      // SSE chunk parsing failure: ignore malformed chunk
    }
    return false;
  };

  while (true) {
    if (signal?.aborted) {
      reader.cancel();
      throw new Error('요청이 취소되었습니다.');
    }

    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';

    for (const rawLine of lines) {
      if (processLine(rawLine)) {
        return { content, reasoning, usage, streamError };
      }
    }
  }

  // Flush remaining buffer at stream end to prevent trailing token truncation
  if (buffer.trim()) {
    const remainingLines = buffer.split('\n');
    for (const rawLine of remainingLines) {
      if (processLine(rawLine)) {
        return { content, reasoning, usage, streamError };
      }
    }
  }

  return { content, reasoning, usage, streamError };
}

export async function POST(req: NextRequest) {
  try {
    if (req.signal?.aborted) {
      return NextResponse.json(
        { success: false, error: '클라이언트에 의해 요청이 취소되었습니다.' },
        { status: 499 }
      );
    }

    let body: any;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json(
        { success: false, error: '잘못된 JSON 요청 본문입니다.' },
        { status: 400 }
      );
    }

    if (!body || typeof body !== 'object') {
      return NextResponse.json(
        { success: false, error: '요청 본문이 올바른 객체 형태가 아닙니다.' },
        { status: 400 }
      );
    }

    const {
      image,
      apiKey: customApiKey,
      model: requestedModel,
      prompt: customPrompt,
      temperature = 0.0,
      reasoningEffort = 'low',
    } = body;

    // 1. 이미지 유효성 검사
    const rawImage = typeof image === 'string' ? image.trim() : '';
    if (!rawImage) {
      return NextResponse.json(
        { success: false, error: '유효한 이미지 데이터(Base64 Data URL)가 전송되지 않았습니다.' },
        { status: 400 }
      );
    }

    if (!rawImage.startsWith('data:image/')) {
      return NextResponse.json(
        { success: false, error: '이미지 형식이 올바르지 않습니다. (data:image/... 형식이 필요합니다)' },
        { status: 400 }
      );
    }

    // 2. API Key 해결: 요청 본문 / 헤더 > 서버 환경 변수 (따옴표 및 공백 정리)
    const headerApiKey = req.headers.get('x-api-key');
    const rawApiKey = (customApiKey || headerApiKey || process.env.NVIDIA_API_KEY || '').trim();
    const apiKey = rawApiKey.replace(/^["']|["']$/g, '').trim();

    if (!apiKey) {
      return NextResponse.json(
        {
          success: false,
          error:
            'NVIDIA API Key가 설정되지 않았습니다. client/.env.local 파일에 NVIDIA_API_KEY를 등록하거나 모달의 API Key 필드에 입력해주세요.',
        },
        { status: 401 }
      );
    }

    const model = requestedModel || RECOMMENDED_MODELS[0];
    const prompt = customPrompt || DEFAULT_STUDENT_OCR_PROMPT;

    // 3. 재시도 가능한 요청 실행 (모델별 NVIDIA Build 공식 문서 규격 및 스트림 호환성 대응)
    const isDeepSeek = model.toLowerCase().includes('deepseek');
    const isMistral = model.toLowerCase().includes('mistral');

    let activeEffort: string | undefined =
      isMistral && ['low', 'medium', 'high'].includes(reasoningEffort)
        ? reasoningEffort
        : undefined;
    let useDeepSeekThinking = isDeepSeek;
    let includeUsage = !isDeepSeek; // DeepSeek NIM 엔드포인트는 공식 규격에 맞춰 stream_options 제외
    let sseResult: SseParsedResult | null = null;
    let lastError: Error | null = null;

    // 모델별 공식 권장 Temperature / Top_P 기본값 적용 (명시적 커스텀 값이 없을 때)
    const hasCustomTemp = typeof body.temperature === 'number' && !isNaN(body.temperature);
    const cleanTemp = hasCustomTemp
      ? Math.max(0, Math.min(2, body.temperature))
      : isMistral
      ? 0.15
      : 0.1;
    const cleanTopP = isDeepSeek ? 0.95 : 1.0;

    for (let attempt = 0; attempt < 3; attempt++) {
      if (req.signal?.aborted) {
        return NextResponse.json(
          { success: false, error: '클라이언트에 의해 요청이 취소되었습니다.' },
          { status: 499 }
        );
      }

      const controller = new AbortController();
      const onClientAbort = () => controller.abort();
      if (req.signal) {
        req.signal.addEventListener('abort', onClientAbort, { once: true });
      }
      const timeoutId = setTimeout(() => controller.abort(), 160000); // 160s client timeout

      try {
        const payload: Record<string, any> = {
          model,
          messages: [
            {
              role: 'user',
              content: [
                { type: 'text', text: prompt },
                { type: 'image_url', image_url: { url: rawImage } },
              ],
            },
          ],
          temperature: cleanTemp,
          top_p: cleanTopP,
          max_tokens: 8192,
          stream: true,
        };

        if (activeEffort) {
          payload.reasoning_effort = activeEffort;
        }
        if (useDeepSeekThinking) {
          payload.chat_template_kwargs = { enable_thinking: true };
        }
        if (includeUsage) {
          payload.stream_options = { include_usage: true };
        }

        const resp = await fetch(NVIDIA_BASE_URL, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
            Accept: 'text/event-stream, application/json',
          },
          body: JSON.stringify(payload),
          signal: controller.signal,
        });

        clearTimeout(timeoutId);
        if (req.signal) {
          req.signal.removeEventListener('abort', onClientAbort);
        }

        if (!resp.ok) {
          const errBody = await resp.text().catch(() => '');
          const lowerBody = errBody.toLowerCase();

          // 1) 비추론 모델이 reasoning_effort 파라미터를 거부한 경우 제외 후 재시도
          if (
            (resp.status === 400 || resp.status === 422) &&
            activeEffort &&
            (lowerBody.includes('reasoning') || lowerBody.includes('extra') || lowerBody.includes('unrecognized'))
          ) {
            activeEffort = undefined;
            continue;
          }

          // 2) stream_options 미지원 모델인 경우 제외 후 재시도
          if (
            (resp.status === 400 || resp.status === 422) &&
            includeUsage &&
            (lowerBody.includes('stream_options') || lowerBody.includes('usage') || lowerBody.includes('extra'))
          ) {
            includeUsage = false;
            continue;
          }

          // 3) chat_template_kwargs 미지원 시 제외 후 재시도
          if (
            (resp.status === 400 || resp.status === 422) &&
            useDeepSeekThinking &&
            (lowerBody.includes('chat_template') || lowerBody.includes('thinking') || lowerBody.includes('extra'))
          ) {
            useDeepSeekThinking = false;
            continue;
          }

          if (resp.status === 401 || resp.status === 403) {
            return NextResponse.json(
              {
                success: false,
                error: 'NVIDIA API Key가 유효하지 않거나 권한이 없습니다. API Key를 확인해주세요.',
                details: errBody,
              },
              { status: 401 }
            );
          }

          if (resp.status === 413 || lowerBody.includes('payload too large') || lowerBody.includes('request entity too large')) {
            return NextResponse.json(
              {
                success: false,
                error: '전송된 이미지 용량이 너무 큽니다. 더 작은 크기의 이미지를 업로드해주세요.',
                details: errBody,
              },
              { status: 413 }
            );
          }

          if (resp.status === 429) {
            return NextResponse.json(
              {
                success: false,
                error: 'NVIDIA NIM API 호출 속도 제한(Rate Limit)에 도달했습니다. 잠시 후 다시 시도해주세요.',
                details: errBody,
              },
              { status: 429 }
            );
          }

          throw new Error(`NVIDIA API HTTP ${resp.status}: ${resp.statusText || errBody}`);
        }

        const contentType = resp.headers.get('content-type') || '';
        if (contentType.includes('application/json') && !contentType.includes('event-stream')) {
          const jsonResp = await resp.json();
          const choice = jsonResp.choices?.[0]?.message;
          sseResult = {
            content: choice?.content || '',
            reasoning: choice?.reasoning_content || '',
            usage: {
              prompt_tokens: jsonResp.usage?.prompt_tokens || 0,
              completion_tokens: jsonResp.usage?.completion_tokens || 0,
              total_tokens: jsonResp.usage?.total_tokens || 0,
            },
          };
        } else {
          sseResult = await parseSseStream(resp, controller.signal);
        }

        // 스트림 내부에서 에러 이벤트(data: {"error": ...})만 내려오고 유효한 텍스트가 없는 경우 재시도
        if (sseResult.streamError && !sseResult.content.trim() && !sseResult.reasoning.trim()) {
          lastError = new Error(sseResult.streamError);
          sseResult = null;
          if (attempt < 2) {
            continue;
          }
        }
        break;
      } catch (err: any) {
        clearTimeout(timeoutId);
        if (req.signal) {
          req.signal.removeEventListener('abort', onClientAbort);
        }
        const causeMsg = err?.cause?.message || err?.cause?.code || '';
        lastError = causeMsg ? new Error(`${err.message} (${causeMsg})`) : err;

        if (req.signal?.aborted) {
          return NextResponse.json(
            { success: false, error: '클라이언트에 의해 요청이 취소되었습니다.' },
            { status: 499 }
          );
        }

        if (err.name === 'AbortError' || String(causeMsg).includes('TIMEOUT')) {
          return NextResponse.json(
            {
              success: false,
              error: '비전 모델 처리 시간이 초과되었습니다. 잠시 후 다시 시도하거나 다른 비전 모델을 선택해주세요.',
            },
            { status: 504 }
          );
        }
        // If not recoverable param mismatch, break loop
        if (attempt === 2) break;
      }
    }

    if (!sseResult) {
      return NextResponse.json(
        {
          success: false,
          error: lastError?.message || 'NVIDIA NIM API와의 통신에 실패했습니다.',
        },
        { status: 502 }
      );
    }

    const targetText =
      sseResult.content && sseResult.content.trim() ? sseResult.content : sseResult.reasoning;
    if (!targetText || !targetText.trim()) {
      return NextResponse.json(
        {
          success: false,
          error: sseResult.streamError || '모델이 비어 있는 텍스트 응답을 반환했습니다.',
        },
        { status: 502 }
      );
    }

    // 4. JSON 파싱 및 학생 스펙 정규화
    let extractedDict: Record<string, any>;
    try {
      extractedDict = extractJsonObject(targetText);
    } catch (parseErr: any) {
      // reasoning 모델이 content 대신 reasoning_content에 유효한 JSON을 남긴 경우 폴백 시도
      if (sseResult.reasoning && sseResult.reasoning.trim() && sseResult.reasoning !== targetText) {
        try {
          extractedDict = extractJsonObject(sseResult.reasoning);
        } catch {
          return NextResponse.json(
            {
              success: false,
              error: `응답에서 학생 스펙 JSON 구조를 해석하지 못했습니다: ${parseErr.message}`,
              rawResponse: targetText,
            },
            { status: 422 }
          );
        }
      } else {
        return NextResponse.json(
          {
            success: false,
            error: `응답에서 학생 스펙 JSON 구조를 해석하지 못했습니다: ${parseErr.message}`,
            rawResponse: targetText,
          },
          { status: 422 }
        );
      }
    }

    const normalizedData = normalizeOcrData(extractedDict);

    return NextResponse.json({
      success: true,
      data: normalizedData,
      rawContent: sseResult.content,
      reasoning: sseResult.reasoning,
      usage: sseResult.usage,
      model,
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        success: false,
        error: error?.message || '학생 OCR 처리 도중 서버 내부 오류가 발생했습니다.',
      },
      { status: 500 }
    );
  }
}
