# OCR 골든셋 (Golden Set) 테스트 이미지 디렉터리

이 폴더는 `ocr-engine`의 인식률이 원본 `screenshotMacro`와 100% 동일한지 검증(패리티 및 정확도 테스트)하기 위한 스크린샷 보관소입니다.
- **Git 커밋 제외**: 이미지 용량 및 개인 캡처 보호를 위해 `.gitignore`에 의해 `*.png`, `*.jpg`, `*.jpeg`, `*.webp` 파일은 Git에 커밋되지 않습니다.

## 파일 배치 규칙
1. **단일 이미지 테스트**:
   - 학생 상세(`student_info`), 장비 모달(`equipment_modal`), 애용품 팝업(`favorite_popup`) 스크린샷을 이 폴더에 자유롭게 넣어두면 테스트 러너가 자동으로 스캔하여 원본 `extractor.extract_screenshot_data()` 결과와 대조합니다.
2. **세트(학생 1명 풀세트) 테스트**:
   - 하위 폴더(예: `ocr-engine/tests/golden/hanako_swimsuit/`)를 만들고 아래 파일명으로 넣으면 5슬롯 병합 테스트로 실행됩니다.
     - `main.png` (필수: 학생 상세 정보)
     - `equip1.png`, `equip2.png`, `equip3.png` (장착 슬롯만 선택 배치: 장비 메뉴 모달)
     - `favorite.png` (선택: 애용품 팝업)
     - `expected.json` (선택: 정답 라벨 JSON, 없을 경우 원본 `screenshotMacro` 추출값을 정답 기준으로 삼아 패리티 비교)
