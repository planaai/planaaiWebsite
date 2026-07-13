#  Plana.AI

프라나 AI는 블루 아카이브(Blue Archive) IP를 기반으로 한 다목적 유틸 사이트입니다.
현재 이 사이트는 아직 개발 단계에 있으며 버그들이 난무하고 잘못된 정보가 기재되어 있을 수 있습니다.

<img width="100%" alt="Plana.AI Main" src="https://github.com/user-attachments/assets/a3e28cdb-3ad4-465a-a58c-2ea75512b0cc" />

현재 구현 완료되었거나 개발 중인 기능은 **총 11개**입니다.
---

##  알려진 이슈 (Known Issues)

1. **이미지 리소스 미완료 이슈**
2. **선물 도감 미완료**: 고급 선물 5개 등록 안됨

---

##  주요 기능 안내 (Features)

### 1. Collection || 컬렉션
<img width="49%" alt="Collection 1" src="https://github.com/user-attachments/assets/f004dc51-9808-4acb-b3e2-9db3dba6697d" /> <img width="49%" alt="Collection 2" src="https://github.com/user-attachments/assets/3be6efce-25fa-40d4-9b09-3bd5ba479239" />

이 사이트의 핵심 기능인 **육성 컬렉션**입니다.
* 본인의 육성 상태를 확인하거나, 새로운 학생을 등록할 수 있으며 서버에 본인의 육성 데이터를 저장하고 불러올 수 있습니다. *(서버 저장 기능은 로그인이 필요합니다)*
* 또한 **상세 정보 -> 모의 육성** 탭에서 스킬 육성을 시뮬레이션할 수 있습니다.

### 2. Catalog || 도감
<img width="49%" alt="Catalog 1" src="https://github.com/user-attachments/assets/757a6da7-4fc6-4ea8-beb4-7bb427ccd2aa" /> <img width="49%" alt="Catalog 2" src="https://github.com/user-attachments/assets/a715665b-0cb8-45c5-a26a-74e8a7322d90" />

이 사이트의 두 번째 기능인 **도감**입니다.
* 도감을 통해서 학생의 스킬과 레벨별 배율, 전용무기와 애용품 강화 스킬, 착용하는 장비의 종류와, 선호하는 선물을 확인할 수 있습니다.
* **모의 육성** 탭에서 처음부터 스킬을 모의로 육성해볼 수 있습니다.

### 3. 선물 || Gifts
<img width="100%" alt="Gifts" src="https://github.com/user-attachments/assets/dc6b728d-7fdd-427c-8be6-253bbcdf47cb" />

선물의 정보를 담고 있는 **선물 도감**입니다.
* 선물 도감을 통해서 각 선물마다 좋아하는 학생을 찾아볼 수 있습니다.

### 4. 모의 가챠 || Mock Gacha
<img width="100%" alt="Mock Gacha" src="https://github.com/user-attachments/assets/fdc71e20-95aa-4f87-9243-6257d4759a68" />

말 그대로 **가챠를 모의로 하는 시스템**입니다.
* 아로나라는 나쁜 AI 선배에게 소중한 청휘석을 강탈당하지 않도록 액땜을 할 수 있는 기능입니다.
* 확률은 픽업에 있는 확률표를 따라가며, 픽업 갱신은 픽업 오픈일 기준 서버 점검이 끝나는 시간에 맞춰 갱신됩니다.

### 5. 플래너 || Training Notes
<img width="100%" alt="Training Notes 1" src="https://github.com/user-attachments/assets/5e3a0a02-217a-44dd-a1c3-b9a6c608b3c8" />
<img width="49%" alt="Training Notes 2" src="https://github.com/user-attachments/assets/2708e4c6-a6f6-42c5-b878-7817b0bf5c65" /> <img width="49%" alt="Training Notes 3" src="https://github.com/user-attachments/assets/d1a3ccae-ba2e-46cc-b22a-a9559a2e8582" />

선생님의 컬렉션을 바탕으로 특정 학생 혹은 여러 학생을 육성할 때 **필요한 재화를 확인**할 수 있는 기능입니다.

### 6. 모의 편성 || Mock Formation
<img width="1853" height="839" alt="image" src="https://github.com/user-attachments/assets/f658ea88-21bf-4806-aea5-09cc3896ead6" />


Plana.AI에 등록된 선생님의 컬렉션과 도감에 등록되어 있는 DB를 바탕으로 **모의로 편성을 할 수 있는 기능**입니다.
* 실제 상황에 더 알맞게 쓸 수 있게끔 **총력전/대결전**과 **제약해제결전 편성모드**가 따로 존재합니다.
* 부대를 각 모드별 **최대 4개씩** 편성할 수 있으며, 편성 한 결과를 이미지로 추출을 해 다른 선생님들에게 편성을 공유할 수 있습니다.
  

### 7. 청휘석 계산기 || Pyroxene Calculator
<img width="100%" alt="Pyroxene Calculator" src="https://github.com/user-attachments/assets/804392ae-148d-4e19-871f-82ccb751528c" />

시작 날짜와 종료 날짜를 정하고 선생님의 플레이 성향과 어른의 카드 사용량을 기반으로 **얻을 수 있는 예상 청휘석량을 계산**해 주는 사이트입니다.
* **이미지 추출 기능**을 지원하여 계산 결과를 저장할 수 있습니다.

### 8. AP 존버 계산기 || Ap Calculator
<img width="100%" alt="AP Calculator 1" src="https://github.com/user-attachments/assets/7b5d94e5-d738-4aab-adb6-736ae62c66b7" />
<img width="100%" alt="AP Calculator 2" src="https://github.com/user-attachments/assets/f407cd85-31c5-4006-8a9c-f25135dbd141" />

AP 존버 계산기는 오늘부터 계산을 시작한다는 가정하에, 언제부터 종료일까지 **AP 사용량을 조절하는 타임라인**을 짜주는 계산기입니다.
* 이 기능 또한 **이미지 추출 기능**을 지원합니다.

### 9. API || API
* 이 기능은 아직 준비 중에 있습니다.

### 10. 계정 || Account
<img width="49%" alt="Account 1" src="https://github.com/user-attachments/assets/eb66394d-82ba-42d0-8529-1d0408b69f2f" /> <img width="49%" alt="Account 2" src="https://github.com/user-attachments/assets/05f3c0e8-91ad-440d-aa23-5bcf06e9c07a" />
<img width="49%" alt="Account 3" src="https://github.com/user-attachments/assets/378a5443-746a-4ada-977c-6e950ca58afe" /> <img width="49%" alt="Account 4" src="https://github.com/user-attachments/assets/be1689f0-0761-4c51-8cc2-4a7d7a5c4da0" />

서버에 선생님의 육성상태 컬렉션을 저장할 수 있는 핵심 기능인 **계정 시스템**입니다.
* 로그인을 하면 컬렉션에 **'서버와 동기화'**라는 기능이 생기며, 서버에 선생님의 데이터를 저장하거나, 역으로 가져와 덮어쓰기를 합니다.
* 계정 설정에서 선생님의 **UID와 표시될 닉네임**을 변경할 수 있는 기능이 있습니다.
* 회원가입은 **ID와 비밀번호**만 정하시면 됩니다.

---

> 선배처럼 프라나도 선생님을 전력으로 서포트 하겠습니다.
>
> **-** **프라나**
