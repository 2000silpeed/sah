# Software Architect Harness (SAH)

[English](README.md) | [한국어](README.ko.md)

SAH는 코딩 에이전트를 위한 방법론 중립적 설계 추론 하네스입니다. 자연어로 만들 소프트웨어를 설명하면 설치된 host skill이 저장소를 살피고 필요한 질문을 이어가며,
검토 가능한 아키텍처 근거를 기록하고 준비된 작업을 실제로 구현한 뒤 선택한 제약을
코드에서 확인합니다.

한 문장으로 요약하면:

> SAH는 왜 이 설계를 선택했는지, 각 규칙의 책임자는 누구인지, 구현이 무엇을 해야
> 하는지, 그중 무엇을 관찰 가능한 사실로 검증할 수 있는지를 기록합니다.

현재 SAH는 1.0 이전의 로컬 우선 Agent Skill과 TypeScript 검증 커널입니다. GitHub 저장소는 공개되어 있지만 npm 패키지는 private이므로 소스 체크아웃에서 실행합니다.

## 왜 SAH가 필요한가요?

코딩 에이전트는 동작하는 코드를 만들면서도 다음과 같은 비싼 구조적 실수를 할 수
있습니다.

- 모든 서브시스템에 같은 방법론을 적용한다.
- 근거 없이 레이어, 서비스, 인터페이스, 이벤트를 추가한다.
- 경계나 의존성 방향을 정한 이유를 잃어버린다.
- 주관적인 아키텍처 판단을 결정론적 규칙처럼 취급한다.
- 코드를 변경하면서 어떤 이전 결정을 다시 검토해야 하는지 알지 못한다.

SAH는 요구사항과 구현 사이에 근거의 연결 고리를 만듭니다. 하나의 아키텍처 스타일을
강요하지 않습니다. 단순 CRUD 영역은 단순하게 유지하고, 결제·파이프라인·에이전트
영역은 실제 위험이 요구할 때만 더 강한 경계를 사용하게 합니다.

코딩 에이전트가 중요한 구조 변경을 수행하고, 다음 에이전트가 그 결정을 이해하거나
보존해야 할 때 SAH가 유용합니다. 작고 되돌리기 쉬운 저위험 변경에는 short profile을
사용해 문서화 비용을 줄일 수 있습니다.

## 먼저 이해할 네 가지

SAH는 네 가지 대상을 중심으로 작동합니다.

1. **Host Agent Skill** — Codex 또는 Claude Code가 질문·추론·구현·검증에 사용하는
   대화형 workflow입니다.
2. **설계 번들** — 근거, 책임, 불변조건, 아키텍처, 결정, 구현 인수인계를 담은
   스키마 검증 JSON 파일 묶음입니다.
3. **대상 체크아웃** — host agent가 변경하고 검사할 코드가 있는 디렉터리입니다.
4. **라이프사이클** — S0부터 S13까지의 단계입니다. 각 gate가 잘못된 근거가 완료
   상태로 넘어가지 못하게 막습니다.

~~~mermaid
flowchart LR
    A[자연어 요청] --> B[Host skill: 조사하고 질문]
    B --> C0[설계 추론 S0-S12]
    C0 --> C[설계 번들과 구현 인수인계]
    C --> D[sah validate]
    C --> E[대상 구현]
    C --> F[sah verify]
    E --> F
    F --> G[Full verification record]
    G --> H[S13으로 advance]
~~~

이 흐름은 일방향 폭포수가 아닙니다. 나중에 발견한 근거가 이전 가정을 뒤집으면 가장
이른 영향 단계로 돌아가고, 그 이후의 추론을 stale 상태로 다시 검토합니다.

### S0–S13을 다섯 단계로 보기

| 구간 | Stage | 핵심 질문 | 주요 산출물 |
| --- | --- | --- | --- |
| 문제 이해 | S0–S2 | 어떤 문제이며 각 영역에 어떤 전략이 맞는가? | 시스템 특성화와 설계 전략 |
| 책임 배정 | S3–S5 | 어떤 책임과 불변조건이 있고 누가 소유하는가? | Responsibility와 Invariant |
| 아키텍처 설계 | S6–S10 | 어떤 경계·표현·후보가 측정 가능한 품질 요구를 가장 잘 만족하는가? | Architecture와 승인된 Decision |
| 구현 준비 | S11–S12 | 어떤 주장을 검사할 수 있으며 코딩 에이전트는 어떤 순서로 변경해야 하는가? | Constraint와 Implementation Handoff |
| 지속 검증 | S13 | 구현이 승인된 관찰 가능 제약을 계속 만족하는가? | 검증 증거와 라이프사이클 완료 |

각 stage의 입력, gate, 되돌아가는 조건은 [설계 추론 모델](docs/design-reasoning-model.md)이 정의합니다.

## 설계 번들에는 무엇이 들어가나요?

루트 manifest 이름은 sah.bundle.json입니다. 번들 ID, 완료 stage, profile을 기록하며 다음
일곱 개의 의미론적 IR(Intermediate Representation, 중간 표현) 파일을 가리킬 수 있습니다.

| 산출물 | 답하는 질문 |
| --- | --- |
| System Characterization | 범위와 근거는 무엇이고 어떤 품질 시나리오가 중요한가? |
| Design Strategy | 각 문제 영역에 어떤 전략이 맞으며 더 단순한 대안과 결정 반전 조건은 무엇인가? |
| Responsibility | 어떤 결과가 필요하고 왜 변경되며 누구와 협업하는가? |
| Invariant | 무엇이 어느 범위에서 언제까지 참이어야 하며 실패를 어떻게 탐지·복구하는가? |
| Architecture | 어떤 요소, 경계, 관계, 후보, 실행 가능한 제약이 있는가? |
| Architecture Decision | 어떤 선택을 승인했고 어떤 대안을 거절했으며 비용과 재검토 조건은 무엇인가? |
| Implementation Handoff | 에이전트가 어떤 의존 순서로 코드·검사·마이그레이션·롤백을 수행하는가? |

[schemas](schemas/) 아래 JSON Schema가 기계 계약입니다. Markdown과 다이어그램은 이해를
돕지만 JSON을 대신하지 않습니다. 안정적인 ID가 근거 → 전략 → 책임/불변조건 →
아키텍처 → 결정 → 제약 → 구현 slice를 연결합니다.

Manifest와 verification record는 운영 메타데이터이며 의미론적 IR을 추가한 것이
아닙니다. 정확한 소유권은 [구조화 아키텍처 모델](docs/architecture-model.md)을
참고하세요.

## SAH는 무엇을 자동으로 강제할 수 있나요?

SAH는 검증 가능성에 따라 주장을 나눕니다.

| 분류 | 의미 | 자동 hard fail 가능 여부 |
| --- | --- | --- |
| Deterministic | 완전한 관찰 입력과 고정된 판정식이 있음 | 필요한 adapter가 있을 때 가능 |
| Assisted | 사실이 맥락 검토 범위를 좁힘 | 불가, finding만 생성 |
| Judgment | 사람 또는 LLM이 rubric, confidence, 반대 근거를 함께 평가 | 불가, disposition 전까지 pending |

Adapter가 없으면 **unsupported**이며 pass가 아닙니다. 이름 냄새, 추상화 선택, 전략 적합성,
트레이드오프 판단은 규칙처럼 표현하기 쉽다는 이유만으로 결정론적 오류가 되지 않습니다.

현재 실행 가능한 adapter는 다음 두 가지입니다.

- 선언한 대상 상대 경로에 일반 파일이 존재하는지 확인
- 명시적으로 mapping한 TypeScript write symbol의 직접 호출자가 constraint에서 허용한
  아키텍처 element에 속하는지 확인

전체 분류 계약과 한계는 [검증 모델](docs/validation-model.md)에 있습니다.

## 5분 만에 CLI 커널 확인하기

실제 프로젝트에는 아래 대화형 skill을 설치하세요. 이 fixture는 커널 동작만 확인합니다.

### 1. Clone과 설치

Node.js 22 이상과 npm이 필요합니다.

~~~sh
git clone https://github.com/2000silpeed/sah.git
cd sah
npm install
npm run build
~~~

전역 설치는 필요 없습니다. npm exec가 현재 체크아웃에서 빌드한 binary를 실행합니다.

### 2. 예제 설계 번들 검증

~~~sh
npm exec -- sah validate fixtures/simple-crud
~~~

예상 결과는 `equipment-register (S12, short)` 번들의 `SAH validation passed`입니다. Schema,
reference, 저장 stage gate가 통과했다는 뜻이며 아직 대상 코드는 검사하지 않았습니다.

다른 도구나 에이전트가 결과를 읽어야 하면 --json을 추가하세요.

~~~sh
npm exec -- sah validate fixtures/simple-crud --json
~~~

### 3. 예제 TypeScript 대상 검증

~~~sh
npm exec -- sah verify fixtures/simple-crud fixtures/s13-typescript-target --mapping sah.source-map.json
~~~

예상 결과는 equipment-owns-writes constraint의 결정론적 check 하나가 pass하는 것입니다.

`fixtures/simple-crud`는 설계 번들, `fixtures/s13-typescript-target`은 대상이며, 대상 상대
mapping은 source path/symbol을 Architecture element ID와 연결합니다. --record를 지정하지
않은 verify는 읽기 전용입니다.

## Full evidence를 기록하고 S13 완료하기

advance는 sah.bundle.json을 변경합니다. 체크인된 fixture에서 직접 실험하지 말고 복사본을
만드세요.

~~~sh
bundle_root="$(mktemp -d)"
cp -R fixtures/simple-crud "$bundle_root/bundle"

npm exec -- sah verify "$bundle_root/bundle" fixtures/s13-typescript-target --mapping sah.source-map.json --record verification-record.json --json

npm exec -- sah advance "$bundle_root/bundle" S13 --verification-record verification-record.json --json

npm exec -- sah validate "$bundle_root/bundle" --json
~~~

`verify --record`는 전체 결과와 design fingerprint를 저장하고, `advance`는 coverage, byte,
현재 design을 다시 검사한 뒤 S13과 함께 원자적으로 고정합니다. 저장만으로 lifecycle이
진행되지는 않습니다. Schema-valid **full**, passed, current, complete-coverage record만
S12→S13을 승인할 수 있습니다.

### Changed-scoped 검증은 빠른 피드백용입니다

명시한 대상 상대 경로가 영향을 주는 slice의 constraint만 실행하려면 --changed를
사용합니다.

~~~sh
npm exec -- sah verify fixtures/simple-crud fixtures/s13-typescript-target --mapping sah.source-map.json --changed src/equipment-operations/save-equipment.ts --json
~~~

SAH는 Git 상태를 읽지 않습니다. 변경된 모든 경로를 직접 전달해야 합니다. 경로가
mapping되지 않았거나 모호하거나 선언한 source root 밖이면 full-fallback으로 확장됩니다.

선택한 check가 모두 pass하거나 fallback이 전체 check를 실행했더라도 호출 자체는 여전히
change-scoped evidence입니다. S13 완료 증거가 될 수 없습니다. --changed 없이 새로운 full
verification을 실행해야 합니다.

## CLI 빠른 참조

| 명령 | 용도 | 파일 변경 |
| --- | --- | --- |
| sah validate BUNDLE | 저장된 lifecycle stage 기준으로 번들 검증 | 없음 |
| sah verify BUNDLE TARGET | 번들 검증 후 대상 fact 검사 | --record가 없으면 없음 |
| sah advance BUNDLE STAGE | 정확히 다음 gate를 검증하고 lifecycle을 원자적으로 변경 | 성공한 경우에만 있음 |

Advance는 정방향으로 정확히 한 stage만 이동합니다. 현재 실행 가능한 target gate는
S5부터 S13까지입니다.

CLI exit code:

| Exit | 의미 |
| ---: | --- |
| 0 | Validation 통과, advance commit 완료, 또는 선택한 verification check 전체 통과 |
| 1 | 유효한 입력에 validation/gate 결함이 있거나 advance가 blocked되었거나 deterministic constraint 위반 |
| 2 | 호출/운영 실패 또는 review, blocker, unsafe binding, adapter가 남아 verification incomplete |

정확한 문법, option, result envelope, 전이 규칙, 경로 제한, adapter 범위, 원자성은
[Validation CLI and Library](docs/validation-cli.md)가 소유합니다.

## 대화형 skill 설치하기

5분 확인에서 만든 clone이 **SAH checkout**이고, 실제 앱은 별도의 **target checkout**입니다.
전체 SAH clone을 유지하세요. Skill은 workflow를 제공하고 `schemas/`와 빌드된 CLI는
결정론적 검증을 담당합니다. `skills/sah`만 복사하면 둘의 연결이 끊어집니다.

아래 명령을 위해 clone의 절대 경로를 지정합니다.

~~~sh
SAH_CHECKOUT=/absolute/path/to/sah
~~~

### Codex

모든 프로젝트에서 사용할 user skill은 Codex 공식 사용자 경로에 연결합니다.

~~~sh
mkdir -p ~/.agents/skills
ln -s "$SAH_CHECKOUT/skills/sah" ~/.agents/skills/sah
~~~

한 target에서만 쓸 때는 안에서 실행하되 이 machine-local link를 commit하지 마세요.

~~~sh
mkdir -p .agents/skills
ln -s "$SAH_CHECKOUT/skills/sah" .agents/skills/sah
~~~

먼저 `ls -ld`로 목적지를 확인하세요. 이미 존재하면 `ln`을 다시 실행하거나 덮어쓰지
마세요. Directory symlink를 목적지로 다시 연결하면 의도하지 않은 중첩 self-link가 생길
수 있습니다. Codex는 보통 변경을 자동 감지하며, 보이지 않으면 재시작하세요. `/skills`로
발견 여부를 보고 prompt에서 `$sah`를 입력해 명시적으로 호출할 수 있습니다. 이 경로와
호출 방식은 [OpenAI 공식 문서](https://developers.openai.com/codex/skills)를 따릅니다.

### Claude Code

Personal 또는 target-local 위치 중 하나를 사용합니다.

~~~sh
# Personal:
mkdir -p ~/.claude/skills
ln -s "$SAH_CHECKOUT/skills/sah" ~/.claude/skills/sah

# 또는 target checkout에서:
mkdir -p .claude/skills
ln -s "$SAH_CHECKOUT/skills/sah" .claude/skills/sah
~~~

`/sah` 또는 `sah` skill을 명시한 자연어 요청으로 호출합니다.

### Skill과 runtime 함께 확인하기

Codex user 설치라면 `realpath ~/.agents/skills/sah`가 `$SAH_CHECKOUT/skills/sah`를 출력해야
합니다. 다음으로 SAH checkout에서 전역 설치가 아닌 CLI를 확인합니다.

~~~sh
cd "$SAH_CHECKOUT"
npm exec -- sah validate fixtures/simple-crud
~~~

## 신규 프로젝트에 적용하기

Codex 또는 Claude Code에서 **target checkout**을 열고 결과, 저장소 맥락, hard constraint,
완료 조건을 자연어로 알려주세요. JSON을 직접 설계하거나 architecture pattern을 먼저
고를 필요는 없습니다.

~~~text
$sah를 사용해서 예약 기능을 end-to-end로 만들어줘.

먼저 이 저장소의 요구사항, 테스트, Git 상태를 읽어. Scope, invariant, ownership,
security, recovery, 비용이 큰 architecture 선택을 바꿀 수 있는 정보가 없으면 한 번에
한두 가지씩 계속 질문하고, 모르는 제품 정책은 추측하지 마.

기존 public boundary를 보존하고 hosted service를 추가하거나 허락 없이 push하지 마.
Ready slice 구현, target test 통과, full SAH evidence 기록, 근거가 허용하는 lifecycle
advance, 최종 diff review까지 완료해.
~~~

Host agent는 다음 순서로 진행합니다.

1. 질문 전에 저장소를 조사하고 중요한 불확실성이 남아 있을 때만 질문을 이어갑니다.
2. 문제 영역을 특성화하고 가장 단순한 credible architecture 대안을 비교합니다.
3. `.sah/design`을 만들고 S0–S12를 순서대로 검증하며 미해결 결정은 proposed로 둡니다.
4. 의존 순서상 ready인 slice만 구현하고 target 자체 검사를 실행합니다.
5. Changed 검증은 피드백에 쓰고, S13 후보에는 새로운 full evidence를 사용합니다.
6. Deterministic result, assisted finding, judgment item, unsupported coverage를 분리해 보고합니다.

“모르겠다”고 답해도 됩니다. SAH는 불확실성과 해결 authority를 기록하고 안전한 owned
seam이 있을 때만 관련 작업을 막습니다. 중요한 작업은 full profile을, 되돌리기 쉽고
로컬인 저위험 작업에만 short profile을 사용합니다.

에이전트가 skill에는 schema나 CLI가 없다고 말하면 detached copy를 찾았거나 symlink의
실제 경로를 해석하지 못한 것입니다. 다음처럼 알려주세요. “Canonical SAH checkout은
`/absolute/path/to/sah`야. 해당 경로의 schema를 사용하고 그곳에서 절대 target/bundle
경로로 `npm exec -- sah`를 실행해. 새로 다운로드하지 마.” Update, 제거, troubleshooting은
[Codex·Claude Code 상세 가이드](docs/agent-skill.md)를 참고하세요.

같은 경계는 `validateBundle`, `verifyBundle`, `advanceBundle`로도 제공됩니다. 아직 npm에
게시되지 않았으며 [Validation CLI and Library](docs/validation-cli.md)가 계약을 소유합니다.

## 실패 결과 읽는 법

먼저 status를 보고 diagnostic 또는 check code를 확인하세요.

- **violations / exit 1** — 입력을 정상적으로 읽었지만 schema, gate, reference, 대상
  fact와 모순됩니다. expected와 repair를 따라가세요.
- **incomplete / exit 2** — review, blocker, adapter, 지원하지 않는 source form 때문에
  pass/violation을 정직하게 결론 낼 수 없습니다.
- **operational-error / exit 2** — 호출, 경로 안전성, I/O, parsing, 설정에 실패했습니다.
  아키텍처를 해석하기 전에 실행 문제부터 고치세요.
- **blocked / exit 1** — 다음 stage 후보를 평가했지만 gate를 통과하지 못했습니다.
  Manifest는 이전 stage에 그대로 남습니다.

초보자가 자주 하는 실수:

- 체크인된 fixture에서 advance 실행
- --changed가 Git 상태를 자동으로 읽는다고 가정
- changed-scoped pass를 S13 완료 증거로 사용
- TypeScript source-graph constraint에서 --mapping 누락
- unsupported를 pass로 해석
- canonical JSON은 모순된 채 Markdown만 수정
- lifecycle stage 건너뛰기

## 저장소 구조

- [schemas](schemas/) — canonical JSON IR과 verification contract
- [skills/sah](skills/sah/) — Codex/Claude Code 공용 대화·구현 workflow
- [src](src/) — CLI/library runtime, gate, atomic manifest update, fact adapter
- [test](test/) — schema, stage, CLI, atomicity, adversarial verification test
- [fixtures](fixtures/) — benchmark 입력과 분리된 안전한 실행 예제
- [benchmarks](benchmarks/) — 방법론 판별 case와 숨겨진 expectation
- [docs](docs/) — 제품, 추론, 아키텍처, 검증, ADR 권위 문서
- [.agent/PLANS.md](.agent/PLANS.md) — 실행 이력, 발견, 검증 근거
- [AGENTS.md](AGENTS.md) — Codex와 다른 코딩 에이전트의 영구 정책
- [CLAUDE.md](CLAUDE.md) — 같은 정책을 import하는 Claude Code 진입점

Bootstrap prompt는 provenance input으로 보존되며 현재 제품 권위가 아닙니다.

## SAH 개발과 전체 검증

Commit 전에 전체 로컬 품질 검사를 실행합니다.

~~~sh
npm install
npm run format:check
npm run lint
npm run typecheck
npm test
npm run build
npm run verify:schemas
~~~

현재 suite는 238개 test를 포함합니다. 정확한 실행 검증 slice, 파일 규율, 문서 line budget,
변경 workflow는 [AGENTS.md](AGENTS.md)가 소유합니다.

## 현재 범위와 한계

SAH는 범용 방법론, 자체 foundation model이나 hosted chat service, source-code
reverse-engineering 제품, diagram editor, 일반 project-management 시스템이 아닙니다.
제품 코드는 사용자의 host agent가 기존 권한 안에서 편집합니다. 현재 다음 기능은
제공하지 않습니다.

- Hosted coordination
- 범용 evidence database
- Git 변경 자동 탐지
- 일반 source graph 또는 predicate 실행
- 자동 LLM/human judgment 실행
- npm에 게시된 package

빠진 기능은 명시적 backlog 또는 incomplete coverage로 남으며 pass를 만들어내지 않습니다.

## 다음에 읽을 문서

- [문서 인덱스](docs/index.md) — 각 개념의 권위 문서 안내
- [Vision](docs/vision.md) — 대상 사용자, 결과, 성공 기준, non-goal
- [설계 추론 모델](docs/design-reasoning-model.md) — 정확한 S0–S13 계약
- [Validation CLI and Library](docs/validation-cli.md) — 명령, result, exit, atomicity
- [Harness architecture](docs/harness-architecture.md) — component boundary와 dependency rule
- [Dogfood walkthrough](docs/dogfood.md) — SAH를 직접 적용하며 발견한 구체적 reasoning repair
